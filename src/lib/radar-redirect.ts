/** Canonical alias for the Releases radar. Deep links must not 404. */
export const RADAR_PATH = "/radar";
export const RADAR_DESTINATION = "/releases";
export const RADAR_REDIRECT_STATUS = 308 as const;

export const radarRouteRedirect = {
  to: RADAR_DESTINATION,
  replace: true,
  statusCode: RADAR_REDIRECT_STATUS,
} as const;

export function isRadarPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === RADAR_PATH;
}

export function radarRedirectResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isRadarPath(url.pathname)) return null;
  return new Response(null, {
    status: RADAR_REDIRECT_STATUS,
    headers: { Location: `${RADAR_DESTINATION}${url.search}` },
  });
}
