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

export interface ArticleInput {
  main_topic: string;
  keyword: string;
  /** Optional editorial direction (audience, angle, must-cover points) passed into generation. */
  content_brief: string;
  article_type: ArticleType;
  search_keywords: string[];
  search_country: string;
  search_language: string;
  article_language: string;
  output_format: "markdown" | "html";
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
