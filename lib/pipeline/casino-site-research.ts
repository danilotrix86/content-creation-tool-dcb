import type { SerpHit } from "./serp";
import { searchGoogle, serpHitsToPseudoDoc } from "./serp";
import { scrapeSingleUrl, hasScraper } from "./scrape";
import type { ScrapeLocaleHint } from "./cloudflare";
import type { PipelineLlm } from "./llm-types";
import type { PipelineRuntimeEnv } from "./pipeline-env";
import { pipelineDetail } from "./pipeline-log";
import {
  parseCasinoName,
  rankSerpHitsForBonus,
  registrableDomain,
} from "./bonus-research";
import type {
  ArticleInput,
  BonusBlockReason,
  BonusConfidence,
  BonusResearchStatus,
  BonusSourceType,
  CasinoFacts,
  CasinoSiteResearchResult,
} from "./types";

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

function normalizeFacts(raw: unknown): CasinoFacts {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const pick = (key: keyof CasinoFacts) =>
    typeof o[key] === "string" && o[key].trim() ? o[key].trim() : undefined;
  return {
    licence_number: pick("licence_number"),
    regulator: pick("regulator"),
    operator_company: pick("operator_company"),
    registered_address: pick("registered_address"),
    established_year: pick("established_year"),
    responsible_gambling_tools: pick("responsible_gambling_tools"),
  };
}

