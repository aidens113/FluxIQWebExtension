# Report: w1-fixture-multi-tab

Worker: `w1-fixture-multi-tab`. Brief: `briefs/wave-1.md` § "Brief: w1-fixture-multi-tab"
plus "Fixture briefs: common terms". Corpus row W15.

## Outcome

Done. The `multi-tab` placeholder is replaced by a real fixture. It keeps
export `multiTabScenario`, id `multi-tab`, seed 118, and start path
`/scenarios/multi-tab/`; the title stays "Multiple tabs". The unit tests
(7/7) and the page spec (4/4) pass, and the structure audit shows no finding
in any multi-tab file. Final validation state: see "Commands run".

## What changed and why

All paths are under `apps/scenario-lab/`. Nothing outside the owned paths was edited.

| File | Responsibility |
| --- | --- |
| `src/scenarios/multi-tab/scenario.ts` | `defineScenario`: wires state, `mutate`, `render`, and the `route` for `details/<order>` |
| `src/scenarios/multi-tab/manifest.ts` | `multiTabManifest`: the W15 script, expectations, and the `popup-blocked` variant |
| `src/scenarios/multi-tab/purchase-orders.ts` | `purchaseOrdersFor(seed)`: four orders from a seeded mulberry32 generator |
| `src/scenarios/multi-tab/transitions.ts` | `MultiTabState` and `applyMultiTabOperation` (the fixture's `mutate`) |
| `src/scenarios/multi-tab/list-page.ts` | The start page: order table, `target="_blank"` links, one `window.open` button, notice region, client script |
| `src/scenarios/multi-tab/details-page.ts` | The details document a new tab shows |
| `src/scenarios/multi-tab/tests/scenario.test.ts` | node:test: manifest, determinism, every `mutate` operation, every `route` response, render |
| `e2e/multi-tab.spec.ts` | Plain Playwright: drives W15 from the manifest's own steps, then the window path, the confirm gate, and the variant |

### Fixture design

- **List page** (`render`). A captioned table with one row per order
  (`PO-4471`…`PO-4474`). Each row has:
  - an "Open details" link, `href="/scenarios/multi-tab/details/PO-447N?via=link"`,
    `target="_blank"`, `rel="noopener"`, testid `open-details-po-447n`, and an
    accessible name that says it opens a new tab;
  - a "Confirm review" button, testid `confirm-review-po-447n`;
  - a review cell, testid `review-state-po-447n`.

  Above the table sit one `window.open` button (testid `open-newest-window`),
  which opens `details/PO-4474?via=window` in a new page, and an empty
  `role="alert"` notice (`open-notice`). Below it is a live
  `review-result` line.
- **Details page** (`route`, `details/<order>`). An `h1`, then an
  `order-details` section with a labelled `<dl>`. Each `dd` has testid
  `detail-<field>`: order, supplier, status, buyer, delivery, total. The
  route's `mutation` is `record-visit {order, via}`; `via` is `link`,
  `window`, or `direct` (no or unknown `?via`). Any other subpath returns
  `undefined`, which the server serves as a 404.
- **State (the `/__control/final-state` oracle)**:
  `{ seed, orders, popupsBlocked, detailsVisits[], blockedOpens[], reviewedOrders[] }`.
  The history arrays are capped at 50 entries.
- **`mutate` operations**:
  - `block-popups`: the variant arm. Idempotent.
  - `record-visit`: the route's mutation. Accepts known orders only, with
    `via` ∈ {link, window, direct}.
  - `record-blocked-open`: sent by the armed page. Accepted only while
    armed, and only for `via` link or window.
  - `confirm-review`: accepted once per order, and only for an order whose
    details were visited.

  Every other operation or payload leaves the state unchanged.
- **Determinism**. Order numbers are fixed, so step targets and tab paths do
  not change with the seed. Supplier, status, buyer, delivery, and total come
  from the store seed through mulberry32, with no `Math.random`. Delivery
  dates count from a fixed `Date.UTC(2026, 9, 1)`. Totals are formatted
  without `Intl`. The unit test stubs `Math.random` and `Date.now` to throw,
  and state, render, and route still succeed.

### Workflows and variants

**Primary workflow: W15.** One corpus row, so `workflows` is not used.
Steps:

1. `click testid:open-details-po-4472`
2. `switchTab /scenarios/multi-tab/details/PO-4472` (3000 ms)
3. `waitForState testid:order-details`
4. `extract testid:order-details`, fields `order`, `supplier`, `status`,
   `buyer`, `delivery`, `total`, each read with `[data-testid="detail-<field>"]`
5. `closeTab`
6. `waitForState testid:order-list`
7. `click testid:confirm-review-po-4472`
8. `waitForState testid:reviewed-po-4472`
9. `checkpoint`

Expected:

| Field | Value |
| --- | --- |
| `pageFacts` | `order-list` visible |
| `recordingEvents` | `web.element.clicked` |
| `actions` | `web.dom.click` succeeded; `web.dom.extract` succeeded |
| `finalState` | path `/scenarios/multi-tab/`; `reviewed-po-4472` text `Reviewed`; `review-result` text `PO-4472 review confirmed.` |
| `extracted` | step `extract-order-details`, count 1, records `[{ order: "PO-4472", supplier: "Tailspin Freight", status: "Awaiting approval", buyer: "J. Lindqvist", delivery: "2026-10-05", total: "$7,183.04" }]` (seed 118) |
| `allowedConsoleErrors` | `[]` |

The final-state oracle after a correct run is
`detailsVisits [{PO-4472, link}]`, `reviewedOrders [PO-4472]`,
`blockedOpens []`. The e2e spec asserts this.

**Variant: `popup-blocked`.** Armed by `block-popups`. The armed list page
refuses both open paths:

- the link's default action is prevented;
- the `window.open` button gets no window, the way `window.open` returns
  `null` under a real blocker.

Either way the page shows "Pop-up blocked: PO-4472 did not open. Allow
pop-ups for this site, then try again." and records `record-blocked-open`.
No tab opens. The markup is byte-identical to the baseline except the
embedded `popupsBlocked` flag, which a unit test asserts. The variant
therefore changes open behaviour only, not element identity.

Expected, where each field replaces the workflow's:

| Field | Value |
| --- | --- |
| `failure` | `{ category: "OUTPUT_NOT_OBSERVED" }` (no `code`) |
| `extracted` | `[]` |
| `actions` | `[{ action: "web.dom.click" }]` (no outcome) |
| `finalState` | path still `/scenarios/multi-tab/`; `open-notice` contains `Pop-up blocked: PO-4472 did not open.`; `reviewed-po-4472` exists `false` |
| `pageFacts`, `recordingEvents`, `allowedConsoleErrors` | Inherited |

**Why `OUTPUT_NOT_OBSERVED`.** The click step finds its target, and the page
accepts and handles the click. The output that recording observed — a new
tab at `/scenarios/multi-tab/details/PO-4472` — never appears. The only
observable result is an inline notice on the unchanged list page. The other
categories fit less well:

- **`TARGET_NOT_FOUND` / `TARGET_AMBIGUOUS`**: the element exists and is
  unique, and the markup is identical to the recording.
- **`NAVIGATION_UNEXPECTED`**: nothing navigates.
- **`TIMEOUT`**: `switchTab` does time out, but that is the mechanism, not
  the cause. A classifier that knows the preceding click succeeded should
  report the missing effect rather than a generic timeout.
- **`USER_INTERVENTION_REQUIRED`**: this is the strongest alternative,
  because the real remedy is a person allowing pop-ups. I did not choose it
  for two reasons:
  - A deterministic, provider-free classifier has only "click succeeded, no
    tab appeared" to go on. Reading the page's prose to infer that a person
    is needed goes beyond that.
  - The fixture does not model a browser-level prompt.
- **`STATE_MISMATCH`**: less specific than the missing output.

The failure must stop the run before `extract` executes on the wrong tab,
so the variant expects no extraction.

### Corpus decisions I had to make

1. **"Confirms the list page"** is a click on "Confirm review" on the list,
   followed by waiting for the `reviewed-po-4472` badge. The fixture accepts
   the confirmation only for an order whose details route recorded a visit.
   So the final state proves the full order: a details tab opened, then the
   automation returned to the original tab and acted there. A `waitForState`
   alone would not prove the original tab was acted on.
2. **Seed.** Expectations are computed for the manifest seed 118. The runner
   defaults to it (`run-scenario.ts:46`, `options.seed ?? scenario.seed`),
   and the e2e starts the lab with `multiTabScenario.seed`. A run with any
   other seed renders different order content by design, so the extracted
   records would not match. Targets and paths stay valid.
3. **`finalState` uses the runner's DOM predicates** (`path`, `text`,
   `contains`, `exists`). `scenario-assertions.ts` throws on any other
   predicate, and there is no state-oracle predicate. The
   `/__control/final-state` values are asserted by the e2e spec and the unit
   tests, not by the manifest.
