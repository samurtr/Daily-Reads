import type { z } from "zod";
import type {
  ArticleRequest,
  DrawnTopicSchema,
  Idea,
  ProfileRequest,
  ProfileSchema,
} from "../schemas";
import type { FactCheck } from "../types";

type Profile = z.infer<typeof ProfileSchema>;
type DrawnTopic = z.infer<typeof DrawnTopicSchema>;

function topicList(topics: DrawnTopic[]): string {
  return topics
    .map((t, i) => `${i + 1}. ${t.topic} (${t.is_exploration ? "exploration" : "not exploration"})`)
    .join("\n");
}

function titleList(titles: string[]): string {
  return titles.length ? titles.map((t) => `- ${t}`).join("\n") : "(none yet)";
}

/** Prompt 1 — daily titles. */
export function titlesPrompt(
  topics: DrawnTopic[],
  profile: Profile,
  recentTitles: string[],
  date: string,
): string {
  return `You write titles for short, fascinating non-fiction articles in English. Write exactly one article idea for each of these 5 topics, in this order:
${topicList(topics)}

Each idea has one or more of these types: random_facts, should_know, understand_world, how_it_works. Use at least 3 different types across the 5 ideas.

Taste profile (use it for angles and style, never to change the topics):
${JSON.stringify(profile)}

Do not repeat or closely resemble:
${titleList(recentTitles)}

Each idea must be a specific, true, verifiable fact or story, not a vague theme. For exploration topics, pick an angle a newcomer can enjoy.

Today's date: ${date}

Return JSON in the same order: {"ideas": [{"title", "topic", "types", "teaser" (max 20 words), "angle"}]}.`;
}

/** Prompt 1, narrowed to one topic, for replacing a title whose claim could not be confirmed. */
export function replacementTitlePrompt(
  topic: DrawnTopic,
  profile: Profile,
  avoidTitles: string[],
  unconfirmedTitle: string,
  date: string,
): string {
  return `You write titles for short, fascinating non-fiction articles in English. Write exactly one article idea for this topic:
${topicList([topic])}

The idea has one or more of these types: random_facts, should_know, understand_world, how_it_works.

Taste profile (use it for angles and style, never to change the topic):
${JSON.stringify(profile)}

A fact check could not confirm the core claim of this earlier idea, so pick a different, well-documented fact or story: "${unconfirmedTitle}"

Do not repeat or closely resemble:
${titleList(avoidTitles)}

The idea must be a specific, true, verifiable fact or story, not a vague theme.${
    topic.is_exploration ? " This is an exploration topic: pick an angle a newcomer can enjoy." : ""
  }

Today's date: ${date}

Return JSON: {"ideas": [{"title", "topic", "types", "teaser" (max 20 words), "angle"}]} with exactly one idea.`;
}

export type FactCheckInput = Pick<Idea, "title" | "teaser" | "angle">;

/** Quick fact check of one title (small model, one web search). */
export function factCheckPrompt(idea: FactCheckInput): string {
  return `Fact-check the core claim behind this article idea with one web search.

Title: "${idea.title}"
Teaser: ${idea.teaser}
Angle: ${idea.angle}

Then reply in exactly this format:
- One or two sentences stating what the search results confirm about the core claim (or why they don't).
- A line "SOURCE: <url>" with the URL of the reliable search result that confirms the core claim. Leave this line out if no result confirms it.
- A final line that is exactly "VERDICT: CONFIRMED" if a reliable search result supports the core claim, or "VERDICT: UNCONFIRMED" if the results contradict it or you could not confirm it.`;
}

/** Prompt 2 — write from the title's fact check (no tools; streams to the screen). */
export function writePrompt(
  req: ArticleRequest,
  factCheck: FactCheck,
  previousWordCount?: number,
): string {
  const excerpts = req.excerpts.length
    ? req.excerpts.map((e, i) => `Example ${i + 1}:\n${e}`).join("\n\n")
    : "(none yet)";
  const lengthNote = previousWordCount
    ? `\n\nYour previous draft was ${previousWordCount} words. This one must be 900–1,150 words.`
    : "";

  return `Write a 900–1,150 word article in English titled "${req.title}". Angle: ${req.angle}

Its core claim was checked with a web search, which confirmed:
${factCheck.claim}

Build the article around this confirmed claim. Stick to well-established facts: leave out any name, date or number you are not sure of rather than guessing, and if a point is disputed, say so in the text.

Article type(s): ${req.types.join(", ")}. For random_facts, pack in surprising facts. For should_know, make clear why it matters in the reader's own life. For understand_world, connect it to the bigger picture. For how_it_works, explain the mechanism step by step with a simple analogy.

Match this reader's preferred style: ${JSON.stringify(req.style)}

Style examples of articles they loved:
${excerpts}

Requirements: start with a hook, use 2–4 subheadings in Markdown, end with a memorable takeaway. No preamble and no source list (the app adds it).${lengthNote}`;
}

/** Follow-up after writing: the summary and style note stored for later profile updates. */
export function notesPrompt(title: string, body: string): string {
  return `Here is an article titled "${title}":

${body}

Return JSON: {"summary": a 1-sentence summary of the article, "style_note": a short note on its tone, structure and depth}.`;
}

function feedbackList(items: ProfileRequest["recent_feedback"]["liked"]): string {
  return items.length
    ? items
        .map(
          (a) =>
            `- "${a.title}" (topic: ${a.topic}; types: ${a.types.join(", ")}). Summary: ${a.summary} Style: ${a.style_note}`,
        )
        .join("\n")
    : "(none)";
}

/** Taste profile update after a feedback event (small model). */
export function profilePrompt(req: ProfileRequest): string {
  const { liked, disliked, skipped_titles } = req.recent_feedback;
  return `Update the taste profile of a reader of short non-fiction articles, based on the articles they rated.

Current profile:
${JSON.stringify(req.current_profile)}

Articles they liked (thumbs up), most recent first:
${feedbackList(liked)}

Articles they disliked (thumbs down), most recent first:
${feedbackList(disliked)}

Titles they passed over when asking for other suggestions (a weak negative signal for style only, never for topics):
${titleList(skipped_titles)}

Return the updated profile as JSON with the same fields: {"favorite_topics", "liked_angles", "disliked_angles", "style": {"tone", "structure", "depth"}, "example_liked_titles"}. Derive it from the titles, summaries and style notes above. Keep it compact: short phrases, at most 8 entries per list, and up to 10 of the most recent liked titles in example_liked_titles.`;
}
