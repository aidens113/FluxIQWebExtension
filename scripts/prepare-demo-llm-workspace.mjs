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
const preparationEnvironmentNames = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS",
];

let resolvedConfig;
let readPreparationStatus;

try {
  for (const args of builds) await runBuild(args);
  const [{ loadAllowlistedTestEnvironment }, { prepareDemoLlmBlankWorkspace, resolveDemoWorkspaceConfiguration }, statusModule] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
    import("../packages/test-runner/dist/demo-operation-status.js"),
  ]);
  readPreparationStatus = statusModule.readDemoLlmPreparationStatus;
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), preparationEnvironmentNames);
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  resolvedConfig = config;
  await prepareDemoLlmBlankWorkspace(config);
  process.stdout.write(JSON.stringify({ status: "prepared", workspaceDirectory: config.workspaceDirectory }) + "\n");
} catch {
  const diagnostic = resolvedConfig && readPreparationStatus
    ? await readPreparationStatus(resolvedConfig.workspaceDirectory).catch(() => undefined)
    : undefined;
  process.stderr.write(JSON.stringify({
    status: "failed",
    message: "Instruction-only blank Flow preparation failed",
    ...(diagnostic ? { phase: diagnostic.phase, phaseIndex: diagnostic.phaseIndex, failureClass: diagnostic.failureClass, failureCode: diagnostic.failureCode, ...(diagnostic.sourceLocation ? { sourceLocation: diagnostic.sourceLocation } : {}) } : {}),
  }) + "\n");
  process.exitCode = 1;
}

function runBuild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, {
      cwd: repositoryRoot,
      env: withoutProviderSecrets(process.env),
      stdio: "inherit",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("preparation prerequisite build failed")));
  });
}