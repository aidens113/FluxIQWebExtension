import { randomBytes } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, assertLlmExecutionProfile, type LlmExecutionProfile, type LlmInvocationProvenance, type LlmModel, type LlmRunEvaluation, validateLlmRunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { adaptationCallCountWithinGrant } from "./demo-llm-adaptation-control.js";
import { RunnerFailure } from "./failure.js";
import { attestWorkspaceSecretAbsence } from "./secret-leak-attestation.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

export const FIRST_LIVE_ADAPTATION_PROFILE: Readonly<LlmExecutionProfile> = Object.freeze({
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "deepseek-runtime-adaptation-first-live",
  mode: "live",
  provider: "deepseek",
  model: DEFAULT_LLM_MODEL,
  task: "adapt",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: {
    // Runtime repair carries the diagnosis, bounded failure context, and the
    // patch/no-repair schema. Use the same model-sized request profile as the
    // live creation lane so the provider adapter's full visible prompt fits.
    maxInputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens,
    maxOutputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens,
    maxTotalTokensPerRequest: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest,
    // A ceiling, not the count this demo certifies: an adaptation iterates for
    // as many calls as it needs, and the certificate below records what it made.
    maxCallsPerRun: DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun,
    timeoutMs: DEFAULT_LLM_LAB_BUDGET.timeoutMs,
    maxRetries: 0,
    maxEstimatedCostUsd: 0.25,
  },
});
assertLlmExecutionProfile(FIRST_LIVE_ADAPTATION_PROFILE);

type StartingGraph = Readonly<{
  creationCertified: true;
  projectId: string;
  flowId: string;
  startingExecutionDigest: string;
  ownedSubflowCount: 1;
  routerSubflowRouteCount: 1;
  nodeCount: number;
  executableNodeCount: number;
  recordingCount: number;
  recordingProvenanceAbsent: true;
}>;

type SemanticDrift = Readonly<{
  kind: "semantic-target";
  scenarioId: string;
  beforeTargetFingerprint: string;
  afterTargetFingerprint: string;
  introducedBeforeRun: true;
  observed: true;
}>;

type FailedAction = Readonly<{
  runId: string;
  attemptId: string;
  sequence: number;
  status: "failed";
  providerCallCountBeforeFailure: 0;
}>;

/** Each purpose's pinned prompt schema, and the loop stage Core stages it at as `<schema>+stage.<stage>`. */
const PROMPTS = { runtime_diagnosis: ["automation-studio.runtime-diagnosis.v1", "gather"], runtime_evidence: ["automation-studio.evidence-tool-decision.v1", "gather"], runtime_patch: ["automation-studio.runtime-patch.v1", "implement"] } as const;

type AdaptationInvocationPurpose = keyof typeof PROMPTS;

/** One provider call the adapting run made. Each record is exactly one call, never a retry. */
export type DemoLlmAdaptationInvocation<Purpose extends AdaptationInvocationPurpose = AdaptationInvocationPurpose> = Readonly<{
  requestId: string;
  purpose: Purpose;
  provider: "deepseek";
  model: LlmModel;
  promptSchemaVersion: string;
  sequence: number;
  attempt: 1;
  retryCount: 0;
  providerCallCount: 1;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}>;

type AppliedAdaptation = Readonly<{
  adaptationId: string;
  requestId: string;
  baseExecutionDigest: string;
  resultingExecutionDigest: string;
  validationOk: true;
  stale: false;
  concurrentMutationDetected: false;
  reviewOutcome: "approved";
  approvalChannel: "human-ui";
  mutationObservedBeforeApproval: false;
  outcome: "applied";
  applySequence: number;
  structuralChange: false;
  externalSideEffectEscalation: false;
  authorizationExpansion: false;
  unsupportedOutputCount: 0;
  recordingCount: number;
  recordingProvenanceAbsent: true;
}>;

