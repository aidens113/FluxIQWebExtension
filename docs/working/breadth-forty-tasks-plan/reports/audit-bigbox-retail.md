# Audit: bigbox-retail (t710, worker audit-bigbox-retail)

## Outcome

Partial. All eleven bigbox-retail rows have a verdict, two instructions were reworded, and one browser-path test
was added for the variant row that had none. The site's own tests, the package check and the structure audit pass.
One shared corpus test now fails, `scenarios/tests/realistic-site-live-tasks.test.ts` "qualification additions
preserve the complete ordered original 57 tasks", because its frozen baseline still holds the old pickup-towels
wording. I may not edit `scenarios/tests/*`. The supervisor needs to make the one fixture change listed under Open
questions.

## Per-task verdicts

Evidence for every row: I read the catalog (`catalog/paper-towels.ts`, `pantry.ts`, `stores.ts`), the search,
facets, sort and pagination, the tile, product, cart, checkout and order pages, the pickup slots, and each
workflow's oracle. I re-derived each oracle by hand from the catalog.

| Task id | Verdict |
| --- | --- |
| `bigbox-retail-pickup-towels` | **Reworded** (see below). Oracle ok: 9 records re-derived. |
| `bigbox-retail-pickup-towels-list-layout-after-creation` | **Reworded** with its base row (shared constant). Oracle ok; browser test on the variant already existed. |
| `bigbox-retail-pickup-cart` | ok |
| `bigbox-retail-pickup-cart-redesigned-after-creation` | ok ("add to my cart", "do not check out" rule out Buy now) |
| `bigbox-retail-pickup-cart-store-remembered-after-creation` | ok. **Browser-path test added** on the armed variant (there was none). |
| `bigbox-retail-pickup-order` | ok |
| `bigbox-retail-ensure-soap-quantity` | ok |
| `bigbox-retail-rated-delivery-towels` | ok on the new wording (2485e450). Doc comment's counts corrected. |
| `bigbox-retail-napkins-for-delivery` | ok |
| `bigbox-retail-checkout-quote-without-ordering` | ok |
| `bigbox-retail-new-store-cheapest-towels` | **Reworded** (see below). Oracle ok; unit test added. |

### pickup-towels (both rows): reworded

- Old: "find every pack of paper towels that ValueRidge sells itself rather than a marketplace seller, ..."
- New: "find every pack of paper towels, not holders or dispensers, that ValueRidge sells itself rather than a
  marketplace seller, ..." (the rest is unchanged).
- Why: the Loftwell Countertop Paper Towel Holder, Bamboo (402917655) meets every other condition. It is sold by
  ValueRidge, available for pickup today at Carden Falls Supercenter, and rated 4.6. A search for "paper towels"
  lists it. Live run `run-mv9gbsm5-2957581c` (lane t565) records "Every other revision kept a holder row and was
  rightly judged no". The exclusion was only implied, and the sister task (rated-delivery) already states it
  outright. The oracle does not change: it never held a holder.
- Possible: `tests/browser-paths.test.ts` honest extraction test (9 records); list-layout honest rows test.
- Unambiguous after the change: "Pickup today" vs "Pickup tomorrow" is printed on each tile. Best match is the
  default sort. Sponsored tiles are labelled. "Each product once" plus "name as listed" settles the three-size
  Select-A-Size product: one row, its first size as the tile shows it. Price and rating formats are given.
- Purse: about 6 results loads (search, 5 filters), an 8-second bot-check wait, and 2 pages read. Fits.

### pickup-cart, redesigned, store-remembered: ok

- Unambiguous: the full store name is given (two stores share each town). Both products and sizes are named
  exactly. The 250 Count 3-Pack lookalike is a marketplace item that only ships, so "for pickup" excludes it.
  "Switch ..., then add" gives the order that matters: the 12-roll pack cannot be picked up at Carden Falls.
- store-remembered: the new test arms `remember-pickup-store`, checks the variant's page facts, and runs the
  recording without `open-store-picker`/`choose-millbrook`. The store-changed wait still holds. It ends on the
  variant's final facts and the cart `5530601:1:pickup, 5510202:2:pickup, 5530102:1:pickup`. Passed in 11.6s.

### pickup-order: ok

- The earliest open slot is 2pm–3pm today (11am, noon and 1pm are full). The confirmation prints "Order#
  2000958-40713", the item "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", "Qty 1", Total
  $9.62 and "Pickup window: Mon, Sep 21, 2pm–3pm". All match the oracle and the formats the instruction asks for.
  "Saved for later, not bought and not deleted" fixes what happens to the soap.
- The permission point is `move_money` at "Place order", as the shared test lists it. This is the longest path,
  about 20 acts and 8 documents, plus a 429 retry. It has run live before. I flag it as the costliest bigbox row,
  but no change is needed.

### ensure-soap-quantity: ok

"Three in total, not three more" plus "the same cart item" pin the line edit. The cart shows the item name, the
quantity select and "$3.97 each". Browser test: the qualification preservation tests in `browser-paths.test.ts`.

### rated-delivery-towels: ok (new wording audited)

