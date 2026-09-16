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
  /**
   * The run token budget Core reports for the grant, never above the one this
   * run asked for; `null` where Core reports none.
   */
  maxTotalTokensPerRun: number | null;
  /** Whether the issue request carried Core's high-token confirmation. */
  highTokenConfirmationSent: boolean;
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
  const { plan } = input;
  const limits = () => ({
    projectId: input.projectId,
    flowId: input.flowId,
    keyId: input.secretKeyId,
    provider: plan.provider,
    model: plan.model,
    purpose: plan.purpose,
    tokenLimits: { maxInputTokens: plan.tokenLimits.maxInputTokens, maxOutputTokens: plan.tokenLimits.maxOutputTokens, maxTotalTokens: plan.tokenLimits.maxTotalTokens },
    maxCalls: plan.maxCalls,
    maxTotalTokensPerRun: plan.maxTotalTokensPerRun,
    timeoutMs: plan.timeoutMs,
    maxEstimatedCostUsd: plan.maxEstimatedCostUsd,
    maxTotalEstimatedCostUsd: plan.maxTotalEstimatedCostUsd,
    providerRetryCount: 0,
  });
  await control.automationStudioCall("preflight-llm-execution", limits());
  // Core's preflight takes no confirmation; only the issue call weighs it. It is
  // sent only when the plan's run token budget is above Core's threshold, so a
  // grant Core would issue anyway is never issued as a confirmed high-token one.
  const highTokenConfirmationSent = plan.highTokenConfirmation.required;
  const issueRequest: Record<string, unknown> = limits();
  issueRequest.maxUses = plan.maxCalls;
  if (highTokenConfirmationSent) issueRequest.highTokenConfirmation = true;
  const issued = await control.automationStudioCall("issue-llm-execution-grant", issueRequest);
  const grant = isRecord(issued) ? issued.grant : undefined;
  if (!isRecord(grant)) throw refusal("Core returned no execution grant");
  const grantId = grant.grantId;
  if (typeof grantId !== "string" || !grantId || grantId.length > 256) throw refusal("Core returned an invalid execution grant id");
  if (grant.purpose !== plan.purpose) throw refusal("Core issued a grant for a different purpose");
  const maxCalls = wholeNumber(grant.maxCalls, "call limit");
  if (maxCalls > plan.maxCalls) throw refusal("Core issued a grant authorizing more calls than this run asked for");
  const maxEstimatedCostUsd = positiveNumber(grant.maxEstimatedCostUsd, "per-call cost limit");
  if (maxEstimatedCostUsd > plan.maxEstimatedCostUsd) throw refusal("Core issued a grant authorizing more cost per call than this run asked for");
  const maxTotalEstimatedCostUsd = positiveNumber(grant.maxTotalEstimatedCostUsd, "total cost limit");
  // Judged against the total this run asked Core for, which Core's own ceiling
  // already holds, so a larger call count cannot loosen the bound.
  if (maxTotalEstimatedCostUsd > plan.maxTotalEstimatedCostUsd) {
    throw refusal("Core issued a grant authorizing more total cost than this run asked for");
  }
  // Optional because a Core that predates run token budgets reports none, and
  // its own run ledger then bounds the tokens. A budget it does report must not
  // exceed the one asked for.
  const maxTotalTokensPerRun = grant.maxTotalTokensPerRun === undefined ? null : wholeNumber(grant.maxTotalTokensPerRun, "run token budget");
  if (maxTotalTokensPerRun !== null && maxTotalTokensPerRun > plan.maxTotalTokensPerRun) {
    throw refusal("Core issued a grant authorizing a larger run token budget than this run asked for");
  }
  const timeoutMs = wholeNumber(grant.timeoutMs, "timeout");
  if (timeoutMs > plan.timeoutMs) throw refusal("Core issued a grant authorizing a longer call timeout than this run asked for");
  if (grant.providerRetryCount !== 0) throw refusal("Core issued a grant permitting provider retries");
  return Object.freeze({ grantId, purpose: plan.purpose, maxCalls, maxEstimatedCostUsd, maxTotalEstimatedCostUsd, timeoutMs, maxTotalTokensPerRun, highTokenConfirmationSent });
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
