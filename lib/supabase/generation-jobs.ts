import type { ArticleInput } from "@/lib/pipeline/types";
import type {
  GenerationJobRow,
  JobPhase,
  JobStatus,
  PipelineJobState,
} from "@/lib/pipeline/job-state";
import { getSupabaseAdmin } from "./server";

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
      throw new Error("Job was updated concurrently. Retry the step.");
    }
    throw new Error(`Failed to update generation job: ${error.message}`);
  }
  return mapRow(data);
}
