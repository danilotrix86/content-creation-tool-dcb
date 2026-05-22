import OpenAI from "openai";
import { inlineImagePrompt } from "./prompts";
import { pipelineDetail } from "./pipeline-log";
import { DEFAULT_OPENAI_IMAGE_MODEL } from "./llm-provider";

const IMAGE_SIZE = "1536x1024";
const QUALITY = "high" as const;

/**
 * GPT Image 2 — latest generation model on the Image API (`/v1/images/generations`).
 * @see https://developers.openai.com/api/docs/guides/image-generation
 * GPT Image models return base64 by default; do not pass `response_format` (DALL·E only).
 */
export function createOpenAIImageClient(
  apiKey: string,
  imageModel: string = DEFAULT_OPENAI_IMAGE_MODEL
) {
  const client = new OpenAI({ apiKey });

  return {
    async generateInlineImage(
      slug: string,
      sectionTitle: string,
      mainTopic: string,
      index: number
    ): Promise<string> {
      pipelineDetail("Inline image", {
        model: imageModel,
        operation: "generateInlineImage",
        section: sectionTitle,
        index,
        slug,
        mainTopic,
      });
      const response = await client.images.generate({
        model: imageModel,
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