type PostApplyValidation = Readonly<{
  runId: string;
  status: "succeeded";
  completionSequence: number;
  executionDigest: string;
  providerCallCount: 0;
  interventionCount: 0;
  diagnosisCount: 0;
  adaptationCount: 0;
  actionAttemptCount: number;
  succeededActionCount: number;
}>;

type FinalReplay = Readonly<{
  runId: string;
  status: "succeeded";
  executionDigest: string;
  providerCallCount: 0;
  interventionCount: 0;
  adaptationCount: 0;
  actionAttemptCount: number;
  succeededActionCount: number;
}>;

/** The diagnosis, every evidence-gathering call in order, then the patch. */
export type DemoLlmAdaptationInvocations = readonly [DemoLlmAdaptationInvocation<"runtime_diagnosis">, ...DemoLlmAdaptationInvocation<"runtime_evidence">[], DemoLlmAdaptationInvocation<"runtime_patch">];

export type DemoLlmAdaptationCertificationInput = Readonly<{
  schemaVersion: "0.1";
  operationId: string;
  startingGraph: StartingGraph;
  drift: SemanticDrift;
  failedAction: FailedAction;
  /** Every provider call the adapting run made, exactly as Core's run detail reports it. */
  providerCallCount: number;
  /**
   * One record for every one of those calls, in order: the diagnosis, any
   * calls that gathered evidence, then the patch. A run that iterated is
   * described in full, so a certificate can never report fewer calls than the
   * run spent.
   */
  invocations: DemoLlmAdaptationInvocations;
  adaptation: AppliedAdaptation;
  postApplyValidation: PostApplyValidation;
  finalReplay: FinalReplay;
}>;

export type DemoLlmAdaptationResult = Readonly<{
  schemaVersion: "0.1";
  status: "passed";
  profileId: string;
  operationId: string;
  projectId: string;
  flowId: string;
  runId: string;
  driftKind: "semantic-target";
  startingExecutionDigest: string;
  resultingExecutionDigest: string;
  failedActionAttemptId: string;
  adaptationId: string;
  /** What the run spent: one diagnosis, `evidenceCallCount` evidence calls, and one patch. */
  providerCallCount: number;
  evidenceCallCount: number;
  retryCount: 0;
  reviewOutcome: "approved";
  applyOutcome: "applied";
  postApplyValidationStatus: "succeeded";
  recordingCountBefore: number;
  recordingCountAfter: number;
  recordingProvenanceAbsent: true;
  finalReplayRunId: string;
  finalReplayProviderCallCount: 0;
  evaluation: LlmRunEvaluation;
  leakAttestation: { status: "passed"; scannedFiles: number; scannedBytes: number; findingCount: 0 };
}>;

