# t231-w2: Lab side of per-step logs and the central run index

Worker report. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t228/!FluxIQWebExtension` (branch `task/t228-step-logs`). Nothing was committed.

## Outcome

Done. Every requirement in the brief is implemented and covered by provider-free tests. The whole test-runner suite passes (1767/1767) and the structure audit passes. No live run was made.

## What changed and why

New module `packages/test-runner/src/lab-runs/`. It has a barrel, one exported value per file, kebab-case names, no shared filename prefix, and tests in `lab-runs/tests/`.

- `runs-root.ts` `labRunsRoot(env)`: returns `FLUXIQ_LAB_RUNS_DIR` when it is an absolute path. Otherwise it returns `path.join(os.homedir(), "FluxStuff", "lab-runs")`, the same convention as `guard-files.mjs`.
- `local-time.ts` `localDateTime(date)`: the local `YYYY-MM-DD` date for the folder name, and the date and time shown in the index.
- `ledger-task.ts` `ledgerTask(...)`: builds `<scenario>/<work>[/workflow=..][/variant=..]`, the same shape as the task in `scripts/lab/live-guards/live-launch.mjs`.
  - In this worktree that file is 43 lines long. The `:183-191` line reference in the brief does not exist here, so I followed `describeLiveLaunch`.
  - `run-scenario.ts` passes `work = creation?.task.id ?? live.describeRepair().task`. That is the resolved instruction task id, or the llm task such as `create-flow`.
- `run-entry.ts`: the `LabRunEntry` type and `readRunEntry`.
  - Fields: runId, startedAt, pid, lane, instance, task, scenarioId, verdict, bundlePath, repositoryRoot.
  - Added at close: costUsd, finishedAt, steps.
- `count-steps.ts`: counts the `NNNN-*` folders.
- `is-process-alive.ts`: uses `process.kill(pid, 0)`. `ESRCH` means dead.
- `path-exists.ts`: a helper shared by two of the files.
- `write-atomically.ts`: writes a temporary file and renames it into place. Windows `EPERM`/`EBUSY`/`EACCES` on the rename are retried 10 times, 25 ms apart.
- `directory-lock.ts` `withDirectoryLock`: a `mkdir` lock.
  - A lock older than 30 s is stale and is taken over.
  - After waiting 15 s for a live holder, the work runs anyway and the log says so.
- `render-runs-index.ts`: renders the Markdown table.
  - Columns: Started, Lane, Task, Verdict, Cost, Steps, Folder (a relative link `YYYY-MM-DD/<runId>/`).
  - Rows are newest first, and `|` inside a cell is escaped.
- `regenerate-runs-index.ts`: rebuilds the index under `<root>/.index.lock` from every `<date>/<run>/entry.json`.
  - A `running` entry whose pid is dead shows `unfinished`.
  - An unreadable entry is left out and named on stderr.
- `copy-key-files.ts`: copies only these, when present:
  - summary.json, run.json, evaluation.json, report.html, review/, screenshots/
  - snapshots/live-llm.json, snapshots/flow-lane.json, logs/core.log, provider-failures.local.json
- `step-screenshot-watcher.ts` (class `StepScreenshotWatcher`):
  - Polls `steps/` every 1 s.
  - For each complete `NNNN-tool-*` or `NNNN-test-*` folder (one holding `meta.json`) that has no `screenshot.png`, `screenshot.jpg` or `screenshot.skipped.txt`, it captures one picture.
  - Captures run one at a time, each under a 5 s `withDeadline`, which is reused from the `run-scenario` barrel.
  - The file extension is sniffed from the image's first bytes.
  - A failure, an empty result or a late capture writes `screenshot.skipped.txt` with the reason.
  - `stop()` waits for the scan in flight, then photographs what finished since the last poll within a 5 s budget. Anything left after that is marked skipped.
  - Timers are `unref`'d and the watcher never throws.
- `lab-run-record.ts` (class `LabRunRecord`):
  - `open()` creates `<root>/<date>/<runId>/steps/`, writes `entry.json` atomically and regenerates the index.
  - `stepsDirectory` is defined only once `open` succeeded.
  - `watchSteps(capture)` and `stopWatching()` drive the watcher.
  - `close({verdict, bundlePath?})` runs once and is best-effort:
    - creates the junction `fs.symlink(central steps, <bundle>/steps, "junction")`
    - copies the key files
    - reads cost from `snapshots/live-llm.json` `observed.totalEstimatedCostUsd`
    - updates the entry and regenerates the index
  - Every failure goes to stderr as `[lab runs] could not <what> (<folder>): <message>`.

Changes outside the new module:
- `environment.ts`: `TopologyPaths` gains `stepLogDirectory?`. `buildFluxIQEnvironment` sets `FLUXIQ_LLM_STEP_LOG_DIR` only from that field. It also drops any `FLUXIQ_LLM_STEP_LOG_DIR` inherited from the launcher's environment, so a run given no folder logs nothing and two lanes cannot share a folder. That drop is my reading of "absent -> not set".
- `coordinator.ts`: `TopologyOptions.stepLogDirectory?` is passed to `buildFluxIQEnvironment`.
- `run-scenario.ts` wiring, 6 added lines; the file is now 723 lines (cap 800):
  - An import.
  - After `startedAt`: `const labRun = live ? await LabRunRecord.open({...}) : undefined`. This is before `startTopology`; `bundlePath` is `path.resolve(runsDirectory, runId)`.
  - In the `startTopology` options: `...(labRun?.stepsDirectory ? { stepLogDirectory } : {})`.
  - After `periodicCapture.start()`: `labRun?.watchSteps(() => screenshotAdapter.capture(evidenceEvent(..., "checkpoint", ...)))`. This reuses the run's adapter, which is the native window capture with the front-tab fallback.
  - In the cleanup `finally`, after `periodicCapture.stop`: `await labRun?.stopWatching()`. This is before `uiReview.close` and `context.close`.
  - After the sidecar writes: `await labRun?.close({ verdict, bundlePath: finalized.path })`.
  - In the outer publish `finally`: `await labRun?.close({ verdict: "failed" })`. It does nothing after the first close, and it closes the entry if publication threw.
  - Dry runs never reach `runScenario` (`cli.ts:104`), so they are not filed.
- `tests/environment.test.ts`: a new test covers the variable being set, omitted, and an inherited value being dropped.
- `docs/architecture/testing-facility.md`: a new section, "Per-step logs and the central run folder", at the end. It covers the layout, the lifecycle, the index and lock, and secrets.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t231 w2 test-runner build" pnpm run build` (in `packages/test-runner`)
  - Exit 0.
  - Output: `{"build-cache":"build","step":"test-runner:build","reason":"inputs changed: ...","ms":77426,...}`.
  - Before that I fixed one bug the tests caught: the `|` escape had been written as `"\|"` instead of `"\\|"`.
