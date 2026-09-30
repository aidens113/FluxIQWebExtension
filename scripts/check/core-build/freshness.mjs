// Whether `pnpm check` may bundle the extension against FluxIQ Core's build.
//
// The extension's check bundles every browser entry (apps/extension/scripts/
// check-extension.mjs), and its Core imports resolve through Core's package
// `exports` to Core's COMPILED `dist/`. So a Core source change is invisible to
// that bundle until Core is rebuilt. On 2026-09-30 a Core parking module
// imported `node:crypto`; the extension's bundle reaches it, but Core's `dist/`
// was stale, so `pnpm check` passed and only a live Lab run caught it.
//
// The questions are the Lab's own, asked through the Lab's own modules
// (scripts/lab/core/build/): is Core built at all (`coreBuildMissing`), and is
// its build older than its source (`coreBuildStaleness`). Only the words
// differ, because the consequence differs: here it is a check that proves
// nothing, rather than a run that measures the wrong thing.
//
// Refused, not rebuilt. `pnpm check` is read-only, and the Core beside a task
// worktree is usually the shared Core every sibling task and every running Lab
// reads; a check that rebuilt it would delete modules under them.

import { CORE_PACKAGES } from "../../worktree/index.mjs";
import { coreBuildMissing, coreBuildStaleness, scanCoreBuildEntries, scanCoreOutput, scanCoreSources } from "../../lab/core/index.mjs";

/** Core's libraries, in build order: what the extension bundle and the domain load. */
export const CORE_REBUILD_COMMAND = `pnpm ${CORE_PACKAGES.map((item) => `--filter ${item.filter}`).join(" ")} build`;

/**
 * @param {string} coreRoot
 * @param {{ entries?: typeof scanCoreBuildEntries, sources?: typeof scanCoreSources, output?: typeof scanCoreOutput }} [scanners] replaced by tests
 * @returns {Promise<{ fresh: boolean, message: string | null }>}
 */
export async function coreBuildFreshness(coreRoot, scanners = {}) {
  const { entries = scanCoreBuildEntries, sources = scanCoreSources, output = scanCoreOutput } = scanners;
  const built = coreBuildMissing(await entries(coreRoot));
  if (!built.built) {
    return { fresh: false, message: `pnpm check: refused before bundling the extension. ${built.message}` };
  }
  const newestSource = await sources(coreRoot);
  const newestOutput = await output(coreRoot);
  const verdict = coreBuildStaleness(newestSource, newestOutput);
  if (!verdict.stale) return { fresh: true, message: null };
  const minutes = Math.round(verdict.behindMs / 60_000);
  return {
    fresh: false,
    message: [
      `pnpm check: FluxIQ Core's build at ${coreRoot} is ${minutes === 0 ? "less than a minute" : `${minutes} minute(s)`} behind its source.`,
      `  Stale: ${newestSource.newestPath} is newer than anything in Core's dist (newest built file: ${newestOutput.newestPath}).`,
      "  The extension check bundles against Core's COMPILED dist, so it would pass or fail on the old Core, not the one that will ship.",
      `  Rebuild Core's libraries, then run pnpm check again: ${CORE_REBUILD_COMMAND} (in ${coreRoot}).`
    ].join("\n")
  };
}
