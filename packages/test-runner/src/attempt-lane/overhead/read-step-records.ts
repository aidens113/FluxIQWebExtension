import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { StepRecord } from "./step-record.js";

const isMissing = (error: unknown): boolean => error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";

/** A step file's JSON, or `undefined` when the folder has no such file (a step folder is complete only once it holds `meta.json`). Any other failure, such as a file that is not JSON, is raised. */
async function jsonOf(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  return JSON.parse(text);
}

const objectOf = (value: unknown): Record<string, unknown> => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** The `from` of a `core.run_flow` decision, which only its `decision.json` holds. */
async function runFromOf(folder: string): Promise<number | null> {
  const from = objectOf(objectOf(objectOf(objectOf(await jsonOf(path.join(folder, "decision.json"))).response).decision).input).from;
  return typeof from === "number" ? from : null;
}

/** A run's step folders as records in step order. A folder with no `meta.json` is not complete and is left out; a run with no `steps/` folder has no records. */
export async function readStepRecords(stepsDirectory: string): Promise<StepRecord[]> {
  let names: string[];
  try {
    names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const records: StepRecord[] = [];
  for (const name of names) {
    const folder = path.join(stepsDirectory, name);
    const meta = objectOf(await jsonOf(path.join(folder, "meta.json")));
    const kind = textOf(meta.kind);
    if (kind === null || typeof meta.step !== "number") continue;
    const summary = textOf(meta.summary) ?? "";
    const call = kind === "tool" ? objectOf(await jsonOf(path.join(folder, "call.json"))) : {};
    const locationAfter = kind === "tool" ? textOf(objectOf(await jsonOf(path.join(folder, "result.json"))).location) : null;
    records.push({
      step: meta.step, kind, toolId: textOf(meta.toolId), resultCode: textOf(meta.resultCode), summary,
      callId: textOf(call.callId), callInput: call.input, locationAfter,
      runFrom: kind === "decide" && summary === "tool_call core.run_flow" ? await runFromOf(folder) : null,
    });
  }
  return records;
}
