# t391 Core run log: what the runtime did, per attempt

## Outcome

Done. Every change is in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t391/!FluxIQ` (branch `task/t391-core-run-log`), inside `apps/web` only. Nothing is committed.

## What changed and why

New pure view-model directory `apps/web/src/features/automation-studio/runtime/attempt-story/`:

- `attempt-story.ts`: `runtimeAttemptStory(attempt, { stepName? })` returns `{ kind, text }[]` in the order the run did things. The order is: retried, interference, pace held, readiness, child run, skipped or state routed, state routing that found no way on, lifecycle (empty for now), defence (fault), ladder choice, pace raised.
- One module per record: `retried.ts`, `interference.ts`, `pace.ts` (held and raised), `readiness.ts`, `skipped.ts` (target absent, and state routed forward, backward or effect holds), `state-routing.ts` (guard_stopped, no_match, unobserved, no_pre_states, and a route with no skip record), `defence.ts` (`fault.disposition`, `actUncertain`), `ladder.ts` (`recoveryDecision.selected` or `metadata.recoverySelected`, and a decision with no choice), `child-run.ts` (`childTrace` status and step count).
- `attempt-record.ts`: reads a record from either shape the panel receives. That is the trace attempt (top level) or the run-detail action record (`metadata.retry`, `metadata.readiness`, `metadata.recoverySelected`, top-level `skipped` and `stateRouting`, as `service/summaries/conversions.ts` maps them). It ignores anything that is not an object.
- `words.ts`: wait durations ("1.5 seconds", "1.5 minutes"), step naming (the caller's `stepName`, otherwise the node id in quotes), number checking, and `runtimeRouteWords` ("skipped" becomes "Skipped", "state_routed" becomes "Moved on", and a Flow port name stays as it is).
- `lifecycle.ts`: `runtimeLifecycleLines` is the named place for the C11 records (frames, handler runs, entry choices, true failure vs planned fail, in-run repair). It returns `[]` and invents no fields. Its doc comment says how to add each record. `story-line.ts` holds the `RuntimeAttemptStoryKind` union that those records will join.
- The wording follows `activity/wording/recovery-choice.ts`: "a step like this often works on a second try", "the page wasn't yet the way this step expects", "something on the page was in the way", "the site asked to slow down", and "Not repeating the step: ... could do it twice". It also follows `state-routing/announcement.ts`: "Skipped X: the page is already past it. Continuing with Y". No code appears in a main line, and a test asserts this.

UI (`RunDetailPanels.tsx`, `RunActionLogView.tsx`):

- `RuntimeAttemptRow`: the route column shows `runtimeRouteWords`, with the raw route kept in `title`. When an attempt has story lines they appear as a list under the row (`automation-runtime-attempt-story`, spanning the full row). An attempt without records looks the same as before.
- `RuntimeActionDetailPanel`: a new "What happened" tab sits second, after Summary, and lists the lines in order. When there are none it shows a plain empty message. The Summary "Route" row uses the same words. The Raw JSON tab now also carries `skipped`, `stateRouting`, `retry`, `readiness`, `pace`, `fault` and `recoveryDecision`, with their codes. A new exported type, `RuntimeActionDetailView`, is now the type of the view state in `RunActionLogView.tsx`.
- Styles were appended to `styles/runtime/04-controls-details.css`.

Tests:

- `attempt-story/tests/attempt-story.test.ts`: 21 tests. They cover each record kind when present, when absent or malformed, and in combination with others, plus both shapes, the full ordering, the plain-words check and the route words.
- `runtime/tests/attempt-story-panels.test.tsx`: 5 component tests. They cover the row line, a row with no records, the tab and its order, the empty message, and codes kept in Raw JSON.

## Commands run and observed results

- `npx vitest run src/features/automation-studio/runtime/attempt-story` (in `apps/web`) printed: 1 file, 21 passed.
- `npx vitest run src/features/automation-studio/runtime` (in `apps/web`) printed: Test Files 15 passed (15), Tests 160 passed (160).
- `npx tsc --noEmit` (in `apps/web`) exited 0 with no output.
- `node scripts/structure-audit.mjs` (Core root) printed: `structure-audit: passed (295 warning(s), 708 baselined)`. The warning count is the same as before the change. The `runtime/` warnings it lists were all there before: the directory file count, the exported-value count in `RunDetailPanels.tsx` (9), and the length of `RunActionLogView.tsx` (446 lines, up from 445).

## Not verified

- I did not render the panel in a browser. The layout of the story list under the fixed-width row grid has not been looked at.
- The run-detail action record carries no `pace`, `fault`, `childTrace` or `recoveryDecision` candidates, and no `retry.hintedWaitMs`. Those lines therefore appear only when the panel receives trace attempts, or a full action detail that includes them. I made no change to Core's `service/summaries/conversions.ts`, because it is outside my ownership.
- No full suites were run, as the brief required.

## Open questions or contradictions found

- Steps are named by node id in quotes, because the panel has no Flow document in hand. `RuntimeAttemptStoryOptions.stepName` is there for a caller that can supply labels.
- If the projection is wanted in the run detail, the supervisor may want Core's action-record projection (`conversions.ts`) to copy `pace`, the fault disposition, `actUncertain` and the child run's status and step count. That file is under `packages/fluxiq/src`, which is being changed by other workers.
