"use client";

import { useState } from "react";
import { MAX_TOPIC_LENGTH, SUGGESTED_TOPICS, validateTopic } from "@/lib/topics";

/** Free-text topic input plus optional suggestion chips. */
export default function TopicInput({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(name: string) {
    const problem = validateTopic(name, existing);
    if (problem) {
      setError(problem);
      return;
    }
    onAdd(name.trim());
    setValue("");
    setError(null);
  }

  const taken = new Set(existing.map((t) => t.toLowerCase()));
  const suggestions = SUGGESTED_TOPICS.filter((s) => !taken.has(s.toLowerCase()));

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(value);
        }}
      >
        <input
          type="text"
          value={value}
          maxLength={MAX_TOPIC_LENGTH}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Type a topic, e.g. Volcanoes"
          aria-label="Topic"
          className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium"
        >
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
