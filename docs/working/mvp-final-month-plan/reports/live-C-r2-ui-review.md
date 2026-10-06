# Live lane C round 2 UI review: run-muwansvz-a2b4a987

Worker report, read-only analysis. Source: `test-runs/instances/t274-slot-1/run-muwansvz-a2b4a987.ui-review.local.json`
(8 moments, no skipped ticks, no capture failures) and all 16 pictures beside it, each viewed. Each picture is
taken at its moment's overlay start; the moment's `at` is the end of its ~3 s overlay window (16 samples, ~200 ms
apart). All times UTC, 2026-10-06. Overlay text sequences come from the samples; the picture text is what was
drawn when the picture was taken.

## Outcome

Done. The t276 overlay fixes hold in this run (every observed cut lands on a word; the failure overlay no longer
says "Couldn't fix" during a build), read cards now carry a row count, and repeated refusals are partly collapsed
("Not done (2 times)"). The C-3 wording is **not** visible: the only build-test check card pictured reads
"Check result / Didn't pass" with no row count, and "would be stored" appears nowhere. The ending is the worst
surface in this run: a paragraph of internal dollar bookkeeping, step numbers and raw, truncated judge text.

## Moments

| Moment | Overlay start (UTC) | Overlay status, loads/gaps | What the pictures show | Judged against the checkpoints |
| --- | --- | --- | --- | --- |
| 01 start | 06:28:00.960 | changed; 8/16 present, 1 presence toggle; 1 page load, 0 gaps. Absent until +1.6 s (06:28:02.57), then "Starting…" | Panel (06:28:01.34): no "Latest chat" header; the instruction as a bubble, then a reply "I'll make you a new automation for this…" and "Your automation "Find every pair of wireless earbuds in the store's search results that is Bri..." is ready: I tried its steps on the page you had open and put the ones that worked into it."; composer "Message FluxIQ" empty. Scenario (06:28:00.96): store home, cookie banner (Accept / Decline / Customize cookies), no overlay. | U-start: overlay prompt yes ("Starting…" from 06:28:02.57). The panel at this instant shows a conversation that already claims the automation "is ready" (apparently an earlier chat with the same instruction, not this build); see open question. Composer empty. |
| 02 mid-build | 06:28:03.976 | changed, 2 text changes; 15/16 present; 1 page load. "Starting…" → +1.2 s "Building your Flow" → +2.6 s "Building your Flow / Opening where the Flow starts" → absent at the last sample (+3.0 s, new document) | Panel (06:28:04.15): header "Latest chat / Project chat", the instruction bubble, composer empty, below it "Sending your message". Scenario: app banner, overlay "Starting…" top-left over the store header. | U-start: bubble present, composer empty; **fail**: "Sending your message" still shown while the overlay had said "Starting…" for ~1.6 s. Last sample absent on a page load (counter reports 0 gaps because the window ended; length unknown). |
| 03 mid-build | 06:28:23.205 | stable; 16/16; 1 page load, 0 gaps. "Building your Flow / Typing "wireless earbuds" into “Search Brightaisle”" | Panel: "…Decline" cut at top, card "Click · Decline / Done"; "Clicking “Not now” — Dismissing the notification popup, then searching Brightaisle…"; card "Click · Not now / Done"; "Typing "wireless earbuds" into “Search Brightaisle” — Searching Brightaisle for wireless earbuds to reach the results list the instruction needs."; card "Type · Search Brightaisle / Working on it"; status line repeats overlay. Scenario: robot-check interstitial "Continue shopping"; overlay at bottom-left still says typing. | U-words pass. U-status pass (no flicker; overlay held through a page load). Overlay shows the typing step over a robot-check page (minor, as round 1). |
| 04 mid-build | 06:28:43.214 | stable; 16/16; 1 page load, 0 gaps. "Building your Flow / Reading the list of “name, price, rating and 3 more”" | Panel: card "Look · the repeating list on the page / Done"; "Looking up how to use “Extract list” — I'll describe the extract list node so I can add a step that scrapes all result pages with the filters the instruction needs."; card "Look · Extract list / Done"; "Reading the list of “name, price, rating and 3 more” — Reading the search results list with the extraction node to see the rows, fields and pagination it really returns before adding it to the Flow."; card "Read list · name, price and 4 more / Working on it". Scenario: results grid incl. a "Sponsored" tile; overlay as above. | U-detect partial: card no longer a page label, but "the repeating list on the page" does not name the list. U-words **fail**: "extract list node", "scrapes", "extraction node", "pagination", card "Look · Extract list". Card target no longer elided mid-list. Card says "name, price and 4 more" while the overlay says "name, price, rating and 3 more". |
| 05 mid-build | 06:29:03.226 | stable; 16/16; 1 page load, 0 gaps. "Building your Flow / Trying the Flow from the start: reading the list of…" (samples carry “name, price, rating and 3 more”; the drawn overlay is cut after "of…") | Panel: "Checking whether the Flow is finished — The extraction already read all 5 pages with the needed columns;" then cards "Testing: Open page · the start page / Done", "Testing: Click · Decline / Already done on the site", "Testing: Click · Not now / Already done on the site", "Testing: Type · "wireless earbuds" / Done", "Testing: Read list · name and 5 more / Working on it". Scenario: page 2 "17-32 of over 1,000 results" with skeleton tiles. | U-tests pass (every test card named). U-status pass (cut at a word: "of…"). U-words fail ("The extraction"). Third different label for the same list: "name and 5 more". |
| 06 mid-build | 06:29:23.232 | changed, 2 text changes; 16/16; 0 loads/gaps. "Fixing your Flow / Repairing the Flow" → "Looking over the page the Flow starts on — done" → "Looking for the repeating list on the page" | Panel: "Testing: Type · "wireless earbuds" / Done"; "Testing: Read list · name and 5 more / **Done: 82 rows**"; "Judging the Flow — The Flow was tested from its start. Judging what the test did against what you asked."; card "**Check result / Didn't pass**"; "Repairing the Flow — The Flow was tested from its start and judged not to do what you asked: Step 8 kept 82 rows from 5 pages with no filtering or dedup. Stored rows include sponsored items (e.g. Repairing it live." Scenario: results page end with a "Sponsored" tile; overlay "Fixing your Flow / Repairing the Flow". | U-read **pass**: "Done: 82 rows". U-check **fail**: check card says only "Didn't pass", no "82 rows would be stored"; "no rows came back" is gone. U-words fail: "Step 8", "dedup". Judge text spliced raw and cut inside an open parenthesis: "(e.g. Repairing it live.". |
| 07 mid-build | 06:29:43.243 | changed, 1 text change; 16/16; 0 loads/gaps. "Fixing your Flow / Trying again: reading the list of “name, price, rating…”" → +1.6 s "Updating the Flow — that didn't work, trying another…" | Panel: top card "…Didn't work: FluxIQ didn't send it, as the step didn't say which control on the page to use"; "Edit the Flow · run the step again / Not done: that step was already tried exactly this way on this same page, and trying it again would end the same way"; "Read list · name, price and 4 more / Didn't work: it wasn't on the page"; "Edit the Flow · run the step again / **Not done (2 times)**: …"; "Read list · name, price and 4 more / Didn't work: it wasn't on the page"; status "Trying again: reading the list of “name, price, rating and 3 more” — couldn't find it on the page". Scenario: results page 1 "1-16 of over 1,000 results" with the product grid fully visible. | U-repair partial: refusals collapse into "Not done (2 times)", but each rerun still adds its own "Read list / Didn't work" card (2 visible plus one cut at top). U-status pass (cuts at words: "rating…", "another…"). **Contradiction**: "it wasn't on the page" / "couldn't find it on the page" while the list is plainly visible. |
| 08 failure | 06:29:49.694 | stable; 16/16; 0 loads/gaps. "**Build failed** / Build stopped: a budget ran out" | Panel (ending paragraph, top cut): "…before the Flow was finished: its next call could have cost up to $0.008, more than was left beside the $0.014 kept back for judging the Flow, and that was not spent, because the Flow was unchanged since the judge said it does not do what was asked, and it had spent $0.079 ($0.000 of it by earlier builds of this Flow) in all. The Flow (5 steps) ran from its start, but what it did was judged not to be what you asked. The judge found: Step 8 kept 82 rows from 5 pages with no filtering or dedup. Stored rows include sponsored items (e.g. What the judge says is left to change: Step 8 needs filter conditions for sponsored, plus/Brightaisle Plus eligibility, rating >= 4.0, price < $50. I worked on it live twice: … The steps I found so far were kept as a draft, so building again carries on from them, with $0.021 left of this Flow's $0.10. The Flow "Find every pair of wireless earbuds in the store's search results that is..." keeps your instruction." Scenario: results page 1; overlay "Build failed / Build stopped: a budget ran out". | U-end **fail**. Good: says the Flow ran and was judged wrong, what is left to change (filters for sponsored, Plus, rating, price), that a draft is kept. Bad: internal dollar bookkeeping ($0.008, $0.014 kept back, $0.079, $0.000, $0.021); "next call", "the judge" ×3; "Step 8" while the Flow has "(5 steps)"; "dedup"; raw judge text cut inside "(e.g." twice; does not say in plain words what blocked the fix (the list read was refused on every rerun as not found / unchanged). Overlay "a budget ran out" is vague but not misleading; t276 fix holds (no "Couldn't fix" during a build). |

