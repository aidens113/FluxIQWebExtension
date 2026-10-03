# t174-w81: UI review of live run `run-murwd8le-79e735a8` (lane A, round 1002-M)

## Outcome

Done. I opened all 20 run screenshots, the step screenshots at 0045 and 0068, and the UI-review panel pictures 07, 08 (scenario), 10 and 12. I also read the overlay samples from `.ui-review.local.json`, the judge decisions (0046, 0047, 0069, 0071, 0072), the 0070 consequence decision, and the 0080 to 0082 playback results. No step screenshots exist for the playback (0073-0085) or the judges, and the test steps 0033-0044 and 0056-0067 have only `screenshot.skipped.txt`. Playback was therefore judged from run screenshots 00017-00021 and the overlay samples.

Key paths below are relative to `C:/Users/osrs_/FluxStuff/fxwork/t174/`. EXT = `!FluxIQWebExtension/apps/extension/src`, CORE = `!FluxIQ/packages/fluxiq/src`. Run screenshots are `lab-runs/2026-10-02/run-murwd8le-79e735a8/screenshots/NNNNN-*.jpg`. UI-review pictures are `.../t174-slot-1/run-murwd8le-79e735a8.ui-review.local/*.png`.

## What changed and why

Only this report was written.

### Defects, most severe first

**D1. The final verdict contradicts the page and the run outcome. The last "Check result" card is left empty.** Screenshots: `00019-6cf842ddf580.jpg`, `00021-a1cb25d8766c.jpg`, `12-end-panel.png`.
- The chat ends with "Check result" (grey, no status), then "Check result · Didn't pass" in red, then a bare "Run finished". The overlay shows a green check and "Run finished".
- The page beside it shows Color: Space Grey, 7-in-1, Ships From: Spain, quantity 3, Total 68,97 € (3 × 22,99) and the store coupon "Collected".
- The Lab oracle passed. `evaluation.json` says `reportedVerdict: "unverified"`: judges 0071 and 0072 disagreed.
- So the person sees "Didn't pass" for a run that met the task and was really "unverified". They also see an orphan card with no verdict, a green-check overlay that contradicts the red card, and no closing sentence saying what happened.
- The cart count is not visible, because the header cart sits behind the panel. The colour and variant are visible and match the task.
- Likely owners: EXT `panel/chat/stream/step/card-words.ts:56` maps any failed check to "Didn't pass", so "unverified" has no wording. CORE `programs/automation-studio/runtime/result-verification/run-outcome.ts` and `agreement.ts` produce the verdict. The orphan first "Check result" is inferred to be a started card never closed when the second check replaced it.

**D2. Playback step counter advances on the retry.** Overlay moment 11 (json, 04:40:14) and `00018-da59e4dfd83d.jpg`.
- The overlay goes "Step 11 of 14 | Running step 11 of 14: Clicking “Get coupons”" → "Fixing your Flow | Step 11 of 14 | Fixing a step that didn't work" → "Step 12 of 14 | Running step 12 of 14: Clicking “Get coupons”".
- Then `00018` shows "Step 13 of 14 | Running step 13 of 14: Typing into the page". Quantity is node 12 of the 14-node Flow (navigate, ×, join, search, result, Accept all, join, Space Grey, 7-in-1, Spain, Get coupons, type, Space Grey, Add to cart).
- This is the earlier defect, back again: the retry of node 11 consumed a step number.
- Likely owner: CORE `programs/automation-studio/runtime/activity/step.ts` with `executor/graph-run.ts` (the retry path emits a new step index). The overlay only prints it, in EXT `content/activity-overlay/overlay-view.ts:73`. Inferred.

