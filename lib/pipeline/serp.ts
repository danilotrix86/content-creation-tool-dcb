import { pipelineDetail } from "./pipeline-log";

const RESULTS_PER_KEYWORD = 3;

export type SerpHit = {
  url: string;
  title: string;
  snippet: string;
  position: number;
  searchQuery: string;
};

export async function searchGoogle(
  keywords: string[],
  options: {
    country?: string;
    language?: string;
    apiKey: string;
    resultsPerKeyword?: number;
  }
): Promise<SerpHit[]> {
  const {
    country = "it",
    language = "it",
    apiKey,
    resultsPerKeyword = RESULTS_PER_KEYWORD,
  } = options;
  const perKeyword = Math.max(1, resultsPerKeyword);
  const seen = new Set<string>();
  const hits: SerpHit[] = [];

  for (const kw of keywords) {
    const params = new URLSearchParams({
      q: kw,
      gl: country,
      hl: language,
      num: String(perKeyword),
      api_key: apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
    const data = await res.json();
    const organic = data.organic_results ?? [];
    const batch: SerpHit[] = [];
    for (const item of organic.slice(0, perKeyword)) {
      const link = item.link as string | undefined;
      if (link && !seen.has(link)) {
        seen.add(link);
        const hit: SerpHit = {
          url: link,
          title: typeof item.title === "string" ? item.title : "",
          snippet: typeof item.snippet === "string" ? item.snippet : "",
          position:
            typeof item.position === "number" ? item.position : batch.length + 1,
          searchQuery: kw,
        };
        hits.push(hit);
        batch.push(hit);
      }
    }
    pipelineDetail("SerpAPI organic results for keyword", {
      searchQuery: kw,
      gl: country,
      hl: language,
      resultsInBatch: batch.length,
      competitors: batch.map((h) => ({
        position: h.position,
        title: h.title,
        url: h.url,
        snippetPreview: h.snippet.slice(0, 200) + (h.snippet.length > 200 ? "…" : ""),
      })),
    });
  }

  pipelineDetail("SerpAPI summary (deduped URLs for scraping)", {
    uniqueUrls: hits.length,
    urls: hits.map((h) => h.url),
  });

  return hits;
}

/** Map common country-name URL path segments to ISO-3166 alpha-2 codes. */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  canada: "ca",
  australia: "au",
  india: "in",
  germany: "de",
  france: "fr",
  spain: "es",
  italy: "it",
  hungary: "hu",
  poland: "pl",
  brazil: "br",
  portugal: "pt",
  netherlands: "nl",
};

/**
 * Score a SERP hit by how well its URL locale matches the target search
 * country/language. Foreign-region pages (e.g. an /en-ZA page in Rand for a
 * Hungarian job) are hard-demoted so they cannot win on domain boost alone,
 * while target-locale pages are boosted. Generic language-only paths (e.g.
 * /en/) stay neutral.
 */
export function localeScore(
  url: string,
  searchCountry?: string,
  searchLanguage?: string
): number {
  const country = searchCountry?.trim().toLowerCase();
  const language = searchLanguage?.trim().toLowerCase();
  if (!country && !language) return 0;

  let host: string;
  let segments: string[];
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    segments = parsed.pathname
      .toLowerCase()
      .split("/")
      .filter((s) => s.length > 0);
  } catch {
    return 0;
  }

  const matchesTarget = (code: string): boolean =>
    code === country || code === language;

  // 1. Explicit region in an xx-YY locale segment (e.g. en-za, pt-br).
  for (const seg of segments) {
    const m = /^([a-z]{2})-([a-z]{2})$/.exec(seg);
    if (m) {
      const region = m[2];
      const lang = m[1];
      if (matchesTarget(region) || matchesTarget(lang)) return 60;
      return -120;
    }
  }

  // 2. Country-name path segment (e.g. /canada/).
  for (const seg of segments) {
    const code = COUNTRY_NAME_TO_CODE[seg];
    if (code) {
      if (matchesTarget(code)) return 60;
      return -120;
    }
  }

  // 3. Bare locale/language segment matching the target (e.g. /hu/).
  for (const seg of segments) {
    if (/^[a-z]{2}$/.test(seg) && matchesTarget(seg)) return 60;
  }

  // 4. Host tokens hinting the target locale (e.g. casino-hu.com, magyar*, *.hu).
  if (country) {
    if (
      host.endsWith(`.${country}`) ||
      new RegExp(`(^|[-.])${country}([-.]|$)`).test(host)
    ) {
      return 60;
    }
  }
  if (country === "hu" && /magyar|kaszino/.test(host)) return 60;

  return 0;
}

/**
 * Build a small pseudo-document from SERP titles + snippets. Used as a
 * last-resort source for fact extraction when every candidate page is blocked,
 * so Google's own result snippets (which usually surface licence/bonus
 * headlines) are not thrown away.
 */
export function serpHitsToPseudoDoc(hits: SerpHit[]): string {
  return hits
    .map(
      (h, i) =>
        `Result ${i + 1}: ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`
    )
    .join("\n\n");
}
