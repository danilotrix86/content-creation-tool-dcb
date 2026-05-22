import OpenAI from "openai";
import { imagePrompt, inlineImagePrompt } from "./prompts";

/**
 * GPT Image 2 — latest generation model on the Image API (`/v1/images/generations`).
 * @see https://developers.openai.com/api/docs/guides/image-generation
 * GPT Image models return base64 by default; do not pass `response_format` (DALL·E only).
 */
const OPENAI_MODEL = "gpt-image-2";
const IMAGE_SIZE = "1536x1024";
const QUALITY = "high" as const;

export function createOpenAIImageClient(apiKey: string) {
  const client = new OpenAI({ apiKey });

  return {
    async generateFeaturedImage(
      slug: string,
      title: string,
      mainTopic: string
    ): Promise<string> {
      const response = await client.images.generate({
        model: OPENAI_MODEL,
        prompt: imagePrompt(title, mainTopic),
        size: IMAGE_SIZE,
        quality: QUALITY,
        output_format: "png",
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data from OpenAI");
      return `data:image/png;base64,${b64}`;
    },

    async generateInlineImage(
      slug: string,
      sectionTitle: string,
      mainTopic: string,
      index: number
    ): Promise<string> {
      const response = await client.images.generate({
        model: OPENAI_MODEL,
        prompt: inlineImagePrompt(sectionTitle, mainTopic),
        size: IMAGE_SIZE,
        quality: QUALITY,
        output_format: "png",
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data from OpenAI");
      return `data:image/png;base64,${b64}`;
    },
  };
}
