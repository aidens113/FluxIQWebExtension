import { randomBytes } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LLM_LAB_SCHEMA_VERSION,
  assertLlmExecutionProfile,
  validateLlmRunEvaluation,
  type LlmExecutionProfile,
  type LlmInvocationProvenance,
  type LlmRunEvaluation,
} from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "./failure.js";
import { attestWorkspaceSecretAbsence } from "./secret-leak-attestation.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";
import { DEFAULT_DEMO_LLM_CREATION_PROFILE } from "./demo-llm-profile.js";

/** @deprecated compatibility alias; use DEFAULT_DEMO_LLM_CREATION_PROFILE. */
export const FIRST_LIVE_CREATION_PROFILE = DEFAULT_DEMO_LLM_CREATION_PROFILE;

type BlankBefore = Readonly<{
  certified: true;
  projectId: string;
  flowId: string;
  baseExecutionDigest: string;
  nodeCount: 0;
  edgeCount: 0;
  ownedSubflowCount: 0;
  routerSubflowRouteCount: 0;
  recordingCount: number;
  recordingProvenanceAbsent: true;
}>;

type CreationInvocation = Readonly<{
  requestId: string;
  purpose: "flow_bootstrap";
  provider: "deepseek";
  model: "deepseek-chat";
  promptSchemaVersion: string;
  attempt: 1;
  retryCount: 0;
  providerCallCount: 1;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}>;

type CreationProposal = Readonly<{
  proposalId: string;
  proposalDigest: string;
  baseExecutionDigest: string;
  validationOk: true;
  stale: false;
  unsupportedOutputCount: 0;
}>;

type CreationReview = Readonly<{
  proposalId: string;
  outcome: "approved";
  channel: "human-ui";
  mutationObservedBeforeApproval: false;
}>;

type CreationApply = Readonly<{
  proposalId: string;
  baseExecutionDigest: string;
  resultingExecutionDigest: string;
  outcome: "applied";
  routerId: string;
  routerSubflowId: string;
  ownedSubflowId: string;
  graphFlowId: string;
  ownedSubflowCount: 1;
  routerSubflowRouteCount: 1;
  nodeCount: number;
  edgeCount: number;
  executableNodeCount: number;
  overlappingPositionCount: 0;
  deterministicLayout: true;
  unsupportedOutputCount: 0;
  recordingCount: number;
  recordingProvenanceAbsent: true;
}>;

type CreationReplay = Readonly<{
  runId: string;
  status: "succeeded";
  executionDigest: string;
  providerCallCount: 0;
  interventionCount: 0;
  actionAttemptCount: number;
  succeededActionCount: number;
}>;

export type DemoLlmCreationCertificationInput = Readonly<{
  schemaVersion: "0.1";
  operationId: string;
  blankBefore: BlankBefore;
  invocations: readonly [CreationInvocation];
  proposal: CreationProposal;
  review: CreationReview;
  apply: CreationApply;
  replay: CreationReplay;
}>;

export type DemoLlmCreationResult = Readonly<{
  schemaVersion: "0.1";
  status: "passed";
  profileId: string;
  operationId: string;
  projectId: string;
  flowId: string;
  baseExecutionDigest: string;
  resultingExecutionDigest: string;
  proposalId: string;
  proposalDigest: string;
  providerCallCount: 1;
  retryCount: 0;
  reviewOutcome: "approved";
  applyOutcome: "applied";
  topology: {
    routerId: string;
    subflowId: string;
    graphFlowId: string;
    ownedSubflowCount: 1;
    routerSubflowRouteCount: 1;
    nodeCount: number;
    edgeCount: number;
    executableNodeCount: number;
    overlappingPositionCount: 0;
    deterministicLayout: true;
  };
  recordingCountBefore: number;
  recordingCountAfter: number;
  recordingProvenanceAbsent: true;
  replayRunId: string;
  replayProviderCallCount: 0;
  evaluation: LlmRunEvaluation;
  leakAttestation: { status: "passed"; scannedFiles: number; scannedBytes: number; findingCount: 0 };
}>;

