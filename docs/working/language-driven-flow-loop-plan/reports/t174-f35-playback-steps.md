# t174/F35: a failed playback names its facts, and its commands join steps/

Worker report for lane A lead. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension`, branch `task/t174-live-lane`. Nothing committed.

## Outcome

Done. Both parts were implemented. Part 2 needed no Core change and came to about 190 lines of source (two files).

## What changed and why

### 1. The final-state oracle names each fact that did not hold

- `packages/test-runner/src/flow-lane/creation/final-state-facts.ts` (new). `judgeExpectedFacts(facts, probe)` judges every fact, not just the first that fails, and returns `UnheldFact { factId, subject, predicate, expected, observed }` for each one that did not hold. It reuses `assertExpectedFacts` one fact at a time, so the predicate logic is not duplicated. A fixture that declares a fact wrongly (the wrong value type, or an unknown predicate) still throws. Also new: `FinalStateVerdict { held, unheldFacts, unjudged? }`. Exported through the creation barrel.
- `flow-lane/creation/oracles.ts`. The input `checkFinalState: () => Promise<boolean>` is now `judgeFinalState: () => Promise<FinalStateVerdict>`. On a failure, `CreatedFlowOracles` also carries `unheldFacts` (only when non-empty, so the existing oracle shapes and their tests are unchanged) and `finalStateUnjudged`. The failure message now ends with the fact ids, for example `The created Flow ran, but the scenario's playback goal did not hold afterwards (facts not held: cart-line, coupons-held)`. The same applies to the dataset-task message and to the message for "records failed and final state failed". The message carries ids only. The expected and observed values go only in `details.oracles.unheldFacts`.
- `flow-lane/creation/lane.ts`. The input field is renamed to `judgeFinalState` and passed through.
- `run-scenario.ts`:
  - `flowRunHooks` keeps `checkFinalState` (a boolean) for the recorded-Flow lane, which is unchanged. It adds `judgeFinalState`. On a failure, `nearestFinalStateMisses` judges every open fixture page plus the fallback page and reports the page with the fewest unheld facts (on a tie, the newest page). If the probe throws, it returns `unjudged` with the reason. It never returns an empty list that stands for "could not read".
  - Both `flowRunHooks` calls now take an explicit type argument (`<CreatedFlowLaneEvidence>` and `<FlowLaneEvidence>`). Without it, the new property broke inference of `E`.
  - The failure event gets the correlation `stepId: "final-state"` when `details.oracles.finalState === "failed"`. `summary.json`'s `firstFailure.stepId` and `report.html` then read "step final-state — …(facts not held: …)" instead of "step unknown". `report.html` itself is in `packages/test-evidence`, which I do not own, and it was not changed.
  - Disclosure: the expected and observed values in `failureDetails` follow the existing gate, which is published only for `runtime.behavior` when the scenario declares no secret. In `snapshots/flow-lane.json` (`createdFlowLaneSnapshot`), the `observed` values are replaced with `"[withheld: the scenario declares a secret]"` when the scenario declares secrets. That is the same rule `extraction-mismatches.json` follows.

### 2. The playback's commands are written into steps/

- `packages/test-runner/src/lab-runs/write-playback-steps.ts` (new), `writePlaybackSteps({ attemptsDirectory, stepsDirectory, since, until, redactionLiterals })`:
  - It reads `<.fluxiq>/artifacts/runtime/command-attempts/*/attempt.json`, keeps the attempts dispatched within `[since, until]`, and sorts them by `dispatchedAt`.
  - It numbers them after the highest existing step and writes `NNNN-run-<actionType>/` holding:
    - `call.json`: attemptId, commandId, actionType, outputId, parameters.
    - `result.json`: status, message, failure (category, code, retryable, stage, expected, actual, effect), validation, url, title.
    - `page.txt`: only when the failure carried `failureEvidence.page`.
    - `meta.json`, written last: step, kind `run`, callId, toolId, startedAt, finishedAt, ms, phase `playback`, status `ok` or `failed`, resultCode, failureCode, message, summary, and `redacted` when set.
  - It never copies the result's page snapshot (`payload.result.snapshot`, which holds field values).
  - Redaction:
    - A typed `text` whose validation the extension marked `redacted: true` becomes `[redacted]`, and that validation's expected and actual values are dropped.
    - Every declared redaction literal is replaced in every file, both as written and in its JSON-escaped form.
    - Core's credential shapes (the regex copied from Core's `step-log/screen.ts`) are replaced.
- `lab-runs/rewrite-steps-index.ts` (new). Rewrites `index.md` from every complete folder's `meta.json`, using Core's header and row format word for word. Core keeps its rows in memory and only adds its own, so this is what lists the Lab's rows.
- `lab-runs/index.ts`: barrel exports for both.
- `run-scenario.ts`:
  - `prepareFlowPage("playback")` opens `playbackWindow.since`, and the first `judgeFinalState` closes it (`until`). Repair replays that run after the judgement are therefore excluded.
  - Right after `copyProcessLogs`, at the point where Core has stopped, the run calls `writePlaybackSteps` when there is a live `labRun.stepsDirectory` and a playback window. The call is best-effort. Success and failure are both written to stderr and never swallowed.
  - `labRun.close` later links the bundle's `steps/` to this directory, so the rows show in both places.

