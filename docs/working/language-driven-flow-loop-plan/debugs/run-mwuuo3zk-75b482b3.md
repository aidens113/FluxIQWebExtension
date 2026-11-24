# run-mwuuo3zk-75b482b3: bigbox new-store cheapest towels, stopped (read the wrong handle, never read the columns it needed)

Lane: t1015 `paid-bigbox`, relaunch of `run-mwus396e-5447c6f6` after t1018 and t1019 merged.
Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, attempt 1 of 4, visible Chrome, run watcher on.
Provider: Anthropic `claude-haiku-5-5` for build and judge.
Evidence copy: `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwuuo3zk-75b482b3/` (steps, Core log, Core store). Debugged offline by t1020; no live or paid run.

## Attempt 1 (attempts 2-4 not run)

- Verdict: **stopped by the lead** at step 309, not judged. Started 15:29:03 UTC; last step about 15:39:35.
- Calls: 143 (1 chat interpretation, 142 decisions). **$1.83** by the step index ($1.80 by the watcher at step 309).
- Path: the model searched, set the new store, applied the Pickup filter (17 acts in all), asked for a structure detection 52 times (17 answered, the rest refused as stale handles or repeats) and called a list read 8 times. Its draft's list read was pinned to the wrong handle from step 23 on (below). It never added to the cart, so the cart table the task asks for was never read: completions were refused `answer_first.processing_binding_missing` (item, quantity missing; steps 100, 123, 214) and `processing_schema_missing` (246, 303).
- Loop handling: 11 steers and 8 loop decisions, none with effect. Watcher alerts: `repeated_call` on `web.detect_repeating_structure` (steps 174, 242, 291), `no_act_after_loop` (225-241), `no_act` (40 decisions, to 278), `no_new_evidence` (240-300).

## What the lead read, and what the steps say

The lead's account was that the draft's read (`extraction.18`, links inside each card, with the card as a group) kept 16 rows each holding only `name` or only `url`. The steps say otherwise on that point:

- `extraction.18` was made at step 68 (target `t1446`, the results page with Pickup applied). It is not the list: it is the detection's **`cells`**, offered beside the card list `extraction.17`. Every one of the 17 detections answered in this run offered the same pair (`extraction.1`/`.2` at step 12, and so on).
- The read at step 70 with `extraction.18` returned 16 rows **each carrying name, url and price**; one row (the card's second link) had a blank name. The rows at step 235 (`core.replay.replayed`) that look like one field each are Core's `readRows.rows`, which are **labels**, one naming column per row (`runtime/result-verification/build-test/read-rows.ts` in Core), not the rows.
- So the read was not split. It was the wrong unit of item with too few columns: one row per link, the price taken as each row's "group heading", and no rating or fulfilment column at all. It was accepted because nothing was wrong with it as a read.

## Causes (proven offline)

1. **The content script offered a card list's own links as a grid of cells.** `apps/extension/src/content/extraction/cell-run/grid-cells.ts` called a control kind a grid when one group held two of them side by side. Each card holds its title link straight inside it, and the one card whose product has several sizes holds an Options link beside it, where the other cards have an Add button. So 15 title links plus one Options link became a 16-row "grid". Its heading column was the card's first full text column outside the links, the price. These cells are the card list again, with fewer columns.
2. **A read naming another handle's keys was refused with codes alone.** Step 15 read the list `extraction.1` with `name: span_css-0ek4plr` and `url: item_url`, which are two of the cells' keys. It was refused `column_not_in_detected_list` with `instead: [web.handle.unknown_field, ..., web.handle.unknown_field:extractList.fields.1, <handle shapes>]` and no `next`. Step 63 got the same refusal for the same mistake. The resolver had the name and the list's columns (`issues: [{code, field, valid}]`), and `node-run/run.ts` dropped them. The model then switched to the cells handle, where those keys were accepted (step 23 `extraction.6`, step 69 `extraction.18`), and kept that read for the rest of the run. Its later reads that added rating and pickup keys to a cells handle were refused (steps 304, 311).
3. **Nothing said which keys go with which handle, or how a new detection replaces the draft's read.** The detection packet carried notes for the next page, the cells, `at` and marks, and none on how its own handle is read. The model saw the card list's rating and pickup columns in every detection (it said so, step 175: "the rating/pickup read is already retained"), but it never read with the list handle after step 63, and never replaced the draft's read step.

Not a cause: no refusal blocked a correct replacement. No replacement was tried. A rerun in the same round that changes a read's handle merges over the step's shown input, which holds no saved binding, and runs (checked by a scratch domain probe, not kept).

## Fix, t1020 (downstream only; Core unchanged)

- `cell-run/grid-cells.ts`: a kind is a grid only when at least half of the groups that hold it hold two or more side by side. One control per group is the group's own control, which the run already reads. Test: `apps/extension/src/content/extraction/cell-run/tests/cell-run.test.ts`, with rental cards built like the recorded page (title link first, one card with a second link). The old rule offers them as cells and fails that test and the sparse-timetable case; the new rule passes, and the cinema grid is unchanged.
- `node-run/refusal-detail/` and `rejection-next/unknown-column.ts`: the refusal carries each refused name as `web.handle.unknown_column.<name>` in `instead`. Its `next` says the name is not a column of the list this read's handle names, that a read takes only the keys under its own handle's fields, and that a key under cells or record belongs to their handle. A repeat says the same.
- `structure/packet.ts`: every packet carries `readNote`, built around its handle. It says to name that handle in `extractList` with keys from its own fields, that a key under cells or record needs their handle, and that a read the draft holds is replaced by running the new read as a step and dropping the old one.
- Offline proof on the recorded shape: `domain/src/runtime/llm-evidence/tests/split-rows-read.test.ts`. The packet is synthetic (a rental catalog in the recorded structure, no recorded page data). Step 15's call shape is refused with `next` naming `item_url`. Without the fix, the same test gets the recording's exact codes-only refusal. The list's own keys read the card as the row with every column.

## Next

Merge t1020, sync the lane, then relaunch this task. Watch whether the model reads the card list with its rating and pickup columns, and whether it then goes on to add to the cart and read the cart (the task's answer), which this run never reached.
