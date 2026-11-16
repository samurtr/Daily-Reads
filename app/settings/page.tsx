"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import TabBar from "@/components/TabBar";
import TopicInput from "@/components/TopicInput";
import { effectiveTheme, type FontSize, type Theme } from "@/lib/appearance";
import { clearAllData, downloadExport, importData } from "@/lib/backup";
import { db, getSetting, setSetting } from "@/lib/db";
import { resetProfile, syncDefaultProfile } from "@/lib/profile";
import { MAX_TOPICS, MIN_TOPICS } from "@/lib/topics";
import type { Topic } from "@/lib/types";

export default function SettingsPage() {
  return (
    <>
      <main className="mx-auto max-w-xl px-5 pt-10 pb-28">
        <h1 className="font-serif text-3xl font-semibold">Settings</h1>
        <TopicsSection />
        <TasteProfileSection />
        <AppearanceSection />
        <DataSection />
      </main>
      <TabBar />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TopicsSection() {
  const topics = useLiveQuery(() => db.topics.orderBy("id").toArray());
  if (!topics) return <Section title="Topics">{null}</Section>;

  const activeCount = topics.filter((t) => t.is_active).length;
  // At least 4 topics must stay active.
  const atMinimum = activeCount <= MIN_TOPICS;

  async function add(name: string) {
    await db.topics.add({ name, is_active: true, created_at: Date.now() });
    await syncDefaultProfile();
  }

  async function toggle(topic: Topic) {
    if (topic.is_active && atMinimum) return;
    await db.topics.update(topic.id, { is_active: !topic.is_active });
    await syncDefaultProfile();
  }

  async function remove(topic: Topic) {
    if (topic.is_active && atMinimum) return;
    await db.topics.delete(topic.id);
    await syncDefaultProfile();
  }

  return (
    <Section title="Topics">
      <p className="mb-4 text-sm text-muted">
        Four of your active topics are drawn at random each day. Keep at least {MIN_TOPICS}{" "}
        active (up to {MAX_TOPICS} in total).
      </p>
      <TopicInput existing={topics.map((t) => t.name)} onAdd={add} />

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
        {topics.map((topic) => {
          const locked = topic.is_active && atMinimum;
          return (
            <li key={topic.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <label className="flex min-w-0 flex-1 items-center gap-3 py-1.5">
                <input
                  type="checkbox"
                  checked={topic.is_active}
                  disabled={locked}
                  onChange={() => toggle(topic)}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
                <span className={`truncate ${topic.is_active ? "" : "text-muted line-through"}`}>
                  {topic.name}
                </span>
              </label>
              <button
                type="button"
                aria-label={`Remove ${topic.name}`}
                disabled={locked}
                onClick={() => remove(topic)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-muted disabled:opacity-30"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {atMinimum && (
        <p className="mt-3 text-sm text-muted">
          You need at least {MIN_TOPICS} active topics. Add another before turning one off or
          removing it.
        </p>
      )}
    </Section>
  );
}

function TasteProfileSection() {
  const [done, setDone] = useState(false);

  async function reset() {
    if (!window.confirm("Reset your taste profile? Your Library is kept.")) return;
    await resetProfile();
    setDone(true);
  }

  return (
    <Section title="Taste profile">
      <p className="mb-4 text-sm text-muted">
        Your thumbs up and down shape the angles and writing style of future articles. They never
        change which topics are drawn.
      </p>
      <ActionButton onClick={reset}>Reset taste profile</ActionButton>
      {done && (
        <p className="mt-3 text-sm text-muted" role="status">
          Taste profile reset.
        </p>
      )}
    </Section>
  );
}

function AppearanceSection() {
  const appearance = useLiveQuery(async () => ({
    theme: await getSetting<Theme>("theme"),
    fontSize: await getSetting<FontSize>("font_size"),
  }));
  if (!appearance) return <Section title="Appearance">{null}</Section>;

  const theme = effectiveTheme(appearance.theme);
  const fontSize = appearance.fontSize ?? "medium";

  return (
    <Section title="Appearance">
      <Choice
        label="Theme"
        value={theme}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(value) => setSetting("theme", value)}
      />
      <div className="mt-5">
        <Choice
          label="Font size"
          value={fontSize}
          options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
          onChange={(value) => setSetting("font_size", value)}
        />
      </div>
    </Section>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex rounded-full border border-border bg-card p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${
              value === option.value ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DataSection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (!window.confirm("Importing replaces everything currently stored in this browser. Continue?")) {
      return;
    }
    try {
      await importData(await file.text());
      // Start from a clean page so nothing from before the import lingers.
      window.location.href = "/";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The import failed.");
    }
  }

  async function onClear() {
    if (!window.confirm("Delete all topics, titles, articles and settings from this browser?")) {
      return;
    }
    await clearAllData();
    window.location.href = "/";
  }

  return (
    <Section title="Data">
      <p className="mb-4 text-sm text-muted">
        Everything is stored in this browser only. Export a JSON backup now and then: if the
        browser&apos;s data is cleared, the Library is gone.
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => downloadExport()}>Export data</ActionButton>
        <ActionButton onClick={() => fileInput.current?.click()}>Import data</ActionButton>
        <ActionButton danger onClick={onClear}>
          Clear all data
        </ActionButton>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {message}
        </p>
      )}
    </Section>
  );
}

function ActionButton({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-medium ${
        danger ? "border-danger text-danger" : "border-border bg-card"
      }`}
    >
      {children}
    </button>
  );
}
