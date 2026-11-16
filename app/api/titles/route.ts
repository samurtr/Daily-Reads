import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  IdeasSchema,
  TitlesRequestSchema,
  type Idea,
  type TitlesRequest,
  type TitlesResponse,
} from "@/lib/schemas";
import {
  anthropic,
  assertNotRefused,
  errorResponse,
  finalText,
  SMALL_MODEL,
} from "@/lib/server/anthropic";
import { checkPasscode } from "@/lib/server/auth";
import { factCheckPrompt, replacementTitlePrompt, titlesPrompt } from "@/lib/server/prompts";

export const maxDuration = 60;

async function generateIdeas(prompt: string, count: number, signal: AbortSignal): Promise<Idea[]> {
  const response = await anthropic().messages.parse(
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
async function isConfirmed(idea: Idea, signal: AbortSignal): Promise<boolean> {
  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: factCheckPrompt(idea) }];
    let response: Anthropic.Message;
    let continuations = 0;
    while (true) {
      response = await anthropic().messages.create(
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

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  let body: TitlesRequest;
  try {
    body = TitlesRequestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { drawn_topics, profile, recent_titles, date } = body;

  try {
    const prompt = titlesPrompt(drawn_topics, profile, recent_titles, date);
    let ideas = await generateIdeas(prompt, 5, req.signal);
    // At least 3 different article types must appear across the 5 titles.
    if (distinctTypes(ideas) < 3) {
      ideas = await generateIdeas(prompt, 5, req.signal);
    }

    // Quick fact check, 1 search per title; an unconfirmed title is regenerated once.
    const firstDraft = ideas;
    const checked = await Promise.all(
      firstDraft.map(async (idea, i) => {
        if (await isConfirmed(idea, req.signal)) return idea;
        try {
          const [replacement] = await generateIdeas(
            replacementTitlePrompt(
              drawn_topics[i],
              profile,
              [...recent_titles, ...firstDraft.map((d) => d.title)],
              idea.title,
              date,
            ),
            1,
            req.signal,
          );
          return replacement;
        } catch (err) {
          if (req.signal.aborted) throw err;
          console.error("Title regeneration failed:", err);
          return idea;
        }
      }),
    );

    const response: TitlesResponse = {
      // Topics and exploration flags come from the app's own draw, not from the AI.
      ideas: checked.map((idea, i) => ({
        ...idea,
        topic: drawn_topics[i].topic,
        is_exploration: drawn_topics[i].is_exploration,
      })),
    };
    return Response.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
