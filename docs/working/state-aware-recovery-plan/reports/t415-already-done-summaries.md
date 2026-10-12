# t415 - "Already done" and why a handler did not help, in the run detail, the run log and the chat

Worker report. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t415/!FluxIQ` and downstream
`C:/Users/osrs_/FluxStuff/fxwork/t415/!FluxIQWebExtension`, both on `task/t415-already-done-summaries`. Nothing committed.

## Outcome

Done. One file outside the listed ownership was edited (Core `model/flow-adaptation.ts`; see below and "Open questions").

## What changed and why

Core paths are under `packages/fluxiq/src/programs/automation-studio/` unless they say otherwise.

### 1. Run detail (summaries)

- **`model/flow-adaptation.ts`** (outside the listed paths, required). The run detail's types could not carry either record:
  - `AutomationStudioFlowRunActionAttemptRecord.skipped` gains `{ reason: "already_done"; code; attemptId; row? }`.
  - The `unhandled` arm of `AutomationStudioFlowRunHandlerDisposition` gains optional `reason?` and `guard?`, as
    literal unions of the executor's closed codes. No new exported names, so the audit's one-export rule is unchanged.
- **New `runtime/service/summaries/skipped.ts`** (`automationStudioRunDetailSkipped`). It parses the stored `skipped`
  record into one of three shapes. `already_done` keeps the attempt id and the row (trimmed, at most 200 characters).
  A malformed record is dropped whole. Before, `conversions.ts` turned every reason other than `state_routed` into
  `target_absent`.
- **`summaries/conversions.ts`** now calls it. **`summaries/index.ts`** exports it.
- **`summaries/recovery-trace.ts`**. `dispositionOf` keeps `reason` and `guard` on an `unhandled` when each is one of
  the executor's codes. It reads them from `AUTOMATION_STUDIO_UNHANDLED_REASONS` and
  `AUTOMATION_STUDIO_ROUTE_REFUSAL_GUARDS` (`executor/lifecycle/index.ts`, imported only). An unknown code is dropped
  and the disposition is kept.
  - A type-level `Same<>` check makes the typecheck fail if the model's unions and the executor's lists drift apart.
- **Stored events.** The runtime stream stores each run-detail action record whole as its `action_attempt` payload
  (`storage/project/runtime-stream-store.ts`). The reason therefore reaches the stored events with no store change.

### 2. Core web run log (`apps/web/src/features/automation-studio/runtime/attempt-story/`)

- **`skipped.ts`** has a new story kind, `already_done` (added in `story-line.ts`). It reads:
  - "Already done for Lin Zhao, so not done again." when the record names a row;
  - "Confirm Amara Osei was already done earlier in this run, so not done again." when it does not.
- **`handler.ts`**. An `unhandled` now reads "It did not help: <why>." The why comes from the closed reason, and for
  `route_refused` from the guard. A `completion_check_not_true`, or a record from before t411, falls back to the
  check's answer ("its check found the situation still there"). An unknown reason reads "It did not help."
  - The old wording, "It did not settle it: ...", is replaced. `tests/lifecycle.test.ts` is updated to match.

### 3. Live activity and extension chat

- **Core `runtime/activity/**`: no change.** The executor emits the already-done row itself
  (`executor/step-loop/already-done.ts`, which I must not touch). That row already reads "Already done for <row>" with
  `status: "succeeded"` and phase `running`, so it never reads as a failure.
- **New extension `step/already-done.ts`** (`isAlreadyDoneStep`). It recognises the row by its shape alone, never by
  its words:
  - a run step (`step` set);
  - with `status: "succeeded"` on arrival;
  - with no `detail.text` (no "Node: ..." record);
  - with no recovery.
  
  Every other run step arrives `started` and carries "Node: ...".
- **`step/action-card.ts`.** The card gets `already: true`. The target is unchanged, because Core's `activityActionOf`
  already gives "Confirm · Lin Zhao".
- **`step/card-words.ts`.** The outcome reads "Already done", or "Already done (N times)", and the state is `done`.
- **Folding the card into others:**
  - `step/retried.ts` and `step/done-again.ts` exclude an already-done card. A skip is neither a retry that worked nor
    a step done again.
  - `step/card-repeats.ts` adds `already` to the done-words key, so an already-done card never folds into a "Done"
    card.
- **`step/index.ts`** exports `isAlreadyDoneStep`.

### 4. Tests

- **Core summaries:**
  - New `summaries/tests/skipped.test.ts`: 4 cases, covering `already_done` with and without a row, the two older
    reasons, and malformed records.
  - `summaries/tests/recovery-trace.test.ts` gains 1 case: reasons, guard, unknown codes, an old record, and a JSON
    round trip.
- **Web attempt story:**
  - `tests/attempt-story.test.ts` gains an already-done case.
  - `tests/lifecycle.test.ts` gains a case covering every reason and guard. Each has distinct words and no code.
- **Extension:** new `step/tests/already-done.test.ts`, with 3 cases:
  - the detector, against a started step, a recovery row, the run's end, and a finished step carrying "Node:";
  - a message per row reading "Already done", with nothing folded;
  - an already-done card after a failure is no retry, and a step with no row still reads "Already done".

## Commands run and observed results

- **Core summaries tests.** `npx vitest run src/programs/automation-studio/runtime/service/summaries` (Core
  `packages/fluxiq`) printed `Test Files 14 passed (14)`, `Tests 100 passed (100)`.
- **Core summaries and activity tests.** The same command with `src/programs/automation-studio/runtime/activity`
  added printed `Test Files 48 passed (48)`, `Tests 390 passed (390)`.
- **Core typecheck.** `npx tsc --noEmit -p tsconfig.json` (Core `packages/fluxiq`) exited 0 with no output.
- **Web tests:**
  - The first run of `npx vitest run src/features/automation-studio/runtime` (Core `apps/web`) refused: "Core's
    library build is 4 minute(s) behind its source".
  - `pnpm --filter @fluxiq/contracts --filter fluxiq build` (Core root) printed `fluxiq build: Done`.
  - The rerun printed `Test Files 17 passed (17)`, `Tests 173 passed (173)`.
- **Web typecheck.** `npx tsc --noEmit -p tsconfig.json` (Core `apps/web`) exited 0.
- **Extension tests:**
  - The brief's command, run from the downstream root, failed with `Cannot find module ...\scripts\test-extension.mjs`.
    The script lives in `apps/extension/scripts/`.
  - `EXTENSION_TEST_BUILD_LABEL=t415 node scripts/test-extension.mjs panel/chat` (from `apps/extension`) first
    printed `fail 2`:
    - my test expected no "Run finished" message;
    - `view/tests/action-card-view.test.ts` uses a fixture of a finished run step with `text: "Node: ..."`, which my
      first detector took for already done.
  - I added the `detail.text === undefined` condition and fixed my test. The final run printed `# tests 339`,
    `# pass 339`, `# fail 0`.
- **Extension typecheck.** `npx tsc -p tsconfig.json --noEmit` (`apps/extension`) exited 0.
- **Structure audits:**
  - Core: `node scripts/structure-audit.mjs` printed `structure-audit: passed (321 warning(s), 1160 baselined).`
  - Downstream: the same command printed `structure-audit: passed (184 warning(s), 651 baselined).`
  - The touched files carry only pre-existing `file-lines` advisories: `flow-adaptation.ts` at 706 lines and
    `conversions.ts` at 409 (it was 408 at HEAD).

## Not verified

- No live run or browser. The chat card was checked through `stepMessages` and `cardWords` only, not rendered in the
  side panel.
- No round trip through `AutomationStudioProjectRuntimeStreamStore`. The test shows the reason survives a JSON round
  trip of the run-detail record, and the store writes that record verbatim. That conclusion comes from reading the
  store, not from running it.
- The Core web panel's live chat (`apps/web/.../conversation/activity/steps/`) is outside my ownership. It probably
  shows an already-done row as an ordinary "Done" step card, not "Already done". I did not change or test it.
- No full suites.

## Open questions or contradictions found

- **Ownership.** I edited `model/flow-adaptation.ts`, which the brief did not list. Without it the run detail cannot
  carry either record. The change only widens types (optional fields and a new union arm).
- **The executor's handler record still drops the reason.** `executor/lifecycle-run/dispatch-records.ts`
  `streamDisposition` strips the reason from the `handler_execution` stream record. The model type now allows it, and
  passing it through is a one-line executor change, which this brief forbade.
- **The chat detects the skip by shape.** The extension relies on the shape of the already-done row, because the wire
  contract has no closed field for it. A sturdier fix is a closed marker on `ClientGatewayActivity`, which would also
  move the executor's inline wording into `runtime/activity/wording`. That touches `@fluxiq/contracts` and the executor.
- **Other readers still treat `already_done` as something else** (none in my ownership):
  - `runtime/service/candidate-trial/feedback.ts` reads `already_done` as "The page was already at another step".
  - Downstream `packages/test-runner/src/flow-lane/skipped-attempt.ts` recognises only `target_absent` and
    `state_routed` (t411 noted this).
