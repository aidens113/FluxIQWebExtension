// The isolated Lab checkout pair behind `pnpm lab:pair` (entry point:
// `scripts/lab/pair.mjs`, which describes what the pair is for).
//
// By responsibility: `arguments.mjs` reads the command line; `roots.mjs`
// decides where the two worktrees are; `move-plan.mjs` decides what moving one
// of them involves; `campaign-environment.mjs`, `provider-key.mjs` and
// `instructions.mjs` say how to run a campaign from the pair;
// `command-line.mjs` is the entry point's work.
//
// Everything that is true of any worktree rather than of this pair lives in
// `scripts/worktree/`: reading a worktree's state, comparing paths, finding
// what is running inside one, and running git and pnpm there. `scripts/task/`
// uses the same module, so those refusals exist once.

export { PAIR_USAGE, parsePairArgs } from "./arguments.mjs";
export { campaignEnvironment } from "./campaign-environment.mjs";
export { runPairCommandLine } from "./command-line.mjs";
export { renderPairInstructions } from "./instructions.mjs";
export { planSideMove } from "./move-plan.mjs";
export { providerKeySource } from "./provider-key.mjs";
export { resolvePairRoots } from "./roots.mjs";
