# Lane D candidate, worker W3: UI review of run `run-mv0fuual-f9e6f089`

Read-only review of the headed creation build "confirm friend requests with at least five mutual friends, then list
the accepted ones" (social-network-feed, candidate mode, 2026-10-09 04:06:53-04:11:47 UTC, failed with no Flow).

Paths: U = `test-runs/instances/t275-slot-4/run-mv0fuual-f9e6f089.ui-review.local/` (moment `NN`, capture times
from the sibling `.json`, `takenAt`); RUN = `test-runs/instances/t275-slot-4/run-mv0fuual-f9e6f089/screenshots/`
(times from `review/timeline.json`). Overlay text below is the on-page overlay sampled every ~200 ms per moment.

## Outcome

Done. All 17 panel pictures, the scenario pictures at the popup moments (05, 08, 12, 13) and RUN screenshots
00001-00003, 00008, 00009, 00011, 00017, 00020, 00021 were looked at. The popup moment is finding 1.

## Capture times relevant to the popup

| Popup on screen (ledger) | Nearest pictures | What they caught |
| --- | --- | --- |
| 04:08:21-04:08:33 (trial 1, Jonas) | RUN 00009 04:08:23; U 07 04:08:34.8 | 00009: no popup visible yet, chat "Click · Confirm, Working on it"; U 07 is after the re-press |
| 04:08:44-04:08:57 (trial 1, Freya) | U 08 04:08:54.8; RUN 00011 04:08:53.5 | Popup visible in both |
| 04:10:15-04:10:29 (trial 2, Jonas) | U 12 04:10:14.8; RUN 00017 04:10:24.6 | U 12 is 1 s before it; RUN 00017 shows it |
| 04:10:40-04:10:52 (trial 2, Freya) | RUN 00018 04:10:39.7; U 14 04:10:54.8 | Before and after it; no picture during it |

## Findings

