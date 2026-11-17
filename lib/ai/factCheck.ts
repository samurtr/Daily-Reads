import type Anthropic from "@anthropic-ai/sdk";
import type { FactCheck, Source } from "../types";
import { finalText, SMALL_MODEL } from "./client";
import { factCheckPrompt, type FactCheckInput } from "./prompts";

const MAX_SOURCES = 3;

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Reads the verdict, the confirmed claim and its sources from a fact-check reply. */
function readFactCheck(message: Anthropic.Message): FactCheck | null {
  // Every page the web search actually returned, and every page the reply cites.
  const results = new Map<string, Source>();
  const cited = new Map<string, Source>();
  for (const block of message.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        results.set(withoutTrailingSlash(result.url), { title: result.title, url: result.url });
      }
    } else if (block.type === "text") {
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location") {
          cited.set(withoutTrailingSlash(citation.url), {
            title: citation.title ?? citation.url,
            url: citation.url,
          });
        }
      }
    }
  }

  const text = finalText(message);
  const verdict = /^VERDICT:\s*(CONFIRMED|UNCONFIRMED)\s*$/im.exec(text)?.[1].toUpperCase();
  if (verdict !== "CONFIRMED") return null;

  // The source the model names must be a page the search really returned (or cited),
  // so the link is never made up.
  const named: Source[] = [];
  for (const match of text.matchAll(/^SOURCE:\s*<?(\S+?)>?[).,]*\s*$/gim)) {
    const key = withoutTrailingSlash(match[1]);
    const source = results.get(key) ?? cited.get(key);
    if (source && !named.some((s) => s.url === source.url)) named.push(source);
  }
  const sources = (named.length > 0 ? named : [...cited.values()]).slice(0, MAX_SOURCES);
  // A confirmation without a real source doesn't count.
  if (sources.length === 0) return null;

  const claim = text
    .split("\n")
    .filter((line) => !/^(SOURCE|VERDICT):/i.test(line.trim()))
    .join("\n")
    .trim();
  return { claim, sources };
}

/**
 * Checks a title's core claim with one web search (small model). Returns what was
 * confirmed and the search result(s) it was confirmed from, or null when the claim
 * couldn't be confirmed from a real source. API and network errors are thrown.
 */
export async function factCheck(
  client: Anthropic,
  idea: FactCheckInput,
  signal: AbortSignal,
): Promise<FactCheck | null> {
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
  if (response.stop_reason === "refusal") return null;
  return readFactCheck(response);
}
