export const ARTICLE_TYPES = [
  "random_facts",
  "should_know",
  "understand_world",
  "how_it_works",
] as const;

export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const TYPE_LABELS: Record<ArticleType, string> = {
  random_facts: "Random facts",
  should_know: "Should know",
  understand_world: "Understand the world",
  how_it_works: "How it works",
};

export interface Topic {
  id: number;
  name: string;
  is_active: boolean;
  created_at: number;
}

export interface DailyBatch {
  id: number;
  /** YYYY-MM-DD, local time */
  date: string;
  refresh_count: number;
  created_at: number;
}

export type TitleStatus = "shown" | "opened" | "skipped";

export interface TitleIdea {
  id: number;
  batch_id: number;
  title: string;
  topic: string;
  is_exploration: boolean;
  types: ArticleType[];
  teaser: string;
  angle: string;
  status: TitleStatus;
  created_at: number;
}

export interface Source {
  title: string;
  url: string;
}

export type Feedback = "up" | "down" | null;

export interface Article {
  id: number;
  title_idea_id: number;
  title: string;
  topic: string;
  types: ArticleType[];
  body_markdown: string;
  word_count: number;
  summary: string;
  style_note: string;
  research_json: unknown;
  sources: Source[];
  feedback: Feedback;
  saved_at: number | null;
  created_at: number;
}

export interface TasteProfile {
  favorite_topics: string[];
  liked_angles: string[];
  disliked_angles: string[];
  style: {
    tone: string;
    structure: string;
    depth: string;
  };
  example_liked_titles: string[];
}

export interface TasteProfileRow {
  id: 1;
  profile_json: TasteProfile;
  updated_at: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
