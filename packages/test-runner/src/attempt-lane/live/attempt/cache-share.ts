import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** How much of an attempt's input the model service read from its cache, from what each model step's `meta.json` recorded. */
export type AttemptCacheShare = {
  inputTokens: number;
  readTokens: number;
  writtenTokens: number;
  /** Whole percent of `inputTokens` that were reads; `null` when no step recorded any input. */
  hitPercent: number | null;
};

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

async function stepFolders(stepsDirectory: string): Promise<string[]> {
  try {
    return (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

/** A step's recorded usage. A step that wrote no meta, or whose meta a stopped run cut short, recorded none. */
async function usageOf(folder: string): Promise<Record<string, unknown> | undefined> {
  let raw: string;
  try {
    raw = await readFile(path.join(folder, "meta.json"), "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  try {
    return (JSON.parse(raw) as { usage?: Record<string, unknown> | null }).usage ?? undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/**
 * Summed over the run's step folders, so it reads what the service reported on
 * every call, a judge's and the chat's included, rather than an account of Core's.
 * `skip` leaves out the first folders in name order, which is the order they were
 * logged in: what the attempts before this one in the same run wrote.
 */
export async function attemptCacheShare(stepsDirectory: string, skip = 0): Promise<AttemptCacheShare> {
  const totals = { inputTokens: 0, readTokens: 0, writtenTokens: 0 };
  for (const folder of (await stepFolders(stepsDirectory)).sort().slice(skip)) {
    const usage = await usageOf(path.join(stepsDirectory, folder));
    totals.inputTokens += count(usage?.inputTokens);
    totals.readTokens += count(usage?.cacheHitInputTokens);
    totals.writtenTokens += count(usage?.cacheWriteInputTokens);
  }
  return { ...totals, hitPercent: totals.inputTokens > 0 ? Math.round((100 * totals.readTokens) / totals.inputTokens) : null };
}
