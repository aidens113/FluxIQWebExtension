# r4-d-ui-review: lane D round 4 UI review (run-muxky54f-fadb9d03)

## Outcome

Done. All 36 pictures (18 panel, 18 scenario) were opened and the overlay samples in
`run-muxky54f-fadb9d03.ui-review.local.json` were read per moment. Scenario: social-network-feed
(path `/scenarios/social-network-feed/`, then `/friends/`, then `/friends/requests/`).

## What changed and why

Nothing in source. This report is the only file written.

## Per-moment review

| # | Label | Panel (quoted) | Overlay (picture plus json samples) | Checklist |
| --- | --- | --- | --- | --- |
| 1 | start | The previous build's ending is still shown: "...this time the judge found: "s8 kept only Amara Osei ... the confirm loop s11 therefore ran on ..." ... "Fix s8's where ... and fix s13 so..."" ... "has a step that ran, or could run, when the Flow (8 steps) was run". No "Starting…" card in the picture. | Picture: no overlay (taken 0-138 ms, before it appeared). json: absent 0-806 ms, then "Starting…" (806-2414 ms), then "Building your Flow". | NOT FIXED: old thread at start, with "s8", "s11", "s13", "the judge", "where", "ran, or could run". FIXED (page only): "Starting…" on the overlay. |
| 2 | mid-build | User request bubble; "I'll make you a new automation for this ..."; card "Open page · Working on it"; status "Building your Flow". | "Building your Flow" (then "Opening where the Flow starts"). | "Starting…" not seen in the panel (already past it 3 s later; cannot confirm either way). Fresh thread ("Latest chat / Project chat") once the build starts. |
| 3 | mid-build | "Open page · friends — Didn't work: the step wasn't accepted"; "Clicking "Not now" — Dismissing the notifications dialog..."; "Click · Friends Done". | "Building your Flow / Clicking "Friends"". | NEW: failure card "the step wasn't accepted" gives no reason. |
| 4 | mid-build | "Read list · name and mutual — Done: 8 rows from 1 page"; "Done: 4 rows from 1 page"; thought "I'll read the full friend-requests list with a where keeping only 5+ mutual friends, then confirm one kept row and repeat over the list." | "Reading the list of "name and mutual"". | FIXED: build read cards "Done: N rows from M pages". NOT FIXED: list name cut inside a word: "name and mutual" for the field mutualFriends (same list reads "name and mutualFriends" from moment 9). NOT FIXED: internal word "a where". |
| 5 | mid-build | "Testing the Flow so far — The build stopped before the Flow was finished: too many attempts in a row went nowhere, because it kept asking to run steps again exactly as they had already run ..."; "Reading your instruction gave no answer for "confirm everyone I have at least five mutual friends with, and leave every other request as it is", so the build's tests check the step that does it rather than do it again."; "Testing: Open page · the start page". | "Trying the Flow from the start…" then "...: clicking…". | NEW: the "Reading your instruction gave no answer for ..." sentence is unintelligible to a user. NEW (wording): "The build stopped before the Flow was finished" appears mid-build while the build carries on. |
| 6 | mid-build | "Testing: Read list · name and mutual — Done: 8 rows"; "Testing: Click · Close ... · Tom Becker — Already done on the site"; "Testing: Click · Close ... · Amara Osei — Working on it". | "Trying the Flow from the start: clicking…". | NEW: card label cut to "Close ..." when it is only "Close chat" (status line spells it out). Product note: the per-row loop clicks "Close chat" for each request, not Confirm (Flow content, not UI). |
| 7 | mid-build | Cards "Close ... · Priya Nair", "Close ... · Jonas Weber", "Close ... Diego Alvarez" (separator lost), all "Already done on the site". | Same overlay text. | NEW: inconsistent label cuts. Eight per-row "Already done on the site" cards are each a different row, so no fold expected. |
| 8 | mid-build | "Close chat · Lin Zhao" (whole), "Close ... · Freya Holm", "Close chat ... Kowalczyk" (first name dropped). | "...clicking…" then "Judging the Flow", "Checking the result answers the request". | NEW: a person's name cut ("... Kowalczyk"); the same label is cut on some rows and not on others. |
| 9 | mid-build | "Look · the repeating list on the page Done"; "Edit the Flow — Done: made "Close chat" repeat over "name and mutual""; "Read list · name and mutualFriends — Done: 4 rows from 1 page"; "Click · Confirm Working on it". | "Fixing your Flow / Trying again: clicking "Confirm"". | Two-field name now whole ("name and mutualFriends"), so it is inconsistent with moments 4-6. Overlay heading becomes "Fixing your Flow" during a creation build (see new defects). |
| 10 | mid-build | "Testing: Open page · the start page Done"; "Testing: Click · Decline ... cookies — Already done on the site"; "Not now"; "Friends"; "Friend requests Working on it". | json "flickering": "clicking…" > "reading…" > "clicking…" in 3 s (1 text revisit). | NEW: "Decline ... cookies" middle cut on a short label. |
| 11 | mid-build | "Testing: Click · Confirm · Jonas Weber — Checked, not pressed" (also Lin Zhao, Freya Holm); "Testing: Read list · name and mutualFriends Done: 8 rows"; "Judging the Flow — The Flow was tested from its start. Judging what the test did against what you asked."; "Check result Working on it". | json "flickering": 4 texts in 3 s ("Checking the result..." > "Repairing the Flow" > "Looking over the page the Flow starts…" > "Looking over the whole page", the last two 200 ms apart). | FIXED: per-row Confirm said as "Checked, not pressed" (heading still "Testing: Click"). NOT FIXED here: this "Judging the Flow" does not say how many steps ran (moment 15's does). |
| 12 | mid-build | "Changing the Flow — I will fix the final read so it keeps only accepted requests and captures the accepted status, then re-verify the confirm loop."; "Read list · name, mutualFriends and status — Done: 8 rows from 1 page"; heading "Looking over the whole page" above a Read list card. | "Trying again: reading the list of…". | Three-field name shown whole. NOT FIXED: "confirm loop" (internal). Heading "Looking over the whole page" does not match its Read list card. |
| 13 | mid-build | "Changing the Flow — Fixing the final read ... adding the confirm loop over requests with 5+ mutual friends."; "Edit the Flow — Done: made "Confirm" repeat over "name and mutualFriends""; "Edit the Flow · run the step again — Not done: that step was already tried exactly this way on this same page, and trying it again would end the same way". | "Updating the Flow — that didn't work…" then "Testing the Flow so far"; one page load, overlay stayed. | Refusal shown once (no fold needed in view). NEW: the card title "Edit the Flow · run the step again" is internal phrasing. |
| 14 | mid-build | Testing cards "Not now", "Friends", "Friend requests" Done; "Testing: Read list · name and mutualFriends Done: 4 rows"; "Confirm · Amara Osei Working on it". | "Trying the Flow from the start: clicking…". | No issues beyond the ones above. |
| 15 | mid-build | "Testing: Read list · name, mutualFriends and status Done: 1 row"; "Judging the Flow — The test ran 7 of the Flow's 8 steps from its start; 1 was only checked, not run."; "Check result — Didn't pass: 5 rows would be stored, but a step kept only Amara Osei by filtering status absent, which selects rows with no status text rather than rows shown as accepted"; "Repairing the Flow — ... Step 6 kept Amara Osei, Jonas Weber, Lin Zhao, Freya Holm, rejecting Tom Becker, ... Repairing it live." | "Looking over the page the Flow starts…" > "Doing an earlier step again first…" > "Checking an earlier step is still done…". | FIXED: "Judging the Flow" gives the step count. FIXED: repair heading has no step number. FIXED: the failed check says what it objected to. NOT FIXED: "Step 6" in the body; "filtering status absent" is internal. |
| 16 | mid-build | Same as moment 14 (rerun, "Confirm · Amara Osei Working on it"). | "Trying the Flow from the start: clicking…". | none |
| 17 | mid-build | "Confirm · Amara Osei — Already done on the site"; "Jonas Weber / Lin Zhao / Freya Holm — Checked, not pressed"; "Read list · name, mutualFriends and status Done: 8 rows"; "Check result Working on it". | "Checking the result..." > "The result doesn't answer the request" > "Build failed / Build stopped: a budget ran out". | FIXED: checked, not pressed. |
| 18 | failure | "Check result — Didn't pass: 12 rows would be stored, but a step filter kept Amara Osei, Jonas Weber, Lin Zhao, Freya Holm"; ending: "The build stopped at its limit of 48 model calls before the Flow was finished. The one thing you asked has a step that was only checked, not run, when the Flow (8 steps) was run from its start, but the Flow was judged not to do what you asked. I worked on it live 4 times ... The steps I found so far were kept as a draft ... The Flow "Go through my friend requests and confirm everyone I have at least five..." keeps your instruction." | "Build failed / Build stopped: a budget ran out". | FIXED: says why it stopped (48-call limit). FIXED: no "ran, or could run". FIXED: no "Couldn't fix your Flow". PARTLY: what is left undone is only "judged not to do what you asked", with no plain statement of what is wrong. NEW: the check objection does not say what is wrong ("12 rows would be stored, but a step filter kept" the 4 correct people); "step filter" is internal. NEW: overlay "a budget ran out" does not say which budget (the panel does). |

## Seen fixed

- "Starting…" on the page overlay (moment 1, json samples 806-2414 ms).
- Build read cards "Done: 8 rows from 1 page" / "Done: 4 rows from 1 page" (moments 4, 9, 12).
- Three-field list name shown whole: "name, mutualFriends and status" (moments 12, 15, 17).
- "Judging the Flow — The test ran 7 of the Flow's 8 steps from its start; 1 was only checked, not run." (moment 15).
- Repair heading "Repairing the Flow" has no step number (moment 15).
- A failed check says what it objected to: "Didn't pass: 5 rows would be stored, but a step kept only Amara Osei by filtering status absent..." (moment 15).
- Per-row Confirm said as "Checked, not pressed" (moments 11, 17).
- The ending says why it stopped: "The build stopped at its limit of 48 model calls" (moment 18); no "ran, or could run"; no "Couldn't fix your Flow".
- No thought seen ending on ";"; no "reading the list handle"; no quote cut inside a word in the overlay ("…" cuts fall between words).

## Not fixed

- Previous build's thread at start, moment 1: "the judge found: "s8 kept only Amara Osei ...", "the confirm loop s11", "fix s13 so...", "has a step that ran, or could run".
- Two-field list name cut inside a word, moments 4-6 and 9: "Read list · name and mutual", "Reading the list of "name and mutual"", "made "Close chat" repeat over "name and mutual"" (field is mutualFriends).
- "Judging the Flow" without a step count, moment 11: "The Flow was tested from its start. Judging what the test did against what you asked."
- Internal words in thoughts and cards: "with a where keeping only 5+ mutual friends" (4); "re-verify the confirm loop" (12), "adding the confirm loop" (13); "Step 6 kept Amara Osei, ..." (15); "by filtering status absent" (15); "a step filter kept" (18).
- The ending does not say what was left undone in plain words, moment 18: "has a step that was only checked, not run ... but the Flow was judged not to do what you asked".
- Not seen at all in the 18 pictures, so unconfirmed: "Starting…" in the panel; the "(N times)" fold; "Added to the Flow, not run yet"; a partly done edit card.

## New defects

1. Card target labels cut in the middle when short or uneven: "Close ... · Tom Becker", "Close ... Diego Alvarez" (separator lost), "Close chat ... Kowalczyk" (first name dropped), "Decline ... cookies" (moments 6-10). Owner: panel tool-card label truncation (exact file unknown).
2. Unintelligible note, moment 5: "Reading your instruction gave no answer for "confirm everyone ...", so the build's tests check the step that does it rather than do it again." Owner unknown (build narration of the instruction-coverage check).
3. Mid-build text says the build stopped while it continues, moment 5: "Testing the Flow so far — The build stopped before the Flow was finished: too many attempts in a row went nowhere ...". Owner unknown (no-progress fallback narration).
4. Failure card without a reason, moment 3: "Open page · friends — Didn't work: the step wasn't accepted". Owner unknown.
5. Card title with internal phrasing, moment 13: "Edit the Flow · run the step again". Owner unknown (refusal card for a repeated call).
6. Moment 18's check objection does not say what is wrong: "12 rows would be stored, but a step filter kept Amara Osei, Jonas Weber, Lin Zhao, Freya Holm" (those four are the people with 5+ mutual friends). Owner unknown (judge-verdict summariser).
7. Heading does not match its card, moment 12: "Looking over the whole page" above a "Read list" card. Owner unknown.
8. The overlay says "Fixing your Flow" during a creation build from moment 9 on, and the final overlay "Build stopped: a budget ran out" does not say which budget. Owner: the content-script overlay phase text (exact file unknown).
9. Product, not UI: the first per-row loop clicked "Close chat" on every request ("made "Close chat" repeat over "name and mutual"", moments 6-9), and each was reported "Already done on the site".

## Overlay visibility (json)

- Visible in 284 of 288 samples. The 4 misses are moment 1, 0-806 ms, before the send created the overlay.
- Flickering moments: 10 (text revisit "clicking…" > "reading…" > "clicking…") and 11 (4 texts in 3 s, the last two 200 ms apart). No presence or visibility toggles after moment 1.
- Page loads: 3 (moments 1, 2, 13); load gaps 0; probable loads 0. The overlay was never lost across a page load.
- Every scenario picture from moment 2 on shows the overlay; moment 1's picture predates it.

## Commands run and observed results

- `ls` of the picture directory: 36 png files (01-18, panel and scenario).
- `node` summaries of the json: per-moment counts as above; total visible 284/288.
- Read tool on all 36 pictures.

## Not verified

- "Starting…" in the panel: no panel picture falls in the window when it showed.
- The "(N times)" fold, "Added to the Flow, not run yet", a partly done edit card: none appear in any picture.
- Text scrolled out of view in each panel picture (only the visible part of the thread was reviewed).
- Owning files: not looked up (read-only brief, pictures only).

## Open questions or contradictions found

- Moment 15: the check says "a step kept only Amara Osei", while the repair text says "Step 6 kept Amara Osei, Jonas Weber, Lin Zhao, Freya Holm". They may describe different steps, but read together they contradict each other.
- Moment 18: the check fails although the kept set (Amara Osei, Jonas Weber, Lin Zhao, Freya Holm) looks correct for "at least five mutual friends". The objection is probably the 12 stored rows, which the card does not say.
