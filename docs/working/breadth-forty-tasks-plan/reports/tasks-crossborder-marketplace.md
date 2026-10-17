# Report: tasks-crossborder-marketplace (t697)

Worker: `tasks-crossborder-marketplace`. Worktree:
`C:/Users/osrs_/FluxStuff/fxwork/t697-breadth-crossborder-marketplace`. Nothing committed.

## Outcome

Done. Four new live instruction tasks for `crossborder-marketplace`, each with its own workflow, a recording that
reaches the oracle in a real browser, and browser-proven wrong paths. All four provider-free dry runs return
`"status":"ready","providerCallCount":0`. The package suite passes except shared-list assertions in files outside
my ownership (quoted below) and timing-sensitive browser tests on other sites (see "Not verified").

## The four tasks

| Task id | Kind (brief) | kind / judgeBy | permissionPoint | A correct run |
| --- | --- | --- | --- | --- |
| `crossborder-marketplace-free-hubs-under-ten` | (a) filtered extraction across pages | navigate-and-extract / expected-dataset `extract-free-hubs-under-ten` | none (a read) | Narrows "usb c hub" to free shipping and a 10,00 € ceiling (or pages all three pages), drops ads and "free shipping over" listings, sorts cheapest first, returns 10 records (title, store, price, rating). |
| `crossborder-marketplace-follow-official-store` | (b) lasting act | navigate-and-extract / expected-dataset `extract-followed-stores` | none | Opens the Voltbay Official Store listing (not the lookalike "VoltBay Store"), presses Follow once, reads the account list: `Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store`. |
| `crossborder-marketplace-mint-hub-fallback` | (c) conditional | navigate-and-extract / expected-dataset `extract-mint-fallback-cart` | none | Finds the official Mint 10-in-1 sold out from every warehouse, adds two Mint 7-in-1 from Spain instead, reads the cart row (store, item, options, quantity). |
| `crossborder-marketplace-uk-express-quote` | (d) longer journey, stops before money | navigate-and-extract / expected-dataset `extract-uk-express-quote` | none (the instruction rules out placing the order) | Switches ship-to to the United Kingdom (shadow-root picker), opens the Keelson 9 in 1 hub, picks Silver, goes to checkout, chooses express, reads `£17.16` / `£6.01` / `£23.17`, and does not press Place order. |

Only `-free-hubs-under-ten` declares `personCheck` (`completes`, `required: false`): its honest path meets the traffic
screen on the third results load. A matching `handOffs` row was added to `person-check.ts`.

Oracles (each workflow's `expected`): `pageFacts` FIRST_VISIT (plus the starting followed-stores line for the follow
task); `extracted` lists every record; `finalState`: cart (0) and orders (0) for the read; followed-stores line, cart
(0), orders (0) for the follow; the mini-cart line, `Cart (2)` and orders (0) for the fallback; orders (0) for the UK
quote. Records are computed from the catalogue and cross-checked by literal values in `tests/breadth-tasks.test.ts`
and by reading the rendered pages in `tests/breadth-paths.test.ts`.

## Entries for the shared tests (supervisor)

