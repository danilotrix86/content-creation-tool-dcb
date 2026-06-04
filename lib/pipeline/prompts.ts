import type { ArticleStrategy, ArticleType, KeywordIntent } from "./types";
import { articleTypeLabel } from "./article-strategy";

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  it: "Write the entire piece in Italian. Use a professional tone suitable for an Italian audience.",
  en: "Write everything in English. Use a professional tone suitable for an English-speaking audience.",
  es: "Write the entire piece in Spanish. Use a professional tone suitable for a Spanish-speaking audience.",
  fr: "Write the entire piece in French. Use a professional tone suitable for a French-speaking audience.",
  de: "Write the entire piece in German. Use a professional tone suitable for a German-speaking audience.",
  hu: "Write the entire piece in Hungarian. Use a professional tone suitable for a Hungarian audience.",
  pl: "Write the entire piece in Polish. Use a professional tone suitable for a Polish audience.",
  pt: "Write the entire piece in Portuguese. Use a professional tone suitable for a Portuguese-speaking audience.",
  nl: "Write the entire piece in Dutch. Use a professional tone suitable for a Dutch-speaking audience.",
};

/**
 * Generic native-fluency clause appended to every language instruction so the
 * output reads as if written by a native speaker rather than translated.
 */
const NATIVE_FLUENCY = `
Write as a native speaker producing original copy for native readers — not a translation:
- Use idiomatic phrasing and natural word order for the target language; do NOT translate English sentence structures, idioms, or collocations literally (avoid calques and machine-translation patterns).
- Respect the language's grammar, agreement, inflection, capitalization, and punctuation conventions.
- Localize numbers, currency, dates, and units to the target language's conventions.
- Keep proper nouns, brand names, and bonus/promo codes in their original form; do not translate them. But still inflect the surrounding grammar around them as a native writer would — add the article, case ending, or particle the language normally requires when a brand name is the subject or object of a sentence (do NOT copy English's article-less "BrandName does X" pattern when the target language would use one).`;

/** Instruction block enforcing output language for any BCP-47-ish code. */
function lang(langCode: string): string {
  const code = langCode.trim();
  if (LANGUAGE_INSTRUCTIONS[code]) {
    return `${LANGUAGE_INSTRUCTIONS[code]}${NATIVE_FLUENCY}`;
  }
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    const primary = code.split("-")[0] ?? code;
    const label = dn.of(primary) ?? dn.of(code) ?? code;
    return `Write the entire piece in ${label} (locale: ${code}). Every heading, paragraph, list item, table cell, diagram label, and code comment must be in that language — do not use English unless the target language is English or you are quoting a proper noun/source. Use a professional tone suitable for native speakers of ${label}.${NATIVE_FLUENCY}`;
  } catch {
    return `Write the entire piece in the language identified by locale code "${code}". Every heading and paragraph must be in that language. Use a professional tone.${NATIVE_FLUENCY}`;
  }
}

function contentBriefBlock(contentBrief: string): string {
  const trimmed = contentBrief.trim();
  if (!trimmed) return "";
  return `

--- CONTENT BRIEF (editorial direction—follow closely) ---
${trimmed}
--- END CONTENT BRIEF ---
`;
}

/** Casino brand name (keyword/topic with a trailing "review" stripped). */
function casinoBrandName(keyword: string, mainTopic: string): string {
  const strip = (s: string) => s.replace(/\s+reviews?\s*$/i, "").trim();
  return strip(keyword) || strip(mainTopic) || keyword.trim();
}

const SEO_RULES = `
- Insert the main keyword in the first paragraph of every section
- Use semantic variants and synonyms of the keyword in the text (LSI keywords)
- Write H2 and H3 headings that answer real user questions (search intent)
- Every section must answer its question exhaustively: no generic or superficial content
- Use bullet lists and bold for readability and skimming
- Minimum length per section: 150-200 words
- Authoritative, professional tone
- If internal links are provided, insert them naturally using Markdown [anchor](url)
`;

