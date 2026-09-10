import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS",
];

try {
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, runDemoLlmExplorationAdaptationReadinessProbe }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const result = await runDemoLlmExplorationAdaptationReadinessProbe(resolveDemoWorkspaceConfiguration(repositoryRoot, environment));
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  const reasonCode = error && typeof error === "object" && error.name === "RunnerFailure"
    && error.details && typeof error.details === "object" && typeof error.details.reasonCode === "string"
    && /^(?:exploration_)?adaptation_readiness\.[a-z_]+$/.test(error.details.reasonCode)
      ? error.details.reasonCode
      : "exploration_adaptation_readiness.failed";
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free exploration adaptation readiness failed", reasonCode, providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
