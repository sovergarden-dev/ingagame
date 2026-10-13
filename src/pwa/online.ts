/** Live freshness is only honest while the browser still has a network. */
export function freshnessMode(online: boolean): "live" | "offline" {
  return online ? "live" : "offline";
}
