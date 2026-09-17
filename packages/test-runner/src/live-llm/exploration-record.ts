// What the bounded exploration actually did on one live run.
//
// A repair run under an `explore_and_adapt` grant is allowed to look at the
// live page before it proposes anything, and until now nothing in a Lab bundle
// said whether it did. The provider-call lines say a call was made with task
// kind `evidence_tool_decision`; they do not say what the loop asked for, what
// answered, or why it stopped. Core records that as the `exploration` stage of
// `metadata.recoveryTrace`, and this is the read of it.
//
// Counts, closed-vocabulary codes and identifiers only. Core's own `reason` is
// a sentence and is deliberately left behind, as `harness-recovery.ts` leaves
// an issue sentence behind: a snapshot that quoted it would carry text nobody
// checked into an artifact that is meant to be publishable.

import type { FluxIQHttpOptions } from "../http-control/index.js";

/** How the record was arrived at, so an empty one cannot be read as "nothing explored". */
export type LiveLlmExplorationSource =
  /** Core published an `exploration` stage and it was read. */
  | "recovery-trace"
  /** The run detail carried no recovery trace, or none with an exploration stage. */
  | "absent"
  /** A trace was there and could not be read as one. The run is not failed for it. */
  | "unreadable";

/**
 * One run's exploration, as its `snapshots/live-llm.json` states it.
 *
 * Every number is `null` where Core published none, never `0`: a limit that
 * ended an exploration after four tool calls and an exploration that never
 * started must not read the same.
 */
export type LiveLlmExplorationRecord = {
  source: LiveLlmExplorationSource;
  /** Whether the recovery plan asked for an exploration. */
  requested: boolean | null;
  /** Core's stage status: `skipped`, `completed`, `failed` or `refused`. */
  status: string | null;
  /** Whether a provider was called for this stage. */
  providerCalled: boolean | null;
  /** Core's exploration outcome, such as `evidence_gathered` or `no_progress`. */
  outcome: string | null;
  /** The code that ended it, in whichever vocabulary produced it. */
  endedBy: string | null;
  /** Which limit stopped it, when a limit did. */
  stopReason: string | null;
  /** What the loop kept doing, on `no_progress` alone. */
  noProgressReason: string | null;
  counts: {
    /** Tool calls the loop decided on. */
    actions: number | null;
    /** Of those, the ones that came back with evidence. */
    observedActions: number | null;
    /** Of those, the ones the loop or the domain refused. */
    refusedActions: number | null;
    /** Decisions that were made, paid for, and came back unusable. */
    unusableDecisions: number | null;
    /** Provider calls the exploration itself made. */
    providerCalls: number | null;
    /** Bytes of evidence it admitted. A size, never a value. */
    evidenceBytes: number | null;
    durationMs: number | null;
  };
  /**
   * The tools it called and the codes their results came back with, each
   * deduplicated and sorted. Core does not publish the exploration's per-step
   * trace on a run detail today, so these are empty and `toolDetail` says so;
   * the read is here so that the day Core does publish them, the bundle records
   * them without a second change. An empty list is never on its own evidence
   * that no tool was called -- `counts.actions` is.
   */
  toolIds: string[];
  resultCodes: string[];
  toolDetail: "recorded" | "not-published";
};

/** The read this needs of Core: the raw run detail, before the client's parser drops `metadata`. */
export type LiveLlmExplorationControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions): Promise<unknown>;
};

/** The shape a code or a tool id must have to be recorded: no space, so no sentence. */
const CODE = /^[a-z][a-z0-9_.:-]{1,127}$/u;
const MAX_LISTED = 64;

const EMPTY: LiveLlmExplorationRecord = {
  source: "absent",
  requested: null,
  status: null,
  providerCalled: null,
  outcome: null,
  endedBy: null,
  stopReason: null,
  noProgressReason: null,
  counts: { actions: null, observedActions: null, refusedActions: null, unusableDecisions: null, providerCalls: null, evidenceBytes: null, durationMs: null },
  toolIds: [],
  resultCodes: [],
  toolDetail: "not-published",
};

/**
 * Reads the run's exploration record from Core, or says why it could not.
 *
 * It raises nothing. This is called while a live run is being settled, and the
 * settlement's own refusals -- an overspend, a provider never reached -- are
 * what a run should fail on; a record that could not be read says
 * `source: "unreadable"` and leaves the run's verdict to them.
 */
export async function readLiveLlmExploration(
  control: LiveLlmExplorationControl,
  scope: { projectId: string; runId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<LiveLlmExplorationRecord> {
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-run-detail", { projectId: scope.projectId, runId: scope.runId }, bounds);
  } catch {
    return { ...EMPTY, source: "unreadable" };
  }
  return liveLlmExplorationRecord(asRecord(asRecord(payload)?.runDetail)?.metadata);
}

/**
 * The record `metadata` holds, for a caller that already has the raw detail.
 *
 * An absent trace and a trace with no `exploration` stage both read as
 * `absent`: Core records the stage on every annotated recovery, so its absence
 * means no recovery was annotated rather than that an exploration was hidden.
 */
export function liveLlmExplorationRecord(metadata: unknown): LiveLlmExplorationRecord {
  const trace = asRecord(asRecord(metadata)?.recoveryTrace);
  if (trace === undefined) return EMPTY;
  const stages = trace.stages;
  if (!Array.isArray(stages)) return { ...EMPTY, source: "unreadable" };
  const stage = stages.map(asRecord).find((event) => event?.stage === "exploration");
  if (stage === undefined) return EMPTY;
  const detail = asRecord(stage.detail) ?? {};
  const listed = codeList(detail.toolIds);
  const codes = codeList(detail.resultCodes);
  return {
    source: "recovery-trace",
    requested: flag(detail.requested),
    status: code(stage.status),
    providerCalled: flag(stage.providerCalled),
    outcome: code(detail.outcome),
    endedBy: code(detail.endedBy),
    stopReason: code(detail.stopReason),
    noProgressReason: code(detail.noProgressReason),
    counts: {
      actions: count(detail.actions),
      observedActions: count(detail.observedActions),
      refusedActions: count(detail.refusedActions),
      unusableDecisions: count(detail.unusableDecisions),
      providerCalls: count(detail.providerCalls),
      evidenceBytes: count(detail.evidenceBytes),
      durationMs: count(detail.durationMs),
    },
    toolIds: listed,
    resultCodes: codes,
    // Published is published: a Core that names the tools but no result code
    // still told us more than a Core that named neither.
    toolDetail: listed.length > 0 || codes.length > 0 ? "recorded" : "not-published",
  };
}

/** A closed-vocabulary word, or `null` for anything that is not one. Never a sentence. */
function code(value: unknown): string | null {
  return typeof value === "string" && CODE.test(value) ? value : null;
}

/** Codes from a list, deduplicated, sorted and bounded, so a malformed entry drops rather than failing the read. */
function codeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const kept = new Set<string>();
  for (const item of value) {
    const named = code(item);
    if (named !== null) kept.add(named);
    if (kept.size >= MAX_LISTED) break;
  }
  return [...kept].sort();
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
