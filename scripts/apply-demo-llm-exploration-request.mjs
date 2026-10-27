import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace")]);
  process.stdout.write("Usage: node scripts/apply-demo-llm-exploration-request.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS", "FLUXIQ_DEMO_EXTENSION_DIR",
];

try {
  const [{ loadAllowlistedTestEnvironment }, workspace] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"),
    import("@fluxiq-web-extension/test-runner/demo-workspace"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const result = await workspace.runBoundDemoLlmExplorationApplyCheckpoint(workspace.resolveDemoWorkspaceConfiguration(repositoryRoot, environment));
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  const reasonCode = error && typeof error === "object" && error.details && typeof error.details === "object"
    && typeof error.details.reasonCode === "string" && /^exploration_apply\.[a-z_]+$/u.test(error.details.reasonCode)
    ? error.details.reasonCode : "exploration_request_apply.failed";
  process.stderr.write(JSON.stringify({ status: "failed", message: "Bound provider-free exploration proposal apply failed", reasonCode, providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
