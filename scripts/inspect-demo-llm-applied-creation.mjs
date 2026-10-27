import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace")]);
  process.stdout.write("Usage: node scripts/inspect-demo-llm-applied-creation.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
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
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, runDemoLlmAppliedCreationProbe }] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"),
    import("@fluxiq-web-extension/test-runner/demo-workspace"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const result = await runDemoLlmAppliedCreationProbe(config);
  process.stdout.write(JSON.stringify({ status: "passed", providerCallCount: 0, ...result }) + "\n");
} catch {
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free applied creation inspection failed", providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
