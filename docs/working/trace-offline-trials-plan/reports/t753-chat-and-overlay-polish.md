# Report: t753-chat-and-overlay-polish (lead)

## Outcome
In progress.

## Defect map (from round-5 debug notes, confirmed by a read-only code map, 2026-10-20)
Core root `packages/fluxiq/src` (RA = `programs/automation-studio/runtime/activity`); extension `apps/extension/src`.
1. CSS class as a name: domain `page-view/element/icon-hints.ts` prints `class="..."` on a wordless control; Core
   `RA/call-context.ts` PRINTED_LINE takes the first quoted string; `RA/wording/human-label.ts` lets it pass.
2. Tool names: `RA/wording/core-tool.ts` CANDIDATE_TOOLS, `ui/activity-action/action-of.ts` CORE_TOOL_KINDS,
   `RA/decision-answer/refused-call.ts` SENT_AGAIN lack the subflow tools; `RA/project/receipt-card.ts` label;
   router subflow listed by `RA/project/plan-card.ts`.
3/4. `RA/wording/action.ts` list read of one field; `RA/wording/page-name.ts` path-segment page names.
5. Untick as tick: `RA/wording/action.ts` ignores `checked:false`; `ui/activity-action/verb-names.ts`; domain
   `node-run/run.ts:340`, `replay.ts:303` (verb = label "Set Checked").
6. `ui/activity-status/unit-situation.ts` sticky `repairing`; `candidate-trial.ts` opens a test on entry-preparation
   rows; undo calls (`undoes`) worded as plain clicks.
7. Extension `panel/chat/onboarding/model-readiness.ts` counts stored keys only; welcome scrolled by the follower.
8. `ui/activity-action/action-of.ts` `resultOf`: 0 rows reported as done.
9. Endings: three writers (`service/project-build/run.ts` note, `conversations/commands/build.ts`, `execute.ts`
   draftSavedLine); `run.ts` drops a yes trial so "never test-run"; `RA/wording/left-told.ts` "no change" beside quiet
   acts; `act-words.ts` "used X"; dismiss/close clicks listed as possibly lasting.
10. Overlay: `RA/build.ts` label "Build failed: cause" under headline "Build failed"; `headline-echo.ts` one-way;
    `content/activity-overlay/placement/*` corner order and no hysteresis; pacer bypasses on headline flips.
11. `panel/chat/stream/step/card-repeats.ts` folds only within one spoken stretch.
12. `panel/chat/stop-control.ts` "Stop" then "Stop build".
13. Composer: no code hides it on a failed build; the round-5 failure panels do show it (checked 36, 61, 19).

## Units
| Unit | Worker | Owns | Status |
| --- | --- | --- | --- |
| G guard | worker | new Core `ui/person-facing/**`, Core sweep tests, `ui/index.ts` barrel | dispatched |
| A Core action wording | worker-high | RA wording action/call-context/human-label/page-name/list-name/core-tool/tool-call, refused-call, receipt-card, plan-card, ui/activity-action | dispatched |
| B Core status line | worker-high | ui/activity-status, RA/build.ts, entry-preparation marking | dispatched |
| C Core endings | worker-high | project-build run.ts + ending, conversations/commands, RA left-told/act-words | dispatched |
| D domain wording | worker | domain node-run run.ts/replay.ts, page-view icon-hints | dispatched |
| E extension chat | worker-high | apps/extension/src/panel/** | dispatched |
| F overlay | worker-high | apps/extension/src/content/activity-overlay/**, background/activity/** | dispatched |

Core is rebuilt only by the lead, between phases; downstream workers run tests with
`node scripts/test-*.mjs <filter>` under a build label.

## Concurrency checks
- 2026-10-20 start: t751 and t752 both trees clean; t749 edits test-runner, trace-matcher, offline-trial,
  single-subflow, project-build/whole-trials.ts and both `.structure-baseline.json` (none in t753's units except the
  baseline file, which the lead regenerates last).

## Progress log
