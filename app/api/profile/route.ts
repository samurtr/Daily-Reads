import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ProfileRequestSchema,
  ProfileSchema,
  type ProfileRequest,
  type ProfileResponse,
} from "@/lib/schemas";
import { checkPasscode } from "@/lib/server/auth";
import { anthropic, assertNotRefused, errorResponse, SMALL_MODEL } from "@/lib/server/anthropic";
import { profilePrompt } from "@/lib/server/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  let body: ProfileRequest;
  try {
    body = ProfileRequestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const response = await anthropic().messages.parse(
      {
        model: SMALL_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: profilePrompt(body) }],
        output_config: { format: zodOutputFormat(ProfileSchema) },
      },
      { signal: req.signal },
    );
    assertNotRefused(response);
    if (!response.parsed_output) throw new Error("The model returned no profile");
    const result: ProfileResponse = { profile: response.parsed_output };
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
