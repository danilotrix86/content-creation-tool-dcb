import { NextRequest } from "next/server";
import { parseArticleInput } from "@/lib/pipeline/parse-input";
import {
  getPipelineRuntimeEnv,
  validatePipelineEnv,
} from "@/lib/pipeline/pipeline-env";
import { createGenerationJob } from "@/lib/supabase/generation-jobs";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const input = parseArticleInput(body);
  const env = getPipelineRuntimeEnv();
  const envError = validatePipelineEnv(env);
  if (envError) {
    return Response.json({ error: envError }, { status: 500 });
  }

  try {
    const job = await createGenerationJob(input);
    return Response.json({ jobId: job.id });
  } catch (err) {
    console.error("[Create Job Error]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
