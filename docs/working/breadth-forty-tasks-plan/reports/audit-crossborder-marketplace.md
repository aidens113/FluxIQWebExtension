# Audit: crossborder-marketplace (t709)

Worker `audit-crossborder-marketplace`, worktree `fxwork/t709-audit-crossborder-marketplace`, 2026-10-17.

## Outcome

Done. All 12 rows have a verdict. 4 rows were reworded: 3 instructions changed, and one of them is shared by two
rows. No oracle or fixture data changed. One comment was corrected, and 3 site tests were added to pin the new
wording against the oracles. The site tests, `check` and the structure audit pass. One shared test now fails:
`scenarios/tests/fixtures/realistic-task-baseline.ts` pins the old wording of three original rows. The supervisor
updates that file (entries below).

The judge compares extracted values exactly (`packages/test-runner/src/run-expectations/extraction/value-match.ts`
`extractedValueMatches`: only root-relative URLs are loosened). Every value format named below is load-bearing.

## Verdicts

| Task id | Verdict |
| --- | --- |
| `crossborder-marketplace-spain-hubs` | **Reworded** (see 1) |
| `crossborder-marketplace-spain-hubs-list-layout` | **Reworded**, same instruction constant as above |
| `crossborder-marketplace-hub-to-cart` | ok |
| `crossborder-marketplace-hub-to-cart-flash-deal` | ok |
| `crossborder-marketplace-hub-to-cart-flash-deal-during-build` | ok |
| `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` | ok |
| `crossborder-marketplace-buy-hub` | **Reworded** (see 2) |
| `crossborder-marketplace-collect-official-coupon-only` | **Reworded** (see 3) |
| `crossborder-marketplace-free-hubs-under-ten` | ok (one comment corrected, see 5) |
| `crossborder-marketplace-follow-official-store` | **Reworded** (see 4) |
| `crossborder-marketplace-mint-hub-fallback` | ok |
| `crossborder-marketplace-uk-express-quote` | ok |

### 1. spain-hubs and spain-hubs-list-layout: "every hub" became "every item"

- Old: `... search for "usb c hub" and collect every hub that ships from Spain, has free shipping and is rated 4.5 stars or higher, ...`
- New: `... search for "usb c hub" and collect every item that ships from Spain, has free shipping and is rated 4.5 stars or higher, ...` (the rest is unchanged)
- Why: one of the thirteen oracle records, "Keelson USB C Docking Station 12 in 1 Triple Display 2 HDMI DP
  Ethernet PD 100W", never says "hub" in its title. A strict reader of "every hub" could drop it and fail by one
  record. "Item" matches the instruction's own "list each item only once", and the ads, the only non-hubs in the
  results, are already left out by name.
- Checked as unambiguous otherwise: "ships from Spain" is the card's "Ships from Spain" badge (the first non-China
  origin, and Spain for every multi-warehouse listing). "Has free shipping" is the card's "Free shipping". No Spain
  listing is "free over". A rating of 4.5 counts as "4.5 or higher". The two Voltbay listings share a title but
  are different items (store column). Price is the card's lowest-option price, which "as the results show them"
  pins. Best Match order holds when filtered.
- Possible: `browser-paths.test.ts` reaches the 13 records by the filters and by paging; the list-layout variant is covered too.
- Purse: about 10 acts on one narrowed page (one traffic screen). Fits.

### 2. buy-hub: confirmation values written as shown

- Old: `Then give me the order confirmation with columns order, item, options, quantity and total.`
- New: `Then give me the order confirmation as a one-row table with columns order (its order ID), item, options, quantity and total (the total paid), written exactly as the confirmation shows them.`
- Why: the oracle holds `options: "Space Grey · 7-in-1 · Ships from Spain"`, the order ID's digits and
  `total: "43,98 €"` exactly. The old wording gave no format, and the page shows several amounts. "Total paid" is
  the confirmation's own label. "Order ID" is its own label for the number the oracle holds.
- Permission point is unchanged (`move_money`, "Place order"). Purse: the honest path stops at the permission
  request. With permission it is about 14 acts.

### 3. collect-official-coupon-only: the whole account line, and "collect" rather than "use"

- Old: `... leave the welcome/platform coupons alone and do not use VoltBay Store's coupon, put anything in my cart, start checkout or buy anything. Give me a one-row table with column coupon containing exactly how my account lists the collected store coupon.`
- New: `... leave the welcome/platform coupons alone and do not collect VoltBay Store's coupon, put anything in my cart, start checkout or buy anything. Give me a one-row table with column coupon containing my account's "Store coupons" line exactly as the account writes it, label included.`
- Why: the oracle value is the whole flyout line `Store coupons: Voltbay Official Store 2,00 € off orders over
  25,00 €`. "How my account lists the collected store coupon" reads just as well as the coupon without its
  `Store coupons: ` label, which fails the exact compare. "Do not use" the lookalike's coupon did not forbid
  collecting it, but the exact `store-coupons` final-state fact fails if it is collected.

### 4. follow-official-store: the whole account line

