import type { z } from "zod";
import type {
  ArticleRequest,
  DrawnTopicSchema,
  Idea,
  ProfileRequest,
  ProfileSchema,
  Research,
} from "../schemas";

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

/** Quick fact check of one title (small model, one web search). */
export function factCheckPrompt(idea: Idea): string {
  return `Fact-check the core claim behind this article idea with one web search.

Title: "${idea.title}"
Teaser: ${idea.teaser}
Angle: ${idea.angle}

Then answer in one short sentence, followed by a final line that is exactly "VERDICT: CONFIRMED" if reliable search results support the core claim, or "VERDICT: UNCONFIRMED" if they contradict it or you could not confirm it.`;
}

/** Prompt 2, step A — research (web search enabled). */
export function researchPrompt(req: ArticleRequest): string {
  return `Research the article "${req.title}" (${req.teaser}). Angle: ${req.angle}. Article type(s): ${req.types.join(", ")}.

Use web search to find 3–6 reliable sources (encyclopedias, universities, museums, reputable news outlets, original papers; avoid content farms).

Return JSON: {"verdict": "ok" | "premise_false" | "not_enough_sources", "facts": [{"claim", "source_ids", "confidence": "high" | "disputed"}], "sources": [{"id", "title", "url"}], "corrected_angle" (only if the title's premise needs adjusting)}. Only include claims that a source supports.

Reply with the JSON object only.`;
}

/** Prompt 2, step B — write (no tools; streams to the screen). */
export function writePrompt(
  req: ArticleRequest,
  research: Research,
  previousWordCount?: number,
): string {
  const notes = JSON.stringify({
    facts: research.facts,
    ...(research.corrected_angle ? { corrected_angle: research.corrected_angle } : {}),
  });
  const excerpts = req.excerpts.length
    ? req.excerpts.map((e, i) => `Example ${i + 1}:\n${e}`).join("\n\n")
    : "(none yet)";
  const lengthNote = previousWordCount
    ? `\n\nYour previous draft was ${previousWordCount} words. This one must be 900–1,150 words.`
    : "";

  return `Write a 900–1,150 word article in English titled "${req.title}", using only the facts in these research notes:
${notes}

Do not add names, dates or numbers that are not in the notes; if a fact is marked disputed, say so in the text.

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
