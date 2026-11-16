import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Article,
  DailyBatch,
  Setting,
  TasteProfileRow,
  TitleIdea,
  Topic,
} from "./types";

class DailyReadsDB extends Dexie {
  topics!: EntityTable<Topic, "id">;
  daily_batches!: EntityTable<DailyBatch, "id">;
  title_ideas!: EntityTable<TitleIdea, "id">;
  articles!: EntityTable<Article, "id">;
  taste_profile!: Table<TasteProfileRow, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super("daily-reads");
    this.version(1).stores({
      topics: "++id",
      daily_batches: "++id, &date",
      title_ideas: "++id, batch_id, created_at",
      articles: "++id, &title_idea_id, saved_at",
      taste_profile: "id",
      settings: "key",
    });
  }
}

export const db = new DailyReadsDB();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
