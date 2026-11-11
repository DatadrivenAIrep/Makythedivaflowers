// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { refuseTarget } from "../../scripts/card-dates-dry-run";

describe("card-dates dry run target guard", () => {
  it("refuses when SQLITE_FILE is unset", () => {
    expect(refuseTarget(undefined)).toMatch(/not set/);
    expect(refuseTarget("")).toMatch(/not set/);
  });

  it.each(["data/diva.sqlite", "./Data/Diva.sqlite", "/x/y/data/diva.sqlite", "/home/u/data/diva.sqlite"])(
    "refuses %s",
    (file) => {
      expect(refuseTarget(file)).toMatch(/another name/);
    },
  );

  it("refuses a symlink that points at a diva.sqlite", () => {
    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "guard-"));
    try {
      const real = path.join(dir, "diva.sqlite");
      fs.writeFileSync(real, "");
      const link = path.join(dir, "innocent.sqlite");
      fs.symlinkSync(real, link);
      expect(refuseTarget(link)).toMatch(/another name/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows a copy with another name", () => {
    expect(refuseTarget("/tmp/x/diva-copy.sqlite")).toBeNull();
  });
});
