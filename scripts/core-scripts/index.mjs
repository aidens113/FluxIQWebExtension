// FluxIQ Core's developer tooling as this checkout uses it.
//
// `core-root.mjs` says where the Core beside this checkout is, and
// `import-core-script.mjs` loads Core's shared tooling (the build-cache engine,
// task id allocation, branch naming) from there, refusing a Core too old to
// have it with what to do about it.
//
// The four primitives below -- the git runner, the reading of a git refusal as
// an answer, and path identity -- are the one exception: verbatim copies of
// Core's `scripts/task/` files of the same names, kept here because the
// commands that bring an outdated Core up to date (`pnpm task sync-core`, the
// shared-Core move in `pnpm task start --worktree`) need them before that Core
// can provide them. Loading them from the Core being moved is how sync-core
// came to refuse exactly the Core it exists to fix (t735). They must not drift
// from Core's: `tests/core-copies.test.mjs` fails when they do. Change them in
// Core first, then copy them here.

export { coreRootOf } from "./core-root.mjs";
export { gitAnsweredNo } from "./git-answered-no.mjs";
export { runGit } from "./git-command.mjs";
export { importCoreScript } from "./import-core-script.mjs";
export { samePath } from "./path-identity.mjs";
export { pathInside } from "./path-inside.mjs";
