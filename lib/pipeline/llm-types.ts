import type {
  ArticleOutline,
  ArticleStrategy,
  ArticleType,
  InternalLink,
  KeywordIntent,
  Section,
  TopicInsights,
} from "./types";

/** Text / JSON generation for the article pipeline (Gemini or OpenAI). */
export type PipelineLlm = {
  generateTopicInsights(
    scrapedContent: string,
    mainTopic: string,
    keyword: string,
    articleLanguage: string
  ): Promise<TopicInsights>;

  deriveArticleStrategy(
    mainTopic: string,
    keyword: string,
    searchKeywords: string[],
    articleType: ArticleType,
    topicInsights: TopicInsights | null,
    contentBrief: string
  ): Promise<ArticleStrategy>;

  generateOutline(
    mainTopic: string,
    keyword: string,
    topicInsights: TopicInsights | null,
    articleLanguage: string,
    contentBrief: string,
    articleType: ArticleType,
    strategy: ArticleStrategy
  ): Promise<ArticleOutline>;

  generateSectionsMarkdown(
    batch: Section[],
    remaining: Section[],
    mainTopic: string,
    keyword: string,
    articleLanguage: string,
    contentBrief: string,
    availableLinks: InternalLink[] | null,
    lsiKeywords: string[] | null,
    previousContent: string,
    articleType: ArticleType,
    keywordIntent: KeywordIntent
  ): Promise<string>;

  generateMeta(
    title: string,
    excerpt: string,
    keyword: string,
    articleLanguage: string
  ): Promise<{ meta_title: string; meta_description: string }>;

  generateAltText(
    title: string,
    keyword: string,
    lsiKeywords: string[] | null,
    articleLanguage: string
  ): Promise<string>;

  pickSectionsForImages(
    sections: Section[],
    mainTopic: string,
    count: number
  ): Promise<number[]>;
};
