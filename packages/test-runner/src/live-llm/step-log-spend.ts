// What the run's own step log says it paid the provider for.
//
// Core writes one folder per model and tool step of a live run into the
// run's `steps/` (`FLUXIQ_LLM_STEP_LOG_DIR`), `meta.json` last, and a model
// step's meta names its provider and what the call cost. That is the one
// record every provider call reaches -- the chat's own interpreter call, and a
// failed re-author's calls, reach no record the settlement reads from Core
// (`run-muqk713g-d08ad3dc`: 35 calls in its step log, 17 in `llm.calls`). It
// is read here only to count: a kind, a part, a phase, a provider name, a
// cost, the call's input token count and the agent that made it, per folder;
// no request, answer or page content.
//
// A project build (authoring mode `project`) names on every step the agent
// that made it: `role` (`supervisor`, `builder`, `repair`, ...) and, for a
// builder's work, the `briefId` it was dispatched with (Core
// `llm/step-log/`). Its spend is therefore also tallied by role and brief, with
// the largest single call input in tokens beside each, so a debug can read one
// builder's cost on its own and the Lab comparison (A8) can set a project build
// against a candidate build, whose steps name no agent.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LiveLlmStepLogKind = { calls: number; estimatedCostUsd: number };

/** One agent's calls: their count, cost and the largest single call input in tokens (`null` when no call reported one). */
export type LiveLlmStepLogAgentSpend = LiveLlmStepLogKind & { largestInputTokens: number | null };

/** One role's calls, and the same by the brief each was made under; a call with no brief is in the role's figures only. */
export type LiveLlmStepLogRoleSpend = LiveLlmStepLogAgentSpend & { byBrief: Record<string, LiveLlmStepLogAgentSpend> };

export type LiveLlmStepLogSpend = {
  /** Every complete step folder whose meta names a provider: one provider call each. */
  calls: number;
  estimatedCostUsd: number;
  /** The same, by the step's `kind` (`chat`, `decide`, `judge`, `diagnose`, `repair`, ...). */
  byKind: Record<string, LiveLlmStepLogKind>;
  /**
   * The calls a build made, by the build Core's scope names on the step
   * (`part`: `creation` or `reauthor`) and then by its `phase` (`explore`,
   * `test`, `repair`, `read` -- the build's reading of its instructions -- and
   * `judge`). A step with no part -- the chat, a playback run, its result
   * check -- is in no entry. Absent on a log read before Core named parts.
   */
  byPart?: Record<string, Record<string, LiveLlmStepLogKind>>;
  /** The largest input, in tokens, of any one call the log holds: how big a single decision's context grew. `null` when no call reported its usage; absent on a log read before W4. */
  largestInputTokens?: number | null;
  /**
   * The calls a project build's agents made, by the `role` Core wrote on the
   * step and then by its `briefId`. A step that names no role -- every step of
   * a candidate or legacy build, the chat, a playback run -- is in no entry, so
   * this is empty for them. Absent on a log read before W4.
   */
  byRole?: Record<string, LiveLlmStepLogRoleSpend>;
};

const STEP_FOLDER = /^\d{4,}-/u;
const KIND = /^[a-z][a-z0-9_.-]{0,63}$/u;
/** The builds Core's step-log scope names (`AutomationStudioLlmStepLogPart`). */
const PARTS = new Set(["creation", "reauthor"]);
/** A brief's id as Core writes it: an identifier, never free text. */
const BRIEF = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;

/**
 * The step log's provider calls, or `null` when there is no log to read or it
 * holds none, so a run without one keeps the figures Core's records give. A
 * folder without a complete `meta.json` -- none yet, or one cut short -- is a
 * step still being written, as Core treats it, and is not counted. Any other
 * failure to read the log is raised: a log that could not be read is not one
 * that held no calls.
 */
export async function readLiveLlmStepLogSpend(stepsDirectory: string): Promise<LiveLlmStepLogSpend | null> {
  let names: string[];
  try {
    names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && STEP_FOLDER.test(entry.name)).map((entry) => entry.name).sort();
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  const byKind: Record<string, LiveLlmStepLogKind> = {};
  const byPart: Record<string, Record<string, LiveLlmStepLogKind>> = {};
  const byRole: Record<string, LiveLlmStepLogRoleSpend> = {};
  let calls = 0;
  let cost = 0;
  let largestInputTokens: number | null = null;
  for (const name of names) {
    const meta = await readMeta(path.join(stepsDirectory, name, "meta.json"));
    if (!meta || typeof meta.provider !== "string" || meta.provider.length === 0) continue;
    const kind = typeof meta.kind === "string" && KIND.test(meta.kind) ? meta.kind : "other";
    const costUsd = typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) && meta.costUsd >= 0 ? meta.costUsd : 0;
    const entry = byKind[kind] ??= { calls: 0, estimatedCostUsd: 0 };
    entry.calls += 1;
    entry.estimatedCostUsd = nano(entry.estimatedCostUsd + costUsd);
    if (typeof meta.part === "string" && PARTS.has(meta.part)) {
      const phase = typeof meta.phase === "string" && KIND.test(meta.phase) ? meta.phase : kind;
      const ofPart = byPart[meta.part] ??= {};
      const inPhase = ofPart[phase] ??= { calls: 0, estimatedCostUsd: 0 };
      inPhase.calls += 1;
      inPhase.estimatedCostUsd = nano(inPhase.estimatedCostUsd + costUsd);
    }
    const inputTokens = inputTokensOf(meta.usage);
    largestInputTokens = larger(largestInputTokens, inputTokens);
    if (typeof meta.role === "string" && KIND.test(meta.role)) {
      const role = byRole[meta.role] ??= { calls: 0, estimatedCostUsd: 0, largestInputTokens: null, byBrief: {} };
      add(role, costUsd, inputTokens);
      if (typeof meta.briefId === "string" && BRIEF.test(meta.briefId)) add(role.byBrief[meta.briefId] ??= { calls: 0, estimatedCostUsd: 0, largestInputTokens: null }, costUsd, inputTokens);
    }
    calls += 1;
    cost += costUsd;
  }
  return calls === 0 ? null : { calls, estimatedCostUsd: nano(cost), byKind, byPart, largestInputTokens, byRole };
}

function add(entry: LiveLlmStepLogAgentSpend, costUsd: number, inputTokens: number | null): void {
  entry.calls += 1;
  entry.estimatedCostUsd = nano(entry.estimatedCostUsd + costUsd);
  entry.largestInputTokens = larger(entry.largestInputTokens, inputTokens);
}

function larger(current: number | null, next: number | null): number | null {
  return next === null ? current : current === null ? next : Math.max(current, next);
}

/** The call's input tokens from its meta's `usage`, as Core's step log writes it; `null` when it reported none. */
function inputTokensOf(usage: unknown): number | null {
  const value = usage !== null && typeof usage === "object" && !Array.isArray(usage) ? (usage as Record<string, unknown>).inputTokens : undefined;
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

async function readMeta(file: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch (error) {
    if (isMissingFile(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/** Rounded to the nano-dollar, as the run's spend is. */
function nano(value: number): number {
  return Number(value.toFixed(9));
}
