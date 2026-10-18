# Audit: everything-store tasks (t708, worker `audit-everything-store`)

## Outcome

Done. All ten everything-store rows in `REALISTIC_SITE_LIVE_TASKS` have a verdict. One task could not be done from its
wording (office checkout). Eight more were reworded only to name the order and the exact value formats the oracle
compares. One was left as it was (buy-kettle). No oracle or fixture had to change. Rewording four original tasks breaks
one shared test, `qualification additions preserve the complete ordered original 57 tasks`, until the supervisor
updates the baseline fixture. The exact entries are below.

Why the formats matter: the dataset oracle (`packages/test-runner/src/run-expectations/extraction/judgement.ts`
`assertExtraction`, `value-match.ts`) compares records **by position** and values **exactly**. The only leniency is
that an absolute URL on the same origin matches a root-relative one. So a task that does not state its order, or the
written form of a value ("4.0" against "4", "$44.99" against "44.99", "Save 10%" against "Save 10% with coupon"), lets a
reasonable reading fail.

## Verdicts

| Task id | Verdict |
| --- | --- |
| `everything-store-plus-earbuds-under-50` | reworded (format) |
| `everything-store-first-page-plus-earbuds` | reworded (order, format) |
| `everything-store-first-page-plus-earbuds-deal-wheel` | reworded with its base row (shared `FIRST_PAGE`) |
| `everything-store-kettle-to-cart` | reworded (order, format) |
| `everything-store-buy-kettle` | ok |
| `everything-store-restore-saved-cloths` | reworded (site term, quantity, format) |
| `everything-store-coupon-earbuds-rated-four` | reworded (coupon wording, price before coupon) |
| `everything-store-batteries-and-descaler` | reworded (format) |
| `everything-store-sage-small-kettle-if-in-stock` | reworded (order, format) |
| `everything-store-office-checkout-review` | reworded (route not reachable from its wording; formats) |

Possible: every task already had a browser-path test that reaches its oracle (`tests/honest-paths.test.ts` for plus,
first-page, deal-wheel, kettle-to-cart, buy-kettle and restore-cloths; `tests/breadth-paths.test.ts` for coupon,
batteries, sage and office), and each of those tests passes (below). Judge-checkable: every row and act can be seen on
the pages: the cards, the cart, the checkout and the confirmation all render from the store's state. Purse: the live
runs logged in the lane trees fit well under $0.25: plus-under-50 has passed repeatedly at $0.027-$0.127, coupon at
$0.102, batteries at $0.023, sage at $0.033. Office ended blocked at $0.022 and $0.042 for its wording, not for cost.
The honest paths are 1 search plus 5 pages (the two sweeps), 1 search plus 1 page (first page), and about 6-12 acts
(the cart and checkout tasks). None is flagged.

### Per task

