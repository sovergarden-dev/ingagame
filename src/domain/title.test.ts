import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayTitle, gameDocumentTitle, searchHaystack } from "./title.ts";

describe("displayTitle", () => {
  const game = { title: "Tidewrought", originalTitle: "潮織り" };

  it("uses the original title only in original mode", () => {
    assert.equal(displayTitle(game, "original"), "潮織り");
    assert.equal(displayTitle(game, "localized"), "Tidewrought");
  });

  it("keeps the catalogue title when no original title is recorded", () => {
    assert.equal(displayTitle({ title: "Harborlight" }, "original"), "Harborlight");
  });

  it("builds the browser title from the title that is actually shown", () => {
    assert.equal(gameDocumentTitle("潮織り"), "潮織り — Inga");
  });

  it("matches an original title that is not the catalogue title", () => {
    assert.equal(
      searchHaystack({ title: "Tidewrought", originalTitle: "潮織り" }).includes("潮織り"),
      true,
    );
    assert.equal(searchHaystack({ title: "Tidewrought" }).includes("潮織り"), false);
  });
});
