# t342-r2 UI review: run-muylu4pp-f9cb2121 (lane A, creation build, legacy mode)

Reviewer: worker, read-only. Date: 2026-10-07.

## Outcome

Done. I looked at all 14 panel pictures and all 14 moments' overlay samples. For the scenario tab I looked at
moments 01, 02, 04, 08, 12, 13 and 14. U1 and U3 pass. U2, U4 and U5 pass only in part. The round-4 overlay gap
("Couldn't fix your Flow" on a creation build) and the missing "Starting…" are both fixed. The rerun line that names
no control is still open. The new defects are mostly in the words: step numbers and "judged" in the repair heading
and the edit cards, cards with no target, an edit card that contradicts itself, and an ending that is hard to follow.
They also include panel clutter from replayed steps and a Stop control that looks like plain text.

## What changed and why

Only this report was written. I made no source edits, ran no Lab, browser, provider or panel, and committed nothing.

## Per-checkpoint verdicts

| Checkpoint | Verdict | Evidence |
| --- | --- | --- |
| U1 start | Pass | `01-start-panel.png`: a fresh chat with the empty-state prompt and the composer at the bottom. This picture was taken before the send. `02-mid-build-panel.png`: the instruction is shown as a user bubble, followed by "Starting…", with no previous thread. |
| U2 mid-build | Partial | One assistant message per step with its reason (03-07). Cards show an icon, a target and an outcome in most cases. A Stop control ("Stop build") shows from 03 to 13. Gaps: cards with no target (03, 08, 12); an edit card that contradicts itself (07); step numbers in edit cards (10, 11); "Stop build" missing at 02 and drawn as plain text; two "Not done: that step already does that" cards in a row, not folded (05); every repair replay repeats 4-6 full cards (09-13). |
| U3 overlay | Pass, with notes | Shown from the send: "Starting…" at the first sample of moment 2, matching the panel. Present and visible 16/16 in moments 2, 3, 5-11, 13 and 14. Moment 12 has one absent sample at a real page load (new document, page origin changed). Moment 4's 5 missing samples are sampler read failures ("Target page, context or browser has been closed"), not the overlay vanishing. textRevisits 0, presenceToggles 0, visibilityToggles 0. In every moment the panel status line matches the overlay text. The end reads "Build failed \| Build stopped: the Flow is not finished yet", never "Couldn't fix your Flow". Notes: the overlay jumps between heights (y 638 / 486 / 572 / 327, and it moves inside moment 13); during replays the text changes every ~200 ms (moments 9 and 11); "Get…" is truncated (see the defects). |
| U4 words | Fail | `09-mid-build-panel.png` repair heading: "judged not to do what you asked: Coupon collected (step 12 verified; …). 7-In-1 marked and Spain marked." It has a step number, "judged", mechanical wording, a mangled label ("7-In-1" where the page says "7-in-1"), and it lists checks that held as if they were the reason for failing. Edit cards (10, 11) say "to step 11". "looking over the whole page" is internal step wording. Not seen: "the judge", page-view syntax, "made a value … vary", "no rows would be stored", candidate or "draft trial" wording. |
| U5 ending | Partial | `14-failure-panel.png` matches `build.chat.said` word for word, is whole and does not overstate: "4 of the 6 … ran", "1 more … only checked, not run", one item still to do, and the draft is kept. Not plain: "My last attempt to fix it got no further than the one before: no more of what you asked has a step than before, and it stopped before the Flow was ready, though the attempt before it had got that far." It is one long paragraph. Neither the panel nor the overlay ("Build stopped: the Flow is not finished yet") says why the build stopped. |

## Round-4 "still open" comparison

| Round-4 item | Now |
| --- | --- |
| Overlay "Couldn't fix your Flow \| Build stopped: a budget ran out" on a creation build | Fixed. The overlay reads "Build failed \| Build stopped: the Flow is not finished yet" (`14-failure-scenario.png`). |
| "a budget" does not say which limit | Not seen in the same form. The new stop line is circular and gives no cause (defect D10). |
| No "Starting…" sampled from the send | Fixed. "Starting…" shows in both the panel and the overlay (`02-mid-build-panel.png`, `02-mid-build-scenario.png`). |
| Edit card "made a value in "clicking on the page" vary" | Not seen. |
| Rerun lines "Trying again: clicking on the page" / "typing into the page" name no control | Still open. Moment 12: the overlay and the panel both read "Trying again: clicking on the page", and the card shows "Click · Working on it" with no target. |
| "no rows would be stored" on the cart task | Not seen. No check card was in view in any picture. |
| Repair heading quotes page-view syntax (`quantity field ="1"`, "in start view") | The syntax is not seen, but the repair heading is still not plain: it has a step number and "judged" (D1). |
| "Reading your instruction gave no answer for … so the build's tests check …" | Not seen. |

## Defect list

