import { randomUUID } from "crypto";
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
import type { ArticleResult } from "@/lib/pipeline/types";
import type { GenerationJobRow, JobPhase } from "@/lib/pipeline/job-state";
import { comparePhases } from "@/lib/pipeline/job-state";
import { getArticleById } from "@/lib/supabase/articles";
import {
  commitGenerationJobStep,
  CONCURRENT_JOB_UPDATE_MESSAGE,
  getGenerationJob,
  isConcurrentJobUpdateError,
  updateGenerationJob,
} from "@/lib/supabase/generation-jobs";

export const maxDuration = 300;

const SLOW_STEP_MS = 50_000;

type RouteContext = { params: Promise<{ id: string }> };

function logStepComplete(
  jobId: string,
  context: {
    requestId: string;
    startedPhase: JobPhase;
    nextPhase: JobPhase;
    durationMs: number;
    reconciled: boolean;
    done: boolean;
  }
) {
  console.info("[Job Step Complete]", jobId, context);
  if (context.durationMs > SLOW_STEP_MS) {
    console.warn("[Job Step Slow]", jobId, {
      requestId: context.requestId,
      phase: context.startedPhase,
      durationMs: context.durationMs,
    });
  }
}

function progressMessages(events: PipelineProgressEvent[]): string[] {
  return events.map((e) => formatUserProgress(e));
}

async function loadResultForJob(
  row: GenerationJobRow,
  localResult?: (ArticleResult & { id: string }) | undefined
): Promise<(ArticleResult & { id: string }) | undefined> {
  if (localResult) {
    return localResult;
  }
  if (!row.result_id) {
    return undefined;
  }
  const article = await getArticleById(row.result_id);
  if (!article) {
    return undefined;
  }
  return { ...article.result, id: row.result_id };
}

async function buildCompletedResponse(
  jobId: string,
  row: GenerationJobRow,
  messages: string[],
  localResult?: ArticleResult & { id: string }
) {
  const result = await loadResultForJob(row, localResult);
  return Response.json({
    jobId,
    done: true,
    nextPhase: "done" as JobPhase,
    messages,
    result,
    resultId: row.result_id,
  });
}

async function buildRunningResponse(
  jobId: string,
  row: GenerationJobRow,
  messages: string[]
) {
  return Response.json({
    jobId,
    done: false,
    nextPhase: row.phase,
    messages,
  });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: jobId } = await context.params;
  const requestId = randomUUID();
  const env = getPipelineRuntimeEnv();
  const envError = validatePipelineEnv(env);
  if (envError) {
    return Response.json({ error: envError }, { status: 500 });
  }

  const job = await getGenerationJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found." }, { status: 404 });
  }

  const startedPhase = job.phase;
  console.info("[Job Step Start]", jobId, { requestId, phase: startedPhase });

  if (job.status === "completed" && job.result_id) {
    return buildCompletedResponse(jobId, job, ["Article saved."]);
  }

  if (job.status === "failed") {
    return Response.json(
      { error: job.error ?? "Job failed." },
      { status: 422 }
    );
  }

  if (job.phase === "done") {
    return buildCompletedResponse(jobId, job, ["Article saved."]);
  }

  const stepStartedAt = Date.now();

  try {
    const step = await runJobStep(job.phase, job.input, job.state, env);
    const messages = progressMessages(step.progress);

    if (step.done && step.result) {
      const { row, reconciled } = await commitGenerationJobStep(jobId, {
        startedPhase,
        intendedPhase: "done",
        requestId,
        expectedUpdatedAt: job.updated_at,
        patch: {
          status: "completed",
          phase: "done",
          state: step.state,
          result_id: step.result.id,
          error: null,
        },
      });

      logStepComplete(jobId, {
        requestId,
        startedPhase,
        nextPhase: "done",
        durationMs: Date.now() - stepStartedAt,
        reconciled,
        done: true,
      });

      return buildCompletedResponse(jobId, row, messages, step.result);
    }

    const { row, reconciled } = await commitGenerationJobStep(jobId, {
      startedPhase,
      intendedPhase: step.nextPhase,
      requestId,
      expectedUpdatedAt: job.updated_at,
      patch: {
        status: "running",
        phase: step.nextPhase,
        state: step.state,
        error: null,
      },
    });

    logStepComplete(jobId, {
      requestId,
      startedPhase,
      nextPhase: row.phase,
      durationMs: Date.now() - stepStartedAt,
      reconciled,
      done: false,
    });

    if (row.status === "completed") {
      return buildCompletedResponse(jobId, row, messages);
    }

    return buildRunningResponse(jobId, row, messages);
  } catch (err) {
    const durationMs = Date.now() - stepStartedAt;
    console.error("[Job Step Error]", jobId, {
      requestId,
      phase: startedPhase,
      durationMs,
      err,
    });
    if (durationMs > SLOW_STEP_MS) {
      console.warn("[Job Step Slow]", jobId, {
        requestId,
        phase: startedPhase,
        durationMs,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const cause =
      err instanceof Error && "cause" in err && err.cause instanceof Error
        ? err.cause.message
        : "";
    const fullMessage = message + tlsErrorHint(message, cause);

    const current = await getGenerationJob(jobId);
    if (current) {
      if (current.status === "completed" && current.result_id) {
        return buildCompletedResponse(jobId, current, ["Article saved."]);
      }

      if (
        current.status === "running" &&
        comparePhases(current.phase, startedPhase) > 0
      ) {
        console.info("[Job Step Reconciled]", jobId, {
          requestId,
          startedPhase,
          currentPhase: current.phase,
          currentStatus: current.status,
          source: "error_handler",
        });
        return buildRunningResponse(jobId, current, []);
      }

      if (isConcurrentJobUpdateError(err)) {
        return Response.json(
          { error: CONCURRENT_JOB_UPDATE_MESSAGE, retry: true },
          { status: 409 }
        );
      }

      if (current.phase === startedPhase && current.status === "running") {
        try {
          await updateGenerationJob(jobId, {
            status: "failed",
            error: fullMessage,
          });
        } catch {
          // ignore secondary failure
        }
      }
    }

    return Response.json({ error: fullMessage }, { status: 500 });
  }
}
