import { describe, it, expect } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

describe("@react-pdf/renderer smoke test", () => {
  it("renders a one-page PDF buffer", async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "LETTER" },
        React.createElement(Text, null, "hello"),
      ),
    );
    const buf = await renderToBuffer(doc);
    expect(buf).toBeInstanceOf(Buffer);
    // PDF magic header: %PDF-
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
