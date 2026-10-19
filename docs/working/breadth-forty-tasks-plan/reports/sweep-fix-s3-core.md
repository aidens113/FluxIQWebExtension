# Sweep fix S3 (Core): report

Worker report for brief S3 of `breadth-forty-tasks-plan.md`. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t723/!FluxIQ`,
branch `task/t723-sweep-1019-fixes`. Only `packages/fluxiq` was edited. Nothing was committed.

## Outcome

Done. All nine real failures were outdated tests: in each case a deliberate, documented and tested code change made
later had not been carried into an older test. No product code changed. Of the timeout files, five pass alone with
plenty of margin, so their sweep timeouts were load. One, whole-process, has a known structural cost, which I measured
and reduced by about 27% when the machine is quiet.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/`.

### 1. `runtime/executor/tests/ask-activity.test.ts`: 6 failures. The test was outdated.

- Cause: Core 723e0ae8 (t566, 2026-10-18, "mint fresh person asks across repeated flow runs"). A person-needed ask's
  id changed on purpose from the attempt id (`check.attempt.2`) to a fresh `person-needed.<uuid>`, because attempt ids
  repeat across runs but the conversation store keys asks project-wide. The change is documented in
  `docs/architecture/automation-studio.md`. That commit updated `person-needed.test.ts` but missed this test, which
  dates from cc412ffc (2026-09-30).
- Fix: each port's `open` now records the id of the ask it opened. Each row's ref is checked against that id
  (`opened.1`, `opened.2`), and a ref that is anything else still fails visibly. Two checks were added: the opened id
  matches `/^person-needed\./`, and in the parked case it equals `parked.parked.ask.askId`. The test still proves
  everything it proved before (one opening and one settling row per ask, both carrying the same ask id), without
  hard-coding the id.

### 2. `runtime/result-verification/request-rows/tests/kept-condition-advice.test.ts`: 2 failures. The test was outdated.

- Cause: Core 5a652d4a (t563, 2026-10-17, "stored-copy exclusion claims"). It added `alone` to `LEFT_OUT_BY` in
  `refuted-no/missing-claim.ts`, so "Condition 1 ... alone left out 2 rows ...: A; B" is now read as a missing claim.
  Core refutes it when A and B are stored by another copy, and `missing-claim-copy.test.ts` pins that rule. The
  fixture's KEEP_NO no has exactly this shape: its "left out" rows are second copies of stored rows, and the stored
  answer is exactly right. So the no is now wholly refuted, and the t607 re-ask makes a third call. Both old
  assertions ("not wholly refuted", "no third call") rested on Core not reading that sentence.
- I checked the behaviour with a scripted probe (since deleted). The t607 recheck names only the two stored-copy
  findings, never condition 3 or 4, "Sampler" or the kept advice, and t515's "never states as an exclusion" re-ask
  still never happens. t624's guarantee (advice that keeps a condition is neither an exclusion nor a reason to ask
  again) still holds.
- Fix: the header records the t563 change. The third case now asserts `{ wholly: true, findings: [<the two copy
  findings>] }`. The fourth case scripts YES, KEEP_NO, KEEP_NO and asserts 3 calls, verdict `unknown` (a no still
  refuted is unsure), no t515 text, and a recheck that names both copies and does not match
  `/condition [34]|Sampler|rating atLeast/`.

### 3. `runtime/tests/refuted-result/tests/failed-step-reauthor.test.ts`: 1 failure. The test was outdated.

- Cause: Core cb704f47 (t563, 2026-10-18, "Persist shared runtime accounting"). It added
  `if (purse.unreportedParts > 0) return false;` to `automationStudioResultRepairPurseAllowsPart`
  (`recovery/refuted-result/purse.ts`, pinned by `purse.test.ts`): a repair part that reached the provider without
  reporting a cost blocks further paid parts. The "re-authors once" case overrode `llmGate` without
  `costAccounting`, so its ladder became an unreported part and the re-author was refused with
  `llm_budget.run_cost_limit` and `purse { unreportedParts: 1, refusedParts: ["reauthor"] }`. That run record is real
  probe output. A real ladder never writes such a gate: `recovery/annotation/annotate.ts:700` always sets
  `costAccounting` when invoked. The fixture was the unrealistic side.
