// Approving and applying the repair a live run produced.
//
// Core's recovery saves what it decided as an adaptation, and a proposal-only
// grant saves a change proposal beside it. Neither is in the Flow until someone
// reviews it: `evaluateFlowAdaptationPromotionGates` asks for evidence rather
// than for the absence of an objection, and the two things that satisfy it are
// a succeeded trial and a named reviewer's approval. The Lab is a named
// reviewer -- it calls Core as the account it logged in as -- so approving and
// then applying is the whole of what turns a proposal into a repaired Flow.
//
// This records status transitions and nothing else. Core refuses an apply with
// a sentence listing the gates that failed, and a sentence is the one thing a
// bundle must not carry, so what is kept is the status Core left the adaptation
// in: `applied` or not.

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
}>;

export type RepairApplication = Readonly<{
  outcome: RepairApplicationOutcome;
  adaptations: readonly RepairAdaptationApplication[];
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
 * recorded them.
 *
 * An adaptation Core has already applied -- an executed patch under an
 * `explore_and_adapt` grant -- is left alone rather than reviewed again, and
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
  const adaptations: RepairAdaptationApplication[] = [];
  for (const adaptationId of input.adaptationIds) {
    if (!IDENTIFIER.test(adaptationId)) throw new RunnerFailure("runtime.behavior", "Core named an adaptation whose id is not an identifier, so it cannot be reviewed");
    const scope = { projectId: input.projectId, flowId: input.flowId, adaptationId };
    const statusBefore = await readStatus(control, scope, bounds);
    if (statusBefore === "applied") {
      adaptations.push({ adaptationId, statusBefore, approved: false, applyAccepted: false, statusAfter: statusBefore, alreadyApplied: true, refusedBy: null });
      continue;
    }
    const approval = await review(control, scope, "approve", bounds);
    const application = approval.accepted ? await review(control, scope, "apply", bounds) : approval;
    adaptations.push({
      adaptationId, statusBefore, approved: approval.accepted, applyAccepted: approval.accepted && application.accepted,
      statusAfter: await readStatus(control, scope, bounds), alreadyApplied: false, refusedBy: application.refusedBy,
    });
  }
  return { outcome: adaptations.every((item) => item.statusAfter === "applied") ? "applied" : "not_applied", adaptations };
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

/**
 * Core's status for the adaptation. A read that fails is not caught: it is not
 * a refusal, it is the lane being unable to see what it just did, and a run
 * that cannot see that must not report an applied repair.
 */
async function readStatus(control: RepairApplicationControl, scope: { projectId: string; flowId: string; adaptationId: string }, bounds: FluxIQHttpOptions): Promise<string | null> {
  const adaptation = asRecord(asRecord(await control.automationStudioCall("get-flow-adaptation", scope, bounds))?.adaptation);
  const status = adaptation?.status;
  return typeof status === "string" && status.length <= STATUS_MAX_LENGTH && STATUS.test(status) ? status : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
