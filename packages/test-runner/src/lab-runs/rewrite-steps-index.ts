import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./write-atomically.js";

/** A step folder: four digits or more, a dash, then the kind (Core's step-log contract). */
const STEP_FOLDER = /^\d{4,}-/u;

/** Core's `index.md` header, word for word (`!FluxIQ` `runtime/llm/step-log/listing.ts`), so a reader meets one format. */
const HEADER = [
  "# Run steps",
  "",
  "One row per completed step folder, in step order. A folder is complete once it holds `meta.json`.",
  "",
  "| Step | Kind | Tool | Summary | Cost |",
  "| --- | --- | --- | --- | --- |",
];

/**
 * Rewrites `steps/index.md` from every completed folder's `meta.json`, in step
 * order, with Core's columns. Core keeps its rows in memory and only adds its
 * own, so a step the Lab writes after Core has stopped is listed only by this.
 * A folder whose `meta.json` is missing or cut short is not complete and is left out, as Core does.
 */
export async function rewriteStepsIndex(stepsDirectory: string): Promise<number> {
  const rows: { step: number; line: string }[] = [];
  for (const entry of await readdir(stepsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !STEP_FOLDER.test(entry.name)) continue;
    const meta = await readMeta(path.join(stepsDirectory, entry.name, "meta.json"));
    if (meta && typeof meta.step === "number") rows.push({ step: meta.step, line: line(meta) });
  }
  rows.sort((a, b) => a.step - b.step);
  await writeFileAtomically(path.join(stepsDirectory, "index.md"), `${[...HEADER, ...rows.map(row => row.line)].join("\n")}\n`);
  return rows.length;
}

async function readMeta(file: string): Promise<Record<string, unknown> | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch (error) {
    // A meta.json cut short by a killed writer: that step is not complete, so it is not listed.
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function line(meta: Record<string, unknown>): string {
  const cell = (value: string) => value.replace(/[\r\n]+/gu, " ").replace(/\|/gu, "\\|");
  const text = (value: unknown) => typeof value === "string" ? value : undefined;
  const cost = typeof meta.costUsd === "number" ? `$${meta.costUsd.toFixed(6)}` : "-";
  return `| ${String(meta.step).padStart(4, "0")} | ${cell(text(meta.kind) ?? "-")} | ${cell(text(meta.toolId) ?? "-")} | ${cell(text(meta.summary) ?? "") || "-"} | ${cost} |`;
}
