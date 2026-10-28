# b6-build-time (2026-10-27)

## Outcome
Done, with one check substituted (see Not verified).

## What changed and why
packages/test-runner/src/build-time/:
- types.ts: BuildCategory gains `offline`; StepTiming gains `outcome`; RunBuildTime and BuildTimeTotals gain `liveTrialCount`, `offlineTrialCount` (`trialCount` kept = all test windows).
- read-step-timings.ts: reads `outcome` from meta.json.
- category-rules.ts: rule `offline-trial` (kind `offline_trial` -> offline), placed before trial rules.
- measure-build-time.ts: precedence `reset > offline > trial > model > exploration`; offlineTrialCount = offline steps whose outcome is not `not_tried` / `refused:*` (a null outcome counts as ran); liveTrialCount = test windows containing no `kept_no`/`kept_failed` offline step (by the step's start inside the window).
- aggregate-build-times.ts, render-build-time-table.ts: offline category, Offline column, Live trials and Offline trials columns, precedence line, summary line with live/offline counts.
- tests/offline-trial.test.ts (new, 7 tests): classification, carve-out amounts, offline vs reset overlap, counts, no-offline run, totals/table, header/divider column parity.

## Commands run and observed results
- Red first: tsc of build-time + tests before implementation printed TS2339 errors (`outcome`, `offline`, `liveTrialCount`... do not exist); the compiled run gave `# tests 5 # pass 0 # fail 5`.
- Green: `# tests 18`, `# pass 18`, `# fail 0` (build-time tests; all 4 old files plus new, minus find-recent-runs, see below).
- `npx tsc --noEmit -p tsconfig.json` (test-runner): exit 0, no output.
- `node scripts/structure-audit.mjs | grep ...`: `structure-audit: passed (227 warning(s), 616 baselined).` No FAIL.

## Not verified
- `pnpm --filter @fluxiq-web-extension/test-runner build` refused: "FluxIQ Core's build at ...\fxwork\t769\!FluxIQ is not current with its source" (Core dist absent; rebuilding Core is outside my files). So I compiled build-time + tests with tsc into a scratch `.bt6-out` (deleted) and ran `node --test` there. Because index.ts re-exports find-recent-runs, which imports Core, I stripped that one export line and excluded find-recent-runs.test.ts in the scratch copy only; that test did not run.
- The offline step's placement inside the test window (assumed from design; matching is by time containment of the step's start) is untested against a real Lab run.

## Open questions
- Null/unknown outcome counts as an offline trial that ran; change if P7 prefers otherwise.

UNIT READY: packages/test-runner/src/build-time/{types,read-step-timings,category-rules,measure-build-time,aggregate-build-times,render-build-time-table}.ts, packages/test-runner/src/build-time/tests/offline-trial.test.ts
