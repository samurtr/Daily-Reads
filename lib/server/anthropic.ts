import Anthropic from "@anthropic-ai/sdk";

/** Research and article writing. */
export const LARGE_MODEL = "claude-opus-5-5";
/** Titles, title fact checks, summaries and profile updates. */
export const SMALL_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;

/** Reads ANTHROPIC_API_KEY from the server environment; the key never reaches the browser. */
export function anthropic(): Anthropic {
  return (client ??= new Anthropic());
}

/** The model declined the request (e.g. an offensive or unsafe topic). */
export class RefusalError extends Error {
  constructor() {
    super("The model declined this request");
  }
}

export function assertNotRefused(message: { stop_reason: string | null }): void {
  if (message.stop_reason === "refusal") throw new RefusalError();
}

/** The text Claude wrote after its last tool call (or all of its text when no tools ran). */
export function finalText(message: Anthropic.Message): string {
  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
    else if (block.type !== "thinking" && block.type !== "redacted_thinking") text = "";
  }
  return text.trim();
}

export type ErrorCode = "refused" | "rate_limited" | "failed";

export function errorCode(err: unknown): ErrorCode {
  if (err instanceof RefusalError) return "refused";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  return "failed";
}

export function errorResponse(err: unknown): Response {
  if (err instanceof RefusalError) {
    return Response.json({ error: "refused" }, { status: 422 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Claude API error ${err.status}:`, err.message);
    return Response.json({ error: "failed" }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: "failed" }, { status: 500 });
}
