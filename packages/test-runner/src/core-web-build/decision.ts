import path from "node:path";
import { coreWebBuildCacheRoot } from "./cache-root.js";
import { collectCoreWebBuildInputs } from "./inputs.js";
import { coreWebBuildKey } from "./key.js";
import { readPublishedCoreWebBuild } from "./publication.js";

/** What preparing Core's web build would do now: the key it would use, and whether a complete build is already published for it. */
export type CoreWebBuildDecision = { key: string; cached: boolean };

/**
 * The decision `prepareCoreWebBuild` would make, made without acting on it:
 * the same inputs, key and cache root, and only reads -- no directory is
 * created, no lock taken and nothing built. A Core missing an input fails the
 * same way the real preparation would.
 */
export async function inspectCoreWebBuild(fluxiqRepositoryRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<CoreWebBuildDecision> {
  const { inputs, nextExecutable } = await collectCoreWebBuildInputs(fluxiqRepositoryRoot);
  const key = coreWebBuildKey(inputs);
  const published = await readPublishedCoreWebBuild(path.join(coreWebBuildCacheRoot(fluxiqRepositoryRoot, env), key), key, nextExecutable);
  return { key, cached: published !== undefined };
}
