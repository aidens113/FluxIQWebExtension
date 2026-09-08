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
  for (const args of builds) await runBuild(args);
  const [{ loadAllowlistedTestEnvironment }, { resolveDemoWorkspaceConfiguration, runDemoLlmCreationReadinessProbe }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const readiness = await runDemoLlmCreationReadinessProbe(config);
  process.stdout.write(JSON.stringify({
    status: "passed",
    compatible: readiness.compatible,
    httpStatus: readiness.status,
    responseBytes: readiness.responseBytes,
    responseParsed: readiness.parsed,
    supported: readiness.supported,
    llmExecutionGrantsConfigured: readiness.llmExecutionGrantsConfigured,
    providerResolverConfigured: readiness.providerResolverConfigured,
    nativeNodeRegistryConfigured: readiness.nativeNodeRegistryConfigured,
    providerCallCount: 0,
  }) + "\n");
} catch {
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free Flow Bootstrap readiness probe failed", providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}

function runBuild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, { cwd: repositoryRoot, env: withoutProviderSecrets(process.env), stdio: "inherit", windowsHide: true, shell: process.platform === "win32" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("readiness prerequisite build failed")));
  });
}