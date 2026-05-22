import type { InternalLink } from "./types";

const STOPWORDS = new Set(
  "a ad al allo ai agli all alla alle con da dal dall dai dagli dalla dalle di del dell dei degli della delle e ed in nel nell nei negli nella nelle per su sul sull sui sugli sulla sulle tra fra il lo la i gli le un uno una un come quando dove che cui chi se perché ecc".split(
    " "
  )
);
const GENERIC_TOKENS = new Set(
  "formula formulae guida esempi calcolo calcolare completo completa".split(" ")
);

export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const text = await res.text();
  const urls: string[] = [];
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = locRegex.exec(text)) !== null) {
    const u = m[1].trim();
    if (u) urls.push(u);
  }
  return urls;
}

function scoreUrl(url: string, keywords: string[]): number {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const slugTokens = new Set(path.split(/[-/]/));
    return keywords.filter(
      (kw) => slugTokens.has(kw.toLowerCase()) || path.includes(kw.toLowerCase())
    ).length;
  } catch {
    return 0;
  }
}

function filterRelevanceTokens(tokens: string[]): string[] {
  const filtered = tokens.filter(
    (t) =>
      t.length > 1 &&
      !STOPWORDS.has(t.toLowerCase()) &&
      !GENERIC_TOKENS.has(t.toLowerCase())
  );
  return filtered.length ? filtered : tokens;
}

function urlToAnchor(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    const slug = path.split("/").pop() ?? path;
    return slug
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

export function selectRelevantUrls(
  urls: string[],
  mainTopic: string,
  keyword: string,
  maxLinks: number = 4
): InternalLink[] {
  const topicTokens = mainTopic.toLowerCase().split(/[\s,]+/);
  const kwTokens = keyword.toLowerCase().split(/[\s,]+/);
  const allTokens = filterRelevanceTokens([...new Set([...topicTokens, ...kwTokens])]);

  const scored = urls
    .map((url) => ({ url, score: scoreUrl(url, allTokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, maxLinks);
  const minLinks = 2;
  if (selected.length < minLinks && urls.length >= minLinks) {
    return urls.slice(0, minLinks).map((url) => ({ url, anchor: urlToAnchor(url) }));
  }
  if (selected.length === 0) {
    return urls.slice(0, minLinks).map((url) => ({ url, anchor: urlToAnchor(url) }));
  }
  return selected.map(({ url }) => ({ url, anchor: urlToAnchor(url) }));
}