const CASINO_REVIEW_SEO_RULES = `
- Per H2 section: ~200-280 words of prose, OR one compact table plus one short paragraph
- Total article length scales with the number of sections in the outline — write each section to
  its full budget; do NOT pad to hit a number, and do NOT compress sections to keep the piece short
- Split the section's word budget across 2-4 short paragraphs; keep each paragraph to ~3-4 sentences max — never deliver a section as one long wall-of-text paragraph
- Every heading must be followed by body prose, not another heading; do not place two headings consecutively
- FAQ section: maximum 4 Q&As; each answer must be 2 sentences or fewer
- Use the casino **brand name** (not the full article title and not the word "review") in body copy
- Cover semantic intent via LSI variants; the exact target keyword is optional and at most once per section — only if it reads naturally in running prose (never as a framing device)
- Never glue a keyword fragment onto a common noun as a modifier (e.g. "[brand] review", "[brand] payment", "[brand] withdrawal" used as a noun phrase). Use the natural, correctly inflected word in the target language instead (e.g. "the casino's payout", "its withdrawals") — keyword-stuffed noun stacks read as unnatural in every language
- Never start a paragraph with "[keyword] alapján", "In this review", "This article", or equivalent meta phrasing
- Use bullet lists and **bold** for skimming; keep lists short (3-5 items max)
- Be concise and specific — stop when the point is made; do not pad or recap
- Authoritative, professional tone
- If internal links are provided, insert them naturally using Markdown [anchor](url)
`;

const VISUAL_ENHANCEMENT_RULES = `
- Include Markdown tables where useful for comparing concepts, formulas or examples
- Use code blocks (triple backticks) for complex formulas or step-by-step procedures
- Add numbered lists for procedures or logical sequences
- Include bullet lists for features, properties, or benefits
- Use **bold** to highlight key formulas, important results, or critical concepts
- Do not force visual elements: include only tables and lists when they add real value
`;

export function topicInsightsPrompt(
  scrapedContent: string,
  mainTopic: string,
  keyword: string,
  articleLanguage: string
): string {
  const langInstr = lang(articleLanguage);
  return `
You are an expert SEO analyst. Analyze the following articles that rank in the top positions on Google for the keyword "${keyword}".

--- START COMPETITOR ARTICLES ---
${scrapedContent}
--- END COMPETITOR ARTICLES ---

Based on these articles, extract specific information about "${mainTopic}".

Respond EXCLUSIVELY with a valid JSON object (no extra text, no markdown fences):

{
  "must_have_points": ["Topic/concept every top article covers", "..."],
  "effective_angles": ["Approach or perspective competitors use well", "..."],
  "topic_specific_information": "Concrete data, formulas, methods, common errors, edge cases from competitors (paragraph)",
  "content_gaps": ["What competitors miss or treat superficially", "..."],
  "competitor_structures": [
    {
      "url": "source URL if identifiable",
      "approximate_h2_count": 12,
      "approximate_h3_count": 24,
      "section_types": ["FAQ", "comparison table", "step-by-step", "pros/cons"],
      "format_notes": "Brief note on layout and content format"
    }
  ],
  "serp_format_consensus": "Dominant SERP format (e.g. long-form guides, comparison posts, product landing pages, listicles)"
}

Requirements:
- Extract concrete, actionable TOPIC insights — not generic SEO advice
- For competitor_structures: estimate H2/H3 counts from headings in the scraped content
- Identify recurring section types across the SERP (FAQ, pricing, steps, alternatives, etc.)
- serp_format_consensus must describe what format dominates page-one results
- Language for all string values: follow the instruction below

${langInstr}
`;
}

