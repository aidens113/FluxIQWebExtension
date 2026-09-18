// Building the Core packages a worktree's domain links.
//
// Core's `dist/` is gitignored, so a fresh Core worktree has source and no
// types, and anything type-checking against it fails with
// `TS2307: Cannot find module '@fluxiq/contracts/automation-studio'` until
// these are built. Measured 2026-09-17: this is 12.8s of a 52.6s worktree
// setup, on top of 35.8s to install Core.
//
// Two lists, because two callers need different amounts of Core.
//
// `CORE_PACKAGES` is what a worktree needs to compile and to run: the three
// libraries the domain and the runner import. A task worktree and the Lab's
// checkout pair build these and stop, which is what keeps a second worktree at
// seconds rather than minutes.
//
// `FULL_CORE_PACKAGES` adds `@fluxiq/web` and is exactly Core's own root
// `build` script. The shared Core is built with it, because it is not one
// task's private build output: it is the Core every worktree under that base
// links, and a half-built one is a Core whose web panel the next person to run
// `pnpm dev` has to build themselves, inside a checkout three other tasks are
// reading. Note what this does NOT do: a Lab run does not serve this output.
// The Lab stages its own copy of Core's `apps/web` and builds it into a cache
// keyed by Core's content (packages/test-runner/src/core-web-build/), so the
// duplicate web builds four worktrees were each running are stopped by sharing
// that cache, not by this.
//
// Written down once because two callers need the same order. Written twice, a
// fourth Core package would be added to one copy and not the other, and the
// symptom would be a type error in a worktree that looks correctly provisioned.

import path from "node:path";
import { runPnpm } from "./pnpm-command.mjs";
import { noteProgress } from "./progress-note.mjs";

export const CORE_PACKAGES = [
  { filter: "@fluxiq/contracts", directory: "contracts" },
  { filter: "fluxiq", directory: "fluxiq" },
  { filter: "@fluxiq/client-gateway-websocket", directory: "client-gateway-websocket" }
];

/** Core's own root `build` script: the libraries above, then the web panel. */
export const FULL_CORE_PACKAGES = [...CORE_PACKAGES, { filter: "@fluxiq/web", directory: "web" }];

/** Where each built library leaves its output, which is how "already built" is decided. */
export function coreDistPaths(coreRoot) {
  return CORE_PACKAGES.map((item) => path.join(coreRoot, "packages", item.directory, "dist"));
}

/**
 * Where a FULLY built Core has left output: the libraries, plus the web panel's
 * Next output. A shared Core missing the last one is not built, however current
 * its libraries are, or nothing would ever build the web panel into a Core that
 * was provisioned before `sync-core` built it.
 */
export function fullCoreDistPaths(coreRoot) {
  return [...coreDistPaths(coreRoot), path.join(coreRoot, "apps", "web", ".next")];
}

/** Built in order: each package's output is the next one's input. */
export async function buildCore(coreRoot, { env, note = noteProgress, packages = CORE_PACKAGES }) {
  note({ step: "build-core", root: coreRoot, packages: packages.map((item) => item.filter) });
  for (const item of packages) await runPnpm(coreRoot, ["--filter", item.filter, "build"], { env });
}
