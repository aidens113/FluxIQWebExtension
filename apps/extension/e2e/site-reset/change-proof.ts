import type { JsonObject } from "fluxiq/core";
import type { ScriptedAnswer, ScriptedVerification, SupervisorTurn } from "./scripted-provider";

/** The reset codes the t775 design retires (Core `llm-flow-bootstrap.md`, "A trial is judged by the change"). */
export const RETIRED_RESET_CODES = [
  "candidate.trial_reset_required",
  "project.trial_reset_required",
  "candidate.trial_reset_unproved",
  "candidate.trial_start_differs",
  "project.completion_reset_first",
  "candidate.create_baseline_required",
  "candidate.reset_witness_required"
] as const;

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** Every retired code that appears anywhere in the given step-log material (answers, outcomes, receipts, diagnostics). */
export function retiredCodesIn(...logs: unknown[]): string[] {
  const text = JSON.stringify(logs) ?? "";
  return RETIRED_RESET_CODES.filter(code => text.includes(code));
}

/** The first `siteChange` object anywhere in a value, reading JSON text carried inside strings too. */
export function siteChangeIn(value: unknown): JsonObject | undefined {
  if (typeof value === "string") {
    if (!value.startsWith("{") && !value.startsWith("[")) return undefined;
    try { return siteChangeIn(JSON.parse(value)); } catch { return undefined; }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = siteChangeIn(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const entries = record(value);
  if (typeof entries.siteChange === "object" && entries.siteChange !== null) return record(entries.siteChange);
  for (const item of Object.values(entries)) {
    const found = siteChangeIn(item);
    if (found) return found;
  }
  return undefined;
}

/** What a spec's scripted judge saw: each verification request as text, in order, answered with a bare yes. */
export type JudgeLog = { requests: string[]; verify: (shown: string) => ScriptedVerification; siteChanges: () => Array<JsonObject | undefined> };

export function judgeLog(): JudgeLog {
  const requests: string[] = [];
  return {
    requests,
    verify: shown => {
      requests.push(shown);
      return { summary: "Diagnostic trial completed.", diagnosis: { answersRequest: "yes" } };
    },
    siteChanges: () => requests.map(request => siteChangeIn(request))
  };
}

/** The acts a `siteChange` packet lists with `outcome`, as `{ step, row }`. */
export function actsWithOutcome(siteChange: JsonObject | undefined, outcome: string): JsonObject[] {
  const acts = Array.isArray(siteChange?.acts) ? siteChange.acts as unknown[] : [];
  return acts.map(record).filter(act => act.outcome === outcome);
}

/** The proofs a `siteChange` packet lists, by their `proof` word. */
export function proofsOf(siteChange: JsonObject | undefined): string[] {
  const proofs = Array.isArray(siteChange?.proofs) ? siteChange.proofs as unknown[] : [];
  return proofs.map(proof => String(record(proof).proof));
}

/**
 * The scripted supervisor of the default run (one plan, one build brief, completion on its answer) with a typed
 * `effect` on the one part and any `unchanged` things on the task, so the judge is asked to judge a change.
 */
export function supervisorWithEffect(options: { permitted: string[]; maxIterations: number; effect: JsonObject; unchanged?: string[] }): (turn: SupervisorTurn) => ScriptedAnswer {
  return turn => {
    if (turn.step === 1) {
      const plan = turn.plan();
      const spec = record(plan.taskSpec);
      const parts = (spec.parts as JsonObject[]).map(part => ({ ...part, effect: options.effect }));
      return turn.call("plan", "project.write_plan", { ...plan, taskSpec: { ...spec, parts, ...(options.unchanged ? { unchanged: options.unchanged } : {}) } });
    }
    if (turn.step === 2) {
      const brief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: options.permitted, maxIterations: options.maxIterations };
      return turn.call("dispatch", "project.dispatch", { reason: "Exercise the change proof.", briefs: [brief] });
    }
    return turn.complete(record(turn.last("project.dispatch")?.complete));
  };
}
