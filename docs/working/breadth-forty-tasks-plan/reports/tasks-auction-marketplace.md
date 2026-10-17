# tasks-auction-marketplace (t701) report

## Outcome

Done. I added four tasks for Hammerline, each with its own workflow, an exact oracle and browser-path proofs. All four
are accepted by the provider-free dry run. Across the whole package suite, the only failures in auction-marketplace
code are the expected shared-list assertions. There is also one shared assertion the brief did not name:
`src/tests/recording-descriptions.test.ts`, which counts workflows. See Open questions.

## The four tasks

| id | kind | judgeBy | permissionPoint | what a correct run does |
| --- | --- | --- | --- | --- |
| `auction-marketplace-cheap-accessory-auctions` (a) | navigate-and-extract | expected-dataset `extract-cheap-accessories` | none | Searches kestrel 35. The 50 results run over three pages. It keeps the accessory auctions under £10 at the pound estimate, soonest-ending first, which is six records. It drops the £9.00 display-dummy camera and the £8.99 fixed-price cable release. Account unchanged. |
| `auction-marketplace-save-mark-ii-sellers` (b) | navigate-and-extract | expected-dataset `extract-saved-sellers` | none | Saves the sellers of the four Kestrel 35 Mk II auctions (titled Mk II, MkII and Mark 2), then reads Saved sellers back. Expected order: fotokiste-utrecht, kameraboden, northgate_photo, sprocket-and-spool. Final state: those four saved, nothing watched, bid on or bought. |
| `auction-marketplace-buy-it-now-quote` (c) | navigate-and-extract | expected-dataset `extract-buy-it-now-quote` | none (stop case) | Finds the one auction that still offers Buy it now (m4) and opens Buy it now's purchase review. Reads title, price `£140.00` and postage `+£6.50 postage`, then stops before Confirm and pay. Account unchanged. |
| `auction-marketplace-lens-hood-seller-shop` (d) | navigate-and-extract | expected-dataset `extract-seller-shop` | none | Searches for a Kestrel 35 lens hood and opens the hood on its own, not the collector's set "with 3 lenses & hood". Goes to its seller's shop (the_camera_loft) and lists all eight items, title and price, in shop order. Account unchanged. |

Every expected record is derived from the catalog (`cardSlots`, `moneyText`, `postageText`, `LISTINGS`, `applyAuctionMutation`).
`breadth/tests/workflows.test.ts` also writes each one out by hand.

## Entries for the shared tests (supervisor)

`scenarios/tests/realistic-site-live-tasks.test.ts`, test "qualification additions preserve...": add these four to the
sorted additions list, and raise the total by 4 from whatever it is after the other sites' additions (alone: 68 -> 72):

```
"auction-marketplace-buy-it-now-quote",
"auction-marketplace-cheap-accessory-auctions",
"auction-marketplace-lens-hood-seller-shop",
"auction-marketplace-save-mark-ii-sellers",
```

`scenarios/tests/live-instructions.test.ts`: no new permission point, so the `declared` map is unchanged. Add to `ASKS_NOTHING`:

```
"auction-marketplace-cheap-accessory-auctions": "a read",
"auction-marketplace-save-mark-ii-sellers": "saves sellers to the account's own list",
"auction-marketplace-buy-it-now-quote": "opens the Buy it now review and stops before paying",
"auction-marketplace-lens-hood-seller-shop": "a read",
```

`src/tests/recording-descriptions.test.ts` (not in the brief): `assert.equal(count, 42)` becomes 46 with this site's
four new workflows, plus whatever the other sites add.

## What changed and why

All paths are under `apps/scenario-lab/src/scenarios/auction-marketplace/`:

- `live-tasks.ts`: the four tasks and their instructions. Every dataset column is named in the instruction, and there
  are no variants.
- `breadth/` (new): `arrival.ts` (the promotion, greeting and cookie steps, with a step-id prefix);
  `account-facts.ts` (the four account-list final-state facts); one workflow per task in `cheap-accessories.ts`,
  `mark-ii-sellers.ts`, `buy-it-now-quote.ts` and `seller-shop.ts`; `index.ts` barrel; `tests/workflows.test.ts`.
- `manifest.ts`: the four workflows appended to `workflows`.
- Fixture changes, each small and needed by one oracle:
  - `pages/flyouts.ts`: the Saved sellers list now renders sorted alphabetically, and each entry links to the
    seller's shop. Without the sort, the final-state text depended on the order the sellers were saved in. The
    links give the extract a child element to read, since a field selector must be non-empty. The stored state
    order is unchanged, and the list's text content is the same for one seller, so the existing redesign test
    still passes.
  - `pages/seller.ts`: each shop row's price is wrapped in a `<span>`. A bare text node could not be read as a
    field.
  - `pages/drawers.ts`: the purchase review's postage value is wrapped in a `<span>`, so it reads `+£6.50 postage`
    without the "Postage:" label.
