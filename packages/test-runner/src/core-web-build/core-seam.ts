import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RunnerFailure } from "../failure.js";
import type { CoreWebBuildSeam } from "./types.js";

/**
 * Loads Core's keyed web build (`scripts/web-build/index.mjs`) from the Core
 * whose panel is being built. Core owns how its panel is built, staged, keyed
 * and published; the Lab keeps only how a build is supervised and served. The
 * module is loaded at run time from that Core, the way `environment.ts` loads
 * this repository's scripts, so tsc does not pull a file outside this package
 * into its program, and a Core too old to have it fails with what to do.
 */
export async function loadCoreWebBuildSeam(fluxiqRepositoryRoot: string): Promise<CoreWebBuildSeam> {
  const modulePath = path.join(path.resolve(fluxiqRepositoryRoot), "scripts", "web-build", "index.mjs");
  try {
    await access(modulePath);
  } catch (cause) {
    throw new RunnerFailure("environment.missing", `FluxIQ Core at ${fluxiqRepositoryRoot} has no scripts/web-build/index.mjs: that Core predates Core's keyed web build. Merge Core's dev into it (or update it to Core's dev), then retry.`, { cause, details: { path: modulePath } });
  }
  const loaded = await import(pathToFileURL(modulePath).href) as Partial<CoreWebBuildSeam>;
  if (typeof loaded.prepareWebBuild !== "function" || typeof loaded.inspectWebBuild !== "function") {
    throw new RunnerFailure("environment.missing", `${modulePath} does not export prepareWebBuild and inspectWebBuild`, { details: { path: modulePath } });
  }
  return loaded as CoreWebBuildSeam;
}
