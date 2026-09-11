# w1-fixture-data-table report

Worker `w1-fixture-data-table`, Wave 1 Batch B. Fixture `data-table`,
export `dataTableScenario`, corpus rows W08 and W09.

## Outcome

**Done.** The placeholder is replaced by a real sortable data-table
fixture:

- The primary workflow (W08) extracts every row by header.
- The primary workflow has one variant, `column-reorder`.
- A second workflow, `sort-by-price` (W09), sorts by price and extracts the
  first row.

Every definition-of-done check passes on the final files:

- The scenario-lab build exits 0.
- The node test passes 9 of 9.
- The Playwright spec passes 3 of 3.
- The structure audit passes, with no finding in these files.

## What changed and why

The placeholder is replaced with a real fixture. The export name, id
(`data-table`), seed (115), and start path (`/scenarios/data-table/`) are
unchanged. The title stays `Data table`. The page itself is titled
"Inventory".

Files, all under `apps/scenario-lab/` and all owned by this brief:

| File | Responsibility |
| --- | --- |
| `src/scenarios/data-table/inventory.ts` | The seeded catalog: 12 rows plus the column model (header text, and whether a column sorts as text or as a number). |
| `src/scenarios/data-table/table-state.ts` | State, `createDataTableState`, `mutateDataTableState`, and `sortView` (row order and status line for a sort). |
| `src/scenarios/data-table/table-page.ts` | Server render and the in-place sort client. |
| `src/scenarios/data-table/scenario.ts` | Manifest (W08 primary, `column-reorder` variant, `sort-by-price` W09) and `defineScenario` wiring. |
| `src/scenarios/data-table/tests/scenario.test.ts` | node:test coverage of the manifest, state, every mutate operation including the variant arm, and render. |
| `e2e/data-table.spec.ts` | Plain-Playwright drive of each workflow and the variant. |

### Page

- The page has an `<h1>`, then a `<table>` with `<caption>Current stock by
  product</caption>` and a header row of Product, Category, Price, Stock.
- Each header is `<th scope="col">` wrapping `<button
  data-testid="sort-<column>">`.
- Twelve body rows, each `<tr data-testid="inventory-row"
  data-row-id="sku-...">`. Every data cell is a bare `<td>`, so the header
  row is the only mapping from a cell to its column.
- `row-count` reads "12 products".
- `sort-status` (`role="status"`) reads "Not sorted" or "Sorted by
  <Header>, <direction>".
- A footer `seed-marker` reads "Snapshot data-table-seed-<seed>".

### Data

- Prices and stock counts are all distinct.
- Both columns need a numeric sort. Sorted as text, "$129.00" comes before
  "$9.50" and "120" comes before "18".
- Categories repeat. Ties break by product name.
- Descending is the exact reverse of ascending.

### State and mutate

State is `{ seedMarker, rows, columnOrder, sort, sortCount, lastOperation,
view: { rowOrder, description } }`, so `/__control/final-state` is the
oracle. The operations:

| Operation | Effect |
| --- | --- |
| `sort` with `{ column }` | Sorts ascending. When that column is already sorted ascending, flips it to descending. `sortCount` increments. |
| `reorder-columns` | The `column-reorder` arm. Sets `columnOrder` to Price, Stock, Category, Product and nothing else. |

Anything else, including an invalid column or payload, returns the same
state object.

### Sorting in the browser

The client embeds the eight precomputed views (4 columns × 2 directions).
They come from the same `sortView` that `mutate` uses, and the node test
proves they match.

A click does three things, in order:

1. Moves the existing rows into the new order and sets `aria-sort`,
   synchronously.
2. Records the sort through `mutate('sort')`.
3. Reconciles with the returned state, ignoring stale responses.

There is no reload. The table is already sorted when the click returns, so
an extract step straight after the click needs no `waitForState`. The e2e
spec proves this: its W09 extraction runs immediately after the click. A
reload re-renders the persisted sort from state.

## Workflows and variants

