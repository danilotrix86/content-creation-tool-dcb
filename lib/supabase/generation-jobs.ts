import type { ArticleInput } from "@/lib/pipeline/types";
import type {
  GenerationJobRow,
  JobPhase,
  JobStatus,
  PipelineJobState,
} from "@/lib/pipeline/job-state";
import { comparePhases, isPhaseAtOrPast } from "@/lib/pipeline/job-state";
import { getSupabaseAdmin } from "./server";

export const CONCURRENT_JOB_UPDATE_MESSAGE =
  "Job was updated concurrently. Retry the step.";

export function isConcurrentJobUpdateError(err: unknown): boolean {
  return (
    err instanceof Error && err.message === CONCURRENT_JOB_UPDATE_MESSAGE
  );
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
  }
  return supabase;
}

function mapRow(row: Record<string, unknown>): GenerationJobRow {
  return {
    id: row.id as string,
    status: row.status as JobStatus,
    phase: row.phase as JobPhase,
    input: row.input as ArticleInput,
    state: (row.state as PipelineJobState) ?? {},
    error: (row.error as string | null) ?? null,
    result_id: (row.result_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createGenerationJob(
  input: ArticleInput
): Promise<GenerationJobRow> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("generation_jobs")
    .insert({
      status: "running",
      phase: "research_serp",
      input,
      state: { categoryName: "General" },
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create generation job: ${error.message}`);
  }
  return mapRow(data);
}

export async function getGenerationJob(
  jobId: string
): Promise<GenerationJobRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load generation job: ${error.message}`);
  }
  return data ? mapRow(data) : null;
}

export async function updateGenerationJob(
  jobId: string,
  patch: {
    status?: JobStatus;
    phase?: JobPhase;
    state?: PipelineJobState;
    error?: string | null;
    result_id?: string | null;
  },
  expectedUpdatedAt?: string
): Promise<GenerationJobRow> {
  const supabase = requireSupabase();
  let query = supabase
    .from("generation_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    if (expectedUpdatedAt && error.code === "PGRST116") {
      throw new Error(CONCURRENT_JOB_UPDATE_MESSAGE);
    }
    throw new Error(`Failed to update generation job: ${error.message}`);
  }
  return mapRow(data);
}

function logConcurrentReconcile(
  jobId: string,
  context: {
    requestId?: string;
    startedPhase: JobPhase;
    intendedPhase: JobPhase;
    currentPhase: JobPhase;
    currentStatus: JobStatus;
    attempt: number;
  }
) {
  console.info("[Job Step Reconciled]", jobId, context);
}

export async function commitGenerationJobStep(
  jobId: string,
  options: {
    startedPhase: JobPhase;
    intendedPhase: JobPhase;
    requestId?: string;
    patch: {
      status?: JobStatus;
      phase?: JobPhase;
      state?: PipelineJobState;
      error?: string | null;
      result_id?: string | null;
    };
    expectedUpdatedAt: string;
    maxAttempts?: number;
  }
): Promise<{ row: GenerationJobRow; reconciled: boolean }> {
  const { startedPhase, intendedPhase, patch, maxAttempts = 3, requestId } =
    options;
  let expectedUpdatedAt = options.expectedUpdatedAt;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const row = await updateGenerationJob(
        jobId,
        patch,
        expectedUpdatedAt
      );
      return { row, reconciled: false };
    } catch (err) {
      if (!isConcurrentJobUpdateError(err)) {
        throw err;
      }

      const current = await getGenerationJob(jobId);
      if (!current) {
        throw err;
      }

      if (
        current.status === "completed" ||
        current.phase === "done" ||
        isPhaseAtOrPast(current.phase, intendedPhase)
      ) {
        logConcurrentReconcile(jobId, {
          requestId,
          startedPhase,
          intendedPhase,
          currentPhase: current.phase,
          currentStatus: current.status,
          attempt: attempt + 1,
        });
        return { row: current, reconciled: true };
      }

      if (comparePhases(current.phase, startedPhase) > 0) {
        logConcurrentReconcile(jobId, {
          requestId,
          startedPhase,
          intendedPhase,
          currentPhase: current.phase,
          currentStatus: current.status,
          attempt: attempt + 1,
        });
        return { row: current, reconciled: true };
      }

      if (attempt < maxAttempts - 1) {
        expectedUpdatedAt = current.updated_at;
        continue;
      }

      throw err;
    }
  }

  throw new Error(CONCURRENT_JOB_UPDATE_MESSAGE);
}
