# W4-D1 (lane t900): a step skipped as already done read "Done"

## Outcome

Partial. The cause is traced and fixed in Core `packages/ui-components/src/chat/stream/**`. A reproduction failed before the fix and passes after it, and the stream suite passes (153/153). The audit's "passed" acceptance check is **not** met. All 3 of its failures are in other workers' uncommitted files; none is in a file I touched (details under Commands).

## Trace (evidence: `run-mwbadi79-d928f922`, attempt 2)

1. **Which path skipped the press.** Step folder `steps/0025-flow-web.output.dom-click` (node `...main.s7`, the Post click) has spans `arrival, host.before, execute, send.capture_snapshot, host.after, ...`. It has **no `dispatch`, `send.click` or `pressed`**, yet its `status` is `succeeded`. Each earlier click (0022, 0023) has `dispatch`, `send.click` and `pressed: click`. The Lab's `attempt-report.txt` line 16 reads "attempt 2 ... found already done: One post sent to the group", which is the cross-attempt act record.
   - The **engine's** skip (`fluxiq/src/engine/automation/step-loop/already-done.ts:36-91`) runs at arrival, *before* the step is announced (`engine/automation/graph-run.ts:414`). The announcement is at `graph-run.ts:426`. That skip emits a row that numbers its own step (`step: {index,...}`), so it never fires inside `execute`. This was not the path.
   - The path was the **answer-first run gate**: `fluxiq/src/framework/automation-service/service/answer-first/run-acts/run-gate.ts:142-160`, the gated `nativeNodeExecutor`. `record.carried(...)` matched the act attempt 1 recorded. It returns `skippedResult` (status `success`, nothing dispatched) and calls `told(request.node.id, label)` (`run-gate.ts:159`, 209-210). The gate was wired by `answer-first/flow-run/flow-run.ts:146` with `settle: true`.
2. **What the chat received**, in order, under the attempt's unit:
   - (a) the step-started row: `step` set, `detail {kind:"step", status:"started", ref: s7, text:"Node: web.output.dom-click"}`, which became card "Click · Post", working;
   - (b) `told()`'s row: **no `step`**, `detail {kind:"step", status:"succeeded", ref: s7, title:"Already done: Post", skipped:{reason:"already_done", subject:"Post"}}`.
3. **Why the card said Done.** In `ui-components/src/chat/stream/step/messages.ts`, row (b) ends the open run step. `skippedStep` only settled the announced step's card for `optional_absent | state_routed | already_in_state` (`SKIPPED_AFTER_ANNOUNCING`, line 197). It excluded `already_done` on the stated assumption that "a skip for already done comes in place of a step, not after one" (old comment at lines 199-204; also `already-done.ts` header). The run gate (t861) broke that assumption. So the card was marked plain `done`, which reads "Done", and its skip was discarded. Row (b) then fell through as a step "marker" (no `step`). Under a `build` subject it is dropped (line 436, `marker && subject.kind === "build"`). Under a `run` subject it would be a second, card-less message. The screenshot shows no second line, which fits a `build` unit.

**Root cause:** the stream's rule for which skips settle an announced step left out the run gate's already-done skip, which is the one already-done skip decided *after* announcing. Core's rows are within contract. A skip row naming the announced node is exactly how `already_in_state` is sent.

## Fix (Core `packages/ui-components/src/chat/stream/**`)

- `step/messages.ts` `skippedStep` (lines 199-220) now returns what goes on the card. If the skip is `already_done`, names the announced node, and carries **no `step` of its own** (the run gate's shape), it returns `{ already: true }`. The card becomes already done, and the row is no second message (the existing `continue`). If an `already_done` row numbers its own step (the engine's), it returns null as before, and the row keeps its own card. That matters because it may name the node just announced, as a later pass of a loop, and that earlier pass did run. Other skips are unchanged. At line 300 the result is spread onto the card.
- `step/card-words.ts` replaces the bare "Already done" with wording by kind (`ALREADY_NOT_AGAIN`, line 107; used at line 149):
  - click: "Already done — not pressed again"
  - type: "not typed again"
  - navigate: "not opened again"
  - anything else: "not repeated"
