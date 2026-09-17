// Building the Core packages a worktree's domain links.
//
// Core's `dist/` is gitignored, so a fresh Core worktree has source and no
// types, and anything type-checking against it fails with
// `TS2307: Cannot find module '@fluxiq/contracts/automation-studio'` until
// these are built. Measured 2026-09-17: this is 12.8s of a 52.6s worktree
// setup, on top of 35.8s to install Core.
//
// Two callers need the same list. The Lab's pair moves a Core worktree to a
// commit and rebuilds it; a task's worktree is created from nothing and must
// build it once. Written down twice, a fourth Core package would be added to
// one copy and not the other, and the symptom would be a type error in a
// worktree that looks correctly provisioned.

import path from "node:path";
import { runPnpm } from "./pnpm-command.mjs";
import { noteProgress } from "./progress-note.mjs";

export const CORE_PACKAGES = [
  { filter: "@fluxiq/contracts", directory: "contracts" },
  { filter: "fluxiq", directory: "fluxiq" },
  { filter: "@fluxiq/client-gateway-websocket", directory: "client-gateway-websocket" }
];

/** Where each built package leaves its output, which is how "already built" is decided. */
export function coreDistPaths(coreRoot) {
  return CORE_PACKAGES.map((item) => path.join(coreRoot, "packages", item.directory, "dist"));
}

/** Built in order: each package's output is the next one's input. */
export async function buildCore(coreRoot, { env, note = noteProgress }) {
  note({ step: "build-core", root: coreRoot, packages: CORE_PACKAGES.map((item) => item.filter) });
  for (const item of CORE_PACKAGES) await runPnpm(coreRoot, ["--filter", item.filter, "build"], { env });
}
