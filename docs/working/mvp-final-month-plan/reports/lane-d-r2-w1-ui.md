# Lane D round 2 — UI review of run-mv0pcfaf-cd251bdc

Base: `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/test-runs/instances/t275-slot-4/run-mv0pcfaf-cd251bdc.ui-review.local/`
(pictures below are relative to it). Scenario: social-network-feed (Circleway). Chrome side panel.

## Outcome

Done. All 14 pictures and the ui-review json were read. Checkpoints: 1 fail, 2 partial, 3 pass,
4 fail, 5 partial (the refusal card was never on screen at any captured moment), 6 partial,
7 pass for cut text but fail for flicker and the overlay going dark, 8 several findings.

## Moments

| # | Moment | What is shown | Findings |
| --- | --- | --- | --- |
| 1 | start (08:30:20) | Panel: header (Chat, Automations, record ring, green dot, gear, pop-out), empty body "Loading the conversation...", composer "Message FluxIQ". Page: Circleway home with a cookie dialog ("Allow the use of cookies from Circleway on this browser?"). Overlay absent for 3 s, then the probes time out ("the overlay's state did not answer within 1000 ms", "the overlay host did not answer within 1000 ms"); about 7 s in, "Building your Flow / Opening where the Flow starts". | No onboarding, no "Starting..." and no sent message: the panel is still on "Loading the conversation..." while the build is already running (F1). Record button grey ring, so it passes. |
| 2 | mid-build (08:30:33) | Panel: "< Latest chat" / "Project chat"; the person's instruction bubble; the assistant says "I'll make you a new automation for this ... I'll say here when it is ready, or why it is not."; card "Open page · Working on it"; status "Building your Flow / Opening where the Flow starts"; "Stop build" button. Record icon is greyed out. Page: cookie dialog still there; the overlay pill at bottom left. | Stop build is present. Take over / Hand back are not on screen (F2). Overlay present at 0 ms, gone from 202 ms, the probes time out, then back at 5.8 s: json says "flickering", 2 presence toggles (F7). |
| 3 | mid-build (08:30:46) | Panel cards: "Click · Decline optional cookies · Done"; heading "Opening “friends” — Opening the Friends page to find the friend requests list and its mutual-friends counts." with card "Open page · friends · Didn't work: the step wasn't accepted"; heading "Clicking “Friends” —" with the same reason text and card "Click · Friends · Didn't work: a popup or banner on the page was covering it". Page: a "Turn on notifications?" dialog ("Not now" / "Turn on"). Overlay: "Opening “friends” — not tried" -> "Clicking “Friends”" -> "Clicking “Friends” — not tried: a popup or banner on the page was covering it". | Bare "Click" kind on cards (F3). "Open page · friends" shows a raw lowercase target, and "the step wasn't accepted" gives no reason (F4). The same reason sentence is shown under two different steps (F5). |
| 4 | mid-build (08:31:05) | Panel: "Clicking “Close chat” — Closing the chat dialog that covers the friend requests list, then reading the requests to plan the confirmations."; "Click · Close chat · Done"; "Look · the ... around "Friend requests" · Done"; "Looking for the repeating list on the page — Detecting the friend requests list structure ..."; "Look · the repeating list on the page · Done". Page: Friends page, Friend requests (Tom Becker 1 mutual, Amara Osei 23, Priya Nair 4, Jonas Weber "Aisha Khan and 4 other mutual friends") with Confirm / Delete. Overlay: "Looking for the repeating list on the page", absent at 1.2 s, then "Clicking “See all”". | Bare "Click" again (F3). Elided label "the ... around "Friend requests"" (F6). The overlay drops out at 1.2 s across a page load. |
| 5 | mid-build (08:31:25) | Panel: "Read list · name, mutual and confirm · Done: 8 rows from 1 page"; "Reading the list of “name, mutual and confirm” — This is exactly the step it had already tried, so it was not done again."; card "Read list · ... · Not done: it was already tried exactly this way and changed nothing"; "Looking again at what “extract requests 1” found — Reading the full friend-requests list ..."; "Recall result · extract requests 1 · Done". Page: the full request grid, 8 cards (Diego Alvarez's mutual-friends box is empty). Overlay: "Looking again at what “extract requests 1” found" -> "Saving the Flow's steps". | Internal handle-style label "extract requests 1" in the panel and the overlay (F8). The raw field keys "name, mutual and confirm" are shown as the list's name (F9). |
| 6 | mid-build (08:31:45) | Panel: two resubmission cards, each headed "Saving the Flow's steps — This is the same Flow it had already sent, unchanged, so it was not checked again.", card "Change the Flow · Not done: the same Flow was sent again unchanged, so it was not checked again." Then the ending: "The build failed: the Flow it wrote was refused because the step 'read the accepted requests' points at something that wasn't seen on the page, and then it was sent again unchanged 4 times, so nothing was tested. The Flow "Go through my friend requests and confirm everyone I have at least five..." has no steps yet, but it keeps your instruction, so you can build it again." Stop build is gone. Overlay: "Build failed" (stable). | Resubmission wording passes. The heading "Saving the Flow's steps" and the card title "Change the Flow" are wrong for a resend (F10). The ending's cause is imprecise (F11). |
| 7 | failure (08:31:48) | Same as moment 6, panel and page. Overlay "Build failed". | Chat tab active. No "Create an automation here", no "kept trying without getting any further". The refusal card itself is scrolled off and was never captured (F12). |

## Checkpoints

1. **Onboarding, no previous thread, "Starting..."**: FAIL / not observable. 01-start-panel.png shows only "Loading the conversation..." (no t376 onboarding, no thread, no "Starting..."), although the overlay shows the build already started. At moment 2 the conversation holds only this run's instruction, so no previous thread leaked.
2. **Stop and Take over / Hand back**: PARTIAL. "Stop build" is present at moments 2–5 (02/03/04/05-mid-build-panel.png). No Take over or Hand back control at any moment.
3. **Record button neutral when idle**: PASS. It is a grey ring at moment 1 and greyed out (disabled) during the build at moments 2–7. It is never red.
4. **Cards name control and kind, no internal codes**: FAIL. Cards read "Click · Friends", "Click · Close chat", "Click · Decline optional cookies" (03, 04). "extract requests 1" is on screen (05 panel and overlay). No literal `t123` or `extraction.3` is shown.
5. **Refusal card names step, line and count; resubmission wording**: PARTIAL. The resubmission cards say "Not done: the same Flow was sent again unchanged, so it was not checked again." (06), which matches the intent. The first refusal card is not in any picture (it sits between moments 5 and 6, scrolled off), so its naming of step, line and count is unverified. Run data: step "read the accepted requests", label "accepted", line 27, `web.handle.unknown_field:extractList.where.0` against `extraction.3`.
6. **Ending message**: PARTIAL. It names the step ('read the accepted requests') and the resend count (4), does not quote "Create an automation here", and does not claim "kept trying without getting any further". The Chat tab is shown. But the cause "points at something that wasn't seen on the page" is not the truth in the person's terms: the refusal is that the read's filter (`where`) names a field the earlier list read (the 8-row "name, mutual and confirm" read) does not have. It names neither that field nor line 27.
7. **Overlay**: No cut "the..." sentences in the overlay (its texts are complete). FLICKER confirmed at moment 2: present at 0 ms, absent from 202 ms, the probes time out ("the overlay host did not answer within 1000 ms"), back at 5.8 s. Moment 1 has the same timeouts, and moment 4 drops out once at 1.2 s across a page load.
8. **Misleading, raw, not in the person's terms**: see F4–F6 and F8–F11.

## Findings

- **F1. The start shows no conversation.** 01-start-panel.png shows "Loading the conversation..." while the build has started (the overlay reads "Building your Flow" at 6.9 s). There is no onboarding, no sent bubble and no "Starting...". Likely owner: the side-panel chat thread loading or bootstrap.
- **F2. No Take over / Hand back during the build.** 02–05-mid-build-panel.png show only "Stop build".
- **F3. Bare "Click" kind on exploration cards.** 03-mid-build-panel.png: "Click · Friends", "Click · Decline optional cookies". 04-mid-build-panel.png: "Click · Close chat". The card should say press, choose or type. Likely owner: the chat tool-card label mapping for click actions.
- **F4. Raw target and an empty reason.** 03-mid-build-panel.png: "Open page · friends" (lowercase, a raw argument) with "Didn't work: the step wasn't accepted". The person is not told why. The overlay said "Opening “friends” — not tried".
- **F5. A duplicated reason under two different steps.** 03-mid-build-panel.png: "Opening “friends” — Opening the Friends page to find the friend requests list and its mutual-friends counts." and "Clicking “Friends” — " followed by the same sentence.
- **F6. An elided card label.** 04-mid-build-panel.png: "Look · the ... around "Friend requests"". The "..." reads as a cut phrase.
- **F7. The overlay flickers and goes dark.** 02-mid-build-scenario.png and the json moment 2: status "flickering", presenceToggles 2, with errors "the overlay's state did not answer within 1000 ms" and "the overlay host did not answer within 1000 ms". The same timeouts occur at moment 1. Likely owner: the content-script activity overlay host.
- **F8. Internal handle-style name on screen.** 05-mid-build-panel.png and the overlay: "Looking again at what “extract requests 1” found" and "Recall result · extract requests 1". This is a generated read id, not the person's words.
- **F9. Raw field keys as the list name.** 05-mid-build-panel.png: "Read list · name, mutual and confirm" and "Reading the list of “name, mutual and confirm”". These are column keys.
- **F10. Wrong headings on resent submissions.** 06-mid-build-panel.png: the heading "Saving the Flow's steps" and the card title "Change the Flow" sit over "Not done: the same Flow was sent again unchanged". Nothing was saved or changed.
- **F11. The ending's cause is imprecise.** 06/07-failure-panel.png: "points at something that wasn't seen on the page". The real refusal (steps/0038) is `web.handle.unknown_field:extractList.where.0` on step "read the accepted requests", line 27: the filter names a field that list read does not have. The message names no field and no line. Likely owner: the build-failure ending composer that maps `web.handle.unknown_field`.
- **F12. The refusal card was never captured.** No moment shows the first refusal card, so checkpoint 5 is unverified for it. Moment 6 already shows only resends and the ending.
- **Note on the run.** The 05 "Read list ... Not done: it was already tried exactly this way and changed nothing" card is clear and in the person's terms. The page has Diego Alvarez with an empty mutual-friends box (05 scenario), which is relevant to the read but not a UI defect.

## Commands run and observed results

- `ls` of the ui-review dir: 14 PNGs (01–07, scenario and panel).
- A Python summary of the json's overlay samples per moment: the texts and toggles quoted above.
- A grep of the run dir (events.ndjson, steps/0038*): the ending text, issue codes `candidate.last_submission_refused:1`, `candidate.last_submission_sent_again:4`, `web.handle.unknown_field:line.27`, and refusal step "read the accepted requests", label "accepted", line 27, handle extraction.3.

## Not verified

- The first refusal card's wording (not captured).
- The exact field name the `where` clause used (not extracted).
- The source files that own each string (no code search, per the brief).

## Open questions or contradictions found

- The brief expects "Starting..." after the send, but moment 1 was captured during "Loading the conversation...", after the build had begun. Either the capture came before the panel caught up, or the panel never rendered the thread at that point.
