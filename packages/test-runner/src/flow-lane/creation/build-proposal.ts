// The one paid step of a created-Flow run: give Core the task's instruction,
// take out a `build_and_adapt` grant, and ask Core to explore the live page and
// propose a Flow -- the calls the web panel's "Explore and create proposal"
// makes (`authoring/BlankFlowAuthoringPanel.tsx`), in its order.
//
// Whatever Core answers becomes a `CreatedFlowBuild`: counts, codes and
// identifiers, never page content, a prompt or a reply. A refused build is a
// record too, not a throw, so the run can publish what the build spent before
// it fails on the refusal.

import { parseAutomationStudioFlowBootstrapFailureDiagnostic } from "fluxiq/automation-studio";
import type { ExistingFlowAdaptation, ExistingFlowAdaptationSummary, FlowBootstrapGenerationEnvelope } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { isBoundedHttpFailure, type FluxIQHttpOptions } from "../../http-control/index.js";

/** The longest one control request may wait (`http-control`'s own bound). */
const GENERATION_REQUEST_TIMEOUT_MS = 300_000;
/**
 * How long a build may still be running after it was dispatched: the grant's
 * claim window, Core's run lease once it is claimed
 * (`AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`), and the reply -- the
 * wait the web panel gives the same request (`WEBSITE_EXPLORATION_OVERALL_TIMEOUT_MS`).
 */
const GENERATION_DEADLINE_MS = 60_000 + 600_000 + 15_000;
const PROPOSAL_POLL_MS = 1_000;
/** The shape of a Core or domain identifier, such as `web.recovery.inspect` or `web.action.rejected.no_progress`. */
const VOCABULARY_ID = /^[a-z][a-z0-9_-]*(?:[.:][a-z0-9_-]+)*$/u;
const MAX_VOCABULARY_ID_LENGTH = 96;
/**
 * Core's own namespace. A step under it is a decision that called no tool --
 * Core records a refused plan as `core.decision_unusable`, with the first code
 * that refused it -- so it is kept as a step and never listed as a tool.
 */
const CORE_DECISION_STEP_PREFIX = "core.";

export type CreatedFlowBuildControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
  selectExistingContext(projectId: string, clientId?: string, bounds?: FluxIQHttpOptions, flowId?: string): Promise<void>;
  generateFlowBootstrapAdaptation(input: { projectId: string; flowId: string; llmExecutionGrantId: string; evidenceGuided: true; maxActionsPerDecision?: 1 | 16 }, bounds?: FluxIQHttpOptions): Promise<FlowBootstrapGenerationEnvelope>;
  listFlowAdaptations(projectId: string, flowId: string, status?: string): Promise<ExistingFlowAdaptationSummary[]>;
  getFlowAdaptation(projectId: string, flowId: string, adaptationId: string): Promise<ExistingFlowAdaptation>;
};

/** Clock and bounds for the build's wait. Production passes none. */
export type CreatedFlowBuildWait = { now?: () => number; sleep?: (ms: number) => Promise<void>; requestTimeoutMs?: number; deadlineMs?: number; pollMs?: number };

export type CreatedFlowBuildAccounting = Readonly<{ provider: string | null; model: string | null; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; estimatedCostUsd: number | null }>;
/** One decision the build's exploration made, in order: the tool it called, or Core's name for a decision that called none, and the code it came to. */
export type CreatedFlowBuildStep = Readonly<{ toolId: string; effectApplied?: boolean; resultCode?: string }>;
export type CreatedFlowBuildEvidenceLoop = Readonly<{ decisionCount: number | null; toolCallCount: number; evidenceBytes: number; toolIds: readonly string[]; steps: readonly CreatedFlowBuildStep[] | null }>;

