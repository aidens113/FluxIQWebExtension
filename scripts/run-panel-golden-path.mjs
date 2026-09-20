import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS", "FLUXIQ_DEMO_EXTENSION_DIR", "FLUXIQ_LLM_SCENARIO_ID", "FLUXIQ_LLM_INSTRUCTION",
];

try {
  const [{ loadAllowlistedTestEnvironment }, workspace, golden, requests] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
    import("../packages/test-runner/dist/panel-golden-path/index.js"),
    import("../packages/test-runner/dist/demo-llm-exploration-request.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const config = workspace.resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const request = await requests.resolveDemoLlmExplorationRequest(repositoryRoot, environment);
  const result = await golden.runPanelGoldenPath(config, request);
  process.stdout.write(JSON.stringify({
    status: result.status,
    projectId: result.identity.projectId,
    flowId: result.identity.flowId,
    creationRunId: result.creationRunId,
    failedRunId: result.failedRunId,
    repairedRunId: result.repairedRunId,
    reuseRunId: result.reuseRunId,
    repairAdaptationId: result.repairAdaptationId,
    recordingProjectId: result.recordingProjectId,
    recordingFlowId: result.recordingFlowId,
    recordingRunId: result.recordingRunId,
    providerCallCount: result.providerCallCount,
    verifiedStageCount: result.stages.length - result.unverifiedStages.length,
    unverifiedStages: result.unverifiedStages,
  }) + "\n");
  if (result.status !== "passed") process.exitCode = 2;
} catch (error) {
  const reasonCode = error && typeof error === "object" && error.details && typeof error.details === "object"
    && typeof error.details.reasonCode === "string" && /^panel_golden_path\.[a-z_]+$/u.test(error.details.reasonCode)
    ? error.details.reasonCode : "panel_golden_path.failed";
  process.stderr.write(JSON.stringify({ status: "failed", message: "Panel golden path failed", reasonCode }) + "\n");
  process.exitCode = 1;
}

