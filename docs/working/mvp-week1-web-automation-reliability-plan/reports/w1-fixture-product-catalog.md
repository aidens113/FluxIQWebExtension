# Report: w1-fixture-product-catalog

## Outcome

Done. The `product-catalog` placeholder is replaced by the corpus W04-W07 fixture. Build, node tests, Playwright spec, and structure audit pass.

## What changed and why

All files are new and under owned paths (`git status` shows only untracked files there).

- `apps/scenario-lab/src/scenarios/product-catalog/`: `scenario.ts` (`productCatalogScenario`; id, seed 114, start path, and title kept), `manifest.ts`, `products.ts` (23 authored products), `listing.ts` (search, filter, 8 per page), `state.ts` (`show`, `set-variant`, `view-product`), `route.ts`, `markup.ts`, `format.ts`, `client-script.ts`, `types.ts`, `tests/scenario.test.ts` (9 node:test cases).
- `apps/scenario-lab/e2e/product-catalog.spec.ts` (9 Playwright tests).

Page: a search form (`search-input`, `search-submit`; applies on submit only, by Enter or button), an `in-stock-only` checkbox (applies on change), and a `results` region holding `result-count` ("23 products", "4 results"), `search-summary` (`Results for "lamp"`, only while searching), `active-filters` (only while filtered), `product-card` items (`product-name` wrapping `product-link`, `product-price`, `product-rating`, `stock-badge`), `empty-results`, and a pagination nav with `page-status` ("Page 2 of 3"), `pagination-page-N`, and `pagination-next`, which is absent on the last page.

Each later view is fetched, after a fixed 150 ms delay, from `GET /scenarios/product-catalog/results?page=&q=&stock=in`. The route renders the fragment and records the view through `mutate` (`show`), so `/__control/final-state` holds `variant`, `view`, `oracle {resultCount, pageCount, productIds}`, `viewHistory`, and `productViews`. `aria-busy` on `results` is true while a view loads. Product pages are served by `route` at `products/<slug>` and record `view-product`; an unknown slug is a 404. The page embeds no run token.

### Workflows and variants

| Row | Workflow / variant | Script | Expected outcome |
| --- | --- | --- | --- |
| W04 | primary | extract `product-card`: name, price, rating, url | 8 records p01-p08, prices like `$1,249.00`; `Page 1 of 3` |
| W04 | `text-variant` | same | same 8 records; only prices change, to `1,249.00 USD` |
| W05 | `paginated-extraction` | extract with `pagination {next: testid:pagination-next, maxPages: 5}` | 23 records in catalog order; `Page 3 of 3`; Next absent |
| W05 | `short-catalog` | same | catalog is 5 products on one page: 5 records; `Page 1 of 1`; Next absent |
| W06 | `search` | type `lamp`, press Enter, waitForState `search-summary`, extract | 4 records: Aurora Desk Lamp, Juniper Floor Lamp (out of stock), Ridge Clip Lamp, Willow Reading Lamp; `4 results` |
| W06 | `no-results` | same | success with 0 records; `0 results`; `empty-results` shown |
| W07 | `in-stock-only` | check `in-stock-only`, waitForState `active-filters`, extract with pagination plus `availability` | 18 records, all `In stock`; `18 products`; `Page 3 of 3` |

Every arm is `{ operation: "set-variant", payload: { variant: "<id>" } }`; `baseline` restores. Arming resets `view` to the start view, where a run begins.

### Corpus decisions

1. The catalog is authored and the same for every lab seed. Expected records are literal text, so content that moved with the lab seed would fail under any runner seed but 114. The e2e runs the lab at seed 42 to prove it.
2. `url` reads the raw `href` attribute, written root-relative, because the absolute URL carries the per-run port.
3. W07 extracts every in-stock product across all three filtered pages, not page 1 only, and adds an `availability` field so "only in-stock" is visible in the records. If the row means page 1, drop `pagination` from `extract-in-stock` and keep the first 8 records.
4. W06 submits with Enter; the button path is covered by the extra e2e test.
5. `no-results` empties search results only (browsing is unchanged); `short-catalog` keeps the first five products; `text-variant` changes price text only.
6. No `recordingEvents` or `actions` expectations: I do not know the event or action names the recorder emits for type, press, check, or extract, and did not assert guessed ones. Facts use the existing form (subject is a test id, predicate `text` or `exists`), which is how the e2e reads them.

## Commands run and observed results

- `tsc -p <scratch tsconfig: e2e/product-catalog.spec.ts, noEmit, DOM lib>` from `apps/scenario-lab` -> exit 0, no diagnostics (covers the fixture sources through the spec imports).
- `pnpm --filter @fluxiq-web-extension/scenario-lab build` -> exit 0, no diagnostics.
- `node --test apps/scenario-lab/dist/scenarios/product-catalog/tests/scenario.test.js` -> first run 8 pass, 1 fail (my count helper also matched test ids inside the client script). I fixed the test to count only markup before `<script`, rebuilt -> `# tests 9`, `# pass 9`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/product-catalog.spec.ts` -> `9 passed (4.6s)`; again with `--repeat-each=3` -> `27 passed (11.0s)`.
- `node --test apps/scenario-lab/dist/tests/registry.test.js server.test.js state-store.test.js` -> `# pass 17`, `# fail 0`.
- `node scripts/structure-audit.mjs`, before and after my edits -> `passed (27 warning(s), 19 baselined)` both times, with no line naming a product-catalog path. It prints `1 baseline entries can be lowered`; that line was already there before my edits.

The e2e and shared-test runs predate the unit-test fix, which changed only `tests/scenario.test.ts`, a file neither imports.

## Not verified

- Recording or playback through the extension or the test runner. The e2e drives the manifest scripts with its own Playwright interpreter, reading `testid:` selectors and `selector@attribute` as the `ScenarioStep` comment describes; the Wave 2 extract implementation may differ.
- How the runner evaluates `pageFacts` and `finalState`.
- Firefox; only headless Chromium ran.
- Repository-wide `pnpm check`, `pnpm test`, and `pnpm build`.

## Open questions or contradictions found

- Decisions 3 and 6 are judgment calls to confirm against the corpus rows.
- Bash-tool commands over about 8 KB fail with a bash "unexpected EOF while looking for matching quote" error (the Windows command-line limit), so I wrote the large files in chunks. Other workers writing large files through Bash will hit the same limit.
- No scenario directory has an `index.ts` barrel (the registry imports `scenario.js` directly), so I added none.
