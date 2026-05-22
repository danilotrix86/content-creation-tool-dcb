import type {
  ArticleResult,
  ArticleStrategy,
  ArticleType,
  KeywordIntent,
} from "@/lib/pipeline/types";
import { getSupabaseAdmin } from "./server";

const SUPABASE_NOT_CONFIGURED =
  "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.";

/** Columns that exist on the base generated_articles schema */
const BASE_LIST_COLUMNS =
  "id, title, slug, excerpt, main_topic, keyword, word_count, reading_time, category_name, output_format, created_at";

const BASE_DETAIL_COLUMNS = `${BASE_LIST_COLUMNS}, content, content_markdown, meta_title, meta_description, featured_image, inline_images`;

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  main_topic: string;
  keyword: string;
  word_count: number;
  reading_time: number;
  category_name: string;
  output_format: string;
  created_at: string;
}

export interface ArticleDetail {
  result: ArticleResult;
  output_format: "markdown" | "html";
}

interface GeneratedArticleRow {
  id: string;
  created_at: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  content_markdown: string | null;
  meta_title: string;
  meta_description: string;
  featured_image: string | null;
  inline_images: unknown;
  word_count: number;
  reading_time: number;
  category_name: string;
  output_format: string;
  article_type?: string | null;
  keyword_intent?: string | null;
  article_strategy?: unknown;
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(SUPABASE_NOT_CONFIGURED);
  }
  return supabase;
}

function parseInlineImages(value: unknown): { url: string; alt: string }[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is { url: string; alt: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { url?: unknown }).url === "string"
    );
  }
  return [];
}

function parseArticleStrategy(value: unknown): ArticleStrategy | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as ArticleStrategy;
}

export function rowToArticleResult(row: GeneratedArticleRow): ArticleResult {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    content: row.content,
    content_markdown: row.content_markdown ?? undefined,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    featured_image: row.featured_image ?? "",
    inline_images: parseInlineImages(row.inline_images),
    word_count: row.word_count,
    reading_time: row.reading_time,
    category_name: row.category_name,
    article_type: (row.article_type as ArticleType | null) ?? undefined,
    keyword_intent: (row.keyword_intent as KeywordIntent | null) ?? undefined,
    article_strategy: parseArticleStrategy(row.article_strategy),
  };
}

function normalizeOutputFormat(
  value: string | null | undefined
): "markdown" | "html" {
  return value === "html" ? "html" : "markdown";
}

export async function listArticles(options?: {
  limit?: number;
  offset?: number;
}): Promise<ArticleListItem[]> {
  const supabase = requireSupabase();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from("generated_articles")
    .select(BASE_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list articles: ${error.message}`);
  }

  return (data ?? []) as ArticleListItem[];
}

export async function getArticleById(id: string): Promise<ArticleDetail | null> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("generated_articles")
    .select(BASE_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch article: ${error.message}`);
  }

  if (!data) return null;

  const row = data as GeneratedArticleRow;
  return {
    result: rowToArticleResult(row),
    output_format: normalizeOutputFormat(row.output_format),
  };
}

export { SUPABASE_NOT_CONFIGURED };
