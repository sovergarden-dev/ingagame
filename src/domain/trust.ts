import type { ReleaseEvent } from "./types";

/** Source text only when one was actually recorded. */
export function recordedSource(event: Pick<ReleaseEvent, "source">): string | null {
  const source = event.source?.trim();
  return source ? source : null;
}

export function nextScreenshot(index: number, count: number, direction: 1 | -1) {
  if (count <= 0) return 0;
  return (index + direction + count) % count;
}
