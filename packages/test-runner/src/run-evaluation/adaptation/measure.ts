// The Week 2 adaptation measurements of one run, from what Core stated about
// it: the run detail, the Flow graphs it executed, and each adaptation's
// stored record. Pure, so the same Core payloads always measure the same way.
// Identifiers, closed words and numbers leave; nothing else is read.

import {
  adaptationRecordStatuses, validateRunAdaptationCost, validateRunAdaptationPersistence, validateRunAdaptationReuse, validateRunAdaptationValidation,
  type AdaptationRecordStatus, type RunAdaptationConfidence, type RunAdaptationCost, type RunAdaptationMeasurements, type RunAdaptationRecord,
  type RunAdaptationResume, type RunAdaptationReuse, type ValidationResult,
} from "@fluxiq-web-extension/test-contracts";
import { automationStudioNodeAdaptationIds, decideAutomationStudioChangeConfidence } from "fluxiq/automation-studio";

type JsonRecord = Record<string, unknown>;

/**
 * Core's own payloads for one finished run, as `readRunAdaptationFacts` reads
 * them: `runDetail` from `get-flow-run-detail`, `graphs` the Flow document and
 * the graph of each Subflow the run entered (`get-flow`), and `adaptations`
 * every stored adaptation the run created, trialled, or executed a stamp of
 * (`get-flow-adaptation`), by id.
 */
export type RunAdaptationFacts = {
  runDetail: JsonRecord;
  graphs: readonly JsonRecord[];
  adaptations: ReadonlyMap<string, JsonRecord>;
};

/** Every adaptation id `measureRunAdaptations` will look up in `facts.adaptations`, so a reader can fetch exactly those. */
export function adaptationIdsToRead(runDetail: JsonRecord, graphs: readonly JsonRecord[]): string[] {
  return unique([...createdIds(runDetail), ...stampedIds(runDetail, graphs), ...(resumeOf(runDetail)?.adaptationIds ?? [])]);
}

/**
 * The four measurements of a run whose Flow ran. Each record is checked
 * against its contract, and one that does not fit is `null` -- unmeasured --
 * rather than a record the evaluation would refuse after the run is over.
 *
 * - Reuse: the stamped adaptations the run executed that it did not create and
 *   that Core holds `applied` -- Core's replay rule, which treats a stamp of any
 *   other status as stale -- with Core's provider-call count (`null` when Core
 *   kept no accounting for the run), its interventions, and its resume.
 * - Validation: each created, trialled or exercised adaptation graded by
 *   Core's own `decideAutomationStudioChangeConfidence` over its stored results.
 * - Persistence: the same adaptations' stored status and revisions; `null` if
 *   any one's status or base revision is not Core's.
 * - Cost: Core's accounting; `null` when Core stated none of it.
 */
export function measureRunAdaptations(facts: RunAdaptationFacts): RunAdaptationMeasurements {
  const exercised = exercisedIds(facts, (id) => facts.adaptations.get(id));
  return {
    adaptationReuse: reuseOf(facts, exercised),
    ...storedMeasurements(gradedIds(facts, exercised), facts.adaptations),
    adaptationCost: costOf(facts.runDetail),
  };
}

/**
 * A repair lane's run, measured as one (adaptation plan G1): `lane` is the run
 * that made the repair, read after the lane applied it, and `replay` the first
 * model-free replay of the repaired Flow that ran, or `null` when none did.
 * `repairAdaptationIds` are the adaptations the lane applied or found applied,
 * which `lane.adaptations` must hold.
 *
 * - Persistence, validation and cost are the lane run's, as
 *   `measureRunAdaptations` measures them, with every repair adaptation graded
 *   too: a re-author Core applied in the run is not always on the run's own
 *   created list.
 * - Reuse is the replay's: Core's stamp rule, plus each repair adaptation Core
 *   holds `applied` whose recorded `appliedTo` names a node the replay
 *   attempted. Core's legacy apply (`service/adaptations/graph-flow-patch.ts`)
 *   re-points a node without stamping its `metadata.adaptationIds`, so the
 *   stamp rule alone cannot see that repair being reused; `appliedTo` is
 *   Core's own record of where it applied it.
 */
export type RepairedRunAdaptationFacts = { lane: RunAdaptationFacts; replay: RunAdaptationFacts | null; repairAdaptationIds: readonly string[] };

