# run-mwuxd2v9-33928ea3: bigbox new-store cheapest towels, stopped (every read was of a list of two shelves)

Lane: t1015 `paid-bigbox`, relaunch after t1020 merged (dev 8b75e450b).
Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, attempt 1 of 4, visible Chrome, run watcher on.
Provider: Anthropic `claude-haiku-5-5` for build and judge.
Evidence copy: `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwuxd2v9-33928ea3/` (steps, Core log, Core store). Debugged offline by t1022; no live or paid run.

## Attempt 1 (attempts 2-4 not run)

- Verdict: **stopped by the lead** at step 219, after the fourth judged no. Started 16:44:27 UTC; the watcher's last update 16:53:24.
- Cost: **$2.23** by the watcher; 27 acts counted by the watcher, 4 loop rungs, 4 loop decisions, 4 alerts (`no_act_after_loop` at steps 67-82 and 169-202).
- Path: the store picker was opened and Millbrook Crossing Neighborhood Market set as the store (steps 10, 12), then the first card of the home page's "Pickup today" shelf (Loftwell 6 Double Rolls, $10.47) was added (step 30). The cart already held a dish soap. The page was the store's home page for the whole run, except for one look at the cart (step 36), and a replay sent it back.
- Detections: 14 answered and 10 refused (`already_answered` or `repeat_refused`). Eleven of the answered ones were aimed at the shelf heading `t45` ("Pickup today at ...") or the hero heading `t364`. Two were aimed at the cart link `t18` (steps 108, 112). That link is in no list, so the page-wide search answered the right list, the shelf's 8 cards (`extraction.9`, `extraction.10`). Neither was ever read.
- Judge: no 4 times (steps 125, 154, 163, 182, 220; 124 and 153 were unreadable replies asked again). Each said that Softerra 6 Double Rolls ($9.47, rated 4.5, pickup today) was the cheapest qualifying item and was never chosen. Step 182 said the listing "was read as only 2 rows from a single page ... though the page listed 8 items".
- 11 decisions were unreadable (`llm.provider_output_invalid`), two of them costing $0.14 and $0.17 (steps 139, 194).

## The lead's account against the steps

**`extraction.1` and `extraction.4` are the same list: the home page's two shelves, not a listing and not the cart.**

| Handle | Step | Page | Target | Items |
| --- | --- | --- | --- | --- |
| `extraction.1` | 4 | home `/scenarios/bigbox-retail/` (store Carden Falls) | `t45`, h2 "Pickup today at Carden Falls Supercenter" | 2 |
| `extraction.4` | 18 | home, after the store was set | `t45`, h2 "Pickup today at Millbrook Crossing Neighborhood Market" | 2 |

Both bindings saved in the draft hold `location` = the home page and the item `main > section.css-0yqogxo`. That item is a shelf: a header (an h2 and a "View all" link) over a `ul` of product cards. The home page draws two shelves, "Pickup today" (8 cards) and "Rollbacks" (4). The detection's fields were the shelf's header and every card flattened by its place in the shelf: `ul_css-1ysgock_li_1_..._currency_amount` through `li_8`, with `atItem: "item 1/8 (...)"` meaning a card's place in the shelf, not in the list. The model read the `li_1` columns (name, price, rating, pickup), so each read kept one row per shelf, holding that shelf's first card: Loftwell ($10.47) and Hearthside Kitchen 2 Rolls ($2.97).

**No read ran on another list's page.** The fresh reads at steps 6, 20, 34 and 199 report the home page. The 18 replays (steps 41-55, 86-91, 115-120, 142-147, 208-213) each ran in a Flow run that first replayed the navigation to the home page (steps 40, 49, 85, 114, 207) or started from it (step 141, after the snapshot at 121 on the home page). Every read therefore ran on the home page, where both lists were made. That includes the draft's steps 3, 10 and 14, the ones named `read.millbrook.pickup...`. Step 199 read while the page was the home page, which is that list's own page. The cart was never read. The model called the two-row read the cart in its own summaries ("Cart read shows 2 items", step 122; "Two cart rows", step 165): the cart then held two lines too. But the rows were the shelves' first cards, which no other list on the site holds.

**Is a binding's location checked?** No. A saved read's `extractionBinding.location` is kept (`plan-resolution/extraction/saved-list.ts`) and compared only with a location the call itself names (`slot.ts`), never with the page the read runs on. List identity is checked only by the item selector matching, with `minItems: 0` on these reads. A replay on another page would read whatever that page's elements matching the selector hold, or nothing. That did not happen in this run, and nothing in it shows it happening.

## Why the model never "got back to the listing"

It never left it. The listing it meant was the home page's Pickup shelf. Every time it asked for that list by the shelf's heading, it got the same two-shelf list back (steps 16, 18, 69, 77, 104, 128, 130, 185, 187). After a while the repeats were refused as `already_answered` or `repeat_refused` (steps 22, 26, 134-138, 157, 166, 189-193).

