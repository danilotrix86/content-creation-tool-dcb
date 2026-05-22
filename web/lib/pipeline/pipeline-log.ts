/** Dev-oriented structured logs for the article pipeline (server terminal). */

/** Chunk size for multiline dumps (full competitor bundle / topic insights). */
const TEXT_LOG_CHUNK = 12000;

export function truncateForLog(text: string, maxChars: number = 320): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}… (${t.length} chars total)`;
}

/**
 * Log a long string in labeled chunks so the full text appears in the terminal
 * (single console.log objects often only show a short `preview`).
 */
export function pipelineDetailText(label: string, text: string): void {
  const t = text ?? "";
  const chunks = Math.max(1, Math.ceil(t.length / TEXT_LOG_CHUNK) || 1);
  console.log(`[Pipeline detail] ${label}`, {
    chars: t.length,
    parts: chunks,
  });
  if (!t.length) {
    console.log(`[Pipeline detail] ${label} (empty)`);
    return;
  }
  for (let i = 0, part = 1; i < t.length; i += TEXT_LOG_CHUNK, part++) {
    const slice = t.slice(i, i + TEXT_LOG_CHUNK);
    console.log(`[Pipeline detail] ${label} — part ${part}/${chunks}\n${slice}`);
  }
}

export function pipelineDetail(
  label: string,
  info?: Record<string, unknown>
): void {
  if (info && Object.keys(info).length > 0) {
    console.log(`[Pipeline detail] ${label}`, info);
  } else {
    console.log(`[Pipeline detail] ${label}`);
  }
}
