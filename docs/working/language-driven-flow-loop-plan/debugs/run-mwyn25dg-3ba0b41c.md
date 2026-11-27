# run-mwyn25dg-3ba0b41c: kestrel auctions, stopped by the lead after 40 decisions with no act

Lane: `live-lane-2` (tree `fxwork/t1059-live-lane-2`). Task: `auction-marketplace/auction-marketplace-kestrel-auctions`,
answer-first, attempt 1, visible Chrome, run watcher on. fluxiq 0.54.33 (after t1070's refusal reasons).
Provider: Anthropic `claude-sonnet-5-5`. The lead stopped the run at $3.57.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyn25dg-3ba0b41c/steps/` (0001-0108). Debugged offline from
the step files and the code at 0.54.33 (Core worktree `fxwork/t1074/!FluxIQ`). No live or paid run was used.
Fix: t1074 (report `docs/working/page-diff-delivery-plan/reports/t1074.md` in the t1074 tree).

The request names its columns: "... soonest-ending first, with columns title, price, bids and postage, each exactly as
the listing's search result shows it, the price in the listing's own currency."

## What happened

| Steps | What it did |
| --- | --- |
| 0001-0012 | Searched, filtered to auctions, detected the list, read page 1 with the read's own keys (26 rows: `link_text`, `price`, `text_4` the pound estimate, `text_5` bids, `text_9` postage, ...). |
| 0013-0016 | Declared the processing. 0014 was withheld for evidence ("anyOf[1] gbp_own from price (missing)" on rows 7, 11, 20); 0016 kept 0 rows. |
| 0017-0043 | Built Next page and the repeat (three `already_so` refusals, a `same_fix` steer), read page 2 (0043, 20 rows; 46 rows in all). |
| 0044-0085 | Declared the processing 17 more times. Every one that parsed kept 0 rows (0049, 0053, 0055, ...: "no qualifying records; 0 rows kept"). Completion was refused `answer_first.processing_empty` four times (0057, 0067, 0076, 0081). `no_progress` x12 steered at 0072; `finish_with_best` at 0080 could not end. 0083 split the price bounds into four `anyOf` groups and kept 0. 0085 was accepted (10 rows) only after the model gave up on conditions and listed the ten titles it had picked by hand as `link_text equals [...]`. |
| 0086-0108 | Completion refused `answer_first.not_asked_table` (0087): the rows held `link_text`, `text_5`, `text_9`, not title, bids, postage. Re-read naming the columns (0089), declared the processing again over the new names (0093, 0099 refused, 0104 empty, 0106 set), ran the Flow. Stopped. |

## Why

1. **`anyOf` meant the opposite of what the model wrote** (0014-0085, most of the run).
   - The evaluator read every `anyOf` group as its own filter that must hold, holding when any one of its conditions
     held (`packages/contracts/src/record-sets/process/readiness/filters.ts`). All 17 `anyOf` declarations here were
     written as alternatives: one group for a price in pounds, one for the site's pound estimate of a foreign price.
     Read as "both groups hold", no row qualifies: a pound-priced listing shows no estimate.
   - Confirmed offline on the 46 recorded rows: 0049's `anyOf` alone leaves out every row (`[[price matches ^£...],
     [text_4 matches ^approx. £...]]`); every `where` condition keeps rows.
   - 0014's withholding is the same misreading: its second group was "no estimate and the pound price under 150"; for a
     foreign row the estimate shows, so that group's `gbp_own` is unreadable and the group undecided, though the first
     group decides the row.
   - Not this run alone: all 31 recorded `anyOf` declarations (this run, run-mwyg0x66-4d561a42, run-mwyfoz8o-507c92f6)
     were written as alternatives. The tool's description said only `anyOf [[conditions]]`.
2. **The result was not the asked table** (0087-0106). As in run-mwyfx9fs-06a170bf. The model's own notes said which
   key held which column ("link_text (title), text_5 (bids), text_9 (postage)", 0014), but processing cannot rename, so
   it read the list again naming the columns and declared everything again over the new names.
3. **A held declaration did not follow the rename** (0093-0104, as in run-mwyfx9fs 0067-0081): the binding resolved only
   exact ids and labels, though the new read's `fields` said `title` is read from `link_text`.
4. **Prices that a pound pattern cannot read** ("EUR 95,00", "US $189.00", "£18.00 to £26.00") made the model's derived
   `gbp_price` absent on those rows; under (1) that withheld the answer. With alternatives, the estimate's group decides
   them.

## Fixed in t1074 (Core)

- `anyOf` is now one filter whose groups are alternatives: a row passes when every condition of any one group holds
  (`process/any-of.ts`, `readiness/filters.ts`, `process-rows.ts`). A row is decided by the groups with evidence for it:
  kept when one holds, left out when every group is known false, withheld only when no group decides it, naming only the
  undecided groups' values. The tool description, the instruction prompt and the record-output help say so.
- Proven on the 46 recorded rows (`process/tests/run-mwyn25dg/`): 0053's declaration keeps exactly the ten auctions the
  task owes, soonest-ending first; 0049's keeps nine (its own `manual` exclusion drops the camera sold with a manual, and
  the account names it under `where[3]`); 0014's is ready, the EUR 109 camera kept by its estimate.
- The data stage places the request's columns on the read's keys from evidence (by name, by the column's name in the
  values, or by the declaration's own `columns` order where the evidence agrees), binds the request's names through that
  placing, shows the answer under the request's names, and says the placing to the model. On these rows: price by name,
  bids (`text_5`) and postage (`text_9`) by their values, title (`link_text`) by 0049's own order.
- A held declaration rebinds through the output read's renamed `fields`.

## Next

- Rerun this task only after t1074 merges. Expect the first parsed declaration (0049's kind) to be ready, and no
  `not_asked_table` refusal.
