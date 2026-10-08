# t363 report: the on-page overlay calls a candidate trial a test, not a repair

## Outcome

Done. While a candidate build test-runs its Flow, the overlay (and the panel's status row, which shows the same paced display) now says "Testing your Flow". A step that fails in the trial reads "A step didn't work in the test: <why>". When the trial ends, the line gives the verdict and what happens next, and the headline goes back to "Building your Flow". No trial event can make the headline "Fixing your Flow" or "Couldn't fix your Flow". Saved-Flow runs and repairs are worded as before.

## What changed and why

Cause (from the round 4 evidence, `steps/0032-tool-core.test_candidate/screenshot.jpg`): Core reports the trial's run steps inside the build's own unit of work. When a trial step fails, Core sends its usual "Recovering from a failed step" row, which has the `repairing` phase. `UnitSituation` treated that row as the start of a repair. `RunRetry` also counts every repairing event in a build as a repair. Together they set the headline to "Fixing your Flow". For a build, that repair state then lasts until the build settles or a result check passes, so the wrong headline stayed up after the trial ended.

Run kind: the trial session's `metadata.candidateTrial` is never sent on the activity wire (`ClientGatewayActivity` has no metadata). The trial can still be identified from what Core already sends: the build's tool row with `ref: "core.test_candidate"`. Its `started` row opens the trial, and its closing row (record `Result: candidate.trial_<verdict>`) ends it. Every event in between belongs to the trial's run. No wire change was needed.

Files:
- `apps/extension/src/background/activity/candidate-trial.ts` (new): the `CandidateTrial` class and its `TrialState`. It opens and closes the trial on the `core.test_candidate` row, and a unit that settles closes it too. It also produces the trial's own lines: the failed-step line and one verdict line each for yes, no, execution_failed, unsure and not_judged. Any other code (a refusal) reads "The test didn't run. Next: deciding what to do".
- `headline.ts`: new `testing` situation that gives "Testing your Flow". It ranks above `repairing`. A waiting state still ranks above it. A run never reads "Couldn't fix" while `testing` is set.
- `unit-situation.ts`: `observe(event, inTrial = false)`. An event inside a trial does not start a repair or a rebuild.
- `pacer.ts`: wires in `CandidateTrial`. While testing: the repair flag is off, the trial's line takes the place of Core's sentence, and the `repairing` phase is shown as `running` (so the pill is not repair-orange). The step count is not carried across either end of a trial. The header comment is updated.
- `shared/activity/activity-display.ts`: doc comment only, which now lists "Testing your Flow".
- `background/activity/tests/candidate-trial.test.ts` (new): 9 tests:
  - building
  - a trial with steps and a failed step (no fix/repair wording, no repairing phase)
  - a failed trial's verdict line, the decision after it, and the build carrying on as "Building your Flow" with no step count
  - each verdict code
  - a build ending during a trial ("Build failed", not "Couldn't fix")
  - a saved Flow's run, repair and failed repair
  - a build's refuted-answer repair outside a trial (still "Fixing your Flow")
  - `CandidateTrial` open/close rules
  - the headline's order of precedence

## Commands run and observed results

- Narrow unit run of `src/background/activity/tests/*.test.ts`, using a temporary esbuild runner that copies `scripts/test-extension.mjs`. The runner was deleted afterwards. Result: `# tests 104 # pass 104 # fail 0`. The first run had 1 failure: my test expected "Build stopped" for a stop label that carried a cause, but the existing pacer gives "Build stopped" only for the bare label. I corrected the test's expectation; the code was not changed.
- Same runner over `src/content/activity-overlay/tests`, `src/shared/activity/tests` and `src/panel/chat/tests`: `# tests 118 # pass 118 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` (extension): exit 0, no output.
- `node scripts/check-extension.mjs` (src and tests typecheck): exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (177 warning(s), 257 baselined).`, exit 0. My new file adds one advisory warning: `background/activity/` now has 16 source files, past the 15-file threshold. It is a warning, not a failure.
- `pnpm --filter @fluxiq-web-extension/extension build`: exit 0. chrome, firefox and e2e-chromium each "verified 22 files". The only warning is the existing firefox gecko.id placeholder.

## Not verified

- No live browser or Lab run (no paid runs allowed). The event shapes in the tests come from Core source (`activity/observer.ts` `toolActivity`, `activity/step/recovering.ts`, `flow-bootstrap/candidate/trial-gate.ts` result codes) and the round 4 screenshot, not from a recording of received events.
- Fail-first was not shown by running the new tests against the old code: they import the new module, so they cannot load without it. The round 4 headline follows from the old `UnitSituation` and `RunRetry` logic described above.
- I did not run the full extension suite (`pnpm test`), per the validation rules.

## Open questions or contradictions found

- Core sends recovery-ladder rows during a trial. Round 4 shows "Recovering from a failed step" and "The quick fixes didn't help: Trying again didn't fix the step" coming from the trial's run, yet `candidate-trial/run.ts` says a trial has "no model, patch, retry or recovery". Either the detached runner runs the ladder anyway, or it only emits its rows. The overlay now hides this, but the chat stream still shows "Trying again didn't fix the step" for a trial. That text is Core wording and chat-stream territory (t350/t362), outside this brief. Suggested follow-up in Core: make `executor/graph-run.ts` (around line 596) emit no recovery ladder in detached candidate execution, or emit a trial wording.
- The verdict line's "what comes next" is inferred from the trial gate's instructions to the model (after no: change and resubmit; after unsure or not_judged: test again). The model might instead end the build. The build's own ending row then replaces the line.
- `background/activity/` is now one file past the 15-file advisory. Moving the run-kind modules (`run-retry.ts`, `unit-situation.ts`, `candidate-trial.ts`, `ending-kind.ts`) into a subfolder would clear it. I did not do that here, to keep the diff focused.