function articleTypeOutlineRules(
  articleType: ArticleType,
  strategy: ArticleStrategy
): string {
  const { min, max } = strategy.recommended_section_range;
  const common = `
- Create between ${min} and ${max} H2 sections (inclusive) — this range is mandatory
- H2 titles must answer real user questions aligned with keyword intent: ${strategy.keyword_intent}
- Structure notes from strategy: ${strategy.structure_notes}
- SERP format consensus: ${strategy.serp_format_consensus}
- Competitor section range on SERP: ${strategy.competitor_section_range.min}-${strategy.competitor_section_range.max} H2s (avg ${strategy.competitor_section_range.avg})
`;

  const byType: Record<ArticleType, string> = {
    informational: `
Article type: Informational / pillar guide
- Prioritize topical authority: definitions, deep dives, context, edge cases, FAQ
- Include glossary-style or "what is" sections where useful
- Prefer the upper end of the section range when competitors publish long-form guides
- Cover must-have points from competitor analysis exhaustively
${common}`,
    how_to: `
Article type: How-to / tutorial
- Structure H2s as a logical procedure: prerequisites → core steps → advanced tips → troubleshooting
- Use action-oriented H2 titles ("How to...", "Step N: ...", "Common mistakes when...")
- Include prerequisites, tools/materials, and a troubleshooting or FAQ section
- Sequential flow matters more than breadth
${common}`,
    commercial: `
Article type: Commercial investigation
- Structure for evaluation: criteria, alternatives, pros/cons, "who it's for", buying signals
- Include comparison-oriented H2s and decision-framework sections
- Fewer but denser sections than a pillar guide — prioritize decision support
- Neutral evaluator tone in section titles (not salesy)
${common}`,
    transactional: `
Article type: Transactional / product
- Shorter funnel: problem → solution → benefits → features → proof → objections → CTA-oriented close
- H2s should support conversion (benefits, use cases, pricing/value signals, social proof angles)
- Keep section count toward the lower end of the range unless competitors are very long
${common}`,
    listicle: `
Article type: Listicle
- Use numbered H2 titles for each list item (e.g. "1. ...", "2. ...") or clear item labels
- Consistent template per item section; include intro framing and summary/wrap-up H2s
- Each item H2 should stand alone as a scannable unit
${common}`,
    casino_review: `
Article type: Casino review
- Produce a number of H2 sections within the mandatory range above; the total article length scales
  with the number of sections (≈250 words each), so use the range to control length
- ALWAYS include these core sections (translate titles to the target language), keeping this order:
  1. Quick verdict and ratings summary (always first)
  2. Welcome bonus and wagering
  3. Trust, licence and responsible gambling
  4. Pros, cons and final verdict (always last, except an optional FAQ after it)
- When the range allows MORE sections, expand coverage by adding or splitting topics such as:
  who this casino suits, registration & KYC, payment methods & withdrawals, deposit & withdrawal
  speed, games & providers, live casino, mobile experience, customer support, security & fairness,
  comparison vs competitors, and an FAQ (maximum 4 questions, only when 5+ sections are allowed)
- When the range allows FEWER sections, merge related topics INTO the core sections — never drop the
  bonus, licence/trust, or final verdict sections to stay short
- Every H2 must carry enough substance for its own body prose; only add an H3 when the H2 has enough
  content for an intro paragraph first — never plan an H2 whose body would be just another heading
- Neutral reviewer tone — informative, not hype; flag unclear bonus terms only when evidenced
- When comparing several casinos, use parallel section labels across brands
${common}`,
  };

  return byType[articleType];
}

export function articleStrategyPrompt(
  mainTopic: string,
  keyword: string,
  searchKeywords: string[],
  articleType: ArticleType,
  topicInsightsText: string | null,
  contentBrief: string
): string {
  const secondary =
    searchKeywords.length > 0
      ? searchKeywords.join(", ")
      : "(none — use main keyword only)";
  const insightsBlock = topicInsightsText
    ? `

--- COMPETITOR ANALYSIS ---
${topicInsightsText}
--- END COMPETITOR ANALYSIS ---
`
    : "\n(No competitor analysis available — infer intent from keywords only.)\n";

  return `
You are an expert SEO strategist. Derive keyword intent and recommend article structure before outline generation.

Main topic: ${mainTopic}
Main keyword: ${keyword}
Secondary / search keywords: ${secondary}
Selected article type: ${articleTypeLabel(articleType)}
${contentBriefBlock(contentBrief)}
${insightsBlock}

Infer keyword intent from:
- Main keyword phrasing ("what is", "how to" → informational; "best", "vs", "review" → commercial; "buy", "pricing", "discount" → transactional; brand/product name alone → navigational)
- For casino_review article type: expect commercial investigation intent (comparisons, "best casino", bonus/payout evaluation) unless keywords clearly indicate a single-brand navigational query
- Secondary keywords as additional intent signals
- Competitor SERP patterns when available

The user's article type controls SHAPE and section count; keyword intent controls TONE and section naming.

Respond EXCLUSIVELY with valid JSON:
{
  "keyword_intent": "informational" | "commercial" | "transactional" | "navigational",
  "intent_rationale": "1-2 sentences explaining intent from keywords and SERP",
  "competitor_section_range": { "min": 8, "max": 14, "avg": 11 },
  "serp_format_consensus": "e.g. long-form guides, comparison posts",
  "recommended_section_range": { "min": 10, "max": 14 },
  "structure_notes": "Concrete blueprint hints for the outline LLM (section types to include, flow, what to prioritize)"
}

Rules for recommended_section_range:
- informational: typically 14-18 H2s
- how_to: typically 8-12 H2s
- commercial: typically 8-12 H2s
- transactional: typically 6-10 H2s
- listicle: typically 10-15 H2s
- casino_review: section count is derived from the requested article length (≈250 words per section) and will be enforced downstream; recommend dense, decision-focused sections
- Adjust within these bands using competitor data when available; article type takes precedence over SERP length when they conflict
`;
}

