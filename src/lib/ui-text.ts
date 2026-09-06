/**
 * Nav/copy sometimes lands percent-encoded (`Home%20`) from encode/decode mismatch.
 * Decode that for display and trim stray whitespace. Leaves ordinary copy alone
 * (e.g. "100%" has no `%HH` pair).
 */
export function decodeUiText(value: string): string {
  let next = value.trim();
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(next)) break;
    try {
      const decoded = decodeURIComponent(next).trim();
      if (decoded === next) break;
      next = decoded;
    } catch {
      break;
    }
  }
  return next;
}
