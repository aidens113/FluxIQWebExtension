import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../../../failure.js";
import { screenRuntimeIdentity } from "./screen.js";
import { normalizeRuntimeIdentityReader } from "./normalize-reader.js";
import { coreRuntimeBuildInventory } from "./inventory.js";
import type { ExpectedRuntimeIdentity } from "./types.js";
const READER = "packages/fluxiq/dist/runtime/build-identity/read.js";
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const entries = (record: Record<string, string>) => Object.entries(record).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
/** Refuse stale source/artifacts before asking the actual server to attest a build. */
export async function expectedRuntimeIdentity(coreRoot: string, extensionPath: string): Promise<ExpectedRuntimeIdentity> {
  try {
    const stamp = JSON.parse(await readFile(path.join(coreRoot, "packages/fluxiq/dist/runtime-build-identity.json"), "utf8"));
    const identity = screenRuntimeIdentity(stamp.identity);
    if (!identity || !stamp.sources || !stamp.identity.artifacts || hash(JSON.stringify(entries(stamp.identity.artifacts))) !== identity.artifactDigest) throw new Error("Invalid Core stamp.");
    const inventory = await coreRuntimeBuildInventory(coreRoot);
    if (JSON.stringify(inventory.sources) !== JSON.stringify(Object.keys(stamp.sources).sort())
      || JSON.stringify(inventory.artifacts) !== JSON.stringify(Object.keys(stamp.identity.artifacts).sort())) throw new Error("Core stamp inventory is incomplete or stale.");
    const inputs: Array<[string, string]> = [...entries(stamp.sources), ...entries(stamp.identity.artifacts)];
    if (!inputs.length || inputs.length > 20_000 || !inputs.some(([file]) => file === READER)) throw new Error("Incomplete Core stamp.");
    await Promise.all(inputs.map(async ([file, expected]) => {
      if (!/^packages\/(fluxiq|contracts)\/(?:src\/[a-zA-Z0-9_./-]+\.ts|dist\/[a-zA-Z0-9_./-]+\.js|package\.json)$/.test(file) || file.includes("..") || !/^[a-f0-9]{64}$/.test(expected)) throw new Error("Invalid Core input.");
      const bytes = await readFile(path.join(coreRoot, file));
      if (hash(file === READER ? normalizeRuntimeIdentityReader(bytes.toString("utf8")) : bytes) !== expected) throw new Error("Stale Core build.");
    }));
    const extension = JSON.parse(await readFile(path.join(extensionPath, "build-info.json"), "utf8"));
    if (!extension.inputs || typeof extension.inputs !== "object") throw new Error("Missing extension contracts.");
    const reached = entries(extension.inputs).filter(([file]) => /^\.\.\/!FluxIQ\/packages\/(fluxiq|contracts)\/dist\/.+\.js$/.test(file) && file !== `../!FluxIQ/${READER}`);
    if (!reached.length || reached.some(([file, digest]) => !/^[a-f0-9]{64}$/.test(digest) || stamp.identity.artifacts[file.slice("../!FluxIQ/".length)] !== digest)) throw new Error("Reached contracts differ from intended Core.");
    return { identity, reachedInputs: reached.map(([file]) => file.slice("../!FluxIQ/".length)), reachedInputsDigest: hash(JSON.stringify(reached)) };
  } catch (cause) {
    throw new RunnerFailure("environment.missing", "Intended Core runtime build is missing, stale or differs from reached contracts; provider dispatch refused", { cause, details: { operationStage: "core-build-identity" } });
  }
}
