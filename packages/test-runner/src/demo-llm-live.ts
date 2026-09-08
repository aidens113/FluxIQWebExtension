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
import type { ExistingRunDetail, ExistingRunEvent } from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";
import { attestWorkspaceSecretAbsence } from "./secret-leak-attestation.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

export const FIRST_LIVE_DIAGNOSIS_PROFILE: Readonly<LlmExecutionProfile> = Object.freeze({
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "deepseek-diagnosis-first-live",
  mode: "live",
  provider: "deepseek",
  model: "deepseek-chat",
  task: "diagnose",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: {
    maxInputTokens: 2_000,
    maxOutputTokens: 512,
    maxTotalTokensPerRequest: 3_000,
    maxCallsPerRun: 1,
    timeoutMs: 20_000,
    maxRetries: 0,
    maxEstimatedCostUsd: 0.25,
  },
});
assertLlmExecutionProfile(FIRST_LIVE_DIAGNOSIS_PROFILE);

export type DemoLlmLiveResult = Readonly<{
  schemaVersion: "0.1";
  status: "passed";
  profileId: string;
  diagnosisRunId: string;
  diagnosisStatus: string;
  deterministicFailureObserved: true;
  providerCallCount: 1;
  replayRunId: string;
  replayStatus: "succeeded";
  replayProviderCallCount: 0;
  evaluation: LlmRunEvaluation;
  leakAttestation: { status: "passed"; scannedFiles: number; scannedBytes: number; findingCount: 0 };
}>;

export function evaluateDemoLlmDiagnosis(input: {
  diagnosis: ExistingRunDetail;
  diagnosisEvents: ExistingRunEvent[];
  replay: ExistingRunDetail;
}): Omit<DemoLlmLiveResult, "leakAttestation"> {
  const profile = FIRST_LIVE_DIAGNOSIS_PROFILE;
  const interventions = input.diagnosis.interventions ?? [];
  const replayInterventions = input.replay.interventions ?? [];
  const failedActionSequence = input.diagnosisEvents.find(event => event.eventKind === "action_attempt" && event.status === "failed")?.sequence;
  const diagnosisSequence = input.diagnosisEvents.find(event => event.eventKind === "intervention")?.sequence;
  const intervention = interventions[0];
  if (input.diagnosis.summary.status !== "failed"
    || !input.diagnosis.actionAttempts.some(action => action.status === "failed")
    || failedActionSequence === undefined || diagnosisSequence === undefined || failedActionSequence >= diagnosisSequence
    || interventions.length !== 1 || input.diagnosis.summary.interventionCount !== 1
    || !intervention || intervention.kind !== "diagnosis" || intervention.provider !== "deepseek" || intervention.model !== "deepseek-chat"
    || intervention.promptVersion !== "automation-studio.runtime-diagnosis.v1"
    || intervention.validationOk !== true
    || (input.diagnosis.adaptationIds?.length ?? 0) !== 0 || (input.diagnosis.changeProposalIds?.length ?? 0) !== 0
    || (input.diagnosis.summary.adaptationCount ?? 0) !== 0
    || input.diagnosis.providerCallCount !== 1) {
    throw new RunnerFailure("runtime.behavior", "Diagnosis-only run violated its deterministic failure, single-diagnosis, or no-mutation contract");
  }
  const { inputTokens, outputTokens, totalTokens, estimatedCostUsd } = intervention;
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined
    || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || !Number.isFinite(totalTokens)
    || inputTokens < 0 || outputTokens < 0 || totalTokens < 0
    || inputTokens > profile.budget.maxInputTokens || outputTokens > profile.budget.maxOutputTokens
    || totalTokens > profile.budget.maxTotalTokensPerRequest || inputTokens + outputTokens !== totalTokens
    || estimatedCostUsd === undefined || !Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0
    || estimatedCostUsd > profile.budget.maxEstimatedCostUsd) {
    throw new RunnerFailure("runtime.behavior", "Diagnosis-only provider usage exceeded or omitted its bounded budget");
  }
  if (input.replay.summary.status !== "succeeded"
    || input.replay.actionAttempts.length < 1
    || input.replay.actionAttempts.length !== input.replay.summary.actionAttemptCount
    || input.replay.actionAttempts.some(action => action.status !== "succeeded")
    || replayInterventions.length !== 0
    || (input.replay.summary.interventionCount ?? 0) !== 0 || (input.replay.adaptationIds?.length ?? 0) !== 0
    || (input.replay.changeProposalIds?.length ?? 0) !== 0
    || (input.replay.providerCallCount ?? 0) !== 0) {
    throw new RunnerFailure("runtime.behavior", "Deterministic replay used LLM assistance, mutated the Flow, or failed");
  }
  const latencyMs = Math.max(0, (input.diagnosis.summary.finishedAt ?? input.diagnosis.summary.updatedAt) - (input.diagnosis.summary.startedAt ?? input.diagnosis.summary.updatedAt));
  const provenance: LlmInvocationProvenance = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    requestId: intervention.interventionId,
    profileId: profile.profileId,
    provider: intervention.provider,
    model: intervention.model,
    task: "diagnose",
    promptSchemaVersion: intervention.promptVersion,
    attempt: 1,
    inputTokens, outputTokens, totalTokens,
    usageSource: "provider-reported",
    latencyMs,
    estimatedCostUsd,
    outcome: "succeeded",
    sanitized: true,
    rawPromptRetained: false,
    rawResponseRetained: false,
  };
  const evaluation: LlmRunEvaluation = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    runId: input.diagnosis.summary.runId,
    profileId: profile.profileId,
    task: "diagnose",
    invocations: [provenance],
    maxCallsPerRun: 1,
    proposalValidated: true,
    reviewOutcome: "not-applicable",
    applyOutcome: "not-attempted",
    deterministicReplay: { required: true, completed: true, passed: true, llmCalls: 0 },
    safetyPassed: true,
    verdict: "passed",
    reasons: ["Deterministic target failure preceded one bounded diagnosis.", "No patch, adaptation, proposal, retry, promotion, or replay LLM call was persisted."],
  };
  if (!validateLlmRunEvaluation(evaluation).valid) throw new RunnerFailure("runtime.behavior", "Sanitized diagnosis evaluation did not satisfy its fixed contract");
  return {
    schemaVersion: "0.1",
    status: "passed",
    profileId: profile.profileId,
    diagnosisRunId: input.diagnosis.summary.runId,
    diagnosisStatus: input.diagnosis.summary.status,
    deterministicFailureObserved: true,
    providerCallCount: 1,
    replayRunId: input.replay.summary.runId,
    replayStatus: "succeeded",
    replayProviderCallCount: 0,
    evaluation,
  };
}

