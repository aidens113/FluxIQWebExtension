# t735 sync-core bootstrap: worker report

## Outcome

Done. `pnpm task sync-core` now moves and builds a shared Core that predates the shared tooling. Nothing on
its path loads anything from that Core until the checkout has happened. Every other `pnpm task` command still
refuses such a Core with the "predates the shared tooling ... Merge Core's dev into it" instruction. A
fixture test proves both, running the real `run-task.mjs` in a child process.

## What changed and why

Cause, reproduced first in the new fixture test: `run-task.mjs` imported the task barrel, which imports every
command module. Three chains then loaded Core code at import time, before sync-core's body could run:

- `worktree/core-build.mjs` → `build-cache/index.mjs` → `core-engine.mjs` (needs `build-cache-for.mjs`).
- Every worktree module loaded `runGit`, `samePath`, `pathInside` and `gitAnsweredNo` from Core's
  `scripts/task/`, through top-level `importCoreScript`.
- `start.mjs`, `list.mjs` and `locate.mjs` loaded Core's task rules.

Fixes:

1. `scripts/core-scripts/{git-command,git-answered-no,path-identity,path-inside}.mjs`: new files, verbatim
   copies of Core's `scripts/task/` files of the same names. Copies are needed because the move must decide
   its refusals before the checkout (branch, dirty tree, unreachable HEAD, running processes), and that takes
   git and path identity before the outdated Core can provide them. The barrel `core-scripts/index.mjs`
   exports them and explains why they are copies. The new drift test `core-scripts/tests/core-copies.test.mjs`
   fails when a copy differs from Core's file (line endings ignored). It skips with a reason when the Core
   beside the checkout lacks the file.
2. `scripts/worktree/*` (apply-move, checkout-repository, core-sibling, create, disposable-root, env-local,
   remove, shared-core-move, side-state, index): these now import the primitives from
   `../core-scripts/index.mjs`, not from Core. The worktree barrel re-exports the same names, so consumers
   are unchanged. The worktree directory now loads nothing from Core at import time.
3. `scripts/worktree/core-build.mjs`: the build cache, and with it Core's engine, is imported dynamically.
   This happens only on the path that uses it: a library whose Core does not own its own build. A Core
   moved to Core's `dev` owns its build (`cache-delegation.mjs`), so the move builds with the moved Core's
   own `pnpm --filter X build` and never imports the engine. `step` stays injectable for tests and defaults
   to the cache's `runStep` when that path is reached.
4. `scripts/task/command-line.mjs`: each command's module is imported only when that command runs.
   `scripts/task/run-task.mjs` now enters through `command-line.mjs`, not the barrel. `start`, `list`,
   `finish`, `abandon` and `prune` still import Core's task rules when they run, so they keep the
   "predates" refusal. `scripts/task/index.mjs`: comment updated.

The shared-Core move inside `pnpm task start --worktree` uses the same `planSharedCoreMove` and `applyMove`.
It is now Core-free before the checkout, and its build is delegated after it. `start` itself still needs
Core's task rules (id allocation, branch name) from the Core beside the checkout it runs in. That is the main
Core when run from the main checkout, so it keeps the refusal, as the brief requires for every other command.

## Commands run and observed results

- Before the fix, `node --test scripts/task/tests/sync-core.test.mjs` printed `# pass 0`, `# fail 2`. The
  child `sync-core` died with "FluxIQ Core at ...\trees\!FluxIQ has no scripts/build-cache/build-cache-for.mjs:
  that Core predates the shared tooling", thrown from `core-engine.mjs:18`. This is the reported failure.
- After the fix, `node --test scripts/task/tests/sync-core.test.mjs scripts/core-scripts/tests/*.test.mjs`
  printed `# tests 10`, `# pass 10`, `# fail 0`, `# skipped 0`. The 4 drift checks compared against the
  shared Core at Core dev and did not skip.
- `node --test "scripts/task/tests/*.test.mjs" "scripts/worktree/tests/*.test.mjs" "scripts/core-scripts/tests/*.test.mjs" "scripts/build-cache/tests/*.test.mjs"`
  printed `# tests 171`, `# pass 171`, `# fail 0`, `# skipped 0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (210 warning(s), 625 baselined).` The
  only warnings in owned directories are directory-file advisories that already existed: scripts/task 18,
  scripts/worktree 21 and scripts/worktree/tests 17. This change adds no file to those directories.
