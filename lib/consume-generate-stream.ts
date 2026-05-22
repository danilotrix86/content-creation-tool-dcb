import type { ArticleResult } from "@/lib/pipeline/types";
import type { GenerateStreamMessage } from "@/lib/pipeline/progress";

export async function consumeGenerateStream(
  response: Response,
  onProgress: (message: string) => void
): Promise<ArticleResult & { id?: string }> {
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ||
        `Request failed: ${response.status}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream from server.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let result: (ArticleResult & { id?: string }) | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const msg = JSON.parse(trimmed) as GenerateStreamMessage;
      if (msg.type === "progress") {
        onProgress(msg.message);
      } else if (msg.type === "done") {
        result = msg.data as ArticleResult & { id?: string };
      } else if (msg.type === "error") {
        throw new Error(msg.message);
      }
    }
  }

  if (buffer.trim()) {
    const msg = JSON.parse(buffer.trim()) as GenerateStreamMessage;
    if (msg.type === "progress") onProgress(msg.message);
    if (msg.type === "done") result = msg.data as ArticleResult & { id?: string };
    if (msg.type === "error") throw new Error(msg.message);
  }

  if (!result) {
    throw new Error("Generation finished without a result.");
  }

  return result;
}
