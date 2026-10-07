# Report: s6-e2e-specs (worker-high, read-list S6)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t290/!FluxIQWebExtension`, branch `task/t290-read-list-s6-migration`. Nothing committed.

## Outcome

Partial. All 19 failures are traced to a cause. 18 now pass after spec changes. The 19th exposed a product defect in the
new Next page step (GAP N1 below), which needs a product fix. Its owed-rows intent is checked in a passing test, and
the defect is pinned in its own `test.fail` row, which flips when the product is fixed. Final 14-file run:
`1 failed, 87 passed`. The one failure is `everything-store-next-page.spec.ts`, which I did not own and did not edit.
It is flaky: it passed 1 of 2 runs on its own (see "Open questions").

## Causes found

Five causes. Only one of them is the read-list change working as designed.

| Cause | Kind | Evidence |
|---|---|---|
| A. A handle-form read writing `paginate: false` is refused `web.handle.malformed` (`malformed:extractList.paginate`, hint `...extract_list.next_page`) | read-list S4 (W-C1), intended | log: `"reason":"malformed_handle","instead":[..."web.handle.malformed:extractList.paginate"...]` |
| B. The content script's page-bound sentence changed to `paging stopped because extractList.paginate.maxPages = N was reached while the list went on; the read is incomplete -- rerun with input: {extractList: {paginate: {maxPages: N}}} to read more` | **not** read-list; intended change on dev, commit `326ad350` (t262, 2026-10-03, report `mvp-live-continuation-2026-10-03/reports/pagination-bound-feedback.md`); `apps/extension/src/content/actions/extract-list.ts:380` | The specs pinned the old text. The unit test `extract-list-paging-account.test.ts` was updated in that commit. |
| C. Detection labels for hashed class-path columns now say what the element is and quote a sample (`link: 'Kestrel 35 Rangefinder Camera'`), and each column carries `sample` | **not** read-list; intended, commit `b05e186b` (t279, 2026-10-06, "Detection ... shows each field's sample and a readable label (R2-U-9, D3-3)"); `domain/src/runtime/llm-evidence/structure/field-sample.ts:74-78` | Keys are unchanged by design (field-sample.ts:30-33). |
| D. A condition over a column the read keeps is resolved to `field: <kept key>`, not `read: <spec>` | **not** read-list; intended, commit `c8be5125` (lane C F35-F37, 2026-10-01, report `t194-w42-conditions-by-key.md`); `domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts:42-53,165-167` | These rows were masked by cause A until now. |
| E. Next page on the last page follows a script Next backwards and answers `moved` | **product defect** from read-list S5, commit `3ac340bc` (t284); `apps/extension/src/content/extraction/page-advance/follow-next.ts:59-60` | See GAP N1. |

## One row per failing test (the supervisor's run, 19 of 87)

| # | Test | Cause | What changed |
|---|---|---|---|
| 1 | everything-store-cart-names: the cart read in the instruction's own names... | A | Dropped `paginate: false` from the handle read. |
| 2 | extract-list-catalog: maxPages: stopping with a page left is reported as truncated | B | Expected text set to the 326ad350 sentence (`maxPages = 2`). The request goes straight to the content script, and that paging loop stays until S7. |
| 3 | extract-list-pagination: scroll: maxScrolls stops the read... | B | As above (`maxScrolls = 2`). |
| 4 | extract-list-pagination: loadMore: ... a vanished control ends the list | B | As above (`maxPages = 2`). |
| 5 | item-conditions: the model names which items it wants... | C, then A | The assertion "the packet quotes no value read inside an item" (old D3) was superseded by D3-3. It is replaced by: every `sample` is one line of at most 40 characters, still no `item` and no `:scope`. Dropped `paginate: false`. |
| 6 | job-board-listing: a read that reached its page bound says the list went on | B | `stringContaining` set to the 326ad350 sentence (`maxPages = 1`). |
| 7 | list-completeness: a bound the plan writes over a column it renamed... | A, then D | Dropped `paginate: false` (two reads). The condition now asserts `field === <the renamed kept key>`, `read` undefined, and that the key is in `request.fields`. Title is now "...names that column by its kept key and is applied to the page". |
| 8 | kestrel: filter route, G1: a read built from the detection through the evidence runtime... | C | `labelled` (label regex) became `keyed`: the same path shapes, matched on the key, which proposal and packet share and which did not change. |
| 9 | kestrel: keyword route: through the evidence runtime the handle's read... | C, then A/S4 | `keyed`, as in row 8. The resolved read now has `paginate` undefined and reads page one (`pagesRead: 1`). That the list goes on is asserted on the packet: `pagination === "numbered_pages"` and `nextPageNote` names `nextPage: {list: "<handle>"}`. The cross-document whole read still goes straight to the content script, with the pager selector taken from the content script's own proposal. Title updated. |
| 10-17 | crossborder (8 rows: lazy tail; detection at load; thirteen ads out; four-column answer; page 1 conditions; across three documents; list-layout replay; G1+G2 selectors) | A (all 8); row 14 then D | Dropped `paginate: false` from all six handle reads. In "keeps the thirteen, ads out" the rating condition is now expected as `field: "rating"`, `read` undefined (D). The ad mark stays `read`. The header comment's "labels are paths (D3)" is corrected. |
| 18 | professional-network: a read built only from the proposal, asking for every page, returns the 23 people | A/S4 (a handle read with `paginate: {maxPages: 5}`), then E | Migrated to read, Next page (`nextPage: {list: packet.extraction}` via `web.output.dom-next_page`), read, Next page, read, through the evidence runtime. It asserts page 1 to 2 (moved), page 2 to 3 (moved, `by: "following"`, so G1 still holds), and the rows deduped by name across pages equal `EXPECTED`. Per-page dedupe no longer spans pages: page 3 repeats "Lars Hoekstra", and Core's `recordOutput.process` now does that dedupe. **New row** "on the last page Next page answers that the list ended..." is `test.fail` with GAP N1. |
| 19 | professional-network: a plan that names the numbered pager it sees keeps the page bound it asked for | A/S4 (G2 is retired) | Now asserts the new refusal: `web.action.rejected.target_unobserved`, evidence carries `malformed_handle`, `web.handle.malformed:extractList.paginate` and `web.handle.expected.extract_list.next_page`, and no read reached the page. Title is now "a plan that writes a page bound on the read is refused and pointed at Next page". |

