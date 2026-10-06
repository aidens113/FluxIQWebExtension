# t174-w96: UI review of live run `run-musp8nz1-dbd3905a`

## Outcome

Done. I opened all 16 Lab bundle screenshots and all 18 UI-review pictures (9 moments, each with a scenario picture and a panel picture). I also read every overlay sample in `run-musp8nz1-dbd3905a.ui-review.local.json`, the bundle's `review/contact-sheet.html` and `review/timeline.json`, and `evaluation.json`. I checked step results 0058, 0059 and 0061, the steps index, and the `consequenceCrossCheck` record in `snapshots/flow-lane.json`.

The run passed: oracle `passed`, reported `passed`. The build had no person check and no Look action. The consequence cross-check came back `agreed`. So the D6, "Not confirmed", Look and person-check fixes were **not exercised** by this run (details below).

Paths:
- EXT = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension/apps/extension/src`
- CORE = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ/packages/fluxiq/src`
- LAB = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension/packages/test-runner/src/run-scenario/ui-review`
- Bundle screenshots are `lab-runs/2026-10-03/run-musp8nz1-dbd3905a/screenshots/NNNNN-*.jpg`.
- UI-review pictures are `test-runs/instances/t174-slot-1/run-musp8nz1-dbd3905a.ui-review.local/NN-*.png`.

## What changed and why

Only this report was written. No source was edited, nothing was built and nothing was run.

### Every picture, judged

| Picture | What it shows | Verdict |
| --- | --- | --- |
| 00001-e7908fbb3077.jpg | Panel "Loading the conversation…", composer at the bottom. No overlay (nothing running). | OK |
| 00002-3c58b63df066.jpg | Live line "Sending your message". The instruction is still sitting in the composer, not in the stream. | Defect D10 |
| 00003-07a20e3adee9.jpg | User bubble on the right. First reply `Doing "Create an automation here".` | Defect D1 (carried D9) |
| 00004-973a8d238414.jpg | Overlay at the left, on the front tab, fully visible, not behind the panel. Cards: "Click · Reject non-essential, Didn't work: a popup or banner on the page was covering it", and "Click · × Working on it". Status row and overlay agree. | OK (overlay placement fix confirmed) |
| 00005-e098ac31c561.jpg | Card headings name targets ("Clicking “7-in-1”"). Status row and overlay say the same reason. | OK |
| 00006-969dcb846a0f.jpg | Page says "Network busy, please try again". Card "Get coupons Working on it". Status row "Clicking “Get coupons”", but the overlay at the same instant says "Deciding the next step". | Defect D7 |
| 00007-0f407893991a.jpg | "Type · Done" with no target. A "Didn't change the Flow — That step already does that; and the Flow has no such step…" heading. "…completing act a1." "Checking the Flow is finished — All acts are done…; completing with a one-sentence description…". | Defects D3, D4, D5 |
| 00008-eedf6c1749f9.jpg | "Testing: Open page · /scenarios/crossb…" (a raw path). Status row "…clicking “Voltbay USB C Hub…” — done" while the "Reject non-essential" test card is in flight. | Defects D2, D6 (carried D10) |
| 00009-c3184a6639b2.jpg | Test cards name targets: "Testing: Click · Spain", "Get coupons Working on it". Status row and overlay agree. | OK |
| 00010-70475f4eafe4.jpg | "Testing: Type · Done" (quantity, no target). "Testing: Click · Add to cart · Checked, not pressed". "Judging the Flow". "Check result · Passed: the result was judged to answer the request." | D5. Rest OK |
| 00011-bb284d231a1a.jpg | Overlay "Flow ready / Build finished: a Flow is proposed". | Defect D9 (minor) |
| 00012-4c4b315a5acf.jpg | Build summary with the full `http://127.0.0.1:58504/scenarios/crossborder-marketplace/` and `Say "run it" to try it.`, right above "Open page · /scenarios/crossborder-m… Working on it" and "Running your Flow · Run started". | Defect D1 (carried D9) and D2 |
| 00013-b28d2c11a43a.jpg | Playback, overlay "Running your Flow · Step 8 of 12", status row the same. Card "Type · Autumn Mega Sale: up to 70% off" (the search box placeholder, not the typed text). | Defect D5 |
| 00014-5c4a5a0b1579.jpg | Playback retry: "Click · Get coupons · Didn't work: the page was busy". Then "Trying the step again…", "Click · Get coupons · Done", "Type · Done" (no target), "Add to cart · Done", and "Check result · Working on it". Overlay "Step 12 of 12 · Checking the result answers the request". | Busy wording fixed. Counter fix holds (see recheck). D5 |
| 00015-ef4207f667cc.jpg | "Check result · Passed…", then a bare "Run finished". Overlay "✓ Run finished". | Defect D8 (minor) |
| 00016-7f97c1a0e90c.jpg | Same as 00015 (final frame). | As 00015 |
| 01-start-panel.png / 01-start-scenario.png | "Loading the conversation…". Home page with the cookie banner, no overlay. | OK (nothing running yet) |
| 02-mid-build-panel.png / 02-mid-build-scenario.png | "Sending your message" with the text still in the composer. Scenario shows the welcome popup with no overlay. The overlay arrived 1.2 s later (json). | D10. Overlay late, see D11 |
| 03-mid-build-panel.png / 03-mid-build-scenario.png | Panel status "Deciding the next step" while the "Reject non-essential" card is "Working on it". Overlay (same instant, json samples 0-600 ms) "Clicking “Voltbay USB C Hub Multiport Adapter Type C …” — done". So three different states are shown at once. | Defect D7 |
| 04-mid-build-panel.png / 04-mid-build-scenario.png | "Click · Get coupons · Didn't work: the page was busy" (correct, the page says "Network busy"). Status row "Deciding the next step". Overlay "Clicking “Get coupons”" (stale). The json flags this window "flickering": Clicking → Deciding → Clicking. | D7. Busy wording OK |
| 05-mid-build-panel.png / 05-mid-build-scenario.png | "…completing act a1." and "All acts are done…". Overlay at the bottom-left, "Trying the Flow from the start: clicking “×”", stable. | D3 |
| 06-mid-build-panel.png / 06-mid-build-scenario.png | Test cards with targets. The overlay showed "clicking “Space Grey” — done" for about 800 ms, then "clicking “Space Grey”" (the second Space Grey step). | D6 (minor) |
| 07-flow-run-panel.png / 07-flow-run-scenario.png | Check result Passed. Overlay "Flow ready / Build finished: a Flow is proposed". Then the overlay goes to "Running your Flow · Run started", then "Running step 1 of 12: Opening “[long]”" (json). | D2 and D9 |
| 08-flow-run-panel.png / 08-flow-run-scenario.png | "Running step 9 of 12: Clicking “Spain”", consistent. The json then shows "Fixing your Flow · Step 10 of 12 · Fixing a step that didn't work" during the plain busy retry. | Defect D12 |
| 09-end-panel.png / 09-end-scenario.png | "Check result Passed", bare "Run finished". Overlay "✓ Run finished". The site header shows the cart at "0" next to quantity 3 and Total 68,97 € (see open questions). | D8 |

