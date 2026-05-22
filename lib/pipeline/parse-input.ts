import type { ArticleInput } from "@/lib/pipeline/types";
import { normalizeArticleType } from "@/lib/pipeline/types";

export function parseArticleInput(body: Record<string, unknown>): ArticleInput {
  return {
    main_topic: String(body.main_topic ?? ""),
    keyword: String(body.keyword ?? ""),
    content_brief:
      typeof body.content_brief === "string" ? body.content_brief : "",
    article_type: normalizeArticleType(body.article_type),
    search_keywords: Array.isArray(body.search_keywords)
      ? body.search_keywords.map(String)
      : [],
    search_country: String(body.search_country ?? "us"),
    search_language: String(body.search_language ?? "en"),
    article_language: String(body.article_language ?? "en"),
    output_format: body.output_format === "html" ? "html" : "markdown",
    sitemap_url:
      typeof body.sitemap_url === "string" && body.sitemap_url
        ? body.sitemap_url
        : null,
  };
}
