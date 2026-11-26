# run-mwvgjb8c-5a1f2ae3: bigbox new-store cheapest towels, wrong item accepted by the judge (fixed by t1048)

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, attempt 1,
visible Chrome, run watcher on.
Provider: Anthropic `claude-sonnet-5-5` for build and judge. Cost: $0.80 billed, 90 s, 22 calls.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-24/run-mwvgjb8c-5a1f2ae3/steps/`. Debugged offline by t1044
(`docs/working/page-diff-delivery-plan/reports/t1044.md`). No live or paid run was used to debug it.

## Attempt 1

- **Verdict:** failed. The product check accepted the answer, but the oracle marked it wrong: `missingActs`,
  `unaskedChanges: cart:5520104:pickup`.
- **Path:** the store was set, and the search read was paged.
  - Page 1's read kept 15 rows, among them the right answer: a single roll at $1.28, rated 4.5, "Pickup today".
  - Page 2's read kept 11 rows.
  - The model added "Loftwell 1 Roll $1.97, 4.6 stars" to the cart, which is not the cheapest qualifying towel.

## Why

1. **The judge never saw the right row.** A draft read that is not the answer reached the judge as a count only
   (`answer-first/result-feed/feed.ts`, `{step, position, listKey, kept}`), while page 2's rows came whole. "1.28"
   appears 0 times in the judge's request (`0042-judge/request.txt`), so the judge reasoned over page 2 only and said yes.
2. **The decider lost page 1.** Every read shared one held view group, `holder:read`
   (`runtime/llm/decision-context/current-view.ts`). Page 2's read evicted page 1's rows: "1.28" appears 4 times in
   0023's request, 2 in 0025's, and 0 from 0027 on. The model chose the cheapest row it could still see.

## Fixed

- **t1044 (fluxiq 0.54.24):** a judge continuation no longer claims a call is shown above when its view is outside
  the prefix.
- **t1048 (fluxiq 0.54.27):** working reads go to the judge page by page with their rows. The decider holds one view
  group per list key, pager place and address, so page 1 and page 2 both stay in view. Tests use this run's list
  keys, places and row counts.

## Next

Rerun this task live on Sonnet, `--attempts 4`, with the watcher. Accept it only if attempt 1 adds the $1.28 roll and
the oracle passes, and attempts 2 to 4 run the saved Flow.
