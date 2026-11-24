# t1024 report: a replayed read is the same place, never another page

## Outcome
Done for model-run reads and loop passes; one stated gap for saved-Flow batches (see Open questions).

## What changed and why
Cause: a read the pager named no place for was always appended as "the next unplaced read" (`result/place-order.ts`). A Flow replayed on the page it had already read came back as another page and another "unplaced read" (bigbox `run-mwuxd2v9-33928ea3`: "4 rows over 19 pages ... unplaced read 18").

The earlier row-content match is reverted (`stableJson` rule and its header comment removed). Replacement, per the lead's correction, uses facts the answer carries, never rows:

- New `result-feed/place-of.ts` (exported from `result-feed/index.ts`): a read's `spot` is `[listKey, where, moves]`. `where` is the view its answer said (`rows/read-evidence.ts`: `read.url`, `evidence.location`, replay source). `moves` counts the moves the attempt saw for that list: a `listMove` answer with verdict `moved` (t1013, `list-move.ts`) and a loop step's pass that moved the list. A move makes the next read a new spot, by address or in place.
- `result-feed/feed.ts`: owns one such counter; `called` stamps the spot on each read (`places.spotted`), counts `moved` in the move branch and in `passed`.
- `result/types.ts` (Read and Page get optional `spot`), `result/page-set.ts` (copies it), `result/place-order.ts`: a page with the same spot as one already held is that page read again and replaces it where it stands, keeping the place that page had, unless the pager named two different places for the two (so URL paging `page=1`, `page=2` on one view stays two pages). A different list or location has its own spot.
- The pager's `place` is never filled in or invented. I first put a derived place into `place`; the existing test "never invents place from the requested page or the address" (evidence.test.ts) failed on it, rightly, since `place` feeds the evidence the judge reads and the "first page read" claim. Hence a separate `spot` that only decides replacement.

Tests added, `result-feed/tests/place-of.test.ts` (generic catalogue fixtures): six replays on one page are one place and "3 rows over 1 page"; a replay whose rows changed is still one place; in-place paging (same URL, a `listMove` moved between reads) gives two places and a replay of the second stays one; another address is its own place; an unplaced replay of a pager-placed page keeps that place (`offset=0`); two pager-named pages (`page=1`, `page=2`) on one address stay two. The three row-content tests I had put in `result/tests/ledger.test.ts` are removed. Before the fix the replay tests failed (7 places for 7 reads), as seen on the first run of the file.

## Commands run and observed results
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first/result .../result-feed .../tests/endings --maxWorkers=1 --minWorkers=1 --fileParallelism=false` (from `packages/fluxiq`, waited to exit): parallel "Test Files 30 passed (30), Tests 205 passed (205)"; real-sql "Test Files 20 passed (20), Tests 95 passed (95)"; "all groups passed: parallel, real-sql"; exit=0.
- `pnpm --filter fluxiq check` -> exit=0 (after fixing a readonly type in my own test; the first run had reported TS4104 on it).
- Core `node scripts/structure-audit.mjs` -> "structure-audit: passed (571 warning(s), 903 baselined)".
- Version untouched; no git; no Lab, browser or paid run.

## Not verified
- No replay of the recorded bigbox run through the new code; the effect is shown by synthetic feed tests only.
- That every real read answer carries `read.url` or `evidence.location` (a read with neither gets no spot and is appended as before).

## Open questions or contradictions found
- Saved-Flow batches (`batches()`, `live-pages.ts`) get no spot. A batch carries its `location` and `listKey` but no run or iteration identity, and the feed is told of batches one at a time, so it cannot tell a replay run from a Flow's own in-place paging loop; a spot from location and move count would collapse a real in-place loop into one page (data loss). Missing from the domain/engine side: a per-run, per-iteration index (or in-run move count) on the record batch. The recorded run's replays were model-run nodes (`core.run_node`), which are covered. Until then, Flow-run reads that name no place still append.
- A replay that restarts the site after a model move reads `moves=1` and spots as the moved page; a navigation/reload fact would be needed to reset the count.
- Moves are counted only for those seen through `listMove` or a loop pass.

## Addendum: the recorded case and saved-Flow runs (lead's follow-up)

**(1) Path of the recorded reads.** In `run-mwuxd2v9-33928ea3`, the replays are `core.run_node` calls with `replay: "step"` and `from.location`, one per Flow step (`0041`, `0044`, `0046`, ... `0213`: `web.output.dom-extract_list` answers "the step ran again: kept 2 rows from 1 page"). They enter the feed through `called` (replay branch, held as `pass`) and then `passed(step, ...)`, not `batches()`. Their answers carry only `readRows`: no `listKey`, no `place`, and the address comes from `call.value.from.location`. So they had a `where` but no list key and no place, and my first spot ([listKey, where, moves]) would have given every replay of every step one spot, merging the two different list reads (two draft steps folded into one version) into one page and losing rows. Fixed below.

**(2) Spot now includes the draft step; batches use their batch key.** `result-feed/place-of.ts`: a call, rerun or pass read is at [draft step id, list key, page it ran on, moves of that list]; stamped where the step is known in `feed.ts` (`add` -> the call id, `rerun` -> the rerun step, `passed` -> the passed step). So a replay of a step on its page is that spot again, and two folded steps stay two pages. A saved Flow's record batch is at [step id, batch key]. No engine change was needed: the batch key already carries the node's attempt number within its own run (`records/capture.ts`: "numbered within its own graph run ... the same each time the run is run"), which is the run/iteration index. A Flow's in-place paging loop is different attempts, so separate pages; the same Flow run again makes the same keys, so the same places. If a run's attempt numbering shifts between runs (a retry), the result is extra pages, never merged rows.

**(3) Tests** (`result-feed/tests/place-of.test.ts`): same Flow run three times on one page -> one place, "3 rows over 1 page"; a Flow with a two-page in-place loop run twice -> two places, "6 rows over 2 pages"; plus replays of one step (6 -> one place), changed rows -> still one place, in-place paging after a `listMove` -> two places, two folded steps and another address -> separate places, pager place kept, `page=1`/`page=2` on one URL stay two.

**Results.** vitest-groups command, waited to exit: parallel 30 files / 207 tests passed; real-sql 20 files / 95 tests passed; "all groups passed"; exit=0. `pnpm --filter fluxiq check` exit=0. `node scripts/structure-audit.mjs` passed (571 warnings, 903 baselined). Not touched: `runtime/llm/**`, `client-gateway/**`. Still not verified: a replay of the recorded run through the code, and that the `from.location` view is what `where` becomes in the real run (read from the call file, not run).
