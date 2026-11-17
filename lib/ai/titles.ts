import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IdeasSchema, type Idea, type TitlesRequest, type TitlesResponse } from "../schemas";
import type { FactCheck } from "../types";
import { assertNotRefused, SMALL_MODEL, withClaude } from "./client";
import { factCheck } from "./factCheck";
import { replacementTitlePrompt, titlesPrompt } from "./prompts";

async function generateIdeas(
  client: Anthropic,
  prompt: string,
  count: number,
  signal: AbortSignal,
): Promise<Idea[]> {
  const response = await client.messages.parse(
    {
      model: SMALL_MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(IdeasSchema) },
    },
    { signal },
  );
  assertNotRefused(response);
  const ideas = response.parsed_output?.ideas;
  if (!ideas || ideas.length !== count || ideas.some((i) => i.types.length === 0)) {
    throw new Error("The model returned an unexpected set of title ideas");
  }
  return ideas;
}

function distinctTypes(ideas: Idea[]): number {
  return new Set(ideas.flatMap((i) => i.types)).size;
}

/**
 * Fact check with one web search. A failed check (network, rate limit) keeps the
 * title unchecked rather than losing the set: it is checked again when opened.
 */
async function check(
  client: Anthropic,
  idea: Idea,
  signal: AbortSignal,
): Promise<FactCheck | null | "failed"> {
  try {
    return await factCheck(client, idea, signal);
  } catch (err) {
    if (signal.aborted || err instanceof Anthropic.AuthenticationError) throw err;
    console.error("Title fact check failed:", err);
    return "failed";
  }
}

/**
 * Prompt 1: one fact-checked title idea for each of the 5 drawn topics.
 * The timeout starts once a key is available, so time spent entering one doesn't count.
 */
export function generateTitles(
  request: TitlesRequest,
  timeoutMs: number,
): Promise<TitlesResponse["ideas"]> {
  const { drawn_topics, profile, recent_titles, date } = request;

  return withClaude(async (client) => {
    const signal = AbortSignal.timeout(timeoutMs);
    const prompt = titlesPrompt(drawn_topics, profile, recent_titles, date);
    let ideas = await generateIdeas(client, prompt, 5, signal);
    // At least 3 different article types must appear across the 5 titles.
    if (distinctTypes(ideas) < 3) {
      ideas = await generateIdeas(client, prompt, 5, signal);
    }

    // Quick fact check, 1 search per title; an unconfirmed title is regenerated once.
    // A confirmed check keeps its claim and sources: the article is written from them.
    const firstDraft = ideas;
    const checked = await Promise.all(
      firstDraft.map(async (idea, i): Promise<Idea & { fact_check: FactCheck | null }> => {
        const result = await check(client, idea, signal);
        if (result === "failed") return { ...idea, fact_check: null };
        if (result) return { ...idea, fact_check: result };
        try {
          const [replacement] = await generateIdeas(
            client,
            replacementTitlePrompt(
              drawn_topics[i],
              profile,
              [...recent_titles, ...firstDraft.map((d) => d.title)],
              idea.title,
              date,
            ),
            1,
            signal,
          );
          // The replacement isn't checked now; it is checked when opened.
          return { ...replacement, fact_check: null };
        } catch (err) {
          if (signal.aborted) throw err;
          console.error("Title regeneration failed:", err);
          return { ...idea, fact_check: null };
        }
      }),
    );

    // Topics and exploration flags come from the app's own draw, not from the AI.
    return checked.map((idea, i) => ({
      ...idea,
      topic: drawn_topics[i].topic,
      is_exploration: drawn_topics[i].is_exploration,
    }));
  });
}