## Defects

- **R2-U-1 Build-test check card has no count; C-3 wording not shown.** Moment 06: "Check result / Didn't pass". The
  read card just above says "Done: 82 rows", so the count exists, but the check card neither says "82 rows would be
  stored" nor why it failed (that only appears in the following "Repairing the Flow" paragraph). The second
  build-test judge's card is not in any picture. Area: Core activity wording (check result line); extension panel
  if the count is emitted but dropped.
- **R2-U-2 Ending is dollar bookkeeping.** Moment 08: "its next call could have cost up to $0.008, more than was left
  beside the $0.014 kept back for judging the Flow", "$0.079 ($0.000 of it by earlier builds of this Flow)",
  "$0.021 left of this Flow's $0.10". A person cannot act on any of it except the last. The plain blocker (each
  attempt to re-read the list was refused as not found or unchanged, so no fix could be tested) is not said.
  Area: Core activity wording.
- **R2-U-3 Raw judge text spliced and truncated.** Moments 06 and 08: "Stored rows include sponsored items (e.g.
  Repairing it live." and "(e.g. What the judge says is left to change: …". The judge's sentence is cut inside an
  open parenthesis and the next sentence is glued on. Area: Core activity wording.
- **R2-U-4 Internal words in the chat.** 04: "extract list node", "scrapes", "extraction node", "pagination", card
  "Look · Extract list"; 05: "The extraction already read all 5 pages"; 06, 08: "Step 8", "dedup"; 08: "next call",
  "the judge". "Step 8" also contradicts "The Flow (5 steps)". Area: Core activity wording (reason pass-through,
  judge text and ending).
- **R2-U-5 "Sending your message" lingers.** Moment 02 (06:28:04.15) while the overlay had shown "Starting…" since
  06:28:02.57. Area: extension panel.
- **R2-U-6 "Wasn't on the page" while the list is visible.** Moment 07: "Read list · name, price and 4 more /
  Didn't work: it wasn't on the page"; overlay "— couldn't find it on the page"; scenario shows the results grid.
  The underlying refusal (target_unobserved / changes_nothing) is reported as a page fact the person can see is
  false. Area: Core activity wording.
- **R2-U-7 Reruns still one card each.** Moment 07: refusals collapse to "Not done (2 times)", but every refused
  rerun still adds an "Edit the Flow · run the step again" card and a "Read list / Didn't work" card; with about six
  reruns the chat is a stack of near-identical failures, and the two refused "complete" decisions are not visible in
  any picture. Area: extension panel (grouping) and Core activity wording.
- **R2-U-8 One list, three names.** "Read list · name, price and 4 more" (04, 07), "Testing: Read list · name and 5
  more" (05, 06), overlay "name, price, rating and 3 more". Area: extension panel (card target shortening) vs overlay.
- **R2-U-9 Detect card does not name the list.** Moment 04: "Look · the repeating list on the page" (overlay
  "Looking for the repeating list on the page"). Better than a page label, but not "the search results". Area: Core
  activity wording.
- **R2-U-10 Stale "is ready" conversation at start.** Moment 01: before this build, the panel shows the same
  instruction with "Your automation … is ready: I tried its steps…". If it is a previous run's chat, it is not a
  defect of this build, but it shows a success claim beside an instruction that then fails. Area: extension panel
  (which chat is shown at open). Not confirmed; see open question.
- **R2-U-11 Overlay absent on a page load at the end of moment 02.** The last sample (+3.0 s) is absent with a new
  document; its length is not measured. Area: overlay.

## Previous defects

| Previous | Status in this run |
| --- | --- |
| U-1 read cards without counts | **Fixed** for the build test: "Testing: Read list · name and 5 more / Done: 82 rows" (06). Build-round read card was only seen "Working on it" (04); rerun cards fail, so their counts are not exercised. |
| U-2 detect card named after a label | **Partly fixed** (R2-U-9): "Look · the repeating list on the page". |
| U-3 internal words | **Still open** (R2-U-4). "named no control" is reworded to "the step didn't say which control on the page to use". No `page_limit`, `paginate`, `extract_list`, `selector`, `markup`, node ids, handles or "the model" seen. |
| U-4 overlay cut mid-word | **Fixed** in every observed case: "reading the list of…", "rating…", "trying another…". |
| U-5 "Sending your message" lingers | **Still open** (R2-U-5). |
| U-6 build-test check "Passed: no rows came back" | **Fixed** as to the false wording (not seen); the replacement count is missing (R2-U-1). |
| U-7 step count after run end | **Not exercised** (no Flow run). |
| U-8 refusals shown as work | **Partly fixed**: "Not done (2 times)" collapses; reruns still stack (R2-U-7). |
| U-9 refutation not visible | **Fixed**: "Check result / Didn't pass" and the judge's finding are on screen (06), though raw and truncated (R2-U-3). |
| U-10 ending lacks blocker | **Still open**, worse in form (R2-U-2): states what is left to change but not what blocked the fix, and adds dollar bookkeeping. |
| U-11 garbled "Only partly done: a repeat goes on…" | **Not exercised** (not seen). |
| U-12 "wasn't on the page" contradicted by the page | **Still open** (R2-U-6), now on the list read. |
| U-13 card target elided mid-list/mid-word | **Fixed** ("name, price and 4 more"); naming now inconsistent (R2-U-8). |
| U-14 overlay gaps on page loads | **Mostly fixed**: page loads in 03, 04, 05 kept the overlay; one absent sample at the end of 02 (R2-U-11). No playback in this run. |

## Commands run and observed results

- `node -e` over the JSON printing each moment's counts and distinct overlay texts: output as quoted above
  (moment 01 absent until +1609 ms; moment 02 absent at +3001 ms; moment 08 "Build failed | Build stopped: a budget
  ran out").
- Viewed all 16 PNGs with the Read tool.

## Not verified

- The second build-test judge's check card and the two refused "complete" decisions: not in any picture.
- The exact send instant: the brief says 06:28:04, but the overlay showed "Starting…" from 06:28:02.57, so the send
  was earlier than that; the panel at 06:28:01.34 shows a different (earlier) conversation.
- Whether the check card's row count is emitted and dropped by the panel; source was not opened.

## Open questions or contradictions found

- Moment 01's panel shows an earlier chat ending "…is ready". Is the side panel opened on the previous run's chat
  in this profile? If so, the Lab should start lane runs on a fresh chat.
- Brief timeline (send 06:28:04) vs overlay "Starting…" at 06:28:02.57.
