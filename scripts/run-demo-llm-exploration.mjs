import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS",
  "FLUXIQ_LLM_SCENARIO_ID", "FLUXIQ_LLM_INSTRUCTION",
];

try {
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, runDemoLlmExplorationCheckpoint }, { resolveDemoLlmExplorationRequest }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
    import("../packages/test-runner/dist/demo-llm-exploration-request.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const request = await resolveDemoLlmExplorationRequest(repositoryRoot, environment);
  const result = await runDemoLlmExplorationCheckpoint(resolveDemoWorkspaceConfiguration(repositoryRoot, environment), request);
  process.stdout.write(JSON.stringify({ status: result.status, provider: result.provider, model: result.model, providerCallCount: result.providerCallCount, toolCallCount: result.toolCallCount, toolIdCount: result.toolIds.length, evidenceBytes: result.evidenceBytes, inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens: result.totalTokens, estimatedCostUsd: result.estimatedCostUsd, reviewOutcome: "pending", applyOutcome: "not_attempted", replayOutcome: "not_attempted" }) + "\n");
} catch (error) {
  const failureCode = error && typeof error === "object" && error.name === "RunnerFailure" && typeof error.category === "string" ? `runner.${error.category}` : error && typeof error === "object" && error.name === "TimeoutError" ? "playwright.timeout" : "unknown";
  process.stderr.write(JSON.stringify({ status: "failed", message: "Proposal-only website exploration checkpoint failed", failureCode }) + "\n");
  process.exitCode = 1;
}
