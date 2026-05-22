import MarkdownIt from "markdown-it";
import { convertMarkdownToDocx } from "@mohtasham/md-to-docx";

const md = new MarkdownIt({ html: true });

export async function exportToDocx(markdown: string): Promise<Blob> {
  return convertMarkdownToDocx(markdown);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getPrintableHtml(
  title: string,
  content: string,
  metaTitle: string,
  metaDescription: string,
  readingTime: number,
  isMarkdown = true
): string {
  const htmlContent = isMarkdown ? md.render(content) : content;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDescription}">
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; }
    h3 { font-size: 1.2rem; margin-top: 1.5rem; }
    p { margin: 1rem 0; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    img { max-width: 100%; height: auto; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    @media print { body { padding: 1rem; } }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    <p class="meta">${readingTime} min read</p>
    <div class="content">${htmlContent}</div>
  </article>
</body>
</html>`;
}