| # | Moment | Picture file | What it shows | Fix suggestion in plain words |
| --- | --- | --- | --- | --- |
| 1 | U 08 (04:08:54.8), RUN 00011 (04:08:53.5), RUN 00017 (04:10:24.6) | U `08-mid-build-scenario.png`, `08-mid-build-panel.png`; RUN `00011-e81f919e4bd9.jpg`, `00017-13a3d3b26816.jpg` | **The popup moment.** The page is greyed out behind Circleway's "You're going too fast" dialog ("You've been temporarily blocked from using it. You can try again in 0 seconds", OK / Try again), with Freya Holm's Confirm button outlined. The chat shows a red card "Click · Confirm / Didn't work: the page was busy", then "Trying the step again: The step didn't work, and a step like this often works on a second try, so FluxIQ is trying it once more", and the status "Testing your Flow, Step 8 of 9: The page was busy, trying again". The page overlay says "Testing your Flow, Step 8 of 9: A step didn't work in the test: the…" (cut off in U 08 and RUN 00011; in full, "…the page was busy", in RUN 00017). Nothing in the chat or the overlay says that the site asked FluxIQ to slow down, that the run is waiting on purpose, for how long, or that FluxIQ will close the notice itself. "Page was busy" and "often works on a second try" describe a different problem. In U 08 the site's own countdown already reads 0 seconds, but the runtime does not press again until 04:08:57.2 (about 3 s later; the refused press was at 04:08:44.1). For those seconds the person watches a dialog that says they may try again while nothing happens. | Make the slow-down its own message, not a failure. Chat card: "Circleway asked us to slow down ('You're going too fast'). Waiting 6 s, then closing the notice and confirming Freya Holm again", with a countdown, and the card turns to "Done after waiting" when the re-press works. Overlay: "Site asked to slow down, waiting 6 s…", short enough that it is never cut off. Show it amber, not red. Close the site's notice as soon as its countdown ends rather than seconds later. Have later presses in the same repeat keep a gap, so the 7th row does not hit the limit again, and say so ("Slowing down between requests"). |
| 2 | U 06, 07, 08, 09, 12, 13, 14, 15 | U `06-…-panel.png` to `15-…-panel.png` | **Confirm cards never name the row.** Each repeat pass draws "Click · Confirm / Done", "Wait / Done", "Repeat / Done" with no person's name. The refused press and its retry (U 08, U 13, U 14) are "Click · Confirm / Didn't work: the page was busy" followed by a separate "Click · Confirm / Done", so you cannot tell that both cards are Jonas Weber, or that the later refused one is Freya Holm. | Put the row in the card: "Confirm · Jonas Weber (Aisha Khan and 4 other mutual friends)". Show the retry on the same card ("Done on 2nd try, after the site's slow-down") instead of a red card followed by a green one. Collapse each repeat pass into one line per row ("Row 4 of 8: Jonas Weber, confirmed"). |
| 3 | RUN 00008 (04:08:08), U 05, U 11, scenario U 08/12/13 | RUN `00008-b1b5948601b7.jpg`; U `05-mid-build-panel.png`, `11-mid-build-panel.png`, `08-mid-build-scenario.png` | **The "close the chat" step.** Trial 1 shows "Click · Close / Done", "Click · Not now / Done", then "Click · I … the gazebo if you need it / Working on it", with the status "Running step 4 of 9: Clicking 'I can bring the gazebo if you need it'". In other words, FluxIQ visibly clicks a chat message. The Elena Sokolova chat box is still open at the bottom right in U 08, 12 and 13, so nothing closed it. In trial 2 (U 11) the overlay says "Skipped 'Close': it was not shown". | A step meant to close a chat box must target the box's close (X) button, not message text. If the card's control turns out to be message text, say so plainly ("This clicks a message in the chat, not its close button"). Name the step after its purpose: "Close the chat box (if open)". |
| 4 | U 16, U 17, RUN 00021 | U `16-mid-build-panel.png`, `17-failure-panel.png`; RUN `00021-fec134c89d20.jpg` | **End of the build.** The final message: "'Create an automation here' stopped because the build failed: it kept trying without getting any further, so it was stopped. I kept the latest version of the Flow's steps that I wrote as a draft, but nothing was put into the Flow. A version of it was test-run from the start twice, and the last test run was judged not to do what you asked. The Flow 'Go through my friend requests and confirm everyone I have at least five...' keeps your instruction…". The overlay says "Build failed". There are no internal codes, and the Flow name is cut at a word ("five..."). But (a) "Create an automation here" is a generic label, not the person's task. (b) It never says what the test runs did on the real site: both trials confirmed all eight requests, including Tom Becker (1), Priya Nair (4), Diego Alvarez (none) and Marta Kowalczyk (3), which should have been left alone. (c) It never says why it got stuck: the step that keeps only rows with 5 or more mutual friends could not be written. | Name the task by its own words. Add a line on what changed on the site: "While testing, FluxIQ confirmed all 8 requests, including 4 you wanted left alone (Tom Becker, Priya Nair, Diego Alvarez, Marta Kowalczyk). You may want to undo those." Say the blocker in plain words: "I couldn't write the step that keeps only requests with 5 or more mutual friends." |
| 5 | U 16 / RUN 00021 (and the refusals above them) | U `16-mid-build-panel.png`; RUN `00021-fec134c89d20.jpg` | **Refused submissions.** Each one reads "Saving the Flow's steps: Submitting a corrected Flow that filters requests to five or more mutual friends…", then "Change the Flow / Not done: some steps weren't written in a way the Flow can run". This is plain and has no codes. But the three refusals look identical and say nothing about what was wrong (comparison not allowed, list not connected, wrong input name). "Fixing your Flow" did not appear anywhere. | Give each refusal one specific plain reason: "The filter step used a comparison it doesn't support ('at least'); retrying with 'greater than 4'." When the same refusal repeats, say "Same problem again (2nd time)". |
| 6 | U 10, U 11 | U `10-mid-build-panel.png`, `11-mid-build-panel.png` | **Narration claims what the Flow does not do.** "Submitting a corrected Flow that confirms only requests with at least five mutual friends…" (U 10), and "Testing, which now confirms only requests with 5+ mutual friends" (U 11). The trial-2 Flow still confirmed all eight. U 10 also shows "…since the earlier handle was refused" (an internal word). Both "Change the Flow" cards read identically: "Done: the steps were accepted". | Have the save card say what the saved draft actually does, from the steps themselves ("Repeats Confirm over all 8 rows; no filter"), not the model's intention. Replace "handle" with plain words. Use "Draft saved" rather than "Change the Flow" in a creation build. |
| 7 | U 15 | U `15-mid-build-panel.png` | **Check result card**: "Didn't pass: 11 rows came back, but the table holds only Amara Osei, Lin Zhao, Freya Holm". "11 rows" does not match the eight requests the person can see, and the card does not say what was expected. | Say it in the person's terms: "Expected only the requests with 5 or more mutual friends confirmed; the test confirmed all 8, and the table listed 3." |
| 8 | U 01, U 16, U 17, RUN 00001; U 02-15 for contrast | U `01-start-panel.png`, `16-mid-build-panel.png`, `17-failure-panel.png`; RUN `00001-69ebd4c09f3d.jpg` | **The idle record button is red.** The top-bar record icon is a red ring with a red dot whenever nothing is recording: before the send (U 01, RUN 00001) and after the build ended (U 16, U 17). During the build (U 02-15) it is grey. So it looks like a recording light exactly when it is idle, which confirms the user's point. | Make the idle record button grey or outlined, and turn it red (ideally pulsing) only while recording. |
| 9 | U 08 vs RUN 00017; U 05 overlay; RUN 00008 | U `08-mid-build-scenario.png`; RUN `00017-…jpg`, `00008-…jpg` | **The overlay cuts its text short.** "A step didn't work in the test: the…", "Running step 9 of 9: Waiting for the…", "Running step 4 of 9: Clicking…", "The test failed: the Flow didn't do…" (U 09, U 15 overlay samples). The same overlay showed the full sentence when it grew wider (RUN 00017). The cuts fall between words, never mid-word. | Keep the overlay line short enough to fit ("Waiting for the page", "Clicking 'Confirm' for Jonas Weber"), or let it wrap to two lines. |
| 10 | U 03 | U `03-mid-build-panel.png` | Exploration cards: "Open page · friends / Didn't work: the step wasn't accepted" (no reason given), and two cards that say only "Click" with no control named ("Didn't work: a popup or banner on the page was covering it", "Working on it"). | Name the control on every Click card. Give the reason a step wasn't accepted in one plain phrase. |
| 11 | U 05, U 11 | U `05-mid-build-panel.png`, `11-mid-build-panel.png` | The "Test run" card has a grey icon and no status line at all, while the step cards under it show Done / Working on it. Otherwise "Testing the whole Flow from the start" is clear. | Give the Test run card a status ("Running, step 2 of 9", then "Didn't pass" or "Passed") so it carries the trial's result. |
| 12 | RUN 00009 (04:08:23) | RUN `00009-d63f97330f83.jpg` | Overlay "Step 9 of 9: Waiting for the…" while the chat says "Step 8 of 9: Clicking 'Confirm'". Within a repeat, the two step counters disagree for a moment (repeat steps 8 and 9 alternate). | Low priority: show the repeat's progress ("Row 4 of 8") rather than a step number that jumps between 8 and 9. |

