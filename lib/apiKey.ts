/**
 * The user's own Anthropic API key. It is kept only in this browser's
 * localStorage on this device: it is never part of the app's code, never in a
 * JSON export, and only ever sent to api.anthropic.com.
 */
const KEY = "dr-anthropic-api-key";

/** The user closed the key prompt without entering a key. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("No Anthropic API key");
  }
}

/** The key prompt currently on screen, if any. */
export interface ApiKeyPromptState {
  /** True when Anthropic rejected the key that was saved. */
  rejected: boolean;
}

let prompt: ApiKeyPromptState | null = null;
let waiters: { resolve: () => void; reject: (err: Error) => void }[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeApiKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setApiKey(value: string) {
  try {
    localStorage.setItem(KEY, value.trim());
  } catch {
    // Storage unavailable (e.g. a private window that blocks it): nothing is saved.
  }
  notify();
}

export function clearApiKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  notify();
}

/** "sk-ant-…a1b2", for showing which key is saved without revealing it. */
export function maskApiKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : "••••";
}

/** Shows the key prompt and resolves once a key is saved, or rejects if the user cancels. */
export function requestApiKey(rejected: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    waiters.push({ resolve, reject });
    if (!prompt) {
      prompt = { rejected };
      notify();
    }
  });
}

/** Opens the key prompt from Settings, without anything waiting on it. */
export function openApiKeyPrompt() {
  if (!prompt) {
    prompt = { rejected: false };
    notify();
  }
}

export function submitApiKey(value: string) {
  setApiKey(value);
  prompt = null;
  const done = waiters;
  waiters = [];
  notify();
  for (const waiter of done) waiter.resolve();
}

export function cancelApiKeyPrompt() {
  prompt = null;
  const done = waiters;
  waiters = [];
  notify();
  for (const waiter of done) waiter.reject(new MissingApiKeyError());
}

export function getApiKeyPrompt(): ApiKeyPromptState | null {
  return prompt;
}
