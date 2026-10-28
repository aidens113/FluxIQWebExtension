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

export function judgeLog(accounts?: { quote: string; why: string }): JudgeLog {
  const requests: string[] = [];
  return {
    requests,
    verify: shown => {
      requests.push(shown);
      if (!accounts) return { summary: "Diagnostic trial completed.", diagnosis: { answersRequest: "yes" } };
      // A yes accounts for what a read's condition left out as Core requires of any yes: each condition it names
      // (`condition N`) in a sentence quoting the request's own words, and each row shown by id (`[row XXXXXX]`).
      const conditions = [...new Set([...shown.matchAll(/condition ([0-9]+) \(/gu)].map(match => match[1]!))];
      const rows = [...new Set([...shown.matchAll(/(?<!as in )\[row ([A-Z2-9]{6})\]/gu)].map(match => match[1]!))];
      const reasons = [
        ...conditions.map(number => `The read's condition ${number} leaves out ${accounts.why}, which the request's words "${accounts.quote}" do not ask for.`),
        ...(rows.length ? [`Rows ${rows.join(", ")} are left out: ${accounts.why}, not among "${accounts.quote}".`] : [])
      ];
      const words = ["Diagnostic trial completed.", ...reasons].join(" ");
      return { summary: words, diagnosis: { answersRequest: "yes", observed: words } };
    },
    // A trial is asked twice (the first ask and its confirmation, both over one run): one entry per run, in order.
    siteChanges: () => {
      const runs = new Map<string, string>();
      for (const request of requests) {
        let key = request;
        try { key = String(((JSON.parse(request) as JsonObject).context as JsonObject | undefined)?.runId ?? request); } catch { /* an unparsable request is its own run */ }
        if (!runs.has(key)) runs.set(key, request);
      }
      return [...runs.values()].map(request => siteChangeIn(request));
    }
  };
}

/** A JSON value written with its keys in order, so two of the same value compare equal. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/**
 * Every `ensureState` a judge request's Flow carries (Core gives a toggle step the signature of the explored press it
 * is tied to), as its canonical JSON, in the order the request writes them. Reads JSON text carried inside strings too. A
 * request writes a list as `{ count, items }`; it is read back as the list of its items.
 */
export function ensureStatesIn(request: string): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (!value.startsWith("{") && !value.startsWith("[")) return;
      try { visit(JSON.parse(value)); } catch { /* plain text */ }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "ensureState") found.push(canonicalJson(listsOf(item)));
      else visit(item);
    }
  };
  visit(request);
  return found;
}

/** A value with each `{ count, items }` a judge request writes for a list read back as its items. */
function listsOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(listsOf);
  if (typeof value !== "object" || value === null) return value;
  const entries = value as Record<string, unknown>;
  const keys = Object.keys(entries).sort().join(",");
  if (keys === "count,items" && Array.isArray(entries.items)) return entries.items.map(listsOf);
  return Object.fromEntries(Object.entries(entries).map(([key, item]) => [key, listsOf(item)]));
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
