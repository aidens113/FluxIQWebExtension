// What a run's re-author spent, read from Core's own record of the run.
//
// When Core judges a run's answer wrong it may re-author the Flow: a second
// build, with its own evidence loop and its own provider calls, made inside the
// run (`recovery/refuted-result/reauthor.ts`). Core records every attempt on
// the run detail, `metadata.resultReauthor.attempts[]`, each with the build's
// accounting; a build that succeeded keeps its call count on its adaptation,
// and one that failed keeps it on the attempt's own `evidenceLoop`. None of it
// is in the run's own accounting, its per-call lines or its interventions, so
// every settlement that read only those left the re-author out:
// `run-munw7ffn-fe1cecd2`'s 36 re-author calls and $0.0425 were in no figure
// the Lab or the machine's spend ledger kept.
//
// A failed build's loop names no provider call count, only its decisions
// (`evidenceLoop.decisionCount`, one paid call each), and its `ending` says how
// it closed. `run-musp39u8-9ac026ab` booked both of its re-author builds as
// `calls: null` and kept neither ending, so its 69 re-author calls read as
// uncounted and nothing said a budget, and which one, had stopped each build.
//
// **Which build of a brief (`try`).** Core builds a re-author once more, on
// the same brief, only when the first build failed on a named transient
// provider request (`service/runtime-adaptation/reauthor-build.ts`,
// `automaticRequestRetry`), and records both builds as consecutive
// `attempts[]` entries (`recovery/refuted-result/reauthor.ts`). It writes no
// `try` field, so the Lab derives one: an entry that records a brief
// (`brief.instructionId`) is try 1, and is try 2 exactly when the entry before
// it is a try 1 with the same brief record (same `instructionId`, same counts
// and codes: both routes write the record from one brief computed once before
// either build) and the same `attempt` (absent on the failed-step route,
// present on the refuted-result route), and that entry failed without an
// adaptation at stage `provider_request` with `retryable: true` -- the only
// failure Core builds again. The last condition is what tells a rebuild from a
// second failed-step re-author later in the run, whose brief record carries
// the same constant `instructionId`. An entry with no brief (a refusal, a
// ladder fallback, a Core older than the brief record) has `try: null`. There
// is no try 3: Core rebuilds once.
//
// Counts, token totals, a cost figure, ids and Core's closed ending words
// only; no decision, prompt, page content or ending message is read. It raises
// nothing: what a re-author spent is evidence about the run, and a read that
// failed says so by `source`.

import type { LiveLlmExplorationControl } from "./exploration-record.js";

export type LiveLlmReauthorAttempt = {
  attempt: number | null;
  /** Which build of its brief this was: 1, or 2 for Core's automatic rebuild after a transient provider request failure; `null` for an entry that records no brief (see the file comment). */
  try: number | null;
  adaptationId: string | null;
  /** Core's count of the build's provider calls, or `null` where it recorded none this reader could reach. */
  calls: number | null;
  /**
   * Where `calls` came from: the attempt's own loop (a build that failed), its
   * adaptation (one that succeeded), an adaptation that could not be read, or
   * nowhere, because Core recorded neither.
   */
  callsFrom: LiveLlmReauthorCallsSource;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  /** How the build closed, in Core's closed words only (never its message or what was not done); `null` where Core recorded none this reader recognises. */
  ending: LiveLlmReauthorEnding | null;
};

/**
 * Core's build ending (`flow-bootstrap/generation-failure/build-ending.ts`),
 * reduced to its closed words and counts. `bound` is kept on
 * `budget_exhausted` only, and `tried.noRoute` only on the kinds Core allows
 * it for (`not_doable`, `not_finished`), as Core's own parser holds them.
 */
export type LiveLlmReauthorEnding = {
  kind: "not_doable" | "not_finished" | "budget_exhausted" | "replies_unreadable" | "provider_unavailable";
  /** `budget_exhausted` only: which budget ran out. */
  bound?: "cost" | "tokens" | "duration" | "calls" | "repair_rounds" | "rounds";
  tried: {
    rounds: number;
    decisions: number;
    stepsInFlow: number;
    tested: "replayed_clean" | "replay_failed" | "not_tested";
    stops?: Array<{ round: number; stopped: "iterations" | "tool_calls" | "unusable_decisions" | "repeat_without_progress" | "judged_wrong" | "budget" }>;
    noRoute?: { kind: "no_progress" | "repeated_unchanged" | "judged_unachievable" };
  };
};

