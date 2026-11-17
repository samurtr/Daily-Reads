import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ProfileSchema, type ProfileRequest } from "../schemas";
import type { TasteProfile } from "../types";
import { assertNotRefused, SMALL_MODEL, withClaude } from "./client";
import { profilePrompt } from "./prompts";

/**
 * Rebuilds the taste profile from recent feedback. Runs in the background, so it
 * never asks for an API key: without one it throws and the next feedback retries.
 */
export function updateProfile(request: ProfileRequest): Promise<TasteProfile> {
  return withClaude(
    async (client) => {
      const response = await client.messages.parse({
        model: SMALL_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: profilePrompt(request) }],
        output_config: { format: zodOutputFormat(ProfileSchema) },
      });
      assertNotRefused(response);
      if (!response.parsed_output) throw new Error("The model returned no profile");
      return response.parsed_output;
    },
    { prompt: false },
  );
}
