# Run debug — `run-muohbi3e-e5847e5a` (lane A run 36)

Written by the t174 lead. The first run with the decision dump (F12): every decision's window and answer, every tool
request and full result, and every completion verdict are in
`test-runs/instances/t174-slot-1/decision-dumps/build-2026-09-30T19-13-53-677Z-12744.jsonl` (local, unscreened,
never published). Also read: the bundle `run-muohbi3e-e5847e5a` (`snapshots/flow-lane.json`, `logs/core.log`), the kept
state `.work/run-muohbi3e-e5847e5a`, and the 11 UI-review moments. Judged against the user's build lifecycle: explore
and author the Flow live, with no replay from the start; once ready, test and judge the Flow; then repair, finish, or
declare it not doable only when no way remains.

## Header

- Run id: `run-muohbi3e-e5847e5a`
- Scenario / variant / task: crossborder-marketplace / none / crossborder-marketplace-hub-to-cart
- Command: `scratchpad/t174-live-run-a.sh crossborder-marketplace crossborder-marketplace-hub-to-cart` (lane report, Session 3), instance t174-slot-1, headed, with `FLUXIQ_LAB_KEEP_RUN_STATE=1` and `FLUXIQ_BUILD_DECISION_DUMP`
- Date, provider, model: 2026-09-30 19:06-19:17 UTC (loop 19:13:53-19:16:12), deepseek, deepseek-flash, production profile
- Provider calls, tokens, cost: 41 calls, 565,993 in / 4,818 out, $0.0700
- Verdict as reported: `failed`, `runtime.behavior`, `flow_bootstrap.evidence_unusable_decision`; `flowCreated: false`
- **Stage reached:** 2, exploration. No Flow was proposed.
- Code under test: the decision dump (so Stage 2 can be answered), P1 A and P1 B.

## Stage 1 — the instruction and the expected chain

Written by the lane lead before run 35 (the same task); unchanged.

- The instruction, verbatim: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything."
- The node chain a correct Flow must have:
  1. Navigate to the start location (Farbazaar home). A robot check is never pressed: a self-clearing one is waited out, any other is handed to the person.
  2. Type "Voltbay USB-C hub" in the search box and submit.
  3. Press the Voltbay USB-C hub listing sold by Voltbay Official Store (not the same hub from another seller).
  4. On the item page, choose colour Space Grey.
  5. Choose the 7-in-1 version.
  6. Choose ship-from Spain.
  7. Set the quantity to 3.
  8. Press the store's coupon control (collect).
  9. Press "Add to cart". No "Buy now", no checkout.
- What a wrong answer that looks right would look like: the other seller's listing; the default colour, version or origin; quantity 1; the coupon not collected; a navigation-only Flow accepted; a robot check pressed.

## Stage 2 — exploration

