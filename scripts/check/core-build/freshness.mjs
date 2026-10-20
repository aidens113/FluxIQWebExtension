// Whether a downstream build, check or test may compile or bundle against
// FluxIQ Core's build.
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
// its build what its source says, by Core's own build cache (`coreBuildCurrency`). Only the words
// differ, because the consequence differs: here it is a check that proves
// nothing, rather than a run that measures the wrong thing.
//
// Refused, not rebuilt. `pnpm check` is read-only, and the Core beside a task
// worktree is usually the shared Core every sibling task and every running Lab
// reads; a check that rebuilt it would delete modules under them. The same
// holds for the package builds and tests that run this gate first
// (`tests/package-gates.test.mjs`): a downstream `pnpm build` writes this
// repository's output, never Core's.

import { CORE_PACKAGES } from "../../worktree/index.mjs";
import { coreBuildCurrency, coreBuildMissing, scanCoreBuildEntries } from "../../lab/core/index.mjs";

/** Core's libraries, in build order: what the extension bundle and the domain load. */
export const CORE_REBUILD_COMMAND = `pnpm ${CORE_PACKAGES.map((item) => `--filter ${item.filter}`).join(" ")} build`;

/**
 * @param {string} coreRoot
 * @param {{ entries?: typeof scanCoreBuildEntries, currency?: typeof coreBuildCurrency }} [checks] replaced by tests
 * @param {{ gate?: string, env?: NodeJS.ProcessEnv }} [options] the command being refused, as the reader typed it (`gate-name.mjs`)
 * @returns {Promise<{ fresh: boolean, message: string | null }>}
 */
export async function coreBuildFreshness(coreRoot, checks = {}, { gate = "pnpm check", env = process.env } = {}) {
  const { entries = scanCoreBuildEntries, currency = coreBuildCurrency } = checks;
  const built = coreBuildMissing(await entries(coreRoot));
  if (!built.built) {
    return { fresh: false, message: `${gate}: refused before compiling or bundling against FluxIQ Core. ${built.message}` };
  }
  const verdict = await currency(coreRoot, { env });
  if (!verdict.stale) return { fresh: true, message: null };
  return {
    fresh: false,
    message: [
      `${gate}: FluxIQ Core's build at ${coreRoot} is not current with its source.`,
      ...verdict.steps.map((item) => `  Stale: Core's build cache would rebuild ${item.step}: ${item.reason}.`),
      "  It compiles or bundles against Core's COMPILED dist, so it would pass or fail on the old Core, not the one that will ship.",
      `  Rebuild Core's libraries, then run ${gate} again: ${CORE_REBUILD_COMMAND} (in ${coreRoot}).`
    ].join("\n")
  };
}
