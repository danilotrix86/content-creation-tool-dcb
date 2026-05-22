import type {
  ArticleInput,
  ArticleOutline,
  ArticleResult,
  ArticleStrategy,
  InternalLink,
  TopicInsights,
} from "./types";
import { formatTopicInsightsForPrompt } from "./article-strategy";
import {
  COMPETITOR_BUNDLE_LOG_MAX_CHARS,
  pipelineDetail,
  truncateForLog,
  pipelineDetailText,
} from "./pipeline-log";
import { countWords, calculateReadingTime } from "./utils";
import { searchGoogle } from "./serp";
import {
  scrapeArticles,
  formatScrapedForPrompt,
} from "./cloudflare";
import { fetchSitemapUrls, selectRelevantUrls } from "./sitemap";
import { createPipelineLlm, type PipelineLlmEnv } from "./llm-provider";
import type { PipelineLlm } from "./llm-types";
import { getAvailableLinks } from "./internal-links";
import { createOpenAIImageClient } from "./openai-images";
import MarkdownIt from "markdown-it";
import type { PipelineProgressEvent } from "./progress";

function injectInlineImage(
  content: string,
  sectionTitle: string,
  imageUrl: string,
  altText: string
): string {
  const imageMd = `\n\n![${altText}](${imageUrl})\n`;
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(## ${escaped}\\s*\\n(?:.*\\n)*?)\\n(\\n)`);
  const match = content.match(pattern);
  if (match) {
    const insertPos = (match.index ?? 0) + match[1].length;
    return content.slice(0, insertPos) + imageMd + content.slice(insertPos);
  }
  const headingPattern = new RegExp(`(## ${escaped}.*\\n)`);
  const m2 = content.match(headingPattern);
  if (m2 && m2.index !== undefined) {
    const insertPos = m2.index + m2[0].length;
    const nextPara = content.indexOf("\n\n", insertPos);
    const pos = nextPara !== -1 ? nextPara : insertPos;
    return content.slice(0, pos) + imageMd + content.slice(pos);
  }
  return content;
}

const SECTIONS_PER_BATCH = 3;
const PREVIOUS_CONTENT_MAX_CHARS = 5000;

async function generateAllSectionsMarkdown(
  llm: PipelineLlm,
  outline: ArticleOutline,
  mainTopic: string,
  keyword: string,
  articleLanguage: string,
  contentBrief: string,
  internalLinks: InternalLink[] | null,
  onProgress?: (event: PipelineProgressEvent) => void
): Promise<string> {
  const parts: string[] = [];
  let accumulated = "";
  const sections = outline.sections;
  const articleType = outline.article_type ?? "informational";
  const keywordIntent = outline.keyword_intent ?? "informational";
  const totalBatches = Math.ceil(sections.length / SECTIONS_PER_BATCH) || 1;

  for (let i = 0; i < sections.length; i += SECTIONS_PER_BATCH) {
    const batchIndex = Math.floor(i / SECTIONS_PER_BATCH) + 1;
    onProgress?.({
      type: "write_sections",
      batch: batchIndex,
      total: totalBatches,
    });

    const batch = sections.slice(i, i + SECTIONS_PER_BATCH);
    const remaining = sections.slice(i + SECTIONS_PER_BATCH);
    const available = internalLinks
      ? getAvailableLinks(accumulated, internalLinks)
      : null;
    const previous = accumulated
      ? accumulated.slice(-PREVIOUS_CONTENT_MAX_CHARS)
      : "";

    const md = await llm.generateSectionsMarkdown(
      batch,
      remaining,
      mainTopic,
      keyword,
      articleLanguage,
      contentBrief,
      available,
      outline.lsi_keywords,
      previous,
      articleType,
      keywordIntent
    );
    parts.push(md);
    accumulated = parts.join("\n\n");
  }
  return accumulated;
}

export async function runPipeline(
  input: ArticleInput,
  env: PipelineLlmEnv & {
    SERPAPI_KEY?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
  },
  onProgress?: (event: PipelineProgressEvent) => void
): Promise<ArticleResult> {
  onProgress?.({ type: "start" });
  pipelineDetail("Run started", {
    main_topic: input.main_topic,
    keyword: input.keyword,
    article_type: input.article_type,
    article_language: input.article_language,
    output_format: input.output_format,
    search_keywords: input.search_keywords,
    search_country: input.search_country,
    search_language: input.search_language,
    sitemap_url: input.sitemap_url,
    content_brief: truncateForLog(input.content_brief, 400),
    llm_provider: env.LLM_PROVIDER,
    openai_llm_model:
      env.LLM_PROVIDER === "openai" ? env.OPENAI_LLM_MODEL : undefined,
  });

  const llm = createPipelineLlm(env);
  const openai = createOpenAIImageClient(env.OPENAI_API_KEY);

  /** Category classification removed from pipeline (avoids extra Gemini round-trip). */
  const categoryName = "General";
  pipelineDetail("Category skipped (default)", { category_name: categoryName });

  let topicInsights: TopicInsights | null = null;
  const serpKeywords = [
    ...new Set(
      [input.keyword, ...input.search_keywords]
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ];
  if (
    serpKeywords.length &&
    env.SERPAPI_KEY &&
    env.CLOUDFLARE_API_TOKEN &&
    env.CLOUDFLARE_ACCOUNT_ID
  ) {
    onProgress?.({
      type: "search_google",
      keywords: serpKeywords,
    });
    pipelineDetail("Competitor research: querying SerpAPI", {
      keywords: serpKeywords,
      gl: input.search_country,
      hl: input.search_language,
      resultsPerKeyword: 3,
    });
    const serpHits = await searchGoogle(serpKeywords, {
      country: input.search_country,
      language: input.search_language,
      apiKey: env.SERPAPI_KEY,
    });
    const urls = serpHits.map((h) => h.url);
    onProgress?.({
      type: "read_competitor_pages",
      count: 0,
      attempted: urls.length,
    });
    const articles = await scrapeArticles(urls, {
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      scrapeLocale: {
        country: input.search_country,
        language: input.search_language,
      },
    });
    onProgress?.({
      type: "read_competitor_pages",
      count: articles.length,
      attempted: urls.length,
    });
    if (articles.length) {
      const scraped = formatScrapedForPrompt(articles);
      pipelineDetail("Topic insights prompt: scraped bundle sent to LLM", {
        articleCount: articles.length,
        promptBlockChars: scraped.length,
        charsPerArticleCap: 8000,
        sources: articles.map((a) => ({ url: a.url, rawChars: a.content.length })),
      });
      pipelineDetailText(
        "Competitor articles bundle (full scraped markdown → topic insights LLM)",
        scraped,
        { maxDisplayChars: COMPETITOR_BUNDLE_LOG_MAX_CHARS }
      );
      onProgress?.({ type: "analyze_competitors" });
      topicInsights = await llm.generateTopicInsights(
        scraped,
        input.main_topic,
        input.keyword,
        input.article_language
      );
      pipelineDetail("Topic insights extracted (LLM) — summary", {
        mustHaveCount: topicInsights.must_have_points.length,
        gapCount: topicInsights.content_gaps.length,
        competitorStructureCount: topicInsights.competitor_structures.length,
        serpFormat: topicInsights.serp_format_consensus,
        hasRawFallback: Boolean(topicInsights.raw_fallback),
      });
      pipelineDetailText(
        "Topic insights (full LLM competitor analysis → strategy/outline)",
        formatTopicInsightsForPrompt(topicInsights) ?? ""
      );
    } else {
      pipelineDetail("Topic insights skipped — no competitor pages scraped successfully", {
        attemptedUrls: urls,
      });
    }
  } else {
    pipelineDetail("Competitor research skipped", {
      reason: !serpKeywords.length
        ? "no keyword or search_keywords"
        : !env.SERPAPI_KEY
          ? "SERPAPI_KEY missing"
          : !env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID
            ? "Cloudflare credentials missing"
            : "unknown",
      hasSerpKey: Boolean(env.SERPAPI_KEY),
      hasCloudflare: Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID),
    });
  }

  onProgress?.({ type: "analyze_strategy" });
  const strategy: ArticleStrategy = await llm.deriveArticleStrategy(
    input.main_topic,
    input.keyword,
    input.search_keywords,
    input.article_type,
    topicInsights,
    input.content_brief
  );
  pipelineDetail("Article strategy derived", {
    article_type: input.article_type,
    keyword_intent: strategy.keyword_intent,
    intent_rationale: strategy.intent_rationale,
    recommended_sections: strategy.recommended_section_range,
    serp_format: strategy.serp_format_consensus,
    structure_notes: truncateForLog(strategy.structure_notes, 400),
  });

  onProgress?.({ type: "create_outline" });
  if (topicInsights) {
    pipelineDetail("Outline step: competitor analysis block included in prompt", {
      mustHaveCount: topicInsights.must_have_points.length,
    });
  } else {
    pipelineDetail("Outline step: no competitor analysis (topicInsights null/empty)");
  }
  const outline = await llm.generateOutline(
    input.main_topic,
    input.keyword,
    topicInsights,
    input.article_language,
    input.content_brief,
    input.article_type,
    strategy
  );
  pipelineDetail("Outline generated (LLM JSON)", {
    title: outline.title,
    slug: outline.slug,
    excerptPreview: truncateForLog(outline.excerpt, 280),
    sectionCount: outline.sections.length,
    sectionTarget: outline.section_target,
    article_type: outline.article_type,
    keyword_intent: outline.keyword_intent,
    sectionTitles: outline.sections.map((s) => s.title),
    lsi_keywords: outline.lsi_keywords,
    hadTopicInsights: Boolean(topicInsights),
  });

  let internalLinks: InternalLink[] = [];
  if (input.sitemap_url) {
    onProgress?.({ type: "internal_links" });
    const urls = await fetchSitemapUrls(input.sitemap_url);
    internalLinks = selectRelevantUrls(urls, input.main_topic, input.keyword);
    pipelineDetail("Internal links from sitemap", {
      sitemapUrl: input.sitemap_url,
      urlsInSitemap: urls.length,
      selectedForPrompt: internalLinks.length,
      links: internalLinks.map((l) => ({ anchor: l.anchor, url: l.url })),
    });
  } else {
    pipelineDetail("Internal links skipped (no sitemap_url)");
  }

  let contentMd = await generateAllSectionsMarkdown(
    llm,
    outline,
    input.main_topic,
    input.keyword,
    input.article_language,
    input.content_brief,
    internalLinks.length ? internalLinks : null,
    onProgress
  );
  pipelineDetail("Draft markdown complete (all sections from LLM)", {
    markdownChars: contentMd.length,
    previewStart: truncateForLog(contentMd, 400),
  });

  onProgress?.({ type: "featured_image" });
  const featuredImage = await openai.generateFeaturedImage(
    outline.slug,
    outline.title,
    input.main_topic
  );
  pipelineDetail("Featured image generated (OpenAI image)", {
    slug: outline.slug,
    title: outline.title,
    mainTopic: input.main_topic,
    dataUrlChars: featuredImage.length,
  });

  const featuredAlt = await llm.generateAltText(
    outline.title,
    input.keyword,
    outline.lsi_keywords,
    input.article_language
  );
  pipelineDetail("Featured image alt text (LLM)", { alt: featuredAlt });

  onProgress?.({ type: "inline_images" });
  const imageIndices = await llm.pickSectionsForImages(
    outline.sections,
    input.main_topic
  );
  pipelineDetail("Inline images: sections chosen", {
    indices: imageIndices,
    sections: imageIndices.map((i) => outline.sections[i]?.title ?? String(i)),
  });
  const inlineImages: { url: string; alt: string }[] = [];
  for (let i = 0; i < imageIndices.length; i++) {
    const sectionIdx = imageIndices[i];
    const section = outline.sections[sectionIdx];
    const inlineUrl = await openai.generateInlineImage(
      outline.slug,
      section.title,
      input.main_topic,
      i + 1
    );
    pipelineDetail("Inline image generated", {
      sectionIndex: sectionIdx,
      sectionTitle: section.title,
      imageIndex: i + 1,
      dataUrlChars: inlineUrl.length,
    });
    const alt = await llm.generateAltText(
      section.title,
      input.keyword,
      outline.lsi_keywords,
      input.article_language
    );
    pipelineDetail("Inline image alt text", { sectionTitle: section.title, alt });
    inlineImages.push({ url: inlineUrl, alt });
    contentMd = injectInlineImage(contentMd, section.title, inlineUrl, alt);
  }

  onProgress?.({ type: "meta_tags" });
  const meta = await llm.generateMeta(
    outline.title,
    outline.excerpt,
    input.keyword,
    input.article_language
  );
  pipelineDetail("SEO meta (LLM JSON)", {
    meta_title: meta.meta_title,
    meta_description: meta.meta_description,
  });

  const wordCount = countWords(contentMd);
  const readingTime = calculateReadingTime(wordCount);

  let content = contentMd;
  if (input.output_format === "html") {
    const md = new MarkdownIt({ html: true });
    content = md.render(contentMd);
    pipelineDetail("Rendered Markdown → HTML", {
      htmlChars: content.length,
    });
  }

  pipelineDetail("Run finished", {
    title: outline.title,
    slug: outline.slug,
    category_name: categoryName,
    word_count: wordCount,
    reading_time: readingTime,
    inline_image_count: inlineImages.length,
    output_format: input.output_format,
  });

  return {
    title: outline.title,
    slug: outline.slug,
    excerpt: outline.excerpt,
    content,
    content_markdown: input.output_format === "html" ? contentMd : undefined,
    meta_title: meta.meta_title,
    meta_description: meta.meta_description,
    featured_image: featuredImage,
    inline_images: inlineImages,
    word_count: wordCount,
    reading_time: readingTime,
    category_name: categoryName,
    article_type: input.article_type,
    keyword_intent: strategy.keyword_intent,
    article_strategy: strategy,
  };
}
