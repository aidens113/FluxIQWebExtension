# Report: tasks-everything-store (t696)

## Outcome

Done. I added four live tasks to the everything store. Each one has its own workflow, a dataset that lists every record, and final-state facts. The everything-store tests pass, including the new browser-path tests. The package suite fails only on three shared lists in files I am not allowed to edit (`scenarios/tests/*` and `src/tests/recording-descriptions.test.ts`), plus three browser files from other sites that timed out under load. Run on their own, those three files pass. All four dry runs came back `ready`.

## Tasks

| id | kind | judgeBy (dataset) | permissionPoint | a correct run |
| --- | --- | --- | --- | --- |
| `everything-store-coupon-earbuds-rated-four` (a) | navigate-and-extract | expected-dataset `extract-coupon-earbuds` (5 records) | none | Goes through all 5 pages of "wireless earbuds" results and keeps the organic pairs that have a coupon and a rating of 4.0 or higher, each once, in results order. Columns: name, price, coupon, url. |
| `everything-store-batteries-and-descaler` (b) | navigate-and-extract | expected-dataset `extract-topped-up-cart` (3 records) + account fact | none | Raises the existing batteries line L1 to 3, adds one Tidewell descaler (new line L3), and reads the active cart. |
| `everything-store-sage-small-kettle-if-in-stock` (c) | navigate-and-extract | expected-dataset `extract-cart-unchanged` (2 records) + account fact | none | Finds the Sage Green 1.0 L "Currently unavailable.", adds nothing in its place, and reads the unchanged cart. |
| `everything-store-office-checkout-review` (d) | navigate-and-extract | expected-dataset `extract-checkout-review` (1 record) + account and checkout facts | none (the order is never placed) | Uses Buy Now on the Basics 1.5 L kettle, then sets the office address, standard delivery, the gift card on and the Plus trial off. Reads item, address, arriving and total ($7.59) and stops before "Place your order". |

None of the four declares a `permissionPoint`, because none asks for a delete, a send or a payment. Task (d) says outright not to place the order.

## Entries to add to the shared tests

`scenarios/tests/realistic-site-live-tasks.test.ts`: add these four ids to the sorted additions list, and raise the length to the current total + 4 (68 + 4 = 72 for this site alone):

```
"everything-store-batteries-and-descaler",
"everything-store-coupon-earbuds-rated-four",
"everything-store-office-checkout-review",
"everything-store-sage-small-kettle-if-in-stock",
```

`scenarios/tests/live-instructions.test.ts`: nothing goes in the permission map. Add these to `ASKS_NOTHING`:

```
"everything-store-coupon-earbuds-rated-four": "a read",
"everything-store-batteries-and-descaler": "changes an existing cart line and adds one item without checkout or deletion",
"everything-store-sage-small-kettle-if-in-stock": "adds to the cart only if in stock, and the right act is none",
"everything-store-office-checkout-review": "sets up a checkout and stops before placing the order",
```

A third shared file, which the brief did not name: `src/tests/recording-descriptions.test.ts` asserts `count === 42`. This site adds 4 workflows, so it needs 42 + 4 (plus whatever the other sites add).

## What changed and why

All changes are under `apps/scenario-lab/src/scenarios/everything-store/`.

- `live-tasks.ts`: the four tasks, and doc lines describing them.
- `manifest.ts`: registers the four workflows; updates the doc comment.
- `workflows/coupon-earbuds.ts`, `topped-up-cart.ts`, `unavailable-kettle.ts`, `office-checkout.ts`: one workflow each, with a recordingScript and an expected (pageFacts, extracted records, finalState).
  - The records are literals I read from the catalogue and cart state.
  - `breadth-oracles.test.ts` cross-checks them against the catalogue.
- `workflows/account-literals.ts`: the account and checkout fact values, written as literals from `state/create.ts`, not produced by the fact functions.
- `workflows/index.ts`: barrel exports.
- `qualification/checkout-facts.ts` (new), plus `qualification/index.ts`: `checkoutSessionFacts(state)` reports the open checkout as JSON, or `null` when none is open.
- `pages/shell.ts`: every page now also carries a readonly `<script type="application/json" data-testid="everything-checkout-session">`. The page's mutate wrapper keeps it current, the same way it already keeps the existing `everything-saved-cloths-account` fact current. Nothing visible changed.
  - Tasks (b), (c) and (d) reuse the existing account fact (cart and saved lines, nextLine, checkoutOpen, orderCount, newsletter) as their final-state judge. That fact is on every page, so a run is judged wherever it ends.