export function outlinePrompt(
  mainTopic: string,
  keyword: string,
  topicInsights: string | null,
  articleLanguage: string,
  contentBrief: string,
  articleType: ArticleType,
  strategy: ArticleStrategy
): string {
  const langInstr = lang(articleLanguage);
  const briefBlock = contentBriefBlock(contentBrief);
  const insightsBlock = topicInsights
    ? `

--- COMPETITOR ANALYSIS ---
Below is an analysis of the best articles currently ranking on Google for this keyword.
Use this information to create an outline superior to competitors: cover all key points,
fill the identified gaps, and integrate the most effective angles.

${topicInsights}
--- END COMPETITOR ANALYSIS ---
`
    : "";

  const typeRules = articleTypeOutlineRules(articleType, strategy);
  const casinoReviewOutlineRules =
    articleType === "casino_review"
      ? `
Casino review outline rules:
- Use empty subsections: [] by default for every section
- At most 1 H3 per H2, and only when that H2 has enough content for an intro paragraph before the H3 — never stack two headings with no prose between them
- Total H3 count across the entire outline must not exceed 4
- The article title and every section title must read as a natural question or label in the target language. Use the casino brand name, but NEVER paste the raw keyword as a brand+common-noun phrase (e.g. "[brand] review", "[brand] payment", "[brand] opinion") and never include an untranslated English keyword fragment in a heading
- Never use "[keyword] alapján", "according to the review", "from the perspective of the review", or equivalent meta framing in any heading
- Keep brand names in their original form but inflect the surrounding words (article, case ending, particle) as a native writer of the target language would
`
      : "";

  return `
You are an expert SEO and content writer. Your goal is to create an outline optimized to rank on the first page of Google.

Main topic: ${mainTopic}
Target keyword: ${keyword}
Article type: ${articleTypeLabel(articleType)}
Keyword intent: ${strategy.keyword_intent} — ${strategy.intent_rationale}
${briefBlock}
${insightsBlock}

--- ARTICLE STRATEGY ---
${typeRules}
--- END ARTICLE STRATEGY ---
${casinoReviewOutlineRules}

Respond EXCLUSIVELY with a valid JSON object (no extra text, no markdown).
The structure must be:

{
  "title": "SEO-friendly title with keyword (max 60 chars)",
  "slug": "seo-friendly-slug-with-dashes-and-keyword",
  "excerpt": "2-3 sentence excerpt including the keyword and previewing the article value.",
  "lsi_keywords": ["synonym1", "semantic variant2", "related term3", "long-tail4", "linked concept5"],
  "sections": [
    {
      "title": "H2 title answering a real user question",
      "subsections": ["Specific H3 subsection", "Another specific H3"]
    }
  ]
}

Requirements for lsi_keywords:
- Generate 3-5 semantic variants (LSI keywords) of the main keyword
- Include synonyms, related terms and long-tail variants that users search on Google

SEO requirements for the outline:
- If a content brief is provided, align section titles and flow with that direction while keeping SEO best practices
- Follow the ARTICLE STRATEGY section above for section count, flow, and section types — do NOT default to a generic 12-15 section template
- Main keyword must appear in the article title
- Slug must contain the keyword, all lowercase, with dashes
- Excerpt must be engaging, include the keyword and encourage clicks
- Structure must cover all aspects of the topic (no content gaps) while matching the selected article type
- Language: ALL strings in the JSON (title, excerpt, every section title and subsection) must be written in the target language from the instruction below — not English unless the instruction specifies English.

${langInstr}
`;
}

