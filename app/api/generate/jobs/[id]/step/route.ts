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
import { createPipelineDetailBuffer } from "@/lib/pipeline/pipeline-log";
import type { PipelineDetailEntry } from "@/lib/pipeline/pipeline-detail";
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
  localResult?: ArticleResult & { id: string },
  details?: PipelineDetailEntry[]
) {
  const result = await loadResultForJob(row, localResult);
  return Response.json({
    jobId,
    done: true,
    nextPhase: "done" as JobPhase,
    messages,
    details: details ?? [],
    result,
    resultId: row.result_id,
  });
}

async function buildRunningResponse(
  jobId: string,
  row: GenerationJobRow,
  messages: string[],
  details?: PipelineDetailEntry[]
) {
  return Response.json({
    jobId,
    done: false,
    nextPhase: row.phase,
    messages,
    details: details ?? [],
  });
}

function appendStepLifecycleLogs(
  log: ReturnType<typeof createPipelineDetailBuffer>,
  context: {
    requestId: string;
    startedPhase: JobPhase;
    durationMs: number;
    nextPhase?: JobPhase;
    reconciled?: boolean;
    done?: boolean;
    kind: "complete" | "slow" | "error" | "reconciled";
    error?: string;
  }
) {
  if (context.kind === "complete") {
    log.push({
      level: "info",
      category: "system",
      label: "Job step complete",
      info: {
        requestId: context.requestId,
        phase: context.startedPhase,
        nextPhase: context.nextPhase,
        durationMs: context.durationMs,
        reconciled: context.reconciled,
        done: context.done,
      },
    });
    if (context.durationMs > SLOW_STEP_MS) {
      log.push({
        level: "warn",
        category: "warn",
        label: "Job step slow (near serverless limit)",
        info: {
          requestId: context.requestId,
          phase: context.startedPhase,
          durationMs: context.durationMs,
        },
      });
    }
    return;
  }
  if (context.kind === "slow") {
    log.push({
      level: "warn",
      category: "warn",
      label: "Job step slow (near serverless limit)",
      info: {
        requestId: context.requestId,
        phase: context.startedPhase,
        durationMs: context.durationMs,
      },
    });
    return;
  }
  if (context.kind === "reconciled") {
    log.push({
      level: "info",
      category: "system",
      label: "Job step reconciled after concurrent update",
      info: {
        requestId: context.requestId,
        startedPhase: context.startedPhase,
        nextPhase: context.nextPhase,
      },
    });
    return;
  }
  log.push({
    level: "warn",
    category: "warn",
    label: "Job step error",
    info: {
      requestId: context.requestId,
      phase: context.startedPhase,
      durationMs: context.durationMs,
      error: context.error,
    },
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
  const log = createPipelineDetailBuffer();
  log.push({
    level: "info",
    category: "system",
    label: "Job step started",
    info: { requestId, phase: startedPhase },
  });

  try {
    const step = await log.collect(() =>
      runJobStep(job.phase, job.input, job.state, env)
    );
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
      appendStepLifecycleLogs(log, {
        kind: "complete",
        requestId,
        startedPhase,
        durationMs: Date.now() - stepStartedAt,
        nextPhase: "done",
        reconciled,
        done: true,
      });

      return buildCompletedResponse(
        jobId,
        row,
        messages,
        step.result,
        log.entries
      );
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
    appendStepLifecycleLogs(log, {
      kind: "complete",
      requestId,
      startedPhase,
      durationMs: Date.now() - stepStartedAt,
      nextPhase: row.phase,
      reconciled,
      done: false,
    });

    if (row.status === "completed") {
      return buildCompletedResponse(jobId, row, messages, undefined, log.entries);
    }

    return buildRunningResponse(jobId, row, messages, log.entries);
  } catch (err) {
    const durationMs = Date.now() - stepStartedAt;
    console.error("[Job Step Error]", jobId, {
      requestId,
      phase: startedPhase,
      durationMs,
      err,
    });
    const message = err instanceof Error ? err.message : "Unknown error";
    const cause =
      err instanceof Error && "cause" in err && err.cause instanceof Error
        ? err.cause.message
        : "";
    const fullMessage = message + tlsErrorHint(message, cause);
    appendStepLifecycleLogs(log, {
      kind: "error",
      requestId,
      startedPhase,
      durationMs,
      error: fullMessage,
    });
    if (durationMs > SLOW_STEP_MS) {
      console.warn("[Job Step Slow]", jobId, {
        requestId,
        phase: startedPhase,
        durationMs,
      });
      appendStepLifecycleLogs(log, {
        kind: "slow",
        requestId,
        startedPhase,
        durationMs,
      });
    }

    const current = await getGenerationJob(jobId);
    if (current) {
      if (current.status === "completed" && current.result_id) {
        return buildCompletedResponse(
          jobId,
          current,
          ["Article saved."],
          undefined,
          log.entries
        );
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
        appendStepLifecycleLogs(log, {
          kind: "reconciled",
          requestId,
          startedPhase,
          durationMs,
          nextPhase: current.phase,
        });
        return buildRunningResponse(jobId, current, [], log.entries);
      }

      if (isConcurrentJobUpdateError(err)) {
        return Response.json(
          {
            error: CONCURRENT_JOB_UPDATE_MESSAGE,
            retry: true,
            details: log.entries,
          },
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

    return Response.json(
      { error: fullMessage, details: log.entries },
      { status: 500 }
    );
  }
}