- "Delivery" is the site's own word: the Fulfillment filter option, the tile line "Delivery today/tomorrow", and
  the product page option. "Shipping or pickup alone does not count" closes the reading that the live judge took
  in `run-mvd1ex8o-e1dc7ec8`.
- "ValueRidge offers" read as "sold by ValueRidge" gives the same answer: no marketplace item delivers.
- "Not holders or dispensers" is needed: the bamboo countertop holder delivers today and is rated 4.6.
- Order: the Highest rating sort is rating, then review count. All 16 records re-derived in that order; no exact
  ties.
- Fixed the workflow's doc comment: it counted 27 paper-towel listings with 17 left. The catalog has 28, and 18
  are left (16 + Prints + Kitchen), which matches the unit test's total of 18 results.
- Purse: about 5 results loads, the bot-check wait, and 2 pages (3 without the filter). Past live runs cost $0.08
  to $0.13.

### napkins-for-delivery: ok

- 500 Count delivers tomorrow. The buy box preselects 100 Count and Pickup, and the instruction overrides both
  ("500 Count size", "for delivery, not pickup").
- The cart lists pickup lines before delivery lines, the same order as the mini cart: soap, then napkins.
- Item, quantity and price of one are taken as the cart shows them. No lookalike has a 500 Count.

### checkout-quote-without-ordering: ok

- The checkout lists today's slots under "Today, Mon, Sep 21". Full slots are disabled and marked "Full". The
  first open slot reads "2pm–3pm", in the instruction's "4pm–5pm" format.
- The summary Total is $4.26 ($3.97 + 7.25% tax).
- "As a guest, without signing in" leads to the only lasting change the oracle allows, `checkout: guest`. No Place
  order.

### new-store-cheapest-towels: reworded

- Old: "Then find the cheapest pack of paper towels, not a holder or dispenser, that this store can have ready for
  pickup today and that is rated 4.5 stars or higher, and add one of it to my cart for pickup."
- New: "Then find the lowest-priced paper towels, not a holder or dispenser, that this store can have ready for
  pickup today and that are rated 4.5 stars or higher: compare the price itself, not the price per sheet or roll,
  and count every pack size, a single roll included. Add one of that item to my cart for pickup."
- Why: the answer is "ValueRidge Essentials Paper Towels, 1 Roll" at $1.28. "Cheapest pack" left two readings open:
  1. Whether a single roll counts as a "pack".
  2. Whether "cheapest" means best value. Every tile prints a unit price, and by unit price the 15-roll Value Pack
     ($1.06/roll) is cheaper than the single roll ($1.28/roll).

  The new words keep the intent (the lowest shelf price) and close both readings. The oracle is unchanged.
- Added a unit test (`qualification/tests/new-store-cheapest-towels.test.ts`). It checks that across every size of
  every qualifying product at Millbrook Crossing Neighborhood Market, the lowest price is still sku 5510204 with no
  tie. This holds because the new wording says "count every pack size".
- Purse: store switch, about 5 results loads with the bot check, the sort, the product page, a two-press add, and
  the cart. About 12 acts. Fits.

## What changed and why

- `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts`: `PICKUP_TOWELS` and `NEW_STORE_CHEAPEST_TOWELS`
  reworded, as above.
- `apps/scenario-lab/src/scenarios/bigbox-retail/qualification/rated-delivery-towels.ts`: doc comment counts
  corrected (28/18), and a note on why the holder exclusion matters.
- `apps/scenario-lab/src/scenarios/bigbox-retail/tests/browser-paths.test.ts`: honest browser path for the
  `store-remembered` variant.
- `apps/scenario-lab/src/scenarios/bigbox-retail/qualification/tests/new-store-cheapest-towels.test.ts`: the
  every-size cheapest check.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built, "inputs changed:
  apps/scenario-lab", 48.9s.
- `node --test "dist/scenarios/bigbox-retail/**/*.test.js"`: tests 62, pass 62, fail 0 (63.7s). The new
  store-remembered browser test passed.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs` (worktree root): "structure-audit: passed (204 warning(s), 638 baselined)".
- Extra, to find the shared entries my change needs:
  `node --test dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/realistic-site-live-tasks.test.js`
  gave tests 17, pass 16, fail 1. The failure is "qualification additions preserve the complete ordered original 57
  tasks": its diff is only the two pickup-towels rows' `instruction`. live-instructions (selector-like token rules,
  permission map) all pass with the new wording.

## Not verified

- No live Lab run of the reworded tasks (none authorised).
- The whole scenario-lab suite was not run, per the brief, while live lanes run.

## Open questions or contradictions found

- **Needed shared entry (supervisor):** in `apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts`
  lines 14 and 15 (`bigbox-retail-pickup-towels` and `bigbox-retail-pickup-towels-list-layout-after-creation`),
  replace "find every pack of paper towels that ValueRidge sells itself" with "find every pack of paper towels, not
  holders or dispensers, that ValueRidge sells itself". With that change the realistic-site-live-tasks test should
  pass again.
- The new-store reword touches only an addition row, so the baseline fixture does not need a change for it.
- The pickup-order row is the costliest bigbox path (about 20 acts). It needs no change, but it is the first one to
  watch against the $0.25 purse.
