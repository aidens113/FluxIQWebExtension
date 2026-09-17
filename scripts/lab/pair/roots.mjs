// Where the pair lives. The extension side is a worktree of this repository,
// by default `<parent of this checkout>/fxlab/lab-ext`. The Core side is not a
// choice: it is wherever that worktree's `domain/package.json` links the
// `fluxiq` package, because that link -- not FLUXIQ_CORE_ROOT -- decides which
// Core the domain build and the web panel host import. A pair whose Core side
// would be the working Core checkout beside this one is refused, since moving
// it would move another agent's checkout.

import path from "node:path";
import { samePath } from "../../worktree/index.mjs";

const LINK = /^link:(.+)$/u;

/**
 * @param {{ repositoryRoot: string, extRoot: string | null, readText: (file: string) => Promise<string> }} input
 * @returns {Promise<{ extRoot: string, coreRoot: string }>}
 */
export async function resolvePairRoots({ repositoryRoot, extRoot, readText }) {
  const ext = path.resolve(extRoot ?? path.join(repositoryRoot, "..", "fxlab", "lab-ext"));
  if (samePath(ext, repositoryRoot)) throw new Error(`The pair must be a separate checkout, but ${ext} is the checkout this script runs from`);
  const manifestPath = path.join(ext, "domain", "package.json");
  let manifest;
  try { manifest = JSON.parse(await readText(manifestPath)); }
  catch (error) { throw new Error(`${ext} is not a checkout of this repository: ${manifestPath} could not be read`, { cause: error }); }
  const spec = manifest?.dependencies?.fluxiq;
  const match = typeof spec === "string" ? LINK.exec(spec) : null;
  if (!match) throw new Error(`${manifestPath} does not depend on fluxiq through link: (found ${JSON.stringify(spec ?? null)})`);
  const packageDir = path.resolve(ext, "domain", match[1]);
  if (path.basename(packageDir) !== "fluxiq" || path.basename(path.dirname(packageDir)) !== "packages") {
    throw new Error(`${manifestPath} links fluxiq to ${packageDir}, which is not <core>/packages/fluxiq`);
  }
  const core = path.dirname(path.dirname(packageDir));
  const workingCore = path.resolve(repositoryRoot, "..", "!FluxIQ");
  if (samePath(core, workingCore)) throw new Error(`The pair's Core side would be ${core}, the working Core checkout; place the extension worktree where its ../!FluxIQ is a Core worktree of its own`);
  return { extRoot: ext, coreRoot: core };
}
