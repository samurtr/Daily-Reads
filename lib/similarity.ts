const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "by", "for", "from", "how", "in", "is", "it", "its",
  "of", "on", "that", "the", "this", "to", "was", "were", "what", "when", "who", "why", "with",
]);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w)),
  );
}

/** True when two titles share most of their significant words (Jaccard similarity ≥ 0.6). */
export function isTooSimilar(a: string, b: string): boolean {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / (wordsA.size + wordsB.size - shared) >= 0.6;
}
