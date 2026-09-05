import path from "node:path";
import { loadTestEnvironment } from "../packages/test-runner/dist/target-config.js";
import { recordDemoWorkspace, resolveDemoWorkspaceConfiguration } from "../packages/test-runner/dist/demo-workspace.js";

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