export async function persistDemoLlmLiveResult(workspaceDirectory: string, result: Omit<DemoLlmLiveResult, "leakAttestation">, sensitiveLiterals: readonly string[]): Promise<DemoLlmLiveResult> {
  await mkdir(workspaceDirectory, { recursive: true, mode: 0o700 });
  const target = path.join(path.resolve(workspaceDirectory), "demo-llm-diagnosis-result.json");
  const initial = JSON.stringify(result, null, 2) + "\n";
  if (sensitiveLiterals.some(value => value && initial.includes(value))) throw new RunnerFailure("recording.persistence", "Sanitized diagnosis result contains credential material");
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, initial, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
  let scannedFiles = 0; let scannedBytes = 0;
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: path.resolve(workspaceDirectory), secretLiteral: literal, approvedRelativePaths: ["demo-llm-diagnosis-result.json"] });
    if (report.status !== "passed") throw new RunnerFailure("recording.persistence", "Live diagnosis leak attestation failed");
    scannedFiles = Math.max(scannedFiles, report.scannedFiles);
    scannedBytes = Math.max(scannedBytes, report.scannedBytes);
  }
  const complete: DemoLlmLiveResult = { ...result, leakAttestation: { status: "passed", scannedFiles, scannedBytes, findingCount: 0 } };
  const finalTemporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(finalTemporary, JSON.stringify(complete, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(finalTemporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
  for (const literal of sensitiveLiterals.filter(value => value.length >= 8)) {
    const report = await attestWorkspaceSecretAbsence({ workspaceRoot: path.resolve(workspaceDirectory), secretLiteral: literal, approvedRelativePaths: ["demo-llm-diagnosis-result.json"] });
    if (report.status !== "passed") throw new RunnerFailure("recording.persistence", "Final live diagnosis leak attestation failed");
  }
  return Object.freeze(complete);
}