**D3. Internal mechanics and jargon are shown to the person: the first judge and the repair reason.** Screenshots: `00010-944469129a94.jpg`, `07-mid-build-panel.png`, overlay moment 7.
- Judge card, in red: "...the model judged that it does not answer the request and then that it answers the request. Neither answer is taken over the other, so the result is unverified and the run keeps the status its steps earned."
- Next: "Repairing the Flow — The Flow was not judged to do what you asked: The two checks of this result disagreed: asked twice with the same evidence…". This contradicts the card above it, which says the result is "unverified", not "not judged to do what you asked".
- Then "Looking over the whole page — The draft's steps 6, 7, 8, 9, 10, 11, 12 were run on stale handles; I re-observe the item page…". The same raw model reason is the status row and the overlay text ("Fixing your Flow | The draft's steps 6, 7, 8, 9, 10, 11, 12 were run on stale ...", truncated).
- "stale handles", "re-observe", "the draft's steps 6…12", "two checks", "the model judged" and "keeps the status its steps earned" are all internal.
- Owners: CORE `programs/automation-studio/runtime/result-verification/agreement.ts` (sentence) and `run-outcome.ts`. The model reason is passed through verbatim to the status row and overlay. The overlay and status take the model reason as their headline, in EXT `background/activity/headline.ts` (inferred).

**D4. "Test run" cards don't say what they did. A reset card reads "Test run · Passed" before any step.** Screenshots: `00008-999a9cc3a8b1.jpg`, `00011-128510489530.jpg`, `00012-629003b22864.jpg`, `00014-32fde6b9612a.jpg`, `0045/screenshot.jpg`, `0068/screenshot.jpg`.
- Both test runs open with a card "Test run · Passed" that comes before any test step. This is the earlier reset-card defect, unchanged.
- Every step card is titled "Test run" rather than its action. It shows a raw target, such as "Test run · /scenarios/crossborder-mark…" (a URL path), "Test run · ×", or "Test run · Autumn Mega Sale: up to 70…" (the search box placeholder, not what was typed: "Voltbay USB-C hub").
- The quantity step is just "Test run · Done", with no target or value.
- Owners: CORE `ui/activity-action/names.ts:16` (`["test", "Test run"]`) names the card by phase instead of action. The opening "Passed" card is inferred to be the test node's own start/reset in `programs/automation-studio/runtime/activity/wording/action.ts`. The domain mirror is `!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run/call-words.ts`.

**D5. Generic cards with no target: "Type", "Typing into the page", "Look", "Join paths", "Recovery started".** Screenshots: `00018`, `00019` ("Type · Done", status "Running step 13 of 14: Typing into the page"); `00010` and `00011` ("Look · Done"); `00017` ("Join paths · Done"); `00018` ("Recovery started" as a bare line).
- Typing into the quantity field should say "Typing “3” into Quantity". "Look" should say what was looked at, and its heading does ("Checking the cart page…"). "Join paths" is internal graph vocabulary that should be hidden. "Recovery started" is an internal label that duplicates the "Trying the step again" heading under it.
- Owners: EXT `shared/activity/wording.ts:72` (unnamed-type fallback "Typing into the page") and CORE `runtime/activity/wording/action.ts:39`, used when no field name reaches it. CORE `ui/activity-action/names.ts:17,19` ("Check result", "Join paths"). CORE `programs/automation-studio/runtime/executor/graph-run.ts:566` (`title: "Recovery started"`).

**D6. The consequence cross-check comes back as prose, with no question.** Screenshots: `00015-8157aec2e56f.jpg`, `00016`, `10-flow-run-panel.png`.
- The chat shows: "Your instruction asks to change something that exists ("Collect that store's coupon while you are on the item") and create something new ("put three of the Voltbay USB-C hub … in my cart"), but nothing FluxIQ did while building this Flow said it would."
- No codes (modify_existing, create_new) and no action counts are shown, and no "Apply it as it stands?" question appears. Run 10 goes straight to playback.
- But the sentence is a warning that sounds alarming and has nothing to act on, right after "Passed". It exposes the consequence classification in plain words and reads as if the Flow is wrong.
- Owner: CORE `programs/automation-studio/runtime/action-permissions/cross-check.ts:167`. The "Apply it as it stands?" suffix lives in `flow-bootstrap/action-permissions.ts:300` and did not show this run.

