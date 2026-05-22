/** Dev-oriented structured logs for the article pipeline (server terminal). */

import {
  categorizePipelineLog,
  type PipelineDetailEntry,
  type PipelineDetailLevel,
  type PipelineLogCategory,
} from "./pipeline-detail";

/** Chunk size for multiline dumps (full competitor bundle / topic insights). */
const TEXT_LOG_CHUNK = 12000;

/** Max chars shown in logs for large competitor scrapes (full text still goes to LLM). */
export const COMPETITOR_BUNDLE_LOG_MAX_CHARS = 500;

type DetailPush = (
  entry: Omit<PipelineDetailEntry, "id" | "at" | "category"> & {
    category?: PipelineLogCategory;
  }
) => void;

let activeDetailCollector: DetailPush | null = null;

export function truncateForLog(text: string, maxChars: number = 320): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}… (${t.length} chars total)`;
}

function makeDetailEntry(
  partial: Omit<PipelineDetailEntry, "id" | "at" | "category"> & {
    category?: PipelineLogCategory;
  },
  index: number
): PipelineDetailEntry {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    category: partial.category ?? categorizePipelineLog(partial.label),
    level: partial.level,
    label: partial.label,
    info: partial.info,
    text: partial.text,
  };
}

export function pushPipelineDetail(
  partial: Omit<PipelineDetailEntry, "id" | "at" | "category"> & {
    category?: PipelineLogCategory;
  }
): PipelineDetailEntry {
  const entry = makeDetailEntry(partial, 0);
  activeDetailCollector?.(partial);
  return entry;
}

export function createPipelineDetailBuffer() {
  const entries: PipelineDetailEntry[] = [];

  const push: DetailPush = (partial) => {
    entries.push(makeDetailEntry(partial, entries.length));
  };

  async function collect<T>(fn: () => Promise<T>): Promise<T> {
    const previous = activeDetailCollector;
    activeDetailCollector = push;
    try {
      return await fn();
    } finally {
      activeDetailCollector = previous;
    }
  }

  return { entries, push, collect };
}

export type PipelineDetailTextOptions = {
  /** Cap log output; omit to dump full text in chunks (e.g. topic insights). */
  maxDisplayChars?: number;
};

function emitDetail(
  level: PipelineDetailLevel,
  label: string,
  info?: Record<string, unknown>,
  text?: string
) {
  activeDetailCollector?.({ level, label, info, text });
}

/**
 * Log a long string in labeled chunks so the full text appears in the terminal
 * (single console.log objects often only show a short `preview`).
 */
export function pipelineDetailText(
  label: string,
  text: string,
  options?: PipelineDetailTextOptions
): void {
  const t = text ?? "";
  const maxDisplay = options?.maxDisplayChars;

  if (maxDisplay != null && maxDisplay >= 0) {
    const preview = t.length ? truncateForLog(t, maxDisplay) : "";
    console.log(`[Pipeline detail] ${label}`, {
      chars: t.length,
      logPreviewChars: Math.min(t.length, maxDisplay),
    });
    if (!t.length) {
      console.log(`[Pipeline detail] ${label} (empty)`);
      emitDetail("text", label, { chars: 0 }, undefined);
      return;
    }
    console.log(`[Pipeline detail] ${label} — preview\n${preview}`);
    emitDetail("text", label, { chars: t.length, previewChars: maxDisplay }, preview);
    return;
  }

  const chunks = Math.max(1, Math.ceil(t.length / TEXT_LOG_CHUNK) || 1);
  console.log(`[Pipeline detail] ${label}`, {
    chars: t.length,
    parts: chunks,
  });
  emitDetail("text", label, { chars: t.length, parts: chunks }, undefined);

  if (!t.length) {
    console.log(`[Pipeline detail] ${label} (empty)`);
    return;
  }
  for (let i = 0, part = 1; i < t.length; i += TEXT_LOG_CHUNK, part++) {
    const slice = t.slice(i, i + TEXT_LOG_CHUNK);
    console.log(`[Pipeline detail] ${label} — part ${part}/${chunks}\n${slice}`);
    emitDetail(
      "text",
      `${label} — part ${part}/${chunks}`,
      { chars: slice.length },
      slice
    );
  }
}

export function pipelineDetail(
  label: string,
  info?: Record<string, unknown>
): void {
  if (info && Object.keys(info).length > 0) {
    console.log(`[Pipeline detail] ${label}`, info);
    emitDetail("info", label, info);
  } else {
    console.log(`[Pipeline detail] ${label}`);
    emitDetail("info", label);
  }
}

export type { PipelineDetailEntry } from "./pipeline-detail";
