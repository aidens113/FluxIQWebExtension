# t194-w83: composer send (U5) and overlay flicker (U9)

## Outcome

Done. Both defects are fixed in the extension and covered by tests. Each new test was run and failed before the fix, then passed after it.

## What changed and why

### U5: the sent message stayed in the composer and never appeared in the stream

Cause: `ConversationController.send` (panel/chat/conversation/controller.ts) waited for Core's answer to the send and then for a re-read of the thread before anything changed. The composer (composer.ts) only cleared its box once `send` resolved true. While Core started the build behind the send, the panel showed only the live line "Sending your message", with the words still in the box and no person turn.

Fix:
- `controller.ts`: as soon as `send` is called, the message becomes a panel-local person turn (`local-send:<n>`) at the end of `state().turns`. The mode is therefore `thread`, not the welcome screen, even for a first message. A read whose turns include a person turn Core did not hold at send time replaces it, so it is never shown twice. If the send fails (and the failure is not a fallback), the local turn stays with `sendError` set to "Couldn't send that. Try again." until the next send, a target change or a disconnect. `state().sendError` is still set, so existing callers and tests keep working.
- `core-thread.ts`: `CoreTurn` gains an optional `sendError`. The panel sets it; Core never does, and the parser never reads it.
- `composer.ts`: the box is emptied (and the empty draft persisted) at submit. If the send fails, the words come back to the box, but only when it is still empty, the person has not edited it since, and the owner is the same. The composer's own error notice is removed because the failure is now shown on the turn.
- `view/message-view.ts`: a turn with `sendError` shows `p.chat-send-error` (role alert) under the bubble. `view/thread-view.ts`: `sendError` is part of the turn signature, so the error appears and clears in place. `chat.css` gets a `.chat-send-error` rule using the existing `--danger-text` token.

### U9: the overlay alternated between "Deciding the next step" and the model's summary

Cause: each decision in Core opens with a thought row that has no reason, worded "Deciding the next step", and closes with a row carrying its reason. `ActivityPacer` (background/activity/pacer.ts) treated each of these as a new detail line. During a re-author, one decision about every 1.2 s, the line flipped between the two for minutes. Both the panel's live line and the overlay read this paced display.

Fix (`pacer.ts`): `holdMeaningfulLine`. When the event is a decision still under way (a thought with no text and not failed, or a bare `thinking` event with no detail) and its wording is "Deciding the next step" or "Thinking about the next step", the pacer keeps the detail and phase of the newest display. That display can be the one shown or one still waiting its turn. This only applies within the same unit, while it is working, under the same headline, and when that display's detail is meaningful. Two consequences:
- "Deciding the next step" still shows at the start of a unit, or when nothing meaningful is up.
- A reason waiting for its turn is never overtaken by the decision row.

The step still comes from `displayFor`, so the U2 rule (a repair drops the run's step count) is unchanged, and its test passes. Panel and overlay both consume this one display, so they hold the same line. The content-side `status-dwell.ts` was not changed.

### Tests

New tests:
- `panel/chat/conversation/tests/outgoing-turn.test.ts` (4 U5 tests: the turn appears at once; a first message shows a turn, not the welcome screen; a failure is shown on the turn and resending replaces it; the composer empties at once and gets the words back on failure)
- `panel/chat/view/tests/thread-view.test.ts` (+1 U5 test: the error under the bubble)
- `background/activity/tests/pacer.test.ts` (+2 U9 tests: the reason is held across decisions; "Deciding" shows when nothing meaningful is up and never overtakes a waiting reason)

Existing tests changed because they encoded the old behaviour:
- `pacer.test.ts` "a build is headed 'Building your Flow'…": "Thinking about the next step" is dropped from the expected details, because it is now held.
- `pacer.test.ts` "a sentence after a quiet interval shows at once": now uses a click sentence, because a decision after "Reading your request" is held.
- `composer-draft.test.ts` "failed" scenario: now asserts that the composer does not repeat the error.
- `composer-owner.test.ts`: the old test relied on the words staying in the box while sending. It was rewritten with the same intent: an old owner's late answer neither refills the new owner's box nor releases the new owner's pending send.

## Commands run and observed results

- Before the fix, from the downstream root: `node <scratchpad>/t194/narrow-tests.mjs C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension/apps/extension w83 panel/chat background/activity` -> `narrow: 39 test files`, `# tests 312`, `# pass 305`, `# fail 7`. The 7 failures were exactly the new U5/U9 tests.
- After the fix: the same command with `panel/chat background/activity content/activity-overlay` -> `narrow: 46 test files`, `# tests 360`, `# pass 360`, `# fail 0`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194 w83 ext check" node scripts/check-extension.mjs` (from apps/extension; this is what `check` runs after its cache wrapper) -> `[heavy] t194 w83 ext check holds b3`, `exit=0`. The script typechecks the source and test projects and bundles every browser entry. It prints nothing on success.

## Not verified

- Live browser behaviour: the bubble and the cleared composer during a real send, the error on a real failed send, and the held overlay line during a real re-author. These need a Lab run.
- The full extension suite (`pnpm --filter … test`) and e2e were not run, per the narrow-check rule. `apps/extension/e2e` has no reference to the removed composer notice, "Couldn't send that" or "Sending your message".
- The structure audit was not run.

## Open questions or contradictions found

- The live line "Sending your message" still shows under the new bubble while the send is on its way. That is consistent but redundant. The supervisor may want it removed or replaced by an indicator on the bubble.
- On a successful send whose follow-up reads keep failing, the local turn stays (without an error) until a read succeeds. That is deliberate: the message did go.
- The pacer recognises an unexplained decision by its wording ("Deciding the next step", "Thinking about the next step"). These strings are duplicated from `shared/activity/wording.ts`, which this worker did not own. Exporting them from there would remove the duplication.