4. **Extract field selectors are CSS** (`[data-testid="detail-order"]`), not
   the `testid:` form. The runner's `selector()` passes CSS through
   unchanged. Whether `fields` understands `testid:` depends on
   w1-runner-asserts' implementation, which I cannot see.
5. **No `failure.code`**: no code vocabulary exists yet, and Core owns the
   runtime names (D3). **No outcome on the variant's click**: whether the
   click reports succeeded or failed depends on outcome validation, which
   Phase 1.1 is still building.
6. **`recordingEvents` is `web.element.clicked` only, without a count.**
   Tab events have no names in the source yet. A grep of
   `domain/src`, `apps/extension/src`, and `packages` for `web.*` names found
   only `web.dom.*`, `web.browser.navigate`, and `web.browser.state`.
7. **Capabilities** are `["popup", "mutation"]`. **Tags** are
   `["multi-tab", "popup", "window-open", "extract"]`. The brief gave no
   corpus-tag convention.
8. **No `index.ts` barrel in `multi-tab/`.** `registry.ts` imports
   `scenarios/multi-tab/scenario.js` directly. With a barrel present, the
   imports rule would flag that line as a barrel skip in a file I must not
   touch.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/scenario-lab build` (first run,
  before the unit test existed): `tsc -p tsconfig.json`, exit 0.
- `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/multi-tab.spec.ts`:
  `4 passed (3.8s)`.
  - W15 primary (1.1s)
  - `window.open` path (860ms)
  - confirm gate (767ms)
  - `popup-blocked` (1.7s)
- The same run with `--repeat-each=3`, twice: both runs failed before
  loading any test with
  `SyntaxError: ...\src\scenarios\data-table\table-page.ts: Invalid escape sequence in template. (15:49)`
  and `Error: No tests found.` That file belongs to w1-fixture-data-table,
  which was being edited in parallel. The registry imports every fixture, so
  no spec can load while it is broken.
- The build rerun after adding the unit test failed with exit 2. The only
  errors were `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`,
  `TS1487: Octal escape sequences are not allowed`. No error was in a
  multi-tab file. `tsc` still emitted: every
  `dist/scenarios/multi-tab/**/*.js` was written at 12:46:09, after the test
  source was saved at 12:45:24.
- `node --test apps/scenario-lab/dist/scenarios/multi-tab/tests/scenario.test.js`:
  `# tests 7 # pass 7 # fail 0`.
