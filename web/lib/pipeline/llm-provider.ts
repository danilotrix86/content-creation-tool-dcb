import { createGeminiClient } from "./gemini";
import { createOpenAILlmClient } from "./openai-llm";
import type { PipelineLlm } from "./llm-types";

export type LlmProviderId = "gemini" | "openai";

/** Default OpenAI model for text stages (override with OPENAI_LLM_MODEL). */
export const DEFAULT_OPENAI_LLM_MODEL = "gpt-4.1";

export function normalizeLlmProvider(
  raw: string | undefined | null
): LlmProviderId {
  const v = (raw ?? "gemini").toLowerCase().trim();
  if (v === "openai") return "openai";
  return "gemini";
}

export type PipelineLlmEnv = {
  LLM_PROVIDER: LlmProviderId;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY: string;
  OPENAI_LLM_MODEL: string;
};

export function createPipelineLlm(env: PipelineLlmEnv): PipelineLlm {
  if (env.LLM_PROVIDER === "openai") {
    return createOpenAILlmClient(env.OPENAI_API_KEY, env.OPENAI_LLM_MODEL);
  }
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "LLM_PROVIDER=gemini requires GOOGLE_GEMINI_API or GEMINI_API_KEY."
    );
  }
  return createGeminiClient(key);
}
