const WORDS_PER_MINUTE = 230;

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#]/g, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

/** Estimated read time in minutes: words ÷ 230 wpm. */
export function readMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

/** The screen shows the title itself, so drop a leading "# Title" line if the model wrote one. */
export function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^\s*#\s+[^\n]*\n+/, "").trim();
}

/** The first `maxWords` words of an article, as a style example. */
export function excerpt(markdown: string, maxWords: number): string {
  const words = markdown.trim().split(/\s+/);
  return words.length <= maxWords ? words.join(" ") : `${words.slice(0, maxWords).join(" ")}…`;
}
