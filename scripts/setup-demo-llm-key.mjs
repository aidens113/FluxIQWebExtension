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

// Held outside the try so the failure path can still redact with it: the
// environment that carries the key is loaded inside the try, and a failure
// before or during that load must not lose the ability to strip it.
let secretLiteral = process.env.DEEPSEEK_API_KEY ?? "";

try {
  for (const args of builds) await runBuild(args);
  const [{ loadTestEnvironment }, { resolveDemoWorkspaceConfiguration, setupDemoWorkspaceDeepSeekKey }, { certifyDemoLlmSetupArtifacts }] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
    import("../packages/test-runner/dist/demo-llm-attestation.js"),
  ]);
  const environment = await loadTestEnvironment(repositoryRoot, process.env);
  secretLiteral = environment.DEEPSEEK_API_KEY ?? secretLiteral;
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const key = await setupDemoWorkspaceDeepSeekKey(config, environment);
  const attestation = await certifyDemoLlmSetupArtifacts({
    workspaceRoot: config.workspaceDirectory,
    secretLiteral: environment.DEEPSEEK_API_KEY,
  });
  process.stdout.write(JSON.stringify({ status: "configured", keyName: key.name, attestation }) + "\n");
} catch (cause) {
  // The cause used to be discarded here as well as one level down, so a
  // failure arrived as a single sentence with, in the script's own words, no
  // further detail. The thrown failure now keeps its fixed message and carries
  // the detail structurally, so this walks the chain to surface it. Redaction
  // is local rather than through an imported helper: this is the error path,
  // and it must not itself depend on a module that may be what failed to build.
  process.stderr.write(JSON.stringify({
    status: "failed",
    message: "DeepSeek Secret Keys UI setup failed",
    causes: describeFailure(cause),
  }) + "\n");
  process.exitCode = 1;
}

/** The failure and everything it was caused by, redacted, outermost first. */
function describeFailure(cause) {
  const described = [];
  for (let current = cause; current !== undefined && current !== null; current = current.cause) {
    const message = current instanceof Error ? current.message : String(current);
    const detail = current?.details?.detail;
    described.push({
      message: redactSecret(message),
      ...(typeof detail === "string" ? { detail: redactSecret(detail) } : {}),
    });
    if (described.length >= 8) break;
  }
  return described;
}

/** Strips the provider key from anything this script is about to print. */
function redactSecret(value) {
  return secretLiteral ? value.split(secretLiteral).join("[REDACTED]") : value;
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