- After each judged no, the completion check gave it the judge's words and defects: Softerra at $9.47 was cheaper, and the listing was read as 2 rows of 8. It also gave `resultHolds`, which said "4 rows over 13 pages: offset=0 (2), unplaced read 1 (2), ..." (each replay counted as another page). The model took this as a paging problem and searched for "Next page" or "Next" 8 times (steps 59-218). Nothing told it that its list's rows were shelves.
- Loop handling steered 4 times (steps 99, 149, 160, 169) and the model made 4 loop decisions (`change_approach`, `finish_with_best` twice, `ask_person`). It re-detected from the same heading and re-ran the Flow, which gave the same two rows.
- The read packet was clear about keys and handles (t1020's `readNote`), but it described a list of two items whose columns named "item 1/8". Nothing said that each item was a group of eight records.

## `a1.fulfilment` ("for pickup") was done by the site's own state

The act was not left undone. The store picker showed "Pickup" already marked before any act (step 10's page: `t332 clickable "Pickup" marked`). The cart page said "Pickup at Millbrook Crossing Neighborhood Market" (step 36). The act checklist counts a choice as done only when a step does it, so from step 26 on every refusal said "Your next step is the one that does a1.fulfilment". At step 72 the model tried to put the act on a read (refused `act_on_a_read`). This is a separate defect in how acts are recorded: a choice the page already shows as made counts as missing. t1022 did not fix it (see the report).

## Cause (proven offline)

**A run whose items are groups of records was answered as the list.** `apps/extension/src/content/extraction/infer-list.ts` walks out from the target. From the h2 it reached the shelf `section`, whose sibling shelf passes every pair test (`record-pair.ts`: a named template, containers, at least two values each). Two shelves were a "pair of records", nothing further out was a run, so the pair was the answer. Its fields (`infer-fields.ts`) flattened each shelf's cards by place. A read of it can only keep one row per shelf. This is the same kind of failure as t1020 (the wrong unit of record offered as the list), in a new shape.

## Fix, t1022 (content script and domain; Core unchanged)

### 1. A run of groups is never the list (the cause)

- New `apps/extension/src/content/extraction/record-group/`: an item is a **group** when it holds a run of records (three or more of one template, or a record pair) and shows no words of its own outside that run except in a heading or a control. The run is the one covering most of the group, so rating stars never stand in for the cards. A run is a **list of groups** when the target's item and more than half of its items are groups.
- `infer-list.ts`: at a level whose run is a list of groups, the proposal is the records inside the target's own group, provided they hold at least two values each. A list of groups is never proposed. From the shelf heading, the answer is now that shelf's cards. The shelf's "View all" becomes the run's section link (`section-link/`), which says where the whole listing is.
- Not changed: an order card holding its lines (it has its own number, date and total) stays a record of the orders list. A lone section (no sibling sections) was already answered by its cards through the outward search.

### 2. A saved read reads only its own list's page (the gap; not this run's cause)

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/list-family.ts` and `list-stands.ts`: a list stands on a page whose address shares the binding's origin and path shape (the route signature's rule: digit-holding segments read as `#`, long ones as `*`, query and hash ignored). It also stands anywhere the build's own Next page step moved it (`node-run/list-pages/`, kept by item selector from the pager's `moved` verdict). Only typed facts are used: two addresses, the binding's item selector and the pager's closed verdict.
- `node-run/run.ts` (fresh read, and a rerun while exploring) and `node-run/replay.ts` (a replayed step) check each list read after the page answers. A read whose list does not stand is refused `target_not_found`, reason `list_not_on_page` (t1013's), with `target` = its handle and `instead` = `web.list.made_on:<path>`. Its `next` says nothing was kept, names the list and the page it was detected on, and says to go back there or to detect this page's own list (`rejection-next/list-made-on.ts`). A replay fails `core.replay.failed`, `resultReason: list_not_on_page`, and answers no rows. None of the other page's rows is kept or remembered on either path.
- Not covered: a Flow's playback after the build (`output-nodes/extract-list/dispatch.ts`) runs the resolved request, which no longer carries the binding.

## Proven offline (no paid or model call)

- Unit: `record-group/tests/group-records.test.ts` (6 pass). Synthetic library shelves in the recorded structure; the first case reproduces the recorded shape (read as a list of shelves, `li:1` columns give one row per shelf).
- Browser, provider-free, visible Chromium: the content harness on the bigbox-retail fixture (`apps/extension/e2e/content/tests/record-group/tests/bigbox-home-shelves.spec.ts`). Aimed at each shelf heading, the detection answers that shelf's cards (Pickup today 8, Rollbacks 4), with no column numbered by place and with a `continues` link. Every row of the proposal's read carries its own card's link, price and rating. With the `infer-list.ts` wiring switched off, the same spec fails with `Expected: 8, Received: 2`, which is the recording's answer.
- Domain: `plan-resolution/extraction/tests/list-stands.test.ts` (5 pass). A garden shop's home page and basket draw cards from one template. Read again on the basket by the home page's handle, the read is refused naming the list and `/`, and the basket's card is not in the evidence. Replayed there it fails `list_not_on_page` with no rows, and replays on its own page. A list moved by its own Next page to `/shelf/page/2` stands there. With the check switched off, 3 of the 5 fail.
- Recorded calls: none of this run's 22 reads would be refused. Each binding was made on the home page and each read ran there (above).

## Next

Merge t1022, sync the lane, and relaunch this task. Watch whether a detection from the shelf heading now returns 8 cards with a `continues` link, whether the model compares Softerra at $9.47, and whether `a1.fulfilment` still blocks completion on a pickup state that was already set.