export function evaluateDemoLlmCreation(input: unknown, profile: Readonly<LlmExecutionProfile> = DEFAULT_DEMO_LLM_CREATION_PROFILE): Omit<DemoLlmCreationResult, "leakAttestation"> {
  const parsed = parseCreationInput(input);
  const invocation = parsed.invocations[0];
  assertLlmExecutionProfile(profile);
  if (profile.provider !== "deepseek" || profile.model !== "deepseek-chat" || profile.task !== "create-flow") fail("Creation profile identity is unsupported");
  const budget = profile.budget;
  if (invocation.inputTokens > budget.maxInputTokens
    || invocation.outputTokens > budget.maxOutputTokens
    || invocation.totalTokens > budget.maxTotalTokensPerRequest
    || invocation.inputTokens + invocation.outputTokens !== invocation.totalTokens
    || invocation.estimatedCostUsd > budget.maxEstimatedCostUsd) fail("Creation provider accounting violated its strict budget");
  if (parsed.proposal.baseExecutionDigest !== parsed.blankBefore.baseExecutionDigest
    || parsed.review.proposalId !== parsed.proposal.proposalId
    || parsed.apply.proposalId !== parsed.proposal.proposalId
    || parsed.apply.baseExecutionDigest !== parsed.blankBefore.baseExecutionDigest) fail("Creation proposal was stale, unbound, or applied without exact review");
  if (parsed.apply.resultingExecutionDigest === parsed.blankBefore.baseExecutionDigest
    || parsed.apply.routerSubflowId !== parsed.apply.ownedSubflowId
    || parsed.apply.ownedSubflowCount !== 1
    || parsed.apply.routerSubflowRouteCount !== 1
    || parsed.apply.deterministicLayout !== true
    || parsed.apply.nodeCount < 1
    || parsed.apply.executableNodeCount !== parsed.apply.nodeCount
    || parsed.apply.edgeCount < Math.max(0, parsed.apply.nodeCount - 1)) fail("Applied creation topology is not executable, owned, connected, or changed");
  if (parsed.apply.recordingCount !== parsed.blankBefore.recordingCount) fail("Creation changed recordings or introduced recording provenance");
  if (parsed.replay.executionDigest !== parsed.apply.resultingExecutionDigest
    || parsed.replay.actionAttemptCount < 1
    || parsed.replay.succeededActionCount !== parsed.replay.actionAttemptCount) fail("Deterministic creation replay failed or used an inconsistent Flow");

  const provenance: LlmInvocationProvenance = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    requestId: invocation.requestId,
    profileId: profile.profileId,
    provider: invocation.provider,
    model: invocation.model,
    task: "create-flow",
    promptSchemaVersion: invocation.promptSchemaVersion,
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
  };
  const evaluation: LlmRunEvaluation = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    runId: parsed.operationId,
    profileId: profile.profileId,
    task: "create-flow",
    invocations: [provenance],
    maxCallsPerRun: budget.maxCallsPerRun,
    proposalValidated: true,
    reviewOutcome: "approved",
    applyOutcome: "applied",
    deterministicReplay: { required: true, completed: true, passed: true, llmCalls: 0 },
    safetyPassed: true,
    verdict: "passed",
    reasons: [
      "One bounded flow_bootstrap proposal was validated against the certified blank Flow and approved through the human UI.",
      "The applied owned topology passed deterministic replay without LLM calls or recording provenance.",
    ],
  };
  if (!validateLlmRunEvaluation(evaluation).valid) fail("Sanitized creation evaluation violated its fixed contract");
  return Object.freeze({
    schemaVersion: "0.1",
    status: "passed",
    profileId: profile.profileId,
    operationId: parsed.operationId,
    projectId: parsed.blankBefore.projectId,
    flowId: parsed.blankBefore.flowId,
    baseExecutionDigest: parsed.blankBefore.baseExecutionDigest,
    resultingExecutionDigest: parsed.apply.resultingExecutionDigest,
    proposalId: parsed.proposal.proposalId,
    proposalDigest: parsed.proposal.proposalDigest,
    providerCallCount: 1,
    retryCount: 0,
    reviewOutcome: "approved",
    applyOutcome: "applied",
    topology: {
      routerId: parsed.apply.routerId,
      subflowId: parsed.apply.ownedSubflowId,
      graphFlowId: parsed.apply.graphFlowId,
      ownedSubflowCount: 1 as const,
      routerSubflowRouteCount: 1 as const,
      nodeCount: parsed.apply.nodeCount,
      edgeCount: parsed.apply.edgeCount,
      executableNodeCount: parsed.apply.executableNodeCount,
      overlappingPositionCount: 0 as const,
      deterministicLayout: true as const,
    },
    recordingCountBefore: parsed.blankBefore.recordingCount,
    recordingCountAfter: parsed.apply.recordingCount,
    recordingProvenanceAbsent: true,
    replayRunId: parsed.replay.runId,
    replayProviderCallCount: 0,
    evaluation,
  });
}

