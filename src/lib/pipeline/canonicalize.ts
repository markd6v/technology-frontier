const TRACKING_PARAMS = /^(utm_|mc_|fbclid$|gclid$|ref$|ref_src$|source$|campaign$|cmpid$|_hsenc$|_hsmi$)/i;

/** Normalizes a URL so the same article from different sources dedupes to one item. */
export function canonicalizeUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return input.trim();
  }
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  u.port = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();

  const arxiv = arxivIdFromUrl(u.toString());
  if (arxiv) return `https://arxiv.org/abs/${arxiv}`;

  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  u.pathname = path;
  return u.toString();
}

/** "https://arxiv.org/pdf/2610.21185v2" → "2610.21185" (version dropped). */
export function arxivIdFromUrl(url: string): string | undefined {
  const m = url.match(
    /arxiv\.org\/(?:abs|pdf|html)\/((?:\d{4}\.\d{4,5})|(?:[a-z-]+(?:\.[A-Z]{2})?\/\d{7}))(?:v\d+)?/i,
  );
  return m?.[1];
}

export function normalizeArxivId(id: string): string {
  return id.replace(/^arxiv:/i, "").replace(/v\d+$/, "");
}
