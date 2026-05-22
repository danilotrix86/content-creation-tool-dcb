"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ARTICLE_TYPE_OPTIONS,
  type ArticleType,
} from "@/lib/pipeline/types";

/** Google `hl` (interface language) — SerpAPI-compatible where possible. */
const LANGUAGES_RAW: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "hu", label: "Hungarian" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
  { code: "ro", label: "Romanian" },
  { code: "bg", label: "Bulgarian" },
  { code: "hr", label: "Croatian" },
  { code: "sl", label: "Slovenian" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "el", label: "Greek" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ms", label: "Malay" },
  { code: "tl", label: "Filipino (Tagalog)" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "et", label: "Estonian" },
];

/** Google `gl` (country) — ISO 3166-1 alpha-2, lowercase. */
const COUNTRIES_RAW: { code: string; label: string }[] = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "nz", label: "New Zealand" },
  { code: "ie", label: "Ireland" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "pt", label: "Portugal" },
  { code: "nl", label: "Netherlands" },
  { code: "be", label: "Belgium" },
  { code: "ch", label: "Switzerland" },
  { code: "at", label: "Austria" },
  { code: "pl", label: "Poland" },
  { code: "cz", label: "Czech Republic" },
  { code: "sk", label: "Slovakia" },
  { code: "hu", label: "Hungary" },
  { code: "ro", label: "Romania" },
  { code: "bg", label: "Bulgaria" },
  { code: "hr", label: "Croatia" },
  { code: "si", label: "Slovenia" },
  { code: "rs", label: "Serbia" },
  { code: "se", label: "Sweden" },
  { code: "no", label: "Norway" },
  { code: "dk", label: "Denmark" },
  { code: "fi", label: "Finland" },
  { code: "gr", label: "Greece" },
  { code: "br", label: "Brazil" },
  { code: "mx", label: "Mexico" },
  { code: "ar", label: "Argentina" },
  { code: "cl", label: "Chile" },
  { code: "co", label: "Colombia" },
  { code: "in", label: "India" },
  { code: "jp", label: "Japan" },
  { code: "kr", label: "South Korea" },
  { code: "cn", label: "China" },
  { code: "hk", label: "Hong Kong" },
  { code: "tw", label: "Taiwan" },
  { code: "sg", label: "Singapore" },
  { code: "my", label: "Malaysia" },
  { code: "id", label: "Indonesia" },
  { code: "th", label: "Thailand" },
  { code: "vn", label: "Vietnam" },
  { code: "ph", label: "Philippines" },
  { code: "tr", label: "Turkey" },
  { code: "il", label: "Israel" },
  { code: "ae", label: "United Arab Emirates" },
  { code: "sa", label: "Saudi Arabia" },
  { code: "za", label: "South Africa" },
  { code: "ng", label: "Nigeria" },
  { code: "eg", label: "Egypt" },
  { code: "ua", label: "Ukraine" },
  { code: "ru", label: "Russia" },
  { code: "ee", label: "Estonia" },
  { code: "lv", label: "Latvia" },
  { code: "lt", label: "Lithuania" },
  { code: "lu", label: "Luxembourg" },
  { code: "pe", label: "Peru" },
  { code: "pk", label: "Pakistan" },
  { code: "bd", label: "Bangladesh" },
];

const COUNTRY_PIN_ORDER = [
  "us",
  "gb",
  "ca",
  "au",
  "de",
  "fr",
  "es",
  "it",
  "pl",
  "hu",
  "nl",
] as const;

function orderedCountries(): { code: string; label: string }[] {
  const byCode = new Map(COUNTRIES_RAW.map((c) => [c.code, c]));
  const pinned = COUNTRY_PIN_ORDER.map((code) => byCode.get(code)).filter(
    (c): c is { code: string; label: string } => c !== undefined
  );
  const pinSet = new Set<string>(COUNTRY_PIN_ORDER);
  const rest = COUNTRIES_RAW.filter((c) => !pinSet.has(c.code)).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  return [...pinned, ...rest];
}

function orderedLanguages(): { code: string; label: string }[] {
  const en = LANGUAGES_RAW.find((l) => l.code === "en");
  const rest = LANGUAGES_RAW.filter((l) => l.code !== "en").sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  return en ? [en, ...rest] : rest;
}

const COUNTRIES = orderedCountries();
const LANGUAGES = orderedLanguages();

export interface FormData {
  main_topic: string;
  keyword: string;
  content_brief: string;
  article_type: ArticleType;
  search_keywords: string[];
  search_country: string;
  search_language: string;
  article_language: string;
  output_format: "markdown" | "html";
  sitemap_url: string;
}

const initialForm: FormData = {
  main_topic: "",
  keyword: "",
  content_brief: "",
  article_type: "informational",
  search_keywords: [""],
  search_country: "us",
  search_language: "en",
  article_language: "en",
  output_format: "markdown",
  sitemap_url: "",
};

interface ArticleFormProps {
  onSubmit: (data: FormData) => void;
  isGenerating: boolean;
}

