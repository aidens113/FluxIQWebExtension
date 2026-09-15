# Report: by-structure-violations

Worktree: `F:\fxlab\fxlab-prod-core` (branch `week1-core-production-build`, head `88490df`). No commits made. `F:\!FluxIQWebExtension` and `F:\!FluxIQ` untouched. `.structure-baseline.json` untouched; `pnpm structure:baseline` not run.

## Outcome

Partial. Violations 2, 3 and 4 (barrel imports) are fixed and verified. Violation 1 (the `src/tests/` file count) is not fixed: I stopped on it as the brief says, because the file that was added belongs in `src/tests/` under the several-subjects placement rule. Violation 5 was left for the supervisor as instructed.

## What changed and why

The audit's `imports` rule (`scripts/structure-audit/rules/imports.mjs`) counts a relative specifier that resolves to a file inside a directory that has a barrel, unless the importer sits inside that directory. A parent directory importing a child's file counts; a `tests/` folder importing its parent's file does not.

1. `packages/test-runner/src/bench/shard-merge.ts` (violation 2): the three imports from `./campaign/identity.js`, `./campaign/shard-group-store.js` and `./campaign/store.js` are now one import from `./campaign/index.js`. All the names (`canonicalJson`, `containedPath`, `loadCampaignCheckpointChain`, `loadCampaignShardGroup`, and the types `CampaignPlanCell`, `CampaignShardGroup`, `CampaignShardProjectionDigest`, `CompletedCampaignCell`) were already re-exported by `campaign/index.ts` through `export *`. No barrel change was needed.
2. `packages/test-runner/src/bench/tests/shard-merge.test.ts` (violation 3): the four imports from `../campaign/identity.js`, `../campaign/shard-group-store.js`, `../campaign/store.js` and `../campaign/shard-plan.js` are now one import from `../campaign/index.js`. `../expand-corpus.js` and `../shard-merge.js` stay as they are, because the rule allows them (the importer is nested in `bench/`). No barrel change was needed.
3. `packages/test-runner/src/facility-failure/project-facility-failure.ts` (violation 4): the import from `../flow-lane/finalized-recording.js` now comes from `../flow-lane/index.js`, and the one from `../run-lifecycle/pairing-status-wait.js` from `../run-lifecycle/index.js`. Both functions were already exported through `export *` in those barrels. `../failure.js` is allowed, since the importer is nested in `src/`.
   - Cycle check: loading the whole barrels pulls in more modules. None of `flow-lane`, `run-lifecycle`, or what they import (`scenario-steps`, `run-expectations`, `trusted-input`, `http-control`, `run-manifest`) imports `facility-failure`, `run-scenario` or `bench`. `run-manifest` reaches the root modules (`coordinator.ts` and others) only through `import type` lines, which compile away. So no new runtime import cycle was introduced.
   - Name collisions: `tsc` reports no ambiguous re-exports (the check below passed).

### Violation 1: not fixed, stopped as instructed

- `git log --diff-filter=A -- packages/test-runner/src/tests/` shows two additions since the relocation commit 70e03aa: `http-control-wait.test.ts` (8fb1331) and `cli-sharded-bench-wiring.test.ts` (d2b7e09, "Add resumable parallel benchmark shards").
- Baseline history for `packages/test-runner/src/tests`: 51 (70e03aa), then 50 (99eca80), then 49 (4d5c8a6). 4d5c8a6 renamed `tests/http-control-auth.test.ts` and `tests/http-control-wait.test.ts` into `http-control/tests/`. d2b7e09 then added `cli-sharded-bench-wiring.test.ts` after the baseline was set to 49, which makes 50.
- The file's subjects are mixed:
  - Tests 1 and 2 check `bench/index.ts` and `bench/campaign/index.ts` (reading the source text, and importing `../bench/index.js`). Those subjects belong to `bench/`.
  - Tests 3 and 4 read and assert on `cli.ts`, which sits at the `src/` root.
