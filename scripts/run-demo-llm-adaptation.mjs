import { spawn } from "node:child_process";
import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const builds = [
  ["--filter", "@fluxiq-web-extension/scenario-lab", "build"],
  ["--filter", "@fluxiq-web-extension/extension", "test:e2e:build"],
  ["--filter", "@fluxiq-web-extension/test-runner...", "build"],
];
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS",
];

try {
  if (!process.argv.slice(2).includes("--no-build")) for (const args of builds) await runBuild(args);
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, runDemoLlmAdaptation }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const result = await runDemoLlmAdaptation(resolveDemoWorkspaceConfiguration(repositoryRoot, environment));
  process.stdout.write(JSON.stringify({
    status: result.status,
    providerCallCount: result.providerCallCount,
    retryCount: result.retryCount,
    reviewOutcome: result.reviewOutcome,
    applyOutcome: result.applyOutcome,
    postApplyValidationStatus: result.postApplyValidationStatus,
    finalReplayRunId: result.finalReplayRunId,
    finalReplayProviderCallCount: result.finalReplayProviderCallCount,
    safetyPassed: result.evaluation.safetyPassed,
    leakAttestation: result.leakAttestation.status,
  }) + "\n");
} catch (error) {
  const reasonCode = sanitizedReasonCode(error);
  process.stderr.write(JSON.stringify({ status: "failed", message: "Bounded UI Flow adaptation certification failed", failureCode: sanitizedFailureCode(error), ...(reasonCode ? { reasonCode } : {}) }) + "\n");
  process.exitCode = 1;
}

function sanitizedFailureCode(error) {
  if (error && typeof error === "object" && error.name === "RunnerFailure" && typeof error.category === "string") return `runner.${error.category}`;
  if (error && typeof error === "object" && typeof error.code === "string" && /^(?:EACCES|EPERM|EBUSY|ENOENT|EEXIST|ENOTEMPTY|EADDRINUSE|ECONNREFUSED|ECONNRESET|ETIMEDOUT)$/.test(error.code)) return `node.${error.code.toLowerCase()}`;
  if (error && typeof error === "object" && error.name === "TimeoutError") return "playwright.timeout";
  return "unknown";
}

function sanitizedReasonCode(error) {
  const value = error && typeof error === "object" && error.details && typeof error.details === "object" ? error.details.reasonCode : undefined;
  return typeof value === "string" && /^adaptation_run\.[a-z_]{1,64}$/.test(value) ? value : undefined;
}

function runBuild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, { cwd: repositoryRoot, env: withoutProviderSecrets(process.env), stdio: "inherit", windowsHide: true, shell: process.platform === "win32" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("adaptation prerequisite build failed")));
  });
}
