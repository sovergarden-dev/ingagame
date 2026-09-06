import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeUiText } from "./ui-text.ts";
import { hasEnded, isDealExpired, isEndingSoon, parseDealEndMs } from "../domain/deal.ts";

describe("decodeUiText", () => {
  it("shows Home not Home%20", () => {
    assert.equal(decodeUiText("Home%20"), "Home");
    assert.equal(decodeUiText("Home "), "Home");
    assert.equal(decodeUiText("Home"), "Home");
  });

  it("leaves ordinary percent copy alone", () => {
    assert.equal(decodeUiText("Save 50%"), "Save 50%");
  });
});

describe("isDealExpired", () => {
  const end = "2026-09-06T00:00:00Z";
  const endMs = Date.parse(end);

  it("is not expired when the clock is unknown", () => {
    assert.equal(isDealExpired(end, null), false);
  });

  it("treats missing endsAt as active", () => {
    assert.equal(isDealExpired(undefined, endMs + 1), false);
    assert.equal(parseDealEndMs(undefined), null);
  });

  it("matches toast and card: expired at and after endsAt", () => {
    assert.equal(isDealExpired(end, endMs - 1), false);
    assert.equal(isDealExpired(end, endMs), true);
    assert.equal(isDealExpired(end, endMs + 1), true);
    assert.equal(hasEnded(end, endMs + 1), true);
  });
});

describe("isEndingSoon", () => {
  const end = "2026-09-06T00:00:00Z";
  const endMs = Date.parse(end);

  it("excludes expired giveaways from Ending soon", () => {
    assert.equal(isEndingSoon(end, endMs + 1), false);
    assert.equal(isEndingSoon(end, endMs), false);
  });

  it("includes active titles inside the window", () => {
    assert.equal(isEndingSoon(end, endMs - 3_600_000), true);
    assert.equal(isEndingSoon(end, endMs - 80 * 3_600_000), false);
  });
});
