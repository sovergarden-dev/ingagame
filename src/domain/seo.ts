export const PUBLIC_ORIGIN = "https://ingagame.lovable.app";

/** Indexable app routes. Game URLs stay out until a real catalogue publishes them. */
export const PUBLIC_PATHS = [
  "/",
  "/releases",
  "/deals",
  "/free",
  "/news",
  "/discover",
  "/watchlist",
  "/settings",
] as const;

export function canonicalUrl(path: string) {
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) return null;
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return `${PUBLIC_ORIGIN}${normalized === "/" ? "/" : normalized}`;
}

export function canonicalLinks(path: string) {
  const href = canonicalUrl(path);
  return href ? [{ rel: "canonical" as const, href }] : [];
}

export function gameCanonicalPath(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/game/${slug}` : null;
}

export function sitemapXml(paths: readonly string[] = PUBLIC_PATHS) {
  const urls = paths.flatMap((path) => {
    const url = canonicalUrl(path);
    return url ? [`  <url><loc>${url}</loc></url>`] : [];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** Structured data only includes a release date when the catalogue recorded an exact time or a calendar date. */
export function videoGameJsonLd(input: {
  name: string;
  url: string;
  description?: string;
  date?: string;
  precision?: string;
}) {
  if (!input.name.trim() || !input.url.startsWith("https://")) return null;
  const data: Record<string, string> = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: input.name,
    url: input.url,
  };
  if (input.description?.trim()) data.description = input.description.trim();
  if ((input.precision === "exact" || input.precision === "date") && input.date) {
    data.datePublished = input.precision === "date" ? input.date.slice(0, 10) : input.date;
  }
  return data;
}
