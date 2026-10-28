# t774 truthful chat and overlay: report

## Outcome
Partial. Eight of the listed defects are fixed with tests; five are not (list below). No headed screenshots were taken.

P6 overlap check: t769's Core branch changes flow-bootstrap/index.ts, llm/step-log/index.ts, service/candidate-trial/*, service/offline-trial/*, service/subflow-trial/{run,types}.ts. None of those were edited here.

## What changed and why
Core (`C:/Users/osrs_/FluxStuff/fxwork/t774/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`):
1. `activity/candidate/run-refused.ts` (new), `candidate/index.ts`, `activity/observer.ts`: a call Core refused before running (`llm_evidence_tool_execution`, `effectApplied:false`, `targetsUnchanged:true`, `evidence.ok:false`, code `candidate.*`/`subflow.*`) now ends "— not done" with a plain `Declined:` sentence (status failed). Read by shape, so a future gate needs no word-list edit. Fixes "Put back · Change — Done", the stuck "Working on it" card, and the overlay's "clicking 'Like'" staying as the last word. Test: `activity/tests/observer.test.ts`.
2. `activity/bounded.ts`, `activity/project-card-bounds.ts`: strings over the bound are cut at a word (`cutAtWord`) instead of mid-word ("so che…", "set office addres…"). Test: `activity/tests/bounded.test.ts` (failed first).
3. `project-agents/single-subflow/single-subflow-trial.ts`: the whole-run test's steps keep the builder's activity agent, so they no longer sit under "Supervisor"; step-log role and purse stay the supervisor's. Test: `single-subflow/tests/single-subflow-trial.test.ts`.
4. `activity/wording/act-words.ts`: a test step labelled for moving or reading ("show more of the feed", "go to...", "find...") is `passing`, so it is not named as a possible leftover. Test: `wording/tests/act-words.test.ts` (failed first).
5. `service/project-build-ending/record-told.ts`: when the only part tested and the whole run ended the same way, the ending says it once with the try count (no "tested on its own" plus "judged test run" for one set of tests). Tests: `tests/ending-truth.test.ts` (one existing expectation updated to the single sentence).
6. `activity/build.ts`: draft ending title is now "Build stopped: only a draft was kept" (was "Build ended: no Flow was built", which contradicted the chat's "only partly built ... kept as a draft"). Test: `activity/tests/scope.test.ts`.
Extension (`C:/Users/osrs_/FluxStuff/fxwork/t774/!FluxIQWebExtension/apps/extension/src/content/`):
7. `activity-overlay/placement/choose-placement.ts` (rule 4): a top place is allowed only at its corner and only if it covers no control or content; top docks and slides are gone. The pill stays at the bottom, so it no longer jumps y 16/100/184/620 or covers the logo. Test: `placement/tests/choose-placement.test.ts` (failed first with "bottom, not top-left").
8. `action-runtime/scroll-element-into-view.ts`: `inline: "center"` to `"nearest"`, so a target near a side no longer leaves the page scrolled sideways. New test `action-runtime/tests/scroll-element-into-view.test.ts`.

## Commands run and observed results
- Core grouped runner (`node ../../scripts/vitest-groups.mjs --groups=parallel` on activity, project-build-ending, single-subflow, supervisor, ui/person-facing, ui/activity-status): `Test Files 108 passed (108)`, `Tests 883 passed (883)`.
- Core `pnpm check`: exit 0 ("structure-audit: passed (443 warning(s), 1152 baselined)", fluxiq:check, web:check built).
- Core `tsc --noEmit` (packages/fluxiq): no output.
- Extension `tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json --noEmit`: exit 0 both.
- Extension tests `scripts/test-extension.mjs activity-overlay`: 83 pass, 0 fail; `content/action-runtime content/actions`: `# tests 626 # pass 626 # fail 0`.
- Downstream `node scripts/structure-audit.mjs`: "structure-audit: passed (226 warning(s), 616 baselined)".
- First structure run failed on 24 `as never` casts in observer.test.ts; I removed mine.

## Not verified / not done
- Fail-first was observed for items 2, 4, 7 only. For items 1, 3, 5, 6, 8 the first run crashed or I wrote test and fix together; the old behavior is evident from the code but I did not see the red run.
- No headed provider-free screenshots (chat, overlay, ending on two scenarios). `ui:e2e` journeys do not produce a failed-build ending with refused calls, and I did not build a faked stream. No live browser look at the overlay or the sideways scroll.
- "Testing your Flow" for setup reruns: `entry-preparation.ts` already wraps the rerun in the preparation mark, so the round-6 case ("Step 4 of 4: Save the job (row 1)") comes from some other path, possibly in the offline-trial or subflow-trial files t769 owns. Not traced, not changed. A refused `core.test_subflow` still shows its tool label ("Testing one part of the Flow") until its ended row replaces it; item 1 makes that row "not done".
- Step counts ("Step 3 of 12" vs "13 steps"): different units (graph step counter vs feedback step list incl. loop passes). Not reconciled.
- Leftovers: a like that was undone still reported as left comes from `site-reset/ledger.ts` `standing()` (cause in the a44a1427 note), a settlement bug, not touched. A navigation click on a plain button (e.g. "Reels") still lists as possibly left; only links, dismissals and labelled test steps are filtered.
- Supervisor's closing reason ("stored too few posts") vs Core's record: not fixed; it is the model's wording and needs a verdict/record cross-check I did not build.
- Absorbed retry shown as "Didn't work" and "Not done: already tried" for a repeat undo whose real answer was "already back": not touched.
- Rule 4 may still choose a bottom place over a fixed banner; that trade is deliberate.

## Open questions
- The old overlay rules ("covers the least of the page", docking below sticky headers) are replaced for top places; confirm the user wants bottom-only over covering a cookie banner.

UNIT READY: activity/candidate/run-refused.ts, activity/candidate/index.ts, activity/observer.ts, activity/tests/observer.test.ts
UNIT READY: activity/bounded.ts, activity/project-card-bounds.ts, activity/tests/bounded.test.ts
UNIT READY: project-agents/single-subflow/single-subflow-trial.ts, single-subflow/tests/single-subflow-trial.test.ts
UNIT READY: activity/wording/act-words.ts, activity/wording/tests/act-words.test.ts
UNIT READY: service/project-build-ending/record-told.ts, service/project-build-ending/tests/ending-truth.test.ts
UNIT READY: activity/build.ts, activity/tests/scope.test.ts
UNIT READY: extension content/activity-overlay/placement/choose-placement.ts, placement/tests/choose-placement.test.ts
UNIT READY: extension content/action-runtime/scroll-element-into-view.ts, action-runtime/tests/scroll-element-into-view.test.ts

---

# Follow-up round (lead's message)

## Outcome
Done for items 1, 2 and 4 within my files; item 3 left to others as told. Overlay, step-count, closing-reason and retry fixes each have a test that was seen red; the earlier five are now red-confirmed too.

## What changed
1. Overlay (`activity-overlay/placement/choose-placement.ts` plus tests): bottom by default; a top corner only at its edge and only if it covers nothing; no top docks or slides. New: only the page's fixed layers (banner, widget, dialog) can make the pill leave a held place; text and controls changing under it never do (`clearlyBetter`). Tests: plain page -> bottom; fixed layer at the bottom -> a free corner, not over the banner or a dialog (`choose-placement.test.ts`); banner appears mid-run -> exactly one move then stable (`placement-keeper.test.ts`). Three old tests that encoded "move when text is under it" were rewritten to the new rule; they went red under the rule change first.
2a. Step counts: `service/project-build-ending/record-told.ts` now counts the steps the listing cut (`stepsLeftOut`) and says "counting each pass of a repeat" when a step label repeats, since the panel counts the Flow's own steps and the ending counted every pass. Test in `ending-truth.test.ts` (red first).
2b. Closing reason: `reason-checked.ts` (+ `ending-told.ts`): a claim of how many rows were stored ("stored too few posts") is dropped when Core's record says "stored N rows". Test red first.
2c. Retry: `executor/step-loop/failed-attempt.ts`: a failure the ladder retries is no longer settled as a red failed step row ("Didn't work", overlay "A step didn't work in the test"); the recovery thought says it is trying again. A failure that is not retried still settles as failed with its reason. Tests rewritten in `executor/tests/failed-step-reason.test.ts` and `step-counter.test.ts`; both were red under the change.
Also: `activity/tests/scope.test.ts` had backspace characters where `\b` was meant (also in dev); restored `/\bmodel\b/`.
New provider-free visual spec: `apps/extension/e2e/content/tests/activity-overlay/tests/chat-truthful-visual.spec.ts`.

## Commands and results
- Red runs: reverting each fix and running its test failed 6 tests across observer (refused call), scope (draft title, 2), single-subflow (builder agent), ending-truth (collapse, 2); scroll test failed with `inline: "center"`. All restored; files verified back.
- Core grouped runner on activity, executor, project-build-ending, project-build, single-subflow, ui: `Test Files 218 passed (218)`, `Tests 1931 passed (1931)`.
- Core `pnpm check`: exit 0, "structure-audit: passed (443 warning(s), 1152 baselined)". Core `tsc --noEmit`: exit 0.
- Extension tsc both configs: exit 0. Extension unit tests `activity-overlay content/action-runtime`: 519 pass, 0 fail. Downstream structure audit: passed (226 warnings, 616 baselined).
- Headed Playwright: `node scripts/test-content.mjs --headed e2e/content/tests/activity-overlay/tests/chat-truthful-visual.spec.ts` -> `2 passed`; positions printed: job-board plain y 452, after banner y 468, later 468 (stable); company-website plain y 592, after banner y 468, later 468. Neither overlaps the banner (asserted).
- No overlap with t769's changed files (checked against its diff).

## Screenshots (looked at; under apps/extension/e2e/test-results/content/artifacts/activity-overlay-tests-cha-*/)
Scenarios company-website (Kestrel Lane) and job-board (Rolefinch). Chat events are scripted to mirror what Core now emits; this is rendering acceptance, not a live run.
- `company-website-chat.png`, `job-board-chat.png`: the chat reads Plan, then "Put back · Change" with "Not done: FluxIQ could not show that this would put the site back, so it was not done" (no green Done), then "Trying the step again — The page was busy, so FluxIQ is trying the step again", then "Click · Save the job — Done", then the ending "FluxIQ stopped with the Flow only partly built. The judged test run of the whole Flow from its start ran all 13 of its steps, counting each pass of a repeat, and was judged not to do what was asked. It was tried 6 times. The build left no change on the site that it knows of. What it wrote is kept as a draft." Whole words, one test description, composer visible.
- `company-website-overlay-without-banner.png`: the fixture's own consent banner removed; the pill sits bottom-left (y 592), over some of the page's lower text, not over the logo or header. `job-board-overlay-without-banner.png`: the pill sits bottom-left a little up (y 452) in the clear space above the footer.
- `*-overlay-with-banner.png`: after a dark cookie banner is added at the bottom, the pill moves once to just above it (y 468) and stays through four more seconds. It never covers the banner, the site's logo or header.
- The corner toast in these shots ("Build failed — The page needs a sign-in") is the harness's scripted overlay message, not Core's new draft title.

## Not verified
- A real Core run that produces a refused call and an absorbed retry; the chat events are hand-built to Core's new shapes. The refused-call wording and the retry change are proven by Core unit tests, not live.
- Item 3 (setup-rerun "Testing your Flow"; undone like reported as left) not touched.
- The headed pass used the content harness (Chromium, no extension loaded), not an unpacked extension.
- Full `pnpm test` not run.
