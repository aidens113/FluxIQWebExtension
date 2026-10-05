# t267-s1-repair-lane report

## Outcome

Done.

## What changed and why

- `packages/test-runner/src/flow-lane/repair/run-repair-lane.ts`
  - `resultRepairOf` now returns the re-author repair whenever
    `resultReauthor.applied === true` with an `adaptationId`, whatever
    `extracted` holds. `datasets` is set only when `run.extracted` has at least
    one dataset (return type `datasets?:`).
  - The `proveLiveRepair` call passes `expectedDatasets` only when
    `resultRepair?.datasets` is present, so a no-rows re-author is replayed
    goal-only (`datasetsReproduced: null`, judged on zero provider calls, run
    succeeded, fixture goal).
  - The function comment, the `lane` input doc, and the file header now say the
    marker may come from either Core route (wrong answer, or failed step with no
    patch-ladder adaptation) and that a run with no rows is replayed goal-only.
  - Unchanged: published `repair: "result_reauthor"`, the declared-repair
    skip for re-authors, runtime-patch repair flow, and the
    adaptation id merge into `recovery`.
- `packages/test-runner/src/flow-lane/repair/tests/run-repair-lane.test.ts`:
  three new tests using `lane()` and `RESULT_REPAIRED`:
  (a) failed-step re-author with `extracted: []` -> 2 replays, each
  `["ran", 0, true, null]`, no `review-flow-adaptation` call, `adaptationIds`
  `[REAUTHORED]`, published `repair: "result_reauthor"`;
  (b) same with `extracted` absent;
  (c) goal-only replay with `goal: false` rejects with the "did not hold: 1 of
  1 replay(s) did not reach the fixture's expected final state" failure, after
  writing a replay with `datasetsReproduced: null`.

## Commands run and observed results

Environment note: the worktree's `packages/test-runner` has no `esbuild` or
`@fluxiq/client-gateway-websocket` in its `node_modules`, so the brief's
command failed as given (`Cannot find module 'esbuild'`, then
`ERR_MODULE_NOT_FOUND @fluxiq/client-gateway-websocket`). Workarounds, no repo
files touched: `NODE_PATH=<worktree>/domain/node_modules` for the bundler, and
`node --import <scratchpad>/t267-s1-repair/register.mjs` (a resolve hook
mapping `@fluxiq/client-gateway-websocket` to `domain/node_modules`) for the
test run.

- Fail-first (new tests, before the fix), `run-repair-lane.test.mjs`:
  `# tests 16 # pass 13 # fail 3` -- tests 14, 15, 16 (the new ones) failed.
- After the fix, the four listed files:
  `run-repair-lane` pass 16 fail 0; `replay-repair` pass 5 fail 0;
  `apply-repair` pass 6 fail 0; `live-repair-lane` pass 4 fail 0
  (combined run: `# tests 31 # pass 31 # fail 0`).
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` from the repo
  root: `domain:build` reused, `test-runner:check` built with no tsc errors,
  exit 0 (run while another worker's edits to other test-runner files were in
  the tree).
- Deleted `packages/test-runner/.test-build-scratch/t267-s1-repair`. The
  directory still holds `t267-s1-mode`, another worker's.

## Not verified

- No Lab, browser, or provider run (out of scope by brief).
- Behaviour against a real Core run marker from a failed-step re-author; tests
  use the existing `RESULT_REPAIRED` fake.

## Open questions or contradictions found

- The brief's `run-subset.mjs` command does not work in this worktree without
  the `NODE_PATH` and resolve-hook workarounds above, because test-runner does
  not depend on esbuild or `@fluxiq/client-gateway-websocket`.
