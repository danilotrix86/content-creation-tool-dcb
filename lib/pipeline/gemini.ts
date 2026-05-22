import "./tls-preload";
import { GoogleGenAI, ApiError } from "@google/genai";
import type {
  ArticleOutline,
  ArticleStrategy,
  ArticleType,
  InternalLink,
  Section,
  TopicInsights,
} from "./types";
import type { PipelineLlm } from "./llm-types";
import {
  topicInsightsPrompt,
  outlinePrompt,
  articleStrategyPrompt,
  sectionsPrompt,
  linksBlockPrompt,
  metaPrompt,
  altTextPrompt,
  pickSectionsForImagesPrompt,
} from "./prompts";
import {
  cleanJson,
  defaultArticleStrategy,
  formatTopicInsightsForPrompt,
  parseArticleStrategy,
  parseTopicInsights,
} from "./article-strategy";

/** @see https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview */
const GEMINI_MODEL = "gemini-3.1-pro-preview";
const SECTIONS_PER_BATCH = 3;
const PREVIOUS_CONTENT_MAX_CHARS = 5000;
const MAX_GEMINI_ATTEMPTS = 5;
const GEMINI_RETRY_BASE_MS = 5000;

function errnoHints(e: unknown): string[] {
  if (typeof e !== "object" || e === null) return [];
  const o = e as NodeJS.ErrnoException & {
    address?: string;
    port?: number;
  };
  const out: string[] = [];
  if (typeof o.code === "string") out.push(`code=${o.code}`);
  if (o.errno !== undefined) out.push(`errno=${String(o.errno)}`);
  if (typeof o.syscall === "string") out.push(`syscall=${o.syscall}`);
  if (typeof o.address === "string") out.push(`address=${o.address}`);
  if (typeof o.port === "number") out.push(`port=${o.port}`);
  return out;
}

/**
 * Node/undici often throw `TypeError: fetch failed` while the real reason
 * (TLS, DNS, reset, timeout) lives on `error.cause`.
 */
function formatGeminiErrorForLog(err: unknown): string {
  if (err instanceof ApiError) {
    const hints = errnoHints(err);
    return hints.length
      ? `ApiError HTTP ${err.status}: ${err.message} (${hints.join(", ")})`
      : `ApiError HTTP ${err.status}: ${err.message}`;
  }
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth < 8) {
    if (cur instanceof AggregateError) {
      const nested = cur.errors.map((x) => formatGeminiErrorForLog(x)).join("; ");
      parts.push(
        depth === 0
          ? `AggregateError: ${nested}`
          : `caused by AggregateError: ${nested}`
      );
      break;
    }
    if (cur instanceof Error) {
      const hints = errnoHints(cur);
      const msg =
        hints.length > 0 ? `${cur.message} (${hints.join(", ")})` : cur.message;
      parts.push(depth === 0 ? msg : `caused by: ${msg}`);
      cur = cur.cause;
    } else {
      parts.push(depth === 0 ? String(cur) : `caused by: ${String(cur)}`);
      break;
    }
    depth++;
  }
  return parts.join(" → ");
}

function isTransientGeminiError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if ([408, 429, 500, 502, 503, 504].includes(err.status)) return true;
    const msg = err.message.toLowerCase();
    if (
      msg.includes("unavailable") ||
      msg.includes("overloaded") ||
      msg.includes("try again") ||
      msg.includes("high demand") ||
      msg.includes("deadline") ||
      msg.includes("timeout")
    ) {
      return true;
    }
  }
  if (err instanceof TypeError && err.message === "fetch failed") return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGeminiRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { onGiveUp?: () => T }
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const transient = isTransientGeminiError(e);
      const willRetry = transient && attempt < MAX_GEMINI_ATTEMPTS;
      if (willRetry) {
        const wait = GEMINI_RETRY_BASE_MS * 2 ** (attempt - 1);
        console.warn(
          `[Gemini] ${label}: attempt ${attempt}/${MAX_GEMINI_ATTEMPTS} failed (${formatGeminiErrorForLog(e)}); retry in ${wait}ms`
        );
        await sleep(wait);
        continue;
      }
      if (options?.onGiveUp) {
        console.warn(
          `[Gemini] ${label}: giving up after ${attempt} attempt(s) (${formatGeminiErrorForLog(e)}); using fallback`
        );
        return options.onGiveUp();
      }
      console.warn(
        `[Gemini] ${label}: failed after ${attempt} attempt(s): ${formatGeminiErrorForLog(e)}`
      );
      throw e;
    }
  }
  throw new Error(
    `[Gemini] ${label}: retry loop exhausted without resolving (MAX_GEMINI_ATTEMPTS=${MAX_GEMINI_ATTEMPTS})`
  );
}

function skippedSectionsPlaceholder(batch: Section[]): string {
  return batch
    .map(
      (s) =>
        `## ${s.title}\n\n*[This section could not be generated (API error after ${MAX_GEMINI_ATTEMPTS} attempts). Fill in manually or re-run the pipeline.]*\n`
    )
    .join("\n\n");
}

