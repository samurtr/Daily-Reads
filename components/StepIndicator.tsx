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

/** Checking the facts… (only if not confirmed yet) → Confirmed by N sources → Writing… */
export default function StepIndicator({ generation }: { generation: Generation }) {
  const checking = generation.stage === "checking";
  const count = generation.sources?.length ?? 0;
  return (
    <ol className="space-y-2" aria-live="polite">
      <Step state={checking ? "active" : "done"}>
        {checking
          ? "Checking the facts…"
          : `Confirmed by ${count} ${count === 1 ? "source" : "sources"}`}
      </Step>
      <Step state={generation.stage === "writing" ? "active" : "pending"}>Writing…</Step>
    </ol>
  );
}