- Fix: the case now carries the same `costAccounting` as the first case (2 calls, $0.01). I added one case that pins
  cb704f47's fail-closed rule at the route level: a ladder that reached the model and reported no cost is not
  re-authored or re-run, and the marker shows the cost bound and the unreported part.

### 4. Timeouts

Each file was run alone three times with `npx vitest run <file> --reporter=verbose` in `packages/fluxiq`, on a shared
machine (22 node processes, CPU load 13-91% across the runs).

| File | Alone, 3 runs | Slowest test / limit | Verdict |
| --- | --- | --- | --- |
| `storage/canonical-authority/tests/whole-operation.test.ts` | 6/6 pass each time; tests 9.2 s, 7.1 s, 7.0 s | 2.2 s / 15 s | Load. In-process, nothing to fix. |
| `runtime/service/recordings/tests/entry-removal-command.test.ts` | 1/1 pass each time | 0.66 s / 15 s | Load. |
| `runtime/tests/service-adaptation/tests/context-history-reads.test.ts` | 5/5 pass each time; tests 11.2 s, 7.5 s, 2.7 s | 3.5 s / 15 s | Load. |
| `runtime/tests/service-flows/tests/subflow-index-read.test.ts` | 2/2 pass each time | 0.66 s / 15 s | Load. |
| `storage/canonical-authority/tests/whole-process.test.ts` | 16/16, 12/16, 16/16; tests 148 s, 222 s, 187 s | 20 s, and 4 timeouts at 30 s in run 2 | Structural cost made worse by load; mitigated (below). |

In the sweep's own log, in-process whole-operation took 74.5 s for 6 tests, against 7-9 s alone. Everything was
stretched about 10x, so the sweep's timeouts in these files were load.

**whole-process: what the time is.** Each test forks a real Node child, `whole-process-probe.mjs`, that imports the
built package from `packages/fluxiq/dist`, framework barrel first on purpose, since that ordering is part of what
the test checks.

- A timing probe (since deleted), unloaded, per test: fixture setup 0.6-1.0 s, createFlow +0.6-1.0 s, child ready
  +4.4-4.9 s, the child's save to its pause +0.3-1.3 s, then stop and checks about 0.05 s. Child start-up was 65-75%
  of each test.
- The child's import alone: 4.7 s for `dist/framework/index.js` (about 2,200 built modules), and 2.8 s even without
  the framework-first import. `NODE_COMPILE_CACHE` did not help (4.7-5.3 s).
- A `--cpu-prof` of the import: about 3 s of 5 s is Node's ESM resolver touching the file system
  (`getPackageScopeConfig` 1.4 s, `internalModuleStat` 0.57 s, `lstat` 0.39 s). Compiling is only 0.46 s.

So there is no hang and no missing await. The cost is Node resolving a large built graph on Windows, and every
stretch of machine load multiplies it. The two-process race test starts two such children at once.

**The fix.** The child's module load needs nothing from the fixture, so it now overlaps with the fixture build.

- `whole-process-probe.mjs` starts listening for one IPC message before any import, loads the built package, then
  awaits `{ args: [root, mode, projectId, flowId, phase] }`. It exits 2 on a malformed message. The rest is
  unchanged.
- `whole-process.test.ts` forks the child (two for the race) before `wholeFixture`, and `configure` sends the
  arguments once the project and Flow exist. An outer `finally` stops the children if the fixture throws. The test
  timeout (30 s), the child's 15 s phase timer, the phases, the SIGKILL and every assertion are unchanged. Packed
  statements in the bodies I touched were split onto their own lines.

**Measured, old (HEAD, run under temporary names) against new, back to back, mean per test:**

