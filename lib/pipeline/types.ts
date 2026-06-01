export interface Section {
  title: string;
  subsections: string[];
}

export type ArticleType =
  | "informational"
  | "how_to"
  | "commercial"
  | "transactional"
  | "listicle"
  | "casino_review";

export type KeywordIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";

export interface CompetitorStructure {
  url?: string;
  approximate_h2_count: number;
  approximate_h3_count: number;
  section_types: string[];
  format_notes: string;
}

export interface TopicInsights {
  must_have_points: string[];
  effective_angles: string[];
  topic_specific_information: string;
  content_gaps: string[];
  competitor_structures: CompetitorStructure[];
  serp_format_consensus: string;
  /** Set when JSON parsing failed; raw LLM text preserved for downstream prompts. */
  raw_fallback?: string;
}

export interface ArticleStrategy {
  keyword_intent: KeywordIntent;
  intent_rationale: string;
  competitor_section_range: { min: number; max: number; avg: number };
  serp_format_consensus: string;
  recommended_section_range: { min: number; max: number };
  structure_notes: string;
}

export interface ArticleOutline {
  title: string;
  slug: string;
  excerpt: string;
  sections: Section[];
  lsi_keywords: string[];
  article_type?: ArticleType;
  keyword_intent?: KeywordIntent;
  section_target?: { min: number; max: number };
}

export const DEFAULT_INLINE_IMAGE_COUNT = 2;
export const MAX_INLINE_IMAGE_COUNT = 3;

export function resolveInlineImageCount(count: number | undefined): number {
  if (count === undefined || count === null || Number.isNaN(count)) {
    return DEFAULT_INLINE_IMAGE_COUNT;
  }
  return Math.max(0, Math.min(MAX_INLINE_IMAGE_COUNT, Math.floor(count)));
}

export function effectiveInlineImageCount(input: {
  generate_images?: boolean;
  inline_image_count?: number;
}): number {
  if (input.generate_images === false) return 0;
  return resolveInlineImageCount(input.inline_image_count);
}

export type BonusResearchStatus = "verified" | "partial" | "insufficient";
export type BonusConfidence = "high" | "medium" | "low";
export type BonusSourceType = "official_bonus_page" | "serp_fallback" | "none";
export type BonusBlockReason =
  | "blocked_page"
  | "empty_content"
  | "no_bonus_found"
  | "low_confidence"
  | "missing_credentials";

export interface BonusFacts {
  bonus_amount?: string;
  free_spins?: string;
  min_deposit?: string;
  wagering_requirement?: string;
  max_bet_during_playthrough?: string;
  excluded_games?: string;
  bonus_cap?: string;
  expiry?: string;
  bonus_code?: string;
}

export interface BonusResearchResult {
  status: BonusResearchStatus;
  confidence: BonusConfidence;
  source_url: string | null;
  source_type: BonusSourceType;
  block_reason?: BonusBlockReason;
  facts: BonusFacts;
  raw_excerpt?: string;
  /**
   * The page markdown that produced this result (when scraped, not from pasted
   * text or SERP snippets). Casino-site research reuses it to extract
   * licence/operator facts without re-scraping.
   */
  scraped_markdown?: { url: string; content: string };
}

export interface CasinoFacts {
  licence_number?: string;
  regulator?: string;
  operator_company?: string;
  registered_address?: string;
  established_year?: string;
  responsible_gambling_tools?: string;
}

export interface CasinoSiteResearchResult {
  status: BonusResearchStatus;
  confidence: BonusConfidence;
  source_url: string | null;
  source_type: BonusSourceType;
  block_reason?: BonusBlockReason;
  facts: CasinoFacts;
  raw_excerpt?: string;
}

export interface ArticleInput {
  main_topic: string;
  keyword: string;
  /** Optional editorial direction (audience, angle, must-cover points) passed into generation. */
  content_brief: string;
  article_type: ArticleType;
  /** Full pasted bonus / promotions page text (casino_review only). Used instead of scraping. */
  casino_bonus_page_text?: string | null;
  /** Casino homepage URL (casino_review only). Scraped for licence / operator / trust facts. */
  casino_site_url?: string | null;
  /** Desired total article length in words; drives the number of sections. */
  target_word_count?: number;
  search_keywords: string[];
  search_country: string;
  search_language: string;
  article_language: string;
  output_format: "markdown" | "html";
  /** When false, no inline images are generated regardless of inline_image_count. */
  generate_images?: boolean;
  /** Illustrative images inserted into article sections (0–3). No featured/hero image. */
  inline_image_count?: number;
  sitemap_url?: string | null;
}

export interface ArticleResult {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_markdown?: string;
  meta_title: string;
  meta_description: string;
  featured_image: string;
  inline_images: { url: string; alt: string }[];
  word_count: number;
  reading_time: number;
  category_name: string;
  article_type?: ArticleType;
  keyword_intent?: KeywordIntent;
  article_strategy?: ArticleStrategy;
}

export interface InternalLink {
  url: string;
  anchor: string;
}

export const ARTICLE_TYPE_OPTIONS: {
  value: ArticleType;
  label: string;
  description: string;
}[] = [
  {
    value: "informational",
    label: "Informational / pillar guide",
    description: "Long-form authority content with deep coverage",
  },
  {
    value: "how_to",
    label: "How-to / tutorial",
    description: "Step-based procedural content",
  },
  {
    value: "commercial",
    label: "Commercial investigation",
    description: "Comparisons, criteria, and buying guidance",
  },
  {
    value: "transactional",
    label: "Transactional / product",
    description: "Conversion-focused with strong CTAs",
  },
  {
    value: "listicle",
    label: "Listicle",
    description: "Numbered tips, tools, or items",
  },
  {
    value: "casino_review",
    label: "Casino review",
    description: "Licensed casino evaluations with bonuses, games, payouts, and verdict",
  },
];

export function normalizeArticleType(value: unknown): ArticleType {
  const valid: ArticleType[] = [
    "informational",
    "how_to",
    "commercial",
    "transactional",
    "listicle",
    "casino_review",
  ];
  if (typeof value === "string" && valid.includes(value as ArticleType)) {
    return value as ArticleType;
  }
  return "informational";
}
