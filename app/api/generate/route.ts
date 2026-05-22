import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import type { ArticleInput } from "@/lib/pipeline/types";
import { normalizeArticleType } from "@/lib/pipeline/types";
import {
  DEFAULT_OPENAI_LLM_MODEL,
  normalizeLlmProvider,
} from "@/lib/pipeline/llm-provider";
import { saveGeneratedArticle } from "@/lib/supabase/save-article";
import {
  formatUserProgress,
  type GenerateStreamMessage,
} from "@/lib/pipeline/progress";

export const maxDuration = 300;

function streamLine(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  message: GenerateStreamMessage
) {
  controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const input: ArticleInput = {
    main_topic: body.main_topic ?? "",
    keyword: body.keyword ?? "",
    content_brief:
      typeof body.content_brief === "string" ? body.content_brief : "",
    article_type: normalizeArticleType(body.article_type),
    search_keywords: Array.isArray(body.search_keywords)
      ? body.search_keywords
      : [],
    search_country: body.search_country ?? "us",
    search_language: body.search_language ?? "en",
    article_language: body.article_language ?? "en",
    output_format: body.output_format === "html" ? "html" : "markdown",
    sitemap_url: body.sitemap_url || null,
  };

  const geminiKey =
    process.env.GOOGLE_GEMINI_API ??
    process.env.GEMINI_API_KEY ??
    process.env.google_gemini_api;
  const openaiKey = process.env.OPENAI_API_KEY;
  const llmProvider = normalizeLlmProvider(process.env.LLM_PROVIDER);
  const openaiLlmModel =
    process.env.OPENAI_LLM_MODEL?.trim() || DEFAULT_OPENAI_LLM_MODEL;

  if (!openaiKey) {
    return Response.json(
      {
        error:
          "Missing OPENAI_API_KEY (required for image generation; also used when LLM_PROVIDER=openai).",
      },
      { status: 500 }
    );
  }

  if (llmProvider === "gemini" && !geminiKey) {
    return Response.json(
      {
        error:
          "LLM_PROVIDER is gemini (default) but no Gemini key is set. Add GOOGLE_GEMINI_API or GEMINI_API_KEY, or set LLM_PROVIDER=openai to use OpenAI for text only.",
      },
      { status: 500 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emitProgress = (event: Parameters<typeof formatUserProgress>[0]) => {
        const message = formatUserProgress(event);
        console.log("[Pipeline]", message);
        streamLine(controller, encoder, { type: "progress", message });
      };

      try {
        const result = await runPipeline(
          input,
          {
            LLM_PROVIDER: llmProvider,
            GEMINI_API_KEY: geminiKey,
            OPENAI_API_KEY: openaiKey,
            OPENAI_LLM_MODEL: openaiLlmModel,
            SERPAPI_KEY: process.env.SERPAPI_KEY,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
          },
          emitProgress
        );

        emitProgress({ type: "save" });
        const id = await saveGeneratedArticle(input, result);
        console.log("[Pipeline] Article saved to Supabase", {
          id,
          slug: result.slug,
        });

        streamLine(controller, encoder, {
          type: "done",
          data: { ...result, id },
        });
      } catch (err) {
        console.error("[Generate API Error]", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        const cause =
          err instanceof Error && "cause" in err && err.cause instanceof Error
            ? err.cause.message
            : "";
        const tlsHint =
          /UNABLE_TO_VERIFY|certificate|TLS|SSL/i.test(message + cause)
            ? " If this is a dev machine with antivirus/HTTPS inspection, set DEV_TLS_INSECURE=1 in .env.local (see .env.example) or add your corporate root CA via NODE_EXTRA_CA_CERTS."
            : "";
        streamLine(controller, encoder, {
          type: "error",
          message: message + tlsHint,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
