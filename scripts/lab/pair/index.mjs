// The isolated Lab checkout pair behind `pnpm lab:pair` (entry point:
// `scripts/lab/pair.mjs`, which describes what the pair is for).
//
// By responsibility: `arguments.mjs` reads the command line; `roots.mjs`
// decides where the two worktrees are; `side-state.mjs` reads one worktree's
// state through `git-command.mjs` and `markers.mjs`; `move-plan.mjs` decides
// what moving it involves; `process-list.mjs` and `processes-using-roots.mjs`
// find anything still running inside the pair; `pnpm-command.mjs` runs its
// installs and builds; `campaign-environment.mjs`, `provider-key.mjs` and
// `instructions.mjs` say how to run a campaign from it; `command-line.mjs` is
// the entry point's work; `path-identity.mjs` compares paths the way Windows
// does.

export { PAIR_USAGE, parsePairArgs } from "./arguments.mjs";
export { campaignEnvironment } from "./campaign-environment.mjs";
export { runPairCommandLine } from "./command-line.mjs";
export { renderPairInstructions } from "./instructions.mjs";
export { planSideMove } from "./move-plan.mjs";
export { processesUsingRoots } from "./processes-using-roots.mjs";
export { providerKeySource } from "./provider-key.mjs";
export { resolvePairRoots } from "./roots.mjs";
