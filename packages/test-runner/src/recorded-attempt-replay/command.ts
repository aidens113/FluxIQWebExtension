import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRecordedArtifact } from "./read-artifact.js";
import { reproduceRecordedBuild } from "./product-runtime.js";

/** Local ignored input references the copied store and exact public entry request; prints no payload. */
export async function runRecordedReplayCommand(input: { repositoryRoot: string; inputFile: string; outputFile: string }) {
  const configuration = JSON.parse(await readFile(input.inputFile, "utf8"));
  if (typeof configuration.artifact !== "string") throw new Error("recorded_artifact_path_required");
  const runRoot = path.resolve(input.repositoryRoot, "test-runs");
  for (const value of [configuration.rootDir, configuration.sourceRootDir, configuration.allowedWorkRoot, input.outputFile]) {
    if (typeof value !== "string") throw new Error("recorded_run_scope_required");
    const relative = path.relative(runRoot, path.resolve(value));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_output_outside_test_runs");
  }
  const artifact = await readRecordedArtifact(configuration.artifact);
  await mkdir(path.dirname(input.outputFile), { recursive: true });
  const divergedRequestFile = path.join(path.dirname(path.resolve(input.outputFile)), "diverged-request.json");
  const report = await reproduceRecordedBuild({ ...configuration, artifact, divergedRequestFile });
  await writeFile(input.outputFile, JSON.stringify(report, null, 2));
  return { proof: report.proof, fullAttemptAccepted: false as const, externalUsd: 0 as const, status: report.session.status, divergence: report.model.divergence, report: input.outputFile };
}
