/**
 * Whether a Core web build cache root leaves Windows enough room to write the
 * build.
 *
 * Windows' default limit is 260 characters including the terminating NUL, so a
 * path may be 259. Next writes deep: the deepest file measured in a real
 * published build is 178 characters below the cache root,
 *
 *   <key>/<attempt>/apps/web/.next/server/app/api/programs/automation-studio/
 *   run-datasets/[projectId]/[runId]/[datasetId]/route/server-reference-manifest.json
 *
 * which leaves 80 characters for the cache root itself. That is not abstract.
 * On 2026-09-18 the cache still lived under each worktree's runs directory, and
 *
 *   F:\fxwork\t015-extraction-mismatch-detail\test-runs\instances\t015\.core-web-build
 *
 * is 82. Three Lab runs died inside Turbopack with "path length ... exceeds max
 * length of filesystem", reported as "Core web panel production build did not
 * succeed" -- an environment fault by every appearance. The only difference
 * from the worktree beside it that worked was three characters of task slug.
 *
 * Moving the cache beside its Core (`cache-root.ts`) took the worktree name out
 * of the path and left 34 characters of headroom that no slug can eat. This
 * check is the backstop for what remains: a cache root pointed somewhere long
 * by FLUXIQ_CORE_WEB_BUILD_CACHE, or a Core checked out deeper than usual. It
 * exists so the answer arrives as a sentence about path length before the build
 * starts, rather than as a Turbopack internal error twenty minutes in.
 *
 * DEEPEST_RELATIVE_PATH is measured, not derived: re-measure it with
 * `find <cacheRoot> -type f` over a published build when Next's route tree
 * grows.
 */
export const DEEPEST_RELATIVE_PATH = 178;

/** Windows' MAX_PATH, less the terminating NUL. */
export const WINDOWS_PATH_LIMIT = 259;

export type CoreWebBuildPathBudget = { fits: boolean; root: number; allowed: number; longest: number };

/** @param cacheRoot the directory published builds are written below */
export function coreWebBuildPathBudget(cacheRoot: string, platform: string = process.platform): CoreWebBuildPathBudget {
  // Only Windows has a limit this low. Elsewhere the check would refuse builds
  // that work, which is worse than the failure it prevents.
  const allowed = platform === "win32" ? WINDOWS_PATH_LIMIT - DEEPEST_RELATIVE_PATH - 1 : Number.MAX_SAFE_INTEGER;
  return { fits: cacheRoot.length <= allowed, root: cacheRoot.length, allowed, longest: cacheRoot.length + 1 + DEEPEST_RELATIVE_PATH };
}
