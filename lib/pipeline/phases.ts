import type { ArticleInput, ArticleResult } from "./types";
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
  scrapeSingleUrl,
  formatScrapedForPrompt,
} from "./cloudflare";
import { fetchSitemapUrls, selectRelevantUrls } from "./sitemap";
import { createPipelineLlm } from "./llm-provider";
import { getAvailableLinks } from "./internal-links";
import { createOpenAIImageClient } from "./openai-images";
import MarkdownIt from "markdown-it";
import type { PipelineProgressEvent } from "./progress";
import type { PipelineRuntimeEnv } from "./pipeline-env";
import type {
  JobPhase,
  PipelineJobState,
} from "./job-state";
import {
  PREVIOUS_CONTENT_MAX_CHARS,
  SECTIONS_PER_BATCH,
} from "./job-state";
import { saveGeneratedArticle } from "@/lib/supabase/save-article";

export function injectInlineImage(
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

function serpKeywords(input: ArticleInput): string[] {
  return [
    ...new Set(
      [input.keyword, ...input.search_keywords]
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ];
}

function canDoCompetitorResearch(
  input: ArticleInput,
  env: PipelineRuntimeEnv
): boolean {
  return (
    serpKeywords(input).length > 0 &&
    Boolean(env.SERPAPI_KEY) &&
    Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID)
  );
}

function totalWriteBatches(state: PipelineJobState): number {
  const sections = state.outline?.sections ?? [];
  return Math.ceil(sections.length / SECTIONS_PER_BATCH) || 1;
}

export interface StepResult {
  progress: PipelineProgressEvent[];
  nextPhase: JobPhase;
  state: PipelineJobState;
  done: boolean;
  result?: ArticleResult & { id: string };
}

export async function runJobStep(
  phase: JobPhase,
  input: ArticleInput,
  state: PipelineJobState,
  env: PipelineRuntimeEnv
): Promise<StepResult> {
  const llm = createPipelineLlm(env);
  const openai = createOpenAIImageClient(env.OPENAI_API_KEY);
  const progress: PipelineProgressEvent[] = [];
  const nextState: PipelineJobState = { ...state };

  switch (phase) {
    case "research_serp": {
      progress.push({ type: "start" });
      const enabled = canDoCompetitorResearch(input, env);
      nextState.competitorResearchEnabled = enabled;

      if (!enabled) {
        pipelineDetail("Competitor research skipped (phased)", {
          hasSerpKey: Boolean(env.SERPAPI_KEY),
          hasCloudflare: Boolean(
            env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID
          ),
        });
        return {
          progress,
          nextPhase: "plan_strategy",
          state: nextState,
          done: false,
        };
      }

      const keywords = serpKeywords(input);
      progress.push({ type: "search_google", keywords });
      pipelineDetail("Competitor research: querying SerpAPI (phased)", {
        keywords,
        gl: input.search_country,
        hl: input.search_language,
      });

      const serpHits = await searchGoogle(keywords, {
        country: input.search_country,
        language: input.search_language,
        apiKey: env.SERPAPI_KEY!,
      });
      const urls = serpHits.map((h) => h.url);
      nextState.serpUrls = urls;
      nextState.scrapeIndex = 0;
      nextState.scrapedArticles = [];

      if (urls.length === 0) {
        return {
          progress,
          nextPhase: "plan_strategy",
          state: nextState,
          done: false,
        };
      }

      progress.push({
        type: "read_competitor_pages",
        count: 0,
        attempted: urls.length,
      });

      return {
        progress,
        nextPhase: "research_scrape",
        state: nextState,
        done: false,
      };
    }

    case "research_scrape": {
      const urls = nextState.serpUrls ?? [];
      const index = nextState.scrapeIndex ?? 0;
      const scraped = [...(nextState.scrapedArticles ?? [])];

      if (index >= urls.length) {
        const next =
          scraped.length > 0 ? "research_insights" : "plan_strategy";
        progress.push({
          type: "read_competitor_pages",
          count: scraped.length,
          attempted: urls.length,
        });
        return { progress, nextPhase: next, state: nextState, done: false };
      }

      const url = urls[index];
      progress.push({
        type: "read_competitor_pages",
        count: scraped.length,
        attempted: urls.length,
      });

      const article = await scrapeSingleUrl(url, {
        apiToken: env.CLOUDFLARE_API_TOKEN!,
        accountId: env.CLOUDFLARE_ACCOUNT_ID!,
        scrapeLocale: {
          country: input.search_country,
          language: input.search_language,
        },
      });

      if (article) {
        scraped.push(article);
        nextState.scrapedArticles = scraped;
      }

      nextState.scrapeIndex = index + 1;

      if (index + 1 >= urls.length) {
        progress.push({
          type: "read_competitor_pages",
          count: scraped.length,
          attempted: urls.length,
        });
        const next =
          scraped.length > 0 ? "research_insights" : "plan_strategy";
        return { progress, nextPhase: next, state: nextState, done: false };
      }

      return {
        progress,
        nextPhase: "research_scrape",
        state: nextState,
        done: false,
      };
    }

    case "research_insights": {
      const articles = nextState.scrapedArticles ?? [];
      progress.push({ type: "analyze_competitors" });

      if (articles.length) {
        const scraped = formatScrapedForPrompt(articles);
        pipelineDetailText(
          "Competitor articles bundle (phased → topic insights LLM)",
          scraped,
          { maxDisplayChars: COMPETITOR_BUNDLE_LOG_MAX_CHARS }
        );
        nextState.topicInsights = await llm.generateTopicInsights(
          scraped,
          input.main_topic,
          input.keyword,
          input.article_language
        );
        pipelineDetail("Topic insights extracted (phased)", {
          mustHaveCount: nextState.topicInsights.must_have_points.length,
        });
      } else {
        nextState.topicInsights = null;
      }

      return {
        progress,
        nextPhase: "plan_strategy",
        state: nextState,
        done: false,
      };
    }

    case "plan_strategy": {
      progress.push({ type: "analyze_strategy" });
      nextState.strategy = await llm.deriveArticleStrategy(
        input.main_topic,
        input.keyword,
        input.search_keywords,
        input.article_type,
        nextState.topicInsights ?? null,
        input.content_brief
      );
      return {
        progress,
        nextPhase: "plan_outline",
        state: nextState,
        done: false,
      };
    }

    case "plan_outline": {
      progress.push({ type: "create_outline" });
      nextState.outline = await llm.generateOutline(
        input.main_topic,
        input.keyword,
        nextState.topicInsights ?? null,
        input.article_language,
        input.content_brief,
        input.article_type,
        nextState.strategy!
      );
      nextState.writeBatchIndex = 0;
      nextState.contentMd = "";
      return {
        progress,
        nextPhase: "plan_internal_links",
        state: nextState,
        done: false,
      };
    }

    case "plan_internal_links": {
      if (input.sitemap_url) {
        progress.push({ type: "internal_links" });
        const urls = await fetchSitemapUrls(input.sitemap_url);
        nextState.internalLinks = selectRelevantUrls(
          urls,
          input.main_topic,
          input.keyword
        );
      } else {
        nextState.internalLinks = [];
      }
      return {
        progress,
        nextPhase: "write_batch",
        state: nextState,
        done: false,
      };
    }

    case "write_batch": {
      const outline = nextState.outline!;
      const batchIndex = nextState.writeBatchIndex ?? 0;
      const totalBatches = totalWriteBatches(nextState);
      progress.push({
        type: "write_sections",
        batch: batchIndex + 1,
        total: totalBatches,
      });

      const sections = outline.sections;
      const start = batchIndex * SECTIONS_PER_BATCH;
      const batch = sections.slice(start, start + SECTIONS_PER_BATCH);
      const remaining = sections.slice(start + SECTIONS_PER_BATCH);
      const accumulated = nextState.contentMd ?? "";
      const internalLinks = nextState.internalLinks ?? [];
      const available = internalLinks.length
        ? getAvailableLinks(accumulated, internalLinks)
        : null;
      const previous = accumulated
        ? accumulated.slice(-PREVIOUS_CONTENT_MAX_CHARS)
        : "";

      const md = await llm.generateSectionsMarkdown(
        batch,
        remaining,
        input.main_topic,
        input.keyword,
        input.article_language,
        input.content_brief,
        available,
        outline.lsi_keywords,
        previous,
        outline.article_type ?? input.article_type,
        outline.keyword_intent ?? nextState.strategy!.keyword_intent
      );

      nextState.contentMd = accumulated
        ? `${accumulated}\n\n${md}`
        : md;
      nextState.writeBatchIndex = batchIndex + 1;

      if (batchIndex + 1 >= totalBatches) {
        return {
          progress,
          nextPhase: "image_featured",
          state: nextState,
          done: false,
        };
      }

      return {
        progress,
        nextPhase: "write_batch",
        state: nextState,
        done: false,
      };
    }

    case "image_featured": {
      progress.push({ type: "featured_image" });
      const outline = nextState.outline!;
      nextState.featuredImage = await openai.generateFeaturedImage(
        outline.slug,
        outline.title,
        input.main_topic
      );
      nextState.featuredAlt = await llm.generateAltText(
        outline.title,
        input.keyword,
        outline.lsi_keywords,
        input.article_language
      );
      return {
        progress,
        nextPhase: "image_pick_sections",
        state: nextState,
        done: false,
      };
    }

    case "image_pick_sections": {
      progress.push({ type: "inline_images" });
      const outline = nextState.outline!;
      nextState.imageSectionIndices = await llm.pickSectionsForImages(
        outline.sections,
        input.main_topic
      );
      nextState.inlineImages = [];
      nextState.inlineImageIndex = 0;

      if ((nextState.imageSectionIndices?.length ?? 0) === 0) {
        return {
          progress,
          nextPhase: "finalize",
          state: nextState,
          done: false,
        };
      }

      return {
        progress,
        nextPhase: "image_inline",
        state: nextState,
        done: false,
      };
    }

    case "image_inline": {
      progress.push({ type: "inline_images" });
      const outline = nextState.outline!;
      const indices = nextState.imageSectionIndices ?? [];
      const inlineIndex = nextState.inlineImageIndex ?? 0;
      const inlineImages = [...(nextState.inlineImages ?? [])];
      let contentMd = nextState.contentMd ?? "";

      if (inlineIndex >= indices.length) {
        return {
          progress,
          nextPhase: "finalize",
          state: nextState,
          done: false,
        };
      }

      const sectionIdx = indices[inlineIndex];
      const section = outline.sections[sectionIdx];
      const inlineUrl = await openai.generateInlineImage(
        outline.slug,
        section.title,
        input.main_topic,
        inlineIndex + 1
      );
      const alt = await llm.generateAltText(
        section.title,
        input.keyword,
        outline.lsi_keywords,
        input.article_language
      );
      inlineImages.push({
        url: inlineUrl,
        alt,
        sectionTitle: section.title,
      });
      contentMd = injectInlineImage(contentMd, section.title, inlineUrl, alt);

      nextState.inlineImages = inlineImages;
      nextState.contentMd = contentMd;
      nextState.inlineImageIndex = inlineIndex + 1;

      if (inlineIndex + 1 >= indices.length) {
        return {
          progress,
          nextPhase: "finalize",
          state: nextState,
          done: false,
        };
      }

      return {
        progress,
        nextPhase: "image_inline",
        state: nextState,
        done: false,
      };
    }

    case "finalize": {
      progress.push({ type: "meta_tags" });
      const outline = nextState.outline!;
      const strategy = nextState.strategy!;
      const contentMd = nextState.contentMd ?? "";
      const categoryName = nextState.categoryName ?? "General";

      nextState.meta = await llm.generateMeta(
        outline.title,
        outline.excerpt,
        input.keyword,
        input.article_language
      );

      const wordCount = countWords(contentMd);
      const readingTime = calculateReadingTime(wordCount);
      let content = contentMd;
      if (input.output_format === "html") {
        const md = new MarkdownIt({ html: true });
        content = md.render(contentMd);
      }

      const inlineForResult = (nextState.inlineImages ?? []).map((img) => ({
        url: img.url,
        alt: img.alt,
      }));

      const result: ArticleResult = {
        title: outline.title,
        slug: outline.slug,
        excerpt: outline.excerpt,
        content,
        content_markdown: input.output_format === "html" ? contentMd : undefined,
        meta_title: nextState.meta.meta_title,
        meta_description: nextState.meta.meta_description,
        featured_image: nextState.featuredImage!,
        inline_images: inlineForResult,
        word_count: wordCount,
        reading_time: readingTime,
        category_name: categoryName,
        article_type: input.article_type,
        keyword_intent: strategy.keyword_intent,
        article_strategy: strategy,
      };

      progress.push({ type: "save" });
      const id = await saveGeneratedArticle(input, result);

      return {
        progress,
        nextPhase: "done",
        state: nextState,
        done: true,
        result: { ...result, id },
      };
    }

    case "done":
      throw new Error("Job is already complete.");

    default:
      throw new Error(`Unknown pipeline phase: ${phase satisfies never}`);
  }
}
