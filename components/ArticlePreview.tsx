"use client";

import { motion } from "framer-motion";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportToDocx, downloadBlob, getPrintableHtml } from "@/lib/export";
import { buildArticleBundleZip } from "@/lib/export-zip";
import type { ArticleResult } from "@/lib/pipeline/types";

interface ArticlePreviewProps {
  result: ArticleResult;
  outputFormat: "markdown" | "html";
}

export function ArticlePreview({ result, outputFormat }: ArticlePreviewProps) {
  const markdownForExport = result.content_markdown ?? result.content;

  const handleDownloadDoc = async () => {
    const blob = await exportToDocx(markdownForExport);
    downloadBlob(blob, `${result.slug}.docx`);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([markdownForExport], { type: "text/markdown" });
    downloadBlob(blob, `${result.slug}.md`);
  };

  const handleDownloadZip = async () => {
    const blob = await buildArticleBundleZip(result);
    downloadBlob(blob, `${result.slug}-bundle.zip`);
  };

  const handleDownloadPdf = () => {
    const contentToPrint = result.content_markdown ?? result.content;
    const isMarkdown = outputFormat === "markdown" || !!result.content_markdown;
    const html = getPrintableHtml(
      result.title,
      contentToPrint,
      result.meta_title,
      result.meta_description,
      result.reading_time,
      isMarkdown,
      result.featured_image
    );
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-2xl border border-gray-100 bg-white p-8 shadow-soft"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{result.title}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {result.word_count} words · {result.reading_time} min read · {result.category_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <motion.button
            onClick={handleDownloadZip}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
          >
            Download ZIP
          </motion.button>
          <motion.button
            onClick={handleDownloadDoc}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
          >
            Download DOC
          </motion.button>
          <motion.button
            onClick={handleDownloadPdf}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
          >
            Print to PDF
          </motion.button>
          <motion.button
            onClick={handleDownloadMd}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Download MD
          </motion.button>
        </div>
      </div>

      {result.featured_image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 overflow-hidden rounded-xl"
        >
          <img
            src={result.featured_image}
            alt={result.title}
            className="h-auto w-full object-cover"
          />
        </motion.div>
      )}

      <div className="prose-article max-w-none">
        {outputFormat === "markdown" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={(url) =>
              url.startsWith("data:image/") ? url : defaultUrlTransform(url)
            }
          >
            {result.content}
          </ReactMarkdown>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: result.content }}
            className="prose-article"
          />
        )}
      </div>
    </motion.div>
  );
}
