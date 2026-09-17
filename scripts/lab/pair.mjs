#!/usr/bin/env node
// The isolated Lab checkout pair: `pnpm lab:pair --ext <rev> --core <rev>`.
//
// A Lab run rebuilds the extension, the domain, the scenario lab and the test
// runner from the checkout it runs in, and loads FluxIQ Core from the Core
// checkout that checkout links. A campaign started from the working checkouts
// therefore measures whatever another agent has half-edited, and fails for
// reasons that are not in the commit under test.
//
// The pair is two worktrees nobody edits: one of this repository (by default
// `<parent of this checkout>/fxlab/lab-ext`) and one of FluxIQ Core beside it
// (`fxlab/!FluxIQ`, which is where `domain/package.json`'s
// `link:../../!FluxIQ/...` lands from there). This script moves them:
//
//   pnpm lab:pair --ext dev --core dev          both to the named commits
//   pnpm lab:pair --core 42bd90a --dry-run      what would happen, changing nothing
//   pnpm lab:pair                               nothing moves; print the state
//
// It refuses before changing anything when either worktree has uncommitted or
// untracked changes, when a running process is working inside either, when a
// revision does not resolve, or when the Core side would be the working Core
// checkout. Otherwise it checks each side out detached, installs only when the
// lockfile differs from the one last installed there, rebuilds Core's packages
// whenever Core is not at the commit last built (the Lab reads their `dist`;
// it builds the extension side and Core's web panel itself on every run),
// confirms the domain's Core link lands in the pair's Core, and prints the
// environment and commands a campaign from the pair needs.
//
// This file is only the entry point; `pair/index.mjs` says which part is where.

import { pathToFileURL } from "node:url";
import { runPairCommandLine } from "./pair/index.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPairCommandLine(process.argv.slice(2));
}
