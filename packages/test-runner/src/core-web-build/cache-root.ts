import path from "node:path";

/**
 * Where the published Core web builds for one Core checkout live.
 *
 * This used to sit under the calling run's runs directory, which made it one
 * cache per *worktree*. Four task worktrees share one detached Core under
 * `F:\fxwork\`, so on 2026-09-18 four Lab runs each found an empty cache of
 * their own, each took their own lock -- locks in four different directories
 * cannot see one another -- and each started a full `next build` of the same
 * Core at the same time. Two of them failed with "Core web panel production
 * build did not succeed", and the week attributed it to an undiagnosed
 * worktree fault.
 *
 * The cache's identity was never the run's; it is the Core's. Its key is Core's
 * HEAD, Core's `apps/web` source and the hashes of Core's built packages
 * (`inputs.ts`), so two checkouts of the same Core at the same commit compute
 * the same key and can share one published build. Putting it beside that Core
 * is what makes the existing create-only lock do across worktrees what it
 * already did within one: exactly one builder, and the rest wait for its
 * publication.
 *
 * It goes inside Core's `node_modules` for three reasons that all have to hold:
 * that directory is gitignored in every checkout, so the cache cannot make a
 * shared Core dirty and trip the refusals that keep it movable; it is per-Core
 * by construction, including a Core-paired task's nested Core, which shares
 * with nobody and gets its own; and it is removed with the Core worktree, so
 * `pnpm task abandon` and `pnpm task prune` reclaim it without knowing it
 * exists. A `pnpm install` that purges `node_modules` drops the cache, which
 * costs one rebuild and loses nothing.
 */
export function coreWebBuildCacheRoot(fluxiqRepositoryRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const declared = env.FLUXIQ_CORE_WEB_BUILD_CACHE?.trim();
  if (declared) return path.resolve(declared);
  return path.join(path.resolve(fluxiqRepositoryRoot), "node_modules", ".core-web-build");
}