/**
 * - `providerCalls`: the calls Core counted, from the proposal's evidence-loop
 *   audit or the refusal's decision count; `null` when Core did not say. Core
 *   does not itemize a build's calls one by one, so this count and
 *   `accounting`'s totals are all a build's per-call record can hold.
 * - `providerInvocation`: whether Core says it sent a provider request at all;
 *   `unknown` when the build outlived its request and no proposal appeared.
 * - `failure.code`: Core's own closed code for a refusal, or a `lab.` code
 *   for a refusal this lane made of Core's answer.
 * - `failure.issueCodes`: the codes Core says refused the last plan the model
 *   completed -- validation's or the domain's -- when it names any. Codes
 *   only; the plan paths and page content they refer to are never kept.
 * - `evidenceLoop.steps`: every decision of a refused build, in order, as
 *   Core recorded it; `toolIds` are the tools among them.
 * - `recoveredAfterTimeout`: the request outlived its HTTP bound and the
 *   proposal was found by polling, as the web panel does.
 * - `instructedConsequences`: the lasting consequences Core found the person's
 *   instruction asks for, each with the words it quoted, as stored on the
 *   proposal. `null` on a refused build, `[]` when the build asked nothing.
 * - `permissionRequest`: the request Core raised when the build needed a
 *   lasting consequence nobody allowed (`flow_bootstrap.permission_required`):
 *   what the action was, the control as the model was shown it, and which
 *   classes were missing. Core's own payload for the person, cut to those.
 */
export type CreatedFlowBuild = Readonly<{
  outcome: "proposed" | "failed";
  adaptationId: string | null;
  providerCalls: number | null;
  providerInvocation: "attempted" | "not_attempted" | "unknown";
  accounting: CreatedFlowBuildAccounting | null;
  evidenceLoop: CreatedFlowBuildEvidenceLoop | null;
  failure: Readonly<{ code: string; stage: string | null; httpStatus: number | null; issueCodes?: readonly string[] }> | null;
  recoveredAfterTimeout: boolean;
  durationMs: number;
  instructedConsequences: ReadonlyArray<Readonly<{ consequence: string; quote: string }>> | null;
  permissionRequest: CreatedFlowPermissionRequest | null;
}>;

export type CreatedFlowPermissionRequest = Readonly<{
  actionKind: string;
  verb: string;
  controlName: string | null;
  controlKind: string | null;
  consequences: readonly string[];
  missing: readonly string[];
  /** What Core read the person's instruction as asking for, each with the words it quoted. */
  instructed: ReadonlyArray<Readonly<{ consequence: string; quote: string }>>;
}>;

/**
 * Saves the instruction, authorizes, and builds. `authorize` takes out the
 * grant against the Flow as it stands once the instruction is saved, which is
 * the binding Core checks; a refusal there throws before anything is spent.
 */
export async function buildCreatedFlowProposal(
  control: CreatedFlowBuildControl,
  input: { projectId: string; flowId: string; instruction: string; authorize: (flowId: string) => Promise<{ grantId: string; maxActionsPerDecision?: 1 | 16 }> },
  bounds: FluxIQHttpOptions = {},
  wait: CreatedFlowBuildWait = {},
): Promise<CreatedFlowBuild> {
  const now = wait.now ?? Date.now;
  const saved = record(await control.automationStudioCall("save-flow-generation-instruction", { projectId: input.projectId, flowId: input.flowId, instruction: input.instruction }, bounds));
  if (record(saved.instruction).status !== "active") throw new RunnerFailure("runtime.behavior", "Core did not make the task's instruction the Flow's active instruction");
  const { grantId, maxActionsPerDecision } = await input.authorize(input.flowId);
  // Core's evidence tools act on the one connected client, in this project's context.
  await control.selectExistingContext(input.projectId, undefined, bounds, input.flowId);
  const startedAt = now();
  let envelope: FlowBootstrapGenerationEnvelope;
  try {
    envelope = await control.generateFlowBootstrapAdaptation(
      { projectId: input.projectId, flowId: input.flowId, llmExecutionGrantId: grantId, evidenceGuided: true, ...(maxActionsPerDecision === undefined ? {} : { maxActionsPerDecision }) },
      { timeoutMs: wait.requestTimeoutMs ?? GENERATION_REQUEST_TIMEOUT_MS, ...(bounds.signal ? { signal: bounds.signal } : {}) },
    );
  } catch (error) {
    // Core keeps building after the client has stopped waiting, and persists
    // the proposal when it is done, so a bounded request is not a failed build.
    if (!isBoundedHttpFailure(error)) throw error;
    const adaptationId = await awaitProposal(control, input, startedAt, wait);
    if (adaptationId === undefined) return failed({ code: "lab.generation_unfinished", stage: null, httpStatus: null }, "unknown", now() - startedAt);
    return proposed(control, input, adaptationId, true, now() - startedAt);
  }
  if (!envelope.ok) return refused(envelope, now() - startedAt);
  const adaptation = isRecord(envelope.payload) && isRecord(envelope.payload.adaptation) ? envelope.payload.adaptation : undefined;
  if (adaptation?.projectId !== input.projectId || adaptation.flowId !== input.flowId || adaptation.status !== "proposed" || typeof adaptation.adaptationId !== "string") {
    return failed({ code: "lab.generation_answer_invalid", stage: null, httpStatus: envelope.status }, "unknown", now() - startedAt);
  }
  return proposed(control, input, adaptation.adaptationId, false, now() - startedAt);
}