From the decision dump. "Packet" is `elements shown / elementTotal` of the page evidence the call returned.
Iterations 4-6 made no decision (the loop's counter went from 3 to 7 with no `decide` in the dump or the trace; gap G3).

| # | Decided (real parameters) | Result | What the model was shown next |
| --- | --- | --- | --- |
| 0 | Core's free look | `not_at_start_location` | the start location |
| 1 | navigate `/scenarios/crossborder-marketplace/` | succeeded | home, packet 40/401, no "Voltbay" |
| 2 | navigate `/search?q=Voltbay+USB-C+hub` (written by the model) | **`address_not_shown`** (P1 A) | the refusal's two `instead` ways and the page |
| 3 | type `target.42` (the search box) "Voltbay USB-C hub" | succeeded | home, 40/388 |
| 7 | keypress `target.42` Enter | succeeded | `/search`, packet 40/293: header, category links, search suggestions ("usb c hub 7 in 1" = `target.51`), cookie buttons, sort, the origin and brand filters. **None of the 40 is a result card**; "Voltbay" appears only in "45 results for 'Voltbay USB-C hub'" |
| 8 | click `target.51` (the suggestion "usb c hub 7 in 1") | succeeded | a new search; packet 40/293 now shows `target.87` "Voltbay" (a brand filter) and `target.88` "OK" |
| 9 | click `target.51` | `handle_not_in_packet` (correct: not in the packet just shown) | refusal only |
| 10 | click `target.87` ("Voltbay", shown at 8) | **`handle_not_in_packet`** | refusal only |
| 11 | click `target.51` | `handle_not_in_packet` | |
| 12 | click `target.87` | **`handle_not_in_packet`** | |
| 13 | amend `6: exploratory` | amended | |
| 14 | extract_list `extraction.1` (fields title/price/store/url) | `handle_not_in_packet` (no detection had run) | |
| 15 | detect_repeating_structure | `structure.detected` | |
| 16 | extract_list `extraction.1` with the detected field keys | `inspect.succeeded` (4.1 s) | the result rows as data, packet 40/483 |
| 17, 18 | detect_repeating_structure x2 | detected; the third answered from memory | |
| 19 | navigate `/search?q=usb+c+hub+7+in+1` (shown by the suggestion) | a robot check: handed to the person, the Lab answered Continue (`personCompletedCheck`), 9.1 s | a fresh look, 40/293 |
| 20-22 | click `target.87` x3 | **`handle_not_in_packet`**, then `answered_the_same_again` x2 | |
| 23 | amend: drop 6-11, 16-19, … | amended | |
| 24, 25 | amend `rerun` of the extract steps 13 and 20 | `inspect.succeeded` | |
| 26 | amend `21: keep` | amended | |
| 27 | complete: "Searches … and extracts the matching search-result rows; it never opens the item, picks Space Grey 7-in-1 from Spain, sets quantity 3, adds to cart, or collects the store coupon." Acts a1, a2 → d21 (the extract) | refused: a1, a2 `step_changed_nothing`; the three choices `no_step_named`; then a dry run replayed from the reset | |
| 28 | navigate `/search?q=usb+c+hub+7+in+1` | a robot check, handed to the person, 7.5 s | |
| 29 | complete (a1, a2 → d21) | refused as 27 | |
| 30 | navigate `/search?q=usb+c+hub+7+in+1` | succeeded | packet 40/293 with `target.87` "Voltbay" |
| 31-33 | click `target.87` x3 | **`handle_not_in_packet`**, then `answered_the_same_again` x2 | |
| 34 | complete (a1, a2 → d21), "the add-to-cart and coupon steps could not be run" | refused; dry run from the reset (11.1 s on the extract) | |
| 35 | complete claiming d27-d31, **steps that do not exist** ("then opens the Voltbay Official Store item to add three …") | refused `no_such_step` x5 | |
| 36-41 | complete x6, every act and choice → d21, each summary saying the item was never opened | refused `step_changed_nothing` x6; the build ends `evidence_unusable_decision` at 41 | |

- Repeats, and what the loop believed was progress: `target.87` was pressed 8 times, all refused; the last 7 decisions
  were completions the model itself described as not done.
- Rejections and whether each said enough: the four refusals of `target.87` at 10, 12, 20 and 31 were **wrong**: the
  handle was in the packet returned by the call just before (8 and 30). The model was right to press it; the domain was
  wrong to refuse it (cause 2). `address_not_shown` at 2 worked as designed: the model typed and ran the search.
- Where the context was truncated: every search-results packet was 40 of 293 elements with no result card (cause 1).
  The draft entry ended at 3,954 of 4,000 bytes with 14 of 22 steps shown without input, and the draft's guidance cut
  to 177 bytes.

## Stage 3 — the proposed Flow

- Node list as authored: none accepted. The last completion claimed the extract step d21 for every act.
- Divergences from the stage 1 chain: chain steps 3-9 are absent. The build never stood on an item page: every moment
  is `/` or `/search`.
- Why: the model could not see the result cards (cause 1) and could not press the brand filter it did see (cause 2). It
  read the results as data with `extract_list` instead, which cannot open an item.

## Stage 4 — replay

Not reached. Two dry runs replayed the draft from its reset at 27 and 34 (moment 7, 19:15:09, is the home page
mid-build): a restart from the beginning, which the lifecycle forbids (cause 4).

## Stage 5 — the answer

Not reached. The header cart read 0 at every moment.

## Stage 6 — judgement and repair

- Judged its own result: no result. The model's own summaries judged each attempt as not done (27, 34, 36-41), and it
  completed anyway.
- Repair: none can follow a build that creates no Flow. Against the lifecycle's third phase, the build neither found
  another way nor declared the task not doable, while a way remained: the Voltbay Official Store card was on the page
  (moment 10) and the "Voltbay" filter was in the packet. That is a defect, and causes 1 and 2 are why no way was
  found.

## UI review (11 moments, `run-muohbi3e-e5847e5a.ui-review.local/`)

- Page overlay: bottom-left, visible, stable phase words ("Deciding the next step", "Building your Flow") with no raw ids
  at moment 10; it covers the cookie banner's first line of text, not its buttons.
- The page's notification prompt ("Never miss a price drop", Not now / Allow) and cookie banner stayed open all build,
  covering the filter column and the lower result rows. The prompt is the notice that pushed the "Voltbay" filter past
  the pre-action look's forty controls (cause 2).
- Side panel: the old UI (Simple/Advanced, "Get set up" cards above the chat, "Add an AI model key: To do" while
  building, "Page | Full | Small | Off"). Two robot-check hand-offs read "FluxIQ needs you: complete the check on this
  page, then press Continue. You chose 'Continue'." "Worked for 13s · 9 steps · 8 failed" for a loop of about 139 s
  (U12). All t191's round-2 items.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | Every search-results packet held 40 of 293 elements and none was a result card: the header, category and suggestion links, cookie buttons, sort and filters filled the forty. The Voltbay Official Store card could not be pressed. | extension capture and domain packet bounds (the 40-control cap) | Remove the cap | **t200** |
| 2 | A handle in the packet just shown was refused `handle_not_in_packet` (`target.87` "Voltbay" at 10, 12, 20, 31). The look each node run takes before acting (capped at 40, never shown) replaced the page's stored handles; the price-drop notice pushed the filter past its forty, so the shown handle was forgotten. `node-run/run.ts:259` `run.shown(current)` → `tools.ts:261` → `plan-resolution/target-packets.ts:87-88` replaced the page map. | downstream domain | **Fixed (F13, worker t174-w26):** a look cut short only adds handles; a whole-page look still replaces. Two run-level tests reproduce the live refusal | t174 |
| 3 | The draft entry cap (4,000 B; 14 of 22 steps without input; guidance cut to 177 B), as in runs 34 and 35. | Core `flow-draft/entry.ts`, `llm/evidence-loop/draft-shown.ts` | Remove the cap | **t200** |
| 4 | Two dry runs replayed the draft from the start mid-build (27, 34). | Core `llm/node-tools/dry-run-gate.ts`, `flow-draft/dry-run.ts` | Remove replays from the build | **t196** |
| 5 | The draft is a transcript: refused presses and repeated searches were appended one by one, then dropped by hand (23). | Core `flow-draft/*` accrual | Author the draft as the Flow | **t196** |
| 6 | The model completed 9 times while its own summaries said the item was never opened, and once claimed five steps that do not exist (35). | Core `llm/evidence-loop` (completion handling, no-progress) | Recorded; the loop should not spend decisions on a completion the model itself says is not done | t193 C / t189's area |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 (G3) | Iterations 4-6 made no decision: the loop's counter skipped three numbers with no `decide` in the dump or the trace, around the first robot-check hand-off | Core `llm/evidence-loop.ts` (iteration numbering across a person hand-off) |
| 2 | A result that is a person hand-off carries no `resultCode` (19, 28) | domain `node-run` person-needed result |