- Comments in `action-card.ts` and `already-done.ts` were updated to the new wording.
- Tests:
  - `step/tests/already-done.test.ts`: the reproduction uses the evidence's exact record shape (attempt-opening row, step 7 started with ref `node.main.s7`, the run gate's row, a check). It runs under both `build` and `run` subjects, plus a guard that the engine's numbered row for a later pass keeps its own card and leaves the earlier pass Done. Older expectations moved to "Already done — not repeated" (the engine's row carries no `Node:` record, so its card kind is `other`).
  - `step/tests/skipped-step.test.ts`: the weak assertion (only "not Skipped") now pins `["Already done — not pressed again"]`.
  - `step/tests/card-words.test.ts`: covers the wording for each kind.

## Commands run and observed results

Before each vitest run I checked free RAM. The readings were 1.72 and 1.19 GB at first, so I waited until 3705 MB, later until 3277 MB and 2599 MB.

- **Before the fix:** `pnpm exec vitest run src/chat/stream/step/tests/already-done.test.ts` gave `Tests 3 failed | 5 passed (8)`:
  - `(build)`: `assert.equal(card.already, true)`, actual `undefined` (the card read Done, as in the evidence).
  - `(run)`: "the skip row is no second message for the same step", `2 !== 1`.
  - engine guard: actual `'Already done'`, expected the new wording.
- **After the fix:** `pnpm exec vitest run src/chat/stream` (in packages/ui-components) gave `Test Files 22 passed (22)`, `Tests 153 passed (153)`. I ran it twice, the second time after the type fix below.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (ui-components):
  - first run: `messages.ts(218,56): TS2322 string | null not assignable` (`activityActionSkipped` can return null);
  - after fixing it: exit 0.
- `node scripts/structure-audit.mjs` (Core root) gave **`structure-audit: 3 violation(s) across 3 rule(s)`**, exit 1. None is mine:
  - `fluxiq/src/runtime/conversations/commands/work.ts` [failure-as-empty]: modified by another worker;
  - `ui-components/src/chat/chat.css` [file-lines] 870 > 800: it was 792 at HEAD, and this file is on my must-not-touch list;
  - `fluxiq/.../conversation-requests/run-links.ts` [imports]: a new untracked file by another worker.
  - The only line naming my files is an advisory `warn` for `messages.ts`, 463 lines past 400. It was already 451 at HEAD, so it was already past the advisory line, and this is no failure.

## Not verified

- Live or browser rendering of the new card. Only the stream model and the card words are tested.
- That the evidence unit's subject kind was `build`. I inferred it from the screenshot showing no second line. The fix covers both kinds.
- The extension's own copy (`apps/extension/src/panel/copy/step-copy.ts`). It was not involved; the card comes from ui-components.

## Left for another lane (not edited: outside owned paths)

1. **Core `run-gate.ts:188` (`told(outputId, ...)`, the effect-dispatcher door).** For a Core node (`builtin.policy.action`) the skip row's `ref` is the *output id*, not the node id. The stream cannot tie it to the announced step's card, so that card would still read "Done" and the skip would show as a separate line, or be dropped under `build`. Proposed change: pass the dispatching node's id through `context` if the dispatcher has it, and use it as `ref`. Failing that, have the engine say the attempt was skipped. One way: the engine reads `outputs.skipped === "already_done"` on a native result, as `node-execution/already-in-state.ts` does for `already_in_state`, and marks `attempt.skipped = {reason:"already_done"}`. That would also put the skip on the run's attempt record, which today reads a plain success.
2. **Core engine already-done row** (`engine/automation/step-loop/already-done.ts:78-84`). Optionally add `text: "Node: <definitionId>"` so its card keeps its kind and reads "not pressed again" instead of "not repeated". The stream's older-Core fallback in `stream/step/already-done.ts` then still works, because it reads `skipped` first.
3. The audit failures listed above belong to the workers editing those files.
