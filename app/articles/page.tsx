"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import type { ArticleListItem } from "@/lib/supabase/articles";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/articles");
        const json = (await res.json()) as {
          articles?: ArticleListItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `Request failed: ${res.status}`);
        }
        if (!cancelled) {
          setArticles(json.articles ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load articles");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SiteHeader />

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Past articles</h2>
            <Link
              href="/"
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Generate new article
            </Link>
          </div>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-white shadow-soft"
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-medium">Could not load articles</p>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 shadow-soft">
              <p className="text-center text-gray-500">
                No articles yet — generate your first one
              </p>
              <Link
                href="/"
                className="mt-4 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-600"
              >
                Go to generator
              </Link>
            </div>
          )}

          {!loading && !error && articles.length > 0 && (
            <ul className="space-y-4">
              {articles.map((article, index) => (
                <motion.li
                  key={article.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={`/articles/${article.id}`}
                    className="block rounded-2xl border border-gray-100 bg-white p-6 shadow-soft transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {article.title}
                      </h3>
                      <time
                        className="shrink-0 text-xs text-gray-500"
                        dateTime={article.created_at}
                      >
                        {formatDate(article.created_at)}
                      </time>
                    </div>
                    {article.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                        {article.excerpt}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {article.keyword}
                      </span>
                      {" · "}
                      {article.main_topic}
                      {" · "}
                      {article.word_count} words · {article.reading_time} min read
                      {article.category_name ? ` · ${article.category_name}` : ""}
                    </p>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
  );
}