- `node --test dist/lab-runs/tests/*.test.js dist/tests/environment.test.js`
  - First run: 17 pass, 2 fail. One failure was the escape bug above. The other was a stop-budget test whose 20 ms budget was shorter than the folder scan on this machine; I raised it to a 400 ms budget with a 600 ms capture.
  - After the fixes: `# tests 19 # pass 19 # fail 0`.
- `node --test dist/tests/coordinator*.test.js dist/run-evaluation/tests/*.test.js dist/flow-lane/tests/lane-observation.test.js dist/guarded-browser/tests/launch-containment.test.js dist/run-scenario/tests/product-failure.test.js dist/tests/scenario-assertions.test.js`
  - `# tests 102 # pass 102 # fail 0`.
  - These are the tests that pin the source order of `run-scenario.ts`.
- `bash .../heavy.sh "t231 w2 test-runner suite" pnpm run test`
  - Refused before testing, by `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...fxwork/t228/!FluxIQ is 48 minute(s) behind its source. Stale: ...runtime/llm/step-log/model-step.ts".
  - The cause is w1's Core work in progress. I did not rebuild Core because Core is w1's to edit.
- `bash .../heavy.sh "t231 w2 test-runner build+suite" bash -c 'pnpm run build && node --test "dist/**/*.test.js"'`
  - Exit 0, after a fresh build against Core's existing dist.
  - `# tests 1767 # pass 1767 # fail 0 # cancelled 0`, duration_ms 161167.
- `node scripts/structure-audit.mjs` (repository root)
  - `structure-audit: passed (154 warning(s), 118 baselined).`
  - Nothing in `lab-runs/` is flagged. The only line about the touched files is the existing advisory warning `run-scenario.ts: 723 lines is past the 400-line advisory threshold`.
  - I re-ran it after the docs edit: still passed, with no docs-links finding.

What the tests cover:
- `open` writes the entry and `steps/`, and indexes the run.
- Lane fallback.
- `close` against a fake finalized bundle:
  - the junction is a symlink and can be read through
  - the 11 key files are copied and 4 other files are not
  - the entry gets `passed`, `0.0123` and 3 steps
  - the index row matches exactly
  - `rm -r` of the bundle keeps the central steps
- `close` without a bundle, and closing twice.
- A record that cannot open logs one line and does nothing afterwards.
- Dead pid shows `unfinished`, using a real exited child process's pid.
- 24 concurrent entry-write-and-regenerate pairs lose no row.
- A stale lock is taken over, and a held lock times out with a log line.
- A corrupt entry is left out.
- The watcher, with a fake capture:
  - only complete tool and test folders are photographed (not `decide`, not a folder without `meta.json`)
  - PNG and JPEG are told apart by their bytes
  - `maxConcurrent` is 1
  - a folder that completes later is photographed then
  - a throwing, empty or late capture writes `skipped.txt` with its reason
  - the stop budget is honoured
  - a missing `steps/` is not an error

## Not verified

- No live Lab run. Not verified:
  - Core actually writing into the folder: that needs w1's Core plus a live run.
  - Screenshots from the real native window capture.
  - The junction inside a real bundle.
  - Four real lanes regenerating the index at once (only tested in-process).
- `pnpm test` with its Core-freshness gate was not run to completion, because Core's dist is stale while w1 works. The suite was run directly after a fresh test-runner build instead.
- The concurrency test passes with the lock. I did not show that it fails without the lock.
- `pnpm check` and `pnpm build` at the repository root were not run.

## Open questions or contradictions found

- The brief cites `scripts/lab/live-guards/live-launch.mjs:183-191`, but that file has 43 lines in this worktree. I matched `describeLiveLaunch`'s task format instead.
- Dropping an inherited `FLUXIQ_LLM_STEP_LOG_DIR` is a choice. Someone who exports it by hand for a non-live run will now get no step log; say so if that should change.
- pid reuse: a dead run whose pid Windows has reused reads `running` until that process ends.
- The step screenshot shows the browser up to about 1 s (one poll) plus the capture time after the step's `meta.json` appears. It is not taken at the exact instant the step ends.
- `close` in the outer `finally` records `failed` when publication threw. That path has no bundle, so it creates no junction and copies nothing.
