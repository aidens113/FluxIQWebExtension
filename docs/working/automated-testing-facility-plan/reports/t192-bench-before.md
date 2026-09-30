# t192-bench-before: Core build/check baseline timings

## Outcome

Done. Every step of `harness/plan.md` phase `before` ran, one timed step at a time, through the
unmodified `harness/bench.mjs`. `C:/Users/osrs_/FluxStuff/fxwork/t192-bench/before/results.jsonl`
holds 23 rows: 11 matrix rows and 12 breakdown rows. All exited 0 except `C.test` (exit 1: test
failures, recorded below). No step was re-run, because no failure was caused by the bench
environment.

## What changed and why

- I created the disposable clone pair `t192-bench/!FluxIQ` (Core `f0dbbd6`) and
  `t192-bench/!FluxIQWebExtension` (`68ec2f80`). Each is on branch `dev`, has `origin` set to its
  source repository and `dev` tracking `origin/dev`. I checked both push URLs with
  `git remote get-url --push origin`, and both returned `DISABLED`.
- I added one helper, `t192-bench/before/run-step.sh`. Before each step it checks that no node
  process with `bench.mjs` in its command line is running, and then calls `bench.mjs`.
- The edit-one passes appended `// t192 bench edit` to `packages/fluxiq/src/index.ts`. After each
  one I ran `git checkout --` on the file and confirmed with `git status --short` that it was clean.
- `T.start` created task worktrees only under `t192-bench/fxwork/t191` and
  `t192-bench/fxwork/t192`. These ids are local to the bench clone. The real `fxwork/t192` was not
  touched.
- I changed nothing in the source repositories or the shared build store.

## Setup (wall clock, not through the harness)

| Step | Seconds |
| --- | --- |
| C clone (init, fetch dev, checkout, remote, upstream) | about 6 |
| D clone (the same steps) | about 8 |
| `pnpm install --frozen-lockfile` in C | 16 (pnpm reported 15.1s) |
| `pnpm install --frozen-lockfile` in D | 2 (pnpm reported 1.7s, 12 packages) |

The clone times come from directory birth times and reflog timestamps, which have 1-second
resolution. My inline timer failed because `bc` is not installed in Git Bash.

## Timed matrix

| label | pass | seconds | exit | liveMax | buildsMax |
|---|---|---|---|---|---|
| C.build | 1 (cold) | 218.4 | 0 | 4 | 2 |
| C.build | 2 (no change) | 132.4 | 0 | 4 | 2 |
| C.build | 3 (edit-one) | 146.1 | 0 | 4 | 2 |
| C.build | 4 (revert) | 210.3 | 0 | 4 | 3 |
| C.check | 1 | 76.7 | 0 | 4 | 3 |
| C.check | 2 (no change) | 45.1 | 0 | 3 | 2 |
| C.check | 3 (edit-one) | 49.4 | 0 | 3 | 3 |
| C.check | 4 (revert) | 65.0 | 0 | 2 | 3 |
| C.test | 1 | 603.9 | 1 | 3 | 4 |
| T.start | 1 (bench) | 95.2 | 0 | 3 | 4 |
| T.start | 2 (bench2) | 101.2 | 0 | 3 | 4 |

Every run shared the machine with 2 to 4 live Lab lanes and up to 4 held build slots, and free RAM
before a step was sometimes as low as 1.6 to 2.7 GB. Differences between passes of 20 to 60
seconds are within that noise. For example, C.build pass 4 is a revert, but at 210 s it took about
as long as the cold build.

## Breakdown (warm, nothing changed), sorted by seconds

| label | seconds | exit | liveMax | buildsMax |
|---|---|---|---|---|
| C.part.web.build (`next build --turbopack`) | 198.0 | 0 | 2 | 4 |
| C.part.fluxiq.build | 60.2 | 0 | 3 | 4 |
| C.part.fluxiq.check | 52.8 | 0 | 2 | 4 |
| C.part.web.check | 15.3 | 0 | 2 | 3 |
| C.part.structure-audit | 13.5 | 0 | 2 | 3 |
| C.part.gateway.check | 11.5 | 0 | 1 | 3 |
| C.part.contracts.check | 8.6 | 0 | 3 | 3 |
| C.part.contracts.build | 6.8 | 0 | 3 | 3 |
| C.part.gateway.build | 6.0 | 0 | 1 | 4 |
| C.part.structure-test | 4.8 | 0 | 2 | 1 |
| C.part.pnpm-version | 2.9 | 0 | 2 | 3 |
| C.part.task-test | 1.8 | 0 | 2 | 2 |

What the breakdown shows:

- Every package `build` script is `tsc -b tsconfig.build.json --clean && tsc -b ...`. Because it
  runs `--clean` first, a build with nothing changed still does a full rebuild, so the incremental
  build never gets to skip work. That explains why C.build pass 2 (no change) still took 132 s.
- The `@fluxiq/web` Next build dominates `pnpm build`.
- `pnpm check` runs `structure:test`, then `task:test`, then `structure-audit`, then
  `pnpm -r check`. The fluxiq `tsc --noEmit` step, at about 53 s, is most of that time.
