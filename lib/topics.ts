export const MAX_TOPIC_LENGTH = 40;
export const MIN_TOPICS = 4;
export const MAX_TOPICS = 30;

export const SUGGESTED_TOPICS = [
  "Space",
  "Psychology",
  "History",
  "Inventions",
  "Nature",
  "Technology",
  "Health",
  "Economics",
];

/** Returns an error message, or null when the topic can be added. */
export function validateTopic(name: string, existing: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Type a topic first.";
  if (trimmed.length > MAX_TOPIC_LENGTH) {
    return `Topics can be at most ${MAX_TOPIC_LENGTH} characters.`;
  }
  if (existing.length >= MAX_TOPICS) {
    return `You can have up to ${MAX_TOPICS} topics.`;
  }
  if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return "You already have that topic.";
  }
  return null;
}