async function awaitProposal(control: CreatedFlowBuildControl, input: { projectId: string; flowId: string }, startedAt: number, wait: CreatedFlowBuildWait): Promise<string | undefined> {
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = startedAt + (wait.deadlineMs ?? GENERATION_DEADLINE_MS);
  while (now() < deadline) {
    const pending = await control.listFlowAdaptations(input.projectId, input.flowId, "proposed");
    if (pending.length > 1) throw new RunnerFailure("runtime.behavior", "Core left more than one pending proposal on the Flow a single build was asked for", { details: { pending: pending.length } });
    if (pending[0]) return pending[0].adaptationId;
    await sleep(Math.min(wait.pollMs ?? PROPOSAL_POLL_MS, Math.max(0, deadline - now())));
  }
  return undefined;
}

/**
 * A proposal, as Core's review surface describes it. It must be the pending
 * Flow bootstrap the build was asked for, and its audit must show that the
 * build explored the page and counted its provider calls: a proposal without
 * either cannot be shown to be what was paid for.
 */
async function proposed(control: CreatedFlowBuildControl, input: { projectId: string; flowId: string }, adaptationId: string, recoveredAfterTimeout: boolean, durationMs: number): Promise<CreatedFlowBuild> {
  const detail = await control.getFlowAdaptation(input.projectId, input.flowId, adaptationId);
  const loop = detail.evidenceLoop;
  const base = {
    adaptationId: detail.adaptationId,
    providerCalls: loop?.providerCallCount ?? null,
    // A proposal cannot exist without a provider's answer.
    providerInvocation: "attempted" as const,
    accounting: detail.accounting ? accountingOf(detail.accounting) : null,
    evidenceLoop: loop ? { decisionCount: loop.decisionCount ?? loop.providerCallCount ?? null, toolCallCount: loop.toolCallCount, evidenceBytes: loop.evidenceBytes, toolIds: vocabulary(loop.toolIds), steps: null } : null,
    recoveredAfterTimeout,
    durationMs,
    instructedConsequences: await instructedConsequencesOf(control, input, adaptationId),
    permissionRequest: null,
  };
  const problem = detail.status !== "proposed" || detail.adaptationKind !== "flow_bootstrap" ? "lab.proposal_not_pending_bootstrap"
    : !loop ? "lab.proposal_without_evidence_audit"
      : loop.providerCallCount === undefined ? "lab.proposal_without_call_count"
        : loop.toolCallCount < 1 || loop.evidenceBytes < 1 ? "lab.proposal_without_page_evidence"
          : undefined;
  if (problem) return Object.freeze({ ...base, outcome: "failed", failure: { code: problem, stage: null, httpStatus: null } });
  return Object.freeze({ ...base, outcome: "proposed", failure: null });
}