| # | Screenshot | What is wrong | Likely owner |
| --- | --- | --- | --- |
| D1 | `09-mid-build-panel.png` | The repair heading says "judged not to do what you asked: Coupon collected (step 12 verified; the page at the end shows …). 7-In-1 marked and Spain marked." It has a step number, "judged", and a capitalised mid-sentence fragment. It mangles the label "7-in-1" into "7-In-1". It lists checks that held as if they explained the failure. | Core activity wording (repair heading) |
| D2 | `10-mid-build-panel.png`, `11-mid-build-panel.png` | Edit cards say "moved "Space Grey" to step 11" and "… "looking over the whole page" to step 11". These are step numbers and internal step wording. | Core activity wording (edit summary) |
| D3 | `07-mid-build-panel.png` | The edit card says "Done: added "Space Grey"; removed "Space Grey"". It contradicts itself and does not say what changed. | Core activity wording (edit summary) |
| D4 | `03-mid-build-panel.png`, `08-mid-build-panel.png`, `12-mid-build-panel.png` | Click cards with no target: "Click · Done" under the heading "Clicking on the page" (03), "Testing: Click · Done" (08), "Click · Working on it" (12). The same quantity-field step is named "Quantity" in `14-failure-panel.png`, so the name is sometimes available. | Core activity wording (target label); extension panel chat if the label is present but dropped |
| D5 | `12-mid-build-panel.png`, `12-mid-build-scenario.png` | The rerun line "Trying again: clicking on the page" names no control (round-4 item, still open). | Core activity wording |
| D6 | overlay samples, moments 9 and 11 | The overlay reads "Checking an earlier step is still done: clicking “Get…”". The short label "Get coupons" is truncated to "Get…", which drops the control name. | Core activity wording or content overlay (truncation) |
| D7 | `09`-`13` panel pictures | Each repair replay ("Doing an earlier step again first") prints 4-6 full cards again (Accept all, 7-in-1, Spain, Get coupons, +, Space Grey) every time. The stream fills with repeated successes, which is not a clean ChatGPT-like stream. | Extension panel chat (folding or grouping) |
| D8 | `05-mid-build-panel.png` | Two consecutive "Edit the Flow · Not done: that step already does that" cards are not folded. Each is under its own message. The edit card also does not say what change was tried. | Extension panel chat (folding); Core activity wording (refused edit target) |
| D9 | `02-mid-build-panel.png`; `03`-`13` panel pictures | No Stop control during "Starting…" (02). From 03 on, "Stop build" is small, unstyled, left-aligned text above the composer, which does not read as a button. | Extension panel chat |
| D10 | `14-failure-panel.png`, `14-failure-scenario.png` | The ending is honest but not plain: the "got no further than the one before … though the attempt before it had got that far" clause, one long paragraph, and no cause for the stop. The overlay "Build stopped: the Flow is not finished yet" is circular. | Core ending composer; Core activity wording (overlay stop line) |
| D11 | overlay rects, all moments; `02-mid-build-scenario.png`, `12-mid-build-scenario.png` | The overlay changes height between moments and inside moment 13 (y 638 → 486 → 572 → 327). At moment 2 it covers the cookie-banner text. It looks jumpy, though it may be deliberate placement to keep clear of the target. | Content overlay |
| D12 | `05-mid-build-panel.png` vs overlay | The panel heading says "Changing the Flow" while the overlay says "Updating the Flow". Same act, two words. | Core activity wording / extension panel chat |

## Commands run and observed results

- `ls` of the screenshot folder: 28 PNGs (14 moments × scenario/panel).
- `node -e` over `run-muylu4pp-f9cb2121.ui-review.local.json`: per-moment counts and the text sequence. textRevisits 0 and
  presence/visibility toggles 0 in every moment. Moment 4 has readFailures 5 (CDP target closed). Moment 12 has
  pageLoads 1 and pageLoadGaps 1.
- `node -e` over `snapshots/flow-lane.json` at `build.chat.said`: the final text, which is identical to the visible text
  in `14-failure-panel.png`.
- Read the round-4 debug, lines 93-115 and 224-262.

## Not verified

- Scenario pictures 03, 05-07 and 09-11. Their overlay text was checked from the samples instead.
- Chat messages that scrolled past between moments. Each panel picture shows only the visible window, so a check card
  ("no rows would be stored"), a "Judging the Flow" message, or other wording outside those windows was not reviewed.
- Whether the overlay's change of height is intended placement.
- Source code. Owners are inferred from where the text appears, not from lines I read.

## Open questions or contradictions found

- D1: the repair heading lists checks that held ("Coupon collected … verified") under "judged not to do what you
  asked". Either the heading composer chose the wrong list, or it is missing the failing part.
- The ending says the last fix "stopped before the Flow was ready, though the attempt before it had got that far",
  but the picture does not show why the build stopped (a call limit, a cost limit, or the no-progress rule).
