"use client";

import { useState, useSyncExternalStore } from "react";
import {
  cancelApiKeyPrompt,
  getApiKeyPrompt,
  submitApiKey,
  subscribeApiKey,
} from "@/lib/apiKey";

/** Asks for the user's own Anthropic API key when one is needed and none is saved. */
export default function ApiKeyPrompt() {
  const prompt = useSyncExternalStore(subscribeApiKey, getApiKeyPrompt, () => null);
  const [value, setValue] = useState("");

  if (!prompt) return null;
  const key = value.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-border bg-bg p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!key) return;
          submitApiKey(key);
          setValue("");
        }}
      >
        <h2 id="api-key-title" className="font-serif text-xl font-semibold">
          Your Anthropic API key
        </h2>
        <p className="mt-2 text-sm text-muted">
          {prompt.rejected
            ? "Anthropic didn't accept that key. Check it and try again."
            : "Daily Reads writes your articles with Claude, using your own API key."}
        </p>
        <p className="mt-2 text-sm text-muted">
          It&apos;s saved only in this browser on this device and is sent only to Anthropic.
          Create one in the{" "}
          <a
            href="https://platform.claude.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            Claude Console
          </a>
          .
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          aria-label="Anthropic API key"
          className="mt-4 w-full rounded-full border border-border bg-card px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              cancelApiKeyPrompt();
              setValue("");
            }}
            className="flex-1 rounded-full border border-border px-5 py-2.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!key}
            className="flex-1 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            Save key
          </button>
        </div>
      </form>
    </div>
  );
}
