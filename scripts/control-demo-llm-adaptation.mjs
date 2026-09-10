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
  const parsed = parseArguments(process.argv.slice(2));
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, controlPreparedDemoLlmTargetAdaptation }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const result = await controlPreparedDemoLlmTargetAdaptation(resolveDemoWorkspaceConfiguration(repositoryRoot, environment), parsed.action, parsed.selector);
  process.stdout.write(JSON.stringify(result) + "\n", () => process.exit(0));
} catch (error) {
  process.stderr.write(JSON.stringify({ status: "failed", failureCode: failureCode(error), providerCallCount: 0 }) + "\n", () => process.exit(1));
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
