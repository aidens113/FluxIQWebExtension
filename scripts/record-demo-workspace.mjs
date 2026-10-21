import path from "node:path";
import { loadTestEnvironment } from "@fluxiq-web-extension/test-runner/target-config";
import { recordDemoWorkspace, resolveDemoWorkspaceConfiguration } from "@fluxiq-web-extension/test-runner/demo-workspace";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-workspace")]);
  process.stdout.write("Usage: node scripts/record-demo-workspace.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
try {
  const environment = await loadTestEnvironment(repositoryRoot, process.env);
  const config = resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const state = await recordDemoWorkspace(config);
  process.stdout.write(JSON.stringify({ status: "recorded", workspaceDirectory: config.workspaceDirectory, projectId: state.projectId, flowId: state.flowId, recordingId: state.latestRecordingId }) + "\n");
} catch (error) {
  process.stderr.write(JSON.stringify({ status: "failed", message: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 1;
}
