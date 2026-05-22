"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PipelineDetailEntry } from "@/lib/pipeline/pipeline-detail";
import {
  formatPipelineDetailInfo,
  formatPipelineDetailTime,
  PIPELINE_LOG_CATEGORY_LABELS,
  PIPELINE_LOG_CATEGORY_STYLES,
} from "@/lib/pipeline/pipeline-detail";

export type ProgressViewMode = "summary" | "detailed";

interface LoadingStateProps {
  steps: string[];
  currentStep: string | null;
  detailLogs: PipelineDetailEntry[];
}

function DetailLogLine({ entry }: { entry: PipelineDetailEntry }) {
  const styles =
    PIPELINE_LOG_CATEGORY_STYLES[entry.category] ??
    PIPELINE_LOG_CATEGORY_STYLES.system;
  const info = formatPipelineDetailInfo(entry.info);

  return (
    <div className="group border-b border-white/5 px-3 py-2.5 last:border-b-0 hover:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-slate-500">
          {formatPipelineDetailTime(entry.at)}
        </span>
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles.badge}`}
        >
          {PIPELINE_LOG_CATEGORY_LABELS[entry.category]}
        </span>
        {entry.level === "warn" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-orange-400">
            warn
          </span>
        )}
      </div>
      <p className={`mt-1 text-sm leading-snug ${styles.text}`}>{entry.label}</p>
      {info && (
        <p className="mt-1 break-all font-mono text-xs leading-relaxed text-slate-400">
          {info}
        </p>
      )}
      {entry.text && (
        <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
          {entry.text}
        </pre>
      )}
    </div>
  );
}

export function LoadingState({
  steps,
  currentStep,
  detailLogs,
}: LoadingStateProps) {
  const [viewMode, setViewMode] = useState<ProgressViewMode>("summary");
  const logEndRef = useRef<HTMLDivElement>(null);

  const completed = currentStep
    ? steps.filter((s) => s !== currentStep)
    : steps;

  useEffect(() => {
    if (viewMode === "detailed") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [detailLogs.length, viewMode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-6 py-4"
    >
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">Creating your article</p>
        <p className="mt-1 text-sm text-gray-500">
          This may take 3–5 minutes. You can keep this tab open.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setViewMode("summary")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "summary"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setViewMode("detailed")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            viewMode === "detailed"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Detailed log
          {detailLogs.length > 0 && (
            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
              {detailLogs.length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "summary" ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {currentStep && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-xl bg-violet-50 px-4 py-3"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
                </span>
                <p className="text-sm font-medium text-violet-900">{currentStep}</p>
              </motion.div>
            )}

            {completed.length > 0 && (
              <ul className="mx-auto w-full max-w-md space-y-2">
                {completed.map((step, i) => (
                  <motion.li
                    key={`${step}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-2.5 text-sm text-gray-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-0.5 h-4 w-4 shrink-0 text-teal-500"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{step}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detailed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-2xl"
          >
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950 shadow-inner">
              <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                <span className="ml-2 text-xs font-medium text-slate-400">
                  Pipeline activity
                </span>
              </div>
              <div className="max-h-[min(420px,50vh)] overflow-y-auto">
                {detailLogs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    Waiting for pipeline events…
                  </p>
                ) : (
                  detailLogs.map((entry) => (
                    <DetailLogLine key={entry.id} entry={entry} />
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                Object.keys(PIPELINE_LOG_CATEGORY_LABELS) as Array<
                  keyof typeof PIPELINE_LOG_CATEGORY_LABELS
                >
              ).map((category) => (
                <span
                  key={category}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${PIPELINE_LOG_CATEGORY_STYLES[category].badge}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${PIPELINE_LOG_CATEGORY_STYLES[category].dot}`}
                  />
                  {PIPELINE_LOG_CATEGORY_LABELS[category]}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