- `node scripts/structure-audit.mjs`: exit 0. Filtering the output for
  `multi-tab` returns nothing. The only other matching line was
  `structure-audit: 1 baseline entries can be lowered.` That line was also
  present before any edit of mine, so it is not from these files.
- `git status --porcelain -- apps/scenario-lab packages`: the multi-tab
  entries are only the owned paths (see "Changed" in the return contract).
- Type check of the e2e spec, which the package tsconfig (`src/**` only) and Playwright never type-check: `tsc -p <scratch tsconfig extending apps/scenario-lab/tsconfig.json, files: [e2e/multi-tab.spec.ts], noEmit>` -> exit 2 with 0 errors in any multi-tab file; the only errors are the same two in `src/scenarios/data-table/table-page.ts`, reached through `server.ts` -> `registry.ts`.
- Reruns after the data-table fix (12:49 to 12:51) hit two more parallel edits. Neither is in a multi-tab file:
  - Build: exit 2. The only error is `src/scenarios/modal-flows/mutate.ts(35,22) TS2322`; the log mentions multi-tab 0 times.
  - `node --test apps/scenario-lab/dist/scenarios/multi-tab/tests/scenario.test.js`: `not ok 1`, a file-level failure. The cause is `ERR_MODULE_NOT_FOUND ... packages	est-contractsdistench-report.js imported from ...distindex.js`. Rerun once at 12:50:50, it failed the same way on `distench-report-validation.js`. Another worker is adding bench-report modules to test-contracts: `dist/index.js` (12:48:42) exports both, while `src/bench-report-validation.ts` does not exist yet.
  - Playwright with `--repeat-each=3`: `Cannot find module ...distench-report-validation.js` and `No tests found`, exit 1. Same cause.
  - One last check at 12:51:44 printed the same: `dist` has `bench-report.js` but still lacks `bench-report-validation.js`. The node test failed at file level (`not ok 1`) and Playwright reported `No tests found`.
  - I did not build or touch `packages/`. The background rebuild loop was stopped with TaskStop, so it does not keep rebuilding the shared `dist`. The passing results above (unit 7/7 on the 12:46:09 emit, e2e 4/4) are from before these edits.