function sectionsTypeWritingRules(
  articleType: ArticleType,
  keywordIntent: KeywordIntent,
  keyword: string,
  mainTopic: string
): string {
  const intentNote = `- Keyword intent is "${keywordIntent}" — align tone and depth with what searchers expect at this stage of the journey\n`;
  const brand = casinoBrandName(keyword, mainTopic);

  const byType: Record<ArticleType, string> = {
    informational: `
- Each ## section must have at least 3-4 rich, concrete, informative paragraphs
- Prioritize depth, definitions, examples, and authoritative explanations
- Educational tone; assume the reader wants to learn thoroughly`,
    how_to: `
- Use imperative voice and numbered steps within sections where appropriate
- Include "you will need" / prerequisites blocks when relevant
- Each ## section must have at least 2-4 paragraphs with clear actionable steps
- Practical, hands-on tone`,
    commercial: `
- Use comparison tables and decision frameworks where sections compare options
- Neutral evaluator tone — help the reader decide, not hard-sell
- Each ## section: 2-4 paragraphs; emphasize criteria, trade-offs, pros/cons
- Include bullet lists for quick comparison scanning`,
    transactional: `
- Shorter paragraphs (2-3 per section); benefit-led, persuasive copy
- Include explicit CTA language where the content brief allows (e.g. "Get started", "Try now")
- Focus on value, proof, and removing objections
- Each ## section: 2-3 concise paragraphs`,
    listicle: `
- Each ## section (list item) follows a consistent template: what it is → why it matters → practical tip or takeaway
- Scannable: lead with the key point, then 2-3 supporting paragraphs
- Numbered or clearly labeled items; uniform structure across items`,
    casino_review: `
You are writing a casino review for a real audience comparing licensed gambling options.

LENGTH BUDGET (mandatory)
- Each ## section: ~200-280 words OR one compact table + 1 short paragraph
- Write each section to its full budget; the article's total length is set by the number of
  sections, so do NOT shorten sections to keep the whole piece brief
- Stop when the point is made; do not pad, recap, or restate earlier sections

TONE
Write as a knowledgeable, impartial reviewer — not as a casino promoter and not as a 
compliance officer. Be direct and useful.

CRITICAL STYLING RULE (anti-meta loop)
- Write AS the reviewer speaking directly to the reader — not as someone summarizing a document
- Never mention "the review", "this article", "the text", "this guide", or the full target keyword phrase in body paragraphs
- Use the brand name "${brand}" when referring to the casino
- BAD: "Based on the ${keyword}, the casino offers a good welcome bonus..."
- GOOD: "${brand} offers a notably strong welcome bonus..."
- Do not open sentences with "[keyword] … from the perspective of / according to the review" framing — state the assessment directly
- Do NOT build noun phrases by attaching a topic word to the brand or keyword (e.g. "${brand} payment", "${brand} withdrawal", "${brand} review/opinion"). Refer to the topic with the natural, properly inflected word in the article's language (its payout, its withdrawals, the operator's payments) and let "${brand}" stand alone as a normal subject/object
- When "${brand}" is the subject or object of a sentence, give it the article, case ending, or particle the article's language normally requires — never copy English's article-less "${brand} does X" pattern
- Apply these patterns in the article's language (the examples above are illustrative only)

STRUCTURE RULES
- Follow the section order in the user prompt exactly
- Each section: 2-4 short paragraphs, or a table where specified; keep every paragraph to ~3-4 sentences and break up long blocks — never deliver a section as one wall-of-text paragraph
- Write at least one full intro paragraph directly under each ## heading before any ### subheading; every heading must be followed by substantive prose, never immediately by another heading
- Do not add preamble sections, transition summaries, or meta-commentary about the review itself
- Do not repeat warnings, caveats, or advice across multiple sections

CONTENT RULES
- Use only facts provided in the content brief or the researched data blocks
- ACCURACY (critical): never claim that a licence number, regulator, operator name, company, or
  address is "not shown", "not displayed", "hidden", "not visible on the site", or "missing".
  This tool may not have accessed the casino's own website, so a value being absent from the data
  you were given does NOT mean it is absent from the casino's site.
- Never use a missing, unconfirmed, or unavailable data point as evidence that the casino is
  unreliable, untrustworthy, unsafe, or a scam — absence of data is not a red flag
- If a specific value (bonus amount, RTP, licence number, withdrawal limit) is not in the brief or
  researched data, OMIT it — do not write that it is "unavailable", "unverified", or "could not be
  confirmed", do not speculate about why it is missing, and do not build a section, paragraph, or
  bullet around missing data (merge useful parts elsewhere or drop it; any brief, neutral note about
  limited public info belongs only in the final verdict)
- NO DEFENSIVE HEDGING: state injected data directly as objective fact — never prefix it with
  source-qualifying framing ("according to available data", "based on known terms", or any equivalent
  in the article's language).
  - BAD:  "According to available data, the minimum deposit is 2,000."
  - GOOD: "The minimum deposit is a low 2,000."
- Do not invent operator names, licence numbers, bonus figures, or payout speeds
- MULTI-DEPOSIT BONUSES: if the welcome offer spans more than one deposit (a tiered/package offer),
  describe it as a multi-deposit package and state each deposit tier separately (e.g. 1st deposit:
  X up to N; 2nd deposit: Y). Do NOT collapse a multi-deposit package into a single one-off bonus,
  and do not imply the full headline amount is available on the first deposit alone
- PROMO/BONUS CODES: state a code ONLY if it appears in the content brief or researched bonus data.
  Use it exactly as written there. Do not invent a code, do not reuse a code remembered from other
  sources, and if no code is provided, simply omit any mention of a code
- Wagering requirements must include a worked numerical example when mentioned
- Comparison tables must use realistic market benchmarks if competitor data is not provided
  (e.g. industry-typical wagering of 30–40x, withdrawal times of 0–3 days for e-wallets)

WHAT TO INCLUDE
- Concrete pros and cons that are specific to this casino, not generic casino advice
- At least one practical observation per major section (bonus terms visibility, cashier 
  transparency, KYC friction, mobile usability) — describe what was found, not what should exist
- In the licence/trust section, mention a red flag ONLY if it is actually evidenced in the brief or
  researched data; otherwise state plainly that nothing concerning was found in the available
  information. Do not manufacture a red flag to seem balanced
- A responsible gambling mention in the final verdict, not repeated throughout

WHAT TO AVOID
- "Check the terms before depositing" repeated in every section
- Generic descriptions of how a good casino should behave instead of evaluating this one
- Hype language: best casino, amazing offer, unbeatable bonus
- Implied guaranteed wins or financial motivation to gamble
- Padding sentences that explain why a topic matters rather than assessing it
- FAQ questions that duplicate information already in the body
- EXTERNAL REVIEW PLATFORMS: do not mention, cite, quote, link, or reference third-party review or
  aggregator sites (e.g. Trustpilot, AskGamblers, Casino Guru, Reddit) anywhere in the article,
  including scores like "rated 4.2 on Trustpilot". Base trust assessments only on licence/operator
  facts and first-hand observations from the provided data

CTA STANDARD
Use responsible CTAs only:
  Yes:  "Check current bonus terms before registering"
        "Verify availability in your country before depositing"
  No:   "Sign up now", "Claim your bonus today", "Don't miss this offer"

SPECIFIC FAILURE MODES TO AVOID:
- Do not reproduce CTA instructions verbatim from this prompt into the article
- Do not write sections about how to evaluate a casino feature when 
  you have no data about how this casino performs on that feature 
- Omit the section or merge it into the relevant pro/con instead
- The responsible CTA appears ONCE, in the final verdict only
- FAQ questions must be answerable specifically about this casino; 
  if a question applies to every casino, replace it
- Opening paragraphs with the article title, target keyword, or "based on this review" framing

  `,
  };

  return intentNote + byType[articleType];
}

