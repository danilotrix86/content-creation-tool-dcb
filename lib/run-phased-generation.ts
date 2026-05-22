import type { ArticleResult } from "@/lib/pipeline/types";

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
  sitemap_url?: string | null;
}

export async function runPhasedGeneration(
  payload: PhasedGeneratePayload,
  onProgress: (message: string) => void,
  activeJobRef?: { current: string | null }
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

    const stepRes = await fetch(`/api/generate/jobs/${jobId}/step`, {
      method: "POST",
    });

    const json = (await stepRes.json().catch(() => ({}))) as {
      error?: string;
      done?: boolean;
      messages?: string[];
      result?: ArticleResult & { id?: string };
    };

    if (!stepRes.ok) {
      throw new Error(json.error || `Step failed: ${stepRes.status}`);
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
