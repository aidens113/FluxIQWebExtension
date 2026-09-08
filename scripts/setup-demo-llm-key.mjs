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

try {
  for (const args of builds) await runBuild(args);
  const [{ loadTestEnvironment }, { resolveDemoWorkspaceConfiguration, setupDemoWorkspaceDeepSeekKey }, { certifyDemoLlmSetupArtifacts }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
    import("../packages/test-runner/dist/demo-llm-attestation.js"),
  ]);
  const environment = await loadTestEnvironment(repositoryRoot, process.env);
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const key = await setupDemoWorkspaceDeepSeekKey(config, environment);
  const attestation = await certifyDemoLlmSetupArtifacts({
    workspaceRoot: config.workspaceDirectory,
    secretLiteral: environment.DEEPSEEK_API_KEY,
  });
  process.stdout.write(JSON.stringify({ status: "configured", keyName: key.name, attestation }) + "\n");
} catch {
  process.stderr.write(JSON.stringify({ status: "failed", message: "DeepSeek Secret Keys UI setup failed" }) + "\n");
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
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("setup prerequisite build failed")));
  });
}
