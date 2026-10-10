# t396: chat cards for recovery (B5)

## Outcome

Done. Tree `C:/Users/osrs_/FluxStuff/fxwork/t396-chat-recovery-cards`, branch `task/t396-chat-recovery-cards`. Nothing is committed.

## What changed and why

**Reader (copied from t392).**
- `shared/activity/index.ts` and `shared/activity/tests/step-recovery.test.ts` are byte-identical to the lead's.
- `shared/activity/step-recovery.ts` is **not** identical. The lead's file derives `ActivityStepRecovery` from Core's `ClientGatewayActivity["detail"]["recovery"]`. The shared Core at `fxwork/!FluxIQ` does not have that field, and the verbatim copy failed the typecheck with TS2339 three times (observed).
- The lead's reader has no local types to fall back on, so I declared the same shape locally and read `detail.recovery` through a cast. The exported names and shape are unchanged.
- **Merge note:** this is an add/add conflict with t392. Resolve it by taking the lead's version once its Core contract is in the Core this tree builds against. My consumers only use `ActivityStepRecovery["kind" | "outcome" | "event"]` and `stepRecovery`, which read the same under both versions.

**Item 1: each recovery row is its own message with a card.**
- New message kind `recovery` (`StepMessageKind`).
- `step/recovery-words.ts` holds the words for each kind, event and outcome: title, reasoning, card name, icon kind, and the reason when a recovery was held back.
- `step/recovery-message.ts` builds the message and its card from the closed fields.
- Card names:
  - "Extra step" (handler)
  - "Start from" (entry)
  - "Carry on from" (route)
  - "Other way" (alternative)
- Every card's target is Core's `subject`.
- Card outcomes follow `card-words.ts`:
  - succeeded reads "Done"
  - failed reads "Didn't work"
  - refused is carried as `refused: {all: true}` and reads "Not done: <why>", without the failure colour
- Icons come from Core's existing set, so the extension and Core stay aligned with no new icon:
  - A handler takes the verb its subject opens with (Core's `activityActionVerb`). Close, dismiss, accept and similar words map to click; anything else is "other".
  - Entry, route and alternative use "branch".
  - The fix case uses "repair".
- The words name the step a recovery was for when its label was seen earlier on a step row for the same node, e.g. "Did this before “Add the kettle”, then carried on."
- Retries and planned ways round never say "didn't work". The handler `fail` event reads "Took the planned way round".
- The named case `fixing` ("Fixing a step", card "Fix step") is in place for in-run repair.
- `view/step-message-view.ts`: `recovery` is shown with both its words and its card. The side panel and the Firefox popup share this view and `chat.css`, so no style change was needed.

**`messages.ts` wiring.**
- A recovery row does not end the run step it was done around; the next non-recovery row does.
- A failed or refused recovery row has the same shape as Core's "settles a failed step" row. `settlesStep` now excludes recovery rows, so they are no longer eaten.
- Recovery rows come before the check that skips a build's start and finish markers, so a recovery inside a build is still shown.
- Each unit keeps a map from node to step label.
- The file is 387 lines.

**Item 2.** A step row with no `recovery` and no `step` still becomes a "step" message with no card, titled with Core's sentence. The same applies to a recovery outside the contract. A row carrying `route` or `entry` gets the structured card.

**Item 3.** `retried.ts` passes over `recovery` messages: they neither end a retry nor get taken into it. Repeated identical failed recoveries fold into "Didn't work (2 times)" through the existing `card-repeats.ts`.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t396 node scripts/test-extension.mjs panel/chat shared/activity`
  - Final run: `# tests 365 # pass 365 # fail 0`. This includes 13 new tests in `step/tests/recovery-message.test.ts` (one per kind and outcome, handler by every event, icons, the retry fold, the repeat fold, no-recovery and malformed rows, and the fix case), one new view test in `view/tests/thread-view.test.ts`, and the lead's 3 reader tests.
- Proof that the fold test catches a regression: I disabled the `retried.ts` change and the test run printed `not ok 61 - an extra step done before trying again leaves the retry one card: done on the 2nd try`. The change is restored.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension): exit 0, no output.
- `pnpm --filter @fluxiq-web-extension/extension build`: chrome, firefox and e2e-chromium each printed "verified 22 files". Firefox also printed its usual placeholder gecko.id warning.
- `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (184 warning(s), 257 baselined).` None of the warnings are on the changed files.

## Not verified

- No live browser check of the cards in Chrome or Firefox. The fake-DOM view test is the only rendering check.
- The order in which Core emits a recovery row relative to the step's started row is unknown, because t392 has not wired the emitter into `graph-run`. Both orders are handled and tested.
- Not tested against the lead's Core contract types; their compatibility is reasoned, not compiled.
- No full suites were run.

## Open questions or contradictions found

1. The brief says "keep the reader's local types as the lead wrote them", but the lead wrote none (see above). This causes a merge conflict on `step-recovery.ts`; take the lead's version.
2. The overlay (`activityWording` and the background pacer) still says Core's label for these rows, e.g. "Recovered: Close the sign-up box" or "Recovery did not work: …". Background was out of scope and `wording.ts` needed no change, but the overlay's words differ from the chat card's title.
3. Step titles elsewhere still read "Step 2: …", which conflicts with the "no step numbers" rule. That is outside this brief; recovery messages carry no number.

## Follow-up pass: interference (after t392 merged)

- **What changed.** Added the `interference` recovery kind in `recovery-words.ts`. The message title is Core's own subject ("Closed a notice the page put in the way"), and the reasoning is "It was covering the page, so it was closed and the step went on."
- **The card.** It reads "Clear the page", with no target because the title already names what was closed. It uses the click icon. When the notice was closed it says "Done".
- **No failure tone.** Core only sends `succeeded` for this kind. If it ever sends another outcome, the card reads "Not done: it was still in the way" and is not coloured as a failure.
- **Where the target comes from.** `RecoveryWords` gained a `target` field, and `recovery-message.ts` now takes the card's target from it.
- **Repeats.** The same notice closed on two attempts folds into a single card that reads "Done (2 times)".
- **New test.** One test in `step/tests/recovery-message.test.ts` covers the interference card.

**Checks run and what they printed:**
- `EXTENSION_TEST_BUILD_LABEL=t396 node scripts/test-extension.mjs panel/chat shared/activity`: `# tests 367 # pass 367 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- Extension build: chrome, firefox and e2e-chromium each printed "verified 22 files".
- `node scripts/structure-audit.mjs`: `structure-audit: passed (184 warning(s), 651 baselined).`