export function ArticleForm({ onSubmit, isGenerating }: ArticleFormProps) {
  const [form, setForm] = useState<FormData>(initialForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      search_keywords: form.search_keywords.filter(Boolean),
    };
    onSubmit(payload);
  };

  const addKeyword = () =>
    setForm((f) => ({ ...f, search_keywords: [...f.search_keywords, ""] }));

  const removeKeyword = (i: number) =>
    setForm((f) => ({
      ...f,
      search_keywords: f.search_keywords.filter((_, j) => j !== i),
    }));

  const updateKeyword = (i: number, v: string) =>
    setForm((f) => ({
      ...f,
      search_keywords: f.search_keywords.map((k, j) => (j === i ? v : k)),
    }));

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all";

  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-sky-500">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
      </svg>
      <span>{children}</span>
    </div>
  );

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <label className={labelClass}>Main Topic</label>
        <Tip>
          Broad subject your article should cover—it sets the narrative and scope so sections stay on
          theme with your target keyword.
        </Tip>
        <input
          type="text"
          value={form.main_topic}
          onChange={(e) =>
            setForm((f) => ({ ...f, main_topic: e.target.value }))
          }
          placeholder="e.g. Best Online Casino Reviews for US Players"
          className={inputClass}
          required
          disabled={isGenerating}
        />
      </div>

      <div>
        <label className={labelClass}>Target Keyword</label>
        <Tip>
          Primary keyword you want the article to rank for. It will be used in the title, excerpt,
          and woven through the body for SEO.
        </Tip>
        <input
          type="text"
          value={form.keyword}
          onChange={(e) =>
            setForm((f) => ({ ...f, keyword: e.target.value }))
          }
          placeholder="e.g. online casino reviews, best casino sites"
          className={inputClass}
          required
          disabled={isGenerating}
        />
      </div>

      <div>
        <label className={labelClass}>Article Type</label>
        <Tip>
          Controls outline structure and section count. Informational guides are longest;
          transactional pages are shorter and CTA-focused. Keyword intent is inferred
          automatically from your keywords and competitor analysis.
        </Tip>
        <select
          value={form.article_type}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              article_type: e.target.value as ArticleType,
            }))
          }
          className={inputClass}
          disabled={isGenerating}
          required
        >
          {ARTICLE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-500">
          {
            ARTICLE_TYPE_OPTIONS.find((o) => o.value === form.article_type)
              ?.description
          }
        </p>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h3
          id="section-content-brief"
          className="mb-2 text-base font-semibold text-gray-900"
        >
          Content Brief
        </h3>
        <Tip>
          Editorial direction for the draft: target audience, tone, angle, must-cover ideas, CTAs,
          or things to avoid. Passed into outline and article generation.
        </Tip>
        <textarea
          id="content-brief"
          rows={5}
          value={form.content_brief}
          onChange={(e) =>
            setForm((f) => ({ ...f, content_brief: e.target.value }))
          }
          placeholder="e.g. Write for players comparing licensed online casinos; cover bonuses, payout speed, and game variety; include a pros/cons table; end with responsible gambling note."
          className={`${inputClass} min-h-[120px] resize-y`}
          disabled={isGenerating}
          aria-labelledby="section-content-brief"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className={labelClass}>Search Keywords</label>
          <motion.button
            type="button"
            onClick={addKeyword}
            disabled={isGenerating}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
          >
            + Add
          </motion.button>
        </div>
        <Tip>
          Queries used on Google to find competing articles. Top results will be analyzed to extract
          insights and strengthen your draft.
        </Tip>
        <div className="space-y-2">
          <AnimatePresence>
            {form.search_keywords.map((kw, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={kw}
                  onChange={(e) => updateKeyword(i, e.target.value)}
                  placeholder="e.g. best online casino reviews"
                  className={inputClass}
                  disabled={isGenerating}
                />
                <motion.button
                  type="button"
                  onClick={() => removeKeyword(i)}
                  disabled={form.search_keywords.length <= 1 || isGenerating}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ×
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div>
          <label className={labelClass}>Search Country</label>
          <select
            value={form.search_country}
            onChange={(e) =>
              setForm((f) => ({ ...f, search_country: e.target.value }))
            }
            className={inputClass}
            disabled={isGenerating}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Search Language</label>
          <select
            value={form.search_language}
            onChange={(e) =>
              setForm((f) => ({ ...f, search_language: e.target.value }))
            }
            className={inputClass}
            disabled={isGenerating}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Article Language</label>
          <select
            value={form.article_language}
            onChange={(e) =>
              setForm((f) => ({ ...f, article_language: e.target.value }))
            }
            className={inputClass}
            disabled={isGenerating}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Output Format</label>
          <select
            value={form.output_format}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                output_format: e.target.value as "markdown" | "html",
              }))
            }
            className={inputClass}
            disabled={isGenerating}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Sitemap URL (optional, for internal links)</label>
        <input
          type="url"
          value={form.sitemap_url}
          onChange={(e) =>
            setForm((f) => ({ ...f, sitemap_url: e.target.value }))
          }
          placeholder="https://example.com/sitemap.xml"
          className={inputClass}
          disabled={isGenerating}
        />
      </div>

      <motion.button
        type="submit"
        disabled={isGenerating}
        whileHover={{ scale: isGenerating ? 1 : 1.02 }}
        whileTap={{ scale: isGenerating ? 1 : 0.98 }}
        className="w-full rounded-xl bg-violet-600 px-8 py-4 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isGenerating ? "Generating..." : "Generate Article"}
      </motion.button>
    </motion.form>
  );
}
