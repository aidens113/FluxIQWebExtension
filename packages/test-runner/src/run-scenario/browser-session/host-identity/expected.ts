import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../../../failure.js";
import { hostSourceInventory } from "./inventory.js";
import { normalizeHostArtifact } from "./normalize.js";
import { screenHostIdentity } from "./screen.js";
import type { HostBuildIdentity } from "./types.js";
/** The intended per-run host artifact and its complete current source provenance. */
export async function expectedHostIdentity(root: string, hostPath: string): Promise<HostBuildIdentity> {
  try {
    const receipt = JSON.parse(await readFile(`${hostPath}.identity.json`, "utf8")) as { identity?: unknown; sources?: Record<string, string> };
    const identity = screenHostIdentity(receipt.identity);
    if (!identity || !receipt.sources || JSON.stringify(Object.keys(receipt.sources).sort()) !== JSON.stringify(await hostSourceInventory(root))) throw new Error("Missing/malformed host identity or incomplete source inventory.");
    const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    const sources: Record<string, string> = {};
    for (const key of Object.keys(receipt.sources).sort()) {
      sources[key] = hash(await readFile(path.join(root, key)));
      if (sources[key] !== receipt.sources[key]) throw new Error(`Stale host source input: ${key}`);
    }
    if (hash(JSON.stringify(sources)) !== identity.sourceInputsDigest || hash(normalizeHostArtifact(await readFile(hostPath, "utf8"))) !== identity.artifactDigest) throw new Error("Stale host artifact or source provenance.");
    return identity;
  } catch (error) {
    throw new RunnerFailure("environment.missing", "Intended domain host identity is unavailable/stale; provider dispatch refused", { details: { operationStage: "host-build-identity", cause: error instanceof Error ? error.message : String(error) } });
  }
}
