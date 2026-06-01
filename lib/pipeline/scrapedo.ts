import { pipelineDetail, truncateForLog } from "./pipeline-log";
import { isUsableScrapedContent, type ScrapeLocaleHint } from "./cloudflare";
import { scrapeFetch } from "./scrape-fetch";

/**
 * What we are scraping. Controls how aggressively (and expensively) we escalate
 * Scrape.do request profiles. Casino/bonus/licence pages tend to sit behind
 * anti-bot/WAF/geo gating, so they start on datacenter + geoCode (playground
 * pattern), then escalate to residential + render.
 */
export type ScrapeKind = "competitor" | "casino" | "bonus" | "licence";

/**
 * A single Scrape.do request configuration. Cheaper profiles come first and we
 * escalate only if the cheap attempt is blocked / low quality.
 */
type ScrapeDoProfile = {
  /** Residential & mobile proxy network (counts as more credits). */
  super: boolean;
  /** Headless browser render (JS execution; most expensive). */
  render: boolean;
  label: string;
};

const LIGHT: ScrapeDoProfile = { super: false, render: false, label: "datacenter" };
const RESIDENTIAL: ScrapeDoProfile = { super: true, render: false, label: "residential" };
const RESIDENTIAL_RENDER: ScrapeDoProfile = {
  super: true,
  render: true,
  label: "residential+render",
};

const TRANSPORT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

function profilesForKind(kind: ScrapeKind): ScrapeDoProfile[] {
  if (kind === "competitor") {
    return [LIGHT, RESIDENTIAL];
  }
  // Match Scrape.do playground: datacenter + geoCode first (1 credit), then escalate.
  return [LIGHT, RESIDENTIAL, RESIDENTIAL_RENDER];
}

/** Scrape.do proxy geos that differ from SerpAPI search_country. */
const SCRAPEDO_GEO_ALIASES: Record<string, string> = {
  hu: "lt", // Hungarian SERP; Scrape.do has no HU proxy — use LT (verified for EU casinos)
};

/** Map article search_country to a Scrape.do-supported geoCode. */
export function mapSearchCountryToScrapeDoGeo(
  searchCountry: string
): string | undefined {
  const code = searchCountry.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return undefined;
  return SCRAPEDO_GEO_ALIASES[code] ?? code;
}

/** ISO 3166-1 alpha-2 geo for Scrape.do (lowercase), derived from scrape locale. */
export function resolveScrapeDoGeoCode(options: {
  scrapeLocale?: ScrapeLocaleHint;
}): string | undefined {
  const raw = options.scrapeLocale?.country?.trim();
  if (!raw) return undefined;
  return mapSearchCountryToScrapeDoGeo(raw);
}

function buildScrapeDoUrl(
  token: string,
  targetUrl: string,
  profile: ScrapeDoProfile,
  geoCode: string | undefined,
  scheme: "http" | "https"
): string {
  const params = new URLSearchParams({
    token,
    url: targetUrl,
    output: "markdown",
  });
  if (profile.super) {
    params.set("super", "true");
  }
  // geoCode works on datacenter requests too (Scrape.do playground pattern).
  if (geoCode) {
    params.set("geoCode", geoCode);
  }
  if (profile.render) {
    params.set("render", "true");
    params.set("customWait", "3000");
  }
  return `${scheme}://api.scrape.do/?${params.toString()}`;
}

function isTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = err.cause as { code?: string; message?: string } | undefined;
  if (cause?.code && TRANSPORT_ERROR_CODES.has(cause.code)) return true;
  const combined = `${err.message} ${cause?.message ?? ""}`;
  return /fetch failed|network|timeout|certificate|TLS|SSL/i.test(combined);
}

function formatScrapeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; errno?: number; message?: string } | undefined;
  const parts = [err.message];
  if (cause?.code) parts.push(`cause.code=${cause.code}`);
  if (cause?.errno != null) parts.push(`cause.errno=${cause.errno}`);
  if (cause?.message && cause.message !== err.message) {
    parts.push(`cause.message=${cause.message}`);
  }
  return parts.join(" | ");
}

async function fetchScrapeDoOnce(
  apiUrl: string
): Promise<string> {
  const res = await scrapeFetch(apiUrl, { method: "GET", timeoutMs: 45_000 });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Scrape.do API error: ${res.status} - ${truncateForLog(body, 200)}`
    );
  }
  return await res.text();
}

async function fetchScrapeDo(
  token: string,
  url: string,
  profile: ScrapeDoProfile,
  geoCode: string | undefined
): Promise<string> {
  // Scrape.do playground uses http:// — try HTTP first (avoids broken HTTPS inspection on some dev networks).
  for (const scheme of ["http", "https"] as const) {
    const apiUrl = buildScrapeDoUrl(token, url, profile, geoCode, scheme);
    try {
      return await fetchScrapeDoOnce(apiUrl);
    } catch (err) {
      if (scheme === "http" && isTransportError(err)) {
        pipelineDetail("Scrape.do HTTP transport failed — trying HTTPS", {
          profile: profile.label,
          geoCode,
          error: formatScrapeError(err),
        });
        continue;
      }
      throw err;
    }
  }
  throw new Error("Scrape.do fetch failed on both HTTP and HTTPS");
}

/**
 * Scrape a single URL through Scrape.do, escalating request profiles until the
 * markdown passes the shared quality gate. Returns null when every profile is
 * blocked / low-quality so the caller can fall back to another provider.
 */
export async function scrapeWithScrapeDo(
  url: string,
  options: {
    token: string;
    scrapeLocale?: ScrapeLocaleHint;
    kind: ScrapeKind;
  }
): Promise<{ url: string; content: string } | null> {
  const profiles = profilesForKind(options.kind);
  const searchCountry = options.scrapeLocale?.country?.trim().toLowerCase();
  const geoCode = resolveScrapeDoGeoCode({ scrapeLocale: options.scrapeLocale });

  if (searchCountry && geoCode && searchCountry !== geoCode) {
    pipelineDetail("Scrape.do geo mapped", { from: searchCountry, to: geoCode });
  }

  for (const profile of profiles) {
    try {
      const content = await fetchScrapeDo(
        options.token,
        url,
        profile,
        geoCode
      );
      const quality = isUsableScrapedContent(content);
      if (quality.usable) {
        pipelineDetail("Scrape.do markdown scraped", {
          url,
          kind: options.kind,
          profile: profile.label,
          geoCode,
          markdownChars: content.length,
          preview: truncateForLog(content, 200),
        });
        return { url, content };
      }
      pipelineDetail("Scrape.do page low-quality (escalating)", {
        url,
        kind: options.kind,
        profile: profile.label,
        geoCode,
        reason: quality.reason,
        markdownChars: content.length,
        preview: truncateForLog(content, 120),
      });
    } catch (e) {
      pipelineDetail("Scrape.do request failed (escalating)", {
        url,
        kind: options.kind,
        profile: profile.label,
        geoCode,
        error: formatScrapeError(e),
      });
      // Unreachable API — skip remaining profiles and fall back to Cloudflare immediately.
      if (isTransportError(e)) {
        pipelineDetail("Scrape.do unreachable (transport error) — skipping remaining profiles", {
          url,
          kind: options.kind,
        });
        return null;
      }
    }
  }

  return null;
}
