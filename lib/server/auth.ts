import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Protects an API route with the one passcode in APP_PASSCODE, so strangers who
 * find the URL can't spend API credits. Returns an error response, or null when
 * the request may proceed.
 */
export function checkPasscode(req: Request): Response | null {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    return Response.json({ error: "not_configured" }, { status: 500 });
  }
  let given = "";
  try {
    given = decodeURIComponent(req.headers.get("x-passcode") ?? "");
  } catch {
    // Malformed header: treated as a wrong passcode.
  }
  if (!timingSafeEqual(digest(given), digest(expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