export async function persistDemoLlmCreationResult(workspaceDirectory: string, result: Omit<DemoLlmCreationResult, "leakAttestation">, sensitiveLiterals: readonly string[]): Promise<DemoLlmCreationResult> {
  const root = path.resolve(workspaceDirectory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const target = path.join(root, "demo-llm-creation-result.json");
  const serialized = JSON.stringify(result, null, 2) + "\n";
  if (sensitiveLiterals.some(value => value.length > 0 && serialized.includes(value))) fail("Sanitized creation result contains credential material", "recording.persistence");
  await atomicWrite(target, serialized);
  let scannedFiles = 0;
  let scannedBytes = 0;
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: literal, approvedRelativePaths: ["demo-llm-creation-result.json"] });
    if (report.status !== "passed") fail("Creation result leak attestation failed", "recording.persistence");
    scannedFiles = Math.max(scannedFiles, report.scannedFiles);
    scannedBytes = Math.max(scannedBytes, report.scannedBytes);
  }
  const complete: DemoLlmCreationResult = Object.freeze({ ...result, leakAttestation: { status: "passed" as const, scannedFiles, scannedBytes, findingCount: 0 as const } });
  await atomicWrite(target, JSON.stringify(complete, null, 2) + "\n");
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: literal, approvedRelativePaths: ["demo-llm-creation-result.json"] });
    if (report.status !== "passed") fail("Final creation result leak attestation failed", "recording.persistence");
  }
  return complete;
}