### Defects, most severe first

**D1. Carried D9 is still present, all three parts.** Screenshots: `00003-07a20e3adee9.jpg`, `00012-4c4b315a5acf.jpg`.
- The first reply is still `Doing "Create an automation here".`
- The build summary still carries the full loopback URL `http://127.0.0.1:58504/scenarios/crossborder-marketplace/`.
- It still ends `Say "run it" to try it.` while the run card "Open page · Working on it" and "Running your Flow · Run started" sit directly below it.
- Owners: CORE `programs/automation-studio/runtime/conversations/instructions/respond.ts:65` and CORE `programs/automation-studio/runtime/conversations/commands/create-here.ts:60,65`. The same sentence is in `explore.ts:53,58`.

**D2. A raw address path is shown as the target of Open page, in the chat and in the overlay.** Screenshots: `00008` ("Testing: Open page · /scenarios/crossb…"), `00012` ("Open page · /scenarios/crossborder-m…"), and overlay moment 7 (json, "Running step 1 of 12: Opening “[long]”").
- `[long]` is the Lab's screening (`[A-Za-z0-9+/_=-]{32,}`) of what the overlay really showed: an address path of 32 or more characters.
- So the overlay shows a URL path, against the "no raw URLs" rule. It should say the page in words ("Opening Farbazaar").
- Owner: CORE `programs/automation-studio/runtime/activity/wording/action.ts:169`. By design it words a navigate as "Opening “<path>”". The card target comes from the same path, through EXT `panel/chat/stream/step/card-words.ts`.