/** A refusal, read through Core's own diagnostic parser; a body that parser rejects keeps only its HTTP status. */
function refused(envelope: FlowBootstrapGenerationEnvelope, durationMs: number): CreatedFlowBuild {
  const payload = isRecord(envelope.payload) ? envelope.payload : {};
  const diagnostic = parseAutomationStudioFlowBootstrapFailureDiagnostic(payload.diagnostic);
  if (!diagnostic) return failed({ code: `lab.generation_http_${envelope.status}`, stage: null, httpStatus: envelope.status }, "unknown", durationMs);
  const loop = diagnostic.evidenceLoop;
  const issueCodes = [...new Set((diagnostic.issueCodes ?? []).filter(isVocabulary))];
  const steps = loop?.steps?.flatMap((step): CreatedFlowBuildStep[] => {
    if (!isVocabulary(step.toolId)) return [];
    return [{ toolId: step.toolId, ...(step.effectApplied === undefined ? {} : { effectApplied: step.effectApplied }), ...(step.resultCode !== undefined && isVocabulary(step.resultCode) ? { resultCode: step.resultCode } : {}) }];
  });
  return Object.freeze({
    outcome: "failed",
    adaptationId: null,
    providerCalls: diagnostic.providerInvocation === "not_attempted" ? 0 : loop?.decisionCount ?? null,
    providerInvocation: diagnostic.providerInvocation,
    accounting: diagnostic.accounting ? accountingOf(diagnostic.accounting) : null,
    evidenceLoop: loop ? { decisionCount: loop.decisionCount, toolCallCount: loop.toolCallCount, evidenceBytes: loop.evidenceBytes, toolIds: vocabulary((steps ?? []).map((step) => step.toolId)), steps: steps ?? null } : null,
    failure: { code: diagnostic.code, stage: diagnostic.stage, httpStatus: envelope.status, ...(issueCodes.length ? { issueCodes } : {}) },
    recoveredAfterTimeout: false,
    durationMs,
    instructedConsequences: null,
    permissionRequest: diagnostic.permissionRequest ? permissionRequestOf(diagnostic.permissionRequest) : null,
  });
}

function failed(failure: NonNullable<CreatedFlowBuild["failure"]>, providerInvocation: CreatedFlowBuild["providerInvocation"], durationMs: number): CreatedFlowBuild {
  return Object.freeze({ outcome: "failed", adaptationId: null, providerCalls: null, providerInvocation, accounting: null, evidenceLoop: null, failure, recoveredAfterTimeout: false, durationMs, instructedConsequences: null, permissionRequest: null });
}

function accountingOf(value: { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number }): CreatedFlowBuildAccounting {
  return {
    provider: value.provider !== undefined && isVocabulary(value.provider) ? value.provider : null,
    model: value.model !== undefined && isVocabulary(value.model) ? value.model : null,
    inputTokens: value.inputTokens ?? null,
    outputTokens: value.outputTokens ?? null,
    totalTokens: value.totalTokens ?? null,
    estimatedCostUsd: value.estimatedCostUsd ?? null,
  };
}

/** The distinct tool ids among `values`, sorted: identifiers only, and none of Core's own decision steps. */
function vocabulary(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => isVocabulary(value) && !value.startsWith(CORE_DECISION_STEP_PREFIX)))].sort();
}

function isVocabulary(value: string): boolean {
  return value.length <= MAX_VOCABULARY_ID_LENGTH && VOCABULARY_ID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new RunnerFailure("runtime.behavior", "Core answered the Flow build with a malformed payload");
  return value;
}

/** Core's request for the person, cut to what the build record needs to show it. */
function permissionRequestOf(request: { action: { kind: string; verb: string }; control: { name: string | null; kind: string | null }; consequences: readonly string[]; missing: readonly string[]; authority?: { instructed?: ReadonlyArray<{ consequence: string; quote: string }> } }): CreatedFlowPermissionRequest {
  return Object.freeze({
    actionKind: request.action.kind,
    verb: request.action.verb,
    controlName: request.control.name,
    controlKind: request.control.kind,
    consequences: Object.freeze([...request.consequences]),
    missing: Object.freeze([...request.missing]),
    instructed: Object.freeze((request.authority?.instructed ?? []).map((entry) => Object.freeze({ consequence: entry.consequence, quote: entry.quote.slice(0, 200) }))),
  });
}

/**
 * The instructed consequences stored on the proposal, read from Core's own
 * record of it. Only the class and the quoted words are kept: the instruction
 * id and digest are Core's to check, not the record's to show.
 */
async function instructedConsequencesOf(control: CreatedFlowBuildControl, input: { projectId: string; flowId: string }, adaptationId: string): Promise<CreatedFlowBuild["instructedConsequences"]> {
  const payload = await control.automationStudioCall("get-flow-adaptation", { projectId: input.projectId, flowId: input.flowId, adaptationId });
  const adaptation = isRecord(payload) && isRecord(payload.adaptation) ? payload.adaptation : undefined;
  const stored = adaptation?.instructedConsequences;
  if (!Array.isArray(stored)) return Object.freeze([]);
  return Object.freeze(stored.flatMap((entry) => isRecord(entry) && typeof entry.consequence === "string" && typeof entry.quote === "string"
    ? [Object.freeze({ consequence: entry.consequence, quote: entry.quote.slice(0, 200) })]
    : []));
}
