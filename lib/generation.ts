import { apiFetch, codeMessage, errorMessage } from "./api";
import type { ArticleEvent } from "./article-events";
import { db } from "./db";
import { defaultProfile, likedExcerpts } from "./profile";
import type { ArticleRequest } from "./schemas";
import type { Source, TitleIdea } from "./types";

/**
 * In-progress article generations, kept outside React so a generation survives
 * navigating back to Today and is never started twice for the same title.
 */
export interface Generation {
  stage: "researching" | "writing" | "done" | "unverified" | "error";
  startedAt: number;
  /** Pages found so far during research. */
  found: Source[];
  /** The final sources list, once research has finished. */
  sources: Source[] | null;
  /** The Markdown body streamed so far. */
  body: string;
  /** User-facing message when stage is "error". */
  message?: string;
}

const generations = new Map<number, Generation>();
const controllers = new Map<number, AbortController>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function update(id: number, patch: Partial<Generation>) {
  const current = generations.get(id);
  if (!current) return;
  generations.set(id, { ...current, ...patch });
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGeneration(id: number): Generation | undefined {
  return generations.get(id);
}

/** Stops a running generation and forgets it. */
export function cancelGeneration(id: number) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  generations.delete(id);
  notify();
}

async function buildRequest(idea: TitleIdea): Promise<ArticleRequest> {
  const profile =
    (await db.taste_profile.get(1))?.profile_json ??
    defaultProfile((await db.topics.toArray()).map((t) => t.name));
  return {
    title: idea.title,
    teaser: idea.teaser,
    angle: idea.angle,
    types: idea.types,
    style: profile.style,
    excerpts: await likedExcerpts(),
  };
}

async function saveArticle(idea: TitleIdea, event: Extract<ArticleEvent, { type: "done" }>) {
  await db.transaction("rw", db.articles, db.title_ideas, async () => {
    const existing = await db.articles.where("title_idea_id").equals(idea.id).first();
    if (!existing) {
      await db.articles.add({
        title_idea_id: idea.id,
        title: idea.title,
        topic: idea.topic,
        types: idea.types,
        body_markdown: event.body_markdown,
        word_count: event.word_count,
        summary: event.summary,
        style_note: event.style_note,
        research_json: event.research,
        sources: event.sources,
        feedback: null,
        saved_at: null,
        created_at: Date.now(),
      });
    }
    await db.title_ideas.update(idea.id, { status: "opened" });
  });
}

async function run(idea: TitleIdea, signal: AbortSignal) {
  const res = await apiFetch("/api/article", await buildRequest(idea), { signal });
  if (!res.body) throw new Error("The article response had no body");

  let finished = false;
  const handle = async (event: ArticleEvent) => {
    switch (event.type) {
      case "status":
        update(idea.id, { stage: event.stage });
        break;
      case "found":
        update(idea.id, { found: event.pages });
        break;
      case "sources":
        update(idea.id, { sources: event.sources });
        break;
      case "delta":
        update(idea.id, { body: (generations.get(idea.id)?.body ?? "") + event.text });
        break;
      case "reset":
        update(idea.id, { body: "" });
        break;
      case "done":
        // Cache first, so re-opening the article costs nothing.
        await saveArticle(idea, event);
        update(idea.id, { stage: "done", body: event.body_markdown, sources: event.sources });
        finished = true;
        break;
      case "unverified":
        update(idea.id, { stage: "unverified" });
        finished = true;
        break;
      case "error":
        update(idea.id, { stage: "error", message: codeMessage(event.code) });
        finished = true;
        break;
    }
  };

  // The response is newline-delimited JSON.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) await handle(JSON.parse(line) as ArticleEvent);
    }
  }
  if (!finished) throw new Error("The article stream ended early");
}

/** Starts researching and writing the article for a title, unless that is already running. */
export function startGeneration(idea: TitleIdea) {
  if (controllers.has(idea.id)) return;
  const controller = new AbortController();
  controllers.set(idea.id, controller);
  generations.set(idea.id, {
    stage: "researching",
    startedAt: Date.now(),
    found: [],
    sources: null,
    body: "",
  });
  notify();

  run(idea, controller.signal)
    .catch((err) => {
      if (controller.signal.aborted) return;
      update(idea.id, { stage: "error", message: errorMessage(err) });
    })
    .finally(() => {
      if (controllers.get(idea.id) === controller) controllers.delete(idea.id);
    });
}
