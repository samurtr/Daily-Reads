import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ArticleProgress, ArticleResult } from "../article-events";
import {
  ArticleNotesSchema,
  ResearchSchema,
  type ArticleRequest,
  type Research,
} from "../schemas";
import { countWords, stripLeadingTitle } from "../text";
import type { Source } from "../types";
import { assertNotRefused, finalText, LARGE_MODEL, SMALL_MODEL, withClaude } from "./client";
import { notesPrompt, researchPrompt, writePrompt } from "./prompts";

const MIN_WORDS = 800;
const MAX_WORDS = 1300;
const MAX_RESEARCH_TURNS = 6;

type Report = (progress: ArticleProgress) => void;

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

/** Step A — research with web search (max ~5 searches), reporting what it finds. */
async function runResearch(
  client: Anthropic,
  req: ArticleRequest,
  report: Report,
  signal: AbortSignal,
): Promise<Research> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: researchPrompt(req) }];
  const found = new Map<string, Source>();

  for (let turn = 0; turn < MAX_RESEARCH_TURNS; turn++) {
    const stream = client.messages.stream(
      {
        model: LARGE_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
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
        report({ type: "found", pages: [...found.values()] });
      }
    }

    const message = await stream.finalMessage();
    assertNotRefused(message);
    if (message.stop_reason === "pause_turn") {
      // The API paused a long search turn: send it back unchanged to continue.
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    return parseResearch(finalText(message));
  }
  throw new Error("Research did not finish");
}

/** Step B — write from the research notes only (no tools), streaming the Markdown body. */
async function writeArticle(
  client: Anthropic,
  req: ArticleRequest,
  research: Research,
  report: Report,
  signal: AbortSignal,
  previousWordCount?: number,
): Promise<string> {
  const stream = client.messages.stream(
    {
      model: LARGE_MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: writePrompt(req, research, previousWordCount) }],
    },
    { signal },
  );
  stream.on("text", (text) => report({ type: "delta", text }));
  const message = await stream.finalMessage();
  assertNotRefused(message);
  return stripLeadingTitle(finalText(message));
}

/** Follow-up call: 1-sentence summary and short style note for later profile updates. */
async function makeNotes(
  client: Anthropic,
  req: ArticleRequest,
  body: string,
  signal: AbortSignal,
): Promise<{ summary: string; style_note: string }> {
  try {
    const response = await client.messages.parse(
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

/** Prompt 2: research the title, then write the article from the research notes. */
export function generateArticle(
  req: ArticleRequest,
  report: Report,
  signal: AbortSignal,
): Promise<ArticleResult> {
  return withClaude(async (client) => {
    report({ type: "status", stage: "researching" });
    const research = await runResearch(client, req, report, signal);
    const sources = realSources(research);

    // If the verdict is not ok, nothing is written.
    if (research.verdict !== "ok") {
      return { type: "unverified", verdict: research.verdict };
    }
    if (research.facts.length === 0 || sources.length === 0) {
      return { type: "unverified", verdict: "not_enough_sources" };
    }

    report({ type: "sources", sources });
    report({ type: "status", stage: "writing" });

    let markdown = await writeArticle(client, req, research, report, signal);
    let wordCount = countWords(markdown);
    // Accept 800–1,300 words; outside that, regenerate once (reusing the research).
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
      report({ type: "reset" });
      markdown = await writeArticle(client, req, research, report, signal, wordCount);
      wordCount = countWords(markdown);
    }

    const notes = await makeNotes(client, req, markdown, signal);
    return {
      type: "done",
      body_markdown: markdown,
      word_count: wordCount,
      summary: notes.summary,
      style_note: notes.style_note,
      sources,
      research,
    };
  });
}
