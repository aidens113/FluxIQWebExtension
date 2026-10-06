# t174-w111: UI review of live run `run-musq0b1m-0472cfa0` (deepseek-v4-pro, FAILED, $0.2127)

## Outcome

Done. I opened all 22 Lab bundle screenshots and all 30 UI-review pictures (15 moments, each with a scenario picture and a panel picture). I also read every overlay sample in `run-musq0b1m-0472cfa0.ui-review.local.json`, the bundle's `review/contact-sheet.html` and `review/timeline.json`, `evaluation.json`, `summary.json`, `snapshots/flow-lane.json` (build, chat and cross-check), and the decisions and results of steps 0003, 0007, 0063, 0067 and 0073.

**Why the run failed.** The build itself ended normally: `build.outcome: "proposed"`, chat `ending: "created"`, and the overlay said "Flow ready". The run failed *after* that, before playback. The Lab's own control request `update-flow-settings` was refused with 400, "LLM estimated-cost limit is invalid" (timeline seq 22, 18:27:56.8).
- Core refuses any `maxEstimatedCostUsd` above 0.25 (CORE `programs/automation-studio/api/handlers/llm-execution-settings.ts:33`).
- The run was launched with `--llm-cost-ceiling-usd 0.30`.
- So this is a Lab invocation/settings defect, not a product failure. No Flow ran, there was no run ending to present, and D8 and D12 were not exercised.

**How the failure looks to the person.** It isn't shown at all, and from the product's side that is correct, because the product did not fail. But the ending the person *does* get is poor:
- The overlay said "Flow ready / Build finished: a Flow is proposed" (D9) and then disappeared (M14 and M15 are absent).
- Nothing ran.
- The chat had stopped following the stream about 60 s before the end (D16). So the build's closing message is not visible in any picture: no summary, no cross-check warning, no "run it".
- Chat, cards and overlay are therefore not shown to be consistent at the end. The only visible end states are the overlay's "Flow ready" and a card from the middle of the test run ("Testing: Click · × · Already done on the site").

Paths:
- EXT = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension/apps/extension/src`
- CORE = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ/packages/fluxiq/src`
- LAB = `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension/packages/test-runner/src`
- Bundle screenshots are `lab-runs/2026-10-03/run-musq0b1m-0472cfa0/screenshots/NNNNN-*.jpg`.
- UI-review pictures are `test-runs/instances/t174-slot-1/run-musq0b1m-0472cfa0.ui-review.local/NN-*.png`.

## What changed and why

Only this report was written. No source was edited, nothing was built and nothing was run.

### Every picture, judged

