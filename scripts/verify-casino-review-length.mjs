/**
 * Static verification for casino review length constraints.
 * Run: node scripts/verify-casino-review-length.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const prompts = read("lib/pipeline/prompts.ts");
const strategy = read("lib/pipeline/article-strategy.ts");
const brief = read("lib/content-brief-templates.ts");

const checks = [
  {
    name: "Section range derived from target word count",
    pass:
      strategy.includes("sectionRangeForTarget") &&
      strategy.includes("WORDS_PER_SECTION"),
  },
  {
    name: "Target length threaded through input + form",
    pass:
      read("lib/pipeline/types.ts").includes("target_word_count") &&
      read("lib/pipeline/parse-input.ts").includes("target_word_count") &&
      read("components/ArticleForm.tsx").includes("target_word_count"),
  },
  {
    name: "Section range override applied after strategy (run + phases)",
    pass:
      read("lib/pipeline/run.ts").includes("sectionRangeForTarget") &&
      read("lib/pipeline/phases.ts").includes("sectionRangeForTarget"),
  },
  {
    name: "Adaptive casino spine with mandatory core sections",
    pass:
      prompts.includes("Quick verdict and ratings summary") &&
      prompts.includes("ALWAYS include these core sections") &&
      prompts.includes("Welcome bonus and wagering"),
  },
  {
    name: "Casino-specific SEO rules use per-section budget (no fixed total)",
    pass:
      prompts.includes("CASINO_REVIEW_SEO_RULES") &&
      prompts.includes("~200-280 words") &&
      !prompts.includes("900-1100 words") &&
      prompts.includes('articleType === "casino_review" ? CASINO_REVIEW_SEO_RULES : SEO_RULES'),
  },
  {
    name: "Writing rules length budget scales with sections",
    pass:
      prompts.includes("LENGTH BUDGET (mandatory)") &&
      prompts.includes("total length is set by the number of") &&
      !prompts.includes("~1000 words total"),
  },
  {
    name: "Outline H3 limits for casino_review",
    pass:
      prompts.includes("Use empty subsections: [] by default") &&
      prompts.includes("Total H3 count across the entire outline must not exceed 4"),
  },
  {
    name: "Accuracy rules forbid 'not visible' / absence claims",
    pass:
      prompts.includes('not visible on the site') &&
      prompts.includes("absence of data is not a red flag"),
  },
  {
    name: "Polish brief no longer hardcodes ~1000 words / 8 sections",
    pass:
      !brief.includes("~1000 words") &&
      !brief.includes("8 sections, do not expand"),
  },
  {
    name: "Polish brief FAQ max 4",
    pass: brief.includes("Maximum 4 questions"),
  },
  {
    name: "Casino review skips generic visual enhancement rules",
    pass: prompts.includes('articleType === "casino_review" ? "" : VISUAL_ENHANCEMENT_RULES'),
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

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} checks passed.`);