/**
 * Where `calls` came from: `loop` is the loop's own provider call count,
 * `loop_decisions` its decision count where it kept no call count (a failed
 * build's loop; one paid call per decision, calls outside the loop not
 * included), `adaptation` the succeeded build's adaptation.
 */
export type LiveLlmReauthorCallsSource = "loop" | "loop_decisions" | "adaptation" | "adaptation_unreadable" | "not_recorded";

export type LiveLlmReauthorRecord = {
  /** `run-detail` when Core recorded a re-author, `absent` when it recorded none, `unreadable` when the detail could not be read. */
  source: "run-detail" | "absent" | "unreadable";
  attempts: LiveLlmReauthorAttempt[];
  /** Every attempt's calls, where each was counted; `uncountedAttempts` says how many were not. */
  calls: number;
  uncountedAttempts: number;
  totalEstimatedCostUsd: number;
};

const NO_REAUTHOR: LiveLlmReauthorRecord = { source: "absent", attempts: [], calls: 0, uncountedAttempts: 0, totalEstimatedCostUsd: 0 };

const ID = /^[A-Za-z0-9_.:-]{1,160}$/u;

/**
 * Reads the run's re-author attempts and what each spent. A succeeded
 * attempt's call count is read from its adaptation (`get-flow-adaptation`),
 * because that is where Core keeps a successful build's loop.
 */
export async function readLiveLlmReauthor(control: LiveLlmExplorationControl, scope: { projectId: string; runId: string }): Promise<LiveLlmReauthorRecord> {
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-run-detail", { projectId: scope.projectId, runId: scope.runId });
  } catch {
    return { ...NO_REAUTHOR, attempts: [], source: "unreadable" };
  }
  const detail = asRecord(asRecord(payload)?.runDetail);
  const marker = asRecord(asRecord(detail?.metadata)?.resultReauthor);
  const listed: unknown[] = Array.isArray(marker?.attempts) ? marker.attempts : [];
  const recorded = listed.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined);
  if (recorded.length === 0) return { ...NO_REAUTHOR, attempts: [] };
  const flowId = id(asRecord(detail?.summary)?.flowId) ?? id(detail?.flowId);
  const attempts: LiveLlmReauthorAttempt[] = [];
  const tries = buildTries(recorded);
  for (const [index, item] of recorded.entries()) {
    const accounting = asRecord(item.accounting);
    const adaptationId = id(item.adaptationId);
    const counted = await attemptCalls(control, scope.projectId, flowId, adaptationId, asRecord(item.evidenceLoop));
    attempts.push({
      attempt: count(item.attempt),
      try: tries[index] ?? null,
      adaptationId,
      ...counted,
      inputTokens: count(accounting?.inputTokens),
      outputTokens: count(accounting?.outputTokens),
      estimatedCostUsd: cost(accounting?.estimatedCostUsd),
      ending: ending(item.ending),
    });
  }
  return {
    source: "run-detail",
    attempts,
    calls: attempts.reduce((sum, attempt) => sum + (attempt.calls ?? 0), 0),
    uncountedAttempts: attempts.filter((attempt) => attempt.calls === null).length,
    totalEstimatedCostUsd: attempts.reduce((sum, attempt) => sum + (attempt.estimatedCostUsd ?? 0), 0),
  };
}

/** A build's provider calls as its evidence loop counts them: every loop decision plus the calls made outside it. */
function loopCalls(loop: Record<string, unknown> | undefined): number | null {
  return count(loop?.totalProviderCallCount) ?? count(loop?.providerCallCount);
}

/** An attempt's call count and where it was found; an adaptation that could not be read says so rather than reading as uncounted. */
async function attemptCalls(control: LiveLlmExplorationControl, projectId: string, flowId: string | null, adaptationId: string | null, loop: Record<string, unknown> | undefined): Promise<{ calls: number | null; callsFrom: LiveLlmReauthorCallsSource }> {
  const own = loopCalls(loop);
  if (own !== null) return { calls: own, callsFrom: "loop" };
  const decisions = count(loop?.decisionCount);
  const fromDecisions = (otherwise: LiveLlmReauthorCallsSource): { calls: number | null; callsFrom: LiveLlmReauthorCallsSource } =>
    decisions === null ? { calls: null, callsFrom: otherwise } : { calls: decisions, callsFrom: "loop_decisions" };
  if (!adaptationId || !flowId) return fromDecisions("not_recorded");
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-adaptation", { projectId, flowId, adaptationId });
  } catch {
    return fromDecisions("adaptation_unreadable");
  }
  const calls = loopCalls(asRecord(asRecord(asRecord(payload)?.adaptation)?.evidenceLoop));
  return calls === null ? fromDecisions("not_recorded") : { calls, callsFrom: "adaptation" };
}