export function parseCasinoSiteResearch(raw: string): CasinoSiteResearchResult {
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

export function countPopulatedCasinoFacts(facts: CasinoFacts): number {
  return Object.values(facts).filter(Boolean).length;
}

/**
 * True when the extraction carries the core trust signal — a licence number or
 * a named regulator. Operator name or address alone (e.g. a Trustpilot "Poland"
 * contact line) is not enough to treat a result as a real licence source.
 */
export function hasLicenceCore(facts: CasinoFacts): boolean {
  return Boolean(facts.licence_number || facts.regulator);
}

/** Review aggregators whose pages rarely carry real licence/operator data. */
const LICENCE_SOURCE_BLOCKLIST = [/(?:^|\.)trustpilot\.[a-z.]+$/i];

function isLicenceBlocklistedUrl(url: string): boolean {
  try {
    return LICENCE_SOURCE_BLOCKLIST.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
}

/**
 * Order SERP hits for licence extraction: the domain that already yielded bonus
 * facts first, blocklisted review aggregators (Trustpilot) last.
 */
function rankSerpHitsForLicence(
  hits: SerpHit[],
  preferDomain: string | null,
  boostDomain: string | null,
  searchCountry?: string,
  searchLanguage?: string
): SerpHit[] {
  const base = rankSerpHitsForBonus(hits, preferDomain, {
    penalizeAffiliates: false,
    searchCountry,
    searchLanguage,
  });
  return [...base].sort((a, b) => {
    const score = (hit: SerpHit) => {
      let s = 0;
      if (boostDomain && registrableDomain(hit.url) === boostDomain) s += 100;
      if (isLicenceBlocklistedUrl(hit.url)) s -= 200;
      return s;
    };
    return score(b) - score(a);
  });
}

export function applyCasinoConfidenceGate(
  result: CasinoSiteResearchResult
): CasinoSiteResearchResult {
  if (result.status === "insufficient") {
    return result;
  }

  const factCount = countPopulatedCasinoFacts(result.facts);
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

  return {
    ...result,
    status: "partial",
    confidence: result.confidence === "high" ? "medium" : result.confidence,
    block_reason: result.block_reason ?? "low_confidence",
  };
}

function casinoFactLines(facts: CasinoFacts): string[] {
  const labels: [keyof CasinoFacts, string][] = [
    ["licence_number", "Licence number"],
    ["regulator", "Regulator / jurisdiction"],
    ["operator_company", "Operator company"],
    ["registered_address", "Registered address"],
    ["established_year", "Established"],
    ["responsible_gambling_tools", "Responsible gambling tools"],
  ];
  return labels
    .filter(([key]) => facts[key])
    .map(([key, label]) => `${label}: ${facts[key]}`);
}

export function formatCasinoResearchBriefBlock(
  result: CasinoSiteResearchResult
): string {
  if (result.status === "insufficient") {
    const reason =
      result.block_reason === "missing_credentials"
        ? "casino-site research was skipped (API credentials missing)"
        : result.block_reason === "blocked_page"
          ? "the casino site could not be accessed (blocked or error page)"
          : "no usable licensing/operator details were found";
    return `

--- CASINO DATA UNAVAILABLE ---
Automated casino-site research returned no licensing/operator details (${reason}).
Do NOT state that the licence number, regulator, operator, or address is missing, hidden, or
not displayed on the site — this tool may simply not have accessed the casino's own site.
OMIT these specifics entirely rather than writing about them: do not dedicate sentences,
bullets, or a section to what is unknown, and do not say details "could not be confirmed" or
were "not verified". If there is nothing concrete to assess on trust/licensing, fold a short,
neutral note into the final verdict instead of writing a standalone section. Never treat
missing data as a sign the casino is unreliable.
--- END CASINO DATA UNAVAILABLE ---
`;
  }

  const lines = casinoFactLines(result.facts);
  if (result.status === "partial") {
    return `

--- RESEARCHED CASINO DATA (partial) ---
Source: ${result.source_url ?? "unknown"}
Use the values below where present. OMIT any licensing/operator specific not listed here entirely
— do not write that it is missing, hidden, unconfirmed, or "could not be verified", and do not
dedicate sentences or a section to what is unknown.
${lines.length ? lines.join("\n") : "No specific values could be extracted."}
${result.raw_excerpt ? `Excerpt: "${result.raw_excerpt}"` : ""}
Do NOT invent licensing or operator details beyond what is listed above.
--- END RESEARCHED CASINO DATA ---
`;
  }

  return `

--- RESEARCHED CASINO DATA (from scraped source — use these values) ---
Source: ${result.source_url ?? "unknown"}
${lines.join("\n")}
${result.raw_excerpt ? `Excerpt: "${result.raw_excerpt}"` : ""}
--- END RESEARCHED CASINO DATA ---
`;
}

export function appendCasinoResearchToBrief(
  contentBrief: string,
  result: CasinoSiteResearchResult
): string {
  const block = formatCasinoResearchBriefBlock(result).trim();
  const trimmed = contentBrief.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

function insufficientResult(
  blockReason: BonusBlockReason
): CasinoSiteResearchResult {
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

/**
 * Cap SERP-snippet-derived facts at partial/medium — snippets are real but
 * truncated, so they must never present as fully verified.
 */
function downgradeToSnippetConfidence(
  result: CasinoSiteResearchResult
): CasinoSiteResearchResult {
  if (result.status === "insufficient") return result;
  if (countPopulatedCasinoFacts(result.facts) === 0) {
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

/** Homepage plus a terms page, where licence/operator details usually live. */
function candidateCasinoUrls(siteUrl: string): string[] {
  const base = siteUrl.replace(/\/+$/, "");
  try {
    const origin = new URL(siteUrl).origin;
    return Array.from(new Set([base, `${origin}/terms`]));
  } catch {
    return [base];
  }
}

async function scrapeCasinoPage(
  url: string,
  scrapeLocale: ScrapeLocaleHint,
  env: PipelineRuntimeEnv
): Promise<{ url: string; content: string } | null> {
  return scrapeSingleUrl(url, {
    scrapeEnv: env,
    scrapeLocale,
    kind: "licence",
  });
}

async function extractFromMarkdown(
  llm: PipelineLlm,
  markdown: string,
  sourceUrl: string,
  casinoName: string,
  sourceType: "official_bonus_page" | "serp_fallback"
): Promise<CasinoSiteResearchResult> {
  const raw = await llm.extractCasinoFacts(
    markdown,
    sourceUrl,
    casinoName,
    sourceType
  );
  return applyCasinoConfidenceGate(parseCasinoSiteResearch(raw));
}

export async function researchCasinoSite(
  input: ArticleInput,
  env: PipelineRuntimeEnv,
  llm: PipelineLlm,
  options?: { priorScrapes?: { url: string; content: string }[] }
): Promise<CasinoSiteResearchResult> {
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

  // Path A½: reuse pages already scraped during bonus research. Affiliate review
  // pages frequently include an operator/licence table (e.g. "#5536/JAZ,
  // Curaçao, Orange Entertainment B.V."), so extract from them before spending
  // more scrape credits — and only accept when a licence number or regulator is
  // actually present.
  for (const prior of options?.priorScrapes ?? []) {
    const result = await extractFromMarkdown(
      llm,
      prior.content,
      prior.url,
      casinoName,
      "serp_fallback"
    );
    if (result.status !== "insufficient" && hasLicenceCore(result.facts)) {
      pipelineDetail("Casino-site research succeeded (bonus scrape reuse)", {
        status: result.status,
        confidence: result.confidence,
        factCount: countPopulatedCasinoFacts(result.facts),
        source: result.source_url,
      });
      return result;
    }
  }

  if (!hasScraper(env)) {
    pipelineDetail("Casino-site research skipped (no scraper configured)");
    return insufficientResult("missing_credentials");
  }

  // Path A: scrape the provided casino site URL (homepage, then terms).
  if (input.casino_site_url) {
    for (const url of candidateCasinoUrls(input.casino_site_url)) {
      pipelineDetail("Casino-site research Path A: casino site URL", {
        url,
        casinoName,
      });
      const scraped = await scrapeCasinoPage(url, scrapeLocale, env);
      if (!scraped) continue;
      const result = await extractFromMarkdown(
        llm,
        scraped.content,
        scraped.url,
        casinoName,
        "official_bonus_page"
      );
      if (result.status !== "insufficient") {
        pipelineDetail("Casino-site research succeeded (site URL)", {
          status: result.status,
          confidence: result.confidence,
          factCount: countPopulatedCasinoFacts(result.facts),
          source: result.source_url,
        });
        return result;
      }
    }
  }

  // Path B: SerpAPI fallback for licensing info.
  if (!env.SERPAPI_KEY) {
    pipelineDetail("Casino-site research SERP fallback skipped (no SerpAPI key)");
    return insufficientResult("no_bonus_found");
  }

  const bonusSourceDomain = options?.priorScrapes?.[0]?.url
    ? registrableDomain(options.priorScrapes[0].url)
    : null;
  pipelineDetail("Casino-site research Path B: SerpAPI fallback", {
    query: `${casinoName} licence`,
    preferDomain,
    boostDomain: bonusSourceDomain,
  });
  const serpHits: SerpHit[] = await searchGoogle([`${casinoName} licence`], {
    country: input.search_country,
    language: input.search_language,
    apiKey: env.SERPAPI_KEY,
    resultsPerKeyword: MAX_SERP_RESULTS,
  });
  // Licence facts are often best documented on review/affiliate sites, so do
  // not penalise them — but demote review aggregators (Trustpilot) and boost the
  // domain that already produced bonus facts.
  const ranked = rankSerpHitsForLicence(
    serpHits,
    preferDomain,
    bonusSourceDomain,
    input.search_country,
    input.search_language
  ).slice(0, MAX_SERP_RESULTS);

  for (const hit of ranked) {
    const scraped = await scrapeCasinoPage(hit.url, scrapeLocale, env);
    if (!scraped) continue;
    const result = await extractFromMarkdown(
      llm,
      scraped.content,
      scraped.url,
      casinoName,
      "serp_fallback"
    );
    if (result.status !== "insufficient") {
      // A blocklisted aggregator only counts if it actually carries a licence
      // number or regulator — operator name/address alone (e.g. Trustpilot's
      // promo title + "Poland") is too weak to present as researched data.
      if (isLicenceBlocklistedUrl(scraped.url) && !hasLicenceCore(result.facts)) {
        pipelineDetail("Casino-site research ignoring low-value source", {
          source: scraped.url,
          reason: "no_licence_core",
        });
        continue;
      }
      pipelineDetail("Casino-site research succeeded (SERP fallback)", {
        status: result.status,
        confidence: result.confidence,
        factCount: countPopulatedCasinoFacts(result.facts),
        source: result.source_url,
      });
      return result;
    }
  }

  // Last resort: extract from SERP titles + snippets (e.g. "Licensed under
  // Curaçao 8048/JAZ") when every candidate page is blocked.
  if (ranked.length) {
    const pseudoDoc = serpHitsToPseudoDoc(ranked);
    pipelineDetail("Casino-site research Path C: SERP snippet fallback", {
      casinoName,
      hits: ranked.length,
      pseudoDocChars: pseudoDoc.length,
    });
    const snippetResult = downgradeToSnippetConfidence(
      await extractFromMarkdown(
        llm,
        pseudoDoc,
        ranked[0].url,
        casinoName,
        "serp_fallback"
      )
    );
    if (snippetResult.status !== "insufficient") {
      pipelineDetail("Casino-site research succeeded (SERP snippet fallback)", {
        status: snippetResult.status,
        confidence: snippetResult.confidence,
        factCount: countPopulatedCasinoFacts(snippetResult.facts),
      });
      return snippetResult;
    }
  }

  pipelineDetail("Casino-site research failed — no usable licensing data", {
    casinoName,
  });
  return insufficientResult("no_bonus_found");
}
