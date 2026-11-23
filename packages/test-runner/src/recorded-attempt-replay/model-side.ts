import { isLlmModel, llmProviderForModel, type AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import { ensureLiveLlmSecretKey } from "../live-llm/index.js";
import { scriptedModelChildEnvironment, scriptedModelKey } from "../attempt-lane/scripted-model/index.js";
import type { openLiveAttemptSession } from "../attempt-lane/live/attempt/index.js";
import { readRecordedArtifact } from "./read-artifact.js";
import { startRecordedModelServer } from "./raw-server.js";

/** Actual chat/browser runtime with recorded model transport; this alone is not recorded-domain proof. */
export async function recordedModelSide(input: { artifact: string; taskId: string; scenarioId: string; environment: NodeJS.ProcessEnv; authoringMode: string }) {
  const artifact = await readRecordedArtifact(input.artifact);
  if (artifact.taskId !== input.taskId || artifact.scenarioId !== input.scenarioId) throw new Error("recorded_task_identity_changed");
  const streams = [...new Set(artifact.exchanges.map((exchange) => exchange.stream))];
  // A CLI stream needs a proven correlation mapping. Never guess which concurrent recorded agent is next.
  if (streams.length !== 1) throw new Error("recorded_cli_requires_explicit_concurrent_stream_mapping");
  const request = JSON.parse(artifact.exchanges[0]!.request) as { model?: unknown };
  if (!isLlmModel(request.model) || llmProviderForModel(request.model) !== "anthropic") throw new Error("recorded_start_model_unsupported");
  const model = request.model;
  const key = scriptedModelKey();
  const server = await startRecordedModelServer({ artifact, key, streamForCorrelation: { uncorrelated: streams[0]! } });
  return {
    server,
    replay: server.replay,
    configuredModel: model,
    standIns: ["model", "spend"] as readonly AttemptStandIn[],
    environment: scriptedModelChildEnvironment(input.environment, server.origin),
    args: ["--authoring-mode", input.authoringMode, "--llm-max-cost-usd", "5", "--llm-model", model],
    authorize: async (topology: Parameters<Parameters<typeof openLiveAttemptSession>[0]["authorize"]>[0], control: Parameters<Parameters<typeof openLiveAttemptSession>[0]["authorize"]>[1]) => {
      if (!topology.authorizationPassword) throw new Error("The isolated Core published no account password to install the fixture key");
      const installed = await ensureLiveLlmSecretKey(control, { secretValue: key, authorizationPassword: topology.authorizationPassword, ...(topology.authorizationPin ? { authorizationPin: topology.authorizationPin } : {}), model, provider: llmProviderForModel(model) });
      if (installed.created) await control.reauthenticate();
    },
  };
}
