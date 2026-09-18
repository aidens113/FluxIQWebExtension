import path from "node:path";

/**
 * Where the published Core web builds for one Core checkout live.
 *
 * WHY BESIDE THE CORE. This used to sit under the calling run's runs
 * directory, which made it one cache per *worktree*. Four task worktrees share
 * one detached Core under `F:\fxwork\`, so on 2026-09-18 four Lab runs each
 * found an empty cache of their own, each took their own lock -- locks in four
 * different directories cannot see one another -- and each started a full
 * `next build` of the same Core at the same time. The cache's key is Core's
 * HEAD, Core's `apps/web` source and the hashes of Core's built packages
 * (`inputs.ts`), so its identity was always the Core's. Beside that Core, the
 * existing create-only lock does across worktrees what it already did within
 * one: exactly one builder, and the rest wait for its publication.
 *
 * WHY `.tmp/core-web-build`. Four things have to hold at once:
 *
 * - NOT inside any `node_modules`. The first version of this used
 *   `<core>/node_modules/.core-web-build`, and every build there died in its
 *   first seconds with the Next.js build worker exiting 3221225501
 *   (0xC000001D, STATUS_ILLEGAL_INSTRUCTION -- how a Rust abort surfaces on
 *   Windows). Measured with everything else held fixed, the real build of the
 *   real shared Core: `F:\t013ab\node_modules\cwb` crashed twice, identically,
 *   in 4-5 s; `F:\t013ab\plain_modules\cwb`, the same length, built in 48 s;
 *   `<core>\.tmp\core-web-build` built in 45 s. Turbopack treats a project
 *   whose own path runs through `node_modules` as third-party code, and aborts
 *   building it. The crash is deterministic, and a campaign retried it as this
 *   machine's memory fault four times before anyone looked.
 * - Shared by every worktree that links this Core, so the lock is shared.
 * - Short: Next writes 178 characters below the cache root, and Windows allows
 *   259 (`path-budget.ts`). This is 37 characters for `F:\fxwork\!FluxIQ`.
 * - Ignored by Core's git. `pnpm task sync-core` refuses to move a Core with
 *   untracked files, so a cache that showed up in `git status` would make the
 *   shared Core immovable. Core's `.gitignore` already ignores `.tmp/`, so no
 *   new rule is needed there. Nothing in Core scans it either: Core's structure
 *   audit lists files through `git ls-files --exclude-standard`, every Vitest
 *   and tsc config is rooted in its own package, and `pnpm-workspace.yaml`
 *   names only `apps/*` and `packages/*`.
 *
 * It is removed with the Core worktree, so `pnpm task abandon` and
 * `pnpm task prune` reclaim it without knowing it exists. Deleting it costs one
 * rebuild and loses nothing.
 */
export function coreWebBuildCacheRoot(fluxiqRepositoryRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const declared = env.FLUXIQ_CORE_WEB_BUILD_CACHE?.trim();
  if (declared) return path.resolve(declared);
  return path.join(path.resolve(fluxiqRepositoryRoot), ".tmp", "core-web-build");
}
