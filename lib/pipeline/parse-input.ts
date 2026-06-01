import type { ArticleInput } from "./types";
import {
  effectiveInlineImageCount,
  normalizeArticleType,
  resolveInlineImageCount,
} from "./types";

export function parseArticleInput(body: Record<string, unknown>): ArticleInput {
  const rawInlineCount =
    typeof body.inline_image_count === "number"
      ? body.inline_image_count
      : typeof body.inline_image_count === "string"
        ? Number(body.inline_image_count)
        : undefined;

  let generateImages: boolean;
  if (body.generate_images === true || body.generate_images === "true") {
    generateImages = true;
  } else if (body.generate_images === false || body.generate_images === "false") {
    generateImages = false;
  } else if (rawInlineCount !== undefined && !Number.isNaN(rawInlineCount)) {
    generateImages = resolveInlineImageCount(rawInlineCount) > 0;
  } else {
    generateImages = true;
  }

  const input: ArticleInput = {
    main_topic: String(body.main_topic ?? ""),
    keyword: String(body.keyword ?? ""),
    content_brief:
      typeof body.content_brief === "string" ? body.content_brief : "",
    article_type: normalizeArticleType(body.article_type),
    casino_bonus_page_text:
      typeof body.casino_bonus_page_text === "string" &&
      body.casino_bonus_page_text.trim()
        ? body.casino_bonus_page_text.trim()
        : null,
    casino_site_url:
      typeof body.casino_site_url === "string" && body.casino_site_url.trim()
        ? body.casino_site_url.trim()
        : null,
    target_word_count:
      typeof body.target_word_count === "number" &&
      Number.isFinite(body.target_word_count) &&
      body.target_word_count > 0
        ? Math.round(body.target_word_count)
        : typeof body.target_word_count === "string" &&
            body.target_word_count.trim() &&
            Number.isFinite(Number(body.target_word_count))
          ? Math.round(Number(body.target_word_count))
          : undefined,
    search_keywords: Array.isArray(body.search_keywords)
      ? body.search_keywords.map(String)
      : [],
    search_country: String(body.search_country ?? "us"),
    search_language: String(body.search_language ?? "en"),
    article_language: String(body.article_language ?? "en"),
    output_format: body.output_format === "html" ? "html" : "markdown",
    generate_images: generateImages,
    inline_image_count: resolveInlineImageCount(rawInlineCount),
    sitemap_url:
      typeof body.sitemap_url === "string" && body.sitemap_url
        ? body.sitemap_url
        : null,
  };

  input.inline_image_count = effectiveInlineImageCount(input);
  return input;
}
