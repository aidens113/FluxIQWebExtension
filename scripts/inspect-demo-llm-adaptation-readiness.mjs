import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace"), import("@fluxiq-web-extension/test-runner/demo-llm-adaptation-readiness")]);
  process.stdout.write("Usage: node scripts/inspect-demo-llm-adaptation-readiness.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS", "FLUXIQ_DEMO_EXTENSION_DIR",
];
let classifyFailure = () => "adaptation_readiness.unknown";
let stageFailureCode = "adaptation_readiness.module_load_failed";

try {
  const [target, workspace, readiness] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"),
    import("@fluxiq-web-extension/test-runner/demo-workspace"),
    import("@fluxiq-web-extension/test-runner/demo-llm-adaptation-readiness"),
  ]);
  classifyFailure = readiness.demoLlmAdaptationReadinessFailureCode;
  stageFailureCode = "adaptation_readiness.environment_invalid";
  const environment = await target.loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const config = workspace.resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  stageFailureCode = "adaptation_readiness.control_unavailable";
  const result = await workspace.runDemoLlmAdaptationReadinessProbe(config);
  stageFailureCode = "adaptation_readiness.unknown";
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  const classified = classifyFailure(error);
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free adaptation readiness inspection failed", reasonCode: classified === "adaptation_readiness.unknown" ? stageFailureCode : classified, providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
