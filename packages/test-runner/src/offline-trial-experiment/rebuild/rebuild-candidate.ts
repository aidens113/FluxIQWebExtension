// One submitted script rebuilt into the whole candidate its trial ran, through
// Core's own path and nothing else, and Core's digests of it checked against
// the recorded ones.
//
// The path is the build's, piece for piece (`./core-authoring.ts`): the brief's
// scope from the stored build record; the scoped submission controller reads
// the script and makes the proposal and its digest; the single-subflow
// assembly joins it into the whole Flow behind the arrival step and submits it
// through the whole candidate's controller, as a builder's `core.test_subflow`
// does on a one-subflow plan. Each controller is fresh, so the revision
// numbers are 1: a digest binds no revision number, and the recorded revision
// is reported beside it rather than written into Core's candidate.
//
// The domain's resolution of each step is the binding the caller hands in
// (`./recorded-resolution-binding.ts`, or the harvest's pairing binding).

import { AutomationStudioFlowCandidateSubmissionController } from "fluxiq/automation-studio";
import type { CoreAuthoring } from "./core-authoring.js";
import { jsonRecord } from "../json-record.js";
import type { CandidateRebuild, UnresolvedStep } from "../types.js";
import type { WebAuthoringSurroundings } from "./web-authoring-surroundings.js";

/** The build a rebuild belongs to: its stored record and candidate draft, where it started, and what it was checked against. */
export type RebuildContext = Readonly<{
  authoring: CoreAuthoring;
  surroundings: WebAuthoringSurroundings;
  /** The build's stored record (`./project-build-state.ts`). */
  record: Record<string, unknown>;
  /** The Flow's candidate draft: its project, Flow, base digest, instruction text and original sources are the build's. */
  draft: Record<string, unknown>;
  /** Where the build started, as the exploration trace's build context names it. */
  startLocation: string;
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

/** What a builder's single-subflow test names its assembled Flow (Core `project-agents/single-subflow/single-subflow-trial.ts`). */
const summaryOf = (subflowKey: string): string => `A Flow of one subflow, ${subflowKey}, assembled from its builder's proposal under test.`;

export async function rebuildSubflowCandidate(context: RebuildContext, request: RebuildRequest): Promise<CandidateRebuild> {
  const { authoring, surroundings, record, draft } = context;
  const candidate = jsonRecord(draft.candidate) ?? {};
  const briefs = Array.isArray(record.briefs) ? record.briefs : [];
  const brief = briefs.map((entry) => jsonRecord(jsonRecord(entry)?.brief)).find((entry) => entry?.briefId === request.briefId);
  if (!brief) throw new Error(`The build record holds no brief ${request.briefId}`);
  const plans = Array.isArray(record.plans) ? record.plans : [];
  const structure = jsonRecord(jsonRecord(plans.at(-1))?.plan);
  const { scope, siblings } = authoring.dispatchScope(record, brief);
  const submission = {
    projectId: draft.projectId as string, flowId: draft.flowId as string,
    registry: surroundings.registry, resolution: surroundings.resolution, binding: request.binding,
    baseDependencyDigest: candidate.baseDependencyDigest as string, startLocation: context.startLocation, handleReach: "view_history" as const,
  };
  const refused = (stage: "subflow" | "assembly" | "composed", codes: readonly string[], rebuiltDigest: string | null): CandidateRebuild => Object.freeze({
    briefId: request.briefId, submitStep: request.submitStep,
    subflow: Object.freeze({ recorded: request.recordedSubflow, rebuiltDigest, matches: rebuiltDigest === null || request.recordedSubflow === null ? null : rebuiltDigest === request.recordedSubflow.digest }),
    whole: Object.freeze({ recorded: request.recordedWhole, rebuiltDigest: null, matches: null }),
    candidate: null,
    refusal: Object.freeze({ stage, codes: Object.freeze([...codes]), unresolved: request.unresolved?.() ?? [] }),
  });
  const submitted = await authoring.scopedController({ scope, siblings, submission }).submit({ flow: request.script });
  if (!submitted.ok) return refused("subflow", submitted.check.issueCodes, null);
  const { proposal } = submitted;
  const wholeSubmission = {
    ...submission,
    instructionText: draft.instructionText as string,
    // A draft written before original sources were bound carries none, and its digest binds none (`candidate.plan` v1).
    ...(draft.originalSources === undefined ? {} : { originalSource: { originalSources: draft.originalSources, originalInstructionsDigest: draft.originalInstructionsDigest } }),
  };
  const controller = new AutomationStudioFlowCandidateSubmissionController(wholeSubmission as unknown as ConstructorParameters<typeof AutomationStudioFlowCandidateSubmissionController>[0]);
  const assembled = await authoring.assembleLatest({
    structure, controller, kept: new Map(), inHand: proposal,
    ports: { proposals: async () => undefined, submission: wholeSubmission },
    gate: { standing: () => undefined, refuted: () => undefined },
    from: [{ subflowKey: scope.subflowKey, briefId: scope.briefId, revision: proposal.revision, digest: proposal.digest, predecessors: scope.predecessors }],
    summary: summaryOf(scope.subflowKey),
  });
  if (!assembled.ok) return refused(assembled.kind, assembled.kind === "assembly" ? assembled.issues.map((issue) => issue.code) : [assembled.code, ...assembled.issueCodes], proposal.digest);
  const whole = assembled.candidate;
  return Object.freeze({
    briefId: request.briefId, submitStep: request.submitStep,
    subflow: Object.freeze({ recorded: request.recordedSubflow, rebuiltDigest: proposal.digest, matches: request.recordedSubflow === null ? null : proposal.digest === request.recordedSubflow.digest }),
    whole: Object.freeze({ recorded: request.recordedWhole, rebuiltDigest: whole.digest, matches: request.recordedWhole === null ? null : whole.digest === request.recordedWhole.digest }),
    candidate: whole,
    refusal: null,
  });
}
