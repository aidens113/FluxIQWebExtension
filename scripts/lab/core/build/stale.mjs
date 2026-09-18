// The verdict a caller acts on: is Core's build behind Core's source?
//
// Separated from the scan so the decision is testable without a filesystem, and
// because the message is the point. A caller that only learns "stale" reruns
// and hits it again; a caller told which source file is newer than which built
// file, and by how long, rebuilds the right thing once.

/**
 * @param {{ newestMs: number, newestPath: string | null }} sources
 * @param {{ newestMs: number, newestPath: string | null }} output
 * @returns {{ stale: boolean, behindMs: number, message: string | null }}
 */
export function coreBuildStaleness(sources, output) {
  // No sources found, or nothing built yet: neither is staleness, and both are
  // already reported by the callers that care. Saying "stale" here would send
  // someone rebuilding a Core that was never the problem.
  if (!sources.newestPath || !output.newestPath) return { stale: false, behindMs: 0, message: null };
  const behindMs = sources.newestMs - output.newestMs;
  if (behindMs <= 0) return { stale: false, behindMs: 0, message: null };
  const minutes = Math.round(behindMs / 60_000);
  return {
    stale: true,
    behindMs,
    message: `FluxIQ Core's build is ${minutes === 0 ? "less than a minute" : `${minutes} minute(s)`} behind its source: ${sources.newestPath} is newer than anything in Core's dist (newest ${output.newestPath}). The Lab runs Core's COMPILED output, so this run would exercise the old build and report the result as the product's. Rebuild Core first.`
  };
}
