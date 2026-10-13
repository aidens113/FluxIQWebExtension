// Approving and applying the repair a live run produced.
//
// Core's recovery saves what it decided as an adaptation, and a proposal-only
// run saves a change proposal beside it. Neither is in the Flow until someone
// reviews it: `evaluateFlowAdaptationPromotionGates` asks for evidence rather
// than for the absence of an objection, and the two things that satisfy it are
// a succeeded trial and a named reviewer's approval. The Lab is a named
// reviewer -- it calls Core as the account it logged in as -- so approving and
// then applying is the whole of what turns a proposal into a repaired Flow.
//
// This records status transitions, and the saved Flow either side of them.
// Core refuses an apply with a sentence listing the gates that failed, and a
// sentence is the one thing a bundle must not carry, so what is kept is the
// status Core left the adaptation in: `applied` or not.
//
// `applied` is Core's word, not a measurement of the Flow (adaptation plan G1).
// So the Flow is read before the first review and after the last, as hashes,
// and Core's own record of each adaptation's revisions is kept beside them: an
// applied repair whose Flow did not change was not kept, and
// `assertRepairPersisted` fails it.

import { createHash } from "node:crypto";
import { classifyRunnerFailure, RunnerFailure, type RunnerFailureCategory } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";

/**
 * - `no_proposal`: the run saved no adaptation, so there is nothing to apply.
 *   This is the correct outcome for a refusal task and is not a failure.
 * - `applied`: every adaptation the run saved is now `applied`.
 * - `not_applied`: at least one was not, whether Core refused the review or
 *   left it in another status.
 */
export const REPAIR_APPLICATION_OUTCOMES = ["no_proposal", "applied", "not_applied"] as const;

export type RepairApplicationOutcome = (typeof REPAIR_APPLICATION_OUTCOMES)[number];

/** One adaptation, and what the two review calls did to it. */
export type RepairAdaptationApplication = Readonly<{
  adaptationId: string;
  /** Core's status before the Lab reviewed it, or `null` when it could not be read. */
  statusBefore: string | null;
  /** Whether Core accepted the `approve` call. */
  approved: boolean;
  /** Whether Core accepted the `apply` call. */
  applyAccepted: boolean;
  /** Core's status afterwards. `applied` is the only one that counts. */
  statusAfter: string | null;
  /** Whether it was already `applied` before the Lab touched it -- an executed patch, made durable by Core itself. */
  alreadyApplied: boolean;
  /**
   * The category of the failure that refused a review, by the runner's own
   * vocabulary, and `null` when neither call was refused. Core answers a
   * refused promotion with a sentence naming the gates that failed; the
   * sentence is not kept, but the fact that it refused, and what kind of
   * failure it was, must not be lost either.
   */
  refusedBy: RunnerFailureCategory | null;
  /**
   * Core's Flow revisions for the adaptation, as its store states them after
   * the review (`metadata.phase9`, else `metadata`, as `measure.ts` reads
   * them): the revision it was proposed against and the one its apply made.
   * `null` where Core states none.
   */
  baseRevision: number | null;
  appliedRevision: number | null;
  /**
   * What, in Core's own record of the adaptation, shows the Flow changed:
   * `revision` when its applied revision is past its base (the transactional
   * graph store), `mutation` when its legacy application record holds a graph
   * whose steps differ before and after, `null` when neither does.
   */
  changeRecorded: "revision" | "mutation" | null;
}>;

/**
 * The saved Flow at one moment, as sha256 hashes of Core's own documents: the
 * parent Flow and every Subflow graph it owns, because Core writes a node
 * patch onto the Subflow's graph Flow rather than the parent.
 */
export type RepairFlowState = Readonly<{
  /** Every graph document whole. Core's apply stamp and timestamp move it on their own. */
  contentHash: string;
  /** Each graph's nodes and edges only: what runs. A stamp or a timestamp does not move it; a repair does. */
  stepsHash: string;
  /**
   * The parent first, then each Subflow graph by id. The parent's
   * `contentHash` is the hash `lab replay` records as `flowContentHash`, so a
   * later session can be checked against it; `updatedAt` is the version Core's
   * document states.
   */
  graphs: readonly Readonly<{ flowId: string; contentHash: string; updatedAt: number | null }>[];
}>;