### GAP N1: product defect (not fixed; product source is outside this brief)

- Where: `apps/extension/src/content/extraction/page-advance/follow-next.ts:59-60`, added in `3ac340bc` (read-list
  S4+S5, W-D's split from `pagination.ts`).
- What: for a Next with no address (a script button) or one that leads to this page, the step swaps in
  `pager.following`. When the pager shows no following number, the swap is skipped (`following` undefined) and the
  step presses the Next anyway.
- Observed on Guildline, page 3 of 3: `{"nextPage":{"outcome":"moved","by":"next","page":2}}`. The site's script Next
  always loads page 2. A Flow's read-and-Next-page loop then cycled through pages 2, 3, 2, 3 (log lines `next page
  3..5`). It did this in both runs.
- Why it went unseen: the read's paged loop had `page_repeated` as a backstop. A stateless step has none.
- Likely fix: when the Next is unaddressed or self-leading, `readPager` found a current page, and `pager.later ===
  false`, answer `{outcome: "ended", stop: "no_following_page"}` without pressing.
- Pinned by: `professional-network-rotterdam-data-engineers.spec.ts`, test "on the last page Next page answers that
  the list ended, rather than following the script Next back" (`test.fail`, so it flips when fixed).

## Files changed (all under `apps/extension/e2e/content/tests/`)

- `extraction/tests/everything-store-cart-names.spec.ts`, `item-conditions.spec.ts`, `list-completeness.spec.ts`
- `extraction/tests/extract-list-catalog.spec.ts`, `extract-list-pagination.spec.ts`, `job-board-listing.spec.ts`
- `live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts`, `crossborder-marketplace-spain-hubs.spec.ts`,
  `professional-network-rotterdam-data-engineers.spec.ts`

No helpers, fixtures, product source, docs or other specs were touched.

## Commands run and observed results

Run from `apps/extension` unless noted. Logs are in the session scratchpad as `s6w-run*.txt`.

1. All 9 owned files: `pnpm.cmd run test:content -- <9 files> --reporter=line` -> `3 failed`, `59 passed (7.1m)`. The 3
   failures were list-completeness (D), crossborder "thirteen ads out" (D), and professional-network Next page (E).
2. After the fixes, the 3 affected tests by `--grep` -> `5 passed (2.3m)`. One of the 5 is the `test.fail` N1 row,
   which again logged `next page 3 ... "moved","by":"next","page":2`.
3. All 14 files (the 9, plus everything-store-next-page, extract-list-continuation, pagination-stop,
   structure-detection, local-classifieds-bike-search) -> **`1 failed`, `87 passed (6.1m)`**. The failure was
   `everything-store-next-page.spec.ts:94`, `page.evaluate: Execution context was destroyed`, at the spec's own resend
   (`everything-store-next-page.spec.ts:89`, called from `:110`).
4. `everything-store-next-page.spec.ts` alone, twice: run 1 `2 passed (1.1m)`; run 2 `1 failed, 1 passed (25.8s)`,
   with the same error.
5. `pnpm.cmd --filter @fluxiq-web-extension/extension check` (tree root) -> exit 0. The build cache had no stamp, so
   the check ran in full. `tsconfig.test.json` includes `e2e/**/*.ts`.
6. `node scripts/structure-audit.mjs` (tree root) -> exit 0, `structure-audit: passed (176 warning(s), 118 baselined)`.
   The lead's S4/S5 count was 172; the extra warnings were not investigated and are likely from other concurrent edits
   in this tree.

## Not verified

- Firefox, and real-extension (non-harness) runs; no Lab or provider run.
- That `test.fail` is the form the supervisor wants for GAP N1. The alternative is a plain failing row until the
  product fix lands.
- The cause of the next-page spec's flake (see below). Neither of its runs here passed 2 for 2.

## Open questions or contradictions found

- **everything-store-next-page flake (not my file).** The helper `nextPage` (`:84-91`) catches the lost reply, calls
  `waitForLoadState("load")`, then resends. The resend sometimes runs in a document that is replaced again.
  - Likely cause: `waitForLoadState` resolves on the old document before the navigation commits, or the store's
    browser check loads a second document.
  - Not traced; it needs that spec's owner. It was in the supervisor's passing 68 and passed W-J's runs.
- **Content-script paging is still pinned in specs that S7 will break.** These go straight to the content script with
  `paginate`, which this brief told me to leave alone:
  - extract-list-catalog, extract-list-pagination, job-board-listing;
  - kestrel: the cross-document whole read and the Next-arrow row;
  - crossborder: the "across three documents" row;
  - professional-network: `RECORDED_READ` (numbered, `maxPages: 5`).
- **The page-bound sentence (cause B) contradicts the redesign.** It tells the model to "rerun with input:
  {extractList: {paginate: {maxPages: N}}}", which is the handle form that S4 now refuses. Today only a
  content-script-direct request reaches it, since domain reads carry no multi-page `paginate`. S7 should remove or
  reword it.
- The professional-network rows rely on Core-side dedupe across pages (page 3 repeats a person). The spec does that
  dedupe by name itself, standing in for `recordOutput.process`.

Outcome: Partial