export function sectionsPrompt(
  sectionsText: string,
  contextText: string,
  mainTopic: string,
  keyword: string,
  linksBlock: string,
  lsiKeywords: string[] | null,
  previousContent: string,
  articleLanguage: string,
  contentBrief: string,
  articleType: ArticleType,
  keywordIntent: KeywordIntent
): string {
  const langInstr = lang(articleLanguage);
  const briefBlock = contentBriefBlock(contentBrief);
  const briefBullet = contentBrief.trim()
    ? "- Honor the CONTENT BRIEF block above when deciding emphasis, examples, and what to prioritize in each paragraph\n"
    : "";
  const linksInstruction = linksBlock
    ? "\n- Insert the internal links provided in the 'Internal links' section where context allows naturally"
    : "";
  const lsiCasinoLine =
    articleType === "casino_review"
      ? "- Adapt and inflect each variant to fit the sentence grammar of the target language; NEVER paste a variant verbatim as a brand+noun phrase (e.g. \"[brand] review\", \"[brand] payment\"). If a variant only fits as an unnatural noun stack, use the natural inflected wording instead and skip the literal token\n"
      : "";
  const lsiBlock = lsiKeywords?.length
    ? `
LSI Keywords (semantic variants to use in text):
${lsiKeywords.join(", ")}
- Distribute these variants naturally in the text for semantic coverage
- Do not force them: use where context makes it fluent and natural
${lsiCasinoLine}`
    : "";
  const previousContentBlock = previousContent
    ? `

--- ALREADY WRITTEN CONTENT (for continuity, transitions and consistency) ---
${previousContent}
--- END PREVIOUS CONTENT ---

Use this context for: smooth transitions, avoid repetition, maintain terminological consistency.
Vary transition formulas: avoid repeating the same openings.
Do NOT rewrite this content; your sections must follow logically.
`
    : "";

  const seoRules =
    articleType === "casino_review" ? CASINO_REVIEW_SEO_RULES : SEO_RULES;
  const visualRules =
    articleType === "casino_review" ? "" : VISUAL_ENHANCEMENT_RULES;

  const openerLine =
    articleType === "casino_review"
      ? `You are writing a standalone casino review for readers evaluating "${casinoBrandName(
          keyword,
          mainTopic
        )}". The SEO target keyword is "${keyword}" — use it sparingly in natural prose; prioritize the brand name and LSI variants in body text.`
      : `You are an expert SEO content writer. You are writing an article optimized for Google to rank for the keyword "${keyword}".`;

  return `
${openerLine}

Topic: ${mainTopic}
Target keyword: ${keyword}
Article type: ${articleTypeLabel(articleType)}
${briefBlock}
${lsiBlock}
Sections to write NOW:
${sectionsText}

Upcoming sections (context only, do NOT write them):
${contextText}
${previousContentBlock}

Writing instructions:
${briefBullet}- Write ONLY the indicated sections, without general introduction or conclusion
- Do not repeat the main article title
- Use Markdown: ## for H2, ### for H3, paragraphs separated by blank line, **bold**, *italic*, lists with -
${sectionsTypeWritingRules(articleType, keywordIntent, keyword, mainTopic)}
- Professional natural tone${linksInstruction}

${seoRules}

${visualRules}

${linksBlock}
${langInstr}
`;
}

