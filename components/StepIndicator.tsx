import type { Generation } from "@/lib/generation";

type StepState = "pending" | "active" | "done";

function Step({ state, children }: { state: StepState; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-2.5 text-sm ${
        state === "pending" ? "text-muted opacity-50" : state === "active" ? "text-fg" : "text-muted"
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          state === "active" ? "animate-pulse bg-accent" : state === "done" ? "bg-accent" : "bg-border"
        }`}
        aria-hidden="true"
      />
      {children}
    </li>
  );
}

/** Researching… → N sources found… → Writing… */
export default function StepIndicator({ generation }: { generation: Generation }) {
  const researching = generation.stage === "researching";
  const count = generation.sources?.length ?? null;
  return (
    <ol className="space-y-2" aria-live="polite">
      <Step state={researching && count === null ? "active" : "done"}>Researching…</Step>
      <Step state={count === null ? "pending" : "done"}>
        {count === null ? "Sources" : `${count} ${count === 1 ? "source" : "sources"} found…`}
      </Step>
      <Step state={generation.stage === "writing" ? "active" : "pending"}>Writing…</Step>
    </ol>
  );
}
