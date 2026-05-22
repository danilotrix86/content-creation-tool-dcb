/** Shared pipeline detail log types and UI styling (client + server). */

export type PipelineLogCategory =
  | "research"
  | "analysis"
  | "writing"
  | "media"
  | "system"
  | "success"
  | "warn";

export type PipelineDetailLevel = "info" | "warn" | "text";

export interface PipelineDetailEntry {
  id: string;
  at: string;
  level: PipelineDetailLevel;
  category: PipelineLogCategory;
  label: string;
  info?: Record<string, unknown>;
  text?: string;
}

export const PIPELINE_LOG_CATEGORY_STYLES: Record<
  PipelineLogCategory,
  { badge: string; text: string; dot: string }
> = {
  research: {
    badge: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
    text: "text-teal-100",
    dot: "bg-teal-400",
  },
  analysis: {
    badge: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    text: "text-violet-100",
    dot: "bg-violet-400",
  },
  writing: {
    badge: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    text: "text-sky-100",
    dot: "bg-sky-400",
  },
  media: {
    badge: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    text: "text-amber-100",
    dot: "bg-amber-400",
  },
  system: {
    badge: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    text: "text-slate-200",
    dot: "bg-slate-400",
  },
  success: {
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    text: "text-emerald-100",
    dot: "bg-emerald-400",
  },
  warn: {
    badge: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
    text: "text-orange-100",
    dot: "bg-orange-400",
  },
};

export const PIPELINE_LOG_CATEGORY_LABELS: Record<PipelineLogCategory, string> = {
  research: "Research",
  analysis: "Analysis",
  writing: "Writing",
  media: "Media",
  system: "System",
  success: "Done",
  warn: "Warning",
};

export function categorizePipelineLog(label: string): PipelineLogCategory {
  const l = label.toLowerCase();
  if (
    l.includes("scrape") ||
    l.includes("serp") ||
    l.includes("competitor page") ||
    l.includes("cloudflare") ||
    l.includes("competitor research") ||
    l.includes("competitor markdown")
  ) {
    return "research";
  }
  if (
    l.includes("topic insights") ||
    l.includes("strategy") ||
    l.includes("outline") ||
    l.includes("meta") ||
    l.includes("internal link") ||
    l.includes("competitor articles bundle") ||
    l.includes("competitor analysis")
  ) {
    return "analysis";
  }
  if (l.includes("write") || l.includes("section") || l.includes("markdown")) {
    return "writing";
  }
  if (l.includes("image") || l.includes("alt text")) {
    return "media";
  }
  if (
    l.includes("slow") ||
    l.includes("failed") ||
    l.includes("skipped") ||
    l.includes("warn") ||
    l.includes("blocked")
  ) {
    return "warn";
  }
  if (
    l.includes("save") ||
    l.includes("finished") ||
    l.includes("complete") ||
    l.includes("extracted")
  ) {
    return l.includes("step complete") ? "system" : "success";
  }
  if (l.includes("job step") || l.includes("step started")) {
    return "system";
  }
  return "system";
}

export function formatPipelineDetailInfo(
  info?: Record<string, unknown>
): string | null {
  if (!info || Object.keys(info).length === 0) return null;
  return Object.entries(info)
    .map(([key, value]) => {
      const rendered =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
      return `${key}: ${rendered}`;
    })
    .join(" · ");
}

export function formatPipelineDetailTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
