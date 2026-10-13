import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowViewTransition } from "./view-transition.ts";

describe("allowViewTransition", () => {
  it("allows a transition only when motion is on and the browser supports it", () => {
    assert.equal(
      allowViewTransition({ reduceMotion: false, prefersReduced: false, supported: true }),
      true,
    );
  });

  it("stays off for the preference, the system setting, or a browser without support", () => {
    assert.equal(
      allowViewTransition({ reduceMotion: true, prefersReduced: false, supported: true }),
      false,
    );
    assert.equal(
      allowViewTransition({ reduceMotion: false, prefersReduced: true, supported: true }),
      false,
    );
    assert.equal(
      allowViewTransition({ reduceMotion: false, prefersReduced: false, supported: false }),
      false,
    );
  });
});