- The `pnpm --filter ./packages/fluxiq` filter selected only the package: its log shows the
  `fluxiq@0.7.0` script running in `packages/fluxiq`.

## C.test failures (pass 1, `pnpm test` = `pnpm -r test`)

- `@fluxiq/contracts` passed 9 of 9 files (53 tests), and `@fluxiq/client-gateway-websocket`
  passed 1 of 1 file (4 tests).
- In `fluxiq` (packages/fluxiq), 18 test files failed and 457 passed; at test level, 27 failed,
  4454 passed and 6 were skipped. Vitest reported a duration of 595.6 s, of which collect took
  568.6 s and the tests themselves 3013.4 s summed across workers.
- `@fluxiq/web` tests never ran, because `pnpm -r` stopped at the first failing package.

Every failure is a timeout or a Windows file lock on temp directories. None is an assertion
failure. The failing files, all under `packages/fluxiq/src/programs/automation-studio/`, and their
errors:

| File | Error |
| --- | --- |
| runtime/tests/service-flows/tests/subflow-pagination.test.ts | `Hook timed out in 180000ms`, then `ENOTEMPTY: rmdir ...\fluxiq-subflow-pagination-seed-*\...\configs` |
| api/handlers/tests/runs.test.ts | `Test timed out in 15000ms` |
| runtime/service/run-detail-read/tests/flow-run-detail-reader.test.ts | `Test timed out in 15000ms` |
| runtime/service/summaries/tests/run-detail-preservation.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-adaptation/tests/adaptive-loop.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-adaptation/tests/adaptive-retry-resume.test.ts (2 tests) | `Test timed out in 15000ms` |
| runtime/tests/service-adaptation/tests/durable-patches.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-adaptation/tests/failed-start.test.ts (3 tests) | `Test timed out in 15000ms` |
| runtime/tests/service-adaptation/tests/modes.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-bootstrap/tests/catalog.test.ts | `Test timed out in 15000ms`, then `EBUSY: rmdir ...\fluxiq-flow-bootstrap-generation-*\...\indexes` |
| runtime/tests/service-bootstrap/tests/rejections.test.ts (2 tests) | `Test timed out in 15000ms`, then `EBUSY: unlink ...\runtime\sqlite\global.sqlite` |
| runtime/tests/service-flows/tests/execution-digest.test.ts (2 tests) | `Test timed out in 15000ms` |
| runtime/tests/service-flows/tests/instruction-readiness.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-flows/tests/subflows.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-recordings/tests/assets.test.ts | `Test timed out in 15000ms` |
| runtime/tests/service-recordings/tests/proposal-approval.test.ts (2 tests) | `Test timed out in 15000ms` |
| runtime/tests/service-recordings/tests/proposals.test.ts | `Test timed out in 15000ms` |
| storage/project/tests/runtime-stream-store.test.ts ("million events" plus 4 later tests) | `Test timed out in 60000ms`, then `EBUSY: unlink ...\project.million\project.sqlite-shm` and `project.sqlite`, which cascaded into the later tests in the file |

The full log is `t192-bench/before/logs/C.test.p1.log`, and an ANSI-stripped copy is
`C.test.p1.clean.log`.

## T.start `build-core-package` lines

In both passes all three packages were restored from the shared store, and nothing was compiled:

| pass | package | build-cache | source | ms |
| --- | --- | --- | --- | --- |
| 1 (bench, t191) | @fluxiq/contracts | reuse | store | 323 |
| 1 | fluxiq | reuse | store | 22648 |
| 1 | @fluxiq/client-gateway-websocket | reuse | store | 182 |
| 2 (bench2, t192) | @fluxiq/contracts | reuse | store | 769 |
| 2 | fluxiq | reuse | store | 36024 |
| 2 | @fluxiq/client-gateway-websocket | reuse | store | 179 |

In all six rows the reason was `restored from the shared store (no stamp)`. Restoring `fluxiq`
from the store took 23 to 36 s of the 95 to 101 s total. The rest of the time went to worktree
add, the offline installs and the link steps, none of which log their own `ms`.

## Commands run and observed results

- Every timed step ran as `bash t192-bench/before/run-step.sh <label> <pass> <note> <cwd> <cmd>`,
  which wraps `node harness/bench.mjs --out before/results.jsonl ...`. The printed JSON rows are
  the ones in the tables above.
- `wc -l before/results.jsonl` shows 23 rows.
- Logs for each step are in `t192-bench/before/logs/<label>.p<pass>.log`, and the install logs are
  `setup.install.{C,D}.log`.

## Not verified

- Clone timings are accurate only to about 1 s (see Setup).
- I did not re-run C.test to tell load-induced timeouts apart from real regressions. The test run
  overlapped 3 live lanes and 4 build slots.
- None of the `@fluxiq/web` tests ran.
- The T.start worktrees are still in `t192-bench/fxwork/`. The brief says not to run
  `task finish`, and I ran no cleanup.

## Open questions or contradictions found

- The plan runs Core edit-one only for `build` and `check`. Because of `--clean`, the build
  measurements cannot distinguish an edit from no change.
- `structure-audit` reported that "1 baseline entries can be lowered" in Core `f0dbbd6`.
