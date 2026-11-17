import { FONT_MIRROR_KEY, THEME_MIRROR_KEY } from "./appearance";
import { localDate } from "./date";
import { db } from "./db";
import { clearApiKey } from "./apiKey";

const TABLES = [
  "topics",
  "daily_batches",
  "title_ideas",
  "articles",
  "taste_profile",
  "settings",
] as const;

interface Backup {
  app: "daily-reads";
  version: 1;
  exported_at: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

/** Everything stored in the browser, as one JSON document. */
export async function exportData(): Promise<string> {
  const data = {} as Backup["data"];
  for (const name of TABLES) data[name] = await db.table(name).toArray();
  const backup: Backup = {
    app: "daily-reads",
    version: 1,
    exported_at: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export async function downloadExport(): Promise<void> {
  const blob = new Blob([await exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-reads-${localDate()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isBackup(value: unknown): value is Backup {
  if (typeof value !== "object" || value === null) return false;
  const backup = value as Partial<Backup>;
  return (
    backup.app === "daily-reads" &&
    backup.version === 1 &&
    typeof backup.data === "object" &&
    backup.data !== null &&
    TABLES.every((name) => Array.isArray(backup.data![name]))
  );
}

/** Replaces everything in the browser with the contents of an exported file. */
export async function importData(json: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isBackup(parsed)) throw new Error("That file isn't a Daily Reads export.");
  const { data } = parsed;
  await db.transaction("rw", db.tables, async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(data[name]);
    }
  });
}

/** Removes everything the app has stored in this browser. */
export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const name of TABLES) await db.table(name).clear();
  });
  clearApiKey();
  try {
    localStorage.removeItem(THEME_MIRROR_KEY);
    localStorage.removeItem(FONT_MIRROR_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
