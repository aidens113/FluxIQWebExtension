// The one-use authorization a live run carries into Core. Core issues it
// against the Flow's saved settings and its current execution digest, binds it
// to the caller's own session, and counts the provider calls down against it,
// so the grant -- not the runner's good intentions -- is what stops a run
// spending more than it was authorized to.

import { RunnerFailure } from "../failure.js";
import type { LiveLlmPlan, LiveLlmPurpose } from "./live-llm-plan.js";

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
  /**
   * A grant of a different purpose than the plan's, taken out against the same
   * key, model and per-call bounds.
   *
   * It exists for `verify_result`: judging a finished run's result is a
   * provider call, every provider call needs a person's grant, and the grant
   * the plan carries may be one no runtime session accepts (`build_and_adapt`)
   * or one already spent. Its call count is the purpose's own, never the
   * operator's, and every other bound below is still the plan's, so a second
   * grant can only ever ask for less than the run was authorized.
   */
  override?: { purpose: LiveLlmPurpose; maxCalls: number };
}): Promise<LiveLlmExecutionGrant> {
  const { plan } = input;
  const purpose = input.override?.purpose ?? plan.purpose;
  const maxCallsAsked = input.override?.maxCalls ?? plan.maxCalls;
  if (maxCallsAsked > plan.maxCalls) throw refusal("a grant cannot ask for more calls than this run was authorized");
  // Core holds a grant's run token budget to what its own calls could spend:
  // never less than one call's limit, never more than every call's
  // (`AutomationStudioLlmExecutionGrantService`). The operator's budget is
  // sized for the plan's call count, so a grant taking fewer calls must ask
  // for correspondingly less or Core refuses it outright -- a one-call
  // `verify_result` grant beside a 600,000-token plan was refused with "LLM
  // total token limit is invalid" before this held it down.
  const maxTotalTokensPerRunAsked = Math.min(plan.maxTotalTokensPerRun, plan.tokenLimits.maxTotalTokens * maxCallsAsked);
  const limits = () => ({
    projectId: input.projectId,
    flowId: input.flowId,
    keyId: input.secretKeyId,
    provider: plan.provider,
    model: plan.model,
    purpose,
    tokenLimits: { maxInputTokens: plan.tokenLimits.maxInputTokens, maxOutputTokens: plan.tokenLimits.maxOutputTokens, maxTotalTokens: plan.tokenLimits.maxTotalTokens },
    maxCalls: maxCallsAsked,
    maxTotalTokensPerRun: maxTotalTokensPerRunAsked,
    timeoutMs: plan.timeoutMs,
    maxEstimatedCostUsd: plan.maxEstimatedCostUsd,
    maxTotalEstimatedCostUsd: plan.maxTotalEstimatedCostUsd,
    providerRetryCount: 0,
  });
  await control.automationStudioCall("preflight-llm-execution", limits());
  // Core's preflight takes no confirmation; only the issue call weighs it. It is
  // sent only when the plan's run token budget is above Core's threshold, so a
  // grant Core would issue anyway is never issued as a confirmed high-token one
  // -- and only when this grant is asking for that whole budget, since a
  // narrowed one is below the threshold that made the plan's request a
  // high-token one and confirming it would claim an exposure it does not have.
  const highTokenConfirmationSent = plan.highTokenConfirmation.required && maxTotalTokensPerRunAsked === plan.maxTotalTokensPerRun;
  const issueRequest: Record<string, unknown> = limits();
  issueRequest.maxUses = maxCallsAsked;
  if (highTokenConfirmationSent) issueRequest.highTokenConfirmation = true;
  const issued = await control.automationStudioCall("issue-llm-execution-grant", issueRequest);
  const grant = isRecord(issued) ? issued.grant : undefined;
  if (!isRecord(grant)) throw refusal("Core returned no execution grant");
  const grantId = grant.grantId;
  if (typeof grantId !== "string" || !grantId || grantId.length > 256) throw refusal("Core returned an invalid execution grant id");
  if (grant.purpose !== purpose) throw refusal("Core issued a grant for a different purpose");
  const maxCalls = wholeNumber(grant.maxCalls, "call limit");
  if (maxCalls > maxCallsAsked) throw refusal("Core issued a grant authorizing more calls than this run asked for");
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
  if (maxTotalTokensPerRun !== null && maxTotalTokensPerRun > maxTotalTokensPerRunAsked) {
    throw refusal("Core issued a grant authorizing a larger run token budget than this run asked for");
  }
  const timeoutMs = wholeNumber(grant.timeoutMs, "timeout");
  if (timeoutMs > plan.timeoutMs) throw refusal("Core issued a grant authorizing a longer call timeout than this run asked for");
  if (grant.providerRetryCount !== 0) throw refusal("Core issued a grant permitting provider retries");
  return Object.freeze({ grantId, purpose, maxCalls, maxEstimatedCostUsd, maxTotalEstimatedCostUsd, timeoutMs, maxTotalTokensPerRun, highTokenConfirmationSent });
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