// Typed, so a caller that leaves a field out -- the run's call count, say -- fails
// to compile; it took `unknown` and so accepted anything. Parsed as well, since
// every value in it was read from a live run.
export function evaluateDemoLlmAdaptation(input: DemoLlmAdaptationCertificationInput): Omit<DemoLlmAdaptationResult, "leakAttestation"> {
  const parsed = parseAdaptationInput(input);
  const diagnosisInvocation = parsed.invocations[0];
  const patchInvocation = parsed.invocations[parsed.invocations.length - 1]!;
  const evidenceCallCount = parsed.invocations.length - 2;
  // The diagnosis and the patch are the run's two interventions; a call that
  // gathered evidence leaves none behind.
  if (!adaptationCallCountWithinGrant({ providerCallCount: parsed.providerCallCount, interventions: [diagnosisInvocation, patchInvocation] })) {
    fail("Runtime adaptation made a provider call count its grant could not have produced");
  }
  const budget = FIRST_LIVE_ADAPTATION_PROFILE.budget;
  for (const invocation of parsed.invocations) {
    if (invocation.inputTokens > budget.maxInputTokens
      || invocation.outputTokens > budget.maxOutputTokens
      || invocation.totalTokens > budget.maxTotalTokensPerRequest
      || invocation.inputTokens + invocation.outputTokens !== invocation.totalTokens
      || invocation.estimatedCostUsd > budget.maxEstimatedCostUsd) fail("Runtime adaptation provider accounting violated its strict budget");
  }
  if (parsed.startingGraph.nodeCount < 1 || parsed.startingGraph.executableNodeCount !== parsed.startingGraph.nodeCount) fail("Runtime adaptation did not start from a creation-certified executable graph");
  // The project may hold other Flows' recordings (the demo's recording-driven
  // diagnosis Flow lives beside this one); a repair must add none, and the
  // repaired Flow must carry no recording provenance. Both are checked below.
  if (parsed.drift.beforeTargetFingerprint === parsed.drift.afterTargetFingerprint) fail("Runtime adaptation requires an observed semantic target change");
  // Failure, then every provider call in the order recorded, then apply, then
  // the first deterministic validation run, each strictly after the last.
  const sequences = [parsed.failedAction.sequence, ...parsed.invocations.map(invocation => invocation.sequence), parsed.adaptation.applySequence, parsed.postApplyValidation.completionSequence];
  if (sequences.some((sequence, index) => index > 0 && sequence <= sequences[index - 1]!)) fail("Runtime adaptation event ordering is invalid");
  if (parsed.adaptation.requestId !== patchInvocation.requestId
    || parsed.adaptation.baseExecutionDigest !== parsed.startingGraph.startingExecutionDigest
    || parsed.adaptation.resultingExecutionDigest === parsed.startingGraph.startingExecutionDigest) fail("Runtime adaptation was stale, unbound, concurrent, or unchanged");
  if (parsed.postApplyValidation.runId === parsed.failedAction.runId
    || parsed.postApplyValidation.executionDigest !== parsed.adaptation.resultingExecutionDigest
    || parsed.postApplyValidation.actionAttemptCount < 1
    || parsed.postApplyValidation.succeededActionCount !== parsed.postApplyValidation.actionAttemptCount) fail("Post-apply deterministic validation did not complete successfully");
  if (parsed.adaptation.recordingCount !== parsed.startingGraph.recordingCount) fail("Runtime adaptation changed recordings or introduced recording provenance");
  if (parsed.finalReplay.executionDigest !== parsed.adaptation.resultingExecutionDigest
    || parsed.finalReplay.runId === parsed.failedAction.runId
    || parsed.finalReplay.runId === parsed.postApplyValidation.runId
    || parsed.finalReplay.actionAttemptCount < 1
    || parsed.finalReplay.succeededActionCount !== parsed.finalReplay.actionAttemptCount) fail("Final deterministic replay failed, used LLM assistance, or used an inconsistent Flow");

  const provenance = parsed.invocations.map((invocation): LlmInvocationProvenance => ({
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    requestId: invocation.requestId,
    profileId: FIRST_LIVE_ADAPTATION_PROFILE.profileId,
    provider: invocation.provider,
    model: invocation.model,
    task: "adapt",
    promptSchemaVersion: PROMPTS[invocation.purpose][0],
    attempt: 1,
    inputTokens: invocation.inputTokens,
    outputTokens: invocation.outputTokens,
    totalTokens: invocation.totalTokens,
    usageSource: "provider-reported",
    latencyMs: invocation.latencyMs,
    estimatedCostUsd: invocation.estimatedCostUsd,
    outcome: "succeeded",
    sanitized: true,
    rawPromptRetained: false,
    rawResponseRetained: false,
  }));
  const evaluation: LlmRunEvaluation = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    runId: parsed.failedAction.runId,
    profileId: FIRST_LIVE_ADAPTATION_PROFILE.profileId,
    task: "adapt",
    invocations: provenance,
    maxCallsPerRun: FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun,
    proposalValidated: true,
    reviewOutcome: "approved",
    applyOutcome: "applied",
    deterministicReplay: { required: true, completed: true, passed: true, llmCalls: 0 },
    safetyPassed: true,
    verdict: "passed",
    reasons: [
      `A failed action preceded one reviewed runtime adaptation bound to the exact starting digest, reached in ${parsed.providerCallCount} provider calls: one diagnosis, ${evidenceCallCount} gathering evidence, and one patch.`,
      "The manually applied change passed two separate deterministic validation runs without recording provenance or additional LLM calls.",
    ],
  };
  if (!validateLlmRunEvaluation(evaluation).valid) fail("Sanitized adaptation evaluation violated its fixed contract");
  return Object.freeze({
    schemaVersion: "0.1",
    status: "passed",
    profileId: FIRST_LIVE_ADAPTATION_PROFILE.profileId,
    operationId: parsed.operationId,
    projectId: parsed.startingGraph.projectId,
    flowId: parsed.startingGraph.flowId,
    runId: parsed.failedAction.runId,
    driftKind: "semantic-target",
    startingExecutionDigest: parsed.startingGraph.startingExecutionDigest,
    resultingExecutionDigest: parsed.adaptation.resultingExecutionDigest,
    failedActionAttemptId: parsed.failedAction.attemptId,
    adaptationId: parsed.adaptation.adaptationId,
    providerCallCount: parsed.providerCallCount,
    evidenceCallCount,
    retryCount: 0,
    reviewOutcome: "approved",
    applyOutcome: "applied",
    postApplyValidationStatus: "succeeded",
    recordingCountBefore: parsed.startingGraph.recordingCount,
    recordingCountAfter: parsed.adaptation.recordingCount,
    recordingProvenanceAbsent: true,
    finalReplayRunId: parsed.finalReplay.runId,
    finalReplayProviderCallCount: 0,
    evaluation,
  });
}