**D3. Internal plan vocabulary and the model's raw reasons reach the chat.** Screenshots: `00007-0f407893991a.jpg`, `05-mid-build-panel.png`.
- "Clicking “Add to cart” — …puts the three Space Grey 7-in-1 Spain hubs in the cart, completing act a1." This shows an internal act id.
- "Checking the Flow is finished — All acts are done and added to the Flow; completing with a one-sentence description of the cart-building Flow." This shows the internal "acts" vocabulary and the completion mechanics.
- The status row and overlay repeat it: "Checking the Flow does what you asked — the plan checks out, it still has to run cleanly". "the plan" is internal too, though that one is milder.
- Owners: CORE `programs/automation-studio/runtime/activity/wording/decision.ts:6` (the `COMPLETE` heading with the model reason appended verbatim). The per-action heading reason is the model's own text, passed through unscreened for ids such as `a1`. EXT `shared/activity/wording.ts:65` (`OUTCOME_PLAN_OK`).

**D4. A refused draft edit is shown as a contradictory internal message.** Screenshot: `00007-0f407893991a.jpg`, `05-mid-build-panel.png` (top).
- "Didn't change the Flow — That step already does that; and the Flow has no such step, so this was not done: adding the quantity step and the Add to cart press to the Flow, then completing the draft."
- This is step 0028, an `amend_draft` refused for `act_already_named, no_such_step`. Two refusal reasons are joined into one sentence that contradicts itself, and "the draft" is internal. The person has nothing to act on, and the build carried on fine.
- Owner: CORE `programs/automation-studio/runtime/activity/wording/draft-edit-refused.ts:63`. Such a refusal is bookkeeping and should be hidden, or reduced to a neutral line.

