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

/** Instruction block enforcing output language for any BCP-47-ish code. */
function lang(langCode: string): string {
  const code = langCode.trim();
  if (LANGUAGE_INSTRUCTIONS[code]) return LANGUAGE_INSTRUCTIONS[code];
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    const primary = code.split("-")[0] ?? code;
    const label = dn.of(primary) ?? dn.of(code) ?? code;
    return `Write the entire piece in ${label} (locale: ${code}). Every heading, paragraph, list item, table cell, diagram label, and code comment must be in that language — do not use English unless the target language is English or you are quoting a proper noun/source. Use a professional tone suitable for native speakers of ${label}.`;
  } catch {
    return `Write the entire piece in the language identified by locale code "${code}". Every heading and paragraph must be in that language. Use a professional tone.`;
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

const EXTERNAL_LINKS_RULES = `
- Insert 1-2 links to authoritative external sources for the entire block of sections
- Use only high-authority domains: Wikipedia, university sites (.edu), encyclopedias, institutional resources
- External links must support specific claims or important definitions
- Markdown syntax: [descriptive text](url)
- Do NOT link to competitor sites
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
  keywordIntent: KeywordIntent
): string {
  const intentNote = `- Keyword intent is "${keywordIntent}" — align tone and depth with what searchers expect at this stage of the journey\n`;

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
  const lsiBlock = lsiKeywords?.length
    ? `
LSI Keywords (semantic variants to use in text):
${lsiKeywords.join(", ")}
- Distribute these variants naturally in the text for semantic coverage
- Do not force them: use where context makes it fluent and natural
`
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

  return `
You are an expert SEO content writer. You are writing an article optimized for Google to rank for the keyword "${keyword}".

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
${sectionsTypeWritingRules(articleType, keywordIntent)}
- Professional natural tone${linksInstruction}

${SEO_RULES}

${VISUAL_ENHANCEMENT_RULES}

${EXTERNAL_LINKS_RULES}

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
  mainTopic: string
): string {
  const sectionsList = sectionsTitles
    .map((t, i) => `  ${i}. ${t}`)
    .join("\n");
  return `
You are an expert in content strategy for educational blogs.

Article topic: ${mainTopic}

Article sections:
${sectionsList}

Select exactly 2 sections that would benefit most from an illustrative image
(diagram, graph, visual scheme).

Selection criteria:
- Prefer sections explaining visual concepts (graphs, geometry, diagrams)
- Prefer sections with formulas or procedures that can be illustrated
- Avoid purely introductory or concluding sections
- Avoid sections that are simple definition lists

Respond EXCLUSIVELY with valid JSON:
{"section_indices": [index1, index2]}
`;
}
