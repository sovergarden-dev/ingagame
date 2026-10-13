import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextScreenshot, recordedSource } from "./trust.ts";

describe("recordedSource", () => {
  it("returns a trimmed source", () => {
    assert.equal(
      recordedSource({ source: "  Publisher announcement  " }),
      "Publisher announcement",
    );
  });

  it("does not invent a source when the field is missing or blank", () => {
    assert.equal(recordedSource({}), null);
    assert.equal(recordedSource({ source: "   " }), null);
  });
});

describe("nextScreenshot", () => {
  it("wraps the gallery without walking past the ends", () => {
    assert.equal(nextScreenshot(0, 3, -1), 2);
    assert.equal(nextScreenshot(2, 3, 1), 0);
  });

  it("stays put when there are no screenshots", () => {
    assert.equal(nextScreenshot(4, 0, 1), 0);
  });
});
