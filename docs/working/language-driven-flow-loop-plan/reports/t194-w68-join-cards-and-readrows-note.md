# t194-w68: join cards and the readRows note

## Outcome

Partial. C-E is done and validated. UI-3 is blocked: the step number and the "of M" count come from `R/executor/graph-run.ts`, which is outside this brief's ownership. Per the brief I stopped there and made no UI-3 edit.

## What changed and why

### C-E (done)

- `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`: the check clause of `WEB_NODE_REJECTED_ROWS_NOTE` ("check each against the instruction, ... an item sold with or including an excluded part is still the item") is now its own export, `WEB_NODE_REJECTED_ROWS_CHECK`. `WEB_NODE_REJECTED_ROWS_NOTE` is built from it and its text is byte-identical to before; the existing test "the rejected-rows note says a row that only mentions an excluded thing is not that thing" still passes. There are two new exports:
  - `WEB_NODE_REPLAY_READ_ROWS_NOTE`: "In readRows, rows are the rows the step returned, by label; each leftOutOnlyByThis entry names a condition and the rows it removed by itself (every other condition kept them): <same check>."
  - `WEB_NODE_REPLAY_UNFILTERED_ROWS_NOTE`: says that when the conditions kept no row, `readRows.rows` are rows they rejected, and that the model should check them.
- `domain/src/runtime/llm-evidence/node-run/replay-answer.ts`: `webNodeReplayReadRows` now adds `note` inside `readRows`:
  - the alone-rows note when `leftOutOnlyByThis` is non-empty;
  - the unfiltered note when `conditions.unfiltered` is set and rows came back;
  - both, joined, when both apply.
  No row is capped or removed.
  - Why the note goes inside `readRows`: Core's build-test reader (`R/result-verification/build-test/read-rows.ts`) rebuilds `readRows` from `rows` and `leftOutOnlyByThis` only. The judge therefore never sees `note` and keeps its own instruction, while the explorer gets `core.run_flow`'s `last.evidence` unchanged. Step 0044's request.txt shows that path passes `readRows` through as sent.
- `replay.ts` is unchanged. Its line 360 is the only place a replayed read returns rows, and it already calls `webNodeReplayReadRows`.
- Tests, in `node-run/tests/replay-read-account.test.ts`:
  - The existing deepEqual on `readRows` now expects `note`.
  - There are three new tests: alone rows carry the note with all 30 kept rows and all 25 alone rows; an unfiltered read carries the "kept no row" note; a read with no alone rows and kept rows carries no note.
  - I first put these tests in a new file. That made `node-run/tests/` hold 26 files, past the 25-file limit (structure-audit FAIL), so I folded them into the existing file.

### UI-3 (blocked: owner outside the brief)

- The step number and its count are produced by `R/executor/graph-run.ts:417`: `emitAutomationStudioActivityStep({ index: step + 1, count: flow.nodes.length, ... })`.
  - `step` counts every node executed and `count` is every node in the Flow, merges included. Five acts plus two `builtin.control.merge` give "Step 7 of 7".
  - The panel (`apps/extension/src/panel/chat/view/step-text.ts:12`) and the overlay (`apps/extension/src/content/activity-overlay/overlay-view.ts:73`) only print `step.index` / `step.count` as Core sends them. Neither can know how many control nodes the Flow has, so the count cannot be fixed downstream.
- The card is emitted by `R/activity/step.ts` (owned). Its name "Join paths" comes from `fluxiq/src/ui/activity-action/names.ts:21`, matched on `detail.text = "Node: builtin.control.merge"`.
  - Suppressing the card in `step.ts` alone would leave the count wrong ("Step 7 of 7" over five cards), so I did not do half the fix.
- Proposed fix for whoever owns `graph-run.ts`:
  1. Add a predicate in `R/activity/` (e.g. `automationStudioActivityShowsStep(definitionId)`, false for `builtin.control.merge` and whichever other `builtin.control.*` the supervisor decides act on nothing a person sees).
  2. In `graph-run.ts`, compute `shownCount = flow.nodes.filter(shows).length`, keep a `shownIndex` counter that increments only for shown nodes, and call `emitAutomationStudioActivityStep` only for shown nodes, with `index: shownIndex, count: shownCount`.
  3. Update the downstream test `apps/extension/src/panel/chat/tests/live-run-display.test.ts` "U-A2: a merge step's card says it joined the paths". It feeds a merge step event and expects a "Join paths" card, so it becomes obsolete once Core stops emitting it. Keep it only if the extension should still render a merge event from an older Core.

## Commands run and observed results

- Failing-first, after adding only the constants: `bash heavy.sh "t194-w68 narrow domain" node .../narrow-tests.mjs <domain> t194-w68 runtime/llm-evidence/node-run`. Before the constants existed, esbuild failed on the missing exports. With the constants added: `not ok 109 - a replayed read whose conditions removed rows by themselves carries the note ...`, `not ok 110 - a replayed read whose conditions kept none says its rows are rows they rejected`, `# tests 173 # pass 171 # fail 2`.
- After the fix, with the tests folded into the existing file, the same command gave `# tests 173 # pass 173 # fail 0`.
- `bash heavy.sh "t194-w68 domain check" pnpm run check` (in domain) printed no tsc errors; `exit=0`.
- `node ../scripts/structure-audit.mjs` printed `structure-audit: passed (159 warning(s), 118 baselined).`
- No Core files were touched, so no Core vitest or Core `pnpm check` was run.

## Not verified

- A live run showing the note in `core.run_flow`'s `last.evidence`. Only unit tests through the evidence runtime's `executeTool` replay path were run.
- That Core's evidence path from `core.run_flow` to the explorer prompt keeps the new `note` member. Step 0044 shows `readRows` passed through as sent, which suggests it does, but this was not exercised.
- UI-3 entirely.

## Open questions or contradictions found

- UI-3 needs `R/executor/graph-run.ts` (not owned). Which `builtin.control.*` definitions count as control-only (merge only, or also branch/router/for-each) is the supervisor's decision.
- The downstream U-A2 test (`apps/extension/src/panel/chat/tests/live-run-display.test.ts`) asserts a "Join paths" card. It conflicts with UI-3's intent and needs updating together with the Core fix.
