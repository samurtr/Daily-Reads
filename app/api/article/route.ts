import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ArticleEvent } from "@/lib/article-events";
import {
  ArticleNotesSchema,
  ArticleRequestSchema,
  ResearchSchema,
  type ArticleRequest,
  type Research,
} from "@/lib/schemas";
import {
  anthropic,
  assertNotRefused,
  errorCode,
  finalText,
  LARGE_MODEL,
  SMALL_MODEL,
} from "@/lib/server/anthropic";
import { checkPasscode } from "@/lib/server/auth";
import { notesPrompt, researchPrompt, writePrompt } from "@/lib/server/prompts";
import { countWords, stripLeadingTitle } from "@/lib/text";
import type { Source } from "@/lib/types";

export const maxDuration = 300;

const MIN_WORDS = 800;
const MAX_WORDS = 1300;
const MAX_RESEARCH_TURNS = 6;

type Send = (event: ArticleEvent) => void;

function parseResearch(text: string): Research {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const braces = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  for (const candidate of [text, fenced, braces]) {
    if (!candidate) continue;
    try {
      return ResearchSchema.parse(JSON.parse(candidate));
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("Research did not return valid JSON");
}

/** Step A — research with web search (max ~5 searches), streaming what it finds. */
async function runResearch(req: ArticleRequest, send: Send, signal: AbortSignal): Promise<Research> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: researchPrompt(req) }];
  const found = new Map<string, Source>();

  for (let turn = 0; turn < MAX_RESEARCH_TURNS; turn++) {
    const stream = anthropic().messages.stream(
      {
        model: LARGE_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      },
      { signal },
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_start" &&
        event.content_block.type === "web_search_tool_result" &&
        Array.isArray(event.content_block.content)
      ) {
        for (const result of event.content_block.content) {
          if (!found.has(result.url)) {
            found.set(result.url, { title: result.title, url: result.url });
          }
        }
        send({ type: "found", pages: [...found.values()] });
      }
    }

    const message = await stream.finalMessage();
    assertNotRefused(message);
    if (message.stop_reason === "pause_turn") {
      // The server paused a long search turn: send it back unchanged to continue.
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    return parseResearch(finalText(message));
  }
  throw new Error("Research did not finish");
}

/** Step B — write from the research notes only (no tools), streaming the Markdown body. */
async function writeArticle(
  req: ArticleRequest,
  research: Research,
  send: Send,
  signal: AbortSignal,
  previousWordCount?: number,
): Promise<string> {
  const stream = anthropic().messages.stream(
    {
      model: LARGE_MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: writePrompt(req, research, previousWordCount) }],
    },
    { signal },
  );
  stream.on("text", (text) => send({ type: "delta", text }));
  const message = await stream.finalMessage();
  assertNotRefused(message);
  return stripLeadingTitle(finalText(message));
}

/** Follow-up call: 1-sentence summary and short style note for later profile updates. */
async function makeNotes(
  req: ArticleRequest,
  body: string,
  signal: AbortSignal,
): Promise<{ summary: string; style_note: string }> {
  try {
    const response = await anthropic().messages.parse(
      {
        model: SMALL_MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: notesPrompt(req.title, body) }],
        output_config: { format: zodOutputFormat(ArticleNotesSchema) },
      },
      { signal },
    );
    if (response.parsed_output) return response.parsed_output;
  } catch (err) {
    if (signal.aborted) throw err;
    console.error("Summary and style note failed:", err);
  }
  // The article itself is fine; fall back to the teaser rather than lose it.
  return { summary: req.teaser, style_note: "" };
}

function realSources(research: Research): Source[] {
  return research.sources
    .filter((s) => /^https?:\/\//i.test(s.url))
    .map((s) => ({ title: s.title, url: s.url }));
}

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  let body: ArticleRequest;
  try {
    body = ArticleRequestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reader went away; the abort signal stops the remaining work.
        }
      };

      try {
        send({ type: "status", stage: "researching" });
        const research = await runResearch(body, send, signal);
        const sources = realSources(research);

        // If the verdict is not ok, nothing is written.
        if (research.verdict !== "ok") {
          send({ type: "unverified", verdict: research.verdict });
          return;
        }
        if (research.facts.length === 0 || sources.length === 0) {
          send({ type: "unverified", verdict: "not_enough_sources" });
          return;
        }

        send({ type: "sources", sources });
        send({ type: "status", stage: "writing" });

        let markdown = await writeArticle(body, research, send, signal);
        let wordCount = countWords(markdown);
        // Accept 800–1,300 words; outside that, regenerate once (reusing the research).
        if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
          send({ type: "reset" });
          markdown = await writeArticle(body, research, send, signal, wordCount);
          wordCount = countWords(markdown);
        }

        const notes = await makeNotes(body, markdown, signal);
        send({
          type: "done",
          body_markdown: markdown,
          word_count: wordCount,
          summary: notes.summary,
          style_note: notes.style_note,
          sources,
          research,
        });
      } catch (err) {
        if (!signal.aborted) {
          console.error("Article generation failed:", err);
          send({ type: "error", code: errorCode(err) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
