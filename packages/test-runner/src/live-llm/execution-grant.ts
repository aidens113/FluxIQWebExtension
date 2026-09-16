// The one-use authorization a live run carries into Core. Core issues it
// against the Flow's saved settings and its current execution digest, binds it
// to the caller's own session, and counts the provider calls down against it,
// so the grant -- not the runner's good intentions -- is what stops a run
// spending more than it was authorized to.

import { RunnerFailure } from "../failure.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";

export type LiveLlmExecutionGrant = Readonly<{
  grantId: string;
  purpose: LiveLlmPlan["purpose"];
  maxCalls: number;
  maxEstimatedCostUsd: number;
  maxTotalEstimatedCostUsd: number;
  timeoutMs: number;
}>;

export type LiveLlmGrantControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
};

/**
 * Preflights and issues the grant. The preflight is not decoration: it is where
 * Core reports an unusable key or an out-of-bound limit while nothing has been
 * spent, and its refusal is more specific than the issue call's.
 */
export async function issueLiveLlmExecutionGrant(control: LiveLlmGrantControl, input: {
  projectId: string;
  flowId: string;
  secretKeyId: string;
  plan: LiveLlmPlan;
}): Promise<LiveLlmExecutionGrant> {
  const request = {
    projectId: input.projectId,
    flowId: input.flowId,
    keyId: input.secretKeyId,
    provider: input.plan.provider,
    model: input.plan.model,
    purpose: input.plan.purpose,
    tokenLimits: { ...input.plan.tokenLimits },
    maxCalls: input.plan.maxCalls,
    timeoutMs: input.plan.timeoutMs,
    maxEstimatedCostUsd: input.plan.maxEstimatedCostUsd,
    providerRetryCount: 0,
  };
  await control.automationStudioCall("preflight-llm-execution", request);
  const issued = await control.automationStudioCall("issue-llm-execution-grant", { ...request, maxUses: input.plan.maxCalls });
  const grant = isRecord(issued) ? issued.grant : undefined;
  if (!isRecord(grant)) throw refusal("Core returned no execution grant");
  const grantId = grant.grantId;
  if (typeof grantId !== "string" || !grantId || grantId.length > 256) throw refusal("Core returned an invalid execution grant id");
  if (grant.purpose !== input.plan.purpose) throw refusal("Core issued a grant for a different purpose");
  const maxCalls = wholeNumber(grant.maxCalls, "call limit");
  if (maxCalls > input.plan.maxCalls) throw refusal("Core issued a grant authorizing more calls than this run asked for");
  const maxEstimatedCostUsd = positiveNumber(grant.maxEstimatedCostUsd, "per-call cost limit");
  if (maxEstimatedCostUsd > input.plan.maxEstimatedCostUsd) throw refusal("Core issued a grant authorizing more cost per call than this run asked for");
  const maxTotalEstimatedCostUsd = positiveNumber(grant.maxTotalEstimatedCostUsd, "total cost limit");
  if (maxTotalEstimatedCostUsd > input.plan.declared.maxEstimatedCostUsd * input.plan.maxCalls) {
    throw refusal("Core issued a grant authorizing more total cost than this run asked for");
  }
  const timeoutMs = wholeNumber(grant.timeoutMs, "timeout");
  if (timeoutMs > input.plan.timeoutMs) throw refusal("Core issued a grant authorizing a longer call timeout than this run asked for");
  if (grant.providerRetryCount !== 0) throw refusal("Core issued a grant permitting provider retries");
  return Object.freeze({ grantId, purpose: input.plan.purpose, maxCalls, maxEstimatedCostUsd, maxTotalEstimatedCostUsd, timeoutMs });
}

function wholeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw refusal(`Core returned an invalid grant ${label}`);
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw refusal(`Core returned an invalid grant ${label}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refusal(detail: string): RunnerFailure {
  return new RunnerFailure("environment.missing", `Live LLM execution grant refused: ${detail}`);
}