/**
 * What the review did to the saved Flow:
 * - `changed`: the lane applied the repair and the Flow's steps moved.
 * - `unchanged`: the lane applied it and the steps did not move. Not kept.
 * - `changed_in_run`: Core had applied every adaptation inside the run, before
 *   the lane's first read, and its record of each shows the change.
 * - `unseen_in_run`: Core had applied one inside the run and nothing the lane
 *   can read shows the Flow changing. Unproven.
 */
export const REPAIR_FLOW_CHANGES = ["changed", "unchanged", "changed_in_run", "unseen_in_run"] as const;

export type RepairFlowChange = (typeof REPAIR_FLOW_CHANGES)[number];

export type RepairFlowEvidence = Readonly<{ before: RepairFlowState; after: RepairFlowState; change: RepairFlowChange }>;

export type RepairApplication = Readonly<{
  outcome: RepairApplicationOutcome;
  adaptations: readonly RepairAdaptationApplication[];
  /**
   * The saved Flow before the first review and after the last. Absent when
   * nothing was proposed, so nothing was read; an `applied` record without it
   * proves nothing, and `assertRepairPersisted` fails it.
   */
  flow?: RepairFlowEvidence;
}>;

export type RepairApplicationControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions): Promise<unknown>;
};

/** Core's adaptation statuses, as a status field may name one. Anything else is recorded as `null`. */
const STATUS = /^[a-z]+(?:_[a-z]+)*$/u;
const STATUS_MAX_LENGTH = 32;
/** The identifier shape the recovery record already holds every adaptation id to. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

/**
 * Approves and applies each adaptation the run saved, in the order Core
 * recorded them, reading the saved Flow before the first review and after the
 * last.
 *
 * An adaptation Core has already applied -- an executed patch under an
 * `explore_and_adapt` run -- is left alone rather than reviewed again, and
 * counts as applied. A review Core refuses is recorded as refused and the rest
 * are still attempted, so the record says how many of them landed rather than
 * stopping at the first.
 */
export async function applyLiveRepair(
  control: RepairApplicationControl,
  input: { projectId: string; flowId: string; adaptationIds: readonly string[] },
  bounds: FluxIQHttpOptions = {},
): Promise<RepairApplication> {
  if (input.adaptationIds.length === 0) return { outcome: "no_proposal", adaptations: [] };
  if (!input.adaptationIds.every((adaptationId) => IDENTIFIER.test(adaptationId))) throw new RunnerFailure("runtime.behavior", "Core named an adaptation whose id is not an identifier, so it cannot be reviewed");
  const before = await readFlowState(control, input, bounds);
  const adaptations: RepairAdaptationApplication[] = [];
  for (const adaptationId of input.adaptationIds) {
    const scope = { projectId: input.projectId, flowId: input.flowId, adaptationId };
    const stored = await readAdaptation(control, scope, bounds);
    if (stored.status === "applied") {
      adaptations.push({ adaptationId, statusBefore: stored.status, approved: false, applyAccepted: false, statusAfter: stored.status, alreadyApplied: true, refusedBy: null, ...stored.revisions });
      continue;
    }
    const approval = await review(control, scope, "approve", bounds);
    const application = approval.accepted ? await review(control, scope, "apply", bounds) : approval;
    const reviewed = await readAdaptation(control, scope, bounds);
    adaptations.push({
      adaptationId, statusBefore: stored.status, approved: approval.accepted, applyAccepted: approval.accepted && application.accepted,
      statusAfter: reviewed.status, alreadyApplied: false, refusedBy: application.refusedBy, ...reviewed.revisions,
    });
  }
  const after = await readFlowState(control, input, bounds);
  return {
    outcome: adaptations.every((item) => item.statusAfter === "applied") ? "applied" : "not_applied",
    adaptations,
    flow: { before, after, change: flowChangeOf(adaptations, before, after) },
  };
}