export function linksBlockPrompt(internalLinks: { url: string; anchor: string }[]): string {
  if (!internalLinks.length) return "";
  const linksList = internalLinks
    .map((lnk) => `- suggested anchor: "${lnk.anchor}" → url: ${lnk.url}`)
    .join("\n");
  return `
Internal links to insert in text:
${linksList}

Rules for internal links:
- PREFER QUALITY OVER QUANTITY: better 1-2 perfectly contextualized links than forcing all links
- Insert a link ONLY if there is a direct thematic connection
- Insert links using Markdown syntax: [anchor](url)
- Do NOT always use the suggested anchor text. Vary naturally
- If no link fits naturally in current sections, do NOT insert any
`;
}

export function metaPrompt(
  title: string,
  excerpt: string,
  keyword: string,
  articleLanguage: string
): string {
  const langInstr = lang(articleLanguage);
  return `
You are an expert SEO. Generate meta tags optimized for Google ranking.

Article title: ${title}
Excerpt: ${excerpt}
Target keyword: ${keyword}

SEO rules for meta tags:
- meta_title: must contain the keyword as close to the start as possible, max 60 chars
- meta_description: must include the keyword, be persuasive and encourage clicks, max 155 chars
- Both must feel natural, not spammy

Respond EXCLUSIVELY with valid JSON:
{"meta_title": "...", "meta_description": "..."}

${langInstr}
`;
}

export function imagePrompt(title: string, mainTopic: string): string {
  return `Create a professional featured image in educational infographic style.
Topic: "${mainTopic}".
The image must visually represent this specific concept with relevant diagrams,
graphs or illustrations that directly explain the topic.
Style: warm, welcoming educational illustration on grid or light chalkboard background.
Use distinct colors (green, teal, orange, red) to highlight key concepts.
Layout: horizontal (16:9), well organized with clear visual hierarchy.
The image should look like a curated educational poster that a reader would find immediately useful and visually appealing.`;
}

export function inlineImagePrompt(sectionTitle: string, mainTopic: string): string {
  return `Create a clear, professional educational illustration.
The image must illustrate the specific concept: "${sectionTitle}"
in the context of "${mainTopic}".
Style: clean diagram or educational infographic with light or grid background.
Use distinct colors (blue, green, orange) to highlight steps and key concepts.
Layout: horizontal (16:9), well organized, no decorative text.
The image should look like a professional didactic diagram useful for understanding the concept.`;
}

export function altTextPrompt(
  title: string,
  keyword: string,
  lsiKeywords: string[] | null,
  articleLanguage: string
): string {
  const lsiPart = lsiKeywords?.length
    ? `\nSemantic variants available: ${lsiKeywords.join(", ")}`
    : "";
  const langInstr = lang(articleLanguage);
  return `Generate SEO-optimized alt text for an article image.
Article title: "${title}"
Main keyword: "${keyword}"${lsiPart}

Rules:
- Maximum 125 characters
- Describe what the image shows in a specific, useful way
- Include the main keyword or a semantic variant naturally
- Do not start with "Image of" or "Photo of"

Respond EXCLUSIVELY with the alt text, no quotes or extra text.
${langInstr}`;
}

export function pickSectionsForImagesPrompt(
  sectionsTitles: string[],
  mainTopic: string,
  count: number
): string {
  const sectionsList = sectionsTitles
    .map((t, i) => `  ${i}. ${t}`)
    .join("\n");
  const countLabel = count === 1 ? "1 section" : `${count} sections`;
  return `
You are an expert in content strategy for educational blogs.

Article topic: ${mainTopic}

Article sections:
${sectionsList}

Select exactly ${countLabel} that would benefit most from an illustrative image
(diagram, graph, visual scheme).

Selection criteria:
- Prefer sections explaining visual concepts (graphs, geometry, diagrams)
- Prefer sections with formulas or procedures that can be illustrated
- Avoid purely introductory or concluding sections
- Avoid sections that are simple definition lists

Respond EXCLUSIVELY with valid JSON:
{"section_indices": [${Array.from({ length: count }, (_, i) => `index${i + 1}`).join(", ")}]}
`;
}

