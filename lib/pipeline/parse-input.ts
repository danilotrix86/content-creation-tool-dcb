import type { ArticleInput } from "./types";
import { normalizeArticleType, resolveInlineImageCount } from "./types";

export function parseArticleInput(body: Record<string, unknown>): ArticleInput {
  const rawInlineCount =
    typeof body.inline_image_count === "number"
      ? body.inline_image_count
      : typeof body.inline_image_count === "string"
        ? Number(body.inline_image_count)
        : undefined;

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
    inline_image_count: resolveInlineImageCount(rawInlineCount),
    sitemap_url:
      typeof body.sitemap_url === "string" && body.sitemap_url
        ? body.sitemap_url
        : null,
  };
}