export async function persistDemoLlmAdaptationResult(workspaceDirectory: string, result: Omit<DemoLlmAdaptationResult, "leakAttestation">, sensitiveLiterals: readonly string[]): Promise<DemoLlmAdaptationResult> {
  const root = path.resolve(workspaceDirectory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const target = path.join(root, "demo-llm-adaptation-result.json");
  const serialized = JSON.stringify(result, null, 2) + "\n";
  if (sensitiveLiterals.some(value => value.length > 0 && serialized.includes(value))) fail("Sanitized adaptation result contains credential material", "recording.persistence");
  await atomicWrite(target, serialized);
  let scannedFiles = 0;
  let scannedBytes = 0;
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: literal, approvedRelativePaths: ["demo-llm-adaptation-result.json"] });
    if (report.status !== "passed") fail("Adaptation result leak attestation failed", "recording.persistence");
    scannedFiles = Math.max(scannedFiles, report.scannedFiles);
    scannedBytes = Math.max(scannedBytes, report.scannedBytes);
  }
  const complete: DemoLlmAdaptationResult = Object.freeze({ ...result, leakAttestation: { status: "passed" as const, scannedFiles, scannedBytes, findingCount: 0 as const } });
  await atomicWrite(target, JSON.stringify(complete, null, 2) + "\n");
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: literal, approvedRelativePaths: ["demo-llm-adaptation-result.json"] });
    if (report.status !== "passed") fail("Final adaptation result leak attestation failed", "recording.persistence");
  }
  return complete;
}