Tests:

- `flow-lane/creation/tests/final-state-facts.test.ts` (3 tests, new).
- `flow-lane/creation/tests/lane.test.ts`: the fake now supplies `judgeFinalState` with optional `unheldFacts`, and one new test.
- `lab-runs/tests/write-playback-steps.test.ts` (3 tests, new). These cover the window, the ordering and numbering, the index rows, the page snapshot not being copied, the literal, credential-shape and extension-redacted values never written, and the case with no attempts.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-f35-check" pnpm run check` (in `packages/test-runner`):
  - First run: 8 TS errors in `run-scenario.ts`, because `flowRunHooks` inference of `E` failed. Fixed with explicit type arguments.
  - Second run: `test-runner:check ... stored in the shared store`, exit 0, no errors.
- Build: `heavy.sh "t174-f35-build" sh -c 'node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build'`.
- `node --test dist/flow-lane/creation/tests/*.test.js dist/lab-runs/tests/*.test.js` printed `# tests 116 # pass 116 # fail 0`.
- `node --test dist/tests/scenario-assertions.test.js dist/tests/coordinator-existing.test.js dist/run-evaluation/tests/*.test.js` (`run-scenario.ts` wiring and evaluation) printed `# tests 78 # pass 78 # fail 0`.
- Failing-first. I reverted the new behavior in the compiled `dist` copies only (clause returns `""`, `unheldFacts` dropped, the writer returns at once, and fact judging stops after the first miss), then ran the same two test directories. Result: `# fail 4`, namely `not ok 33` every fact…named, `not ok 56` goal task…names each fact, `not ok 114` each playback attempt…, `not ok 115` declared literal…never written. I then rebuilt `dist` (confirmed the mutation was gone) and re-ran: 116/116 pass.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (157 warning(s), 118 baselined)`. That is 2 more advisory warnings than before (155): `[directory-files]` for `flow-lane/creation/tests/` (16 files) and for `lab-runs/` (17 files). Both are advisory thresholds, not failures.
- Real run, read-only. I copied `lab-runs/2026-10-01/run-muqiho5c-e830ce01/steps` to the scratchpad (`.../scratchpad/t174-f35/steps`) and ran `writePlaybackSteps` with the run's real command-attempts directory and the window `05:23:20Z` to `05:23:58Z`. The writer returned `{"steps":[46,...,57],"redacted":0}`, and its folders were `0046-run-web.browser.navigate` through `0057-run-web.dom.click`. The index rows it added included:
  - `| 0049 | run | web.dom.click | Element clicked. Its page opened in a new tab, which the run now drives. | - |`
  - `| 0054 | run | web.dom.click | web.action.rate_limited: Action refused by the page for now: it said it was busy; it named no wait. | - |`
  - `0054` holds `page.txt` and a `result.json` with `failure.code: web.action.rate_limited, effect: unacted`.
  - `diff` against the original `index.md` showed only 12 added lines: Core's 45 rows were reproduced byte for byte.
  - The original `lab-runs` folder still holds 46 entries and was not touched.
- I restored LF line endings on four files after editing them with Python. `git ls-files --eol` now shows `w/lf` for all of them.

## Not verified

- Part 1 on the real page. Re-judging needs the browser and page from the run, so the fact list for `run-muqiho5c-e830ce01` is not reproduced. The unit tests and the lane test cover the logic. The actual facts (`cart-line` and the coupon fact from HUB_IN_CART) will show on the next live run.
- The `run-scenario.ts` wiring (the window, the hook order relative to Core's stop, the `final-state` stepId reaching `report.html`) was typechecked, and the wiring tests passed. It was not exercised end to end, because no live Lab run was allowed.
- Redaction on the real run used `redactionLiterals: []`. The run's real literals were not resolved. The real run did contain typed values: `text: "3"` and the search text. These are not secrets, and Core's build steps log the same values.
- No whole suites were run (per the brief).

## Open questions or contradictions found

- `report.html`'s "step unknown" fallback text lives in `packages/test-evidence/src/report.ts`, which I do not own. Any failure without a `stepId` still prints "unknown". This change gives the final-state failure a step id (`final-state`) instead.
- The recorded-Flow lane's own message in `run-scenario.ts:~499` ("The generated Flow ran, but the fixture's expected final state did not hold afterwards") still names no facts. That lane still uses the boolean `checkFinalState`. It could switch to `judgeFinalState` the same way if wanted.
- The window relies on the build's exploration and Flow tests not creating command attempts. That held in this run: the attempts are timed from 05:23:29 onward, after the build test, which ended at 05:23:14. `since` is taken at `prepareFlowPage("playback")`, so an attempt from the build cannot fall inside the window.
- The worktree also holds uncommitted `domain/src/runtime/llm-evidence/*` changes that are not mine. I did not touch them.
