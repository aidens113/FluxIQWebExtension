# t378-w5-ui-words: worker report

## Brief (as given)

```text
### Brief: t378-w5-ui-words (worker)
- Repository: FluxIQ Core UI and the downstream extension. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (both on `task/t378-candidate-feedback`). U = `T/!FluxIQ/packages/fluxiq/src/ui/activity-action`; E = `T/!FluxIQWebExtension/apps/extension/src`.
- Rule: words a person sees are plain English; never node ids, internal step names or command names.
- Task:
  1. (lane A U1) Cards name the control and the kind of act: choose, tick, type, press; never "Click" for a choice (`U/verb.ts:20-21` map select and check to kind click; `U/names.ts`). Click and Type cards name their control.
  2. "Action · Dom next page" (card) and the overlay's "Running the "Dom next page" step" become plain words ("Next page").
  3. (lane D) `U/failure-reason.ts:43` says "the page was busy" for a site's slow-down refusal (failure carries a wait hint, the site's "You're going too fast" notice): say the site asked to slow down.
  4. The repeat-refused submission card "Change the Flow · run the step again" (`U/action-of.ts:436`; `E/panel/chat/stream/step/card-repeats.ts`): a whole-Flow resubmission reads as the same Flow sent again unchanged, never "run the step again".
  5. `E/panel/chat/stream/step/words.ts:52`: an unusable model reply is not headed "Decided the next step".
  6. `E/shared/activity/wording.ts:67`: "that didn't work, trying another way" is not said before an identical resend or the end of the build.
  7. (lane D) Cards for a press inside a repeat name the row: render the step event's `row` (a string another worker adds in Core runtime now), e.g. "Confirm · Jonas Weber"; where the card model allows it, a retried press on the same row reads as one card, not a red card followed by a green one.
  8. (lane D) The page overlay never cuts a sentence ("the…"): shorter lines or wrap. Find the overlay module in the extension.
- Required reads: the files named; lane C UI defects (read-only) `.../t274/.../lane-c-candidate-ui.md`; lane D UI findings 1, 2, 9, 10 in `.../t275/.../lane-d-candidate-w3-ui.md`.
- Owns: `U/**` and its tests; `E/panel/chat/**`, `E/shared/activity/**`, the overlay's module, and the tests beside them.
- Must not touch: Core `packages/fluxiq/src/programs/**` (another worker owns the runtime wording), other extension files, domain, any other tree, lab slots or processes.
- Concurrency: other workers edit other files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Validation: Core `npx vitest run <ui test paths>` and `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` from `T/!FluxIQ`. The extension consumes Core's built output and its package scripts refuse while Core's source is newer than its build (expected; the lead builds Core once at the end). Run the extension tests beside your changes that do not depend on your Core changes, e.g. `EXTENSION_TEST_BUILD_LABEL=t378-w5 node scripts/test-extension.mjs` from `apps/extension` or a narrower equivalent, and list in the report the ones the lead must run after the Core build. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w5-ui-words.md` (paste this brief at its top; protocol report format; return at most 12 lines).
```

## Outcome

Partial. Items 2 to 8 are done and tested. Item 1 is done for choose, tick and the other narrower acts. A Click or Type card still shows no control when Core's event names none, because the event carries no name to show (see Open questions).

## What changed and why

Core UI (`!FluxIQ/packages/fluxiq/src/ui/activity-action`):

- `verb.ts`, `types.ts`: a new verb `next` (kind `navigate`), matched by the word `next`. Core's own `wording/node-name.ts` names a node from the first word that names a verb, so `web.output.dom-next_page` now reads "Next page" instead of "Dom next page". That fixes both the card and the overlay's `Running the “Next page” step` with no edit under `programs/**`. Core's `action.ts` has no sentence for `next` and skips it, the same as it skipped the unknown word before. `ActivityActionVerb` gains `"next"`. `ActivityAction` gains an optional `name`. `ActivityActionEvent.step` gains an optional `row`.
- `verb-names.ts` (new, exported from the barrel): `ACTIVITY_ACTION_VERB_NAMES` gives a card name for acts narrower than their kind: select "Choose", check "Tick", key "Press key", dialog "Answer dialog", search "Search", clear "Clear field", back "Go back", next "Next page", tab "Switch tab", scroll "Scroll", upload "Add file", download "Download". The kind still picks the icon, so no new `ActivityActionKind` was added. A new kind would have broken the exhaustive icon map in Core's `apps/web`.
- `action-of.ts`: the kind readers now also return the verb, and `activityActionOf` sets `name` from it. A target that only repeats the name is dropped, so the card reads "Next page", not "Next page · Next page".
  - Rows: the target appends the row a step was on. That comes from `step.row` or, as before, a test title's ` for “row”`, and is said once ("Confirm · Jonas Weber").
  - Resubmission: a `core.submit_candidate` call refused as a repeat is named "Send the Flow again", with no target. Its reason now comes from new `resent` words. An edit asking a step to run again still reads "run the step again".
- `refusal.ts`: `activityActionRefusal(record, flow = false)` picks the `resent` words for a whole Flow.
- `refusal-words.ts`: a new `resent` group, for example "the same Flow was already sent exactly like this and was not accepted".
- `failure-reason.ts`: `rate_limited|throttled|too_many_requests|too_fast|slow_down` now say "the site asked FluxIQ to slow down". `busy|try_later` still say "the page was busy".
- Tests: `tests/action-of.test.ts` has a new t378 block, `tests/failure-reason.test.ts` has updated cases, `tests/verb.test.ts` has a `next` case, and `tests/verb-names.test.ts` is new.

Extension (`apps/extension/src`):

- `panel/chat/stream/step/action-card.ts`: the card carries `name`, and a new `retried?: { tries; why }`.
- `card-words.ts`: the card head uses `card.name` before the kind's name. A retried card reads "Done on the 2nd try. The first try didn't work: <why>", with Core's result after the try when it gave one.
- `retried.ts` (new; named so `card-` is not shared by three files, which the structure audit refuses): `foldRetriedCards`. A done card takes in the failed card before it in the same unit of work when both are the same act on the same named target. Both cards must be steps that a run or a Flow test ran: a `step` message or a `testing` card. Only repair or note messages may come between them. A decision, another card, a refusal, a check, a test run or an edit ends the match.
- `messages.ts`:
  - The folding pipeline is now repeats, then retries, then done-again.
  - A new helper, `withEarlierNames`, keeps a start row's kind, act name and target when the row that ends the card names none. It replaces two inline copies.
- `card-repeats.ts`: `name` is now part of a card's identity for folding, and so is `retried` for done cards. One comment is updated.
- `words.ts`: a failed "Deciding the next step" thought now reads "Asking the AI model again". Core marks both the unusable-reply row and the no-answer row as failed (`observer.ts` `decisionFailed`).
- `shared/activity/wording.ts`:
  - `OUTCOME_RETRY` ("that didn't work, trying another way") is replaced by "that didn't work", plus Core's reason when one exists ("that didn't work: the page took too long").
  - `rate_limited|throttled` now count as failures.
  - A decision Core declined (`activityActionOf(...).refused.all`) reads "not done: <Core's reason>", or the reason alone after a label that already starts "Not done". For example: "Not done: saving the Flow's steps — <reason>".
- `content/activity-overlay/fit-lines.ts` (new): `fitLines` wraps the detail across a given number of lines, measured the way the browser wraps it. If the text is still too long, it keeps the whole sentences that fit, and only then cuts where a word ends.
- `content/activity-overlay/status-pill.ts`: the detail now wraps to two lines (`-webkit-box` with a line clamp of 2). The expanded card is 84px high instead of 66px, so the pill keeps a fixed size. The headline is unchanged: one line, cut by `fitLine`.
- Tests: updated in `card-words.test.ts`, `messages.test.ts` (the old playback test now also expects the fold), `words.test.ts`, `wording.test.ts` and `status-pill.test.ts` (84px; the two-line detail is drawn whole). `content/activity-overlay/tests/fit-lines.test.ts` is new.

## Commands run and observed results

- From `T/!FluxIQ`: `npx vitest run packages/fluxiq/src/ui/activity-action` printed "Test Files 11 passed (11), Tests 225 passed (225)".
- From `T/!FluxIQ`: `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` exited 0 with no output.
- From `T/!FluxIQ`, a read-only check of consumers: `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/activity` printed "Test Files 25 passed, Tests 245 passed".
- From `T/!FluxIQ`: `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/executor/tests/failed-step-reason.test.ts` printed "1 failed | 6 passed". The failure at line 90 expects "the page was busy" for `web.action.rate_limited` and now gets "the site asked FluxIQ to slow down". This is the intended new wording, but the file is under `programs/**`, which I must not touch. The owner or the lead must change the expected text on line 90.
- From `apps/extension`: `EXTENSION_TEST_BUILD_LABEL=t378-w5 node scripts/test-extension.mjs` printed "# tests 2728, # pass 2728, # fail 0" (exit 0). This ran against Core's stale built output. The first run had 31 failures from a `kept` name clash in `messages.ts`, which I fixed. The second run had 1 failure from a retry fold in an exploration test, which I fixed by limiting folds to run and test steps.
- From `apps/extension`: `npx tsc -p tsconfig.json --noEmit` exited 2. All 11 errors are `name` missing on `ActivityAction`/`ActionCard`, because the stale Core `.d.ts` predates the new field. I expect this to clear after the Core build.
- From `T/!FluxIQWebExtension`: `node scripts/structure-audit.mjs` printed "passed (183 warning(s), 257 baselined)". This was after renaming `card-retries.ts` to `retried.ts`; before that, the audit failed with "3 files share the prefix card-".
- From `T/!FluxIQ`: `node scripts/structure-audit.mjs` found 4 violations, all in `programs/**` files I did not touch (`narration.test.ts`, `candidate-repeat-told.test.ts`, `submission-refusals.test.ts` with `as never`; `repeat-guard/outcomes.ts` with failure-as-empty). My files raise only advisory warnings: `action-of.ts` is 487 lines and `tests/action-of.test.ts` is 571 lines.

## Not verified

- I did not check any behaviour in a live browser: the overlay's two-line wrap and the line clamp, the card heads, and the retry fold on a real run. I ran no Lab and made no provider call.
- The extension tests ran against Core's stale build. After the Core build, the lead must run:
  - `npx tsc -p tsconfig.json --noEmit` in `apps/extension`;
  - `EXTENSION_TEST_BUILD_LABEL=<label> node scripts/test-extension.mjs`, in particular `panel/chat/stream/step/tests/messages.test.ts` (it matches the slow-down reason loosely), `card-words.test.ts`, `shared/activity/tests/wording.test.ts` (the resend sentence), and `background/activity/tests/candidate-trial-live.test.ts:112`.
  - That last test expects "A step didn't work in the test: the page was busy", and that text comes from Core's runtime (not my file). Whether it changes depends on the runtime worker.
- `step.row` is not in the gateway contract (`packages/contracts/src/client-gateway.ts` `step` has no `row`). I read it as `event.step.row`, a plain string. If the runtime worker puts it elsewhere, for example `detail.row`, only `targetOf` in `U/action-of.ts` needs to change.
- Core's own panel (`apps/web`) does not read the new `ActivityAction.name`, so it still shows the kind's name ("Click" for a choice). That code is outside what I own.

## Open questions or contradictions found

- Item 1, "Click and Type cards name their control": a card has no target only when Core's row carries no quoted name and no step label. Lane D finding 10's two bare "Click" cards are of that kind. The UI cannot invent a name. The fix belongs in Core's runtime wording (`programs/**/wording/action.ts` `elementName`), which I do not own.
- `failed-step-reason.test.ts:90` in Core `programs/**` must change to the new slow-down words (see above).
- Lane C defect 8 and lane D finding 9 both apply here. The two-line detail makes the expanded overlay 18px taller, so it covers a little more of the page. The overlay's placement already avoids busy corners, but I did not measure this on a page.
- Other places still say "trying another way". Core's completion-check outcome in `wording.ts` ("not yet, trying another way") makes the same unverifiable claim. I left it alone because the brief named only line 67. The background's "The page was busy, trying again" comes from Core's runtime label, not from this module.
