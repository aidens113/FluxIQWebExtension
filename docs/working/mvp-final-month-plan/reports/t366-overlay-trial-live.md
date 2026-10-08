# t366 report: the overlay says "Testing your Flow" in a real trial; no "trying again" for a refusal that is not retried

## Outcome

Done.

Built from what round 5 actually sent, the overlay now reads "Testing your Flow" from the decision to test (or the trial's first run step) until the build's next decision. The step count no longer outlasts the trial, and no trial row can make the headline "Fixing your Flow".

Core's recovery ladder now says "trying again" only for a step that was pressed again. A refusal the ladder does not retry reads "Not repeating the step", with the reason. Inside a build, the ladder's sentence calls the run "the test". The overlay also stopped saying "<why>, trying again" before the ladder had chosen to retry.

## Why t363's wording never showed

- **Assumption.** t363 opened the trial on a build tool row with `ref: "core.test_candidate"`.
- **Core never sends that row.** The candidate authoring loop (Core `runtime/flow-bootstrap/candidate/authoring-loop.ts`) wraps `executeTool` itself. It handles `core.submit_candidate` and `core.test_candidate` there and passes only the other tools to `input.loop.executeTool`. That inner function is the one `observeAutomationStudioEvidenceLoop` wrapped (`service/flow-bootstrap-commands/candidate-generation.ts:121`). So neither candidate tool gets a `started` or closing tool row.
- **What does reach the stream:**
  - the decision's thought "Testing the whole Flow from the start" (kind `thought`, no `ref`, sent only when the model gave a reason);
  - then the trial run's own rows in the build's unit of work: `Running step N of M` rows carrying `step`, `Recovering from a failed step` (phase `repairing`), and the ladder thought.
- **What the old pacer made of them.** `UnitSituation` treated the `repairing` phase as a repair, so the headline became "Fixing your Flow". That repair state and the carried step count lasted past the trial.
- **Reproduction.** Feeding the round 5 trial 2 rows to the old pacer gives exactly the round's overlay samples (`run-muz0f12h-eae63685.ui-review.local.json`, moments 4-6):
  - "Building your Flow | Step 2 of 10" and "Running step 3 of 10" during the trial;
  - "Fixing your Flow | Step 4 of 10" at the busy coupon;
  - "Fixing your Flow | Step 9 of 10 | Looking over the whole page" after the trial.
- **Where the overlay is drawn.** The overlay and the panel status row both draw the relay's paced display (`background/activity/pacer.ts`). No other path draws the headline.

## What changed and why

Downstream (`apps/extension/src/background/activity/`):

- **`candidate-trial.ts`.** The test is now opened by what Core actually sends:
  - the decision thought titled with Core's test-tool words (`activity/wording/core-tool.ts`);
  - in a build unit only, the first event carrying `step` (only the graph executor sends `step`, and a build runs its Flow's steps only to test it);
  - the `core.test_candidate` tool row, kept in case Core starts sending it.

  It closes on the build's next decision opening (a thought with status `started`, or a bare `thinking`), on any tool row, on the unit settling, or on the tool row's verdict. `observe(event, kind)` now takes the unit kind, and a saved Flow's run is never a test. The header records the round 5 cause.
- **`pacer.ts`.**
  - Passes the kind.
  - Inside a test, `RunRetry` reads the rows as a run's, so a retried step says "The page was busy, trying again".
  - A thought that opens a test shows the test's line.
  - The header bullets are updated. The file is held to 400 lines, so no new advisory warning.
- **`run-retry.ts`.** The failed step's row now says only why it failed ("The page turned it down"). ", trying again" is added only when the ladder's retry choice arrives. Before this, a refusal the ladder never retried read "...trying again" until the ladder's end took it down. Core's new ladder-end titles are added to `LADDER_ENDS`, and the old title is kept for an older Core.
- **Tests:**
  - New `tests/candidate-trial-live.test.ts`, built from round 5's trial 2 rows, with both the old and the new ladder words. The headline is "Testing your Flow" throughout the trial and never shows the repair colour. After the trial it is "Building your Flow" with no step. "Fix" or "repair" never appears. The non-retried Add to cart never says "trying again", and the busy coupon says it only after the retry choice. A trial whose decision gave no reason still opens at step 1. A saved Flow's run never says "trying again" for a non-retried refusal.
  - `candidate-trial.test.ts`: the "opened and closed only by the core.test_candidate row" test is replaced by one covering each opening and closing rule, plus run units.
  - `pacer.test.ts` (D12): the unexplained failure now reads "That step didn't work" until the retry choice, then "That step didn't work, trying again".

Core (`packages/fluxiq/src/programs/automation-studio/runtime/`):

- **`activity/wording/recovery-choice.ts`.** `automationStudioActivityRecoveryChoice(outcome, run?)` words the ladder's stop by why it stopped:

  | Case | Title | Sentence |
  | --- | --- | --- |
  | Lasting act's outcome unknown | "Not repeating the step" | "...repeating it could do it twice..." |
  | Attempted more than once | "Trying again didn't help" | "FluxIQ tried the step again and it still didn't work..." |
  | Run's waiting allowance spent | "Not repeating the step" | "...has already waited as long as it may..." |
  | Not retryable | "Not repeating the step" | "Another try wouldn't change what happened..." |
  | Unknown | "Not repeating the step" | "The step didn't work..." |

  Each sentence ends "...so the run/test follows what the Flow says to do when this step fails." The retry and satisfied wording is unchanged.
- **`executor/graph-run.ts`.** This is a wording input only; no retry decision changed. The one call site now passes `attempts: arrival.attempts`, `actUncertain: fault?.actUncertain`, `mayAbsorb`, `retryable: automationStudioAttemptIsRetryable(attempt, node)` and `test: automationStudioActivityInBuild()`. Two imports were widened. The line count stays at exactly 800, the `file-lines` limit.
- **Tests:**
  - `activity/wording/tests/reasons.test.ts`: the default stop title is updated, and a case per stop reason is added. No not-retried case may match a "try/trying/tried ... again" pattern or "fix".
  - `executor/tests/failed-step-reason.test.ts`: a new "recovery ladder's end" block runs the real graph inside the activity scope:
    - a refused Add to cart in a build reads "Not repeating the step" and "the test follows", and no row of that node says trying again or fix;
    - the same refusal in a run says "the run";
    - busy then refused reads "Trying the step again" then "Trying again didn't help";
    - a busy coupon still retries.

    I first wrote this block as its own file. The audit refused it because `executor/tests/` would have held 26 files (the limit is 25), so I merged it into the existing failed-step test it extends.

## Commands run and observed results

- **Fail-first, downstream.** I ran the new `candidate-trial-live.test.ts` against unchanged code with a scratch runner. The runner copies `scripts/test-extension.mjs`, writes under the ignored `apps/extension/.test-build-scratch/t366`, and was deleted afterwards. All 7 new tests failed. Examples: `actual: 'Building your Flow'` where `'Testing your Flow'` was expected; `actual: 'Recovering from a failed step: Add to cart'`. A scratch print of the old display sequence matched round 5's overlay samples (quoted above).
- **Fail-first, Core.** I put the HEAD `graph-run.ts` and `recovery-choice.ts` back in place temporarily and ran the new executor test: `Tests 3 failed | 1 passed (4)` (the busy-retry case passes on both). My versions were then restored.
- **Downstream tests after the change.** The same runner over `background/activity/tests`, `content/activity-overlay`, `shared/activity` and `panel/chat`: `# tests 486 # pass 486 # fail 0`.
- **Core tests.** `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity`: `Test Files 62 passed (62)`, `Tests 669 passed (669)`. This ran before the merge into `failed-step-reason.test.ts`. After the merge, `npx vitest run .../executor/tests/failed-step-reason.test.ts` gave `Tests 7 passed (7)`.
- **Typechecks:**
  - Extension: `node scripts/check-extension.mjs` exit 0 and `npx tsc -p tsconfig.json --noEmit` exit 0.
  - Core: `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq) exit 0, after the test was typed with `as const` and no cast.
- **Core libraries.** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` exit 0. This was needed because the extension build refuses a stale Core dist.
- **Extension build.** `pnpm --filter @fluxiq-web-extension/extension build` exit 0. chrome, firefox and e2e-chromium each printed "verified 22 files". The only warning was the existing firefox gecko.id placeholder.
- **Structure audits:**
  - Downstream `node scripts/structure-audit.mjs`: `structure-audit: passed (177 warning(s), 257 baselined).`
  - Core `node scripts/structure-audit.mjs`: `structure-audit: passed (289 warning(s), 710 baselined).` It also printed "1 baseline entries can be lowered". I did not run the baseline update because it is not my file.

## Not verified

- **No live browser or Lab run** (no paid runs). The fix is built from Core's emitters and round 5's samples, not from a recording of the events the extension received. Round 5 recorded overlay text and screenshots, not the raw activity stream.
- **Core docs check fails.** `node scripts/docs-reference.mjs --check` (Core) fails: "docs/reference/framework-reference.md is stale". The `recovery-choice.ts` export moved from line 18 to line 43. The fix is to regenerate with `pnpm docs:reference` in the t366 Core tree; this updates `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`. I did not run it: those files are outside my brief.
- **Full suites not run** (`pnpm test`, Core's whole vitest run), per the validation rules.
- **Legacy-build behaviour.** A legacy build whose test runs the graph in the build's scope would also read "Testing your Flow". I believe that is truthful but did not observe it; the legacy build tests go through observed tool rows.

## Open questions or contradictions found

- **Structural follow-up.** Core's candidate tools have no tool rows at all, so the chat also shows no card for "Testing the whole Flow from the start" or for "Saving the Flow's steps", and none carries a verdict. The structural fix is in Core's `flow-bootstrap/candidate/authoring-loop.ts` (with `service/flow-bootstrap-commands/candidate-generation.ts`): run both candidate tools through the observed `executeTool`, or apply the observer to the authoring loop's outer input. That is outside this brief. Once it lands, t363's verdict lines ("The test failed: a step didn't work. Next: ...") light up with no extension change, because the tool-row path is kept.
- **The trial does run the recovery ladder.** `candidate-trial/run.ts` says "no ... retry or recovery". Since t355 the trial executes through `graph-run.ts` with the node retry policy, so it does run the ladder. The words now fit that. The comment in `run.ts` (t365's file) is out of date.
- **Ladder titles matched by text.** The extension tells a retry from a repair by matching Core's ladder titles (`run-retry.ts` `RETRY_CHOICES` and `LADDER_ENDS`). A Core title change needs the matching extension change in the same unit; this one has it. A structured field on the ladder row (choice kind) would remove the coupling. That is a wire contract change.