| Workflow / variant | Corpus | Script | Expected outcome |
| --- | --- | --- | --- |
| primary | W08 | `extract-inventory`: extract, target `testid:inventory-row`, fields `product/category/price/stock` = `column:Product/Category/Price/Stock` | Success. `extracted`: count 12, records = the 12 rows in catalog order. `finalState`: `row-count` text "12 products", `sort-status` text "Not sorted". |
| primary → `column-reorder` | W08 | same | Arm `{ operation: "reorder-columns" }`. Columns render as Price, Stock, Category, Product, and every column changes index. Success with the identical `extracted` expectation (restated explicitly). `finalState` is inherited. |
| `sort-by-price` | W09 | `sort-price`: click `testid:sort-price`; `extract-cheapest`: extract, target `[data-testid="inventory-row"]:first-child`, same `column:` fields | Success. `extracted`: count 1, records `[{ product: "Recycled notebook set", category: "Office", price: "$9.50", stock: "120" }]`. `finalState`: `sort-status` text "Sorted by Price, ascending". `recordingEvents`: `web.element.clicked` × 1. `actions`: `web.dom.click` succeeded. |

`sort-by-price` has no variants, per the brief.

What the e2e spec proves beyond the manifest:

- **`column-reorder`:**
  - The headers render as Price, Stock, Category, Product.
  - The first row's cells read `$34.00, 18, Kitchen, Ceramic pour-over
    set`.
  - Reading cells by index gives records different from the expected ones,
    so the variant bites.
  - Extraction by header gives the identical records.
- **W09:**
  - Only the Price header carries `aria-sort`.
  - The row order in the DOM equals the oracle's `view.rowOrder`.
  - The sort survives a reload.
  - A second click toggles to descending, and "Brass desk lamp" comes
    first.
  - `sortCount` reaches 2.

## Corpus decisions

1. **The catalog is fixed, not generated from the seed.**
   - `createState(seed)` is a pure function of the seed, but the seed
     only sets `seedMarker`.
   - The lab's `createState` receives the lab-wide seed, which is 42 in the
     specs, and the runner accepts `--seed`. Expected `records` written
     into the manifest would break under any seed but 115 if row content
     came from the seed.
   - `llm-target-drift` uses the seed the same way.
2. **W09 extracts exactly one row, through a raw CSS target.**
   - `ExpectedExtraction.records` "checks content in order". The contract
     does not say whether a one-record list passes against 12 extracted
     rows.
   - A target matching only the first row makes count 1 and records
     unambiguous under either reading.
   - The runner's `selector()` passes non-`testid:` targets through as CSS.
3. **`aria-sort` is on the `<th>`, not the button.** ARIA defines `aria-sort`
   for the columnheader role. The brief's "buttons with `aria-sort`" is read
   as "sortable headers with buttons, carrying `aria-sort`". Only the
   sorted header carries it. Before any sort, no header does.
4. **The sort arrow is CSS generated content with empty alternative text**
   (`content: " \25B2" / ""`). The header text stays exactly "Price",
   which `column:<header>` matching depends on, and so does the button's
   accessible name.
5. **Body cells are all `<td>`.** None is a `<th scope="row">`, so the
   fixture adds no second trap beyond the column reorder. A
   `column:<header>` implementation that indexes `td` elements only, not
   `row.cells`, is not exposed by this fixture.
6. **No `route` hook.** The fixture serves only its start page, and the
   node test asserts `route` is undefined.
7. **No `index.ts` barrel** in the scenario directory. Sibling scenario
   directories have none, and the registry, which I may not touch, imports
   `scenario.js` directly. A barrel nothing imports would be dead code.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension` unless noted. I ran the e2e
command as `pnpm exec playwright test -c e2e/playwright.config.ts
e2e/data-table.spec.ts` from `apps/scenario-lab`. That is equivalent to the
brief's `pnpm --filter ... exec` form.

1. `node scripts/structure-audit.mjs`, run twice. The second run was on
   the final file set.
   - Printed `structure-audit: passed (27 warning(s), 19 baselined).` and
     `structure-audit: 1 baseline entries can be lowered.`
   - `grep data-table` over the output found nothing, so these files have
     no finding.
   - The lowerable entry is not named by the audit output, and it is not
     one of mine. I did not run `pnpm structure:baseline`.