**D7. The person check: the overlay goes stale after the person answers, and the wording is vague and repeated.** Screenshot: `00012-629003b22864.jpg`.
- Asking: "FluxIQ needs you: complete the check on this page, then press Continue." It never says what kind of check (a robot/traffic check).
- After the answer the chat shows "You chose "Continue"." plus a card "Robot check · Done. You pressed Continue." plus the status "Fixing your Flow · You pressed Continue.", which is three echoes of one press.
- The overlay still shows "Waiting for you: answer in the FluxIQ panel / FluxIQ needs you: complete the check on this page, the…" after Continue was pressed.
- The step card in flight above it ("Test run · Autumn Mega Sale: up to 70…") is left grey, with no verdict.
- Owners: EXT `background/activity/headline.ts:47` (overlay headline not cleared on answer) and EXT `panel/chat/conversation/ask-copy.ts` ("You chose"). The card is in EXT `panel/chat/stream/step/card-words.ts` and CORE `ui/activity-action/names.ts` ("Robot check").

**D8. A busy refusal reads as "the page turned it down". Verdicts sit next to a page that shows the press worked.** Screenshots: `00006-06a0cf25f231.jpg`, `00007-e531bcce6e15.jpg`, `00018`.
- At build, `00006` shows "Click · Get coupons — Didn't work: the page turned it down". The page beside it shows the toast "Coupon collected. It will be applied at checkout." and the button "Collected". The retry is still "Working on it", so the toast may belong to the retry, but the card is never revised.
- In `00007`, "Add to cart — Didn't work: the page turned it down" sits beside the toast "Added to cart!".
- In playback, `00018` shows "Click · Get coupons — Didn't work" with no reason, then "Recovery started". The 0081 result is "Action refused by the page for now: it said it was busy".
- The retry wording that follows reads well: "Trying the step again — The step didn't work, and a step like this often works on a second try, so FluxIQ is trying it once more." But "the page was busy, so FluxIQ waited and tried again" would match what happened.
- Owner: CORE `ui/activity-action/failure-reason.ts` (the reason for `web.action.rate_limited` should say "the page was busy"). The playback card that drops its reason is in EXT `panel/chat/stream/step/card-words.ts` (inferred).

**D9. The first reply is meaningless, and the build summary shows a full URL.** Screenshots: `00003-9d018cfb289d.jpg`, `00017-ea9015ca89df.jpg`.
- The first reply to the instruction is `Doing "Create an automation here".` (the internal command title).
- The build summary reads "…explored http://127.0.0.1:51423/scenarios/crossborder-marketplace/, and put the steps it worked out into the Flow. Say "run it" to try it." But the Flow was already running automatically below it.
- Owners: CORE `programs/automation-studio/runtime/conversations/instructions/respond.ts:65` and CORE `runtime/conversations/commands/create-here.ts` / `explore.ts` ("Say "run it"").

**D10. The status row and overlay go stale or say "— done" while the next phase runs.** Screenshots: `0068/screenshot.jpg`, `00015`.
- At 0068 the chat is already "Judging the Flow…" while the status row and overlay still say "Trying the Flow from the start: clicking “Add to cart” — done". They should say "Judging the Flow".
- In `00015`, during the cross-check the overlay says "Fixing your Flow / The result answers the request".
- Owner: EXT `background/activity/headline.ts` and `shared/activity/headline-echo.ts` (inferred).

### Overlay presence and flicker (`.ui-review.local.json`)

