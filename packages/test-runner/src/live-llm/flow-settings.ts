// Pins a generated Flow to the run's provider, key and bounds, through the same
// `update-flow-settings` endpoint the Flow Settings screen posts. The limits
// written here are the ones Core then enforces on its own side: writing them is
// how a parsed `--llm-max-*` becomes a cap the provider call is actually held
// to, rather than a number the CLI accepted and dropped.

import { RunnerFailure } from "../failure.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";

export type LiveLlmFlowSettingsControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
};

/**
 * Writes the Flow's LLM connection and its bounded execution settings.
 * `manual_approval` is the runtime mode an explicit LLM run requires: Core
 * refuses an execution grant on any other, and it is what keeps a diagnosis
 * from applying itself.
 */
export async function configureFlowLiveLlmExecution(control: LiveLlmFlowSettingsControl, input: {
  projectId: string;
  flowId: string;
  plan: LiveLlmPlan;
  secretKeyId: string;
}): Promise<void> {
  const { plan } = input;
  await control.automationStudioCall("update-flow-settings", {
    projectId: input.projectId,
    flowId: input.flowId,
    flow: {
      flowId: input.flowId,
      metadata: {
        adaptationModeVersion: 1,
        adaptationMode: "manual_approval",
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
      },
    },
  });
  // Read back from the canonical Flow rather than from the save's own response.
  // `update-flow-settings` answers with a SQL projection whose availability
  // depends on the project's database pool, so believing it would make the one
  // check that matters -- that Core stored these exact limits -- conditional on
  // something unrelated to whether it did.
  assertSettingsPersisted(await control.automationStudioCall("get-flow", { projectId: input.projectId, flowId: input.flowId }), input.secretKeyId, plan);
}

/**
 * Reads back what Core stored. A settings save that silently dropped the key or
 * a limit would leave the run unbounded while looking configured, so the values
 * are checked here rather than assumed from a 200.
 */
function assertSettingsPersisted(payload: unknown, secretKeyId: string, plan: LiveLlmPlan): void {
  const flow = isRecord(payload) ? payload.flow : undefined;
  const metadata = isRecord(flow) ? flow.metadata : undefined;
  if (!isRecord(metadata)) throw refusal("Core returned no Flow metadata after the settings save");
  if (metadata.llmProvider !== plan.provider || metadata.llmModel !== plan.model) throw refusal("Core did not store the requested provider and model");
  if (metadata.llmSecretKeyId !== secretKeyId) throw refusal("Core did not store the encrypted key reference");
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refusal(detail: string): RunnerFailure {
  return new RunnerFailure("environment.missing", `Live LLM Flow settings refused: ${detail}`);
}
