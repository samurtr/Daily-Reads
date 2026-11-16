import { getPasscode, requestPasscode } from "./passcode";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = "failed";
  try {
    const data = await res.json();
    if (typeof data?.error === "string") code = data.error;
  } catch {
    // Not a JSON error body; keep the generic code.
  }
  return new ApiError(res.status, code);
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * POSTs JSON to one of the app's API routes with the remembered passcode.
 * If the server rejects the passcode, asks for it and tries again.
 */
export async function apiFetch(
  path: string,
  body: unknown,
  { signal, timeoutMs }: RequestOptions = {},
): Promise<Response> {
  while (true) {
    const passcode = getPasscode();
    const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter(
      (s): s is AbortSignal => s !== undefined,
    );
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-passcode": encodeURIComponent(passcode ?? ""),
      },
      body: JSON.stringify(body),
      signal: signals.length ? AbortSignal.any(signals) : undefined,
    });
    if (res.status === 401) {
      await requestPasscode(passcode !== null);
      continue;
    }
    if (!res.ok) throw await toApiError(res);
    return res;
  }
}

export async function postJSON<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  const res = await apiFetch(path, body, options);
  return res.json() as Promise<T>;
}

export function codeMessage(code: string): string {
  if (code === "refused") return "Couldn't write about that, pick another.";
  if (code === "rate_limited") return "The AI is busy right now. Please try again in a moment.";
  if (code === "not_configured") return "The server is missing its APP_PASSCODE setting.";
  return "Something went wrong. Please try again.";
}

/** A friendly, user-facing message for a failed request. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return codeMessage(err.code);
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "That took too long. Please try again.";
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. Connect to the internet and try again.";
  }
  return codeMessage("failed");
}
