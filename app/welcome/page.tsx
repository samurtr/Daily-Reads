"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopicInput from "@/components/TopicInput";
import { db } from "@/lib/db";
import { defaultProfile } from "@/lib/profile";
import { MIN_TOPICS } from "@/lib/topics";

export default function WelcomePage() {
  const router = useRouter();
  const [topics, setTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ready = topics.length >= MIN_TOPICS;

  async function start() {
    if (!ready || saving) return;
    setSaving(true);
    const now = Date.now();
    await db.transaction("rw", db.topics, db.taste_profile, db.settings, async () => {
      await db.topics.clear();
      await db.topics.bulkAdd(
        topics.map((name) => ({ name, is_active: true, created_at: now })),
      );
      await db.taste_profile.put({
        id: 1,
        profile_json: defaultProfile(topics),
        updated_at: now,
      });
      await db.settings.put({ key: "onboarding_done", value: true });
    });
    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pt-16 pb-10">
      <h1 className="font-serif text-4xl font-semibold">Daily Reads</h1>
      <p className="mt-3 font-serif text-xl text-muted">
        Five fresh article ideas every day, written for you the moment you tap one.
      </p>

      <h2 className="mt-12 text-sm font-semibold tracking-wide text-muted uppercase">
        Your topics
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Type the topics you want to read about. Add at least {MIN_TOPICS}.
      </p>

      <TopicInput existing={topics} onAdd={(name) => setTopics((t) => [...t, name])} />

      {topics.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li
              key={topic}
              className="flex items-center gap-1 rounded-full bg-accent py-1.5 pr-1.5 pl-3.5 text-sm text-accent-fg"
            >
              {topic}
              <button
                type="button"
                aria-label={`Remove ${topic}`}
                onClick={() => setTopics((t) => t.filter((x) => x !== topic))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-10">
        <button
          type="button"
          disabled={!ready || saving}
          onClick={start}
          className="w-full rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-accent-fg disabled:opacity-40"
        >
          Start reading
        </button>
        {!ready && (
          <p className="mt-3 text-center text-sm text-muted">
            {topics.length} of {MIN_TOPICS} topics added
          </p>
        )}
      </div>
    </main>
  );
}
