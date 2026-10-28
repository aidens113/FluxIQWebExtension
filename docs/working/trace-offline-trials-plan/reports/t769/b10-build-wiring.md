# B10 build wiring (worker), 2026-10-27

## Outcome
Done, with one follow-up for the supervisor (service.ts is frozen): a candidate build's `phase` is not yet passed.

## What changed and why (AS = packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/)
- `subflow-trials.ts`: builds `automationStudioOfflineFirstSubflow({ buildId, ports, installation: current(), phase, liveRecords })` beside the inner port (ports hoisted to a typed const). Its `offlineFirst` is put on the returned port next to `environmentKind`. A kept answer calls the same `answer(request)` that `run` uses, so `weighed` tells the proposals the gate's verdict. Returned `spent()` = live + offline judge spend; `records()` stays live-only. New optional input `phase` (default `test`).
- `whole-trials.ts`: only the no-ledger (candidate build) branch gets `automationStudioOfflineFirstWhole(...)`; port gets `offlineFirst`, `spent()` = live + offline. Project build (ledger) is untouched and stays live (D40). New optional input `phase` (default `test`).
- `run.ts`: passes `phase: project.repair ? "repair" : "test"` to the subflow trials (one-line change). The existing `decisions` spend (`subflowTrials.spent()`) now includes offline judge spend, so no other change.
- New test `tests/project-build-offline-first.test.ts` (6 tests).

## Commands run and observed results
All from `fxwork/t769/!FluxIQ/packages/fluxiq`.
- First runs of the new test failed while I fixed the test setup: lease missing for the offline call (wrapped in the brief lease), candidate id, judge replies, then a failing-read script to get a kept failure. I wrote the implementation before the test, so I did not show a failing-first run against unwired code.
- `pnpm test src/programs/automation-studio/runtime/service/project-build` -> `Test Files 18 passed (18) / Tests 106 passed (106)`, `Test Files 7 passed (7) / Tests 35 passed (35)`, `all groups passed: parallel, real-sql`.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` -> no output (0 errors). It had flagged readonly `offlineFirst` earlier; fixed with `Object.assign`.
- Core root `node scripts/structure-audit.mjs` -> `structure-audit: passed (444 warning(s), 1152 baselined).` (no FAIL; project-build dir stays at 25 files, run.ts 461 lines unchanged-class warning).

Test coverage: subflow port has `offlineFirst`, runs offline (kept `execution_failed`, no new live command, live records still 1) and `weighed` tells the proposals `execution_failed` once; without an installation it answers `offline_trials_off` and spend is unchanged; offline judge spend is added (calls doubled after one judged offline run, partial and whole); a project build's whole port has no `offlineFirst`; a candidate build's whole port has it, answers `no_live_source` before a recording, keeps a failure after one, `records()` stays 1.

## Not verified
- Real gate end to end (subflow-trial-gate calling `weighed` after a kept answer): only the port's `weighed` call was tested.
- The offline judge path could not produce a "no" with the project build's real judge on a successful run (judge gave `not_judged`/inconclusive), so the kept-answer test uses a failed read rather than a judged no.
- No live run, no full suites.

## Open questions or contradictions found
- `AS runtime/service.ts:1585` (frozen) calls `automationStudioProjectBuildWholeTrials` without `phase`, so a repair candidate build's whole trials run under `test`. It needs `phase: repairBrief ? "repair" : "test"` added to that call (a few characters, but the file is at its line baseline: the change is within the existing long line).
- Offline derived traces still count in the harness's trace tally (`h.traces()` goes up by one per offline run); they are never a recording source (factory handles this).

UNIT READY: runtime/service/project-build/{subflow-trials.ts, whole-trials.ts, run.ts, tests/project-build-offline-first.test.ts}
