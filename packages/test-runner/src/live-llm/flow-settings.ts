// Pins a generated Flow to the run's provider, model, key and bounds, through
// the same `update-flow-settings` endpoint the Flow Settings screen posts. The
// limits written here are the ones Core then enforces on its own side: writing
// them is how a parsed `--llm-max-*` becomes a cap the provider call is
// actually held to, rather than a number the CLI accepted and dropped.
//
// The run's spend ceiling is one of them: a plain Flow setting,
// `adaptationPolicySettings.maxEstimatedCostUsdPerRun`, that Core's loop
// budget reads for every build and recovery on the Flow.

import { RunnerFailure } from "../failure.js";
import { liveFlowAdaptationModeOf, type LiveFlowAdaptationMode } from "../flow-lane/index.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";

export type LiveLlmFlowSettingsControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
};

/**
 * Writes the Flow's LLM connection, its bounded execution settings, its run
 * spend ceiling and its adaptation mode. The mode follows the plan's purpose
 * (`liveFlowAdaptationModeOf`): a created Flow's `explore_and_adapt` playback
 * stores `fully_adaptive`, so Core may promote, resume and judge its repair;
 * every other purpose stores `manual_approval`, which keeps a diagnosis from
 * applying itself. Core canonicalizes a stored `manual_approval` to manual
 * proposals even with no per-run override, so the stored mode, not only the
 * run request, decides whether a repair can apply.
 */
export async function configureFlowLiveLlmExecution(control: LiveLlmFlowSettingsControl, input: {
  projectId: string;
  flowId: string;
  plan: LiveLlmPlan;
  secretKeyId: string;
}): Promise<void> {
  const { plan } = input;
  const adaptationMode = liveFlowAdaptationModeOf(plan.purpose);
  await control.automationStudioCall("update-flow-settings", {
    projectId: input.projectId,
    flowId: input.flowId,
    flow: {
      flowId: input.flowId,
      metadata: {
        adaptationModeVersion: 1,
        adaptationMode,
        llmProvider: plan.provider,
        llmModel: plan.model,
        llmSecretKeyId: input.secretKeyId,
        llmExecutionSettings: {
          tokenLimits: { ...plan.tokenLimits },
          maxCalls: plan.maxCalls,
          timeoutMs: plan.timeoutMs,
          maxEstimatedCostUsd: plan.maxEstimatedCostUsd,
          retryCount: 0,
        },
        // Merged by Core into the Flow's stored policy settings, so the other
        // policy fields keep whatever the Flow already had.
        adaptationPolicySettings: { maxEstimatedCostUsdPerRun: plan.maxTotalEstimatedCostUsd },
      },
    },
  });
  // Read back from the canonical Flow rather than from the save's own response.
  // `update-flow-settings` answers with a SQL projection whose availability
  // depends on the project's database pool, so believing it would make the one
  // check that matters -- that Core stored these exact limits -- conditional on
  // something unrelated to whether it did.
  assertSettingsPersisted(await control.automationStudioCall("get-flow", { projectId: input.projectId, flowId: input.flowId }), input.secretKeyId, plan, adaptationMode);
}

/**
 * Reads back what Core stored. A settings save that silently dropped the key or
 * a limit would leave the run unbounded while looking configured, so the values
 * are checked here rather than assumed from a 200. The mode is compared too:
 * `get-flow` returns the Flow document's metadata, into which the settings
 * save merged the written `adaptationMode` as given (the save's
 * `withStatedInterventionMode` rewrite is skipped because policy settings are
 * written alongside, and the read's locked-default clearing only matches
 * `no_llm_intervention`), so a different mode means Core did not store this one.
 */
function assertSettingsPersisted(payload: unknown, secretKeyId: string, plan: LiveLlmPlan, adaptationMode: LiveFlowAdaptationMode): void {
  const flow = isRecord(payload) ? payload.flow : undefined;
  const metadata = isRecord(flow) ? flow.metadata : undefined;
  if (!isRecord(metadata)) throw refusal("Core returned no Flow metadata after the settings save");
  if (metadata.llmProvider !== plan.provider || metadata.llmModel !== plan.model) throw refusal("Core did not store the requested provider and model");
  if (metadata.llmSecretKeyId !== secretKeyId) throw refusal("Core did not store the encrypted key reference");
  if (metadata.adaptationMode !== adaptationMode) throw refusal(`Core did not store the Flow's ${adaptationMode} adaptation mode`);
  const execution = metadata.llmExecutionSettings;
  if (!isRecord(execution)) throw refusal("Core did not store the bounded LLM execution settings");
  const tokens = execution.tokenLimits;
  if (!isRecord(tokens)) throw refusal("Core did not store the LLM token limits");
  const mismatch = execution.maxCalls !== plan.maxCalls
    || execution.timeoutMs !== plan.timeoutMs
    || execution.maxEstimatedCostUsd !== plan.maxEstimatedCostUsd
    || execution.retryCount !== 0
    || tokens.maxInputTokens !== plan.tokenLimits.maxInputTokens
    || tokens.maxOutputTokens !== plan.tokenLimits.maxOutputTokens
    || tokens.maxTotalTokens !== plan.tokenLimits.maxTotalTokens;
  if (mismatch) throw refusal("Core stored LLM execution limits that differ from the ones this run authorized");
  const policy = metadata.adaptationPolicySettings;
  if (!isRecord(policy) || policy.maxEstimatedCostUsdPerRun !== plan.maxTotalEstimatedCostUsd) {
    throw refusal("Core did not store the run's spend ceiling (adaptationPolicySettings.maxEstimatedCostUsdPerRun)");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refusal(detail: string): RunnerFailure {
  return new RunnerFailure("environment.missing", `Live LLM Flow settings refused: ${detail}`);
}
