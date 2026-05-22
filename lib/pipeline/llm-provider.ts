import { createGeminiClient } from "./gemini";
import { createOpenAILlmClient } from "./openai-llm";
import type { PipelineLlm } from "./llm-types";

export type LlmProviderId = "gemini" | "openai";

/** Default OpenAI model for section writing. */
export const DEFAULT_OPENAI_STRONG_MODEL = "gpt-5.4";
/** Default OpenAI model for planning, meta, alt text, and image section picking. */
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-5.4-mini";
/** Default OpenAI Image API model. */
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
/** @deprecated Use OPENAI_STRONG_MODEL / OPENAI_FAST_MODEL. */
export const DEFAULT_OPENAI_LLM_MODEL = "gpt-4.1";

let legacyOpenAiModelWarned = false;

export function normalizeLlmProvider(
  raw: string | undefined | null
): LlmProviderId {
  const v = (raw ?? "gemini").toLowerCase().trim();
  if (v === "openai") return "openai";
  return "gemini";
}

export function resolveOpenAiTextModels(): {
  strongModel: string;
  fastModel: string;
} {
  const legacy = process.env.OPENAI_LLM_MODEL?.trim();
  const strongRaw = process.env.OPENAI_STRONG_MODEL?.trim();
  const fastRaw = process.env.OPENAI_FAST_MODEL?.trim();

  if (legacy && !strongRaw && !fastRaw) {
    if (!legacyOpenAiModelWarned) {
      console.warn(
        "[Pipeline] OPENAI_LLM_MODEL is deprecated; set OPENAI_STRONG_MODEL and OPENAI_FAST_MODEL instead."
      );
      legacyOpenAiModelWarned = true;
    }
    return { strongModel: legacy, fastModel: legacy };
  }

  return {
    strongModel: strongRaw || DEFAULT_OPENAI_STRONG_MODEL,
    fastModel: fastRaw || DEFAULT_OPENAI_FAST_MODEL,
  };
}

export function resolveOpenAiImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL;
}

export type PipelineLlmEnv = {
  LLM_PROVIDER: LlmProviderId;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY: string;
  OPENAI_STRONG_MODEL: string;
  OPENAI_FAST_MODEL: string;
  OPENAI_IMAGE_MODEL: string;
};

export function createPipelineLlm(env: PipelineLlmEnv): PipelineLlm {
  if (env.LLM_PROVIDER === "openai") {
    return createOpenAILlmClient(env.OPENAI_API_KEY, {
      strongModel: env.OPENAI_STRONG_MODEL,
      fastModel: env.OPENAI_FAST_MODEL,
    });
  }
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "LLM_PROVIDER=gemini requires GOOGLE_GEMINI_API or GEMINI_API_KEY."
    );
  }
  return createGeminiClient(key);
}

const GEMINI_PIPELINE_MODEL = "gemini-3.1-pro-preview";

/** Model name for pipeline detail logs (OpenAI strong/fast or Gemini). */
export function pipelineModelLabel(
  env: PipelineLlmEnv,
  tier: "strong" | "fast"
): string {
  if (env.LLM_PROVIDER === "openai") {
    return tier === "strong" ? env.OPENAI_STRONG_MODEL : env.OPENAI_FAST_MODEL;
  }
  return GEMINI_PIPELINE_MODEL;
}
