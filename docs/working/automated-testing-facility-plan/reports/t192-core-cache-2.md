# t192-core-cache-2: Core check floor and restore speed

## Outcome

Done. Two runs of `pnpm check` through heavy.sh both exited 0. The second, with nothing changed, took **21.7 s**; the previous task measured 51.4 s. Restoring fluxiq from the store into an empty `dist` (4,148 files) now takes **3.6 s** instead of 43.6 s. `build-cache:test` passes 61 of 61. The structure audit passes with 194 warnings, the same as before, and none of them names `scripts/build-cache`.

## What changed and why

All changes are in Core (`fxwork/t192/!FluxIQ`), inside the owned paths: `scripts/build-cache/**` and the root `package.json` `check` script.

1. **Root `check`.** The three `pnpm structure:test && pnpm task:test && pnpm build-cache:test` calls are replaced by one `node --test` over all four globs, so node runs their files side by side.
   - The individual scripts are kept unchanged.
   - `tests/registry.test.mjs` now requires two things:
     - the check starts with `node --test`;
     - that call contains every glob of the three suite scripts.
2. **Parallel restore.**
   - New `scripts/build-cache/for-each-limited.mjs` (exported from `index.mjs`) is a bounded pool. After the first failure it starts no new job, waits for the running jobs to finish, and then throws the first error.
   - `store/restore-entry.mjs` uses it with `COPY_CONCURRENCY = 16` for two things:
     - removing extra output files;
     - the check-then-copy of each stored file.
   - The "copy only differing files" rule is unchanged: a file is skipped when its sha256 already matches.
   - Full-digest verification and the required-file check still run afterwards.
   - A missing blob no longer returns in the middle of the loop. It is recorded, and once the in-flight copies have finished the entry is discarded. The message names the lowest-numbered missing blob, so the result does not depend on which copy finished first.
3. **Registration guard.** New `scripts/build-cache/workspace/unregistered-scripts.mjs` (`findUnregisteredScripts`, exported from both barrels). For every package that `pnpm-workspace.yaml` picks up and that has a `build` or `check` script, it reports each of these problems:
   - `<dir>:<kind>` is not registered for that directory and kind;
   - the script does not call the cache CLI with that step;
   - the root script of the same kind does not list the step in any `cli.mjs` call.
4. **Slow tests.** Three files were split, with the tests moved verbatim and the same fixtures:
   - `invalidation` → `invalidation` + `ignored-inputs`;
   - `run-step` → `run-step` + `stamp-rules`;
   - `store` → `store` + `store-restore`.

   An intermediate `schedule-steps.test.mjs` was folded back into `run-step`, because it pushed `tests/` to 16 files and tripped the audit's 15-file advisory. No coverage was dropped. The time goes on real process spawns (a shell, node and git for every step, about 300 ms each), and removing those would remove what the tests prove.

New tests in `scripts/build-cache/tests/`:
- `restore-many.test.mjs`:
  - restoring 121 files into an empty output gives identical content, with every file counted as copied and the local stamp written;
  - with blobs 13, 60 and 97 deleted, the entry is discarded naming blob 13, and the build that follows writes every file.
- `for-each-limited.test.mjs`: the peak equals the limit and each item runs exactly once; after a failure nothing new starts and nothing is still running when the error is thrown; an empty list does nothing; a limit below 1 throws `RangeError`.
- `unregistered-scripts.test.mjs`:
  - the real repository gives `[]`, and at least 4 packages have a check script;
  - a fixture that is correct passes;
  - a new package whose `check` is `tsc --noEmit` is reported three times: not registered, not through the CLI, not listed;
  - a step the root leaves out is reported;
  - a script that runs another step, and a step registered for another directory, are both reported.

## Commands run and observed results

The machine was loaded throughout: CPU at 67% from other processes, and other lanes held heavy slots.

**Task 1: suites run one after another versus one `node --test`**

