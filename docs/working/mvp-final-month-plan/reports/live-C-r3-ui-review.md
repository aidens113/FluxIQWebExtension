# Live lane C round 3 UI review: run-mux6naez-6c20f26e

Worker report, read-only analysis. Source: `test-runs/instances/t274-slot-1/run-mux6naez-6c20f26e.ui-review.local.json`
(26 moments, 26 panel and 26 scenario pictures, no skipped ticks, no capture failures). All 26 panel pictures were viewed,
plus the scenario pictures at 01, 02, 15, 16, 25 and 26. Each picture is taken at its moment's overlay start; the
moment's `at` is the end of its ~3 s overlay window (16 samples, ~200 ms apart). All times are UTC, 2026-10-06. The
step folders were used only for timings and the judges' `decision.json` summaries (steps 0001, 0022-0029, 0066-0081, 0150).

## Outcome

Done. Most t277 fixes hold: the panel says "Starting…" at send (R2-U-5), there is one list name everywhere (R2-U-8),
the look-up card reads "Look · how to read a list", and nothing says "wasn't on the page". There is no overlay gap on a
page load (R2-U-11). The ending is now one sentence with no purse arithmetic.

Three surfaces are still wrong or misleading:

1. **Check clause.** The check card now has the "N rows would be stored, but …" shape, but the clause after "but" is
   the judge's *observed* line ("10 rows stored with correct columns"), not the reason it failed. The card says nothing
   a person can use, and the real finding (three pairs sold with a charging case were dropped) never reaches it.
2. **Refutation and ending.** Core's result check refuted 13 stored rows. The oracle says those 13 rows are exactly
   right. The person is shown the check's objection as a garbled splice of product names. The run ends with "the check
   found they don't answer what you asked", and nothing suggests that the 13 rows may be correct.
3. **Repair loop as work.** About seven identical "Read list · name, price and 4 more / Done" cards stack up in each
   repair, with no counts. A new "Edit the Flow / Not done (2 times)" card appears each cycle. The re-author's
   headings repeat "steps 2, 4 and 5".

The second build test's cards are missing from the chat.

## Moments

