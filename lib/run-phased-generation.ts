import type { ArticleResult } from "@/lib/pipeline/types";
import type { PipelineDetailEntry } from "@/lib/pipeline/pipeline-detail";

export interface PhasedGeneratePayload {
  main_topic: string;
  keyword: string;
  content_brief: string;
  article_type: string;
  search_keywords: string[];
  search_country: string;
  search_language: string;
  article_language: string;
  output_format: "markdown" | "html";
  inline_image_count?: number;
  sitemap_url?: string | null;
}

const MAX_STEP_RETRIES = 3;

function isRetryableStepError(status: number, error?: string): boolean {
  if (status === 409) {
    return true;
  }
  return (
    status === 500 &&
    Boolean(error?.includes("Job was updated concurrently. Retry the step."))
  );
}

export async function runPhasedGeneration(
  payload: PhasedGeneratePayload,
  onProgress: (message: string) => void,
  activeJobRef?: { current: string | null },
  onDetail?: (entries: PipelineDetailEntry[]) => void
): Promise<ArticleResult & { id?: string }> {
  const createRes = await fetch("/api/generate/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const json = await createRes.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ||
        `Failed to create job: ${createRes.status}`
    );
  }

  const { jobId } = (await createRes.json()) as { jobId: string };
  if (activeJobRef) {
    activeJobRef.current = jobId;
  }

  let result: (ArticleResult & { id?: string }) | null = null;
  const seenMessages = new Set<string>();

  while (true) {
    if (activeJobRef && activeJobRef.current !== jobId) {
      throw new Error("Generation superseded by a newer request.");
    }

    let stepRes: Response | null = null;
    let json: {
      error?: string;
      done?: boolean;
      messages?: string[];
      details?: PipelineDetailEntry[];
      result?: ArticleResult & { id?: string };
      retry?: boolean;
    } = {};

    for (let attempt = 0; attempt < MAX_STEP_RETRIES; attempt++) {
      stepRes = await fetch(`/api/generate/jobs/${jobId}/step`, {
        method: "POST",
      });

      json = (await stepRes.json().catch(() => ({}))) as typeof json;

      if (json.details?.length) {
        onDetail?.(json.details);
      }

      if (stepRes.ok) {
        break;
      }

      if (
        !isRetryableStepError(stepRes.status, json.error) ||
        attempt === MAX_STEP_RETRIES - 1
      ) {
        throw new Error(json.error || `Step failed: ${stepRes.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }

    if (!stepRes?.ok) {
      throw new Error(json.error || "Step failed.");
    }

    if (activeJobRef && activeJobRef.current !== jobId) {
      throw new Error("Generation superseded by a newer request.");
    }

    for (const message of json.messages ?? []) {
      if (!seenMessages.has(message)) {
        seenMessages.add(message);
        onProgress(message);
      } else {
        onProgress(message);
      }
    }

    if (json.done && json.result) {
      result = json.result;
      break;
    }

    if (json.done && !json.result) {
      throw new Error("Generation finished without a result.");
    }
  }

  if (!result) {
    throw new Error("Generation finished without a result.");
  }

  return result;
}
