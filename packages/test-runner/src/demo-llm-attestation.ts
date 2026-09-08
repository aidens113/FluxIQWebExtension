import { lstat } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "./failure.js";
import { attestWorkspaceSecretAbsence, type SecretLeakFindingCategory } from "./secret-leak-attestation.js";

const REQUIRED_TEXTUAL_SCOPES = Object.freeze([
  "evidence",
  "logs",
  "latest-evidence.json",
  "fluxiq-root/.fluxiq",
]);
const OPTIONAL_TEXTUAL_METADATA = Object.freeze([
  "workspace.json",
  "scenario-port.json",
]);

export type DemoLlmSecretAttestationSummary = Readonly<{
  scannedFiles: number;
  scannedBytes: number;
  skippedBinaryFiles: number;
  findingCount: 0;
  categories: readonly SecretLeakFindingCategory[];
}>;

export async function certifyDemoLlmSetupArtifacts(input: {
  workspaceRoot: string;
  secretLiteral: string;
}): Promise<DemoLlmSecretAttestationSummary> {
  const approvedRelativePaths = [...REQUIRED_TEXTUAL_SCOPES];
  for (const relative of OPTIONAL_TEXTUAL_METADATA) {
    if (await optionalMetadataExists(input.workspaceRoot, relative)) approvedRelativePaths.push(relative);
  }
  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: input.workspaceRoot,
    secretLiteral: input.secretLiteral,
    approvedRelativePaths,
  });
  if (report.status !== "passed") {
    throw new RunnerFailure("recording.persistence", "DeepSeek setup artifact attestation failed");
  }
  return Object.freeze({
    scannedFiles: report.scannedFiles,
    scannedBytes: report.scannedBytes,
    skippedBinaryFiles: report.skippedBinaryFiles,
    findingCount: 0 as const,
    categories: Object.freeze([]) as readonly SecretLeakFindingCategory[],
  });
}

async function optionalMetadataExists(workspaceRoot: string, relative: string): Promise<boolean> {
  const target = path.join(path.resolve(workspaceRoot), ...relative.split("/"));
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new RunnerFailure("recording.persistence", "DeepSeek setup artifact attestation failed");
  }
}