| Moment | Overlay start (UTC) | Overlay status, loads/gaps | What the pictures show | Judged against the checkpoints |
| --- | --- | --- | --- | --- |
| 01 start | 21:23:37.65 | changed; 5/16 present; 1 page load (+1.0 s), 0 gaps. Absent until +2.2 s (21:23:39.86), then "Starting…" | Panel (21:23:37.89, before the send): the instruction bubble, then "I'll make you a new automation for this…" and "Your automation "Find every pair of wireless earbuds in the store's search results that is Bri..." is ready: I tried its steps on the page you had open and put the ones that worked into it."; composer empty; no "Latest chat" header. Scenario: store home with the cookie bar, no overlay. | R2-U-10 **still open** (as expected: earlier thread shown before the Lab selects the project). Overlay prompt: "Starting…" at 21:23:39.86, before the send's chat call (step 0001 at 21:23:40.65), so this is not a gap. |
| 02 mid-build | 21:23:40.68 | changed, 2 text changes; 16/16; 0 loads. "Starting…" → "Building your Flow" → "Building your Flow / Opening where the Flow starts" | Panel (21:23:40.86): "Latest chat / Project chat", instruction bubble, live line "Starting…", composer "Message FluxIQ" empty. Scenario: app banner; overlay "Starting…" top-left. | U-start **pass**; R2-U-5 **seen-fixed** ("Starting…" in the panel, no "Sending your message"). |
| 03 mid-build | 21:24:00.63 | stable; 16/16; 1 load, 0 gaps. "Building your Flow / Typing "wireless earbuds" into “Search Brightaisle”" | "Click · Decline / Done", "Clicking “Not now” — Dismissing the notification popup…", "Click · Not now / Done", "Typing "wireless earbuds" into “Search Brightaisle” — …", "Type · Search Brightaisle / Working on it". | U-words pass; overlay held over a load. |
| 04 mid-build | 21:24:20.64 | stable; 16/16; 1 load, 0 gaps. "Building your Flow / Reading the list of “name, price and 4 more”" | "Look · how to read a list / Done"; "Reading the list of “name, price and 4 more” — Reading the search results list with the detected reading the list handle to see the real rows and columns before adding the list reader."; "Read list · name, price and 4 more / Done"; second thought "…Reading all result pages with the list reader, filtering to Brightaisle Plus earbuds rated 4.0+ under $50, excluding sponsored and accessories."; "Read list · name, price and 4 more / Working on it". | R2-U-4 look-up card **seen-fixed** ("Look · how to read a list"). R2-U-8 **seen-fixed** (overlay and card both "name, price and 4 more"). New: "the detected reading the list handle" is ungrammatical and says "handle"; "list reader" sounds internal. U-read: a build read card shows a bare "Done" (no count). |
| 05 mid-build | 21:24:40.64 | changed, 2 changes; 16/16; 1 load, 0 gaps. "Trying the Flow from the start: clicking “Decline”" → "…typing "wireless…" → "…reading the list of…" | "Edit the Flow / Only partly done: that step is already in the Flow"; "Checking whether the Flow is finished — The list reader already keeps the right rows across all 5 pages;" (ends on ";"); "Testing: Open page · the start page / Done", "Testing: Click · Decline / Already done on the site", "Testing: Click · Not now / Already done on the site", "Testing: Type · "wireless earbuds" / Working on it"; live line "Trying the Flow from the start: clicking "Decline"". | U-tests pass for this test. U-status pass (cuts at "wireless…", "of…"). Thought cut at ";" (R2-U-3 variant). The live line is one step behind the cards (says clicking "Decline" while "Type" is working). |
| 06 mid-build | 21:25:00.65 | changed, 2 changes; 16/16; 0 loads. "Checking the result answers the request" → "The result doesn't answer the request" → "Fixing your Flow / Repairing the Flow" | "Testing: Read list · name, price and 4 more / Done: 10 rows"; "Judging the Flow — The Flow was tested from its start. Judging what the test did against what you asked."; "Check result / Working on it". | U-read pass for the test read ("Done: 10 rows"; no page count). R2-U-8 test card same name. |
| 07 mid-build | 21:25:20.66 | stable; 16/16. "Fixing your Flow / Trying again: reading the list of “name, price and 4…”" | "Check result / Didn't pass: 10 rows would be stored, but 10 rows stored with correct columns"; "Repairing the Flow — The Flow was tested from its start and judged not to do what you asked: 10 rows stored with correct columns. Repairing it live."; "Look · "wireless earbuds" / Done"; "Read list · name, price and 4 more / Working on it". | R2-U-1 **shape seen, substance still open**: never a bare "Didn't pass", but the clause after "but" is not a failure. It contradicts the verdict, and the judge's real finding (three earbuds sold with a charging case left out) is not shown here or in the repair heading. |
| 08 mid-build | 21:25:40.67 | changed, 1 change; 16/16. "Trying again: reading…" → "**Deciding the next step — didn't work**" | Same as 07 plus a second "Read list · … / Done". | U-status **fail**: the "Deciding the next step" wording returns, with "didn't work". This was a provider malformed response (steps 0041/0042), shown as a failed step. |
| 09 mid-build | 21:26:00.77 | stable; 16/16. "Trying again: reading the list of “name, price and 4…”" | Three "Read list · name, price and 4 more" cards (2 Done, 1 Working on it). | R2-U-7: successful reruns stack, one card each, bare "Done". |
| 10 mid-build | 21:26:20.78 | changed, 1 change; 1 load, 0 gaps. "Trying again…" → "Putting the page back to where the step starts" | Four "Read list … / Done"-type cards. | As 09. |
| 11 mid-build | 21:26:40.72 | **flickering** (1 revisit); 1 load, 0 gaps. "Trying again…" ↔ "Putting the page back to where the step starts" | "Look · "wireless earbuds"" then five "Read list · name, price and 4 more / Done". | Real alternation of work (rerun, reset, rerun), not a status flicker; noted. Stack grows. |
| 12 mid-build | 21:27:00.73 | changed, 1 change. "Putting the page back…" → "Trying again…" | Five "Read list … / Done"; "Changing the Flow — The name exclusion wrongly drops earbuds sold with a charging case;" (ends on ";"). | The real finding appears only here, cut at ";". R2-U-3 variant. |
| 13 mid-build | 21:27:20.73 | stable; 1 load, 0 gaps. "Fixing your Flow / Testing the Flow so far" | "Read list … / Done"; "Edit the Flow · run the step again / Not done (2 times): it was already tried exactly this way, and trying it again would end the same way"; "Testing the Flow so far — The build stopped before the Flow was finished: too many attempts in a row went nowhere, because it kept retrying things that had already failed or done nothing. Running the Flow as far as it got from its start, to judge what it does and what is left." | Refusals fold ("Not done (2 times)"). "kept retrying things that had already failed or done nothing" contradicts the stack of "Done" read cards above. The second build test had started (step 0067 at 21:27:19.85), but no "Testing:" card is shown. |
| 14 mid-build | 21:27:40.75 | changed, 1 change. "Judging the Flow" → "Checking the result answers the request" | "Testing the Flow so far — …"; "Judging the Flow — The Flow so far ran clean from its start. Judging what the test did against what you asked."; "Check result / Working on it". | U-tests **fail** for the second test: steps 0067-0072 (21:27:19.9-21:27:26.6) produced no "Testing:" cards between the two headings. |
| 15 before-flow-run | 21:27:48.87 | changed; 6/16 present; about:blank absent until +2.0 s, then "Running your Flow / Step 1 of 5 / Running step 1 of 5: Opening the start page" | Panel (21:27:49.01): "Check result / Passed: 13 rows would be stored. The result was judged to answer the request." Scenario: blank page (about:blank), no overlay. | Passing check card is clear. The overlay is absent only on about:blank before the playback's navigation (step 0075 at 21:27:50.73); it is present on the new document at 21:27:50.88, so this is not a gap. No "is ready"/proposed message is visible (may be off-picture). |
| 16 flow-run | 21:28:08.85 | changed; 15/16; 2 loads, 0 gaps. "Running your Flow / Step 5 of 5 / Running step 5 of 5: Reading the list"; last sample absent 11 ms into a new document | Panel: "Open page · the start page / Done", "Click · Decline / Done", "Click · Not now / Done", "Type · Search Brightaisle / Done", "Robot check / Done. The check cleared on its own after 9 s.", "Read list / Working on it"; live line "Running your Flow  Step 5 of 5". Scenario: results grid; overlay "Running your Flow / Step 5 of 5 / Running step 5 of 5: Reading the list". | U-run: step count right (5 steps; the robot check is a separate card, not counted); no merges shown. The playback read card shows no list name ("Read list" alone), unlike the build cards. The absent sample at 11 ms is under the 100 ms rule (R2-U-11 pass). |
| 17 flow-run | 21:28:28.96 | changed, 2 changes; 1 load, 0 gaps. "Fixing your Flow / The result doesn't answer the request" → "Looking over the page the Flow starts on — done" → "Putting the page back to where the step starts" | Top: check card (cut) "…stored, all rated 4.0+ and under $50, none sponsored, no accessory rows"; "Result repair started"; "Fixing the Flow so its result answers the request — 13 rows came back. The result was judged not to answer the request the Flow was built for, twice and with the same evidence. It looked for: … What it found: 13 rows stored, all rated 4.0+ and under $50, none sponsored, no accessory rows. Wireless Charging Case, Ear Hooks for Running, Midnight Blue and Pulsebud Mini Wireless Earbuds..."; live line "Repairing the Flow: the result check refuted its answer (attempt 1 of 3)". | **New defect**: the refutation is shown to the person, but its reason is lost. "What it found" lists only good facts, then a spliced fragment of two product names. The cause (the "Plus" condition left out two earbuds sold with a charging case, per judge 0080/0081) was cut. "refuted" and "Result repair started" are internal words. U-run: the "Step 5 of 5" live line was dropped after the run (pass). The playback's own result card is not in any picture. |
| 18 flow-run | 21:28:48.87 | changed, 1 change. "Putting the page back…" → "Trying again: reading the list of “name, price and 4…”" | Same heading; "Read list · name, price and 4 more / Done". | — |
| 19 flow-run | 21:29:08.88 | stable; 1 load, 0 gaps. "Trying again: reading the list…" | Two "Read list … / Done", one "Working on it". | Stacking resumes (R2-U-7). |
| 20 flow-run | 21:29:28.88 | changed, 1 change; 1 load, 0 gaps. "Trying again: opening the start page" → "Putting the page back…" | Two "Read list … / Done"; "Edit the Flow · run the step again / Not done (2 times): …"; "Repairing the Flow — The Flow could not be tested from its start: steps 1, 2, 4 and 5 came from the Flow being changed and have not run in this build. Repairing it live, running each again so the whole Flow can be tested and judged."; "Open page · the start page / Working on it". | U-words **fail**: "steps 1, 2, 4 and 5". "came from the Flow being changed and have not run in this build" has no meaning for the person, who just watched all five steps run (16). |
| 21 flow-run | 21:29:48.90 | changed, 2 changes. "Updating the Flow — that didn't work, trying another…" → "Repairing the Flow" → "Looking over the page the Flow starts on — done" | Same "Repairing the Flow" heading; "Open page / Done"; "Read list / Done"; "Edit the Flow · run the step again / Not done: it was already tried exactly this way, …"; live line "Updating the Flow — that didn't work, trying another way". | Overlay cut at a word ("another…"). |
| 22 flow-run | 21:30:08.90 | changed, 2 changes. "Trying again…" → "Updating the Flow — that didn't work, trying another…" → "Repairing the Flow" | "Edit the Flow … / Not done (2 times)"; a second "Repairing the Flow — … steps 2, 4 and 5 came from the Flow being changed …"; "Read list / Done". | Repeated heading; a new "Edit the Flow / Not done (2 times)" card in each cycle. |
| 23 flow-run | 21:30:28.90 | stable; 1 load, 0 gaps. "Trying again: reading the list of “name, price and 4…”" | "Edit the Flow … / Not done (2 times)"; a third "Repairing the Flow — … steps 2, 4 and 5 … The last round ran none of them again. …"; "Click · Decline / Didn't work: FluxIQ didn't send it, as the step didn't say which control on the page to use"; "Read list / Working on it". | R2-U-6 wording **seen-fixed** for a click (the reason is given, not "wasn't on the page"). |
| 24 flow-run | 21:30:48.91 | stable; 1 load, 0 gaps. Same | "Read list / Done"; "Edit the Flow / Not done (2 times)"; a fourth identical "Repairing the Flow — … steps 2, 4 and 5 …"; "Read list / Working on it". | Repeated cards. |
| 25 flow-run | 21:31:08.91 | stable; 2 loads, 0 gaps. Same | As 24 (fifth cycle). Scenario: results page with sponsored tiles; overlay "Fixing your Flow / Trying again: reading the list of “name, price and 4…”" | Overlay present through two loads. |
| 26 failure | 21:31:24.56 | stable; 16/16. "**Couldn't fix your Flow** / Run failed: it saved 13 rows, but the check found they…" | Panel: "Edit the Flow / Not done (2 times)"; the "Repairing the Flow — … steps 2, 4 and 5 …" heading again; "Read list / Done"; "Edit the Flow / Not done (2 times)"; ending "**Run failed** — it saved 13 rows, but the check found they don't answer what you asked, and the fix used all its rounds before it could test a change." Scenario: results page, overlay as stated, cut at a word. | U-end **partly**: there are no dollars, no "--" and no step numbers, and it says what the Flow does now (saved 13 rows) and why it stopped. But it does not say what the check objected to, or that it is the check (not the rows) that may be wrong. "used all its rounds" sits oddly against the live line's "attempt 1 of 3" (17). "Couldn't fix your Flow" is correct here (a repair of a played Flow, not a first build). |

