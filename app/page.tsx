"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArticleForm, type FormData } from "@/components/ArticleForm";
import { ArticlePreview } from "@/components/ArticlePreview";
import { LoadingState } from "@/components/LoadingState";
import { SiteHeader } from "@/components/SiteHeader";
import type { ArticleResult } from "@/lib/pipeline/types";
import type { PipelineDetailEntry } from "@/lib/pipeline/pipeline-detail";
import { runPhasedGeneration } from "@/lib/run-phased-generation";

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ArticleResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<"markdown" | "html">("markdown");
  const [error, setError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<PipelineDetailEntry[]>([]);

  const handleProgress = (message: string) => {
    setProgressSteps((prev) => {
      if (prev.length === 0) return [message];
      const last = prev[prev.length - 1];
      if (last === message) return prev;
      return [...prev, message];
    });
    setCurrentStep(message);
  };

  const handleDetail = (entries: PipelineDetailEntry[]) => {
    if (!entries.length) return;
    setDetailLogs((prev) => [...prev, ...entries]);
  };

  const activeJobRef = useRef<string | null>(null);

  const handleSubmit = async (data: FormData) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setProgressSteps([]);
    setCurrentStep(null);
    setDetailLogs([]);
    setOutputFormat(data.output_format);
    activeJobRef.current = null;

    try {
      const article = await runPhasedGeneration(
        {
          main_topic: data.main_topic,
          keyword: data.keyword,
          content_brief: data.content_brief,
          article_type: data.article_type,
          search_keywords: data.search_keywords,
          search_country: data.search_country,
          search_language: data.search_language,
          article_language: data.article_language,
          output_format: data.output_format,
          sitemap_url: data.sitemap_url || null,
        },
        handleProgress,
        activeJobRef,
        handleDetail
      );
      setCurrentStep(null);
      setProgressSteps((prev) =>
        prev.length ? prev : ["Starting generation…"]
      );
      setResult(article);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SiteHeader />
        </motion.div>

        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-violet-600">
                      <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 0 0 1.09 1.03L9.25 4.636v8.614Z" />
                      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                    </svg>
                  </span>
                  Article Settings
                </h2>
                <div className="flex gap-2">
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">Competitor research</span>
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">SEO optimized</span>
                </div>
              </div>
              <ArticleForm onSubmit={handleSubmit} isGenerating={isGenerating} />
            </div>
          </motion.section>

          <main>
            <AnimatePresence mode="wait">
              {isGenerating && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-gray-100 bg-white p-12 shadow-soft"
                >
                  <LoadingState
                    steps={progressSteps}
                    currentStep={currentStep}
                    detailLogs={detailLogs}
                  />
                </motion.div>
              )}

              {error && !isGenerating && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
                >
                  <p className="font-medium">Error</p>
                  <p className="mt-2 text-sm">{error}</p>
                </motion.div>
              )}

              {result && !isGenerating && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  {result.id && (
                    <p className="text-center text-sm text-gray-600">
                      <Link
                        href={`/articles/${result.id}`}
                        className="font-medium text-teal-600 hover:text-teal-700"
                      >
                        View in past articles
                      </Link>
                    </p>
                  )}
                  <ArticlePreview result={result} outputFormat={outputFormat} />
                </motion.div>
              )}

              {!result && !isGenerating && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 shadow-soft"
                >
                  <p className="text-center text-gray-500">
                    Fill in the form and click Generate to create your article
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
