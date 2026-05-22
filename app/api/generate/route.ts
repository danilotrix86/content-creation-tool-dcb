import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import { parseArticleInput } from "@/lib/pipeline/parse-input";
import {
  getPipelineRuntimeEnv,
  validatePipelineEnv,
} from "@/lib/pipeline/pipeline-env";
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
  const input = parseArticleInput(body);
  const env = getPipelineRuntimeEnv();
  const envError = validatePipelineEnv(env);

  if (envError) {
    return Response.json({ error: envError }, { status: 500 });
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
        const result = await runPipeline(input, env, emitProgress);

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