## Not verified

- **The recording lane with the extension and the real runner.** This lane
  executes `switchTab`, `closeTab`, and `extract` while the extension
  records, and w1-runner-asserts is still building it. My e2e drives the
  manifest's steps with a small plain-Playwright interpreter:
  - `switchTab` activates the open tab whose URL path matches;
  - `closeTab` closes it and returns to the tab that was active before.

  The runner may define those semantics differently.
- **That the runtime classifies the variant as `OUTPUT_NOT_OBSERVED`.**
  Phase 1.5 is not built. I chose the category from the names in
  `failure-category.ts` only; I did not read the plan's Phase 1.5
  definitions, which are outside my brief.
- **A clean build and the stability run.** No scenario-lab build that included my test file finished without errors; every such build failed only on other fixtures' files. The `--repeat-each=3` stability run never completed. Rerun both at integration: `node --test apps/scenario-lab/dist/scenarios/multi-tab/tests/scenario.test.js` and `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/multi-tab.spec.ts --repeat-each=3`.
- **Firefox**, and seeds other than 118 in a browser. The unit tests cover
  determinism for seeds 119, −1, 0, and 2^40.

## Open questions or contradictions found

- **Category for `popup-blocked`**: please confirm `OUTPUT_NOT_OBSERVED`
  against the Phase 1.5 definitions. `USER_INTERVENTION_REQUIRED` is the
  alternative if the plan defines it by remedy rather than by observable
  evidence.
- **Expected-fact vocabulary**: the brief calls `/__control/final-state` the
  oracle, but the runner's `finalState` facts can only probe the DOM. If
  w1-runner-asserts adds a state-oracle predicate, this manifest could also
  assert `detailsVisits` and `reviewedOrders` directly.
- **Whether `extract` `fields` accept the `testid:` form**: this is not
  defined in `ScenarioStep`'s comment. I used CSS to be safe.