2. `pnpm --filter @fluxiq-web-extension/scenario-lab build`
   - The first two runs exited 2. The only error was
     `src/scenarios/modal-flows/mutate.ts(35,22): error TS2322`, which is in
     another fixture's directory.
   - The final two runs exited 0 with no errors.
3. `node --test apps/scenario-lab/dist/scenarios/data-table/tests/scenario.test.js`
   - Runs 1 and 2 failed to load:
     `ERR_MODULE_NOT_FOUND ... packages/test-contracts/dist/bench-report-validation.js imported from .../dist/index.js`.
     Another worker was rebuilding test-contracts, and its `index.js`
     already referenced the unemitted file. I waited, polling, until the
     file appeared at 12:53:27, then reran.
   - Run 3 printed `# pass 7`, `# fail 2`. This was a defect in my test,
     not in the fixture: `/aria-sort=/` also matched the CSS selectors
     `th[aria-sort="..."]` in the style block (3 matches instead of 1). I
     narrowed both assertions to `/<th[^>]*aria-sort=/`.
   - The final run printed `ok 1` … `ok 9`, `# tests 9`, `# pass 9`,
     `# fail 0`.
4. The Playwright spec (`e2e/data-table.spec.ts`)
   - The first two attempts printed `Error: Cannot find module
     ...bench-report-validation.js` and then `No tests found`. This was the
     same test-contracts transient.
   - After the wait it printed `3 passed (3.2s)`.
   - A final rerun on the final files printed `3 passed (2.3s)`:
     - W08 extracts every inventory row through its column headers
     - W08 column-reorder: every column moves and extraction by header
       yields the same records
     - W09 sorts by price and extracts the cheapest row; the sort persists
       and toggles

## Not verified

- **The FluxIQ runner's own `extract` and `column:<header>` implementation**
  (another worker's `w1-runner-asserts`) was not run against this fixture.
  The e2e spec drives the manifest's steps with a local plain-Playwright
  reference: header text → index → `row.cells[index]`.
- **The recording and playback lanes** with the extension loaded. That
  covers whether a click on the header button records as
  `web.element.clicked`, and whether the W09 raw CSS extract target is
  accepted by every consumer that reads targets.
- Firefox. Only Chromium (`channel: "chromium"`) was exercised.
- The full `pnpm --filter @fluxiq-web-extension/scenario-lab test` suite,
  including `src/tests/registry.test.ts` and `server.test.ts`. The brief
  names only this fixture's test. The fixture is built to satisfy the
  registry's per-scenario checks: a valid manifest, a non-checkpoint step,
  a non-empty expected field, loopback-only, and `screenshots: "events"`.
  That was not run.

## Open questions or contradictions found

- **Tooling defect, now fixed.**
  - My first write of `table-page.ts` went through a Bash heredoc. The
    tool collapsed `\\25B2` to `\25B2`, an octal escape inside a
    template literal (TS1487). That is the build break the supervisor
    reported for every fixture worker.
  - The same collapse turned the script-safe JSON escape `\\u003c` into
    `<`, which is a literal "<" and therefore a no-op.
  - Both are fixed: lines 15-16 are `\\25B2`/`\\25BC`, line 87 is
    `"\\u003c"`. The rest of the files were then written with the
    Write/Edit tools.
  - The node test asserts that the CSS escape is present.
- **Structure audit** reports "1 baseline entries can be lowered". It does
  not name the entry. It cannot be a data-table entry: the fixture has no
  baseline entries and no findings. Left for the supervisor.
- **Contract gap, not blocking.** `ExpectedExtraction` does not define how
  `records` compares with a longer extracted list, for example as a prefix
  or exactly (see corpus decision 2). The W09 expectation avoids depending
  on it.
- **Concurrency.**
  - Between about 12:50 and 12:53, `packages/test-contracts/dist/index.js`
    referenced `bench-report-validation.js` before it existed, which broke
    every import of the package.
  - A later build or test failure of this kind is most likely a parallel
    test-contracts rebuild, not this fixture.
