import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { browserCache } from "../src/browser-cache";

class FakeBrowser extends EventEmitter {}

function launcher(outcomes: Array<"ok" | "fail">) {
  let calls = 0;
  const launch = async (): Promise<FakeBrowser> => {
    const outcome = outcomes[calls++] ?? "ok";
    if (outcome === "fail") throw new Error("Failed to launch the browser process!");
    return new FakeBrowser();
  };
  return { launch, calls: () => calls };
}

test("reuses one browser across jobs", async () => {
  const cache = browserCache<FakeBrowser>();
  const l = launcher(["ok"]);
  const a = await cache.get(l.launch);
  const b = await cache.get(l.launch);
  assert.equal(a, b);
  assert.equal(l.calls(), 1);
});

test("a failed launch is not reused: the next job launches Chrome again", async () => {
  const cache = browserCache<FakeBrowser>();
  const l = launcher(["fail", "ok"]);
  await assert.rejects(cache.get(l.launch), /Failed to launch/);
  const b = await cache.get(l.launch);
  assert.ok(b instanceof FakeBrowser);
  assert.equal(l.calls(), 2);
});

test("a browser that dies is dropped: the next job launches a fresh one", async () => {
  const cache = browserCache<FakeBrowser>();
  const l = launcher(["ok", "ok"]);
  const first = await cache.get(l.launch);
  first.emit("disconnected");
  const second = await cache.get(l.launch);
  assert.notEqual(first, second);
  assert.equal(l.calls(), 2);
});

test("an old browser disconnecting does not drop its replacement", async () => {
  const cache = browserCache<FakeBrowser>();
  const l = launcher(["ok", "ok"]);
  const first = await cache.get(l.launch);
  first.emit("disconnected");
  const second = await cache.get(l.launch);
  first.emit("disconnected");
  assert.equal(await cache.get(l.launch), second);
  assert.equal(l.calls(), 2);
});

test("take() hands back the cached launch once, for shutdown", async () => {
  const cache = browserCache<FakeBrowser>();
  const l = launcher(["ok"]);
  const b = await cache.get(l.launch);
  assert.equal(await cache.take(), b);
  assert.equal(cache.take(), null);
});
