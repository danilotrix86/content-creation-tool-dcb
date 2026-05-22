"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { ArticlePreview } from "@/components/ArticlePreview";
import type { ArticleResult } from "@/lib/pipeline/types";

export default function ArticleDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [result, setResult] = useState<ArticleResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<"markdown" | "html">("markdown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Invalid article id");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/articles/${id}`);
        const json = (await res.json()) as {
          result?: ArticleResult;
          output_format?: "markdown" | "html";
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `Request failed: ${res.status}`);
        }
        if (!cancelled && json.result) {
          setResult(json.result);
          setOutputFormat(json.output_format ?? "markdown");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load article");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SiteHeader />

        <div className="mb-6">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Back to past articles
          </Link>
        </div>

        {loading && (
          <div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-white shadow-soft" />
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
          >
            <p className="font-medium">Could not load article</p>
            <p className="mt-2 text-sm">{error}</p>
            <Link
              href="/articles"
              className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Return to list
            </Link>
          </motion.div>
        )}

        {result && !loading && !error && (
          <ArticlePreview result={result} outputFormat={outputFormat} />
        )}
      </div>
    </div>
  );
}