- Consumers of the worktree barrel outside the owned directories:
  `node --test "scripts/lab/pair/tests/*.test.mjs" "scripts/lab/core/build/tests/*.test.mjs" "scripts/check/core-build/tests/*.test.mjs"`
  printed 52 tests, 51 pass, 0 fail, 1 skip. The skip already existed and depends on the environment ("no
  FluxIQ Core build output under ...\scripts\!FluxIQ").
- `node scripts/check/core-mirror.mjs` printed "1 mirror set(s) match ... structure-audit (58 files)".

The fixture test (`scripts/task/tests/sync-core.test.mjs`) is set up as follows:

- A throwaway task worktree holds a copy of scripts/task, scripts/worktree, scripts/core-scripts,
  scripts/build-cache and scripts/provider-secret-environment.mjs.
- Beside it is a detached shared Core with no `scripts/` at all, so it lacks `build-cache-for.mjs` and every
  task rule.
- The Core repository's `main` adds a pnpm workspace with Core's four build packages, a stand-in for Core's
  build CLI, and `build-cache-for.mjs`.

It checks four things:

- `sync-core --to main --allow-running --dry-run` reports checkout true, install false, build true and
  behind 1, and changes nothing.
- The real `sync-core` moves HEAD to `main`.
- That run builds through the moved Core's own scripts, in order: contracts, fluxiq,
  client-gateway-websocket, web. It also writes the build marker.
- `list`, `start --dry-run`, `finish`, `abandon --dry-run` and `prune --dry-run` each still fail with the
  "has no scripts/task/...: that Core predates the shared tooling ... Merge Core's dev into it" message.

It never touched the real shared Core or any lane tree.

## Not verified

- I did not run sync-core or task start against the real shared Core or any lane tree, as the brief
  required.
- The move's install step (`pnpm install` in the moved Core) is not exercised end to end; the fixture's
  lockfile is unchanged, so the plan needs no install. It imports nothing from Core: `install-worktree.mjs`
  depends only on `pnpm-command.mjs` and `progress-note.mjs`.
- No fixture test drives `pnpm task start --worktree` end to end, because it installs both sides and runs
  `pnpm build`. Its move uses the same functions the sync-core fixture exercises.
- The lane trees (fxwork/t563, t719, t566, t567) get this only once they merge `dev`. Their Cores are
  task-paired on branches, so with this change sync-core there reaches the existing refusal "The Core ... is
  on the branch ...". It no longer crashes on import. That refusal names no instruction.
- I did not run the full `pnpm check`, per the brief's narrow-checks rule.

## Open questions or contradictions found

- This partly reverses t727 for four primitives. The git runner, the git-refusal reading and path identity
  are again copies downstream, as the bootstrap needs. They are drift-checked by a test inside
  `scripts/core-scripts/tests/`, which `pnpm check` and `pnpm task:test` already glob. The existing
  `scripts/check/core-mirror` mechanism compares the same path on both sides, so it cannot cover them: Core
  keeps them at `scripts/task/`, the copies sit at `scripts/core-scripts/`. If the supervisor prefers one
  drift mechanism, `CORE_MIRRORS` needs per-set path mapping (scripts/check is outside this brief).
- The copies carry Core's comments verbatim, including "The downstream web-extension repository imports this
  module". A verbatim mirror requires that. `core-scripts/index.mjs` explains the copy.
- The sync-core refusal for a Core on a task branch could add the instruction "git -C <core> merge dev" for
  paired lane trees. That message is in `shared-core-move.mjs`; I left it unchanged as out of scope.

UNIT READY: scripts/core-scripts/git-answered-no.mjs, scripts/core-scripts/git-command.mjs, scripts/core-scripts/path-identity.mjs, scripts/core-scripts/path-inside.mjs, scripts/core-scripts/index.mjs, scripts/core-scripts/tests/core-copies.test.mjs, scripts/task/command-line.mjs, scripts/task/index.mjs, scripts/task/run-task.mjs, scripts/task/tests/sync-core.test.mjs, scripts/worktree/apply-move.mjs, scripts/worktree/checkout-repository.mjs, scripts/worktree/core-build.mjs, scripts/worktree/core-sibling.mjs, scripts/worktree/create.mjs, scripts/worktree/disposable-root.mjs, scripts/worktree/env-local.mjs, scripts/worktree/index.mjs, scripts/worktree/remove.mjs, scripts/worktree/shared-core-move.mjs, scripts/worktree/side-state.mjs, docs/working/trace-offline-trials-plan/reports/t735-sync-core-bootstrap.md