- At load ~50%: old 4.1 s, new 4.3 s. No difference.
- At load 10-20%: old 4.2 s, new 3.1 s, a 27% cut. That matches the 1.1-2 s of fixture setup now overlapped.
- An earlier quiet run of the new version: 2.8-3.5 s per test.
- A final run under heavy load (collect 83 s): 16/16 pass, slowest 14.2 s of 30 s.

This is a mitigation. Under the load of a seven-agent sweep, this file can still be stretched toward 30 s.

**Second hazard found.** During one A/B run, `packages/fluxiq/dist` was rebuilt at 13:34:36-42 by another process in
this worktree, and 11 of 16 old-version tests failed fast (about 1.1 s each). whole-process imports `dist`, so any
build of the package running beside it breaks it. The sweep built before it tested (`run.sh` is sequential), so this
did not cause the sweep's failures. It matters whenever workers share a tree.

## Commands run and observed results

All in `C:/Users/osrs_/FluxStuff/fxwork/t723/!FluxIQ` (vitest from `packages/fluxiq`):

- Before the fixes: `npx vitest run <ask-activity> <kept-condition-advice> <failed-step-reauthor>`. Test Files 3
  failed, Tests 9 failed, 7 passed (16). This reproduces the sweep's 6 + 2 + 1.
- After the fixes, file by file: ask-activity 7/7 passed; kept-condition-advice 4/4 passed; failed-step-reauthor 6/6
  passed (5 old cases and 1 new).
- Neighbouring folders: `npx vitest run src/programs/automation-studio/runtime/executor/tests
  src/programs/automation-studio/runtime/result-verification/request-rows/tests
  src/programs/automation-studio/runtime/tests/refuted-result/tests
  src/programs/automation-studio/storage/canonical-authority/tests`. Test Files 70 passed (70), Tests 627 passed
  (627), 178 s. That run had the earlier packed form of the whole-process change. The reformatted file was then run
  alone: 16/16 passed.
- `pnpm --filter ./packages/fluxiq check`: exit 0 (tsc --noEmit). Run after the last edit.
- `node scripts/structure-audit.mjs`: first run, 1 violation (statement-packing in whole-process.test.ts, 10 against
  a baseline of 9). After splitting the statements: "structure-audit: passed (405 warning(s), 1152 baselined)" and
  "1 baseline entries can be lowered". `--rule statement-packing` shows the lowerable entry is whole-process.test.ts
  (baseline 9).
- Timeout reruns, A/B and profiling: as in the tables above. Raw logs are in the scratchpad at
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/22166e26-c1c5-4e4e-bb9e-c535c9663b2b/scratchpad/s3/`.

## Not verified

- No full `pnpm test`, `pnpm check` or `pnpm build`: the brief asked for narrow checks only.
- I did not run `pnpm structure:baseline`. `.structure-baseline.json` is outside `packages/fluxiq`, which the brief
  limits me to, so the lowerable whole-process entry is left for the supervisor.
- I did not prove that whole-process stays under 30 s under the load of a sweep with seven agents. The mitigation
  only removes the fixture-setup share.
- No browser, Lab or live runs.

## Open questions or contradictions found

- The worktree has uncommitted `packages/fluxiq` changes that are not mine: `api/handlers/llm-generation.ts` and its
  test, `model/authoring-mode/index.ts`, the new `model/authoring-mode/build-authoring-mode.ts` and its test, and
  `runtime/conversations/commands/build.ts`. The brief said only `apps/web` belonged to the other worker. My
  typecheck and audit ran with those changes present.
- whole-process depends on a current `packages/fluxiq/dist`. It tests stale code when dist is old, and it fails when
  dist is rebuilt mid-run. Suggestion: the sweep or the test should check that dist is fresh, or a lock should keep
  builds from running beside it.
- Python rewrote three of my files with LF line endings. Git warns it will convert them to CRLF; the diff stat shows
  only the content changes.
