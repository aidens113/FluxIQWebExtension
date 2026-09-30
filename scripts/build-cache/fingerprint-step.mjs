// A step's fingerprint: a sha256 over what `resolveStep` says the step reads
// -- every input root's content digest -- and what it is -- stamp version,
// step name, command, Node version, platform, fingerprinted environment and
// output locations. Each root's digest is returned too, so a rebuild can name
// the root whose content changed.

import { createHash } from "node:crypto";
import { digestFiles, listInputFiles } from "./fingerprint/index.mjs";
import { resolveStep } from "./workspace/index.mjs";

/**
 * @param {string | ReturnType<typeof resolveStep>} step a registry name, or a step already resolved
 * @param {{ statCache: { hash(file: string): Promise<string> }, repoRoot?: string, env?: NodeJS.ProcessEnv, steps?: object }} options
 * @returns {Promise<{ fingerprint: string, roots: Record<string, string> }>}
 */
export async function fingerprintStep(step, options) {
  const resolved = typeof step === "string" ? resolveStep(step, options) : step;
  const digests = await Promise.all(resolved.roots.map(async (root) => [root.label, await digestFiles(await listInputFiles([root]), options.statCache)]));
  const roots = Object.fromEntries(digests);
  const fingerprint = createHash("sha256").update(JSON.stringify({ meta: resolved.meta, roots: digests })).digest("hex");
  return { fingerprint, roots };
}
