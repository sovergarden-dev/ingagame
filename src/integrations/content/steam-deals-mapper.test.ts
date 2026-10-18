import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSteamDealExternalId,
  mapSteamSpecialToDeal,
  type RawSteamSpecial,
} from "./steam-deals-mapper.ts";
import { isDealItem } from "./feed.ts";

describe("buildSteamDealExternalId", () => {
  it("formats deterministic namespaced external_id per Notion Sy06", () => {
    assert.equal(
      buildSteamDealExternalId(1145350, "US", "usd"),
      "steam:app:1145350:market:us:currency:USD",
    );
  });
});

describe("mapSteamSpecialToDeal", () => {
  const validSpecial: RawSteamSpecial = {
    id: 1145350,
    name: "Hades II",
    header_image: "https://example.com/hades2.jpg",
    discount_percent: 40,
    original_price: 2999, // $29.99
    final_price: 1799, // $17.99
    currency: "USD",
    discount_expiration: 1792128000,
  };

  it("maps valid Steam special to Deal with clean pricing", () => {
    const res = mapSteamSpecialToDeal(validSpecial, "us");
    assert.ok(res);
    assert.equal(res.externalId, "steam:app:1145350:market:us:currency:USD");
    assert.equal(res.deal.id, "deal-steam-1145350");
    assert.equal(res.deal.gameId, "steam-1145350");
    assert.equal(res.deal.priceCurrent, 17.99);
    assert.equal(res.deal.priceBase, 29.99);
    assert.equal(res.deal.discountPercent, 40);
    assert.equal(res.deal.currency, "USD");
    assert.ok(res.deal.endsAt);

    // Schema verification
    assert.ok(isDealItem(res.deal));
  });

  it("handles free/100% discount correctly", () => {
    const freeSpecial: RawSteamSpecial = {
      ...validSpecial,
      discount_percent: 100,
      final_price: 0,
    };
    const res = mapSteamSpecialToDeal(freeSpecial);
    assert.ok(res);
    assert.equal(res.deal.priceCurrent, 0);
    assert.equal(res.deal.discountPercent, 100);
    assert.ok(isDealItem(res.deal));
  });

  it("handles absent discount_expiration without fabricating dates", () => {
    const { discount_expiration: _, ...noExpiry } = validSpecial;
    const res = mapSteamSpecialToDeal(noExpiry);
    assert.ok(res);
    assert.equal(res.deal.endsAt, undefined);
    assert.ok(isDealItem(res.deal));
  });

  it("rejects invalid prices (negative or current > base)", () => {
    assert.equal(mapSteamSpecialToDeal({ ...validSpecial, final_price: -100 }), null);
    assert.equal(mapSteamSpecialToDeal({ ...validSpecial, final_price: 3500 }), null);
    assert.equal(mapSteamSpecialToDeal({ ...validSpecial, original_price: -100 }), null);
  });

  it("rejects invalid discount percentage", () => {
    assert.equal(mapSteamSpecialToDeal({ ...validSpecial, discount_percent: 150 }), null);
    assert.equal(mapSteamSpecialToDeal({ ...validSpecial, discount_percent: -10 }), null);
  });
});
