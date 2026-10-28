import assert from "node:assert/strict";
import { it } from "node:test";
import { mapEpicFreeGameToDeal, type RawEpicFreeGameElement } from "./epic-free-games-mapper.ts";

export function epicFixture(): RawEpicFreeGameElement {
  return {
    id: "offer-1",
    namespace: "ns-1",
    title: "Synthetic test game",
    offerType: "BASE_GAME",
    productSlug: "test-game/home",
    price: { totalPrice: { originalPrice: 2000, discountPrice: 0, currencyCode: "USD" } },
    promotions: {
      promotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-10-20T15:00:00Z",
              endDate: "2026-10-27T15:00:00Z",
              discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
            },
          ],
        },
      ],
    },
  };
}

it("does not label a paid Epic offer free when its promotion marker is zero", () => {
  const fixture = epicFixture();
  fixture.price = { totalPrice: { originalPrice: 2000, discountPrice: 500, currencyCode: "USD" } };
  assert.equal(mapEpicFreeGameToDeal(fixture, "us", new Date("2026-10-25T00:00:00Z")), null);
});

it("rejects incomplete, malformed and non-base-game Epic offers", () => {
  for (const type of ["BUNDLE", "DEMO", "ADD_ON", "UNKNOWN"]) {
    assert.equal(
      mapEpicFreeGameToDeal(
        { ...epicFixture(), offerType: type },
        "us",
        new Date("2026-10-25T00:00:00Z"),
      ),
      null,
    );
  }
  const missingPrice = epicFixture();
  delete missingPrice.price;
  assert.equal(mapEpicFreeGameToDeal(missingPrice, "us", new Date("2026-10-25T00:00:00Z")), null);
  const malformed: unknown = { ...epicFixture(), promotions: { promotionalOffers: [null] } };
  assert.doesNotThrow(() =>
    mapEpicFreeGameToDeal(
      malformed as RawEpicFreeGameElement,
      "us",
      new Date("2026-10-25T00:00:00Z"),
    ),
  );
});

it("keeps promotion identity across end corrections without inventing platform availability", () => {
  const fixture = epicFixture();
  const now = new Date("2026-10-25T00:00:00Z");
  const first = mapEpicFreeGameToDeal(fixture, "us", now);
  const corrected = structuredClone(fixture);
  const offer = corrected.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
  assert.ok(offer);
  offer.endDate = "2026-10-28T15:00:00Z";
  const second = mapEpicFreeGameToDeal(corrected, "US", now);
  assert.ok(first && second);
  assert.equal(first.externalId, second.externalId);
  assert.equal(first.deal.id, second.deal.id);
  assert.notEqual(first.expiresAt, second.expiresAt);
  assert.equal(first.deal.gameSummary?.platformAvailability?.windows, null);
  assert.ok(Date.parse(first.sourceFreshUntil) < Date.parse(first.expiresAt));
});
