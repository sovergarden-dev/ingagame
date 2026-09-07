import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAIN_NAV,
  MOBILE_BOTTOM_NAV_MAX_PX,
  MOBILE_NAV,
  MOBILE_NAV_MIN_HIT_PX,
  isNavItemActive,
  showsMobileBottomNav,
} from "./nav-items.ts";

describe("MOBILE_NAV", () => {
  it("keeps Home Releases Deals Free Watchlist on the bar", () => {
    assert.deepEqual(
      MOBILE_NAV.map((item) => item.to),
      ["/", "/releases", "/deals", "/free", "/watchlist"],
    );
  });

  it("leaves News and Discover in the overflow/full nav, not the bar", () => {
    const bar = MOBILE_NAV.map((item) => item.to);
    const full = MAIN_NAV.map((item) => item.to);
    assert.equal(bar.includes("/news"), false);
    assert.equal(bar.includes("/discover"), false);
    assert.equal(full.includes("/news"), true);
    assert.equal(full.includes("/discover"), true);
  });

  it("meets the 44px hit target at a 390px five-item bar", () => {
    assert.ok(MOBILE_NAV_MIN_HIT_PX >= 44);
    const slot = 390 / MOBILE_NAV.length;
    assert.ok(slot >= MOBILE_NAV_MIN_HIT_PX);
  });
});

describe("showsMobileBottomNav", () => {
  it("is visible at iPhone-width 390px and hidden from the md sidebar up", () => {
    assert.equal(showsMobileBottomNav(390), true);
    assert.equal(showsMobileBottomNav(MOBILE_BOTTOM_NAV_MAX_PX), true);
    assert.equal(showsMobileBottomNav(MOBILE_BOTTOM_NAV_MAX_PX + 1), false);
  });
});

describe("isNavItemActive", () => {
  it("marks Releases active for /releases and the /radar alias", () => {
    assert.equal(isNavItemActive("/releases", "/releases"), true);
    assert.equal(isNavItemActive("/releases", "/radar"), true);
    assert.equal(isNavItemActive("/releases", "/radar/"), true);
    assert.equal(isNavItemActive("/", "/radar"), false);
    assert.equal(isNavItemActive("/deals", "/releases"), false);
  });

  it("matches other bar destinations to their own route only", () => {
    assert.equal(isNavItemActive("/", "/"), true);
    assert.equal(isNavItemActive("/", "/releases"), false);
    assert.equal(isNavItemActive("/deals", "/deals"), true);
    assert.equal(isNavItemActive("/free", "/free"), true);
    assert.equal(isNavItemActive("/watchlist", "/watchlist"), true);
    assert.equal(isNavItemActive("/watchlist", "/releases"), false);
  });
});