1. `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts`, the sorted additions list, add:
   ```
   "crossborder-marketplace-follow-official-store",
   "crossborder-marketplace-free-hubs-under-ten",
   "crossborder-marketplace-mint-hub-fallback",
   "crossborder-marketplace-uk-express-quote",
   ```
   and raise `REALISTIC_SITE_LIVE_TASKS.length` by 4 for this site (68 -> 72 before the other sites' additions).
2. `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`:
   - permission map: no change (no new task declares `permissionPoint`).
   - `ASKS_NOTHING`, add:
     ```
     "crossborder-marketplace-free-hubs-under-ten": "a read",
     "crossborder-marketplace-follow-official-store": "follows a store from the account without cart or purchase",
     "crossborder-marketplace-mint-hub-fallback": "fills the cart and buys nothing",
     "crossborder-marketplace-uk-express-quote": "changes the ship-to country and reads the checkout without placing the order",
     ```
   - hand-off map (`every task that expects a hand-off ...`), add:
     `"crossborder-marketplace-free-hubs-under-ten": "completes:false",`
3. Not named in the brief but also shared: `apps/scenario-lab/src/tests/recording-descriptions.test.ts` asserts
   `count === 42` workflows across the ten sites; this site adds four workflows, so 42 -> 46 (plus other sites').

## What changed and why

Fixture addition (the follow task needed a lasting act the site lacked):
- `state/types.ts`, `state/create.ts`: `following: string[]`, starting as hubsmith, mirafone, qinport (the flyout
  already claimed "Followed stores (3)").
- `state/mutate.ts`: `follow-store` operation `{ storeId, follow: boolean }`; unknown store or bad payload is a no-op.
- `markup/flyouts.ts` (+ `markup/index.ts` export): `followedStoresText`, a read-only flyout line with test id
  `followed-stores`; the static line is now "Wish list (7) · Feedback (2)".
- `markup/item.ts`, `client/item-script.ts`: the store card's Follow span reads Follow/Following from state and
  toggles it (posts, flips its wording, toasts, refreshes the flyouts).

Tasks and oracles:
- `live-tasks.ts`: four instructions and rows, doc comment extended.
- `manifest/free-hubs-under-ten.ts`, `manifest/follow-official-store.ts`, `manifest/mint-hub-fallback.ts`,
  `manifest/uk-express-quote.ts`: one workflow each (recording script + expected).
- `manifest/manifest.ts`: registers the four workflows, doc comment.
- `manifest/steps.ts`: exports the existing `ARRIVE` and `OPEN_OFFICIAL_LISTING` fragments so the new scripts reuse
  them.
- `manifest/site-noise.ts`: `SITE_NOISE` moved out of `manifest.ts` so the workflows share it (kept out of
  `facts.ts`, which would have crossed the exported-values advisory).
- `person-check.ts`: hand-off row for `free-hubs-under-ten`.

Tests (site-owned):
- `tests/scenario.test.ts`: workflow list (7 workflows), variant lists, test-id list (+`followed-stores`).
- `tests/person-check.test.ts`: hand-off list.
- `tests/breadth-tasks.test.ts` (new, no browser): task-dataset wiring, literal records, filter and stock facts,
  follow toggle, UK checkout in pounds vs euros.
- `tests/breadth-paths.test.ts` (new, browser): honest path per task, and wrong paths that fail: ads kept (12 rows),
  Best Match order, lookalike store followed, toggle pressed twice, lookalike Mint 10-in-1 added, standard shipping,
  no region change (euros). It drives `select` steps itself because the shared harness does not.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab): no output (clean).
- `node --test` on all crossborder site tests (54 tests) after the final edits: 53 pass, 1 fail,
  `flash-deal-stuck` (`page.goto: Timeout 30000ms exceeded` opening a session). Re-run of the four flash-deal tests
  in isolation three times: `# pass 4 # fail 0` each time. I did not touch the interruption code.
- `node --test dist/scenarios/crossborder-marketplace/tests/breadth-paths.test.js`: `# pass 10`, `# fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 639 baselined).` No warning on a
  file I changed.
- Dry runs, each with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's command, all exit 0:
  - free-hubs-under-ten: `{"status":"ready","providerCallCount":0,"lane":"created-flow",...,"workflowId":"free-hubs-under-ten",...,"judgement":{"judgeBy":"expected-dataset","stepId":"extract-free-hubs-under-ten","stepIndex":19}...}`
  - follow-official-store: `{"status":"ready","providerCallCount":0,...,"workflowId":"follow-official-store",...,"stepId":"extract-followed-stores","stepIndex":14}...}`
  - mint-hub-fallback: `{"status":"ready","providerCallCount":0,...,"workflowId":"mint-hub-fallback",...,"stepId":"extract-mint-fallback-cart","stepIndex":20}...}`
  - uk-express-quote: `{"status":"ready","providerCallCount":0,...,"workflowId":"uk-express-quote",...,"stepId":"extract-uk-express-quote","stepIndex":23}...}`
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test` (final run, after every edit):
  `# tests 717  # pass 711  # fail 6  # cancelled 0`. Every crossborder test passed, flash-deal ones included.
  The failures:
  - `not ok 579 - every realistic-site task either declares its permission point or is recorded as asking nothing`
    (shared; my four ids are missing from `ASKS_NOTHING`).
  - `not ok 580 - every task that expects a hand-off is on a scenario whose person module knows its check`
    (shared; `+ 'crossborder-marketplace-free-hubs-under-ten': 'completes:false'`).
  - `not ok 593 - qualification additions preserve the complete ordered original 57 tasks` (shared; `+` my four ids).
  - `not ok 597 - all realistic workflow recordings have separate authored demonstration descriptions`
    (shared; `46 !== 42`).
  - `not ok 129 - a naive path fails the oracles`, i.e. company-website `naive-path.test.js` subtests 1 and 2: click
    timeouts (`step choose-service failed: click div:text-is("Combi boiler replacement"): not done within 10000 ms`).
    Not my site; it timed out while other workers' suites were running.
  - An earlier run of the same suite (before a refactor-only move of `SITE_NOISE`) also had timeouts in job-board,
    local-classifieds, photo-social, a consent-redesign test, the fixture child-process test and two crossborder
    flash-deal tests. None of those failed in the final run.

## Not verified

- No live (paid) run. Whether a model finds the shadow-root region picker, the Follow span, or the price-ceiling box
  is open until the lanes run these tasks.
- Lab dataset comparison of the follow and UK rows is assumed to be exact string match per record, like the existing
  coupon-only row.
- The company-website naive-path timeouts (and the earlier run's timeouts) are on sites I did not touch. They look
  timing-related, with several workers running suites at once. I did not investigate them.

## Open questions or contradictions found

- The brief lists two shared tests; a third (`src/tests/recording-descriptions.test.ts`, workflow count 42) and the
  hand-off map in `live-instructions.test.ts` also have to change for any site that adds workflows or a hand-off.
- The dry run prints `maxEstimatedCostUsd: 0.1`; the Phase 3 launch shape passes `--llm-max-cost-usd 0.25`
  explicitly, which this dry-run command does not.