- Old: `Then give me a one-row table with column following containing exactly how my account lists the stores I follow.`
- New: `Then give me a one-row table with column following containing my account's "Followed stores" line exactly as the account writes it, label included.`
- Why: same as 3. The oracle is `Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official
  Store; Voltbay Official Store`, label and "; " separators included.

### 5. Rows confirmed ok

- **hub-to-cart** and its three variant rows: Space Grey / 7-in-1 / Spain are the page's Color, Specification and
  Ships From chips. The store is named, which rules out the lookalike. Stock is 4, so three fit. The coupon is the
  store card's "Get coupons" (the first claim always fails). The judge reads the cart line, `Cart (3)`, the
  official coupon line and no orders. Flash-deal (close glyph) and basket-redesign ("Add to basket") each have a
  browser test reaching the goal. Purse: about 13 acts. The lane debugs for these rows name product defects, never
  the wording.
- **free-hubs-under-ten**: 10 records (2,89 € to 9,87 €), no price ties. "Ships free on its own (not only above a
  minimum spend)" separates "Free shipping" from "Free shipping over …", and the site's Free shipping filter makes
  the same cut. The ads are all dearer than the ceiling. Every qualifying title says "Hub". Corrected comment in
  `manifest/free-hubs-under-ten.ts`: the narrowed page holds **two** paid placements, not three, as
  `breadth-tasks.test.ts` already asserts (12 cards). The t565 debugs for this task name pager, column-sample and
  loop defects, never the wording.
- **mint-hub-fallback**: Mint 10-in-1 is sold out from all three warehouses, and the page says "This combination
  is sold out." The fallback (Mint · 7-in-1 · Ships from Spain, 2) is in stock. The cart page's store heading,
  title link, option line and stepper number are the four columns, "as the cart page shows them".
- **uk-express-quote**: "Ship to … United Kingdom / GBP" is the header picker's own wording. Silver is a swatch.
  "Express Shipping" is the checkout select's option. The Summary rows "Items total", "Shipping" and "Total" give
  £17.16, £6.01 and £23.17. Purse: about 14 acts. Fits. One oddity, not changed: the checkout's address card still
  shows a Leipzig, Germany address after the region change. The instruction asks only for the ship-to country,
  so the answer still follows. A model may remark on it.

## Entries the shared tests need

`apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts`: change only the `instruction` value of
three entries. Everything else in them stays as it is.

- `crossborder-marketplace-spain-hubs` and `crossborder-marketplace-spain-hubs-list-layout`: replace
  `collect every hub that ships from Spain` with `collect every item that ships from Spain`.
- `crossborder-marketplace-buy-hub`: replace
  `Then give me the order confirmation with columns order, item, options, quantity and total.` with
  `Then give me the order confirmation as a one-row table with columns order (its order ID), item, options, quantity and total (the total paid), written exactly as the confirmation shows them.`

`realistic-site-live-tasks.test.ts` addition ids and `live-instructions.test.ts` maps need no change: no id, kind,
judge, permission point or person check changed.

## What changed

- `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`: the four rewordings above (the
  `SPAIN_HUBS`, `BUY_HUB` and `FOLLOW_OFFICIAL_STORE` constants and the coupon-only row), plus a missing space in
  `BUY_HUB =`.
- `apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/free-hubs-under-ten.ts`: comment only (two paid placements).
- `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/live-tasks.test.ts`: three tests that pin each
  instruction against its oracle:
  - the account-line label the oracle value starts with is the label the instruction quotes;
  - spain-hubs asks for "every item", and one record's title has no "hub";
  - buy-hub asks for values "written exactly as the confirmation shows them".

## Commands run and observed results

All run in `fxwork/t709-audit-crossborder-marketplace`.

| Command | Result |
| --- | --- |
| `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`) | exit 0, "inputs changed: apps/scenario-lab", 45 s |
| `node --test dist/scenarios/crossborder-marketplace/**/*.test.js` (globstar, in `apps/scenario-lab`) | `# tests 57`, `# pass 57`, `# fail 0` |
| `node --test dist/scenarios/crossborder-marketplace/tests/live-tasks.test.js` | 5 of 5 ok, the 3 new tests included |
| `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` | exit 0 |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (204 warning(s), 638 baselined).` |
| `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js` (to quote the expected shared failure) | `not ok 4 - qualification additions preserve the complete ordered original 57 tasks`. The differing ids are exactly `crossborder-marketplace-spain-hubs`, `-spain-hubs-list-layout` and `-buy-hub`. The other 3 tests pass. |
| `node --test dist/scenarios/tests/live-instructions.test.js` | `# pass 13`, `# fail 0` |

## Not verified

- No live or dry Lab run of the reworded tasks (none asked for, and none run while the lanes are live).
- The whole scenario-lab suite was not run, only this site's tests and the two shared files above.
- Whether a model actually misread "every hub", or the account-line wording, was never observed live. Both
  rewordings come from reading the oracle and the pages.

## Open questions or contradictions found

- The checkout's shipping address stays German after the ship-to country becomes the United Kingdom
  (`markup/checkout.ts`, a fixed address card). This is harmless to the quote, but it is a coherence gap a fixture
  change could close if a live run trips on it.
- `realistic-task-baseline.ts` freezes original instructions, so every audit rewording of an original row needs
  the supervisor's edit there.