function parseCreationInput(input: unknown): DemoLlmCreationCertificationInput {
  rejectForbiddenFields(input);
  const root = exact(input, ["schemaVersion", "operationId", "blankBefore", "invocations", "proposal", "review", "apply", "replay"]);
  if (root.schemaVersion !== "0.1") fail("Creation certification schema is unsupported");
  const blank = exact(root.blankBefore, ["certified", "projectId", "flowId", "baseExecutionDigest", "nodeCount", "edgeCount", "ownedSubflowCount", "routerSubflowRouteCount", "recordingCount", "recordingProvenanceAbsent"]);
  requireLiteral(blank.certified, true); requireLiteral(blank.nodeCount, 0); requireLiteral(blank.edgeCount, 0); requireLiteral(blank.ownedSubflowCount, 0); requireLiteral(blank.routerSubflowRouteCount, 0); requireLiteral(blank.recordingProvenanceAbsent, true);
  const invocations = root.invocations;
  if (!Array.isArray(invocations) || invocations.length !== 1) fail("Creation requires exactly one provider invocation");
  const invocation = exact(invocations[0], ["requestId", "purpose", "provider", "model", "promptSchemaVersion", "attempt", "retryCount", "providerCallCount", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "latencyMs"]);
  requireLiteral(invocation.purpose, "flow_bootstrap"); requireLiteral(invocation.provider, "deepseek"); requireLiteral(invocation.model, "deepseek-chat"); requireLiteral(invocation.attempt, 1); requireLiteral(invocation.retryCount, 0); requireLiteral(invocation.providerCallCount, 1);
  const proposal = exact(root.proposal, ["proposalId", "proposalDigest", "baseExecutionDigest", "validationOk", "stale", "unsupportedOutputCount"]);
  requireLiteral(proposal.validationOk, true); requireLiteral(proposal.stale, false); requireLiteral(proposal.unsupportedOutputCount, 0);
  const review = exact(root.review, ["proposalId", "outcome", "channel", "mutationObservedBeforeApproval"]);
  requireLiteral(review.outcome, "approved"); requireLiteral(review.channel, "human-ui"); requireLiteral(review.mutationObservedBeforeApproval, false);
  const apply = exact(root.apply, ["proposalId", "baseExecutionDigest", "resultingExecutionDigest", "outcome", "routerId", "routerSubflowId", "ownedSubflowId", "graphFlowId", "ownedSubflowCount", "routerSubflowRouteCount", "nodeCount", "edgeCount", "executableNodeCount", "overlappingPositionCount", "deterministicLayout", "unsupportedOutputCount", "recordingCount", "recordingProvenanceAbsent"]);
  requireLiteral(apply.outcome, "applied"); requireLiteral(apply.ownedSubflowCount, 1); requireLiteral(apply.routerSubflowRouteCount, 1); requireLiteral(apply.overlappingPositionCount, 0); requireLiteral(apply.deterministicLayout, true); requireLiteral(apply.unsupportedOutputCount, 0); requireLiteral(apply.recordingProvenanceAbsent, true);
  const replay = exact(root.replay, ["runId", "status", "executionDigest", "providerCallCount", "interventionCount", "actionAttemptCount", "succeededActionCount"]);
  requireLiteral(replay.status, "succeeded"); requireLiteral(replay.providerCallCount, 0); requireLiteral(replay.interventionCount, 0);
  for (const value of [root.operationId, blank.projectId, blank.flowId, blank.baseExecutionDigest, invocation.requestId, invocation.promptSchemaVersion, proposal.proposalId, proposal.proposalDigest, proposal.baseExecutionDigest, review.proposalId, apply.proposalId, apply.baseExecutionDigest, apply.resultingExecutionDigest, apply.routerId, apply.routerSubflowId, apply.ownedSubflowId, apply.graphFlowId, replay.runId, replay.executionDigest]) identifier(value);
  for (const value of [blank.recordingCount, invocation.inputTokens, invocation.outputTokens, invocation.totalTokens, invocation.latencyMs, apply.nodeCount, apply.edgeCount, apply.executableNodeCount, apply.recordingCount, replay.actionAttemptCount, replay.succeededActionCount]) integer(value);
  finite(invocation.estimatedCostUsd);
  return input as DemoLlmCreationCertificationInput;
}

function rejectForbiddenFields(input: unknown): void {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value as object)) fail("Creation certification input is cyclic");
    seen.add(value as object);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
      if (/^(?:rawprompt|rawresponse|apikey|keyid|keyreference|secret|credential|password|pin|authorizationheader|authorizationtoken|lastrecordingid|recordingid|recordingevents|recordingevidence|recordingmetadata)$/u.test(normalized)) fail("Creation certification input contains forbidden sensitive or recording material");
      visit(child);
    }
  };
  visit(input);
}

function exact(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Creation certification input has an invalid object");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some(key => !allowed.includes(key)) || allowed.some(key => !(key in object))) fail("Creation certification input has missing or unsupported fields");
  return object;
}

function identifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(value) || /(?:api[-_]?key|password|credential|authorization|secret|recording)/iu.test(value)) fail("Creation certification identifier is invalid");
}
function integer(value: unknown): asserts value is number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("Creation certification accounting must be finite nonnegative integers"); }
function finite(value: unknown): asserts value is number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail("Creation certification cost must be finite and nonnegative"); }
function requireLiteral<T>(value: unknown, expected: T): asserts value is T { if (value !== expected) fail("Creation certification fixed safety fact was not satisfied"); }
function fail(message: string, category: "runtime.behavior" | "recording.persistence" = "runtime.behavior"): never { throw new RunnerFailure(category, message); }

async function atomicWrite(target: string, contents: string): Promise<void> {
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}
