import { pipelineDetail, truncateForLog } from "./pipeline-log";

export type ScrapeLocaleHint = {
  /** SerpAPI-style `gl` (ISO 3166-1 alpha-2), e.g. `us`, `ca`. */
  country?: string;
  /** SerpAPI-style `hl`, e.g. `en`, `fr`. */
  language?: string;
};

const MIN_USABLE_CHARS = 400;

const BLOCKED_CONTENT_PATTERNS: RegExp[] = [
  /^#\s*403\s+Forbidden/im,
  /\b403 forbidden\b/i,
  /performing security verification/i,
  /verify you are not a bot/i,
  /access denied/i,
  /please enable javascript/i,
  /enable javascript to continue/i,
  /just a moment\.\.\./i,
  /attention required! \| cloudflare/i,
];

type ScrapeProfile = "default" | "heavy";

/**
 * Build Accept-Language for Cloudflare Browser Rendering `setExtraHTTPHeaders`.
 */
export function localeHeadersForScrape(
  locale?: ScrapeLocaleHint
): Record<string, string> | undefined {
  if (!locale?.country?.trim() && !locale?.language?.trim()) return undefined;
  const lang = (locale.language ?? "en").trim().toLowerCase();
  const region = (locale.country ?? "").trim().toUpperCase();
  const acceptLanguage =
    region.length === 2
      ? `${lang}-${region},${lang};q=0.9,en;q=0.5`
      : `${lang},en;q=0.5`;
  return { "Accept-Language": acceptLanguage };
}

export function isUsableScrapedContent(content: string): {
  usable: boolean;
  reason?: string;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return { usable: false, reason: "empty" };
  }
  if (trimmed.length < MIN_USABLE_CHARS) {
    return { usable: false, reason: "too_short" };
  }
  for (const pattern of BLOCKED_CONTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { usable: false, reason: "blocked_or_error_page" };
    }
  }
  return { usable: true };
}

function isRetryableScrapeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("422") ||
    msg.includes("execution context was destroyed") ||
    msg.includes("Navigation timeout") ||
    msg.includes("Timeout")
  );
}

function buildScrapeBody(
  url: string,
  profile: ScrapeProfile,
  scrapeLocale?: ScrapeLocaleHint
): Record<string, unknown> {
  const extra = localeHeadersForScrape(scrapeLocale);
  const body: Record<string, unknown> = {
    url,
    gotoOptions:
      profile === "heavy"
        ? { waitUntil: "networkidle0", timeout: 45_000 }
        : { waitUntil: "domcontentloaded", timeout: 30_000 },
  };
  if (extra) {
    body.setExtraHTTPHeaders = extra;
  }
  return body;
}

export async function scrapeToMarkdown(
  url: string,
  options: {
    apiToken: string;
    accountId: string;
    scrapeLocale?: ScrapeLocaleHint;
    profile?: ScrapeProfile;
  }
): Promise<string> {
  const { apiToken, accountId, profile = "default" } = options;
  const body = buildScrapeBody(url, profile, options.scrapeLocale);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudflare API error: ${res.status} - ${err}`);
  }
  const data = await res.json();
  return data.result ?? "";
}

async function scrapeWithRetry(
  url: string,
  options: {
    apiToken: string;
    accountId: string;
    scrapeLocale?: ScrapeLocaleHint;
  }
): Promise<{ url: string; content: string } | null> {
  const profiles: ScrapeProfile[] = ["default", "heavy"];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    try {
      const content = await scrapeToMarkdown(url, { ...options, profile });
      const quality = isUsableScrapedContent(content);
      if (quality.usable) {
        return { url, content };
      }

      pipelineDetail("Competitor page skipped (low-quality markdown)", {
        url,
        profile,
        reason: quality.reason,
        markdownChars: content.length,
        preview: truncateForLog(content, 120),
      });

      if (profile === "heavy") {
        return null;
      }
    } catch (e) {
      const retryable = isRetryableScrapeError(e) && i < profiles.length - 1;
      pipelineDetail(
        retryable ? "Scrape failed (will retry)" : "Scrape failed",
        {
          url,
          profile,
          error: e instanceof Error ? e.message : String(e),
        }
      );
      if (!retryable) {
        return null;
      }
    }
  }

  return null;
}

export async function scrapeSingleUrl(
  url: string,
  options: {
    apiToken: string;
    accountId: string;
    scrapeLocale?: ScrapeLocaleHint;
  }
): Promise<{ url: string; content: string } | null> {
  const article = await scrapeWithRetry(url, options);
  if (article) {
    pipelineDetail("Competitor markdown scraped (single URL)", {
      url,
      markdownChars: article.content.length,
      preview: truncateForLog(article.content, 280),
    });
  }
  return article;
}

export async function scrapeArticles(
  urls: string[],
  options: {
    apiToken: string;
    accountId: string;
    scrapeLocale?: ScrapeLocaleHint;
  }
): Promise<{ url: string; content: string }[]> {
  if (options.scrapeLocale) {
    const h = localeHeadersForScrape(options.scrapeLocale);
    if (h) {
      pipelineDetail("Cloudflare scrape: Accept-Language hint (does not change IP / egress)", {
        scrapeLocale: options.scrapeLocale,
        setExtraHTTPHeaders: h,
      });
    }
  }

  const results = await Promise.all(
    urls.map((url) => scrapeWithRetry(url, options))
  );
  const articles = results.filter(
    (a): a is { url: string; content: string } => a !== null
  );

  for (const article of articles) {
    pipelineDetail("Competitor markdown scraped (used for topic insights prompt)", {
      url: article.url,
      markdownChars: article.content.length,
      preview: truncateForLog(article.content, 280),
    });
  }

  pipelineDetail("Scrape batch complete", {
    attempted: urls.length,
    usableArticles: articles.length,
    skipped: urls.length - articles.length,
  });

  return articles;
}

export function formatScrapedForPrompt(
  articles: { url: string; content: string }[],
  maxCharsPerArticle: number = 8000
): string {
  return articles
    .map(
      (a, i) =>
        `=== ARTICLE ${i + 1} (source: ${a.url}) ===\n${a.content.slice(0, maxCharsPerArticle)}`
    )
    .join("\n\n");
}
