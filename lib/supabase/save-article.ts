import type { ArticleInput, ArticleResult } from "@/lib/pipeline/types";
import { getSupabaseAdmin } from "./server";

export function isSupabaseConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}

export async function saveGeneratedArticle(
  input: ArticleInput,
  result: ArticleResult
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }

  const baseRow = {
    main_topic: input.main_topic,
    keyword: input.keyword,
    search_keywords: input.search_keywords,
    search_country: input.search_country,
    search_language: input.search_language,
    article_language: input.article_language,
    output_format: input.output_format,
    sitemap_url: input.sitemap_url ?? null,
    title: result.title,
    slug: result.slug,
    excerpt: result.excerpt,
    content: result.content,
    content_markdown:
      result.content_markdown ??
      (input.output_format === "markdown" ? result.content : null),
    meta_title: result.meta_title,
    meta_description: result.meta_description,
    featured_image: result.featured_image,
    inline_images: result.inline_images,
    word_count: result.word_count,
    reading_time: result.reading_time,
    category_name: result.category_name,
  };

  const rowWithStrategy = {
    ...baseRow,
    article_type: input.article_type,
    keyword_intent: result.keyword_intent ?? null,
    article_strategy: result.article_strategy ?? null,
  };

  let { data, error } = await supabase
    .from("generated_articles")
    .insert(rowWithStrategy)
    .select("id")
    .single();

  if (
    error?.code === "PGRST204" &&
    /article_type|keyword_intent|article_strategy/.test(error.message ?? "")
  ) {
    ({ data, error } = await supabase
      .from("generated_articles")
      .insert(baseRow)
      .select("id")
      .single());
  }

  if (error) {
    throw new Error(`Failed to save article to Supabase: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to save article to Supabase: no row returned.");
  }

  return data.id;
}
