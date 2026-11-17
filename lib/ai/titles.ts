import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IdeasSchema, type Idea, type TitlesRequest, type TitlesResponse } from "../schemas";
import { assertNotRefused, finalText, SMALL_MODEL, withClaude } from "./client";
import { factCheckPrompt, replacementTitlePrompt, titlesPrompt } from "./prompts";

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

/** One web search with the small model. Only a clear "unconfirmed" counts against a title. */
async function isConfirmed(client: Anthropic, idea: Idea, signal: AbortSignal): Promise<boolean> {
  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: factCheckPrompt(idea) }];
    let response: Anthropic.Message;
    let continuations = 0;
    while (true) {
      response = await client.messages.create(
        {
          model: SMALL_MODEL,
          max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
          messages,
        },
        { signal },
      );
      if (response.stop_reason !== "pause_turn" || continuations++ >= 2) break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (response.stop_reason === "refusal") return false;
    const verdict = /VERDICT:\s*(CONFIRMED|UNCONFIRMED)/i.exec(finalText(response));
    return verdict?.[1].toUpperCase() === "CONFIRMED";
  } catch (err) {
    if (signal.aborted) throw err;
    // The check itself failed (network, rate limit): keep the title rather than lose the set.
    console.error("Title fact check failed:", err);
    return true;
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
    const firstDraft = ideas;
    const checked = await Promise.all(
      firstDraft.map(async (idea, i) => {
        if (await isConfirmed(client, idea, signal)) return idea;
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
          return replacement;
        } catch (err) {
          if (signal.aborted) throw err;
          console.error("Title regeneration failed:", err);
          return idea;
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
