import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serverAdapterSourceInventory } from "../run-scenario/browser-session/server-adapter-identity/index.js";

/**
 * The digest of every source Core's gateway server generator reads, computed
 * the way its receipt computes `sourceInputsDigest`: each inventoried file's
 * SHA-256, by path in sorted order. It is what the build key covers in place
 * of the generated `.server-runtime/client-gateway-server.mjs`, which a run
 * regenerates just before keying while a dry run never does -- so a key over
 * the artifact told the dry run one key and built another (t342).
 */
export async function hashServerAdapterSources(fluxiqRepositoryRoot: string): Promise<string> {
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const sources: Record<string, string> = {};
  for (const file of await serverAdapterSourceInventory(fluxiqRepositoryRoot)) sources[file] = hash(await readFile(path.join(fluxiqRepositoryRoot, file)));
  return hash(JSON.stringify(sources));
}
