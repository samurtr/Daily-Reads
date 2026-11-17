import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ArticleProgress, ArticleResult } from "../article-events";
import { ArticleNotesSchema, type ArticleRequest } from "../schemas";
import { countWords, stripLeadingTitle } from "../text";
import type { FactCheck } from "../types";
import { assertNotRefused, finalText, LARGE_MODEL, SMALL_MODEL, withClaude } from "./client";
import { factCheck } from "./factCheck";
import { notesPrompt, writePrompt } from "./prompts";

const MIN_WORDS = 800;
const MAX_WORDS = 1300;

type Report = (progress: ArticleProgress) => void;

/** Write from the title's fact check (no tools), streaming the Markdown body. */
async function writeArticle(
  client: Anthropic,
  req: ArticleRequest,
  check: FactCheck,
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
      messages: [{ role: "user", content: writePrompt(req, check, previousWordCount) }],
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

/**
 * Prompt 2: write the article from the title's fact check. A title whose claim
 * wasn't confirmed when the titles were made is checked now (one web search).
 */
export function generateArticle(
  req: ArticleRequest,
  report: Report,
  signal: AbortSignal,
): Promise<ArticleResult> {
  return withClaude(async (client) => {
    let check = req.fact_check;
    if (!check) {
      report({ type: "status", stage: "checking" });
      check = await factCheck(client, req, signal);
      // Not confirmed from a real source: nothing is written.
      if (!check) return { type: "unverified" };
    }

    report({ type: "sources", sources: check.sources });
    report({ type: "status", stage: "writing" });

    let markdown = await writeArticle(client, req, check, report, signal);
    let wordCount = countWords(markdown);
    // Accept 800–1,300 words; outside that, regenerate once.
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
      report({ type: "reset" });
      markdown = await writeArticle(client, req, check, report, signal, wordCount);
      wordCount = countWords(markdown);
    }

    const notes = await makeNotes(client, req, markdown, signal);
    return {
      type: "done",
      body_markdown: markdown,
      word_count: wordCount,
      summary: notes.summary,
      style_note: notes.style_note,
      sources: check.sources,
      fact_check: check,
    };
  });
}
