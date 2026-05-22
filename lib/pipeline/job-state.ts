import type {
  ArticleInput,
  ArticleOutline,
  ArticleStrategy,
  InternalLink,
  TopicInsights,
} from "./types";

export type JobPhase =
  | "research_serp"
  | "research_scrape"
  | "research_insights"
  | "plan_strategy"
  | "plan_outline"
  | "plan_internal_links"
  | "write_batch"
  | "image_featured"
  | "image_pick_sections"
  | "image_inline"
  | "finalize"
  | "done";

export type JobStatus = "running" | "completed" | "failed";

export interface PipelineJobState {
  categoryName?: string;
  competitorResearchEnabled?: boolean;
  serpUrls?: string[];
  scrapeIndex?: number;
  scrapedArticles?: { url: string; content: string }[];
  topicInsights?: TopicInsights | null;
  strategy?: ArticleStrategy;
  outline?: ArticleOutline;
  internalLinks?: InternalLink[];
  contentMd?: string;
  writeBatchIndex?: number;
  featuredImage?: string;
  featuredAlt?: string;
  imageSectionIndices?: number[];
  inlineImages?: { url: string; alt: string; sectionTitle: string }[];
  inlineImageIndex?: number;
  meta?: { meta_title: string; meta_description: string };
}

export interface GenerationJobRow {
  id: string;
  status: JobStatus;
  phase: JobPhase;
  input: ArticleInput;
  state: PipelineJobState;
  error: string | null;
  result_id: string | null;
  created_at: string;
  updated_at: string;
}

export const SECTIONS_PER_BATCH = 3;
export const PREVIOUS_CONTENT_MAX_CHARS = 5000;