/**
 * Fails an applied repair that is not shown to be in the saved Flow (gate P4).
 * Anything but `applied` is left to `assertLiveRepairProof`, which names why
 * it was not applied.
 */
export function assertRepairPersisted(application: RepairApplication): void {
  if (application.outcome !== "applied") return;
  const change = application.flow?.change;
  if (change === "changed" || change === "changed_in_run") return;
  const details = {
    repairApplication: application.outcome,
    flowChange: change ?? null,
    adaptations: application.adaptations.map((item) => ({ adaptationId: item.adaptationId, alreadyApplied: item.alreadyApplied, baseRevision: item.baseRevision, appliedRevision: item.appliedRevision, changeRecorded: item.changeRecorded })),
  };
  if (change === "unchanged") throw new RunnerFailure("runtime.behavior", "Core reported the repair applied, but the saved Flow's steps are unchanged: the repair was not kept in the Flow", { details });
  if (change === "unseen_in_run") {
    const unseen = application.adaptations.filter((item) => item.alreadyApplied && item.changeRecorded === null).length;
    throw new RunnerFailure("runtime.behavior", `Core applied the repair inside the run, and neither the saved Flow nor Core's record of ${unseen} adaptation(s) shows the Flow changing (no applied revision past its base, no recorded graph change), so the repair's persistence is unproven`, { details });
  }
  throw new RunnerFailure("runtime.behavior", "The repair reads as applied, but the lane kept no record of the saved Flow before and after it, so its persistence is unproven", { details });
}

/**
 * The lane's own reads decide an adaptation it applied. Core's record decides
 * one Core had already applied in the run: the lane's first read came after
 * that change, so its own hashes cannot show it.
 */
function flowChangeOf(adaptations: readonly RepairAdaptationApplication[], before: RepairFlowState, after: RepairFlowState): RepairFlowChange {
  const unseenInRun = adaptations.some((item) => item.alreadyApplied && item.changeRecorded === null);
  if (adaptations.some((item) => !item.alreadyApplied)) {
    if (before.stepsHash === after.stepsHash) return "unchanged";
    return unseenInRun ? "unseen_in_run" : "changed";
  }
  return unseenInRun ? "unseen_in_run" : "changed_in_run";
}

/**
 * One review call, as a yes or a no and, when it is a no, the kind of failure
 * it was.
 *
 * A refusal is an outcome here rather than a fault: Core refuses a promotion
 * whose gates are unmet, and that is one of the things this lane exists to
 * find out. So the failure is classified and reported on the record instead of
 * ending the run -- the remaining adaptations are still attempted, and
 * `assertLiveRepairProof` is what fails the run afterwards. What is not kept is
 * Core's sentence, which names the gates in prose.
 */
async function review(
  control: RepairApplicationControl,
  scope: { projectId: string; flowId: string; adaptationId: string },
  action: "approve" | "apply",
  bounds: FluxIQHttpOptions,
): Promise<{ accepted: boolean; refusedBy: RunnerFailureCategory | null }> {
  try {
    await control.automationStudioCall("review-flow-adaptation", { ...scope, action }, bounds);
    return { accepted: true, refusedBy: null };
  } catch (error) {
    return { accepted: false, refusedBy: classifyRunnerFailure(error) };
  }
}

type AdaptationRevisions = Pick<RepairAdaptationApplication, "baseRevision" | "appliedRevision" | "changeRecorded">;

/**
 * Core's status for the adaptation, and its revisions. A read that fails is
 * not caught: it is not a refusal, it is the lane being unable to see what it
 * just did, and a run that cannot see that must not report an applied repair.
 */
async function readAdaptation(
  control: RepairApplicationControl,
  scope: { projectId: string; flowId: string; adaptationId: string },
  bounds: FluxIQHttpOptions,
): Promise<{ status: string | null; revisions: AdaptationRevisions }> {
  const adaptation = asRecord(asRecord(await control.automationStudioCall("get-flow-adaptation", scope, bounds))?.adaptation);
  const status = adaptation?.status;
  return { status: typeof status === "string" && status.length <= STATUS_MAX_LENGTH && STATUS.test(status) ? status : null, revisions: revisionsOf(adaptation) };
}