**plus-earbuds-under-50.** The answer is 13 records, checked from the catalogue (ranks
1,12,15,17,27,29,31,33,41,42,43,49,58). The traps are named in the wording or are clear from the site: $50.00 is not
"under $50"; the 3.8 and 3.9 that the "4 Stars & Up" filter lets in are not "rated 4.0 or higher"; ear tips and the
charging case are excluded by name; the rank-41 lookalike is a separate listing at its own URL ("...Ivory with
Wireless Charging Case" is earbuds sold with a case, not a charging case on its own). The gap was formats only: rank 12
and rank 31 print "4.0", which a reader could write as "4".
- Old tail: "...keep the order the search results show them in, with columns name, price, rating and url."
- New tail: "...with columns name, price, rating and url, where name is the product name as listed, price is the price
  the listing shows, written like $19.99, rating is the number shown beside its stars, written like 4.0, and url is the
  address the product name links to."

**first-page-plus-earbuds and its deal-wheel row** (they share one instruction and change together). The oracle is the
16 organic Plus results of page 1 in page order. The instruction never stated an order, and the oracle compares by
position.
- Old: "Search the store for wireless earbuds, narrow the results to Brightaisle Plus items, and collect every search
  result on the first page, leaving out sponsored placements, into a table with columns name, price, rating and url."
- New: "...leaving out sponsored placements, in the order the page shows them, into a table with columns name, price,
  rating and url, where name is the product name as listed, price is ..., written like $19.99, rating is ..., written
  like 4.0, and url is the address the product name links to."
- The "Featured from our brands" carousel has a "Sponsored" heading, and the "Customers frequently viewed" widget is
  not search results, so both are excluded by the existing words. The `scenario.test.ts` guard on "every search result
  on the first page" still holds.

**kettle-to-cart.** The oracle is two Sage Green 1.7 L kettles at $44.99 each above the batteries, newest line first.
The instruction stated neither the order nor the price format.
- Old tail: "...as a table with columns item, quantity and price, where quantity is a plain number and price is the
  price of one."
- New tail: "...as a table with columns item, quantity and price, where item is the product name the cart shows,
  quantity is a plain number and price is the price of one, written like $12.97, in the order the cart shows them."

**buy-kettle: ok.** It is a playback goal with the permission point "Place your order", which matches the button text.
The words "new", "sold by Brightaisle itself", "free with standard delivery", "home", "Visa", "nothing signed up for"
and "left where they are" each match a site option. Two honest routes exist and both meet the goal facts: Buy Now, and
Add to Cart with the other lines deselected (the cart route orders only selected lines, `state/checkout-ops.ts:20,38`).
That is acceptable because the goal checks only the order and the cart count.

**restore-saved-cloths.** The cart section is called "Saved for later", not "Save for later". The instruction gave no
quantity form and no price format.
- Old: "Move the ... 24 Pack from Save for later back into my cart. ... List the active cart with columns item, quantity
  and price, where price is the price of one, in the order the cart shows it."
- New: "Move the ... 24 Pack from Saved for later back into my cart. ... Then give me what is in my cart, leaving out
  the saved items, as a table with columns item, quantity and price, where item is the product name the cart shows,
  quantity is a plain number and price is the price of one, written like $12.97, in the order the cart shows them."

**coupon-earbuds-rated-four.** The answer is 5 records, checked from the catalogue: ranks 12 and 14 on page 1, and 57,
58 and 60 on page 4. Four couponed pairs fail the rating (3.8, 3.8, 3.7, 3.3), and no accessory or advert carries a
coupon. The card prints "<badge>Save 10%</badge> with coupon", so "the coupon's wording as the listing shows it" reads
as "Save 10% with coupon", while the oracle holds "Save 10%". The live pass (run-mvcvzwd3) got it right by luck of
reading. "price" could also be read as the price after the coupon.
- Old tail: "...with columns name, price, coupon and url, where coupon is the coupon's wording as the listing shows
  it."
- New tail: "...where name is the product name as listed, price is the price the listing shows before any coupon,
  written like $19.99, coupon is the saving the coupon badge names, written like Save 20% or Save $3.00 without the
  words "with coupon", and url is the address the product name links to." The example values are not ones the store
  uses.

**batteries-and-descaler.** It already named the order. Added the item and price format (same `CART_TABLE` tail).
Raising the line and adding two more (which merge into the same line) both meet the account fact; deleting the line and
adding it again is caught.

**sage-small-kettle-if-in-stock.** The Sage Green 1.0 L page says "Currently unavailable.", so the right answer is the
unchanged two-line cart, and the instruction says so ("Either way"). It did not state the order or the price format;
added the same `CART_TABLE` tail.

**office-checkout-review: reworded, because the oracle's route did not follow from the wording.** The oracle requires a
Buy Now checkout (`pipeline: "buy-now"`) and an untouched cart. "Ready to buy on its own, leaving my cart as it is"
names neither the route nor the button. Two live runs (t563 `run-mvcx8na6-9554a3f1` and `run-mvczd85j-c98561c5`)
pressed Add to Cart and ended blocked. The second run's note said that naming the control would teach to the test.
Under the 2026-10-17 rule ("in the site's own terms ... changing a task is not teaching to the test") the task now
names the store's own button. This follows the same precedent as the bigbox Delivery rewording (`2485e450`). Adding the
kettle to the cart and checking it out alone, with the other lines deselected, is a near-route. It still adds a cart
line and is not a Buy Now, so the oracle correctly fails it. A new test pins this.
- Old: "Get one Brightaisle Basics Electric Kettle, 1.5 litre, in white, sold by Brightaisle, ready to buy on its own,
  leaving my cart as it is: ... Then give me what checkout shows as a table with columns item, address, arriving and
  total, where address is the delivery address, arriving is the delivery date and total is the order total."
- New: "Take one Brightaisle Basics Electric Kettle, 1.5 litre, in white, sold by Brightaisle, to checkout on its own
  with the Buy Now button on its page, so that my cart is left as it is: ... Then give me what checkout shows as a
  one-row table with columns item, address, arriving and total, where item is the product name checkout lists, address
  is the delivery address exactly as checkout shows it, name included, arriving is the delivery date as checkout writes
  it, like Monday, September 21, and total is the order total, written like $12.97."
- Format reasons: checkout prints the address with the name first ("Dana Whitfield, Northgate Dental, ..."). The date
  appears both as "Arriving Thursday, September 24" and as "Thursday, September 24" in the option row. The total
  appears as both "Total before tax" and "Order total" (both $7.59). The example date is the store's "today", not the
  answer.

## What changed and why

- `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts`: two shared clause constants, `LISTING_VALUES`
  (how a results card is written down) and `CART_TABLE` (how a cart read is written down), plus the rewordings above.
  The header comment now records the rule.
- `apps/scenario-lab/src/scenarios/everything-store/tests/breadth-oracles.test.ts`: two tests.
  1. "the office kettle cannot go through the cart: ...". It checks that the add-to-cart, deselect-others, cart-checkout
     route checks out the kettle alone, fails both the checkout fact and the account fact, and that the instruction
     names Buy Now.
  2. "every dataset task states the order and how each value it is judged on is written". For every everything-store
     dataset task, each column of its oracle must have its format clause in the instruction, and any oracle with more
     than one record must state an order. This is a mechanical guard, so a later edit cannot drop a format again.

## Entries the shared tests need (I did not edit them; `scenarios/tests/*` is not mine)

`apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts` pins the original 57 tasks. Four of its
everything-store entries must take the new instruction strings. Every other field is unchanged, and buy-kettle is
unchanged.
- `everything-store-plus-earbuds-under-50`: `"instruction": "Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url, where name is the product name as listed, price is the price the listing shows, written like $19.99, rating is the number shown beside its stars, written like 4.0, and url is the address the product name links to."`
- `everything-store-first-page-plus-earbuds` and `everything-store-first-page-plus-earbuds-deal-wheel`: `"instruction": "Search the store for wireless earbuds, narrow the results to Brightaisle Plus items, and collect every search result on the first page, leaving out sponsored placements, in the order the page shows them, into a table with columns name, price, rating and url, where name is the product name as listed, price is the price the listing shows, written like $19.99, rating is the number shown beside its stars, written like 4.0, and url is the address the product name links to."`
- `everything-store-kettle-to-cart`: `"instruction": "Put two Tidewell electric kettles in sage green, 1.7 litre, sold by Brightaisle itself, in my cart, and move the phone case that is already in my cart to Save for later. Then give me what is in my cart, leaving out the saved items, as a table with columns item, quantity and price, where item is the product name the cart shows, quantity is a plain number and price is the price of one, written like $12.97, in the order the cart shows them."`

`scenarios/tests/live-instructions.test.ts` needs no change: the permission map and the reasons recorded for tasks that
ask nothing are unchanged.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t708-audit-everything-store`.
- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`) ->
  `{"build-cache":"build","step":"scenario-lab:build","reason":"inputs changed: apps/scenario-lab; ...","ms":72986,"source":"command"}`.