- Under AGENTS.md, "a test with several subjects goes in the tests/ folder of the nearest directory containing all of them", and for this file that directory is `src/`. It is also the only test in `src/tests/` that asserts on `cli.ts` (`grep -ln 'cli\.ts' src/tests/*.ts` matches only this file).
- Splitting it would not bring the count down. The barrel half could go to `bench/tests/`, but the CLI half would still be a file in `src/tests/`, which stays at 50. The count drops only if the CLI half is merged into an existing `src/tests/` file, or if some other root-level test moves out. Both are design calls I did not make.
- Options for the supervisor:
  - (a) Move tests 1 and 2 into `bench/tests/`, and merge tests 3 and 4 into an existing CLI-related test in `src/tests/` (for example `commands.test.ts` or `cli-llm.test.ts`; neither currently reads `cli.ts` source).
  - (b) Move a different file whose subject is actually in a subdirectory out of `src/tests/`.
  - (c) Treat the 50th file as justified and decide on the baseline yourself.

## Commands run and observed results

All run from `F:\fxlab\fxlab-prod-core`, one at a time.

1. `node scripts/structure-audit.mjs` (after the edits) exited 1. The FAIL lines were only:
   - `FAIL [directory-files] packages/test-runner/src/tests/: 50 source files exceeds the 25-file limit. ... Baseline for this entry is 49; baselined entries may shrink, never grow.`
   - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`
   - `structure-audit: 2 violation(s) across 2 rule(s).`

   The three `[imports]` failures are gone. The remaining lines are all `warn` advisories that were already there.
2. `pnpm -C packages/test-runner check` (runs `tsc -p tsconfig.json --noEmit`) exited 0 with no diagnostics. `domain/dist` already existed, so it was not rebuilt.
3. `pnpm -C packages/test-runner build` (runs `tsc -p tsconfig.json`) exited 0 with no diagnostics.
4. `node --test --test-concurrency=1 dist/bench/tests/shard-merge.test.js dist/facility-failure/tests/project-facility-failure.test.js dist/tests/cli-sharded-bench-wiring.test.js dist/bench/tests/run-bench.test.js dist/run-evaluation/tests/runner-wiring.test.js` (in `packages/test-runner`) exited 0 with `# tests 68`, `# pass 68`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `duration_ms 11227`.
   - The first two files are the edited ones.
   - The other three import the bench barrel or the `facility-failure` barrel, whose loaded module graph changed.
5. `git status --short` lists 3 modified files and nothing else: `M packages/test-runner/src/bench/shard-merge.ts`, `M packages/test-runner/src/bench/tests/shard-merge.test.ts`, `M packages/test-runner/src/facility-failure/project-facility-failure.ts`. The rebuilt `dist/` is not tracked.

## Not verified

- The full test-runner test suite, and root `pnpm check`, `pnpm test` and `pnpm build`, were not run, per the brief.
- No live Lab run was done. The change only rewrites import specifiers, with no behaviour change.
- The main checkout `F:\!FluxIQWebExtension` was not changed or re-audited. The same three edits would apply there, since its base commit 3d6ecd6 has the same violations.

## Open questions or contradictions found

- The brief says "baseline allows 49, so one file was added there after the baseline". That is correct, but the added file (`cli-sharded-bench-wiring.test.ts`) belongs in `src/tests/` under the placement rules, so a straight move cannot fix violation 1. See the options above.

## Follow-up: violation 1 fixed with option (a), as the supervisor decided

Outcome of this follow-up: Done. The three import fixes above are unchanged.

### Changes

1. New file `packages/test-runner/src/bench/tests/sharded-bench-barrels.test.ts`, holding original tests 1 and 2. The bodies and names are unchanged. Two relative paths were adjusted for the new folder:
   - `sourceRoot` changed from `path.resolve(import.meta.dirname, "..", "..", "src")` to `path.resolve(import.meta.dirname, "..", "..", "..", "src")`. The compiled file runs from `dist/bench/tests/`, one level deeper, so this still resolves to the package's `src/`. The `source("bench/index.ts")` and `source("bench/campaign/index.ts")` reads are relative to `src/` and did not change.
   - The dynamic import changed from `import("../bench/index.js")` to `import("../index.js")`, which is the same module.
2. `packages/test-runner/src/tests/cli-llm.test.ts` now also holds original tests 3 and 4, copied unchanged (names, assertions and messages). It also gained `readFile` in its `node:fs/promises` import and the same `sourceRoot`/`source` helper, unchanged, since the file is still in `src/tests/`.
   - Why this file: it is the only `src/tests/` test whose subject module is `cli.ts` (it imports `runCli` from `../cli.js`), whereas `commands.test.ts` covers the argument parser in `commands.ts`.
   - `cli-llm.test.ts` has no comments or grouping, so none was added.
