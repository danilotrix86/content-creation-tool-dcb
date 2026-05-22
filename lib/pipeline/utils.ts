const WORDS_PER_MINUTE = 210;

export function countWords(text: string): number {
  let cleaned = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}|_{1,3}|~~|`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/^\s*[-*+>|]\s*/gm, "");
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function calculateReadingTime(
  wordCount: number,
  wpm: number = WORDS_PER_MINUTE
): number {
  return Math.ceil(wordCount / wpm);
}
