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
  options: { country?: string; language?: string; apiKey: string }
): Promise<SerpHit[]> {
  const { country = "it", language = "it", apiKey } = options;
  const seen = new Set<string>();
  const hits: SerpHit[] = [];

  for (const kw of keywords) {
    const params = new URLSearchParams({
      q: kw,
      gl: country,
      hl: language,
      num: String(RESULTS_PER_KEYWORD),
      api_key: apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
    const data = await res.json();
    const organic = data.organic_results ?? [];
    const batch: SerpHit[] = [];
    for (const item of organic.slice(0, RESULTS_PER_KEYWORD)) {
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
