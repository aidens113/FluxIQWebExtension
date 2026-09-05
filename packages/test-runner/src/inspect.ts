import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRunManifestJson } from "@fluxiq-web-extension/test-contracts";
import { sha256 } from "@fluxiq-web-extension/test-evidence";
import { RunnerFailure } from "./failure.js";

export type InspectionResult = { runId: string; valid: true; artifactCount: number; verdict: string | undefined; path: string };

export async function inspectRun(runsDirectory: string, runId: string): Promise<InspectionResult> {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(runId)) throw new RunnerFailure("environment.missing", "Invalid run ID");
  const root = path.join(path.resolve(runsDirectory), runId);
  try {
    const completeBytes = await readFile(path.join(root, "bundle.complete.json"));
    const complete = JSON.parse(completeBytes.toString("utf8")) as { artifactIndexSha256?: unknown };
    const indexBytes = await readFile(path.join(root, "artifact-index.json"));
    if (complete.artifactIndexSha256 !== sha256(indexBytes)) throw new Error("artifact-index digest mismatch");
    const index = JSON.parse(indexBytes.toString("utf8")) as { artifacts?: Array<{ path: string; sha256: string; bytes: number }> };
    if (!Array.isArray(index.artifacts)) throw new Error("artifact index has no artifacts");
    for (const artifact of index.artifacts) {
      const bytes = await readFile(path.join(root, ...artifact.path.split("/")));
      if (bytes.byteLength !== artifact.bytes || sha256(bytes) !== artifact.sha256) throw new Error(`artifact mismatch: ${artifact.path}`);
    }
    const manifest = parseRunManifestJson(await readFile(path.join(root, "run.json"), "utf8"));
    return { runId, valid: true, artifactCount: index.artifacts.length, verdict: manifest.verdict, path: root };
  } catch (cause) {
    throw new RunnerFailure("security.redaction", `Run bundle integrity validation failed: ${runId}`, { cause });
  }
}