| Picture | What it shows | Verdict |
| --- | --- | --- |
| 00001-4f8aea62efcb.jpg | "Loading the conversation…", composer at the bottom, cookie banner. No overlay. | OK |
| 00002-aaaee692bfca.jpg | "Sending your message". The whole instruction is still in the composer and there is no user bubble. The site's "Welcome back" popup is up and there is no overlay. | D10, D11 |
| 00003-b361eb4c9524.jpg | User bubble on the right. The reply is `Doing "Create an automation here".` | D1 |
| 00004-24b23fb1a10e.jpg | "Open page · Done" with no target. Status row and overlay both say "Building your Flow / Deciding the next step", in agreement. | OK |
| 00005-c67bc1ef7f33.jpg | "Clicking “×” — **tool_call core.run_node**". "Typing … into “Autumn Mega Sale: up to 70% off”" names the search box by its placeholder. "Type · Didn't work: a popup or banner…" is accurate. The overlay line is the model's reason, cut off with "…". | **D15**, D5 |
| 00006-93f67d7ab6a3.jpg | Two "Clicking “Space Grey”" headings in a row. Status row "Clicking “Space Grey”"; overlay "Select Space Grey, 7-in-1, Spain, quantity 3, collect cou…" (the model's reason). | D7, D3 |
| 00007-039c529a16c2.jpg | "Updating the draft Flow — I will reorder…". Status row "Clicking “Spain” — done" while the overlay says "Clicking “Spain”". | D3, D6/D7 |
| 00008-8af3881551e7.jpg | "Get coupons · Didn't work: the page was busy", then retry Done. That is correct, and the busy wording holds. "Typing into the page" / "Type · Done" has no target. Status row "Deciding the next step" vs overlay "Typing into the page". | D5, D7 |
| 00009-175edb473e51.jpg | "Updating the draft Flow — Reorder quantity step…". "Add to cart · Didn't work: a popup or banner…" (accurate). Accept all, then Add to cart Done. The site toast says "Added to cart!". Status row and overlay agree. | D3. Rest OK |
| 00010-53b0f59b79f3.jpg | "Checking the Flow is finished — …all requested acts are done and steps are in the draft." "Testing: Open page · /scenarios/crossb…". Status row and overlay agree. | D2, D3 |
| 00011-e463f57232e8.jpg | "Testing: Click · 7-in-1" and "Testing: Click · Space Grey" read "Didn't work: it didn't work the same way again". They ran before the item page was open. Status row "…clicking “Space Grey” — it didn't work the same way again". Four tabs are now open. | **D21**, D19 |
| 00012-675af8fbf849.jpg | "Testing: Type · Done" with no target. "Get coupons · Checked, not pressed". "Accept all · Working on it". Status row and overlay agree. | D5. Rest OK |
| 00013-36029fd45d14.jpg | Three "Updating the draft Flow — Repair the unreproducible steps by reordering…" headings, two identical, with no card under them. Then "Didn't change the Flow — The Flow is as it was, so this was not done: …". | D3, D4, **D18** |
| 00014-bb91471bf7dc.jpg | "Click · 7-in-1 · Didn't work: it wasn't on the page" twice, while the 7-in-1 button is plainly on the page. "Rerun step 7 with the correct 7-in-1 handle…". "…make the 7-in-1 selection step optional, since it is already selected by default" is false: 4-in-1 is the default. | **D17**, D3 |
| 00015-5acb4efdb962.jpg | Second test starts ("Testing: Click · × Working on it"). A "↓" jump button covers the status row: **the chat has stopped following**, and the live line is below the fold. Overlay "Trying the Flow from the start: clicking “×”". | **D16** |
| 00016-c3859310cae4.jpg | "The Lab played the person at a check FluxIQ handed off" (timeline 16). The chat is still parked at the same place, so the hand-off question and its Continue are off-screen. The overlay shows "Building your Flow" with no line: it was cleared after the check. | D16. Headline-clear fix OK |
| 00017-75f4d1c7cc9f.jpg | Chat unchanged (parked). Overlay "Trying the Flow from the start: clicking “Voltbay USB C …”". Five tabs. | D16, D19 |
| 00018-42ba7c59fc56.jpg | Chat unchanged. Overlay "…clicking “Accept all”". | D16 |
| 00019-2e1d5a396886.jpg | Chat unchanged. Overlay "✓ Flow ready / Build finished: a Flow is proposed". | D9, D16 |
| 00020-f7f4e201b305.jpg | "The extension's chat: instruction ended". The chat is still parked mid-test, so the build's ending is not visible. Overlay as 00019. | D16 (ending invisible) |
| 00022-69cd1511a8b6.jpg | Lab error frame ("FluxIQ control request failed … estimated-cost limit is invalid"). The overlay is gone and the chat is unchanged. Nothing tells the person a run will not happen (correct, because this is a Lab fault). | D20 (Lab) |
| 00023-fe4d6e3c870a.jpg | Final frame, same as 00022. Cart 3, total 68,97 €, Space Grey / 7-in-1 / Spain / qty 3. | As 00022 |
| 01-start-panel / 01-start-scenario | "Loading the conversation…". Home page with the cookie banner. No overlay (nothing running). | OK |
| 02-mid-build-panel / 02-mid-build-scenario | "Sending your message" with the text still in the composer. No overlay; the json shows it arrives 2011 ms later with the headline alone. | D10, D11 |
| 03-mid-build-panel / 03-mid-build-scenario | "Looking for "Voltbay" on the page — **tool_call web.find_on_page**". "Look · "Voltbay"" names its target. "Clicking “×” — **tool_call core.run_node**". Panel and overlay both "Deciding the next step". | **D15**. Look target fix OK |
| 04-mid-build-panel / 04-mid-build-scenario | Panel "Clicking “Space Grey” — done"; overlay (same instant) "Clicking “Space Grey”". | D6/D7 |
| 05-mid-build-panel / 05-mid-build-scenario | "Get coupons · Didn't work: the page was busy". The page says "Network busy, please try again". Both surfaces "Deciding the next step". | OK |
| 06-mid-build-panel / 06-mid-build-scenario | "Typing into the page / Type · Done" (no target). Add to cart is blocked by the banner, then Accept all. Both surfaces "Deciding". | D5 |
| 07-mid-build-panel / 07-mid-build-scenario | "Checking the Flow is finished — …acts… draft". "Testing: Open page · /scenarios/crossb…". Both surfaces "Trying the Flow from the start: clicking “×”". | D2, D3 |
| 08-mid-build-panel / 08-mid-build-scenario | Panel "typing into the page" with "Testing: Type · Working on it"; overlay "clicking “Space Grey”". Two "it didn't work the same way again" cards. | D7, D21, D5 |
| 09-mid-build-panel / 09-mid-build-scenario | Three "Updating the draft Flow" headings with no cards. The panel status row is the model's reason ("Repair the unreproducible steps…"); the overlay says "Deciding the next step". The Lab flags this window `flickering`. | D3, D7, D18 |
| 10-mid-build-panel / 10-mid-build-scenario | "Click · 7-in-1 · Didn't work: it wasn't on the page" ×2, with 7-in-1 visible on the scenario picture. | D17 |
| 11-mid-build-panel / 11-mid-build-scenario | The scenario shows the site's "unusual traffic / I'm not a robot" check. The overlay at picture time still says "clicking “×” — already d…". At 1411 ms (json) it becomes "Waiting for you: answer in the FluxIQ panel / FluxIQ needs you: complete the check on this page, then press Continue." The panel is parked with "↓", so the question is not in view. | D16 (hand-off off-screen). Overlay hand-off wording OK |
| 12-mid-build-panel / 12-mid-build-scenario | Panel parked. Overlay "…clicking “Spain”", then "…clicking “Get coupons”". | D16 |
| 13-mid-build-panel / 13-mid-build-scenario | Panel parked. Overlay "The result answers the request", then at 432 ms "Flow ready / Build finished: a Flow is proposed". | D9, D16 |
| 14-flow-run-panel / 14-flow-run-scenario | Labelled "flow-run", but no Flow ran. No overlay, panel parked. | D20 (Lab label) |
| 15-failure-panel / 15-failure-scenario | No overlay, panel parked, the item page as the build left it. Nothing about the failure (correct, Lab-side). | D16, D20 |

### Carried defects D1-D14 (from `t174-w96-ui-musp8nz1.md`): do they recur?

| # | Recurs? | Evidence here |
| --- | --- | --- |
| D1 first reply / loopback URL / "Say run it" | **Yes, part 1.** Parts 2-3 not visible | `00003`: `Doing "Create an automation here".`. The build summary was never on screen (D16), so the URL and "Say run it" can't be judged. |
| D2 raw path as Open page target | **Yes (chat)** | "Testing: Open page · /scenarios/crossb…" in `00010`, `00011`, `00015`-`00023`, and panels 07 and 11-15. No overlay "Opening …" was sampled this run. |
| D3 internal vocabulary / raw model reasons | **Yes, wider** | "acts", "draft", "unreproducible", "handle", "step 7", "retest" in headings (`00010`, `00013`, `00014`). The model's reasons are now also the **overlay line** (M3, M5, M6, M9, M10) and the panel status (09-panel). |
| D4 contradictory refused-edit message | **Yes** | `00013`/`00014`: "Didn't change the Flow — The Flow is as it was, so this was not done: repair the unreproducible steps…". |
| D5 Type cards without target / placeholder as target | **Yes, both** | "Type · Done" (`00008`, `00012`, 06-panel); "Testing: Type" (08-panel). "into “Autumn Mega Sale: up to 70% off”" (`00005`, 03-panel, overlay M7). |
| D6 "— done" about the previous step | **Yes** | 04-panel "Clicking “Space Grey” — done" against the overlay's new "Clicking “Space Grey”". `00007` "Clicking “Spain” — done". Overlay M8 "typing into the page — done" while the next card runs. |
| D7 overlay / status row / cards disagree | **Yes** | `00006`, `00008`, and moments 8 and 9 (see the table). |
| D8 bare "Run finished" | Not exercised | No Flow ran. |
| D9 "Flow ready / a Flow is proposed" | **Yes** | `00019`, `00020`, M13. |
| D10 message stays in composer while sending | **Yes** | `00002`, 02-panel. |
| D11 overlay late at build start | **Yes, slightly worse** | M2: absent 0-1810 ms (10 samples) while the panel said "Sending your message". Then "Building your Flow" alone at 2011 ms. |
| D12 playback retry announced as "Fixing your Flow" | Not exercised | No playback. |
| D13 navigation ending a window in a failed read not counted | Not exercised in its failing form; **source unchanged** | M3 had "the overlay host went away" mid-window (1402 ms), and the next sample's new origin was counted (`pageLoads: 1`). LAB `run-scenario/ui-review/count-overlay-changes.ts:37` still skips error samples, so a window that *ends* on that error would still go uncounted. |
| D14 overlay text over-screened (`[long]`) | Not reproduced | No `[long]` or `[screened]` anywhere in the json. Long overlay lines (M3, M5, M7, M10) are intact. No path-bearing overlay text was sampled, so the path case is unconfirmed. |

### New defects, most severe first

**D15. The chat heading shows a raw tool id as the reason: "— tool_call core.run_node", "— tool_call web.find_on_page".** Screenshots: `00005`, `03-mid-build-panel.png`.
- deepseek-v4-pro sent decisions without the `summary` line (steps 0003 and 0007 `response.txt` have no summary).
- Core then writes one "from the decision" as `${kind} ${toolId}`, and that string goes to the chat as the person-facing reason.
- Flash always wrote a summary, which is why D15 is new with this model.
- Owner: CORE `programs/automation-studio/runtime/llm/evidence-loop-decision.ts:392-397` (`decisionSummary`). The fallback should not be shown to a person; with no reason, the heading should end at "Clicking “×”".

**D16. The chat stops following the stream, so the person sees neither the hand-off question nor the build's ending.** Screenshots: `00015`-`00023`, and panels 11-15.
- From about 18:26:55 (the start of the second test run) the panel stays parked at the same scroll position, and a "↓" jump button covers the live status line.
- Nobody scrolled the panel; the Lab only reads it.
- It stays parked through the person check (M11): the overlay says "answer in the FluxIQ panel … press Continue", but the question is off-screen.
- It stays parked through the build's end. The closing summary, the cross-check warning and any "run it" are never visible.
- Owner: EXT `panel/chat/view/scroll-follower.ts:57-65`. The scroll handler treats any `scrollTop` move that leaves the view off the bottom as the person leaving. Inferred cause: a scroll the person did not make, such as Chrome scroll anchoring or a reflow when the test-run cards were regrouped or replaced, moved `scrollTop`.
- Separately, a question addressed to the person (hand-off, permission) should call `followNow()`, or otherwise bring it into view, whatever the follow state (owner EXT `panel/chat/chat-panel.ts`, inferred).

**D17. "Didn't work: it wasn't on the page" for a button that is visibly on the page.** Screenshots: `00014`, `10-mid-build-panel.png` with `10-mid-build-scenario.png` (7-in-1 is shown).
- Steps 0063 and 0067 returned `target_unobserved`, `reason: handle_not_in_packet`. The model reused handle ids (`t985`, `t1194`) from an older page view.
- The person is told the thing is missing when it is in plain sight.
- Owner: CORE `ui/activity-action/failure-reason.ts:15` (the `_unobserved_` word maps to "it wasn't on the page"). `handle_not_in_packet` should read something like "FluxIQ was looking at an older view of the page".

**D18. Repeated "Updating the draft Flow — …" headings with no outcome, in internal words.** Screenshots: `00013`, `09-mid-build-panel.png`, `00014`.
- Three amend headings in a row, two of them word-for-word identical ("Repair the unreproducible steps by reordering them to match the actual page flow, then retest."), with no card saying whether anything changed.
- Then the D4 refusal line. The person cannot tell what happened.
- Owner: CORE `programs/automation-studio/runtime/activity/wording/tool-call.ts:70` (title "Updating the draft Flow") with the reason passed through by CORE `programs/automation-studio/runtime/activity/observer.ts`. Fixes: say "Changing the Flow", show the result of each change, and collapse identical repeats.

**D21. "Didn't work: it didn't work the same way again".** Screenshots: `00011`, `08-mid-build-panel.png`.
- The test step failed because the draft clicked 7-in-1 and Space Grey before the item page was open (`core.replay.unreproducible`).
- The sentence repeats "didn't work" and gives no reason.
- Owners: CORE `ui/activity-action/failure-reason.ts:103`, EXT `shared/activity/wording.ts:63` (`OUTCOME_NOT_REPEATED`), and CORE `programs/automation-studio/runtime/activity/observer.ts:62` (status row).
- Suggested wording: "Didn't work when tried again: the page wasn't in the same state".

**D19. Item tabs pile up during the build (minor).** Screenshots: `00006` (2 Farbazaar tabs), `00011` (3), `00017` (4 Voltbay tabs).
- Each exploration and test pass opens the result in a new tab (the site uses a new-tab link), and nothing closes the old ones.
- The person is left with several stale copies of the item page.
- Owner not located: inferred to be the build-test reset in CORE (`replay: "reset"`), which re-opens rather than reuses.

**D20. Lab side of the failure: the wrong category, a late refusal and a misleading moment label.** Sources: `evaluation.json`, timeline 22, M14.
- The run is categorised `environment.missing` / facility reason `unclassified`. It is really a Lab argument out of Core's range: a 0.30 cost ceiling against Core's 0.25 maximum. It was refused only after the whole build had spent $0.21.
- The Lab should check the plan against Core's limit before starting a paid build. Owners: LAB `live-llm/flow-settings.ts:45` (sends `plan.maxEstimatedCostUsd`), CORE `programs/automation-studio/api/handlers/llm-execution-settings.ts:33` (`> 0.25`), and LAB `http-control/index.ts:172` (the category comes from the caller).
- UI-review moment 14 is labelled `flow-run` because LAB `run-scenario.ts:318` sets the phase before the settings call, but no Flow ran. The label should follow a run actually starting.
- There is no `end` moment, which is correct for a failed run.

### Carried-fix rechecks

- **Look names its target: fixed.** 03-panel: "Look · "Voltbay"".
- **Overlay headline clears after a person check: fixed.** M11 shows "Waiting for you: answer in the FluxIQ panel / … complete the check on this page, then press Continue.", which is plain and accurate. After the Lab passed the check (`00016`, 18:27:04.6), the overlay is back to "Building your Flow" with no stale wait text. `evaluation.json` person-hand-off: traffic-screen cleared after 4.3 s.
- **"The page was busy" wording: holds.** See `00008` and 05-panel; the page says "Network busy, please try again".
- **Cross-check shown as a prose warning (old D6): due but not verifiable.** `snapshots/flow-lane.json` `build.consequenceCrossCheck = {verdict: "undeclared", declared: [], instructed: ["modify_existing","create_new"], declaredNothing: 63 of 67 actions}`. A warning was due in the build summary, but no picture shows the summary (D16).
- **"Not confirmed" card, step counter on retry, no "Join paths" card: not exercised.** No playback.
- **Overlay on the front tab: holds.**
  - Every moment records `inFront: true` with `frontTabs` equal to the sampled tab.
  - Every present sample is visible, at x 16, width 384, at y 327 on item pages (over the product photo) or y 638 elsewhere.

### The failure's presentation, judged

1. **Said plainly, with reason and what was done?** The product said nothing, because the product did not fail; the Lab did. Showing a Lab settings error in the chat would be wrong. The Lab's own record says the cause plainly in `summary.json` and timeline 22, but miscategorises it (D20).
2. **What the person actually experiences.**
   - A build ends with "Flow ready / a Flow is proposed" (D9).
   - The overlay vanishes, and no run starts.
   - The chat shows the middle of the test run with a "↓" button. The ending is never visible without scrolling (D16).
3. **Consistency across chat, cards and overlay at the end.**
   - The overlay and timeline agree that the build finished.
   - The chat's ending is invisible, so consistency cannot be shown.
   - During the build, the surfaces disagreed at several instants (D6, D7).
4. **Run verdict for the UI.** Under the binding rule, this run has not passed on UI grounds, independent of the Lab failure. The main reasons are D15, D16 and D17, plus the recurring D1-D7, D9, D10 and D11.

### pageLoads and picture-timing record check

- **Picture timing: recorded for every picture.**
  - All 15 scenario and 15 panel pictures carry `takenAt`, `ms`, `windowMs {from,to}` and `overlaySamples {lastBefore, firstAfter}`.
  - Scenario pictures fall at -9 to 237 ms and panel pictures at 112 to 946 ms of their windows.
  - M9's scenario capture took 822 ms, the slowest, and is still recorded.
  - `masked: 0` everywhere, `skipped: []`, `skippedTicks: 0`, `failures: []`.
- **`pageLoads`: every in-window navigation is accounted for.**
  - M1: 1 (origin change at 599 ms; overlay absent anyway).
  - M3: 1 (read failure "host went away" at 1402 ms, new origin at 1600 ms, gap 0).
  - M7: 1, gap 1 (overlay absent for one sample at 606 ms after the test's Open page, back at 807 ms).
  - M10: 1, gap 1 (absent at 2013 ms after a reset, back at 2210 ms).
  - Every other moment: 0, with a constant origin.
  - Navigations between windows appear only as a new origin at the next moment, by design: M2→M3, M3→M4, M6→M7, M7→M8, M9→M10, M10→M11, M11→M12.
  - The D13 gap (a window ending on a failed read) did not occur, and its source is unchanged.
- **review/ folder.**
  - `contact-sheet.html` lists the 22 frames.
  - `timeline.json` has 24 entries. Entries 21 and 24 are `duplicateOfSha256` of frames 20 and 23, which is correct deduplication and is why `00021` and `00024` do not exist.
  - Entry 22 is the error frame.
  - `summary.json`: `screenshotCount: 22`, `duplicateScreenshotCount: 2`, which is consistent.

## Commands run and observed results

- Listed the bundle: 22 jpgs (00021 and 00024 absent, deduplicated), `review/contact-sheet.html` and `review/timeline.json`. Listed the `.ui-review.local/` folder: 30 pngs.
- Viewed all 52 images with the Read tool.
- `node` dump of `timeline.json`: 24 entries; seq 22 is "FluxIQ control request failed: …update-flow-settings (400): LLM estimated-cost limit is invalid."
- `node` dump of every moment and sample of the ui-review json:
  - 15 moments, statuses absent / changed ×7 / flickering (M9) / changed ×4 / absent / absent.
  - `pageLoads` 1,0,1,0,0,0,1,0,0,1,0,0,0,0,0; `pageLoadGaps` 1 at M7 and M10.
  - `grep -c '\[long\]\|\[screened\]'` printed 0.
- Read `evaluation.json` (verdict failed, `environment.missing`, flowCreated false, 31 LLM calls), `summary.json`, `run.json` (args include `--llm-cost-ceiling-usd 0.30`), and `snapshots/flow-lane.json` (`build.outcome: "proposed"`, chat `ending: "created"`, `asks.personCheck: 1`, `consequenceCrossCheck.verdict: "undeclared"`).
- Read steps 0003 and 0007 `decision.json` and `response.txt` (no `summary` in the model output; summary = "tool_call …"), and 0063 and 0067 `result.json` (`target_unobserved` / `handle_not_in_packet`).
- Grepped CORE, EXT and LAB for each wording to name the owners. Read CORE `evidence-loop-decision.ts:360-397`, `activity/decision-reason.ts`, `activity/wording/decision.ts`, EXT `panel/chat/view/scroll-follower.ts` and `scroll-follow.ts`, and LAB `live-llm/flow-settings.ts:15-50` and `http-control/index.ts:160-173`.

## Not verified

- **The cause of D16 is inferred** (a scroll the person did not make, e.g. scroll anchoring or reflow). I did not reproduce it or trace the DOM change at 18:26:39-18:26:55.
- **What the chat said at the end of the build, and whether a hand-off prompt with Continue was rendered.** Neither is in any picture (D16), and no chat transcript is in the bundle.
- **D1 parts 2-3 and the cross-check warning text.** Not visible.
- **The D19 owner and the exact derivation of `plan.maxEstimatedCostUsd` from `--llm-cost-ceiling-usd 0.30` (D20).** Both are inferred, not traced.
- **D14 for path-bearing overlay text, D8, D12, "Not confirmed", and the step counter.** None of these was exercised.

## Open questions or contradictions found

- **The model claimed something false and the chat repeated it.** "since it is already selected by default on the item page" (7-in-1). 4-in-1 is the default (`04-mid-build-scenario.png`). Model reasons are shown verbatim, so false claims reach the person as FluxIQ's own words (feeds D3).
- **The build reported "all requested acts are done" while the test showed the draft out of order.** The first test failed on unreproducible steps, and only the second test was judged. That is functional, for the debug lane.
- **The w96 cart-badge question looks resolved here.** The badge reads 3 next to total 68,97 € (`07-mid-build-scenario.png`, `00023`), consistent with three hubs at 22,99 €.
