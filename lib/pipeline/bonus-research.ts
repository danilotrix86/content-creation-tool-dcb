import type { SerpHit } from "./serp";
import { searchGoogle, serpHitsToPseudoDoc, localeScore } from "./serp";
import { scrapeSingleUrl, hasScraper } from "./scrape";
import type { ScrapeLocaleHint } from "./cloudflare";
import type { PipelineLlm } from "./llm-types";
import type { PipelineRuntimeEnv } from "./pipeline-env";
import { pipelineDetail } from "./pipeline-log";
import type {
  ArticleInput,
  BonusBlockReason,
  BonusConfidence,
  BonusFacts,
  BonusResearchResult,
  BonusResearchStatus,
  BonusSourceType,
} from "./types";

const AFFILIATE_DOMAIN_PATTERNS = [
  /casino\.guru/i,
  /askgamblers/i,
  /lcb\.org/i,
  /nodeposit/i,
  /bonus\.com/i,
];

const AFFILIATE_PATH_PATTERNS = [/\/review\b/i, /\/reviews\b/i, /\/news\b/i];

/**
 * Drop noise that skews SERP queries toward review aggregators: a trailing
 * "review"/"reviews" word and bracketed/standalone year suffixes like "(2026)".
 */
function cleanCasinoName(name: string): string {
  return name
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/\s*[([]?\b(?:19|20)\d{2}\b[)\]]?\s*$/i, "")
    .replace(/\s+reviews?\s*$/i, "")
    .trim();
}

export function parseCasinoName(
  contentBrief: string,
  mainTopic: string
): string {
  const forMatch = contentBrief.match(
    /(?:online casino review for|review for)\s+(.+?)(?:\.|\n)/i
  );
  if (forMatch?.[1]) {
    const name = cleanCasinoName(forMatch[1]);
    if (name && !/^site name$/i.test(name)) {
      return name;
    }
  }
  return cleanCasinoName(mainTopic) || mainTopic.trim();
}

export function registrableDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return host;
  } catch {
    return null;
  }
}

function isAffiliateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname;
    if (AFFILIATE_DOMAIN_PATTERNS.some((p) => p.test(host))) return true;
    if (AFFILIATE_PATH_PATTERNS.some((p) => p.test(path))) return true;
  } catch {
    return false;
  }
  return false;
}

export function rankSerpHitsForBonus(
  hits: SerpHit[],
  preferDomain?: string | null,
  options?: {
    penalizeAffiliates?: boolean;
    searchCountry?: string;
    searchLanguage?: string;
  }
): SerpHit[] {
  const preferred = preferDomain?.toLowerCase() ?? null;
  const penalizeAffiliates = options?.penalizeAffiliates ?? true;
  const { searchCountry, searchLanguage } = options ?? {};
  return [...hits].sort((a, b) => {
    const score = (hit: SerpHit) => {
      let s = 100 - hit.position;
      const domain = registrableDomain(hit.url);
      if (preferred && domain === preferred) s += 50;
      // Licence/operator facts are often best documented on review/affiliate
      // sites, so callers can opt out of the affiliate penalty.
      if (penalizeAffiliates && isAffiliateUrl(hit.url)) s -= 40;
      // Demote foreign-region pages (wrong currency/locale) and boost pages
      // that match the target search country/language.
      s += localeScore(hit.url, searchCountry, searchLanguage);
      return s;
    };
    return score(b) - score(a);
  });
}

function normalizeStatus(value: unknown): BonusResearchStatus {
  if (value === "verified" || value === "partial" || value === "insufficient") {
    return value;
  }
  return "insufficient";
}

function normalizeConfidence(value: unknown): BonusConfidence {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "low";
}

