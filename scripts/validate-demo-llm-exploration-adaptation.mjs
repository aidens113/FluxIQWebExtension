import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";
import { demoCredentialLiterals, demoLauncherFailureDetail } from "./demo/launcher-failure.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace")]);
  process.stdout.write("Usage: node scripts/validate-demo-llm-exploration-adaptation.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME", "FLUXIQ_DEMO_HEADLESS", "FLUXIQ_DEMO_EXTENSION_DIR",
];
let secretLiterals = [];

try {
  const [{ loadAllowlistedTestEnvironment }, workspace] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  secretLiterals = demoCredentialLiterals(environment);
  const result = await workspace.runDemoLlmExplorationAdaptationValidation(workspace.resolveDemoWorkspaceConfiguration(repositoryRoot, environment));
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  const candidate = error && typeof error === "object" && error.details && typeof error.details === "object" ? error.details.reasonCode : undefined;
  const reasonCode = typeof candidate === "string" && /^exploration_adaptation_validation\.[a-z_]+$/.test(candidate)
    ? candidate : "exploration_adaptation_validation.failed";
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free exploration adaptation validation failed", reasonCode, providerCallCount: 0, ...await demoLauncherFailureDetail(error, secretLiterals) }) + "\n");
  process.exitCode = 1;
}
