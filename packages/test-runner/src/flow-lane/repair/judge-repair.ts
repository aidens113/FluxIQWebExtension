// Whether a live run proposed the repair its scenario declared.
//
// The recovery record (`harness-recovery.ts`) says whether a target override
// was proposed and whether Core refused it, but not what it pointed at: the
// target is page data and stays in Core's adaptation. So the adaptation is read
// here, its target compared field by field with the declared one, and only the
// verdict and the names of the fields that differed leave this module.

import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { FLOW_REPAIR_TARGET_FIELDS, type FlowRepairExpectation, type FlowRepairTargetField } from "./declared-repair.js";

/**
 * - `repaired`: a saved proposal of the declared kind names the declared target.
 * - `wrong_target`: proposals of the declared kind were saved, and none names it.
 * - `refused`: Core refused every attempt of the declared kind at preflight.
 * - `not_proposed`: the recovery ran, and no attempt of the declared kind was made.
 * - `not_attempted`: Core recorded no recovery at all.
 * - `proposal_unreadable`: a proposal was saved and could not be read back.
 */
export const FLOW_REPAIR_VERDICTS = ["repaired", "wrong_target", "refused", "not_proposed", "not_attempted", "proposal_unreadable"] as const;

export type FlowRepairJudgement = Readonly<{
  verdict: (typeof FLOW_REPAIR_VERDICTS)[number];
  patchKind: FlowRepairExpectation["patchKind"];
  /** Saved proposals of the declared kind that were read. */
  proposals: number;
  /** For `wrong_target`: the declared fields the closest proposal did not match, by name only. */
  mismatchedFields: readonly FlowRepairTargetField[];
  /** For `refused`: the recovery record's codes for the refused attempts. */
  refusalCodes: readonly string[];
}>;

export type FlowRepairControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions): Promise<unknown>;
};

/** The change patch a target override becomes (Core `live-patch.ts` `changePatchFromRuntimePatch`). */
const PATCH_KIND_CHANGE: Readonly<Record<FlowRepairExpectation["patchKind"], string>> = { temporary_target_override: "edit_action_target" };

export async function judgeFlowRepair(
  control: FlowRepairControl,
  input: { projectId: string; flowId: string; run: Pick<PersistedFlowRunOutcome, "harnessRecovery">; expectation: FlowRepairExpectation },
  bounds: FluxIQHttpOptions = {},
): Promise<FlowRepairJudgement> {
  const { expectation } = input;
  const recovery = input.run.harnessRecovery;
  const judged = (verdict: FlowRepairJudgement["verdict"], extra: Partial<FlowRepairJudgement> = {}): FlowRepairJudgement =>
    ({ verdict, patchKind: expectation.patchKind, proposals: 0, mismatchedFields: [], refusalCodes: [], ...extra });
  if (!recovery.attempted) return judged("not_attempted");
  const attempts = recovery.runtimePatchAttempts.filter((attempt) => attempt.kind === expectation.patchKind);
  if (attempts.length === 0) return judged("not_proposed");
  const refusalCodes = [...new Set(attempts.filter((attempt) => attempt.preflightOk !== true).flatMap((attempt) => attempt.issueCodes))];
  if (!attempts.some((attempt) => attempt.adaptationCreated)) {
    return attempts.every((attempt) => attempt.preflightOk === false) ? judged("refused", { refusalCodes }) : judged("not_proposed", { refusalCodes });
  }
  const targets: Array<Record<string, unknown>> = [];
  for (const adaptationId of recovery.adaptationIds) {
    const adaptation = await readAdaptation(control, { projectId: input.projectId, flowId: input.flowId, adaptationId }, bounds);
    if (adaptation === undefined) return judged("proposal_unreadable", { refusalCodes });
    // A proposal is one the run also saved a change proposal for.
    if (typeof adaptation.proposalId !== "string" || !recovery.changeProposalIds.includes(adaptation.proposalId)) continue;
    const patches = Array.isArray(adaptation.patch) ? adaptation.patch : [];
    for (const patch of patches) {
      const record = asRecord(patch);
      const after = asRecord(record?.after);
      if (record?.kind === PATCH_KIND_CHANGE[expectation.patchKind] && after) targets.push(after);
    }
  }
  if (targets.length === 0) return judged("proposal_unreadable", { refusalCodes });
  const misses = targets.map((target) => mismatchedFields(expectation, target)).sort((left, right) => left.length - right.length);
  const closest = misses[0]!;
  return closest.length === 0
    ? judged("repaired", { proposals: targets.length, refusalCodes })
    : judged("wrong_target", { proposals: targets.length, mismatchedFields: closest, refusalCodes });
}

/**
 * Fails a run whose repair was judged and was not correct, after the judgement
 * was published. `runtime.behavior`, because what the model proposed is the
 * behaviour under test.
 */
export function assertFlowRepair(judgement: FlowRepairJudgement | undefined): void {
  if (!judgement || judgement.verdict === "repaired") return;
  const detail = judgement.verdict === "wrong_target"
    ? `its proposal named a different control (${judgement.mismatchedFields.join(", ")} differ)`
    : judgement.verdict === "refused"
      ? `Core refused it (${judgement.refusalCodes.join(", ") || "no code"})`
      : judgement.verdict === "not_proposed"
        ? `no ${judgement.patchKind} was proposed`
        : judgement.verdict === "not_attempted"
          ? "Core attempted no recovery"
          : "the proposal it saved could not be read back";
  throw new RunnerFailure("runtime.behavior", `The live repair was not the declared one: ${detail}`, {
    details: { repairVerdict: judgement.verdict, patchKind: judgement.patchKind, proposals: judgement.proposals, mismatchedFields: [...judgement.mismatchedFields], refusalCodes: [...judgement.refusalCodes] },
  });
}

/**
 * Where each declared field sits in the domain's resolved target: the
 * fingerprint flat, `controlType` in its metadata, and the visible text as the
 * name where the element has no separate accessible name.
 */
function mismatchedFields(expectation: FlowRepairExpectation, target: Record<string, unknown>): FlowRepairTargetField[] {
  const metadata = asRecord(target.metadata);
  const actual: Record<FlowRepairTargetField, unknown> = {
    tagName: target.tagName,
    accessibleName: target.accessibleName ?? target.visibleText,
    controlType: metadata?.controlType,
  };
  return FLOW_REPAIR_TARGET_FIELDS.filter((field) => expectation.target[field] !== undefined && actual[field] !== expectation.target[field]);
}

async function readAdaptation(control: FlowRepairControl, scope: { projectId: string; flowId: string; adaptationId: string }, bounds: FluxIQHttpOptions): Promise<Record<string, unknown> | undefined> {
  try {
    return asRecord(asRecord(await control.automationStudioCall("get-flow-adaptation", scope, bounds))?.adaptation);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
