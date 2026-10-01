# t194-w34: the stale job-board extraction row, then the probe specs' run

## Outcome

Partial.

- Task 1 is done. The stale row is rewritten to F10's contract, and a second row is added that shows the pager's own Next being followed. Both pass. No source was edited.
- Task 2 is not green. 105 rows passed and 1 failed. The failure is the kestrel "filter route, G1" row. It fails the same way in each of three runs, so it is not intermittent. The cause is the row's own `cleanTitle` heuristic, not the product (see Open questions). I did not edit that spec, because the brief does not let me.

## What changed and why

The only file changed is `apps/extension/e2e/content/tests/extraction/tests/job-board-listing.spec.ts`.

- **The old row (`:90`, now `:95`).** It is renamed "a read whose next control names nothing, on a page whose pager offers no way forward, stops on its first page and says so".
  - It opens `?page=999`. `pageOfResults` (`catalog/search.ts:42-46`) clamps that to the board's last page.
  - `pagerMarkup` (`board/results-page.ts:95-102`) draws no Next on the last page. It draws the current page as a plain `<b>` with no `aria-current`.
  - So `nextControlOnPage` finds no labelled Next and no number after a marked current page, and returns `undefined`. The read ends with `control_absent`.
  - The row first asserts both preconditions (no `nav a` reading "Next", and no `nav [aria-current]`). It then asserts, unchanged, `pagesRead: 1, truncated: false, paginationStop: "control_absent"` and the validation sentence "paging stopped on the first page because the pagination control named nothing there".
  - A comment above the row cites `detect-pagination.ts` `nextControlOnPage`, so the reason for the setup is on record.
- **New row (`:111`)**, "a read whose next control names nothing, on a page with a pager, follows the board's own Next".
  - It opens page one and sends the same `paginate: { next: "[data-no-such-next]" }` read.
  - It uses the fire-and-forget `harness.deliver` pattern from the consent-wall row, because following Next loads a new document and the harness's script dies with page one.
  - It asserts the page reaches `?page=2`, which is observable without the reply. It cannot assert `pagesRead` for the same reason.
- **Source against its documented contract.** I found no contradiction. The header at `detect-pagination.ts:170-194` and the code at `:226-241` agree, and `pagination.ts:403-404` maps an undefined choice to `control_absent`.

## Commands run and observed results

1. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w34 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests e2e/content/tests/live-tasks/tests --reporter=list --output=e2e/test-results/t194-w34`
   - Exit 1: `1 failed` / `105 passed (5.3m)`.
   - Every job-board-listing row was `ok`:
     - `:59` (ok 53)
     - `:95` (ok 54, the rewritten row)
     - `:111` (ok 55, the new row)
     - `:130` (ok 56)
     - `:144` (ok 57)
     - `:166` (ok 58)
   - The failed row is `auction-marketplace-kestrel-auctions.spec.ts:541:3` "filter route, G1: a read built from the detection through the evidence runtime returns the ten owed rows".
     - Assertion `:319`: `expect(cleanest.length, "one column reads the title alone: …").toBe(1)`.
     - Received `0`, expected `1`.
     - Note line: `title candidates: ["div.css-0ce5ehb > a.css-16ijmrv: New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut","div.css-0ce5ehb > a.css-16ijmrv > div > span: Kestrel 35 Rangefinder Camera","div.css-0ce5ehb > div:2 > span:2: Kestrel"]`
2. I ran the same command alone twice, adding `e2e/content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts -g "filter route, G1"` and the outputs `t194-w34-k1` and `t194-w34-k2`.
   - Run 1: exit 1, `1 failed` (33.5s). The candidates were identical.
   - Run 2: exit 1, `1 failed` (28.3s). The candidates were identical.
3. `bash …/heavy.sh "t194-w34 tsc" npx tsc -p apps/extension/tsconfig.test.json --noEmit`
   - Exit 2.
   - Exactly the three known TS2610 errors, and no others:
     - `panel/extraction/tests/dialog-dom.ts(16,37)`
     - `panel/recording/review/tests/recording-review.test.ts(20,16)`
     - `panel/settings/tests/forget-confirmation.test.ts(17,16)`
4. `node scripts/structure-audit.mjs`: `structure-audit: passed (145 warning(s), 118 baselined).`, exit 0.

## Earlier evidence for the kestrel row

The kestrel "filter route, G1" row failed in the earlier workers' runs as well, back when it was a `test.fail` row:

- w28: `:506`, "still an expected failure"; it picked the link text.
- w32: `:504`, "failed as expected (`x 8`)".

Since then the row was reworked in the uncommitted tree to pick its title through `cleanTitle`, and its `test.fail` marker came off. I did not see a run of the reworked row before mine.

## Not verified

- On the new row I did not check `pagesRead` or the read's final reply. The new document destroys the script, so the row proves only that the read went to page two.
- I did not inspect the kestrel trace beyond the note line.
- The tree has many uncommitted changes from other workers and the lead, so this run bundled all of them.

## Open questions or contradictions found

- **The kestrel `cleanTitle` heuristic cannot pick a column on this fixture.** Detection now proposes three title candidates:
  1. The link's words.
  2. The span that holds the title alone. This is w28's fix, and its values look right: "Kestrel 35 Rangefinder Camera".
  3. `div:2 > span:2`, which on the shown card reads just "Kestrel". It looks like a brand or attribute line.
- The rule keeps a column only when each of its values is contained in *every* other candidate's value on the same card.
  - The title span fails, because its value is not inside "Kestrel".
  - The brand column must fail on at least one card, since `cleanest` is empty. That would be a card where its value is not inside the title.
- So no column qualifies. The defect is in the spec's selection rule, which is owned by the lead and not by me. Two possible fixes:
  - Exclude candidates whose values are strictly shorter fragments that the title column contains.
  - Prefer the candidate that is contained in the link column and contains most of the others.
- The product side looks fixed: the keyword-route rows that supply G1 pass.
