import Anthropic from "@anthropic-ai/sdk";
import { clearApiKey, getApiKey, MissingApiKeyError, requestApiKey } from "../apiKey";

/** Article writing. */
export const LARGE_MODEL = "claude-haiku-5-5";
/** Titles, title fact checks, summaries and profile updates. */
export const SMALL_MODEL = "claude-haiku-5-5";

let cached: { key: string; client: Anthropic } | null = null;

function clientFor(key: string): Anthropic {
  if (cached?.key !== key) {
    cached = {
      key,
      // The app has no server: it calls Claude straight from the browser with the
      // user's own key, which never leaves this device except to go to Anthropic.
      client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }),
    };
  }
  return cached.client;
}

/**
 * Runs `task` with a Claude client built from the saved API key. With no key
 * saved, or when Anthropic rejects the key, asks the user for one and tries
 * again. With `prompt: false` it throws MissingApiKeyError instead of asking.
 */
export async function withClaude<T>(
  task: (client: Anthropic) => Promise<T>,
  { prompt = true }: { prompt?: boolean } = {},
): Promise<T> {
  let rejected = false;
  while (true) {
    const key = getApiKey();
    if (!key) {
      if (!prompt) throw new MissingApiKeyError();
      await requestApiKey(rejected);
      continue;
    }
    try {
      return await task(clientFor(key));
    } catch (err) {
      if (!(err instanceof Anthropic.AuthenticationError)) throw err;
      // Only forget the key if it is still the one that was just rejected.
      if (getApiKey() === key) clearApiKey();
      if (!prompt) throw new MissingApiKeyError();
      rejected = true;
    }
  }
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

/** The message from an Anthropic error body, e.g. "Your credit balance is too low…". */
function apiErrorDetail(err: InstanceType<typeof Anthropic.APIError>): string | null {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  return typeof body?.error?.message === "string" ? body.error.message : null;
}

/** A friendly, user-facing message for a failed generation. */
export function errorMessage(err: unknown): string {
  if (err instanceof MissingApiKeyError) {
    return "Add your Anthropic API key to generate titles and articles.";
  }
  if (err instanceof RefusalError) return "Couldn't write about that, pick another.";
  // Generations are only aborted by their timeout (a cancelled article is never reported).
  if (err instanceof Anthropic.APIUserAbortError) {
    return "That took too long. Please try again.";
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. Connect to the internet and try again.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The AI is busy right now. Please try again in a moment.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "Your API key isn't allowed to do this. Check it in the Claude Console.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Anthropic. Check your connection and try again.";
  }
  if (err instanceof Anthropic.APIError) {
    const detail = apiErrorDetail(err);
    if (detail) return `Something went wrong: ${detail}`;
  }
  return "Something went wrong. Please try again.";
}
