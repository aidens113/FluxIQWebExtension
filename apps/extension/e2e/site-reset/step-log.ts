import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { JsonObject } from "fluxiq/core";

/**
 * One completed folder of Core's step log (`FLUXIQ_LLM_STEP_LOG_DIR`, Core
 * `runtime/llm/step-log/index.ts`): its number, its kind (`tool-<toolId>`,
 * `judge`, `reset`, `offline`, ...), its `meta.json`, and a tool folder's
 * `result.json` (the evidence the model was shown). A folder without
 * `meta.json` is incomplete and left out. Read by the offline-first specs to
 * tell an offline check, a site reset and a live trial apart; a spec prints
 * names, codes and counts from it, never page data or typed values.
 */
export type LoggedStep = { name: string; number: number; kind: string; meta: JsonObject; result?: JsonObject };

const FOLDER = /^(\d{4})-(.+)$/u;

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

async function readJson(file: string): Promise<JsonObject | undefined> {
  try {
    return record(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return undefined;
  }
}

/** Every completed step folder under `directory`, in step order. */
export async function readStepLog(directory: string): Promise<LoggedStep[]> {
  const names = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory() && FOLDER.test(entry.name)).map(entry => entry.name).sort();
  const steps: LoggedStep[] = [];
  for (const name of names) {
    const meta = await readJson(path.join(directory, name, "meta.json"));
    if (!meta) continue;
    const [, number, kind] = FOLDER.exec(name)!;
    const result = await readJson(path.join(directory, name, "result.json"));
    steps.push({ name, number: Number(number), kind: kind!, meta, ...(result ? { result } : {}) });
  }
  return steps;
}