function normalizeSourceType(value: unknown): BonusSourceType {
  if (
    value === "official_bonus_page" ||
    value === "serp_fallback" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function normalizeBlockReason(value: unknown): BonusBlockReason | undefined {
  if (
    value === "blocked_page" ||
    value === "empty_content" ||
    value === "no_bonus_found" ||
    value === "low_confidence" ||
    value === "missing_credentials"
  ) {
    return value;
  }
  return undefined;
}

function normalizeFacts(raw: unknown): BonusFacts {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const pick = (key: keyof BonusFacts) =>
    typeof o[key] === "string" && o[key].trim() ? o[key].trim() : undefined;
  return {
    bonus_amount: pick("bonus_amount"),
    free_spins: pick("free_spins"),
    min_deposit: pick("min_deposit"),
    wagering_requirement: pick("wagering_requirement"),
    max_bet_during_playthrough: pick("max_bet_during_playthrough"),
    excluded_games: pick("excluded_games"),
    bonus_cap: pick("bonus_cap"),
    expiry: pick("expiry"),
    bonus_code: pick("bonus_code"),
  };
}

export function parseBonusResearch(raw: string): BonusResearchResult {
  try {
    const data = JSON.parse(
      raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "").trim()
    ) as Record<string, unknown>;
    return {
      status: normalizeStatus(data.status),
      confidence: normalizeConfidence(data.confidence),
      source_url:
        typeof data.source_url === "string" && data.source_url.trim()
          ? data.source_url.trim()
          : null,
      source_type: normalizeSourceType(data.source_type),
      block_reason: normalizeBlockReason(data.block_reason),
      facts: normalizeFacts(data.facts),
      raw_excerpt:
        typeof data.raw_excerpt === "string" ? data.raw_excerpt.trim() : undefined,
    };
  } catch {
    return {
      status: "insufficient",
      confidence: "low",
      source_url: null,
      source_type: "none",
      block_reason: "no_bonus_found",
      facts: {},
    };
  }
}

export function countPopulatedFacts(facts: BonusFacts): number {
  return Object.values(facts).filter(Boolean).length;
}

export function applyConfidenceGate(
  result: BonusResearchResult
): BonusResearchResult {
  if (result.status === "insufficient") {
    return result;
  }

  const factCount = countPopulatedFacts(result.facts);
  if (factCount === 0) {
    return {
      ...result,
      status: "insufficient",
      confidence: "low",
      block_reason: "no_bonus_found",
    };
  }

  if (
    result.status === "verified" &&
    (result.confidence === "high" || result.confidence === "medium")
  ) {
    return result;
  }

  if (result.status === "partial" || result.confidence === "low") {
    return {
      ...result,
      status: "partial",
      confidence: result.confidence === "high" ? "medium" : result.confidence,
      block_reason: result.block_reason ?? "low_confidence",
    };
  }

  return result;
}

/**
 * Facts pulled from SERP titles/snippets are real but truncated, so never let
 * them claim full "verified/high" status — cap at partial/medium.
 */
export function downgradeToSnippetConfidence(
  result: BonusResearchResult
): BonusResearchResult {
  if (result.status === "insufficient") return result;
  if (countPopulatedFacts(result.facts) === 0) {
    return insufficientResult("no_bonus_found");
  }
  return {
    ...result,
    status: "partial",
    confidence: result.confidence === "high" ? "medium" : result.confidence,
    source_type: "serp_fallback",
    block_reason: result.block_reason ?? "low_confidence",
  };
}

function factLines(facts: BonusFacts): string[] {
  const labels: [keyof BonusFacts, string][] = [
    ["bonus_amount", "Bonus amount"],
    ["free_spins", "Free spins"],
    ["min_deposit", "Minimum deposit"],
    ["wagering_requirement", "Wagering requirement"],
    ["max_bet_during_playthrough", "Max bet during playthrough"],
    ["excluded_games", "Excluded games"],
    ["bonus_cap", "Bonus withdrawal cap"],
    ["expiry", "Expiry"],
    ["bonus_code", "Bonus code"],
  ];
  return labels
    .filter(([key]) => facts[key])
    .map(([key, label]) => `${label}: ${facts[key]}`);
}

export function formatBonusResearchBriefBlock(
  result: BonusResearchResult
): string {
  if (result.status === "insufficient") {
    const reason =
      result.block_reason === "missing_credentials"
        ? "bonus research was skipped (API credentials missing)"
        : result.block_reason === "blocked_page"
          ? "the bonus page could not be accessed (blocked or error page)"
          : "no usable bonus content was found";
    return `

--- BONUS DATA UNAVAILABLE ---
Automated bonus research returned no specific terms (${reason}).
Do NOT invent bonus amounts, wagering multiples, or promo codes.
Write the bonus section at a general level (what kind of offer the casino runs, what to look
for) WITHOUT inventing figures. Do NOT write sentences stating that the bonus "could not be
confirmed", is "unavailable", or "unverified", and do NOT build a section around missing data —
keep the bonus mention brief and fold it into the verdict if there is little to say. Never imply
the casino is hiding or withholding its terms.
--- END BONUS DATA UNAVAILABLE ---
`;
  }

  if (result.status === "partial") {
    const lines = factLines(result.facts);
    return `

--- RESEARCHED BONUS DATA (partial — treat as unverified) ---
Source: ${result.source_url ?? "unknown"}
Confidence: ${result.confidence}. Use only the values below where present; mark anything uncertain as unconfirmed.
${lines.length ? lines.join("\n") : "No specific values could be extracted."}
${result.raw_excerpt ? `Excerpt: "${result.raw_excerpt}"` : ""}
Do NOT invent bonus figures beyond what is listed above.
--- END RESEARCHED BONUS DATA ---
`;
  }

  const lines = factLines(result.facts);
  return `

--- RESEARCHED BONUS DATA (from scraped source — use these values) ---
Source: ${result.source_url ?? "unknown"}
${lines.join("\n")}
${result.raw_excerpt ? `Excerpt: "${result.raw_excerpt}"` : ""}
--- END RESEARCHED BONUS DATA ---
`;
}

export function appendBonusResearchToBrief(
  contentBrief: string,
  result: BonusResearchResult
): string {
  const block = formatBonusResearchBriefBlock(result).trim();
  const trimmed = contentBrief.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

function insufficientResult(
  blockReason: BonusBlockReason
): BonusResearchResult {
  return {
    status: "insufficient",
    confidence: "low",
    source_url: null,
    source_type: "none",
    block_reason: blockReason,
    facts: {},
  };
}

/** Up to 5 ranked SERP hits are scraped (with early stop) before giving up. */
const MAX_SERP_RESULTS = 5;

function canResearchBonus(env: PipelineRuntimeEnv): boolean {
  return Boolean(env.SERPAPI_KEY) && hasScraper(env);
}

async function scrapeBonusPage(
  url: string,
  scrapeLocale: ScrapeLocaleHint,
  env: PipelineRuntimeEnv
): Promise<{ url: string; content: string } | null> {
  return scrapeSingleUrl(url, {
    scrapeEnv: env,
    scrapeLocale,
    kind: "bonus",
  });
}

async function extractFromMarkdown(
  llm: PipelineLlm,
  markdown: string,
  sourceUrl: string,
  casinoName: string,
  sourceType: "official_bonus_page" | "serp_fallback"
): Promise<BonusResearchResult> {
  const raw = await llm.extractBonusFacts(
    markdown,
    sourceUrl,
    casinoName,
    sourceType
  );
  return applyConfidenceGate(parseBonusResearch(raw));
}

export async function researchCasinoBonus(
  input: ArticleInput,
  env: PipelineRuntimeEnv,
  llm: PipelineLlm
): Promise<BonusResearchResult> {
  if (input.article_type !== "casino_review") {
    return insufficientResult("no_bonus_found");
  }

  const casinoName = parseCasinoName(input.content_brief, input.main_topic);
  const scrapeLocale: ScrapeLocaleHint = {
    country: input.search_country,
    language: input.search_language,
  };
  const preferDomain = input.casino_site_url
    ? registrableDomain(input.casino_site_url)
    : null;

  const pastedBonusText = input.casino_bonus_page_text?.trim();
  if (pastedBonusText) {
    pipelineDetail("Bonus research Path 0: pasted bonus page text", {
      chars: pastedBonusText.length,
      casinoName,
    });
    const result = await extractFromMarkdown(
      llm,
      pastedBonusText,
      "user-provided bonus page",
      casinoName,
      "official_bonus_page"
    );
    if (result.status !== "insufficient") {
      pipelineDetail("Bonus research succeeded (pasted text)", {
        status: result.status,
        confidence: result.confidence,
        factCount: countPopulatedFacts(result.facts),
      });
      return result;
    }
    pipelineDetail("Bonus research pasted text extraction insufficient", {
      blockReason: result.block_reason,
    });
  }

  if (!canResearchBonus(env)) {
    pipelineDetail("Bonus research SERP fallback skipped (missing credentials)", {
      hasSerpKey: Boolean(env.SERPAPI_KEY),
      hasScraper: hasScraper(env),
    });
    return insufficientResult(
      pastedBonusText ? "no_bonus_found" : "missing_credentials"
    );
  }

  pipelineDetail("Bonus research Path B: SerpAPI fallback", {
    query: `${casinoName} bonus`,
    preferDomain,
  });
  const serpHits = await searchGoogle([`${casinoName} bonus`], {
    country: input.search_country,
    language: input.search_language,
    apiKey: env.SERPAPI_KEY!,
    resultsPerKeyword: MAX_SERP_RESULTS,
  });
  const ranked = rankSerpHitsForBonus(serpHits, preferDomain, {
    searchCountry: input.search_country,
    searchLanguage: input.search_language,
  }).slice(0, MAX_SERP_RESULTS);

  pipelineDetail("SERP locale ranking", {
    searchCountry: input.search_country,
    searchLanguage: input.search_language,
    topUrl: ranked[0]?.url ?? null,
    demotedForeign: serpHits
      .filter(
        (h) => localeScore(h.url, input.search_country, input.search_language) < 0
      )
      .map((h) => h.url),
  });

  for (const hit of ranked) {
    const scraped = await scrapeBonusPage(hit.url, scrapeLocale, env);
    if (!scraped) continue;

    const result = await extractFromMarkdown(
      llm,
      scraped.content,
      scraped.url,
      casinoName,
      "serp_fallback"
    );
    if (result.status !== "insufficient") {
      pipelineDetail("Bonus research succeeded (SERP fallback)", {
        status: result.status,
        confidence: result.confidence,
        factCount: countPopulatedFacts(result.facts),
        source: result.source_url,
        serpQuery: hit.searchQuery,
      });
      return { ...result, scraped_markdown: scraped };
    }
  }

  // Last resort: every page was blocked. Google's own titles + snippets often
  // already contain the bonus headline (e.g. "50 free spins, 50x wagering"),
  // so extract from those rather than discarding real data.
  if (ranked.length) {
    const pseudoDoc = serpHitsToPseudoDoc(ranked);
    pipelineDetail("Bonus research Path C: SERP snippet fallback", {
      casinoName,
      hits: ranked.length,
      pseudoDocChars: pseudoDoc.length,
    });
    const snippetResult = await extractFromMarkdown(
      llm,
      pseudoDoc,
      ranked[0].url,
      casinoName,
      "serp_fallback"
    );
    const downgraded = downgradeToSnippetConfidence(snippetResult);
    if (downgraded.status !== "insufficient") {
      pipelineDetail("Bonus research succeeded (SERP snippet fallback)", {
        status: downgraded.status,
        confidence: downgraded.confidence,
        factCount: countPopulatedFacts(downgraded.facts),
      });
      return downgraded;
    }
  }

  pipelineDetail("Bonus research failed — no usable bonus data", {
    casinoName,
    attemptedSerpUrls: ranked.map((h) => h.url),
  });
  return insufficientResult("no_bonus_found");
}