export function bonusExtractionPrompt(
  scrapedMarkdown: string,
  sourceUrl: string,
  casinoName: string,
  sourceType: "official_bonus_page" | "serp_fallback"
): string {
  const sourceNote =
    sourceType === "official_bonus_page"
      ? "The source is the casino's own bonus/promotions page."
      : "The source is a third-party page from Google search — only extract facts explicitly stated; lower confidence if terms are unclear.";

  return `
You are a precise data extractor for online casino welcome bonus terms.

Casino name: ${casinoName}
Source URL: ${sourceUrl}
Source type: ${sourceType}
${sourceNote}

--- SCRAPED PAGE CONTENT ---
${scrapedMarkdown.slice(0, 12000)}
--- END SCRAPED PAGE CONTENT ---

Extract welcome bonus facts ONLY if they are explicitly stated in the scraped content above.
Do NOT infer, estimate, or fill gaps with typical industry values.

Respond EXCLUSIVELY with valid JSON (no markdown fences):
{
  "status": "verified" | "partial" | "insufficient",
  "confidence": "high" | "medium" | "low",
  "source_url": "${sourceUrl}",
  "source_type": "${sourceType}",
  "block_reason": "blocked_page" | "empty_content" | "no_bonus_found" | "low_confidence" | null,
  "facts": {
    "bonus_amount": "string or omit — if the welcome offer covers multiple deposits, capture the FULL structure (e.g. '1st deposit: 100% up to X; 2nd deposit: 50% up to Y'), not just the headline figure",
    "free_spins": "string or omit",
    "min_deposit": "string or omit",
    "wagering_requirement": "string or omit",
    "max_bet_during_playthrough": "string or omit",
    "excluded_games": "string or omit",
    "bonus_cap": "string or omit",
    "expiry": "string or omit",
    "bonus_code": "string or omit — only the code explicitly tied to THIS welcome offer on this page"
  },
  "raw_excerpt": "One short verbatim quote (max 200 chars) supporting the main bonus figure, or omit"
}

Rules:
- status "verified" + confidence "high"/"medium": multiple clear facts with explicit numbers/terms
- status "partial" or confidence "low": some facts found but ambiguous or incomplete
- status "insufficient": page is blocked, unrelated, or contains no extractable bonus terms
- Omit any fact field not explicitly present — never guess
- MULTI-DEPOSIT: when the welcome bonus is a multi-deposit / tiered package, record every deposit tier inside "bonus_amount" so the structure is not lost; never reduce it to a single deposit
- BONUS CODE: extract a code only when it is explicitly attached to the current welcome offer on this page. If several different or clearly outdated/promotional codes appear, prefer the one on the official page and omit the code entirely when uncertain — never carry over a code you are unsure is current
- If the page looks like a Cloudflare block, 403, or login wall → status "insufficient", block_reason "blocked_page"
`;
}

export function casinoFactsExtractionPrompt(
  scrapedMarkdown: string,
  sourceUrl: string,
  casinoName: string,
  sourceType: "official_bonus_page" | "serp_fallback"
): string {
  const sourceNote =
    sourceType === "official_bonus_page"
      ? "The source is the casino's own website (home, about, terms, or footer)."
      : "The source is a third-party page from Google search — only extract facts explicitly stated; lower confidence if details are unclear.";

  return `
You are a precise data extractor for online casino licensing and operator information.

Casino name: ${casinoName}
Source URL: ${sourceUrl}
Source type: ${sourceType}
${sourceNote}

--- SCRAPED PAGE CONTENT ---
${scrapedMarkdown.slice(0, 12000)}
--- END SCRAPED PAGE CONTENT ---

Extract licensing and operator facts ONLY if they are explicitly stated in the scraped content above.
Do NOT infer, estimate, or fill gaps with typical industry values.

Respond EXCLUSIVELY with valid JSON (no markdown fences):
{
  "status": "verified" | "partial" | "insufficient",
  "confidence": "high" | "medium" | "low",
  "source_url": "${sourceUrl}",
  "source_type": "${sourceType}",
  "block_reason": "blocked_page" | "empty_content" | "no_bonus_found" | "low_confidence" | null,
  "facts": {
    "licence_number": "string or omit",
    "regulator": "licensing authority / jurisdiction, string or omit",
    "operator_company": "string or omit",
    "registered_address": "string or omit",
    "established_year": "string or omit",
    "responsible_gambling_tools": "string or omit"
  },
  "raw_excerpt": "One short verbatim quote (max 200 chars) supporting the licence/operator details, or omit"
}

Rules:
- status "verified" + confidence "high"/"medium": a licence number or regulator is explicitly stated
- status "partial" or confidence "low": some operator details found but licensing is ambiguous or incomplete
- status "insufficient": page is blocked, unrelated, or contains no extractable licensing/operator details
- Omit any fact field not explicitly present — never guess
- If the page looks like a Cloudflare block, 403, or login wall → status "insufficient", block_reason "blocked_page"
`;
}
