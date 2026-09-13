import { lstat } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "./failure.js";
import { attestWorkspaceSecretAbsence, SECRET_LEAK_ATTESTATION_RUN_LIMITS, type SecretLeakFindingCategory } from "./secret-leak-attestation.js";

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

/**
 * The setup scan uses the Lab run's ceilings: file count, depth, and 8 MiB per
 * file and 64 MiB per scan. `fluxiq-root/.fluxiq` holds Core's SQLite databases,
 * which the scan reads with their `-wal` and `-journal`, and a workspace of
 * recordings outgrows the defaults. Under those defaults, a database or log over
 * 1 MiB would be an `unscanned-store` finding and fail setup on size alone.
 * Anything over these ceilings still fails, since the scan could not read it.
 */
const SETUP_SCAN_LIMITS = SECRET_LEAK_ATTESTATION_RUN_LIMITS;

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
    limits: SETUP_SCAN_LIMITS,
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