- `tests/browser-kit.ts`: adds `playRecording`, which plays a workflow's recording in Playwright step by step and fails on any operation it does not know.
- `tests/breadth-paths.test.ts` (new, browser):
  - Right paths: for (b), (c) and (d) the recording is played and reaches every oracle. For (a), a person-style sweep by hand of all 5 pages gives exactly the 5 records.
  - Wrong paths:
    - (a) the first page alone yields 2 of the 5 records.
    - (b) adding the descaler twice fails both the table and the account fact.
    - (c) adding the Sage Green 1.7 L as a substitute fails.
    - (d) placing the order after setting checkout up fails.
- `tests/breadth-oracles.test.ts` (new, unit):
  - The literals equal the store's own facts for the start state and for each right ending.
  - (a) A filter through "4 Stars & Up" lets in couponed pairs rated 3.8, and no sponsored card has a coupon.
  - (b) Adding two more batteries merges into L1 and is equally correct. Deleting the line and re-adding fails.
  - (c) The unavailable kettle is refused by state.
  - (d) The check fails when the order is placed, when the whole cart is checked out, when the trial is left ticked, or when the home address is left.
  - The checkout fact is rendered on the page.
- `tests/scenario.test.ts`: the workflow-id and dataset-id lists now include the new four, and the test title says "nine workflows".

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab): clean, after one fix for an `exactOptionalPropertyTypes` error in browser-kit.
- `node --test` on the everything-store `scenario`, `breadth-oracles` and `qualification/expected` tests: `# pass 29`, `# fail 0`.
- `node --test dist/scenarios/everything-store/tests/breadth-paths.test.js`: the first run failed 2 of 7. The recording's wait for `input[name="address"][value="office"][checked]` never passed, because that list is hidden again after the reload. I changed the wait to the shown address `p:has-text("Northgate Dental")`. On the re-run the two tests that had failed (which play the checkout recording) passed. The other five had already passed.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: `# tests 716`, `# pass 707`, `# fail 3`, exit 1. The everything-store suites all passed: `ok 187` (breadth oracles), `ok 194` (breadth paths), `ok 195` (honest shopper), `ok 196` (naive shopper). The failing lines:
  - `not ok 581 - every realistic-site task either declares its permission point or is recorded as asking nothing`: lists the 4 new ids. This is a shared list.
  - `not ok 595 - qualification additions preserve the complete ordered original 57 tasks`: lists the 4 new ids. This is a shared list.
  - `not ok 599 - all realistic workflow recordings have separate authored demonstration descriptions`: `46 !== 42` in `src/tests/recording-descriptions.test.ts`. This is a shared count.
  - Timeouts in other sites' browser files: `not ok 33`, `39` and `41` (auction-marketplace browser.test.js, 90 s), `not ok 293` (job-board browser-paths, 120 s), `not ok 410` (photo-social honest-and-naive-paths, 120 s). I re-ran each file on its own: auction-marketplace `# pass 17 # fail 0`, job-board `# pass 11 # fail 0`, photo-social `# pass 12 # fail 0`. The timeouts came from machine load while the ten workers ran at once. I did not touch those files.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 639 baselined).`
- Dry runs, with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's command, one per task. Result lines:
  - `{"status":"ready","providerCallCount":0,...,"taskId":"everything-store-coupon-earbuds-rated-four",...,"workflowId":"coupon-earbuds",...,"judgement":{"judgeBy":"expected-dataset","stepId":"extract-coupon-earbuds","stepIndex":9}...}`
  - `{"status":"ready","providerCallCount":0,...,"taskId":"everything-store-batteries-and-descaler",...,"workflowId":"topped-up-cart",...,"stepId":"extract-topped-up-cart","stepIndex":10}...}`
  - `{"status":"ready","providerCallCount":0,...,"taskId":"everything-store-sage-small-kettle-if-in-stock",...,"workflowId":"unavailable-sage-kettle",...,"stepId":"extract-cart-unchanged","stepIndex":17}...}`
  - `{"status":"ready","providerCallCount":0,...,"taskId":"everything-store-office-checkout-review",...,"workflowId":"office-checkout-review",...,"stepId":"extract-checkout-review","stepIndex":25}...}`

## Not verified

- No live (paid) run. I do not know how a model handles these tasks.
- (a) The recording keeps every couponed card and does not read ratings, and it pages with Next, which on page two leads back to page two. As with `plus-under-fifty`, no recording can complete this paged and filtered read, so the proof is the sweep done by hand in `breadth-paths.test.ts`.
- `playRecording` is my own player, not the Lab's scripted lane. Its extract semantics (first match's trimmed `textContent`, or `@attribute`) are my reading of the Lab's extractor, not checked against it.

## Open questions or contradictions found

- The shared count in `src/tests/recording-descriptions.test.ts` (42) also changes with every new workflow, and the brief names only two shared files. The supervisor needs to update it too.
- The account fact's test id is `everything-saved-cloths-account`, named for the earlier restore task. I reused it rather than renaming it, because renaming would change that task's literal oracle.
