"use client";

import { useState, useSyncExternalStore } from "react";
import { getPrompt, submitPasscode, subscribePrompt } from "@/lib/passcode";

/** Asks for the app passcode the first time the server requires it. */
export default function PasscodePrompt() {
  const prompt = useSyncExternalStore(subscribePrompt, getPrompt, () => null);
  const [value, setValue] = useState("");

  if (!prompt) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-border bg-bg p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value) return;
          submitPasscode(value);
          setValue("");
        }}
      >
        <h2 id="passcode-title" className="font-serif text-xl font-semibold">
          Enter passcode
        </h2>
        <p className="mt-2 text-sm text-muted">
          {prompt.rejected
            ? "That passcode didn't work. Try again."
            : "This app is private. Enter the passcode once and it will be remembered."}
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="current-password"
          aria-label="Passcode"
          className="mt-4 w-full rounded-full border border-border bg-card px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!value}
          className="mt-4 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
