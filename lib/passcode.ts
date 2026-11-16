const KEY = "dr-passcode";

/** The passcode prompt currently on screen, if any. */
export interface PasscodePromptState {
  /** True when a passcode was already sent and the server rejected it. */
  rejected: boolean;
}

let prompt: PasscodePromptState | null = null;
let waiters: (() => void)[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** The passcode is entered once and remembered in the browser. */
export function getPasscode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPasscode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

/** Shows the passcode prompt and resolves once the user has entered one. */
export function requestPasscode(rejected: boolean): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (!prompt) {
      prompt = { rejected };
      notify();
    }
  });
}

export function submitPasscode(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Storage unavailable: the passcode simply won't be remembered.
  }
  prompt = null;
  const resolved = waiters;
  waiters = [];
  notify();
  for (const resolve of resolved) resolve();
}

export function subscribePrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPrompt(): PasscodePromptState | null {
  return prompt;
}
