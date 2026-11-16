import type { Research } from "./schemas";
import type { Source } from "./types";

/** Events streamed by POST /api/article, one JSON object per line. */
export type ArticleEvent =
  | { type: "status"; stage: "researching" | "writing" }
  /** Pages the research has turned up so far. */
  | { type: "found"; pages: Source[] }
  /** The final, numbered sources list from the research JSON. */
  | { type: "sources"; sources: Source[] }
  /** A piece of the Markdown body. */
  | { type: "delta"; text: string }
  /** The draft was too short or too long and is being rewritten: discard the body so far. */
  | { type: "reset" }
  | {
      type: "done";
      body_markdown: string;
      word_count: number;
      summary: string;
      style_note: string;
      sources: Source[];
      research: Research;
    }
  /** Research says the premise is false or found too few sources: nothing was written. */
  | { type: "unverified"; verdict: Research["verdict"] }
  | { type: "error"; code: string };
