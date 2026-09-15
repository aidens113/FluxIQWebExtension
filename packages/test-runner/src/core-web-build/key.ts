import { createHash } from "node:crypto";
import type { CoreWebBuildInputs } from "./types.js";

/**
 * Raised whenever the staged layout, the build command, or the publication
 * records change, so a build made the old way is never reused.
 */
const BUILD_LAYOUT_VERSION = 1;

/** The cache key of a Core web build: 24 hex characters of a SHA-256 over every input. */
export function coreWebBuildKey(inputs: CoreWebBuildInputs): string {
  const packages = Object.keys(inputs.packageDistHashes).sort().map(name => [name, inputs.packageDistHashes[name]]);
  const material = JSON.stringify({
    layout: BUILD_LAYOUT_VERSION,
    coreHead: inputs.coreHead,
    webSourceHash: inputs.webSourceHash,
    packages,
    nextConfig: inputs.nextConfig,
    nextVersion: inputs.nextVersion,
  });
  return createHash("sha256").update(material).digest("hex").slice(0, 24);
}
