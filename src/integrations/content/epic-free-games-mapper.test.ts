import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEpicPromotionExternalId,
  mapEpicFreeGameToDeal,
  type RawEpicFreeGameElement,
} from "./epic-free-games-mapper.ts";
import { isDealItem } from "./feed.ts";

describe("buildEpicPromotionExternalId", () => {
  it("formats deterministic namespaced external_id per Notion Sy06", () => {
    assert.equal(
      buildEpicPromotionExternalId("epic-ns", "offer-123", "2026-10-25T15:00:00.000Z", "US"),
      "epic:namespace:epic-ns:offer:offer-123:market:us:end:2026-10-25T15:00:00.000Z",
    );
  });
});

describe("mapEpicFreeGameToDeal", () => {
  const fixedNow = new Date("2026-10-21T12:00:00.000Z");

  const validFreeElement: RawEpicFreeGameElement = {
    id: "epic-offer-1",
    namespace: "epic-ns-1",
    title: "Ghostwire: Tokyo",
    description: "Tokyo's population has vanished.",
    offerType: "BASE_GAME",
    productSlug: "ghostwire-tokyo/home",
    keyImages: [
      { type: "DieselStoreFrontWide", url: "https://example.com/gw-wide.jpg" },
      { type: "Thumbnail", url: "https://example.com/gw-thumb.jpg" },
    ],
    price: {
      totalPrice: {
        discountPrice: 0,
        originalPrice: 5999, // $59.99
        currencyCode: "USD",
      },
    },
    promotions: {
      promotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-10-20T15:00:00.000Z",
              endDate: "2026-10-27T15:00:00.000Z",
              discountSetting: {
                discountType: "PERCENTAGE",
                discountPercentage: 0,
              },
            },
          ],
        },
      ],
    },
  };

  it("maps active 100% free promotional offer to verified free_to_keep Deal", () => {
    const res = mapEpicFreeGameToDeal(validFreeElement, "us", fixedNow);
    assert.ok(res);
    assert.equal(
      res.externalId,
      "epic:namespace:epic-ns-1:offer:epic-offer-1:market:us:end:2026-10-27T15:00:00.000Z",
    );
    assert.equal(res.deal.id, "deal-epic-epic-offer-1");
    assert.equal(res.deal.store, "Epic Games Store");
    assert.equal(res.deal.priceCurrent, 0);
    assert.equal(res.deal.priceBase, 59.99);
    assert.equal(res.deal.discountPercent, 100);
    assert.equal(res.deal.offerType, "free_to_keep");
    assert.equal(res.deal.classificationStatus, "verified");
    assert.equal(res.deal.endsAt, "2026-10-27T15:00:00.000Z");
    assert.equal(res.deal.url, "https://store.epicgames.com/en-US/p/ghostwire-tokyo");

    // GameSummary verification
    assert.ok(res.deal.gameSummary);
    assert.equal(res.deal.gameSummary.title, "Ghostwire: Tokyo");
    assert.equal(res.deal.gameSummary.coverUrl, "https://example.com/gw-wide.jpg");
    assert.equal(res.deal.gameSummary.steamAppId, undefined); // Preserves undefined -> unknown ownership on Steam
    assert.deepEqual(res.deal.gameSummary.storeRefs, [
      {
        store: "epic",
        namespace: "epic-ns-1",
        offerId: "epic-offer-1",
        slug: "ghostwire-tokyo",
      },
    ]);

    // Feed validation
    assert.ok(isDealItem(res.deal));
  });

  it("drops upcoming offers that have not started yet", () => {
    const upcomingElement: RawEpicFreeGameElement = {
      ...validFreeElement,
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-10-28T15:00:00.000Z",
                endDate: "2026-11-04T15:00:00.000Z",
                discountSetting: { discountPercentage: 0 },
              },
            ],
          },
        ],
      },
    };
    const res = mapEpicFreeGameToDeal(upcomingElement, "us", fixedNow);
    assert.equal(res, null);
  });

  it("drops expired promotional offers", () => {
    const expiredElement: RawEpicFreeGameElement = {
      ...validFreeElement,
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-10-10T15:00:00.000Z",
                endDate: "2026-10-17T15:00:00.000Z",
                discountSetting: { discountPercentage: 0 },
              },
            ],
          },
        ],
      },
    };
    const res = mapEpicFreeGameToDeal(expiredElement, "us", fixedNow);
    assert.equal(res, null);
  });

  it("drops non-free paid offers", () => {
    const paidElement: RawEpicFreeGameElement = {
      ...validFreeElement,
      price: {
        totalPrice: {
          discountPrice: 1999, // $19.99
          originalPrice: 5999,
          currencyCode: "USD",
        },
      },
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-10-20T15:00:00.000Z",
                endDate: "2026-10-27T15:00:00.000Z",
                discountSetting: { discountPercentage: 50 },
              },
            ],
          },
        ],
      },
    };
    const res = mapEpicFreeGameToDeal(paidElement, "us", fixedNow);
    assert.equal(res, null);
  });

  it("filters out ADD_ON and IN_GAME_PURCHASE offers per hygiene rules", () => {
    const addOnElement: RawEpicFreeGameElement = {
      ...validFreeElement,
      offerType: "ADD_ON",
    };
    assert.equal(mapEpicFreeGameToDeal(addOnElement, "us", fixedNow), null);

    const igpElement: RawEpicFreeGameElement = {
      ...validFreeElement,
      offerType: "IN_GAME_PURCHASE",
    };
    assert.equal(mapEpicFreeGameToDeal(igpElement, "us", fixedNow), null);
  });
});
