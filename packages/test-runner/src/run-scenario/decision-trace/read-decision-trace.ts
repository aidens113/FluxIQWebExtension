// What Core decided during a run, copied out before the run root is deleted.
//
// A clone-target run deletes its run root, and with it Core's store, before
// the bundle is finalized (`run-scenario.ts`, `removeRunOwnedTopologyState`),
// and every other isolated run deletes it right after. Whatever Core recorded
// about how it recovered a failed run, how its re-author built a replacement,
// and what each build decided, was then gone: `lane-summary.md`'s diagnosis
// gaps name runs whose repair left `perCallRecords: "not recorded"` and no step
// trace at all, and clone runs with no decision content recoverable.
//
// Core already writes those records onto the run and the adaptation, and
// serves them over the two reads the Lab already makes -- `get-flow-run-detail`
// and `get-flow-adaptation`. So this reads them while Core still answers, and
// keeps the part of them that may travel: the recovery record
// (`metadata.llmGate`, `metadata.recoveryTrace`), the re-author's own record
// (`metadata.resultReauthor`, whose `attempts[]` carry each repair build's
// duration, spend and -- for a build that failed -- its decision rows), Core's
// recovery state, and every adaptation's decision loop with its per-call usage.
// Every value passes `publishableTree`, so the copy holds codes, counts and
// identifiers only, and the bundle's redaction attestation scans it like any
// other artifact.
//
// It is bounded three ways -- how many Flows, runs and adaptations, how long
// each read may take, and how long the whole copy may take -- because it runs
// in the run's cleanup, where a slow Core must not hold the run open. What was
// not read says so, by code, rather than reading as "nothing happened".

import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { publishableTree, type PublishableTree } from "./publishable-tree.js";

/** The most Flows, runs per Flow and adaptations per Flow one trace reads. */
export const DECISION_TRACE_MAX_FLOWS = 8;
export const DECISION_TRACE_MAX_RUNS_PER_FLOW = 12;
export const DECISION_TRACE_MAX_ADAPTATIONS_PER_FLOW = 12;
/** How long one read may take, and the whole trace. It runs in cleanup, before the topology closes. */
export const DECISION_TRACE_READ_TIMEOUT_MS = 10_000;
export const DECISION_TRACE_TOTAL_MS = 45_000;
/** The run-detail members that are Core's account of how it recovered or repaired the run. */
const RUN_RECOVERY_MEMBERS = ["llmGate", "recoveryTrace", "recoveryState", "resultReauthor", "runtimePatchAttempts"] as const;

export type DecisionTraceControl = Pick<ExistingFluxIQControlClient, "listFlowSummaries" | "listFlowRuns" | "listFlowAdaptations" | "getFlowAdaptation" | "automationStudioCall">;

export type DecisionTraceUnread = { what: "flows" | "runs" | "run" | "adaptations" | "adaptation"; id?: string; code: string };

export type DecisionTraceRun = {
  runId: string;
  status: string;
  startedAt?: number;
  finishedAt?: number;
  /** Core's recovery and re-author records for this run, content-free. Absent when Core wrote none. */
  recovery?: { [member in typeof RUN_RECOVERY_MEMBERS[number]]?: PublishableTree };
};

export type DecisionTraceAdaptation = {
  adaptationId: string;
  status: string;
  adaptationKind?: string;
  sourceRunId?: string;
  accounting?: PublishableTree;
  /** The build's decision loop: counts, and one row per decision with its per-call usage. */
  evidenceLoop?: PublishableTree;
};

export type DecisionTraceFlow = {
  flowId: string;
  runs: DecisionTraceRun[];
  adaptations: DecisionTraceAdaptation[];
  runsOmitted?: number;
  adaptationsOmitted?: number;
};

export type DecisionTrace = {
  schemaVersion: "0.1";
  projectId: string;
  capturedAt: string;
  flows: DecisionTraceFlow[];
  flowsOmitted?: number;
  /** Reads that failed or were cut off, by what they were and a code. Empty when every read answered. */
  unread: DecisionTraceUnread[];
  /** Present when the whole-trace bound ended the copy early. */
  truncated?: "deadline";
};

export type DecisionTraceOptions = { now?: () => number; readTimeoutMs?: number; totalMs?: number };