function parseAdaptationInput(input: unknown): DemoLlmAdaptationCertificationInput {
  rejectForbiddenFields(input);
  const root = exact(input, ["schemaVersion", "operationId", "startingGraph", "drift", "failedAction", "providerCallCount", "invocations", "adaptation", "postApplyValidation", "finalReplay"]);
  requireLiteral(root.schemaVersion, "0.1");
  const start = exact(root.startingGraph, ["creationCertified", "projectId", "flowId", "startingExecutionDigest", "ownedSubflowCount", "routerSubflowRouteCount", "nodeCount", "executableNodeCount", "recordingCount", "recordingProvenanceAbsent"]);
  requireLiteral(start.creationCertified, true); requireLiteral(start.ownedSubflowCount, 1); requireLiteral(start.routerSubflowRouteCount, 1); requireLiteral(start.recordingProvenanceAbsent, true);
  const drift = exact(root.drift, ["kind", "scenarioId", "beforeTargetFingerprint", "afterTargetFingerprint", "introducedBeforeRun", "observed"]);
  requireLiteral(drift.kind, "semantic-target"); requireLiteral(drift.introducedBeforeRun, true); requireLiteral(drift.observed, true);
  const failure = exact(root.failedAction, ["runId", "attemptId", "sequence", "status", "providerCallCountBeforeFailure"]);
  requireLiteral(failure.status, "failed"); requireLiteral(failure.providerCallCountBeforeFailure, 0);
  // An adaptation iterates for as many calls as it needs, so the certificate
  // holds one record for every call the run reported rather than a fixed pair.
  // A run whose calls are not all recorded is refused, never understated.
  integer(root.providerCallCount);
  if (!Array.isArray(root.invocations) || root.invocations.length < 2) fail("Runtime adaptation requires a diagnosis invocation and a patch invocation");
  if (root.invocations.length !== root.providerCallCount) {
    fail(`Runtime adaptation certificate records ${root.invocations.length} provider invocations, but the run made ${root.providerCallCount} provider calls; every call must be recorded`);
  }
  const invocations = root.invocations.map(value => exact(value, ["requestId", "purpose", "provider", "model", "promptSchemaVersion", "sequence", "attempt", "retryCount", "providerCallCount", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "latencyMs"]));
  const last = invocations.length - 1;
  invocations.forEach((invocation, index) => {
    const purpose: AdaptationInvocationPurpose = index === 0 ? "runtime_diagnosis" : index === last ? "runtime_patch" : "runtime_evidence";
    if (invocation.purpose !== purpose) fail("Runtime adaptation requires exactly one diagnosis first, exactly one patch last, and only evidence-gathering calls between them");
    const [schema, stage] = PROMPTS[purpose];
    const base = typeof invocation.promptSchemaVersion === "string" ? invocation.promptSchemaVersion.split("+")[0] : undefined;
    if (purpose === "runtime_evidence" && (base === PROMPTS.runtime_diagnosis[0] || base === PROMPTS.runtime_patch[0])) fail("An evidence-gathering invocation must not carry the diagnosis or patch prompt");
    if (invocation.promptSchemaVersion !== schema && invocation.promptSchemaVersion !== `${schema}+stage.${stage}`) requireLiteral(invocation.promptSchemaVersion, schema);
  });
  if (new Set(invocations.map(invocation => invocation.requestId)).size !== invocations.length) fail("Runtime adaptation provider invocations must have distinct request identities");
  for (const invocation of invocations) { requireLiteral(invocation.provider, "deepseek"); requireLiteral(invocation.model, DEFAULT_LLM_MODEL); requireLiteral(invocation.attempt, 1); requireLiteral(invocation.retryCount, 0); requireLiteral(invocation.providerCallCount, 1); }
  const adaptation = exact(root.adaptation, ["adaptationId", "requestId", "baseExecutionDigest", "resultingExecutionDigest", "validationOk", "stale", "concurrentMutationDetected", "reviewOutcome", "approvalChannel", "mutationObservedBeforeApproval", "outcome", "applySequence", "structuralChange", "externalSideEffectEscalation", "authorizationExpansion", "unsupportedOutputCount", "recordingCount", "recordingProvenanceAbsent"]);
  requireLiteral(adaptation.validationOk, true); requireLiteral(adaptation.stale, false); requireLiteral(adaptation.concurrentMutationDetected, false); requireLiteral(adaptation.reviewOutcome, "approved"); requireLiteral(adaptation.approvalChannel, "human-ui"); requireLiteral(adaptation.mutationObservedBeforeApproval, false); requireLiteral(adaptation.outcome, "applied"); requireLiteral(adaptation.structuralChange, false); requireLiteral(adaptation.externalSideEffectEscalation, false); requireLiteral(adaptation.authorizationExpansion, false); requireLiteral(adaptation.unsupportedOutputCount, 0); requireLiteral(adaptation.recordingProvenanceAbsent, true);
  const validation = exact(root.postApplyValidation, ["runId", "status", "completionSequence", "executionDigest", "providerCallCount", "interventionCount", "diagnosisCount", "adaptationCount", "actionAttemptCount", "succeededActionCount"]);
  requireLiteral(validation.status, "succeeded"); requireLiteral(validation.providerCallCount, 0); requireLiteral(validation.interventionCount, 0); requireLiteral(validation.diagnosisCount, 0); requireLiteral(validation.adaptationCount, 0);
  const replay = exact(root.finalReplay, ["runId", "status", "executionDigest", "providerCallCount", "interventionCount", "adaptationCount", "actionAttemptCount", "succeededActionCount"]);
  requireLiteral(replay.status, "succeeded"); requireLiteral(replay.providerCallCount, 0); requireLiteral(replay.interventionCount, 0); requireLiteral(replay.adaptationCount, 0);
  for (const value of [root.operationId, start.projectId, start.flowId, start.startingExecutionDigest, drift.scenarioId, drift.beforeTargetFingerprint, drift.afterTargetFingerprint, failure.runId, failure.attemptId, ...invocations.map(invocation => invocation.requestId), adaptation.adaptationId, adaptation.requestId, adaptation.baseExecutionDigest, adaptation.resultingExecutionDigest, validation.runId, validation.executionDigest, replay.runId, replay.executionDigest]) identifier(value);
  for (const value of [start.nodeCount, start.executableNodeCount, start.recordingCount, failure.sequence, ...invocations.flatMap(invocation => [invocation.sequence, invocation.inputTokens, invocation.outputTokens, invocation.totalTokens, invocation.latencyMs]), adaptation.applySequence, adaptation.recordingCount, validation.completionSequence, validation.actionAttemptCount, validation.succeededActionCount, replay.actionAttemptCount, replay.succeededActionCount]) integer(value);
  for (const invocation of invocations) finite(invocation.estimatedCostUsd);
  return input as DemoLlmAdaptationCertificationInput;
}