/** The four measurements of a repair lane's run, by the rules `RepairedRunAdaptationFacts` states. */
export function measureRepairedRunAdaptations(facts: RepairedRunAdaptationFacts): RunAdaptationMeasurements {
  const { lane, replay } = facts;
  const exercisedInLane = exercisedIds(lane, (id) => lane.adaptations.get(id));
  return {
    adaptationReuse: replay ? reuseOf(replay, repairReuseIds(lane, replay, facts.repairAdaptationIds)) : null,
    ...storedMeasurements(unique([...gradedIds(lane, exercisedInLane), ...facts.repairAdaptationIds]), lane.adaptations),
    adaptationCost: costOf(lane.runDetail),
  };
}

/** The adaptations the replay reused: stamped and applied, or a repair applied to a node it attempted. Never one the replay created. */
function repairReuseIds(lane: RunAdaptationFacts, replay: RunAdaptationFacts, repairIds: readonly string[]): string[] {
  const created = createdIds(replay.runDetail);
  const attempted = new Set(arrayOf(replay.runDetail.actionAttempts).filter(isRecord).map((attempt) => attempt.nodeId).filter(isText));
  const appliedTo = repairIds.filter((id) => {
    const stored = lane.adaptations.get(id);
    return !created.includes(id) && statusOf(stored) === "applied" && arrayOf(stored?.appliedTo).filter(isRecord).some((target) => isText(target.id) && attempted.has(target.id));
  });
  return unique([...exercisedIds(replay, (id) => replay.adaptations.get(id) ?? lane.adaptations.get(id)), ...appliedTo]);
}

/** The stamped adaptations the run executed that it did not create and that Core holds `applied`: Core's replay rule. */
function exercisedIds(facts: RunAdaptationFacts, stored: (id: string) => JsonRecord | undefined): string[] {
  const created = createdIds(facts.runDetail);
  return stampedIds(facts.runDetail, facts.graphs).filter((id) => !created.includes(id) && statusOf(stored(id)) === "applied");
}

/** Created, exercised and trialled, each once: the adaptations graded and persisted. */
function gradedIds(facts: RunAdaptationFacts, exercised: readonly string[]): string[] {
  return unique([...createdIds(facts.runDetail), ...exercised, ...(resumeOf(facts.runDetail)?.adaptationIds ?? [])]);
}

function reuseOf(facts: RunAdaptationFacts, exercised: string[]): RunAdaptationReuse | null {
  const reuse: RunAdaptationReuse = { exercisedAdaptationIds: exercised, providerCalls: costAccounting(facts.runDetail).calls, interventions: arrayOf(facts.runDetail.interventions).length, resume: resumeOf(facts.runDetail) };
  return fitting(reuse, validateRunAdaptationReuse);
}

/** Validation and persistence over the graded ids; each is unmeasured when any one adaptation was not read or does not state what it needs. */
function storedMeasurements(graded: readonly string[], adaptations: ReadonlyMap<string, JsonRecord>): Pick<RunAdaptationMeasurements, "adaptationValidation" | "adaptationPersistence"> {
  const records = graded.map((id) => storedRecord(id, adaptations.get(id)));
  return {
    adaptationValidation: graded.every((id) => adaptations.has(id)) ? fitting({ adaptations: graded.map((id) => confidence(id, adaptations.get(id)!)) }, validateRunAdaptationValidation) : null,
    adaptationPersistence: records.every((entry): entry is RunAdaptationRecord => entry !== undefined) ? fitting({ adaptations: records }, validateRunAdaptationPersistence) : null,
  };
}

function costOf(runDetail: JsonRecord): RunAdaptationCost | null {
  const { cost } = costAccounting(runDetail);
  return cost ? fitting(cost, validateRunAdaptationCost) : null;
}

/** The adaptations the run itself created (`runDetail.adaptationIds`). */
function createdIds(runDetail: JsonRecord): string[] {
  return unique(arrayOf(runDetail.adaptationIds).filter(isText));
}

/** The adaptation ids stamped on each node the run attempted, in attempt order, each once. A node id is looked up in every graph the run executed. */
function stampedIds(runDetail: JsonRecord, graphs: readonly JsonRecord[]): string[] {
  const stamps = new Map<string, string[]>();
  for (const node of graphs.flatMap((graph) => arrayOf(graph.nodes)).filter(isRecord)) {
    if (!isText(node.id)) continue;
    const ids = automationStudioNodeAdaptationIds(isRecord(node.metadata) ? node.metadata as never : undefined) ?? [];
    stamps.set(node.id, unique([...(stamps.get(node.id) ?? []), ...ids]));
  }
  return unique(arrayOf(runDetail.actionAttempts).filter(isRecord).flatMap((attempt) => (isText(attempt.nodeId) ? stamps.get(attempt.nodeId) ?? [] : [])));
}