## Per checkpoint

### t277 "what the next live run's UI review must see"

| Item | Status | Evidence (moment, UI words) |
| --- | --- | --- |
| R2-U-1 check card | **Still open (substance)**; shape seen | 07: "Didn't pass: 10 rows would be stored, but 10 rows stored with correct columns". It is never bare, but the "but" clause is the judge's observed line, not a failure. 15: "Passed: 13 rows would be stored. The result was judged to answer the request." (good). 17 (result check, cut): "…stored, all rated 4.0+ and under $50, none sponsored, no accessory rows" (same fault). |
| R2-U-3 judge sentence | **Partly fixed** | Nothing is cut at "(e.g." anywhere. But thoughts end on ";" (05 "…across all 5 pages;", 12 "…sold with a charging case;"). The result-repair heading splices fragments: 17 "…no accessory rows. Wireless Charging Case, Ear Hooks for Running, Midnight Blue and Pulsebud Mini Wireless Earbuds...". |
| R2-U-4 internal words | **Mostly fixed; open in headings** | 04 "Look · how to read a list". None of "extract list node", "extraction", "scrapes", "pagination", "dedup", "the judge" or "next call" appears. Still present: 20-26 "steps 1, 2, 4 and 5" / "steps 2, 4 and 5"; 04 "the detected reading the list handle", "list reader"; 17 "refuted", "Result repair started". |
| R2-U-5 "Sending your message" | **Seen-fixed** | 02: panel live line "Starting…" with the overlay "Starting…". |
| R2-U-6 "wasn't on the page" | **Seen-fixed (click); read variant not exercised** | 23: "Click · Decline / Didn't work: FluxIQ didn't send it, as the step didn't say which control on the page to use". No refused read occurred, and no "wasn't on the page" or "couldn't find it on the page" appeared anywhere. The overlay's "— not tried: …" was not seen. |
| R2-U-7 stacked reruns | **Still open** | Refusals fold in pairs only: "Not done (2 times)" (13, 20, 22-26), with a new card in each cycle (at least 5 visible). Successful reruns are not folded at all: 11-12 show five or more identical "Read list · name, price and 4 more / Done" cards, and 18-19 do it again. |
| R2-U-8 one list name | **Seen-fixed** | Overlay "Reading the list of “name, price and 4 more”" (04), build card "Read list · name, price and 4 more" (04), test card "Testing: Read list · name, price and 4 more" (06). The overlay cut "name, price and 4…" is at a word. The playback card has no name at all: 16 "Read list". |
| R2-U-9 detect card | **Not exercised** | Detect steps 0010/0012 fall before moment 04's visible area. The only "Look" cards pictured are "Look · how to read a list" (04) and "Look · "wireless earbuds"" (07, a find on page). |
| R2-U-10 stale "is ready" | **Still open (as expected)** | 01 (21:23:37.89, before the send): "Your automation "Find every pair of wireless earbuds … Bri..." is ready: I tried its steps…". |
| R2-U-11 overlay on page load | **Seen-fixed** | No absent sample 100 ms or more after a new document while FluxIQ worked. The 01 and 15 absences precede the send or the playback navigation. In 16 the absence is 11 ms into a document; gap counter 0 in all 26 moments. |
| U11 repeat skipped | **Not exercised** | No repeat step in this Flow; "Skipped: the test reached no rows…" not seen. |
| R2-U-2 ending | **Not exercised in its old form** | This run ended in result repair, not on budget. 26 carries no dollar figures (see U-end). |