These were run back to back, twice, before the split:

| Round | Separate `pnpm` suites | One `node --test` | Tests passed |
| --- | --- | --- | --- |
| 1 | 28,647 ms | 19,030 ms | 253 |
| 2 | 27,985 ms | 22,657 ms | 253 |

After the split and the new tests, also twice:

| Round | Separate `pnpm` suites | One `node --test` | Tests passed |
| --- | --- | --- | --- |
| 1 | 28,406 ms | 20,128 ms | 263 of 263 |
| 2 | 28,175 ms | 24,786 ms | 263 of 263 |

**Task 2: restore into an empty `dist`**

Before the change:
- Procedure: moved `packages/fluxiq/dist` to scratch, deleted `fluxiq-build.json`, then ran `heavy.sh … node scripts/build-cache/cli.mjs fluxiq:build`.
- Result: `"restored from the shared store (no stamp; 4148 file(s) copied)","ms":43606`, 45,338 ms wall.

After the change:
- `"ms":3655`, 4,479 ms wall. `diff -rq` against the moved-aside dist printed nothing (`DIST IDENTICAL`).
- A repeat run gave `"ms":3553`, 4,232 ms wall.

The next `heavy.sh pnpm build` reused all 4 steps in 4,458 ms. For web, the log line was `1 required output(s) touched, because packages/fluxiq/dist/api-contracts/index.d.ts is newer than every output`, which is the designed stale-guard behaviour after a restore. `git status --short` showed only the 5 `package.json` files and `?? scripts/build-cache/`.

**Build before the restore measurement**

`heavy.sh pnpm build` exited 0 in 149 s. Web was built because its inputs changed (`package.json` and `scripts/build-cache`). The three libraries were already stamped at their new fingerprints; see open questions.

**Task 3 and all tests**

`node --test "scripts/build-cache/tests/*.test.mjs"` gave `# tests 61  # pass 61  # fail 0` on the final tree.

**Definition of done**

| Run | Result | Time | Detail |
| --- | --- | --- | --- |
| `heavy.sh pnpm check` (C) | exit 0 | 28,269 ms | 263 of 263 tests passed. The audit was rebuilt (7.7 s) because the test files changed. All 4 package checks were reused. |
| `heavy.sh pnpm check` (D), no change | exit 0 | 21,700 ms | 263 of 263 passed; `node --test` `duration_ms 18287`. All 5 cached steps were reused: audit 376 ms, contracts 172 ms, client-gateway-websocket 253 ms, fluxiq 349 ms, web 616 ms. |

The audit printed `passed (194 warning(s), 354 baselined)` on both runs. An earlier pair of runs, A at 56.5 s (with a cold check miss) and B at 23.6 s, were made before the folding. B showed 195 warnings: the extra one was `[directory-files] scripts/build-cache/tests/: 16 source files`, and the folding removed it.

Logs are in the scratchpad as `t192c2-check{A,B,C,D}.log` and `t192c2-build-miss.log`.

## Not verified

- **Task 4 speed-up.** Splitting the files shortened the longest single file from about 14.7 s to 6.2 s. The combined wall time did not measurably improve, because under this load the suite is limited by CPU, not by its longest file. The gain is expected only on an idle machine, and was not measured there.
- **Other concurrency limits.** The restore was measured only at 16, on one loaded machine.
- **`pnpm test`.** Not run. Nothing it runs was changed.
- **Documentation.** Core docs describing `check` are outside the owned paths and were not updated.

## Open questions or contradictions found

- **Another process built this Core tree during the task.** The library stamps were rewritten at 23:28–23:31 local, after my source edits at 23:26–23:27, and I did not run those builds. It was probably the downstream worktree beside it running `buildCore`. It did not affect the results, but concurrent use of this tree should be known.
- **Audit line not investigated.** `structure-audit: 1 baseline entries can be lowered` printed on every check. The previous task saw it too. It is not in my files.