export function createGeminiClient(apiKey: string): PipelineLlm {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateTopicInsights(
      scrapedContent: string,
      mainTopic: string,
      keyword: string,
      articleLanguage: string
    ) {
      const response = await withGeminiRetry("generateTopicInsights", () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: topicInsightsPrompt(
            scrapedContent,
            mainTopic,
            keyword,
            articleLanguage
          ),
          config: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        })
      );
      return parseTopicInsights(response.text?.trim() ?? "{}");
    },

    async deriveArticleStrategy(
      mainTopic: string,
      keyword: string,
      searchKeywords: string[],
      articleType: ArticleType,
      topicInsights,
      contentBrief: string
    ): Promise<ArticleStrategy> {
      const insightsText = formatTopicInsightsForPrompt(topicInsights);
      try {
        const response = await withGeminiRetry("deriveArticleStrategy", () =>
          ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: articleStrategyPrompt(
              mainTopic,
              keyword,
              searchKeywords,
              articleType,
              insightsText,
              contentBrief
            ),
            config: {
              temperature: 0.5,
              responseMimeType: "application/json",
            },
          })
        );
        return parseArticleStrategy(response.text?.trim() ?? "{}", articleType);
      } catch {
        return defaultArticleStrategy(articleType);
      }
    },

    async generateOutline(
      mainTopic: string,
      keyword: string,
      topicInsights,
      articleLanguage: string,
      contentBrief: string,
      articleType: ArticleType,
      strategy: ArticleStrategy
    ): Promise<ArticleOutline> {
      const insightsText = formatTopicInsightsForPrompt(topicInsights);
      const response = await withGeminiRetry("generateOutline", () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: outlinePrompt(
            mainTopic,
            keyword,
            insightsText,
            articleLanguage,
            contentBrief,
            articleType,
            strategy
          ),
          config: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        })
      );
      const raw = cleanJson(response.text ?? "{}");
      const data = JSON.parse(raw);
      const sections: Section[] = (data.sections ?? []).map((s: { title: string; subsections?: string[] }) => ({
        title: s.title,
        subsections: s.subsections ?? [],
      }));
      return {
        title: data.title ?? "",
        slug: data.slug ?? "",
        excerpt: data.excerpt ?? "",
        sections,
        lsi_keywords: data.lsi_keywords ?? [],
        article_type: articleType,
        keyword_intent: strategy.keyword_intent,
        section_target: strategy.recommended_section_range,
      };
    },

    async generateSectionsMarkdown(
      batch: Section[],
      remaining: Section[],
      mainTopic: string,
      keyword: string,
      articleLanguage: string,
      contentBrief: string,
      availableLinks: InternalLink[] | null,
      lsiKeywords: string[] | null,
      previousContent: string,
      articleType: ArticleType,
      keywordIntent
    ): Promise<string> {
      const sectionsText = batch
        .map(
          (s) =>
            `- ${s.title}` +
            (s.subsections.length
              ? "\n" + s.subsections.map((sub) => `  - ${sub}`).join("\n")
              : "")
        )
        .join("\n");
      const contextText = remaining.map((s) => `- ${s.title}`).join("\n");
      const linksBlock = availableLinks?.length
        ? linksBlockPrompt(availableLinks)
        : "";
      return await withGeminiRetry<string>(
        `generateSectionsMarkdown (${batch.map((s) => s.title).join(" · ")})`,
        async () => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents:             sectionsPrompt(
              sectionsText,
              contextText,
              mainTopic,
              keyword,
              linksBlock,
              lsiKeywords,
              previousContent,
              articleLanguage,
              contentBrief,
              articleType,
              keywordIntent
            ),
            config: { temperature: 0.8 },
          });
          return response.text?.trim() ?? "";
        },
        { onGiveUp: () => skippedSectionsPlaceholder(batch) }
      );
    },

    async generateMeta(
      title: string,
      excerpt: string,
      keyword: string,
      articleLanguage: string
    ): Promise<{ meta_title: string; meta_description: string }> {
      const response = await withGeminiRetry("generateMeta", () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: metaPrompt(title, excerpt, keyword, articleLanguage),
          config: {
            temperature: 0.5,
            responseMimeType: "application/json",
          },
        })
      );
      const raw = cleanJson(response.text ?? "{}");
      return JSON.parse(raw);
    },

    async generateAltText(
      title: string,
      keyword: string,
      lsiKeywords: string[] | null,
      articleLanguage: string
    ): Promise<string> {
      const response = await withGeminiRetry("generateAltText", () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: altTextPrompt(
            title,
            keyword,
            lsiKeywords,
            articleLanguage
          ),
          config: { temperature: 0.5 },
        })
      );
      return (response.text ?? "").trim().replace(/^"|"$/g, "");
    },

    async pickSectionsForImages(
      sections: Section[],
      mainTopic: string
    ): Promise<number[]> {
      const titles = sections.map((s) => s.title);
      const response = await withGeminiRetry("pickSectionsForImages", () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: pickSectionsForImagesPrompt(titles, mainTopic),
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        })
      );
      const raw = cleanJson(response.text ?? "{}");
      const data = JSON.parse(raw);
      const indices = (data.section_indices ?? []).filter(
        (i: number) => i >= 0 && i < sections.length
      );
      return indices.slice(0, 2);
    },
  };
}
