// Where this checkout's FluxIQ Core is.
//
// `domain/package.json` holds `"fluxiq": "link:../../!FluxIQ/packages/fluxiq"`,
// resolved from `<checkout>/domain`. Core is therefore not a setting but a
// position: whatever sits beside the checkout under that name, which is also
// what the domain build and the web panel host import. This answers only the
// path; `scripts/worktree/core-sibling.mjs` adds whether the directory is there
// and is the Core repository the caller meant.

import { readFileSync } from "node:fs";
import path from "node:path";

const LINK = /^link:(.+)$/u;

/**
 * @param {string} extRoot a checkout of this repository
 * @returns {string} the Core root its domain links `fluxiq` from
 */
export function coreRootOf(extRoot) {
  const manifestPath = path.join(extRoot, "domain", "package.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`${extRoot} is not a checkout of this repository: ${manifestPath} could not be read`, { cause: error });
  }
  const spec = manifest?.dependencies?.fluxiq;
  const match = typeof spec === "string" ? LINK.exec(spec) : null;
  if (!match) throw new Error(`${manifestPath} does not depend on fluxiq through link: (found ${JSON.stringify(spec ?? null)})`);
  const packageDir = path.resolve(extRoot, "domain", match[1]);
  if (path.basename(packageDir) !== "fluxiq" || path.basename(path.dirname(packageDir)) !== "packages") {
    throw new Error(`${manifestPath} links fluxiq to ${packageDir}, which is not <core>/packages/fluxiq`);
  }
  return path.dirname(path.dirname(packageDir));
}