## Checkpoints that passed

| Checkpoint | Moments | Result |
| --- | --- | --- |
| No previous thread at start | U 01 ("Loading the conversation…"), RUN 00001, 00002 | Pass: only the new instruction is shown after the send |
| "Starting…" from the send | RUN 00002 (04:06:54.9), RUN 00003 | Pass: "Starting…" appears under the instruction, before the reply |
| "Testing your Flow" during trials | U 05-08, U 11-14 (chat and overlay) | Pass; "Building your Flow" between trials (U 09, 10, 15) |
| Chat tab selected | U 01-17 | Pass: "Chat" is highlighted in every panel picture |
| No "Fixing your Flow" in a creation build | All panel moments viewed | Not seen |
| No "Reading your instruction gave no answer for ..." | All panel moments viewed | Not seen |
| No internal codes in the chat | All panel moments viewed | None seen, apart from the word "handle" (finding 6) |
| List names never cut mid-word | U 04 ("Look · the repeating list on the page"), U 16 Flow name | Pass: the Flow name is cut at a word boundary; "Read list" cards carry no list name at all |

## Commands run and observed results

- `grep` of the brief's two sections in `lane-d-candidate.md`: they were read (lines 84-88 and 124-160).
- `node` read of `run-mv0fuual-f9e6f089.ui-review.local.json`: listed 17 moment capture times and the overlay text
  changes quoted above, for example moment 8 at 04:08:54.760 "Testing your Flow | Step 8 of 9 | A step didn't work
  in the test: the…".
- `node` read of `review/timeline.json`: mapped RUN screenshots to times (00009 04:08:23, 00011 04:08:53, 00017
  04:10:24, 00021 04:11:22).
- Pictures opened with the Read tool, as listed under Outcome.

## Not verified

- No picture during the 04:08:21-33 or 04:10:40-52 popups. RUN 00009, 04:08:23, shows no dialog, so either the
  dialog appeared slightly later than the ledger time or the screenshot was taken just before it.
- The overlay sampler got no answer from the page from 04:10:16.0 to 04:10:21.5 (moment 12: `hostCount 0`,
  `documentVisibility` missing), while the popup was up. RUN 00017 at 04:10:24.6 shows the overlay visible, so this
  is probably the probe failing rather than the overlay vanishing. It is not proven.
- The chat text above each panel's scroll position was not seen, including all three refused-submission cards
  together. Only the last refusal and the one above it are visible in U 16 and RUN 00021.
- Why the gazebo control was chosen (W2 traces it). The panel text was not checked against DOM text, only against
  pictures.

## Open questions or contradictions found

- The ledger says the "close the chat" step acted on the gazebo message in both trials. Trial 2's overlay (U 11,
  04:09:55.8) says "Skipped 'Close': it was not shown", and step 4 of trial 2 was not captured. So whether trial 2
  clicked the gazebo message is not visible in the UI evidence.
- In U 08 the site's dialog says "You can try again in 0 seconds" about 3 s before the runtime pressed again. The
  named wait (5500 ms) had ended at about 04:08:49.6, so the runtime waited 7-8 s longer than it said it would.