### Lane C UI checkpoints (round 1 list and round 3 expectations)

| Checkpoint | Status | Evidence |
| --- | --- | --- |
| U-start | **Pass** | 02: bubble, composer "Message FluxIQ" empty, overlay and panel "Starting…" (overlay from 21:23:39.86, before step 0001 at 21:23:40.65). |
| U-read | **Partly** | Test read "Done: 10 rows" (06); no "M pages" anywhere. Build read card (04) and every rerun read card (08-12, 18-26) show a bare "Done". No false "every page" claim: 05's "across all 5 pages" matches the read. |
| U-detect | **Not exercised** | See R2-U-9. |
| U-words | **Fail (step numbers)** | 20-26 "steps 1, 2, 4 and 5" / "steps 2, 4 and 5"; 04 "list handle". No `extraction.N`, node ids, `page_limit`, `endView`, `paginate` or `extract_list`. |
| U-status | **Partly** | Every cut lands at a word (05, 07, 21, 25, 26). 08: "Deciding the next step — didn't work" (the forbidden wording). 05: the live line is a step behind the cards. |
| U-tests | **Fail for the second test** | First test: all five "Testing:" cards named, including the last (05, 06). Second test (steps 0067-0072): no cards between "Testing the Flow so far" (13) and "Judging the Flow" (14). |
| U-run | **Partly** | 16: "Step 5 of 5" for 5 steps; "Robot check / Done. The check cleared on its own after 9 s." is its own card; no merges; the step count is gone after the run (17). The playback's read card is unnamed. Its result (row count) is not in any picture. |
| U-end | **Partly** | 26: "Run failed — it saved 13 rows, but the check found they don't answer what you asked, and the fix used all its rounds before it could test a change." It has no "--" and no dollars. It does not say what the check objected to, and it gives no hint that the saved rows may be right. |

