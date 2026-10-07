import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../../../failure.js";
import { serverAdapterSourceInventory } from "./inventory.js";
import { normalizeServerAdapterArtifact } from "./normalize.js";
import { screenServerAdapterIdentity } from "./screen.js";
import type { ServerAdapterBuildIdentity } from "./types.js";
/** The intended per-run server artifact and its complete current source provenance. */
export async function expectedServerAdapterIdentity(root: string, modulePath = path.join(root, "apps/web/.server-runtime/client-gateway-server.mjs")): Promise<ServerAdapterBuildIdentity> {
  try {
    const receipt = JSON.parse(await readFile(`${modulePath}.identity.json`, "utf8")) as { identity?: unknown; sources?: Record<string, string> };
    const identity = screenServerAdapterIdentity(receipt.identity);
    if (!identity || !receipt.sources || JSON.stringify(Object.keys(receipt.sources).sort()) !== JSON.stringify(await serverAdapterSourceInventory(root))) throw new Error("Missing/malformed server adapter identity or incomplete source inventory.");
    const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    const sources: Record<string, string> = {};
    for (const key of Object.keys(receipt.sources).sort()) {
      sources[key] = hash(await readFile(path.join(root, key)));
      if (sources[key] !== receipt.sources[key]) throw new Error(`Stale server source input: ${key}`);
    }
    if (hash(JSON.stringify(sources)) !== identity.sourceInputsDigest || hash(normalizeServerAdapterArtifact(await readFile(modulePath, "utf8"))) !== identity.artifactDigest) throw new Error("Stale server artifact or source provenance.");
    return identity;
  } catch (error) {
    throw new RunnerFailure("environment.missing", "Intended server adapter identity is unavailable/stale; provider dispatch refused", { details: { operationStage: "server-adapter-identity", cause: error instanceof Error ? error.message : String(error) } });
  }
}