function rejectForbiddenFields(input: unknown): void {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value as object)) fail("Adaptation certification input is cyclic");
    seen.add(value as object);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
      if (/^(?:rawprompt|rawresponse|apikey|keyid|keyreference|secret|credential|password|pin|authorizationheader|authorizationtoken|lastrecordingid|recordingid|recordingevents|recordingevidence|recordingmetadata)$/u.test(normalized)) fail("Adaptation certification input contains forbidden sensitive or recording material");
      visit(child);
    }
  };
  visit(input);
}

function exact(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Adaptation certification input has an invalid object");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some(key => !allowed.includes(key)) || allowed.some(key => !(key in object))) fail("Adaptation certification input has missing or unsupported fields");
  return object;
}
function identifier(value: unknown): asserts value is string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(value) || /(?:api[-_]?key|password|credential|authorization|secret|recording)/iu.test(value)) fail("Adaptation certification identifier is invalid"); }
function integer(value: unknown): asserts value is number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("Adaptation certification accounting must be finite nonnegative integers"); }
function finite(value: unknown): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail("Adaptation certification cost must be finite and nonnegative"); }
function requireLiteral<T>(value: unknown, expected: T): asserts value is T { if (value !== expected) fail("Adaptation certification fixed safety fact was not satisfied"); }
function fail(message: string, category: "runtime.behavior" | "recording.persistence" = "runtime.behavior"): never { throw new RunnerFailure(category, message); }
async function atomicWrite(target: string, contents: string): Promise<void> { const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp"; await writeFile(temporary, contents, { encoding: "utf8", flag: "wx", mode: 0o600 }); await rename(temporary, target); if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file"); }