## Defects

- **R3-U-1 Check clause is a non-finding.** 07: "Check result / Didn't pass: 10 rows would be stored, but 10 rows
  stored with correct columns". The same clause repeats in "Repairing the Flow — … judged not to do what you asked: 10
  rows stored with correct columns." 17's result-check card: "…stored, all rated 4.0+ and under $50, none sponsored,
  no accessory rows". The code takes the first clause of the judge's `observed`, which here opens with what is right.
  The judge's actual fault (three earbuds sold with a charging case left out by the name rule; at 17, two left out by
  the Plus rule) never reaches the card. Area: Core `R/result-verification/check-why.ts` / `check-words.ts` (pick the
  clause after "But"/"However", or the `changed`/fault field, not `observed`'s first sentence).
- **R3-U-2 Result-check refutation shown as a garbled splice.** 17: "What it found: 13 rows stored, all rated 4.0+
  and under $50, none sponsored, no accessory rows. Wireless Charging Case, Ear Hooks for Running, Midnight Blue and
  Pulsebud Mini Wireless Earbuds...". The sentence naming the "plus is present" condition was cut. Only the tail of
  a product-name list is left, glued after a full stop, and it gives no reason. Also "Result repair started", "refuted
  its answer (attempt 1 of 3)" and "twice and with the same evidence" are internal. Area: Core result-repair heading
  (the re-author's "Fixing the Flow so its result answers the request" text; likely the same sentence splitter as
  `judge-words.ts`, splitting at the "..." inside a product name). The owner was not confirmed in source.
- **R3-U-3 Ending blames rows the oracle says are right.** 26: "it saved 13 rows, but the check found they don't
  answer what you asked". The 13 rows are the oracle's exact 13. The check's objection was a guess (confidence 0.6)
  about two non-Plus products. The ending neither names the objection nor tells the person the rows may be correct
  and worth checking. "the fix used all its rounds" contradicts "attempt 1 of 3" (17), as the person sees no
  attempt 2. Area: Core unfinished-run ending for result repair (`R/flow-bootstrap/unfinished-build/**` or the
  result-repair ending; not confirmed).
- **R3-U-4 Step numbers and build jargon in re-author headings.** 20: "steps 1, 2, 4 and 5 came from the Flow being
  changed and have not run in this build"; 22-26: "steps 2, 4 and 5 … The last round ran none of them again". The
  same paragraph appears five times (20, 21/22, 23, 24, 26). Area: Core activity wording for the "could not be tested
  from its start" repair heading.
- **R3-U-5 Successful reruns stack unfolded and uncounted.** 11-12: five or more identical "Read list · name, price
  and 4 more / Done"; again at 18-19. Each is a full five-page read with no row count, so the person cannot tell
  whether anything changed. Refusal pairs fold to "Not done (2 times)", but each cycle adds a new card (13, 20, 22,
  23, 24, 25, 26). Area: extension `panel/chat/stream/step/card-repeats.ts` (fold identical successive cards, not
  only refusals) and Core read card words (carry the count on rerun reads).
- **R3-U-6 Second build test's cards missing.** 13-14: "Testing the Flow so far — …" is followed directly by
  "Judging the Flow — The Flow so far ran clean from its start." Steps 0067-0072 (21:27:19.9-21:27:26.6) show no
  "Testing:" cards. Area: Core (test activity for the stopped-round test, perhaps not emitted) or extension panel.
  Not traced.
- **R3-U-7 "Deciding the next step — didn't work" on a provider error.** 08 overlay: "Fixing your Flow / Deciding
  the next step — didn't work". This was step 0041 `llm.provider_malformed_response`. A provider hiccup is shown as
  a failed step, using the wording U-status forbids. Area: extension `shared/activity/wording.ts` (outcome for a
  refused decision) / Core activity status.
- **R3-U-8 "kept retrying things that had already failed or done nothing" beside a stack of "Done".** 13. The
  refused amendments were `repeat_refused` reruns of a read that succeeded. The words fit the loop, but contradict
  every visible card. Area: Core stopped-round wording.
- **R3-U-9 Thoughts cut at ";".** 05: "…keeps the right rows across all 5 pages;"; 12: "The name exclusion wrongly
  drops earbuds sold with a charging case;". These read as unfinished. 12 is the only place the real finding is
  shown. Area: Core `R/activity/wording/reason-text.ts` / `ui/activity-action/sentences.ts` (first sentence taken up
  to ";").
- **R3-U-10 Garbled thought with "handle".** 04: "Reading the search results list with the detected reading the
  list handle to see the real rows and columns before adding the list reader." Area: Core `wording/person-words.ts`
  (replacement of "extract_list handle" produced a doubled phrase). Not confirmed.
- **R3-U-11 Live line lags the cards.** 05: the live line says "Trying the Flow from the start: clicking "Decline""
  while "Testing: Click · Decline / Already done on the site" is finished and "Testing: Type" is working. Minor.
  Area: extension panel live line.
- **R3-U-12 Playback read card unnamed.** 16: "Read list / Working on it" while the build cards say "Read list ·
  name, price and 4 more". Area: Core playback action words or extension card target.
- Also seen, not counted: 05 "Edit the Flow / Only partly done: that step is already in the Flow" (a refused part of
  an amendment, `already_in_flow`, shown as work); 01's stale thread (R2-U-10, known).

## Commands run and observed results

- `node -e` over the JSON printed each moment's counts and distinct overlay texts (quoted above). It also printed
  first-present times: moment 01 first present at +2212 ms (21:23:39.864); moment 15 at +2010 ms (21:27:50.880).
  Absent samples relative to document origin: moment 16's single absence is 11 ms into a new document. Summary:
  26 moments, 26/26 pictures, `skippedTicks` none, `failures` none.
- `steps/index.md` read in full (156 lines); `meta.json` start times for 0001, 0022, 0027, 0066, 0067, 0072-0075,
  0079, 0080, 0150; the first 1500 bytes of `decision.json` for judges 0028, 0029, 0073, 0080, 0081 (used only for
  the reason behind the check cards).
- All 26 panel PNGs and scenario PNGs 01, 02, 15, 16, 25, 26 were viewed with the Read tool.

## Not verified

- No source was opened. The owning files above come from t277's code map and are likely, not confirmed. This
  applies especially to R3-U-2, R3-U-3 and R3-U-6.
- Not in any picture: the playback's end (result card, "saved N rows"), the "is ready"/proposed message after the
  build passed, the detect cards (0010/0012), and the full text of the result-check card at 17 (top cut).
- Whether the second test's cards were emitted and dropped, or never emitted.

## Open questions or contradictions found

- The live line said "attempt 1 of 3" (17), and the ending says "the fix used all its rounds". The brief says the
  re-author ran out of budget. Which limit ended it, and should the ending say so plainly?
- Should a result-check refutation with confidence 0.6 against rows the build's own judge passed (0073, confidence 0.9)
  be shown to the person as a failure at all, or as "saved 13 rows; the check doubts two left-out items"?
