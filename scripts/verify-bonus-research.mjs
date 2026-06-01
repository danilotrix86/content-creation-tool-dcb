/**
 * Static verification for casino bonus research pipeline.
 * Run: node scripts/verify-bonus-research.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const checks = [
  {
    name: "ArticleInput includes casino_bonus_page_text and casino_site_url",
    pass:
      read("lib/pipeline/types.ts").includes("casino_bonus_page_text") &&
      read("lib/pipeline/types.ts").includes("casino_site_url"),
  },
  {
    name: "parse-input maps casino_bonus_page_text and casino_site_url",
    pass:
      read("lib/pipeline/parse-input.ts").includes("casino_bonus_page_text") &&
      read("lib/pipeline/parse-input.ts").includes("casino_site_url"),
  },
  {
    name: "ArticleForm shows bonus paste + casino website fields",
    pass:
      read("components/ArticleForm.tsx").includes("casino_bonus_page_text") &&
      read("components/ArticleForm.tsx").includes("Bonus Page Text") &&
      read("components/ArticleForm.tsx").includes("casino_site_url"),
  },
  {
    name: "bonus-research module exists with waterfall",
    pass:
      read("lib/pipeline/bonus-research.ts").includes("researchCasinoBonus") &&
      read("lib/pipeline/bonus-research.ts").includes("appendBonusResearchToBrief"),
  },
  {
    name: "Pasted bonus text path skips scraping",
    pass:
      read("lib/pipeline/bonus-research.ts").includes("casino_bonus_page_text") &&
      read("lib/pipeline/bonus-research.ts").includes("Path 0: pasted bonus page text"),
  },
  {
    name: "bonusExtractionPrompt in prompts",
    pass: read("lib/pipeline/prompts.ts").includes("bonusExtractionPrompt"),
  },
  {
    name: "LLM extractBonusFacts wired",
    pass:
      read("lib/pipeline/llm-types.ts").includes("extractBonusFacts") &&
      read("lib/pipeline/openai-llm.ts").includes("extractBonusFacts") &&
      read("lib/pipeline/gemini.ts").includes("extractBonusFacts"),
  },
  {
    name: "Casino-site research module + extractCasinoFacts wired",
    pass:
      read("lib/pipeline/casino-site-research.ts").includes("researchCasinoSite") &&
      read("lib/pipeline/casino-site-research.ts").includes("appendCasinoResearchToBrief") &&
      read("lib/pipeline/prompts.ts").includes("casinoFactsExtractionPrompt") &&
      read("lib/pipeline/llm-types.ts").includes("extractCasinoFacts") &&
      read("lib/pipeline/openai-llm.ts").includes("extractCasinoFacts") &&
      read("lib/pipeline/gemini.ts").includes("extractCasinoFacts"),
  },
  {
    name: "research_bonus phase in job-state",
    pass:
      read("lib/pipeline/job-state.ts").includes('"research_bonus"') &&
      read("lib/pipeline/job-state.ts").includes("bonusResearch") &&
      read("lib/pipeline/job-state.ts").includes("casinoResearch"),
  },
  {
    name: "phases.ts handles research_bonus + site research",
    pass:
      read("lib/pipeline/phases.ts").includes('case "research_bonus"') &&
      read("lib/pipeline/phases.ts").includes("researchCasinoSite"),
  },
  {
    name: "run.ts runs bonus + site research for casino_review",
    pass:
      read("lib/pipeline/run.ts").includes("researchCasinoBonus") &&
      read("lib/pipeline/run.ts").includes("researchCasinoSite"),
  },
  {
    name: "Progress event for bonus research",
    pass: read("lib/pipeline/progress.ts").includes("research_bonus"),
  },
  {
    name: "Unavailable blocks prevent invented data + absence claims",
    pass:
      read("lib/pipeline/bonus-research.ts").includes("BONUS DATA UNAVAILABLE") &&
      read("lib/pipeline/casino-site-research.ts").includes("CASINO DATA UNAVAILABLE"),
  },
  {
    name: "Scrape.do provider with escalation profiles exists",
    pass:
      read("lib/pipeline/scrapedo.ts").includes("scrapeWithScrapeDo") &&
      read("lib/pipeline/scrapedo.ts").includes("super") &&
      read("lib/pipeline/scrapedo.ts").includes("geoCode") &&
      read("lib/pipeline/scrapedo.ts").includes("api.scrape.do") &&
      read("lib/pipeline/scrapedo.ts").includes('"http", "https"') &&
      read("lib/pipeline/scrapedo.ts").includes("render"),
  },
  {
    name: "Provider-agnostic scrape facade (Scrape.do primary, CF fallback)",
    pass:
      read("lib/pipeline/scrape.ts").includes("hasScraper") &&
      read("lib/pipeline/scrape.ts").includes("SCRAPEDO_TOKEN") &&
      read("lib/pipeline/scrape.ts").includes("falling back to Cloudflare"),
  },
  {
    name: "Research + pipeline use the scrape facade (not raw cloudflare)",
    pass:
      read("lib/pipeline/bonus-research.ts").includes('from "./scrape"') &&
      read("lib/pipeline/casino-site-research.ts").includes('from "./scrape"') &&
      read("lib/pipeline/run.ts").includes('from "./scrape"') &&
      read("lib/pipeline/phases.ts").includes('from "./scrape"'),
  },
  {
    name: "SCRAPEDO_TOKEN wired into runtime env",
    pass:
      read("lib/pipeline/pipeline-env.ts").includes("SCRAPEDO_TOKEN") &&
      read("lib/pipeline/scrapedo.ts").includes("mapSearchCountryToScrapeDoGeo") &&
      read("lib/pipeline/scrapedo.ts").includes('hu: "lt"') &&
      read(".env.example").includes("SCRAPEDO_TOKEN"),
  },
  {
    name: "Gates allow any configured scraper (hasScraper)",
    pass:
      read("lib/pipeline/bonus-research.ts").includes("hasScraper(env)") &&
      read("lib/pipeline/casino-site-research.ts").includes("hasScraper(env)"),
  },
  {
    name: "SERP research broadened with snippet pseudo-document fallback",
    pass:
      read("lib/pipeline/serp.ts").includes("resultsPerKeyword") &&
      read("lib/pipeline/serp.ts").includes("serpHitsToPseudoDoc") &&
      read("lib/pipeline/bonus-research.ts").includes("serpHitsToPseudoDoc") &&
      read("lib/pipeline/casino-site-research.ts").includes("serpHitsToPseudoDoc") &&
      read("lib/pipeline/casino-site-research.ts").includes("penalizeAffiliates"),
  },
  {
    name: "Writing rules omit missing data instead of disclaiming it",
    pass:
      read("lib/pipeline/prompts.ts").includes("OMIT it") &&
      read("lib/pipeline/casino-site-research.ts").includes("OMIT these specifics") &&
      read("lib/pipeline/bonus-research.ts").includes("fold it into the verdict"),
  },
  {
    name: "Final LLM prompts are logged (openai + gemini)",
    pass:
      read("lib/pipeline/pipeline-log.ts").includes("logLlmPrompt") &&
      read("lib/pipeline/openai-llm.ts").includes("logLlmPrompt") &&
      read("lib/pipeline/gemini.ts").includes("withPromptLog"),
  },
];

let failed = 0;
for (const check of checks) {
  if (check.pass) {
    console.log(`OK  ${check.name}`);
  } else {
    console.error(`FAIL ${check.name}`);
    failed++;
  }
}

if (failed > 0) process.exit(1);
console.log(`\nAll ${checks.length} checks passed.`);