/** Each entry's `try`, by the rule in the file comment. */
function buildTries(entries: readonly Record<string, unknown>[]): Array<number | null> {
  const tries: Array<number | null> = [];
  for (const [index, entry] of entries.entries()) {
    const brief = briefKey(entry);
    if (brief === null) { tries.push(null); continue; }
    const previous = index > 0 ? entries[index - 1] : undefined;
    const rebuild = previous !== undefined && tries[index - 1] === 1 && briefKey(previous) === brief && previous.attempt === entry.attempt && rebuiltAfter(previous);
    tries.push(rebuild ? 2 : 1);
  }
  return tries;
}

/** The entry's brief record as a comparable key, or `null` when it records none with an `instructionId`. */
function briefKey(entry: Record<string, unknown>): string | null {
  const brief = asRecord(entry.brief);
  if (id(brief?.instructionId) === null) return null;
  return JSON.stringify(brief, (_key, value: unknown) => {
    const record = asRecord(value);
    return record ? Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]])) : value;
  });
}

/** A build Core builds again: no adaptation, failed at the provider request, and retryable (`reauthor-build.ts`, `automaticRequestRetry`). */
function rebuiltAfter(entry: Record<string, unknown>): boolean {
  return entry.adaptationId === undefined && entry.stage === "provider_request" && entry.retryable === true;
}

const ENDING_KINDS: readonly string[] = ["not_doable", "not_finished", "budget_exhausted", "replies_unreadable", "provider_unavailable"];
const BOUNDS: readonly string[] = ["cost", "tokens", "duration", "calls", "repair_rounds", "rounds"];
const TESTED: readonly string[] = ["replayed_clean", "replay_failed", "not_tested"];
const STOPPED: readonly string[] = ["iterations", "tool_calls", "unusable_decisions", "repeat_without_progress", "judged_wrong", "budget"];
/** The `tried.noRoute` words Core allows on each ending kind (`build-ending.ts`, `NO_ROUTE`). */
const NO_ROUTE: Readonly<Record<string, readonly string[]>> = { not_doable: ["judged_unachievable", "no_progress", "repeated_unchanged"], not_finished: ["no_progress", "repeated_unchanged"] };

/**
 * The ending's closed words and counts. A word outside Core's vocabulary, or
 * one Core does not allow on that kind, is dropped; an unrecognised kind or a
 * malformed count publishes no ending.
 */
function ending(value: unknown): LiveLlmReauthorEnding | null {
  const record = asRecord(value);
  const tried = asRecord(record?.tried);
  const kind = record?.kind;
  if (typeof kind !== "string" || !ENDING_KINDS.includes(kind) || !tried) return null;
  const rounds = count(tried.rounds);
  const decisions = count(tried.decisions);
  const stepsInFlow = count(tried.stepsInFlow);
  const tested = tried.tested;
  if (rounds === null || decisions === null || stepsInFlow === null || typeof tested !== "string" || !TESTED.includes(tested)) return null;
  const bound = kind === "budget_exhausted" && typeof record?.bound === "string" && BOUNDS.includes(record.bound) ? record.bound : undefined;
  const stops = Array.isArray(tried.stops)
    ? tried.stops.map(asRecord).flatMap((stop) => {
        const round = count(stop?.round);
        return round !== null && typeof stop?.stopped === "string" && STOPPED.includes(stop.stopped) ? [{ round, stopped: stop.stopped }] : [];
      })
    : undefined;
  const noRoute = asRecord(tried.noRoute)?.kind;
  return {
    kind: kind as LiveLlmReauthorEnding["kind"],
    ...(bound === undefined ? {} : { bound: bound as NonNullable<LiveLlmReauthorEnding["bound"]> }),
    tried: {
      rounds,
      decisions,
      stepsInFlow,
      tested: tested as LiveLlmReauthorEnding["tried"]["tested"],
      ...(stops === undefined ? {} : { stops: stops as NonNullable<LiveLlmReauthorEnding["tried"]["stops"]> }),
      ...(typeof noRoute === "string" && (NO_ROUTE[kind] ?? []).includes(noRoute) ? { noRoute: { kind: noRoute as NonNullable<LiveLlmReauthorEnding["tried"]["noRoute"]>["kind"] } } : {}),
    },
  };
}

function id(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function cost(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
