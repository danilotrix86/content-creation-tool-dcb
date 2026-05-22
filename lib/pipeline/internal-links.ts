import type { InternalLink } from "./types";

export function getUsedUrls(markdown: string, links: InternalLink[]): Set<string> {
  const used = new Set<string>();
  const linkRegex = /\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(markdown)) !== null) {
    const target = m[1].trim();
    for (const link of links) {
      const url = link.url;
      if (!url) continue;
      if (target === url || url.includes(target) || target.includes(url)) {
        used.add(url);
        break;
      }
      try {
        const path = new URL(url).pathname;
        if (path && (path.includes(target) || target.includes(path))) {
          used.add(url);
          break;
        }
      } catch {
        // ignore
      }
    }
  }
  return used;
}

export function getAvailableLinks(
  accumulated: string,
  links: InternalLink[]
): InternalLink[] {
  if (!accumulated || !links.length) return [...links];
  const used = getUsedUrls(accumulated, links);
  return links.filter((l) => !used.has(l.url));
}
