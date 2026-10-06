// Every provider call a live run made, one row each, read from the run's own
// step log.
//
// `live-llm.json` `observed.observedCalls` held what the settled phase
// itemized: for a created Flow, the build's decision rows, which carry no
// request id, task kind or prompt version, and no row at all for the chat's
// interpreter call, the build's reading of its instructions or its judges
// (`run-musp8nz1-dbd3905a`: 15 rows all null, 5 calls missing;
// `run-musq0b1m-0472cfa0`: 27 rows all null, 4 missing). Core writes every one
// of those calls into `steps/` with its identity in `meta.json`, which is what
// `step-log-spend.ts` already counts the run's spend from. The snapshot's rows
// are read from the same folders, so the rows and the totals beside them
// describe the same calls.
//
// Only the call's identity and figures are read -- request id, task kind,
// stage, provider, model, tokens, cost -- never a request, an answer or a
// page. Core writes no prompt version or validation verdict per step, so a row
// takes those from Core's own per-call line for the same request id, and keeps
// them `null` where there is none.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { LiveLlmObservedCall, LiveLlmObservedUsage } from "./observed-usage.js";

const STEP_FOLDER = /^\d{4,}-/u;
/** A closed identifier as Core writes one (`llm.evidence_tool_decision.<uuid>`, `panel_command`): never a sentence. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u;

/**
 * `observed`'s per-call fields with the step log's rows in place of the
 * settled phase's, or `undefined` when there is no step log or it holds no
 * call, so a run without one keeps Core's rows. `calls` is the run's whole
 * count (`run-spend.ts`), which the rows are held against. A Core row whose
 * request id the log does not hold is kept after the log's rows, so a call the
 * log missed is never dropped; a Core row with no request id is one of the
 * log's calls and is not listed twice.
 */
export async function stepLogObservedCalls(stepsDirectory: string | undefined, observed: LiveLlmObservedUsage, calls: number): Promise<Pick<LiveLlmObservedUsage, "observedCalls" | "perCallRecords" | "unrecordedCalls"> | undefined> {
  if (stepsDirectory === undefined) return undefined;
  let names: string[];
  try {
    names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && STEP_FOLDER.test(entry.name)).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return undefined;
    throw error;
  }
  const core = new Map(observed.observedCalls.flatMap((call) => (call.requestId === null ? [] : [[call.requestId, call] as const])));
  const rows: LiveLlmObservedCall[] = [];
  for (const name of names) {
    const meta = await readMeta(path.join(stepsDirectory, name, "meta.json"));
    if (!meta || typeof meta.provider !== "string" || meta.provider.length === 0) continue;
    const row = rowOf(meta);
    const known = row.requestId === null ? undefined : core.get(row.requestId);
    if (known) core.delete(row.requestId!);
    rows.push(known ? { ...row, promptVersion: known.promptVersion, validationOk: known.validationOk, validationCodes: [...known.validationCodes], stage: row.stage ?? known.stage } : row);
  }
  if (rows.length === 0) return undefined;
  const observedCalls = [...rows, ...core.values()];
  return {
    observedCalls,
    perCallRecords: observedCalls.length >= calls ? "recorded" : observed.perCallRecords,
    unrecordedCalls: Math.max(0, calls - observedCalls.length),
  };
}

function rowOf(meta: Record<string, unknown>): LiveLlmObservedCall {
  const usage = meta.usage !== null && typeof meta.usage === "object" && !Array.isArray(meta.usage) ? meta.usage as Record<string, unknown> : {};
  const inputTokens = count(usage.inputTokens);
  const outputTokens = count(usage.outputTokens);
  return {
    requestId: identifier(meta.requestId),
    taskKind: identifier(meta.taskKind),
    stage: identifier(meta.stage),
    provider: identifier(meta.provider),
    model: identifier(meta.model),
    promptVersion: identifier(meta.promptVersion),
    validationOk: null,
    validationCodes: [],
    inputTokens,
    outputTokens,
    totalTokens: count(usage.totalTokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
    estimatedCostUsd: typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) && meta.costUsd >= 0 ? meta.costUsd : null,
  };
}

/** A folder without a complete `meta.json` is a step still being written, as Core treats it, and is no call. */
async function readMeta(file: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

function identifier(value: unknown): string | null {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
