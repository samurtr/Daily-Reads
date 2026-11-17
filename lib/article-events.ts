import type { FactCheck, Source } from "./types";

/** Progress reported while an article is written. */
export type ArticleProgress =
  /** "checking" only when the title's claim wasn't confirmed yet. */
  | { type: "status"; stage: "checking" | "writing" }
  /** The numbered sources list: the search results the fact check confirmed the claim from. */
  | { type: "sources"; sources: Source[] }
  /** A piece of the Markdown body. */
  | { type: "delta"; text: string }
  /** The draft was too short or too long and is being rewritten: discard the body so far. */
  | { type: "reset" };

/** How an article generation ended. */
export type ArticleResult =
  | {
      type: "done";
      body_markdown: string;
      word_count: number;
      summary: string;
      style_note: string;
      sources: Source[];
      fact_check: FactCheck;
    }
  /** The fact check couldn't confirm the title's claim from a real source: nothing was written. */
  | { type: "unverified" };
