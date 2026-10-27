import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";
import { demoCredentialLiterals, demoLauncherFailureDetail } from "./demo/launcher-failure.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace")]);
  process.stdout.write("Usage: node scripts/control-demo-llm-adaptation.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS", "FLUXIQ_DEMO_EXTENSION_DIR",
];
let secretLiterals = [];

try {
  const parsed = parseArguments(process.argv.slice(2));
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, controlPreparedDemoLlmTargetAdaptation }] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"),
    import("@fluxiq-web-extension/test-runner/demo-workspace"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  secretLiterals = demoCredentialLiterals(environment);
  const result = await controlPreparedDemoLlmTargetAdaptation(resolveDemoWorkspaceConfiguration(repositoryRoot, environment), parsed.action, parsed.selector);
  process.stdout.write(JSON.stringify(result) + "\n", () => process.exit(0));
} catch (error) {
  process.stderr.write(JSON.stringify({ status: "failed", failureCode: failureCode(error), providerCallCount: 0, ...await demoLauncherFailureDetail(error, secretLiterals) }) + "\n", () => process.exit(1));
}

function parseArguments(args) {
  const action = args[0] ?? "state";
  if (!new Set(["state", "approve", "apply", "continue", "revert"]).has(action)) throw new Error("unsupported adaptation control action");
  const selector = {};
  for (const argument of args.slice(1)) {
    const [flag, value, extra] = argument.split("=");
    if (extra !== undefined || !value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)) throw new Error("invalid adaptation control selector");
    if (flag === "--adaptation-id") selector.adaptationId = value;
    else if (flag === "--source-run-id") selector.sourceRunId = value;
    else throw new Error("unsupported adaptation control selector");
  }
  return { action, selector };
}

function failureCode(error) {
  if (error && typeof error === "object" && error.name === "RunnerFailure" && typeof error.category === "string") return `runner.${error.category}`;
  return "adaptation_control.unavailable";
}
