import type {
  ArticleStrategy,
  ArticleType,
  KeywordIntent,
  TopicInsights,
} from "./types";

export function cleanJson(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/g, "")
    .trim();
}

const VALID_INTENTS: KeywordIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

export const ARTICLE_TYPE_SECTION_DEFAULTS: Record<
  ArticleType,
  { min: number; max: number }
> = {
  informational: { min: 14, max: 18 },
  how_to: { min: 8, max: 12 },
  commercial: { min: 8, max: 12 },
  transactional: { min: 6, max: 10 },
  listicle: { min: 10, max: 15 },
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeKeywordIntent(value: unknown): KeywordIntent {
  if (typeof value === "string" && VALID_INTENTS.includes(value as KeywordIntent)) {
    return value as KeywordIntent;
  }
  return "informational";
}

export function parseTopicInsights(raw: string): TopicInsights {
  try {
    const data = JSON.parse(cleanJson(raw)) as Record<string, unknown>;
    const structures = Array.isArray(data.competitor_structures)
      ? data.competitor_structures.map((item) => {
          const s = item as Record<string, unknown>;
          return {
            url: typeof s.url === "string" ? s.url : undefined,
            approximate_h2_count:
              typeof s.approximate_h2_count === "number"
                ? s.approximate_h2_count
                : 0,
            approximate_h3_count:
              typeof s.approximate_h3_count === "number"
                ? s.approximate_h3_count
                : 0,
            section_types: normalizeStringArray(s.section_types),
            format_notes:
              typeof s.format_notes === "string" ? s.format_notes : "",
          };
        })
      : [];

    return {
      must_have_points: normalizeStringArray(data.must_have_points),
      effective_angles: normalizeStringArray(data.effective_angles),
      topic_specific_information:
        typeof data.topic_specific_information === "string"
          ? data.topic_specific_information
          : "",
      content_gaps: normalizeStringArray(data.content_gaps),
      competitor_structures: structures,
      serp_format_consensus:
        typeof data.serp_format_consensus === "string"
          ? data.serp_format_consensus
          : "",
    };
  } catch {
    return {
      must_have_points: [],
      effective_angles: [],
      topic_specific_information: raw,
      content_gaps: [],
      competitor_structures: [],
      serp_format_consensus: "",
      raw_fallback: raw,
    };
  }
}

export function parseArticleStrategy(
  raw: string,
  articleType: ArticleType
): ArticleStrategy {
  const defaults = defaultArticleStrategy(articleType);
  try {
    const data = JSON.parse(cleanJson(raw)) as Record<string, unknown>;
    const competitorRange = data.competitor_section_range as
      | Record<string, unknown>
      | undefined;
    const recommendedRange = data.recommended_section_range as
      | Record<string, unknown>
      | undefined;

    return {
      keyword_intent: normalizeKeywordIntent(data.keyword_intent),
      intent_rationale:
        typeof data.intent_rationale === "string"
          ? data.intent_rationale
          : defaults.intent_rationale,
      competitor_section_range: {
        min:
          typeof competitorRange?.min === "number"
            ? competitorRange.min
            : defaults.competitor_section_range.min,
        max:
          typeof competitorRange?.max === "number"
            ? competitorRange.max
            : defaults.competitor_section_range.max,
        avg:
          typeof competitorRange?.avg === "number"
            ? competitorRange.avg
            : defaults.competitor_section_range.avg,
      },
      serp_format_consensus:
        typeof data.serp_format_consensus === "string"
          ? data.serp_format_consensus
          : defaults.serp_format_consensus,
      recommended_section_range: {
        min:
          typeof recommendedRange?.min === "number"
            ? recommendedRange.min
            : defaults.recommended_section_range.min,
        max:
          typeof recommendedRange?.max === "number"
            ? recommendedRange.max
            : defaults.recommended_section_range.max,
      },
      structure_notes:
        typeof data.structure_notes === "string"
          ? data.structure_notes
          : defaults.structure_notes,
    };
  } catch {
    return defaults;
  }
}

export function defaultArticleStrategy(articleType: ArticleType): ArticleStrategy {
  const range = ARTICLE_TYPE_SECTION_DEFAULTS[articleType];
  const avg = Math.round((range.min + range.max) / 2);
  return {
    keyword_intent: "informational",
    intent_rationale: "Default strategy (no LLM analysis available).",
    competitor_section_range: { min: range.min, max: range.max, avg },
    serp_format_consensus: "Unknown — using article-type defaults.",
    recommended_section_range: { min: range.min, max: range.max },
    structure_notes: `Default ${articleType} structure with ${range.min}-${range.max} H2 sections.`,
  };
}

export function formatTopicInsightsForPrompt(
  insights: TopicInsights | null
): string | null {
  if (!insights) return null;
  if (insights.raw_fallback) return insights.raw_fallback;

  const structures = insights.competitor_structures
    .map((s, i) => {
      const url = s.url ? ` (${s.url})` : "";
      return `  ${i + 1}. ~${s.approximate_h2_count} H2s, ~${s.approximate_h3_count} H3s${url}
     Section types: ${s.section_types.join(", ") || "n/a"}
     Notes: ${s.format_notes || "n/a"}`;
    })
    .join("\n");

  return [
    "Must-have points:",
    ...insights.must_have_points.map((p) => `- ${p}`),
    "",
    "Effective angles:",
    ...insights.effective_angles.map((p) => `- ${p}`),
    "",
    "Topic-specific information:",
    insights.topic_specific_information,
    "",
    "Content gaps to exploit:",
    ...insights.content_gaps.map((p) => `- ${p}`),
    "",
    "SERP format consensus:",
    insights.serp_format_consensus || "Not determined",
    "",
    "Competitor structure patterns:",
    structures || "  (none extracted)",
  ].join("\n");
}

export function articleTypeLabel(articleType: ArticleType): string {
  const labels: Record<ArticleType, string> = {
    informational: "Informational / pillar guide",
    how_to: "How-to / tutorial",
    commercial: "Commercial investigation",
    transactional: "Transactional / product",
    listicle: "Listicle",
  };
  return labels[articleType];
}
