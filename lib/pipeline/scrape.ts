import type { ScrapeLocaleHint } from "./cloudflare";
import {
  scrapeSingleUrl as scrapeSingleUrlCloudflare,
  formatScrapedForPrompt,
} from "./cloudflare";
import { scrapeWithScrapeDo, type ScrapeKind } from "./scrapedo";
import { pipelineDetail } from "./pipeline-log";

export { formatScrapedForPrompt };
export type { ScrapeKind } from "./scrapedo";

/** Subset of PipelineRuntimeEnv needed to pick and run a scraping provider. */
export type ScrapeEnv = {
  SCRAPEDO_TOKEN?: string;
  SCRAPEDO_DISABLED?: boolean;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

export type ScrapedDoc = { url: string; content: string };

export type ScrapeOptions = {
  scrapeEnv: ScrapeEnv;
  scrapeLocale?: ScrapeLocaleHint;
  kind: ScrapeKind;
};

function hasCloudflare(env: ScrapeEnv): boolean {
  return Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID);
}

function scrapeDoEnabled(env: ScrapeEnv): boolean {
  return Boolean(env.SCRAPEDO_TOKEN) && !env.SCRAPEDO_DISABLED;
}

/** True when at least one scraping provider is configured. */
export function hasScraper(env: ScrapeEnv): boolean {
  return scrapeDoEnabled(env) || hasCloudflare(env);
}

/**
 * Scrape one URL to markdown using the best configured provider.
 * Scrape.do (residential proxies, geo-targeting) is preferred because casino
 * sites routinely block datacenter IPs; Cloudflare Browser Rendering is the
 * fallback when Scrape.do is unset or every Scrape.do profile is blocked.
 */
export async function scrapeSingleUrl(
  url: string,
  options: ScrapeOptions
): Promise<ScrapedDoc | null> {
  const { scrapeEnv, scrapeLocale, kind } = options;

  if (scrapeDoEnabled(scrapeEnv)) {
    const viaScrapeDo = await scrapeWithScrapeDo(url, {
      token: scrapeEnv.SCRAPEDO_TOKEN!,
      scrapeLocale,
      kind,
    });
    if (viaScrapeDo) return viaScrapeDo;

    if (hasCloudflare(scrapeEnv)) {
      pipelineDetail("Scrape.do blocked — falling back to Cloudflare", {
        url,
        kind,
      });
      return scrapeSingleUrlCloudflare(url, {
        apiToken: scrapeEnv.CLOUDFLARE_API_TOKEN!,
        accountId: scrapeEnv.CLOUDFLARE_ACCOUNT_ID!,
        scrapeLocale,
      });
    }
    return null;
  }

  if (hasCloudflare(scrapeEnv)) {
    return scrapeSingleUrlCloudflare(url, {
      apiToken: scrapeEnv.CLOUDFLARE_API_TOKEN!,
      accountId: scrapeEnv.CLOUDFLARE_ACCOUNT_ID!,
      scrapeLocale,
    });
  }

  return null;
}

/** Scrape many URLs in parallel through the configured provider(s). */
export async function scrapeArticles(
  urls: string[],
  options: { scrapeEnv: ScrapeEnv; scrapeLocale?: ScrapeLocaleHint; kind?: ScrapeKind }
): Promise<ScrapedDoc[]> {
  const kind = options.kind ?? "competitor";
  const results = await Promise.all(
    urls.map((url) =>
      scrapeSingleUrl(url, {
        scrapeEnv: options.scrapeEnv,
        scrapeLocale: options.scrapeLocale,
        kind,
      })
    )
  );
  const articles = results.filter((a): a is ScrapedDoc => a !== null);

  pipelineDetail("Scrape batch complete", {
    provider: scrapeDoEnabled(options.scrapeEnv)
      ? "scrape.do (+cf fallback)"
      : "cloudflare",
    attempted: urls.length,
    usableArticles: articles.length,
    skipped: urls.length - articles.length,
  });

  return articles;
}
