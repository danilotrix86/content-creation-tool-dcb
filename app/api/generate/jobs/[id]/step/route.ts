import { NextRequest } from "next/server";
import {
  getPipelineRuntimeEnv,
  tlsErrorHint,
  validatePipelineEnv,
} from "@/lib/pipeline/pipeline-env";
import { runJobStep } from "@/lib/pipeline/phases";
import {
  formatUserProgress,
  type PipelineProgressEvent,
} from "@/lib/pipeline/progress";
import {
  getGenerationJob,
  updateGenerationJob,
} from "@/lib/supabase/generation-jobs";
import type { JobPhase } from "@/lib/pipeline/job-state";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

function progressMessages(events: PipelineProgressEvent[]): string[] {
  return events.map((e) => formatUserProgress(e));
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: jobId } = await context.params;
  const env = getPipelineRuntimeEnv();
  const envError = validatePipelineEnv(env);
  if (envError) {
    return Response.json({ error: envError }, { status: 500 });
  }

  const job = await getGenerationJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.status === "completed" && job.result_id) {
    return Response.json({
      jobId,
      done: true,
      nextPhase: "done" as JobPhase,
      messages: ["Article saved."],
      resultId: job.result_id,
    });
  }

  if (job.status === "failed") {
    return Response.json(
      { error: job.error ?? "Job failed." },
      { status: 422 }
    );
  }

  if (job.phase === "done") {
    return Response.json({
      jobId,
      done: true,
      nextPhase: "done" as JobPhase,
      messages: ["Article saved."],
      resultId: job.result_id,
    });
  }

  try {
    const step = await runJobStep(job.phase, job.input, job.state, env);
    const messages = progressMessages(step.progress);

    if (step.done && step.result) {
      await updateGenerationJob(
        jobId,
        {
          status: "completed",
          phase: "done",
          state: step.state,
          result_id: step.result.id,
          error: null,
        },
        job.updated_at
      );

      return Response.json({
        jobId,
        done: true,
        nextPhase: "done",
        messages,
        result: step.result,
      });
    }

    await updateGenerationJob(
      jobId,
      {
        status: "running",
        phase: step.nextPhase,
        state: step.state,
        error: null,
      },
      job.updated_at
    );

    return Response.json({
      jobId,
      done: false,
      nextPhase: step.nextPhase,
      messages,
    });
  } catch (err) {
    console.error("[Job Step Error]", jobId, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const cause =
      err instanceof Error && "cause" in err && err.cause instanceof Error
        ? err.cause.message
        : "";

    try {
      await updateGenerationJob(jobId, {
        status: "failed",
        error: message + tlsErrorHint(message, cause),
      });
    } catch {
      // ignore secondary failure
    }

    return Response.json(
      { error: message + tlsErrorHint(message, cause) },
      { status: 500 }
    );
  }
}
