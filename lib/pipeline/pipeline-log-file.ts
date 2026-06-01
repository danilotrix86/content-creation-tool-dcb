import fs from "fs/promises";
import path from "path";
import type { PipelineDetailEntry } from "./pipeline-detail";

/** Default: enabled in dev, disabled in production unless PIPELINE_LOG_FILE=1. */
export function isPipelineFileLogEnabled(): boolean {
  const flag = process.env.PIPELINE_LOG_FILE?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function getPipelineJobLogDir(): string {
  const configured = process.env.PIPELINE_LOG_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "logs", "jobs");
}

export function getPipelineJobLogPath(jobId: string): string {
  return path.join(getPipelineJobLogDir(), `${jobId}.log`);
}

async function ensureLogDir(): Promise<void> {
  await fs.mkdir(getPipelineJobLogDir(), { recursive: true });
}

function formatEntry(entry: PipelineDetailEntry): string {
  const lines: string[] = [
    `[${entry.at}] [${entry.level}] [${entry.category}] ${entry.label}`,
  ];
  if (entry.info && Object.keys(entry.info).length > 0) {
    lines.push(JSON.stringify(entry.info, null, 2));
  }
  if (entry.text) {
    lines.push(entry.text);
  }
  return lines.join("\n");
}

export type JobLogSectionMeta = Record<string, unknown>;

/**
 * Append a labeled section (and optional structured log entries) to the job's
 * `.log` file under logs/jobs/{jobId}.log. Returns the file path when written.
 */
export async function appendJobLogSection(
  jobId: string,
  title: string,
  meta?: JobLogSectionMeta,
  entries?: PipelineDetailEntry[]
): Promise<string | null> {
  if (!isPipelineFileLogEnabled()) return null;

  try {
    await ensureLogDir();
    const filePath = getPipelineJobLogPath(jobId);
    const parts: string[] = [
      "",
      "=".repeat(80),
      `[${new Date().toISOString()}] ${title}`,
    ];
    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta, null, 2));
    }
    parts.push("=".repeat(80));
    if (entries?.length) {
      parts.push(entries.map(formatEntry).join("\n\n"));
    }
    parts.push("");
    await fs.appendFile(filePath, parts.join("\n"), "utf8");
    return filePath;
  } catch (err) {
    console.error("[Pipeline log file] write failed", err);
    return null;
  }
}

/** Write a one-line note at the top when a job log file is first created. */
export async function initJobLogFile(
  jobId: string,
  meta?: JobLogSectionMeta
): Promise<string | null> {
  if (!isPipelineFileLogEnabled()) return null;

  try {
    await ensureLogDir();
    const filePath = getPipelineJobLogPath(jobId);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // file does not exist yet
    }
    const header = [
      `# Pipeline job log`,
      `# jobId: ${jobId}`,
      `# created: ${new Date().toISOString()}`,
      meta ? `# ${JSON.stringify(meta)}` : "",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await fs.writeFile(filePath, header, "utf8");
    return filePath;
  } catch (err) {
    console.error("[Pipeline log file] init failed", err);
    return null;
  }
}
