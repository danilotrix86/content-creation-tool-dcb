import OpenAI from "openai";
import { APIError } from "openai";
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

function errnoHints(e: unknown): string[] {
  if (typeof e !== "object" || e === null) return [];
  const o = e as NodeJS.ErrnoException & { address?: string; port?: number };
  const out: string[] = [];
  if (typeof o.code === "string") out.push(`code=${o.code}`);
  if (o.errno !== undefined) out.push(`errno=${String(o.errno)}`);
  if (typeof o.syscall === "string") out.push(`syscall=${o.syscall}`);
  if (typeof o.address === "string") out.push(`address=${o.address}`);
  if (typeof o.port === "number") out.push(`port=${o.port}`);
  return out;
}

function formatOpenAiErrorForLog(err: unknown): string {
  if (err instanceof APIError) {
    const hints = errnoHints(err);
    const base = `APIError HTTP ${String(err.status)}: ${err.message}`;
    return hints.length ? `${base} (${hints.join(", ")})` : base;
  }
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth < 8) {
    if (cur instanceof AggregateError) {
      parts.push(
        `AggregateError: ${cur.errors.map((x) => formatOpenAiErrorForLog(x)).join("; ")}`
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

function isTransientOpenAiError(err: unknown): boolean {
  if (err instanceof APIError) {
    const s = err.status;
    if (s === 408 || s === 429 || s === 500 || s === 502 || s === 503 || s === 504)
      return true;
    const msg = err.message.toLowerCase();
    if (
      msg.includes("unavailable") ||
      msg.includes("overloaded") ||
      msg.includes("rate limit") ||
      msg.includes("try again") ||
      msg.includes("timeout")
    ) {
      return true;
    }
  }
  if (err instanceof TypeError && err.message === "fetch failed") return true;
  return false;
}

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withOpenAiRetry<T>(
  label: string,
  model: string,
  fn: () => Promise<T>,
  options?: { onGiveUp?: () => T }
): Promise<T> {
  const logLabel = `${label} (${model})`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const transient = isTransientOpenAiError(e);
      const willRetry = transient && attempt < MAX_ATTEMPTS;
      if (willRetry) {
        const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
        console.warn(
          `[OpenAI LLM] ${logLabel}: attempt ${attempt}/${MAX_ATTEMPTS} failed (${formatOpenAiErrorForLog(e)}); retry in ${wait}ms`
        );
        await sleep(wait);
        continue;
      }
      if (options?.onGiveUp) {
        console.warn(
          `[OpenAI LLM] ${logLabel}: giving up after ${attempt} attempt(s) (${formatOpenAiErrorForLog(e)}); using fallback`
        );
        return options.onGiveUp();
      }
      console.warn(
        `[OpenAI LLM] ${logLabel}: failed after ${attempt} attempt(s): ${formatOpenAiErrorForLog(e)}`
      );
      throw e;
    }
  }
  throw new Error(
    `[OpenAI LLM] ${logLabel}: retry loop exhausted (MAX_ATTEMPTS=${MAX_ATTEMPTS})`
  );
}

function skippedSectionsPlaceholder(batch: Section[]): string {
  return batch
    .map(
      (s) =>
        `## ${s.title}\n\n*[This section could not be generated (API error after ${MAX_ATTEMPTS} attempts). Fill in manually or re-run the pipeline.]*\n`
    )
    .join("\n\n");
}

/** Default when the model accepts custom sampling (overridable via OPENAI_LLM_TEMPERATURE). */
const DEFAULT_CHAT_TEMPERATURE = 0.7;

function modelUsesDefaultTemperatureOnly(model: string): boolean {
  const m = model.toLowerCase().trim();
  if (m.includes("gpt-5")) return true;
  if (/^o[0-9]/.test(m) || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4"))
    return true;
  return false;
}

/**
 * Some models only allow the server-default sampler (no custom `temperature`).
 * Set OPENAI_LLM_OMIT_TEMPERATURE=1 to always omit, or OPENAI_LLM_TEMPERATURE=omit.
 * Otherwise uses OPENAI_LLM_TEMPERATURE or 0.7 for models that support it.
 */
function temperaturePayload(model: string): { temperature?: number } {
  if (process.env.OPENAI_LLM_OMIT_TEMPERATURE === "1") return {};
  if (modelUsesDefaultTemperatureOnly(model)) return {};
  const raw = process.env.OPENAI_LLM_TEMPERATURE?.trim();
  if (raw === "omit" || raw === "default") return {};
  const n =
    raw === undefined || raw === "" ? DEFAULT_CHAT_TEMPERATURE : Number(raw);
  if (!Number.isFinite(n)) return { temperature: DEFAULT_CHAT_TEMPERATURE };
  return { temperature: n };
}

function isTemperatureUnsupportedError(err: unknown): boolean {
  if (!(err instanceof APIError) || err.status !== 400) return false;
  const withParam = err as APIError & { param?: string };
  if (withParam.param === "temperature") return true;
  return /temperature.*does not support|unsupported_value.*temperature|param.?=.?['"]temperature['"]/i.test(
    err.message
  );
}

export type OpenAiLlmModels = {
  strongModel: string;
  fastModel: string;
};

/**
 * Chat Completions–based pipeline LLM with strong/fast model routing.
 */
export function createOpenAILlmClient(
  apiKey: string,
  models: OpenAiLlmModels
): PipelineLlm {
  const client = new OpenAI({ apiKey });
  const { strongModel, fastModel } = models;

  async function completion(
    model: string,
    userPrompt: string,
    opts: { json?: boolean } = {}
  ): Promise<string> {
    const jsonHint = opts.json
      ? "\n\nOutput valid JSON only (no markdown code fences, no commentary)."
      : "";
    const tempPart = temperaturePayload(model);
    const hasCustomTemperature = "temperature" in tempPart;

    const run = async (temp: { temperature?: number }) =>
      client.chat.completions.create({
        model,
        ...temp,
        ...(opts.json
          ? { response_format: { type: "json_object" as const } }
          : {}),
        messages: [
          {
            role: "user",
            content: userPrompt + jsonHint,
          },
        ],
      });

    try {
      const response = await run(tempPart);
      return response.choices[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      if (hasCustomTemperature && isTemperatureUnsupportedError(e)) {
        console.warn(
          `[OpenAI LLM] Retrying ${model} without custom temperature (model only supports default sampling).`
        );
        const response = await run({});
        return response.choices[0]?.message?.content?.trim() ?? "";
      }
      throw e;
    }
  }

  return {
    async generateTopicInsights(
      scrapedContent: string,
      mainTopic: string,
      keyword: string,
      articleLanguage: string
    ) {
      const text = await withOpenAiRetry("generateTopicInsights", fastModel, () =>
        completion(
          fastModel,
          topicInsightsPrompt(scrapedContent, mainTopic, keyword, articleLanguage),
          { json: true }
        )
      );
      return parseTopicInsights(text);
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
        const text = await withOpenAiRetry("deriveArticleStrategy", fastModel, () =>
          completion(
            fastModel,
            articleStrategyPrompt(
              mainTopic,
              keyword,
              searchKeywords,
              articleType,
              insightsText,
              contentBrief
            ),
            { json: true }
          )
        );
        return parseArticleStrategy(text, articleType);
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
      const text = await withOpenAiRetry("generateOutline", fastModel, () =>
        completion(
          fastModel,
          outlinePrompt(
            mainTopic,
            keyword,
            insightsText,
            articleLanguage,
            contentBrief,
            articleType,
            strategy
          ),
          { json: true }
        )
      );
      const raw = cleanJson(text);
      const data = JSON.parse(raw);
      const sections: Section[] = (data.sections ?? []).map(
        (s: { title: string; subsections?: string[] }) => ({
          title: s.title,
          subsections: s.subsections ?? [],
        })
      );
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
      return await withOpenAiRetry(
        `generateSectionsMarkdown (${batch.map((s) => s.title).join(" · ")})`,
        strongModel,
        () =>
          completion(
            strongModel,
            sectionsPrompt(
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
            )
          ),
        { onGiveUp: () => skippedSectionsPlaceholder(batch) }
      );
    },

    async generateMeta(
      title: string,
      excerpt: string,
      keyword: string,
      articleLanguage: string
    ): Promise<{ meta_title: string; meta_description: string }> {
      const text = await withOpenAiRetry("generateMeta", fastModel, () =>
        completion(fastModel, metaPrompt(title, excerpt, keyword, articleLanguage), {
          json: true,
        })
      );
      return JSON.parse(cleanJson(text));
    },

    async generateAltText(
      title: string,
      keyword: string,
      lsiKeywords: string[] | null,
      articleLanguage: string
    ): Promise<string> {
      const text = await withOpenAiRetry("generateAltText", fastModel, () =>
        completion(
          fastModel,
          altTextPrompt(title, keyword, lsiKeywords, articleLanguage)
        )
      );
      return text.replace(/^"|"$/g, "");
    },

    async pickSectionsForImages(
      sections: Section[],
      mainTopic: string,
      count: number
    ): Promise<number[]> {
      if (count <= 0) return [];
      const titles = sections.map((s) => s.title);
      const text = await withOpenAiRetry("pickSectionsForImages", fastModel, () =>
        completion(
          fastModel,
          pickSectionsForImagesPrompt(titles, mainTopic, count),
          { json: true }
        )
      );
      const data = JSON.parse(cleanJson(text));
      const indices = (data.section_indices ?? []).filter(
        (i: number) => i >= 0 && i < sections.length
      );
      return indices.slice(0, count);
    },
  };
}