- `node --test` over every `dist/scenarios/everything-store/**/*.test.js` (7 files: qualification/tests/expected,
  tests/breadth-oracles, breadth-paths, honest-paths, naive-paths, person-check, scenario) -> `# tests 56`, `# pass 56`,
  `# fail 0`, 43.6 s. This includes every browser-path test.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` -> `{"build-cache":"build","step":"scenario-lab:check",...}`,
  `EXIT=0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (204 warning(s), 638 baselined).`
- To scope the shared-test impact (the brief does not require this run):
  `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`
  -> 16 pass, 1 fail: `not ok 17 - qualification additions preserve the complete ordered original 57 tasks`. This is
  the expected baseline-fixture failure above.
- A provider-free catalogue script (scratchpad `es-audit1.mjs`, run on the built dist) listed every couponed listing,
  the Plus/4.0/under-$50 answer, the near-misses and the pages' adverts. These are the counts quoted above.

## Not verified

- No live or provider-free Lab run of the reworded tasks, so the effect of the new wording on a model is unmeasured. In
  particular, office-checkout-review should now press Buy Now, but that is not proven.
- The lanes compare plus-under-50 across "frozen pair" runs. Its instruction changed (format clause only), so later
  runs are not word-for-word comparable with the frozen pair.
- The shared baseline fixture is not updated, so `realistic-site-live-tasks.test.ts` fails on this branch until the
  supervisor applies the entries above.

## Open questions or contradictions found

- Model guidance (not my scope, not edited): two comments name this scenario's wording.
  `domain/src/output-nodes/extract-list/catalog-text.ts:221` names "Brightaisle Plus eligible" and
  `apps/extension/src/content/extraction/badge-name.ts:9` cites an instruction asking for it. The first is in the
  catalog-text module. If that comment's text reaches the model, it mirrors a realistic scenario, against the
  2026-10-09 rule. Worth a check by whoever owns domain.
- None about the fixture: the comments in `workflows/coupon-earbuds.ts` and `live-tasks.ts` match the catalogue.
  Couponed listings sit on pages 1, 2, 4 and 5, and the five answers sit on pages 1 and 4.
