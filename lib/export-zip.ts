import JSZip from "jszip";
import type { ArticleResult } from "@/lib/pipeline/types";

const DATA_URL_IMG = /!\[([^\]]*)\]\((data:image\/(\w+);base64,[^)]+)\)/g;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const m = dataUrl.match(/^data:image\/(\w+);base64,([\s\S]+)$/);
  if (!m) throw new Error("Invalid image data URL");
  const b64 = m[2].replace(/\s/g, "");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function mimeSubtypeToFileExt(subtype: string): string {
  if (subtype === "jpeg") return "jpg";
  return subtype;
}

/**
 * Rewrites markdown `![alt](data:image/...)` to `![alt](images/inline-N.ext)` and
 * collects binary payload for each file.
 */
export function rewriteMarkdownDataImages(md: string): {
  markdown: string;
  imageFiles: { zipPath: string; dataUrl: string }[];
} {
  const imageFiles: { zipPath: string; dataUrl: string }[] = [];
  let n = 0;
  const markdown = md.replace(
    DATA_URL_IMG,
    (_full, alt: string, dataUrl: string, subtype: string) => {
      n += 1;
      const ext = mimeSubtypeToFileExt(subtype);
      const zipPath = `images/inline-${n}.${ext}`;
      imageFiles.push({ zipPath, dataUrl });
      const safeAlt = String(alt).replace(/\]/g, "");
      return `![${safeAlt}](${zipPath})`;
    }
  );
  return { markdown, imageFiles };
}

function safeBundleBasename(slug: string): string {
  const s = slug.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
  return s || "article";
}

/**
 * ZIP with markdown (relative image paths), `images/*` assets, and a small manifest.
 */
export async function buildArticleBundleZip(result: ArticleResult): Promise<Blob> {
  const zip = new JSZip();
  const base = safeBundleBasename(result.slug);
  const sourceMd = result.content_markdown ?? result.content;

  const { markdown: bodyRewritten, imageFiles: inlineImages } =
    rewriteMarkdownDataImages(sourceMd);

  let header = `# ${result.title.replace(/^#\s*/, "").trim()}\n\n`;
  if (result.excerpt?.trim()) {
    header += `*${result.excerpt.trim()}*\n\n`;
  }

  zip.file(`${base}.md`, header + bodyRewritten);

  for (const { zipPath, dataUrl } of inlineImages) {
    zip.file(zipPath, dataUrlToBytes(dataUrl));
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        title: result.title,
        slug: result.slug,
        meta_title: result.meta_title,
        meta_description: result.meta_description,
        word_count: result.word_count,
        reading_time: result.reading_time,
        category_name: result.category_name,
        files: {
          article: `${base}.md`,
          inline_count: inlineImages.length,
        },
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: "blob" });
}
