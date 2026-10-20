import { coreWebBuildEnvironment } from "./build-environment.js";
import { loadCoreWebBuildSeam } from "./core-seam.js";

/** What preparing Core's web build would do now: the key it would use, and whether a complete build is already published for it. */
export type CoreWebBuildDecision = { key: string; cached: boolean };

/**
 * The decision `prepareCoreWebBuild` would make, made without acting on it:
 * Core's own dry run (`inspectWebBuild`) over the same base environment a
 * real preparation from `env` would build with, so it names the same key --
 * no directory is created, no lock taken, nothing generated or built.
 */
export async function inspectCoreWebBuild(fluxiqRepositoryRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<CoreWebBuildDecision> {
  const seam = await loadCoreWebBuildSeam(fluxiqRepositoryRoot);
  const declared = env.FLUXIQ_CORE_WEB_BUILD_CACHE?.trim();
  return await seam.inspectWebBuild({ repoRoot: fluxiqRepositoryRoot, ...(declared ? { cacheRoot: declared } : {}), env: coreWebBuildEnvironment(env) });
}
