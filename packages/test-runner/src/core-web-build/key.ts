import { createHash } from "node:crypto";
import type { CoreWebBuildInputs } from "./types.js";

/**
 * Raised whenever the staged layout, the build command, or the publication
 * records change, so a build made the old way is never reused. 2: the key
 * follows Core's lockfile and package manifests instead of Core's HEAD.
 * 3: the staged tsconfig drops Core's source aliases, so the panel reads the
 * stamped `dist` instead of compiling Core from source (every layout-2 panel
 * served the unstamped identity placeholder, t342); and the gateway server is
 * keyed by its sources rather than by its generated artifact.
 */
const BUILD_LAYOUT_VERSION = 3;

/** The cache key of a Core web build: 24 hex characters of a SHA-256 over every input. */
export function coreWebBuildKey(inputs: CoreWebBuildInputs): string {
  const packages = Object.keys(inputs.packageHashes).sort().map(name => [name, inputs.packageHashes[name]]);
  const material = JSON.stringify({
    layout: BUILD_LAYOUT_VERSION,
    lockfileHash: inputs.lockfileHash,
    webSourceHash: inputs.webSourceHash,
    serverAdapterSourcesHash: inputs.serverAdapterSourcesHash,
    packages,
    nextConfig: inputs.nextConfig,
    nextVersion: inputs.nextVersion,
  });
  return createHash("sha256").update(material).digest("hex").slice(0, 24);
}
