import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RADAR_DESTINATION,
  RADAR_REDIRECT_STATUS,
  isRadarPath,
  radarRedirectResponse,
  radarRouteRedirect,
} from "./radar-redirect.ts";

describe("isRadarPath", () => {
  it("matches /radar and a trailing slash, not other routes", () => {
    assert.equal(isRadarPath("/radar"), true);
    assert.equal(isRadarPath("/radar/"), true);
    assert.equal(isRadarPath("/releases"), false);
    assert.equal(isRadarPath("/"), false);
    assert.equal(isRadarPath("/radar-lab"), false);
  });
});

describe("radarRedirectResponse", () => {
  it("returns a 308 Location /releases for a /radar deep link", () => {
    const response = radarRedirectResponse(new Request("https://inga.test/radar"));
    assert.ok(response);
    assert.equal(response.status, 308);
    assert.equal(response.status, RADAR_REDIRECT_STATUS);
    assert.equal(response.headers.get("Location"), "/releases");
    assert.equal(RADAR_DESTINATION, "/releases");
  });

  it("keeps query string so a radar filter deep link still lands on releases", () => {
    const response = radarRedirectResponse(new Request("https://inga.test/radar/?platform=pc"));
    assert.ok(response);
    assert.equal(response.headers.get("Location"), "/releases?platform=pc");
  });

  it("does not intercept other paths", () => {
    assert.equal(radarRedirectResponse(new Request("https://inga.test/releases")), null);
    assert.equal(radarRedirectResponse(new Request("https://inga.test/")), null);
  });
});

describe("radarRouteRedirect", () => {
  it("uses replace so the SPA does not leave /radar in history", () => {
    assert.equal(radarRouteRedirect.to, "/releases");
    assert.equal(radarRouteRedirect.replace, true);
    assert.equal(radarRouteRedirect.statusCode, 308);
  });
});