/**
 * The run's continuation after an in-run trial. Core records that it resumed
 * and how it ended (`metadata.adaptiveRetry`) and, on each resumable patch
 * attempt, the point it resumed from and the adaptation trialled. `null` when
 * it did not resume, or when the attempts do not name one point.
 */
function resumeOf(runDetail: JsonRecord): RunAdaptationResume | null {
  const metadata = recordOf(runDetail.metadata);
  const retry = recordOf(metadata.adaptiveRetry);
  if (retry.attempted !== true || !isText(retry.status) || !isCount(retry.attemptCount)) return null;
  const resumable = arrayOf(metadata.runtimePatchAttempts).filter(isRecord).filter((attempt) => attempt.resumable === true && isRecord(attempt.resumeFrom));
  const points = unique(resumable.map((attempt) => JSON.stringify([recordOf(attempt.resumeFrom).nodeId, recordOf(attempt.resumeFrom).route])));
  const [point] = resumable.map((attempt) => recordOf(attempt.resumeFrom));
  if (points.length !== 1 || !point || !isText(point.nodeId) || !isText(point.route)) return null;
  return { fromNodeId: point.nodeId, fromRoute: point.route, status: retry.status, attemptCount: retry.attemptCount, adaptationIds: unique(resumable.map((attempt) => attempt.adaptationId).filter(isText)) };
}

/**
 * Core's accounting for the run (`metadata.llmGate.costAccounting`), and the
 * calls it charged at their reservation, counted only when Core itemized every
 * call (`providerCalls`, none omitted). `calls` is `null` when Core kept no
 * accounting: a run that never reached the gate states no count.
 */
function costAccounting(runDetail: JsonRecord): { calls: number | null; cost: RunAdaptationCost | null } {
  const gate = recordOf(recordOf(runDetail.metadata).llmGate);
  const account = recordOf(gate.costAccounting);
  const calls = isCount(account.calls) ? account.calls : null;
  const totals = [account.inputTokens, account.outputTokens, account.totalTokens].every(isCount) && isAmount(account.estimatedCostUsd);
  const itemized = Array.isArray(gate.providerCalls) && gate.providerCallsOmitted === 0 && gate.providerCalls.length === calls ? gate.providerCalls.filter(isRecord) : undefined;
  const reservedCalls = itemized ? itemized.filter((call) => { const charged = recordOf(call.charged); return charged.tokens === "reserved" || charged.cost === "reserved"; }).length : null;
  if (calls === null && !totals) return { calls, cost: null };
  return {
    calls,
    cost: {
      providerCalls: calls,
      inputTokens: totals ? account.inputTokens as number : null,
      outputTokens: totals ? account.outputTokens as number : null,
      totalTokens: totals ? account.totalTokens as number : null,
      estimatedCostUsd: totals ? account.estimatedCostUsd as number : null,
      reservedCalls,
    },
  };
}

/** An adaptation's grade, by Core's rule over its stored results and risk. */
function confidence(adaptationId: string, stored: JsonRecord): RunAdaptationConfidence {
  const decision = decideAutomationStudioChangeConfidence({ validationResults: arrayOf(stored.validationResults) as never, riskLevel: stored.riskLevel as never });
  return { adaptationId, tier: decision.tier, trials: decision.trials, replays: decision.replays, lastFailure: decision.lastFailure ?? null };
}

/**
 * An adaptation's stored status and revisions. The typed store publishes its
 * revisions under `metadata.phase9`; an adaptation written before it keeps them
 * on `metadata`. `undefined` when either the status or the base revision is not
 * one Core states.
 */
function storedRecord(adaptationId: string, stored: JsonRecord | undefined): RunAdaptationRecord | undefined {
  const status = statusOf(stored);
  if (!stored || !status) return undefined;
  const metadata = recordOf(stored.metadata);
  const revisions = recordOf(metadata.phase9);
  const baseRevision = isCount(revisions.baseRevision) ? revisions.baseRevision : metadata.baseRevision;
  const appliedRevision = isCount(revisions.appliedRevision) ? revisions.appliedRevision : metadata.appliedRevision;
  if (!isCount(baseRevision)) return undefined;
  return { adaptationId, status, baseRevision, appliedRevision: isCount(appliedRevision) ? appliedRevision : null };
}

function statusOf(stored: JsonRecord | undefined): AdaptationRecordStatus | undefined {
  const status = stored?.status;
  return (adaptationRecordStatuses as readonly unknown[]).includes(status) ? status as AdaptationRecordStatus : undefined;
}

function fitting<T>(value: T, validate: (input: unknown) => ValidationResult<T>): T | null {
  return validate(value).valid ? value : null;
}

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const recordOf = (value: unknown): JsonRecord => (isRecord(value) ? value : {});
const arrayOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)];