**D5. Type cards still have no target, or the wrong one (carried D5 and D4 sub-point).**
- The quantity step reads "Type · Done" (`00007`, `00014`, `00015`, `09-end-panel.png`) and "Testing: Type · Done" (`00010`, `07-flow-run-panel.png`). It never says "Typing “3” into Quantity".
- In playback the search step reads "Type · Autumn Mega Sale: up to 70% off" (`00013`, `08-flow-run-panel.png`). That is the search box placeholder, while the test card in the same build reads `Testing: Type · "Voltbay USB-C hub" int…` (`00008`), which is right.
- Owners: CORE `programs/automation-studio/runtime/activity/wording/action.ts:44` (the plain fallback when no field name arrives) and EXT `shared/activity/wording.ts:72`. Playback naming by placeholder is decided in CORE `ui/activity-action/` (inferred: the playback card takes the element's accessible name, not the typed text).

**D6. The status row and overlay still say "— done" about the previous step while the next one runs (carried D10, reduced).**
- `00008`: status row "Trying the Flow from the start: clicking “Voltbay USB C Hub…” — done" while the "Testing: Click · Reject non-essential" card is "Working on it".
- Overlay moment 3 (samples 0-600 ms): "Clicking “Voltbay USB C Hub…” — done" while that card is in flight.
- Moment 6 (0-803 ms): "clicking “Space Grey” — done" until the next step's text replaced it.
- The worst form from last time ("— done" while "Judging the Flow") did not recur: `00010` shows the overlay on the result ("The result answers the request").
- Owner: EXT `background/activity/pacer.ts` (which holds the finished text, see its comment at line 166) and `background/activity/headline.ts`.

**D7. The overlay, the panel status row and the cards disagree at the same instant.**
- `00006` (one browser frame): the status row says "Clicking “Get coupons”" and the overlay says "Deciding the next step".
- Moment 3: the panel says "Deciding the next step", the overlay says "Clicking “Voltbay…” — done", and the card says "Reject non-essential · Working on it".
- Moment 4: the panel says "Deciding the next step" and the overlay says "Clicking “Get coupons”". The overlay then went Clicking → Deciding → Clicking within 3 s, which the Lab flags as `flickering` (one text revisit).
- The second "Clicking “Get coupons”" was a real retry, so the revisit reflects real work. But the panel and overlay should show the same headline at the same moment, and "Deciding the next step" should not appear while a card is visibly in flight.
- Owner: EXT `background/activity/pacer.ts` and `background/activity/headline.ts`. Inferred: the two surfaces are paced separately, or the overlay takes the paced text and the panel the raw text.

**D8. The run ends on a bare "Run finished" with no outcome sentence (carried from D1 of the last review, in a milder form).** Screenshots: `00015`, `00016`, `09-end-panel.png`, `09-end-scenario.png`.
- The verdict card now matches the outcome ("Check result · Passed"), and no orphan card appears.
- But the chat ends with a bare "Run finished", and the overlay ends with "✓ Run finished". Neither says what happened, for example "Done: 3 Voltbay hubs (Space Grey, 7-in-1, from Spain) are in your cart and the coupon is collected".
- Owner: CORE `programs/automation-studio/runtime/activity/bind.ts` (run start and end notes) and EXT `background/activity/headline.ts` for the overlay. Inferred.

**D9. "Flow ready / Build finished: a Flow is proposed" is internal and vague.** Screenshot: `00011`, `07-flow-run-scenario.png`.
- "proposed" means nothing to the person, and the Flow starts running about 1 s later.
- Owner: CORE `programs/automation-studio/runtime/activity/build.ts:22`.

**D10. Sending does not look like ChatGPT: the message stays in the composer.** Screenshots: `00002-3c58b63df066.jpg`, `02-mid-build-panel.png`.
- While "Sending your message" shows, the full instruction is still in the composer and the stream has no user bubble. ChatGPT moves the message into the stream and clears the composer at once.
- Owner: EXT `panel/chat/view/live-line-model.ts:18` together with the composer that clears only on acknowledgement (inferred).

**D11. The overlay was absent for the first 1.2 s of the build, then lost its host at an Open-page navigation.** Moment 2 (json).
- 6 absent samples (0-1001 ms) while the panel already said "Sending your message".
- The overlay then appears as "Building your Flow" alone, then "Opening where the Flow starts".
- At 3003 ms the read fails with "the overlay host went away between two reads", because Open page reloads the tab (see D13).
- The late start is minor, because the request had only just been sent.
- Owner: EXT `content/activity-overlay/` (mount timing) and `background/activity/headline.ts`. Inferred.

**D12. A plain playback retry is announced as "Fixing your Flow · Fixing a step that didn't work".** Moment 8 (json samples 2609-3015 ms).
- During the rate-limited retry of step 10 the overlay headline switched to "Fixing your Flow · Step 10 of 12 · Fixing a step that didn't work". The chat at the same time says, rightly, "Trying the step again".
- Nothing in the Flow was fixed. The page was busy, and FluxIQ pressed again.
- Owners: EXT `background/activity/headline.ts:51` (`REPAIRING`, applied to any recovering unit) and `shared/activity/wording.ts:93` (`repairing`). The headline should stay "Running your Flow", with the line "The page was busy, trying again".

**D13. Recording gap: a navigation that ends a window in a failed read is not counted in `pageLoads`.** Moment 2.
- The last sample (3003 ms) is a read failure, "the overlay host went away between two reads". It carries no `documentOrigin`.
- That is the Open-page step ("Opening where the Flow starts" at 2604 ms) reloading the tab: by moment 3 the document origin is new. The summary nevertheless records `pageLoads: 0, pageLoadGaps: 0` for moment 2.
- `countOverlayChanges` skips error samples before reading their origin, and the failed read path does not record the origin.
- Owners: LAB `read-overlay-sample.ts:48-64` (the error returns drop `documentOrigin` and `pageUrl`) and LAB `count-overlay-changes.ts:37`. A read failure with "host went away" should count as a probable page load, or the sampler should re-read the origin.

**D14. Recording gap: overlay text is screened so hard that the review cannot see what the overlay said.** Moment 7.
- `screenText` turned the overlay's step text into `Opening “[long]”`. That is the same over-redaction `screen-location.ts:9` already fixed for page locations, but not for overlay text.
- A reviewer cannot tell whether the overlay showed a path, a full URL or something else. D2 is inferred from the panel card.
- Owner: LAB `read-overlay-sample.ts` (the text goes through `screenText`). It should keep a fixture path the way `screenLocation` does.

### Carried-defect rechecks

- **D6 (cross-check as prose warning): not exercised.** `snapshots/flow-lane.json` has `build.consequenceCrossCheck = {verdict: "agreed", declared: ["create_new"], instructed: ["create_new"], undeclared: []}`. No warning was due, and none appears in any picture. The fix cannot be confirmed from this run.
- **D9 (first reply / loopback URL / "Say run it"): still present, all three.** See D1.
- **"Not confirmed" card: not exercised.** No card in any picture needed it. The outcomes shown were Done, "Didn't work: …", "Already done on the site" and "Checked, not pressed".
- **Step counter on a retry: fixed, as far as the pictures show.**
  - The playback had `web.action.rate_limited` at step 0058 (Get coupons, step 10 of 12), and 0059 succeeded on the retry.
  - The overlay stayed at "Step 10 of 12" through the retry (moment 8).
  - The last step still read "Step 12 of 12" (`00014`), not "13 of 12" as the old defect would give.
  - No picture caught steps 11 or 12 themselves.
- **No "Join paths" card: confirmed.**
  - The Flow has two `builtin.control.merge` nodes (`evaluation.json` actions).
  - No Join-paths card appears in any picture: `00013`, `00014`, the 07 and 08 panels, and `00008`-`00010` all go from one action card to the next.
  - "Recovery started" is gone too: `00014` shows only "Trying the step again".
- **Look names its target: not exercised.** No Look action ran in this run.
- **Overlay headline clears after a person check: not exercised.** No person check happened.
- **"The page was busy" wording: fixed.** Build: `04-mid-build-panel.png` and `00006`/04-scenario, where the page itself says "Network busy, please try again". Playback: `00014`, `00015`, `09-end-panel.png`, all "Didn't work: the page was busy". The retry explanation is still generic ("a step like this often works on a second try"), not "the page was busy, so FluxIQ tried again". That is minor.
- **Overlay on the front tab, not clipped behind the panel: fixed.**
  - Every moment records `inFront: true`, with `frontTabs` equal to the sampled scenario tab.
  - Every present sample has `inViewport: true` and rect x 16, width 384, at y 327 or 638.
  - The bundle screenshots `00004`-`00016` show the pill on the left, clear of the panel.
  - The pill sits at mid-left (y 327) on pages with a sticky bottom bar and bottom-left (y 638) otherwise. In moment 7 it jumped from 327 to 638 at a page load. That is deliberate avoidance and not a defect. On item pages it covers the product photo.

### pageLoads and picture-timing record check

- **Picture timing: recorded for every picture.**
  - All 9 scenario pictures and all 9 panel pictures carry `takenAt`, `ms`, and `windowMs {from,to}` relative to the overlay window.
  - Each also carries `overlaySamples {lastBefore, firstAfter}`, which ties it to the overlay samples on either side.
  - Scenario pictures fall at -6 to 192 ms and panel pictures at 83 to 326 ms of each window. So every picture can be matched to the overlay text at that instant, which is how D7 was established.
- **`pageLoads`: accounts for most navigations, with one gap (D13).**
  - Moment 1 counts 1: the origin changes at 604 ms, the tab reload before the build. The overlay was absent anyway.
  - Moment 7 counts 1: the playback's Open page at 999 ms. The overlay was present on both sides with no gap, so it survived the navigation, and `pageLoadGaps` is 0.
  - Moments 3/4 (origin 1791050710263) and 8/9 (1791050800795.9) show no in-window navigation, and none is counted.
  - Moment 2 ends in a read failure caused by a navigation, and it is not counted (D13).
  - Navigations between windows are outside any window by design. They show only as a new origin at the next moment (M2→M3, M4→M5, M5→M6, M7→M8).
- **`skipped: []`, `skippedTicks: 0`, `failures: []`. No picture was withheld (`masked: 0` everywhere).**
- **review/ folder.** `contact-sheet.html` lists all 16 frames with captions. `timeline.json` has 17 entries. 16 have a screenshot; entry 17 ("Scenario completed") is marked `duplicateOfSha256` of frame 16, which is correct deduplication.

### What looks right

- **Chat layout.** The chat reads like ChatGPT: a right-aligned user bubble, assistant text and cards in one left column, and the composer "Message FluxIQ" pinned at the bottom (`00003`-`00016`).
- **Build card headings.** They name the target and give the reason in plain words, for example "Clicking “Spain” — Selecting Spain as the shipping origin…" (`00006`).
- **Failure reasons are plain and accurate.**
  - "Didn't work: a popup or banner on the page was covering it" (`00004`).
  - "Didn't work: the page was busy" (`00014`).
- **Test cards say what they do.**
  - Each step reads "Testing: Click · 7-in-1" etc., replacing the old "Test run · …".
  - Test outcomes are honest: "Already done on the site" and "Checked, not pressed" (`00009`, `00010`).
  - No reset card says "Passed" before any step.
- **The verdict now matches the outcome.**
  - "Check result · Passed: the result was judged to answer the request." appears once in the build and once in playback.
  - No orphan grey card, and no red/green contradiction.
- **No internal jargon from the judge or repair.** There is no "stale handles", "two checks disagreed" or "keeps the status its steps earned".
- **The overlay is polished.**
  - A dark rounded pill with a phase headline and a step counter, for example "Running your Flow · Step 8 of 12".
  - It is on the front tab, never clipped, and present across the playback navigation.
  - It is stable at the end: 16/16 samples "Run finished".
- **The retry is shown as one failed card, a plain "Trying the step again" note, and a Done card.**

## Commands run and observed results

- Listed `lab-runs/2026-10-03/run-musp8nz1-dbd3905a/screenshots/` and found 16 jpgs. Listed `review/` and found `contact-sheet.html` and `timeline.json`. Listed the `.ui-review.local/` folder and found 18 pngs.
- Viewed all 34 images with the Read tool.
- `node` dump of every moment and sample in `run-musp8nz1-dbd3905a.ui-review.local.json`. Summary: 9 moments, statuses absent / changed / changed / flickering / stable / changed / changed / changed / stable, and per-moment `pageLoads` 1,0,0,0,0,0,1,0,0, with `pageLoadGaps` 0 everywhere. Moment 2 has `readFailures: 1` ("the overlay host went away between two reads").
- Read `evaluation.json`: verdict `passed`, oracle `passed`, reported `passed`, 15 actions including 2 `builtin.control.merge`.
- Read `steps/index.md` and the 0058, 0059 and 0061 results. 0058 is `web.action.rate_limited` ("it said it was busy"), and 0059 succeeded.
- Extracted `build.consequenceCrossCheck` from `snapshots/flow-lane.json`: `verdict: "agreed"`.
- Grepped CORE, EXT and LAB for each wording to name the owners above.
- Read LAB `count-overlay-changes.ts`, and the error paths of `read-overlay-sample.ts`.

## Not verified

- **Owners marked "inferred" were not confirmed.** That covers the pacing split in D7, the overlay mount timing in D11, the playback Type target in D5, and the end sentence in D8. I located them by grep, not by tracing a call path.
- **The exact overlay text at moment 7.** The Lab redacted it to `[long]`, so D2 for the overlay is inferred from the panel card.
- **The step counter for steps 11 and 12.** No picture caught them. The fix is inferred from "Step 10 of 12" staying put through the retry and "Step 12 of 12" at the check.
- **D6, "Not confirmed", Look naming and the person-check headline.** None of these was exercised this run.

## Open questions or contradictions found

- **The cart badge contradicts "Passed".**
  - `09-end-scenario.png` (and `08-flow-run-scenario.png`) show the site header cart at **0**, beside quantity 3 and "Total: 68,97 €".
  - The judge 0048 request also shows `t885 link "0 Cart"`, alongside "Added to cart!", and still judged Passed. The oracle passed too.
  - This is probably the fixture's header badge in the tab that 0052 opened, which never refreshes. If so, a person looking at the page sees an empty cart next to FluxIQ's "Passed".
  - Worth a check that the badge is a fixture artefact and not a missed add.
- **D7 vs the Lab's flicker rule.** Moment 4's "flickering" is a real retry: Clicking → Deciding → Clicking. The overlay text is accurate there, but the panel shows a different text at the same instant.
