# t428 — the chat never promises a fail path the Flow does not have

## Outcome

Done. Core only; the extension does not mirror this wording.

## What changed and why

The recovery ladder's stop thought ("Trying again didn't help", "Not repeating the step") was emitted in
`executor/step-loop/failed-attempt.ts` before On Fail, the failed route, the continuation or the in-run repair
had been considered, and every stop reason ended "follows what the Flow says to do when this step fails". It now
says what actually happens next, using what the run knows at that point.

- `runtime/activity/wording/recovery-choice.ts`: each stop reason ends in `{then}`, filled from a new
  `next: AutomationStudioRecoveryNext` (`on_fail | goes_on | repair | stop`):
  - `on_fail`: "the {run|test} follows what the Flow says to do when this step fails"
  - `goes_on`: "the {run|test} carries on past this step, since the Flow can finish without it"
  - `repair`: "FluxIQ will look at the page and fix this step before going on"
  - `stop`: "the {run|test} stops here at this step" (out_of_time keeps "it": "...so it stops here at this step")
  - No `next` means `stop`, the one ending that promises nothing. The type is exported through the
    `wording/` and `activity/` barrels.
- `executor/step-loop/failed-attempt.ts`: retry and satisfied thoughts are emitted where they were before. A stop
  thought is emitted once, through a local `tell(next)`:
  - Before On Fail is dispatched, when the step has a failed route it can take
    (`automationStudioRecoveryPathEdge`, which moved above the dispatch and is computed once) or an On Fail
    handler is in scope: `on_fail`. Because this is emitted before the handler runs, the chat says it before
    the handler's body steps.
  - When On Fail took the run on although none was predicted: `on_fail`, as a safety net.
  - When the continuation carries on past the step: `goes_on`. A partial run's stop node, or a missing onward
    node, gives `stop`.
  - On a true failure: `repair` when `automationStudioStepRepairWillAsk` says a fix will be asked for,
    otherwise `stop`. This covers a deliberate stop, an uncertain act, a second failure after a trial, and runs
    with no repair callback.
- `executor/step-loop/on-fail.ts`: new `automationStudioStepFailHandlerInScope(ctx, node, actUncertain)`. It
  resolves the same On Fail candidates the dispatcher does, at node, frame, calling-frame and recovery-Subflow
  scope (`automationStudioActiveLifecycleRegistrations` plus `resolveAutomationStudioHandlerCandidates`). It
  observes no facts. It returns false for an uncertain act, inside a handler body, or for plumbing nodes, where
  On Fail dispatches nothing. I first wrote it as its own file, but that put `step-loop/` at 26 files, over the
  audit's limit of 25, so it lives in `on-fail.ts`.
- `executor/step-loop/incident-repair.ts`: new exported `automationStudioStepRepairWillAsk(ctx, failure)`. It
  returns true when a repair callback and an invocation exist, the incident has an id and has not been repaired
  already, and `mayAsk` holds. `automationStudioStepRepairIncident` now uses it after its existing check for a
  previous fix (the drop-overlay side effect is unchanged), so the wording and the repair read the same rule.

Tests:

- New `activity/wording/tests/recovery-next.test.ts` (6 tests) covers each `next` and each reason, the
  "promises nothing" default, and a check for plain words (no handle, handler, node, port, resubmit, `{` or `_`).
- New `executor/step-loop/tests/fail-path-words.test.ts` (5 tests) runs real graphs against the wiring page with
  no model:
  - No path and no repair: "...so the run stops here at this step."
  - No path with a repair callback: "...so FluxIQ will look at the page and fix this step before going on.",
    followed by "Fixing a step".
  - A `failed` edge: "follows..." and no repair asked.
  - An On Fail handler in scope: "follows...", emitted before the handler's body step.
  - `onFailure: "continue"`: "carries on past this step...".
- Updated `wording/tests/reasons.test.ts` (existing cases now pass `next: "on_fail"`) and
  `executor/tests/failed-step-reason.test.ts`. Its stop flow has no fail path, so it now expects "stops here at
  this step".

Item 8 (a clear the page undid read "the step wasn't accepted") is already fixed and needed no edit. In
`ui/activity-action/failure-reason.ts`, `_(output_not_observed|not_observed|state_mismatch)_` comes before the
`rejected` rule. On a typing or clearing step it reads "it ran, but the site set the box back". The tests in
`ui/activity-action/tests/action-of.test.ts:134,136` cover `web.validation.output_not_observed` on
`web.output.dom-clear`, and they pass in the run below.

## Commands run and observed results

All Core commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t428/!FluxIQ`.

- `npx vitest run` on the four touched or new test files: 4 files, 32 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity src/ui/activity-action`
  (in `packages/fluxiq`), after the final edit: 138 files, 1321 tests passed.
- `pnpm run check` (in `packages/fluxiq`): exit 0, with no tsc output.
- `node scripts/structure-audit.mjs`:
  - First run: 1 failure, `[directory-files] step-loop/: 26 source files exceeds the 25-file limit`, caused by my
    new file.
  - After folding that file into `on-fail.ts`: "structure-audit: passed (322 warning(s), 1160 baselined)".
- No downstream audit was run, because no downstream file was edited.

## Not verified

- No live or browser run. The R4a sentence was not re-observed in a real paid run.
- A handler that is in scope but whose `when` turns out false, so dispatch passes, has already been announced as
  `on_fail`. If nothing else then takes the run on, the next row ("Fixing a step", or the run's end) is the
  correction. Knowing `when` beforehand would mean observing facts twice, which I did not do.
- A `retry` ladder outcome with no planned wait still says "Trying the step again" and then falls through to the
  stop path. This behaviour predates t428 and I did not change it.
- Full suites (`pnpm test` and the whole Core vitest run) were not run, as the narrow-checks policy says.

## Open questions or contradictions found

- `apps/extension/src/background/activity/tests/candidate-trial-live.test.ts:60,63` (downstream) uses the old
  Core sentence as input fixture text (`oldStop`, `newStop`). It is data fed in, not wording the extension
  produces, so I left it alone. The supervisor may want to update `newStop` to the current Core wording for
  accuracy.
- `apps/web/.../attempt-story/ladder.ts:11` ("to follow the Flow's own way on for when this step fails") words a
  `deterministic_path` decision, where a path does exist. I left it as is.