- `tests/scenario.test.ts`: the workflow-id, variant and judgeBy lists updated for seven secondary workflows and ten
  tasks.
- `tests/breadth-paths.test.ts` (new), ten browser tests:
  - (a) The recording passes the bot check and reads exactly the six. A person reading all three keyword pages by
    the numbered links reaches the same six. The Auction and price filters alone let the dummy in, and the oracle
    refuses that read.
  - (b) The recording saves the four sellers. Saving them in reverse order gives the same oracle. Also saving the
    35S's seller fails the saved-sellers fact, and so does pressing Save seller a second time.
  - (c) The recording buys nothing. The fixed-price listing titled "Buy it now" gives a different record, and
    pressing Confirm and pay fails the purchases fact.
  - (d) The recording reads the shop. The listing's seller link names the_camera_loft, and the collector's set
    seller's shop is a different dataset.

## Commands run and observed results

- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: passed. tsc printed no errors, only the build-cache
  line.
- `node --test` on breadth/tests/workflows, tests/scenario, qualification/tests/expected, tests/state and
  tests/catalog: `# tests 29 # pass 29 # fail 0`.
- `node --test dist/scenarios/auction-marketplace/tests/breadth-paths.test.js`: `# pass 10 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: exit 1, `# tests 715 # pass 704 # fail 4 # cancelled 7`.
  All 13 tests in the existing auction `browser.test.ts` passed. The failures:
  - `not ok 586 - every realistic-site task either declares its permission point or is recorded as asking nothing`.
    Expected: the four new ids are missing from ASKS_NOTHING.
  - `not ok 600 - qualification additions preserve the complete ordered original 57 tasks`. Expected: the four new
    ids are missing from the additions list.
  - `not ok 604 - all realistic workflow recordings have separate authored demonstration descriptions`, with
    `46 !== 42`. Expected for the same reason (count only); this is the shared test the brief did not name.
  - `not ok 99 - naive paths fail` (bigbox-retail browser-paths, 120 s timeouts) and `not ok 156 -
    crossborder-marketplace in a browser` (a 1000 ms wait for "Flash Deal"). These are other sites, and the suite
    was running beside the other breadth workers. Rerun alone with `node --test
    dist/scenarios/bigbox-retail/tests/browser-paths.test.js dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js`:
    `# tests 31 # pass 31 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 639 baselined)`. None of the warnings
  is in a new file.
- Dry runs with `FLUXIQ_TEST_TARGET=persistent-isolated`, using the brief's command with
  `--workspace bf-dry-<id> --dry-run`. Each exited 0 with `"status":"ready","providerCallCount":0`:
  - cheap-accessory-auctions: `"workflowId":"cheap-accessories"`, `"judgement":{"judgeBy":"expected-dataset","stepId":"extract-cheap-accessories","stepIndex":22}`
  - save-mark-ii-sellers: `"workflowId":"save-mark-ii-sellers"`, `"stepId":"extract-saved-sellers","stepIndex":19`
  - buy-it-now-quote: `"workflowId":"buy-it-now-quote"`, `"stepId":"extract-buy-it-now-quote","stepIndex":9`
  - lens-hood-seller-shop: `"workflowId":"lens-hood-seller-shop"`, `"stepId":"extract-seller-shop","stepIndex":12`

## Not verified

- No live (paid) run, and no run through the extension. The recordings are proved by the Playwright support runner
  in `tests/browser-support.ts`, not by the Lab's step runner.
- The dry runs ran without `--llm-max-cost-usd 0.25`, so their plan shows `maxEstimatedCostUsd 0.1`. The live launch
  should pass the flag.
- The shared tests themselves were not edited (they are outside my ownership).

## Open questions or contradictions found

- `src/tests/recording-descriptions.test.ts` hard-codes 42 realistic workflows. Every site that adds a workflow breaks
  it, and the brief's shared-list hand-off does not mention it.
- Task (c) declares no permission point. The right ending is to open the review and never press Confirm and pay. If
  FluxIQ's guard asks at the "Buy it now" button itself, the build ends at `permission_required` and the Lab scores
  a fail. I would treat that as a product defect, because opening a review pays nothing.
- Task (d): the listing opens the seller's shop in a new tab (`target=_blank`). The recording goes to the same
  address in its own tab. A live run has to follow the new tab or open the shop address itself.