/** Reads Core's decision records for every Flow in the project, bounded; never throws for a read Core refused. */
export async function readDecisionTrace(control: DecisionTraceControl, projectId: string, options: DecisionTraceOptions = {}): Promise<DecisionTrace> {
  const now = options.now ?? Date.now;
  const readTimeoutMs = options.readTimeoutMs ?? DECISION_TRACE_READ_TIMEOUT_MS;
  const deadline = now() + (options.totalMs ?? DECISION_TRACE_TOTAL_MS);
  const unread: DecisionTraceUnread[] = [];
  const trace: DecisionTrace = { schemaVersion: "0.1", projectId, capturedAt: new Date(now()).toISOString(), flows: [], unread };
  const expired = () => now() >= deadline;
  const listedFlows = await settle(control.listFlowSummaries(projectId));
  if (!listedFlows.ok) unread.push({ what: "flows", code: listedFlows.code });
  const summaries = listedFlows.ok ? listedFlows.value : [];
  if (summaries.length > DECISION_TRACE_MAX_FLOWS) trace.flowsOmitted = summaries.length - DECISION_TRACE_MAX_FLOWS;
  for (const summary of summaries.slice(0, DECISION_TRACE_MAX_FLOWS)) {
    if (expired()) { trace.truncated = "deadline"; break; }
    const flow: DecisionTraceFlow = { flowId: summary.flowId, runs: [], adaptations: [] };
    trace.flows.push(flow);
    const listedRuns = await settle(control.listFlowRuns(projectId, summary.flowId));
    if (!listedRuns.ok) unread.push({ what: "runs", id: summary.flowId, code: listedRuns.code });
    const newest = [...(listedRuns.ok ? listedRuns.value : [])].sort((left, right) => (right.startedAt ?? right.updatedAt) - (left.startedAt ?? left.updatedAt));
    if (newest.length > DECISION_TRACE_MAX_RUNS_PER_FLOW) flow.runsOmitted = newest.length - DECISION_TRACE_MAX_RUNS_PER_FLOW;
    for (const run of newest.slice(0, DECISION_TRACE_MAX_RUNS_PER_FLOW)) {
      if (expired()) { trace.truncated = "deadline"; break; }
      const read = await settle(runRecovery(control, projectId, run.runId, readTimeoutMs));
      if (!read.ok) unread.push({ what: "run", id: run.runId, code: read.code });
      const recovery = read.ok ? read.value : undefined;
      flow.runs.push({ runId: run.runId, status: run.status, ...(run.startedAt === undefined ? {} : { startedAt: run.startedAt }), ...(run.finishedAt === undefined ? {} : { finishedAt: run.finishedAt }), ...(recovery ? { recovery } : {}) });
    }
    const listedAdaptations = await settle(control.listFlowAdaptations(projectId, summary.flowId));
    if (!listedAdaptations.ok) unread.push({ what: "adaptations", id: summary.flowId, code: listedAdaptations.code });
    const adaptations = listedAdaptations.ok ? listedAdaptations.value : [];
    if (adaptations.length > DECISION_TRACE_MAX_ADAPTATIONS_PER_FLOW) flow.adaptationsOmitted = adaptations.length - DECISION_TRACE_MAX_ADAPTATIONS_PER_FLOW;
    for (const listed of adaptations.slice(0, DECISION_TRACE_MAX_ADAPTATIONS_PER_FLOW)) {
      if (expired()) { trace.truncated = "deadline"; break; }
      const read = await settle(control.getFlowAdaptation(projectId, summary.flowId, listed.adaptationId));
      if (!read.ok) { unread.push({ what: "adaptation", id: listed.adaptationId, code: read.code }); continue; }
      const adaptation = read.value;
      const accounting = publishableTree(adaptation.accounting);
      const evidenceLoop = publishableTree(adaptation.evidenceLoop);
      flow.adaptations.push({
        adaptationId: adaptation.adaptationId,
        status: adaptation.status,
        ...(adaptation.adaptationKind === undefined ? {} : { adaptationKind: adaptation.adaptationKind }),
        ...(adaptation.sourceRunId === undefined ? {} : { sourceRunId: adaptation.sourceRunId }),
        ...(accounting === undefined ? {} : { accounting }),
        ...(evidenceLoop === undefined ? {} : { evidenceLoop }),
      });
    }
  }
  return trace;
}

/** The run's recovery members, read raw so a member the Lab's typed reader does not know still travels. */
async function runRecovery(control: DecisionTraceControl, projectId: string, runId: string, timeoutMs: number): Promise<DecisionTraceRun["recovery"]> {
  const payload = await control.automationStudioCall("get-flow-run-detail", { projectId, runId }, { timeoutMs });
  const metadata = record(record(record(payload)?.runDetail)?.metadata);
  if (!metadata) return undefined;
  const recovery: NonNullable<DecisionTraceRun["recovery"]> = {};
  for (const member of RUN_RECOVERY_MEMBERS) {
    const kept = publishableTree(metadata[member]);
    if (kept !== undefined) recovery[member] = kept;
  }
  return Object.keys(recovery).length === 0 ? undefined : recovery;
}

/**
 * A read, settled: its value, or the code it failed with. Every caller records
 * a failure in `unread` before it reads on, so a read Core refused is never
 * mistaken for one that found nothing.
 */
async function settle<T>(read: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: string }> {
  try {
    return { ok: true, value: await read };
  } catch (error) {
    return { ok: false, code: failureCode(error) };
  }
}

/** A failed read as a code: the facility's category where it has one, never the error's message. */
function failureCode(error: unknown): string {
  const category = record(error)?.category;
  return typeof category === "string" && /^[a-z0-9_.:-]{1,80}$/iu.test(category) ? category : "read_failed";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