3. `packages/test-runner/src/tests/cli-sharded-bench-wiring.test.ts` was deleted, only after both destinations compiled and passed (steps 1 to 3 below). Its stale `dist/tests/cli-sharded-bench-wiring.test.js` and `.d.ts` were deleted before the final build.

### Every original test, old location to new location

| # | Test name (unchanged) | Old file | New file |
| --- | --- | --- | --- |
| 1 | the public bench barrels expose the approved shard authority and machine-slot seams | `src/tests/cli-sharded-bench-wiring.test.ts` | `src/bench/tests/sharded-bench-barrels.test.ts` |
| 2 | the runtime barrel exposes the logical orchestration entry points | `src/tests/cli-sharded-bench-wiring.test.ts` | `src/bench/tests/sharded-bench-barrels.test.ts` |
| 3 | CLI creation and resume discriminate serial from saved logical-shard authority without overrides | `src/tests/cli-sharded-bench-wiring.test.ts` | `src/tests/cli-llm.test.ts` |
| 4 | CLI prepares once, shares one safe OS-temp slot root, and prints only logical create/resume lifecycle | `src/tests/cli-sharded-bench-wiring.test.ts` | `src/tests/cli-llm.test.ts` |

A `grep -rF 'test("<name>"' src --include=*.ts | wc -l` for each of the four names after the deletion printed `count=1` for all four, in the new files listed above.

### Commands run and observed results

All run one at a time, from `F:\fxlab\fxlab-prod-core` or `packages/test-runner`.

1. Before deleting anything, `pnpm -C packages/test-runner check` exited 0.
2. Before deleting anything, `pnpm -C packages/test-runner build` exited 0. Both `dist/bench/tests/sharded-bench-barrels.test.js` and `dist/tests/cli-llm.test.js` existed afterwards.
3. Before deleting anything, `node --test --test-concurrency=1 dist/bench/tests/sharded-bench-barrels.test.js dist/tests/cli-llm.test.js` printed `ok 1` to `ok 5`, with all four moved names plus the original cli-llm test (`# tests 5`, `# pass 5`, `# fail 0`), and exited 0.
4. `rm` removed `src/tests/cli-sharded-bench-wiring.test.ts`, `dist/tests/cli-sharded-bench-wiring.test.js` and `dist/tests/cli-sharded-bench-wiring.test.d.ts`. `ls src/tests | wc -l` then printed `49`.
5. `node scripts/structure-audit.mjs` exited 1, with one FAIL line: `FAIL [working-docs] docs/working/README.md is out of date ...`, then `structure-audit: 1 violation(s) across 1 rule(s).` The directory-files and imports failures are gone; only violation 5 remains, and it was left to the supervisor.
6. After deleting, `pnpm -C packages/test-runner check` exited 0.
7. After deleting, `pnpm -C packages/test-runner build` exited 0. `ls dist/tests/cli-sharded-bench-wiring*` then printed `No such file or directory`, so the stale test cannot run.
8. After deleting, `node --test --test-concurrency=1 dist/bench/tests/sharded-bench-barrels.test.js dist/tests/cli-llm.test.js dist/bench/tests/shard-merge.test.js dist/facility-failure/tests/project-facility-failure.test.js dist/bench/tests/run-bench.test.js dist/run-evaluation/tests/runner-wiring.test.js` exited 0 with `# tests 69`, `# pass 69`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `duration_ms 11170`.
   - 69 is the earlier run's 68 (which included all four moved tests) plus the one original `cli-llm` test, which was not in the earlier list.
9. `git status --short` printed:
   - `M` `bench/shard-merge.ts`
   - `M` `bench/tests/shard-merge.test.ts`
   - `M` `facility-failure/project-facility-failure.ts`
   - `M` `tests/cli-llm.test.ts`
   - `D` `tests/cli-sharded-bench-wiring.test.ts`
   - `??` `bench/tests/sharded-bench-barrels.test.ts`

   All six are under `packages/test-runner/src/`. `git diff --stat` shows `cli-llm.test.ts | 29 +++-`, which is the added lines only, with no whole-file line-ending churn. Git printed its usual `LF will be replaced by CRLF` autocrlf warning for that file.

### Not verified in this follow-up

- The full test-runner suite, and root `pnpm check`, `pnpm test` and `pnpm build`, were not run, per the brief.
- `.structure-baseline.json` was not touched. `src/tests/` is now at 49, equal to its baseline, so no ratchet is needed for that entry.
- `bench/tests/` is now at 15 files, the advisory threshold. The audit printed no new warning for it.