- Moment 1 (start, 04:37:18): absent. Acceptable, because the build had not started yet.
- Moment 2: absent for the first 1.2 s after the build began, then "Building your Flow". This is a late appearance.
- Moment 3, "flickering": "Deciding the next step" → "Clicking “Accept all”" → back to "Deciding the next step" within 3 s. The text revisits because each action is short. Expected behaviour for the wait text, but the Lab flags it.
- Moment 7, "flickering": the overlay disappeared for about 200 ms (present → absent → present, 2 presence toggles) at the switch from the raw model reason to "Deciding the next step". This is the real flicker: the overlay should not unmount between phases.
- Moment 8 (04:39:23, mid-repair, right after the person check): absent for all 16 samples on the scenario tab, while FluxIQ was working. In `08-mid-build-scenario.png` the search page is shown with no overlay. The repair test had moved on to a newly opened tab (00013 shows a fourth Voltbay tab), so the overlay didn't follow onto, or stay on, the sampled tab.
- `00004-ffb3080d61ff.jpg`: the overlay is pushed to the right edge, about x 870-895, and clipped behind the side panel. In `00017` no overlay is visible at all while "Running your Flow · Step 5 of 14", with the site cookie banner across the bottom (inferred to be covered or absent).
- Moment 12 (end): stable "Run finished".
- Owner: EXT `content/activity-overlay/` (`overlay-view.ts` and its host/positioning). Inferred for positioning and unmounting.

### What looks right

- Build-phase cards name the target and give the reason as a heading. Example in `00004`, `00005`, `00006`: "Clicking “Spain” — Selecting Spain as the ships-from option…" followed by "Click · Spain · Done".
- The wait text "Deciding the next step" is used in the overlay and status (`00005`).
- The chat layout is ChatGPT-like: right-aligned user bubble, assistant text left, cards inline, composer "Message FluxIQ" pinned at the bottom.
- The overlay is polished: a dark rounded pill, "Running your Flow · Step 13 of 14" (`00018`), and "Waiting for you: answer in the FluxIQ panel" during the person check (`00012`).
- No consequence codes, action counts or "Apply it as it stands?" question appeared (`10-flow-run-panel.png`).
- The second judge card reads cleanly: "Check result · Passed: the result was judged to answer the request." (`00015`).
- The playback retry is shown as "Trying the step again" with a human reason (`00018`).

## Commands run and observed results

- `ls` of the run, screenshots, review and steps directories: 20 screenshots, steps 0001-0085.
- `node` summaries of `timeline.json` and the overlay samples in `.ui-review.local.json`: quoted above, with moment statuses absent, changed, flickering, changed, changed, changed, flickering, absent, changed, changed, changed, stable.
- `find steps -name 'screenshot*'`: no screenshots for 0046-0047, 0069-0085. Test steps 0033-0044 and 0056-0067 have only `screenshot.skipped.txt`.
- Read `evaluation.json`: verdict passed, oracleVerdict passed, reportedVerdict unverified, one person hand-off (traffic-screen, cleared after 3.4 s).
- Read `0081/result.json`: failed, `web.action.rate_limited`, "Action refused by the page for now: it said it was busy".
- `grep -rlF` and `grep -n` of the quoted strings over EXT, domain and CORE (excluding tests): owners as cited.

## Not verified

- There are no step screenshots for playback 0073-0085 or for the judges. So the per-step playback cards, and the exact wording of the 0081 refusal card at the moment it happened, were not seen. Only the end state (`00019`) and `00018` were seen.
- The cart count after playback: the header cart badge is hidden behind the side panel in every run screenshot.
- Whether the "Coupon collected" toast in `00006` came from the first press or the retry.
- The step-counter owner (Core `step.ts` versus the executor) and the overlay unmount cause are inferred, not traced in code.
- No Lab, test or build was run.

## Open questions or contradictions found

- The run's reported verdict is "unverified", but the chat shows "Didn't pass" and the overlay shows a green "Run finished". There are three different outcomes on one screen.
- "Repairing the Flow — The Flow was not judged to do what you asked" follows a card that says the result is unverified. Core treats an unverified judge as a failure when it decides to repair, but words it as unverified.
- The cross-check says nothing during the build "said it would" collect a coupon or add to the cart, yet both were done and judged.
