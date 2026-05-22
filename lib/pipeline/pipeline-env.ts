import {
  normalizeLlmProvider,
  resolveOpenAiImageModel,
  resolveOpenAiTextModels,
  type PipelineLlmEnv,
} from "./llm-provider";

export type PipelineRuntimeEnv = PipelineLlmEnv & {
  SERPAPI_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

export function getPipelineRuntimeEnv(): PipelineRuntimeEnv {
  const geminiKey =
    process.env.GOOGLE_GEMINI_API ??
    process.env.GEMINI_API_KEY ??
    process.env.google_gemini_api;
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const llmProvider = normalizeLlmProvider(process.env.LLM_PROVIDER);
  const { strongModel, fastModel } = resolveOpenAiTextModels();

  return {
    LLM_PROVIDER: llmProvider,
    GEMINI_API_KEY: geminiKey,
    OPENAI_API_KEY: openaiKey,
    OPENAI_STRONG_MODEL: strongModel,
    OPENAI_FAST_MODEL: fastModel,
    OPENAI_IMAGE_MODEL: resolveOpenAiImageModel(),
    SERPAPI_KEY: process.env.SERPAPI_KEY,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  };
}

export function validatePipelineEnv(env: PipelineRuntimeEnv): string | null {
  if (!env.OPENAI_API_KEY) {
    return "Missing OPENAI_API_KEY (required for image generation; also used when LLM_PROVIDER=openai).";
  }
  if (env.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY?.trim()) {
    return "LLM_PROVIDER is gemini (default) but no Gemini key is set. Add GOOGLE_GEMINI_API or GEMINI_API_KEY, or set LLM_PROVIDER=openai.";
  }
  return null;
}

export function tlsErrorHint(message: string, cause?: string): string {
  const combined = message + (cause ?? "");
  if (/UNABLE_TO_VERIFY|certificate|TLS|SSL/i.test(combined)) {
    return " If this is a dev machine with antivirus/HTTPS inspection, set DEV_TLS_INSECURE=1 in .env.local (see .env.example) or add your corporate root CA via NODE_EXTRA_CA_CERTS.";
  }
  return "";
}
