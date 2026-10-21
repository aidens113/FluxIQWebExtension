// One submitted script rebuilt into the whole candidate its trial ran, through
// Core's own path and nothing else, and Core's digests of it checked against
// the recorded ones.
//
// The path is Core's exported rebuild seam
// (`automationStudioProjectSingleSubflowRebuild`), the build's own pieces in the
// build's order: the brief's scope from the stored build record; the scoped
// submission controller reads the script and makes the proposal and its
// digest; the single-subflow assembly joins it into the whole Flow behind the
// arrival step and submits it through the whole candidate's controller, as a
// builder's `core.test_subflow` does on a one-subflow plan. Each controller is
// fresh, so the revision numbers are 1: a digest binds no revision number, and
// the recorded revision is reported beside it rather than written into Core's
// candidate.
//
// The domain's resolution of each step is the binding the caller hands in
// (`./recorded-resolution-binding.ts`, or the harvest's pairing binding).

import { automationStudioProjectSingleSubflowRebuild, type AutomationStudioProjectSingleSubflowRebuildInput } from "fluxiq/automation-studio";
import { jsonRecord } from "../json-record.js";
import type { CandidateRebuild, UnresolvedStep } from "../types.js";
import type { WebAuthoringSurroundings } from "./web-authoring-surroundings.js";

/** Core's rebuild seam, or a stand-in of its shape in a test. */
export type SubflowRebuild = typeof automationStudioProjectSingleSubflowRebuild;

/** The build a rebuild belongs to: its stored record and candidate draft, where it started, and what it was checked against. */
export type RebuildContext = Readonly<{
  surroundings: WebAuthoringSurroundings;
  /** The build's stored record (`./project-build-state.ts`). */
  record: Record<string, unknown>;
  /** The Flow's candidate draft: its project, Flow, base digest, instruction text and original sources are the build's. */
  draft: Record<string, unknown>;
  /** Where the build started, as the exploration trace's build context names it. */
  startLocation: string;
  /** The rebuild; Core's exported seam unless a test stands one in. */
  rebuild?: SubflowRebuild;
}>;

export type RebuildRequest = Readonly<{
  briefId: string;
  /** The script as Core accepted it (Lab step file); page content, never printed. */
  script: string;
  submitStep: number | null;
  recordedSubflow: Readonly<{ revision: number; digest: string }> | null;
  recordedWhole: Readonly<{ revision: number; digest: string }> | null;
  /** The domain binding Core asks to resolve each step: `{ runsNodes, resolvePlanNodeParameters }`. */
  binding: object;
  /** The binding's refused steps, read after a refusal. */
  unresolved?: () => readonly UnresolvedStep[];
}>;

/**
 * Rebuilds `request.script` for its brief and compares Core's digests with the
 * recorded ones. Throws Core's record refusal for a brief the record does not
 * hold or one written against an older plan.
 */
export async function rebuildSubflowCandidate(context: RebuildContext, request: RebuildRequest): Promise<CandidateRebuild> {
  const { surroundings, draft } = context;
  const candidate = jsonRecord(draft.candidate) ?? {};
  const submission = {
    projectId: draft.projectId as string, flowId: draft.flowId as string,
    registry: surroundings.registry, resolution: surroundings.resolution, binding: request.binding,
    baseDependencyDigest: candidate.baseDependencyDigest as string, startLocation: context.startLocation, handleReach: "view_history" as const,
  } as unknown as AutomationStudioProjectSingleSubflowRebuildInput["submission"];
  const rebuilt = await (context.rebuild ?? automationStudioProjectSingleSubflowRebuild)({
    record: context.record as unknown as AutomationStudioProjectSingleSubflowRebuildInput["record"],
    briefId: request.briefId,
    script: request.script,
    submission,
    instructionText: draft.instructionText as string,
    // A draft written before original sources were bound carries none, and its digest binds none (`candidate.plan` v1).
    ...(draft.originalSources === undefined ? {} : {
      originalSource: { originalSources: draft.originalSources, originalInstructionsDigest: draft.originalInstructionsDigest } as unknown as AutomationStudioProjectSingleSubflowRebuildInput["originalSource"],
    }),
  });
  const subflowDigest = rebuilt.proposal?.digest ?? null;
  const subflow = Object.freeze({
    recorded: request.recordedSubflow, rebuiltDigest: subflowDigest,
    matches: subflowDigest === null || request.recordedSubflow === null ? null : subflowDigest === request.recordedSubflow.digest,
  });
  if (!rebuilt.ok) {
    return Object.freeze({
      briefId: request.briefId, submitStep: request.submitStep, subflow,
      whole: Object.freeze({ recorded: request.recordedWhole, rebuiltDigest: null, matches: null }),
      candidate: null,
      refusal: Object.freeze({ stage: rebuilt.stage, codes: Object.freeze([...rebuilt.codes]), unresolved: request.unresolved?.() ?? [] }),
    });
  }
  const whole = rebuilt.candidate;
  return Object.freeze({
    briefId: request.briefId, submitStep: request.submitStep, subflow,
    whole: Object.freeze({ recorded: request.recordedWhole, rebuiltDigest: whole.digest, matches: request.recordedWhole === null ? null : whole.digest === request.recordedWhole.digest }),
    candidate: whole,
    refusal: null,
  });
}