/**
 * The revisions Core's store states, and whether its record shows the Flow
 * changing. Core's legacy apply stores the base revision as the applied one,
 * so equal revisions say nothing; its application record then keeps each
 * graph it wrote, before and after (`applicationRecord.mutations`). The Flow
 * stamp it always adds (`promote_adaptation`) is not a change to the steps.
 */
function revisionsOf(adaptation: Record<string, unknown> | undefined): AdaptationRevisions {
  const metadata = asRecord(adaptation?.metadata);
  const phase9 = asRecord(metadata?.phase9);
  const baseRevision = countOf(phase9?.baseRevision) ?? countOf(metadata?.baseRevision);
  const appliedRevision = countOf(phase9?.appliedRevision) ?? countOf(metadata?.appliedRevision);
  const mutations = asRecord(metadata?.applicationRecord)?.mutations;
  const mutated = Array.isArray(mutations) && mutations.some((value) => {
    const mutation = asRecord(value);
    const graphBefore = asRecord(mutation?.before);
    const graphAfter = asRecord(mutation?.after);
    return mutation?.patchKind !== "promote_adaptation" && graphBefore !== undefined && graphAfter !== undefined && hashJson(stepsOf(graphBefore)) !== hashJson(stepsOf(graphAfter));
  });
  const changeRecorded = baseRevision !== null && appliedRevision !== null && appliedRevision > baseRevision ? "revision" : mutated ? "mutation" : null;
  return { baseRevision, appliedRevision, changeRecorded };
}

/**
 * The saved Flow now: the parent and every Subflow graph it lists, read the
 * way `readFlowNodes` reads them. A payload with no Flow throws: a missing
 * document is never hashed as an empty one.
 */
async function readFlowState(control: RepairApplicationControl, scope: { projectId: string; flowId: string }, bounds: FluxIQHttpOptions): Promise<RepairFlowState> {
  const listed = asRecord(await control.automationStudioCall("list-flow-subflows", { projectId: scope.projectId, flowId: scope.flowId, limit: 100, offset: 0 }, bounds));
  const paged = asRecord(listed?.page)?.subflows;
  const subflows: unknown[] = Array.isArray(listed?.subflows) ? listed.subflows : Array.isArray(paged) ? paged : [];
  const graphIds = [...new Set(subflows.map((value) => asRecord(value)?.graphFlowId).filter((id): id is string => typeof id === "string" && id.length > 0 && id !== scope.flowId))].sort();
  const documents: Array<{ flowId: string; document: Record<string, unknown> }> = [];
  for (const flowId of [scope.flowId, ...graphIds]) {
    const document = asRecord(asRecord(await control.automationStudioCall("get-flow", { projectId: scope.projectId, flowId }, bounds))?.flow);
    if (!document) throw new RunnerFailure("runtime.behavior", "Core's get-flow payload carried no Flow, so the repaired Flow cannot be measured", { details: { reasonCode: "repair.flow_unreadable" } });
    documents.push({ flowId, document });
  }
  return {
    contentHash: hashJson(documents.map(({ document }) => document)),
    stepsHash: hashJson(documents.map(({ flowId, document }) => ({ flowId, ...stepsOf(document) }))),
    graphs: documents.map(({ flowId, document }) => ({ flowId, contentHash: hashJson(document), updatedAt: typeof document.updatedAt === "number" && Number.isFinite(document.updatedAt) ? document.updatedAt : null })),
  };
}

/** A graph's nodes and edges: the part of a Flow document that runs. */
function stepsOf(document: Record<string, unknown>): { nodes: unknown; edges: unknown } {
  return { nodes: document.nodes ?? [], edges: document.edges ?? [] };
}

/** sha256 of key-sorted JSON: the hash `ExistingFluxIQControl.getExactFlow` gives a Flow document. */
function hashJson(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function countOf(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
