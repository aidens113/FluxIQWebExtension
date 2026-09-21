# w2x-realistic-scenarios: `crossborder-marketplace` (t042)

Worker report for the brief `w2x-realistic-scenarios`, scenario
`crossborder-marketplace` (a cross-border marketplace of the AliExpress kind),
built in `F:\fxwork\t042-scn-crossborder-marketplace` on branch
`task/t042-scn-crossborder-marketplace`. Changes are uncommitted.

## Outcome

**Done.** The site, its tests and `pnpm check` pass. I made two live
`create-flow` runs of the extraction task, with DeepSeek on
`persistent-isolated` and `FLUXIQ_TEST_ENV_FILES=none`. FluxIQ built no Flow in
either run. Both builds stopped on `flow_bootstrap.evidence_tool_failed`. That
is a product gap, not a fixture defect (see below). Five fixture defects turned
up in my own browser testing, and all five are fixed.

## What changed and why

### The site: Farbazaar

The site is Farbazaar, a fictional brand. The buyer is Mara, who is signed in
and ships to Germany. The catalogue has 50 listings from 19 sellers, shipped
from warehouses in China, Spain, Poland and the Czech Republic. Every
realism item on the brief's list is present except the login wall, because the
buyer is signed in, which is the realistic setting for "buy this for me". Each
item below says where it lives.

- **Consent banner.** It sits at the bottom of the page and covers the product
  page's buy bar until it is answered (`markup/overlays.ts`).
- **Delayed interruptions.**
  - Welcome coupons appear 2 s after load, on a scrim that covers everything.
  - A notification prompt appears 3.5 s after load. It covers the filter
    sidebar on results pages and the gallery on item pages.
  - In the `flash-deal` variant, a flash-deal popup appears 1.5 s after an item
    page loads. Its big button leads to a different, sponsored hub.
  - The page script is `client/shell-script.ts`.
- **Chat pill over a button.** The pill is fixed over the centre of "Add to
  cart", which is itself fixed in a bottom buy bar. Only an 8 px sliver of the
  button stays exposed. The chat has to be minimised through a glyph that
  carries only `title="Minimize chat"`. The layout is in `styles/stylesheet.ts`.
- **Lazy loading and infinite scroll.**
  - Results arrive as skeletons. The first 10 cards are drawn from an inert
    `<template>` after 600 ms. The rest are fetched from `search/cards` when any
    remaining skeleton scrolls into view.
  - Images load lazily.
  - The home page's "More to love" feed scrolls infinitely.
- **Sponsored results.** Three "Ad" cards sit on every results page at slots 2,
  9 and 16.
  - Some are paid copies of organic results.
  - Two are ad-only listings that meet every Spain criterion.
  - One is a phone charger shown under a "Ships from Spain" filter.
- **Lookalike seller.** "VoltBay Store" sells the official listing's exact title
  a little cheaper, and it also appears as an ad.
- **Class names and ids.** Every class is a hash of the seed and the build
  (`styles/classes.ts`). The redesign build renames only the restyled
  components, as CSS-in-JS hashing does. Element ids are minted per page load
  (`rotatingId` in `markup/shell.ts`).
- **Real UI bugs.**
  - Next throws `Cannot read properties of undefined (reading 'current')` and
    goes nowhere. The page links and "Go to page" work.
  - The store coupon's first claim always fails with "Network busy, please try
    again", and the second claim works.
  - The feed's rate-limited request leaves its spinner up until Retry is
    pressed.
  - The cart icon's badge goes stale after "Add to cart"; the header flyout is
    refreshed.
  - The results header count stays the unfiltered 45 when filters are applied.
- **Anti-bot measures.**
  - Every third results page load since the last check is replaced by a "verify
    you are human" interstitial. It clears after a click and a 2 s check;
    reloading does not clear it.
  - The feed's second request returns 429 with `retry-after: 3`.
  - The checkout has a hidden `fax_number` honeypot. A submission that fills it
    is held for review, and no order is placed.
- **Iframes.** The item description and the payment-method picker are separate
  framed documents.
- **Shadow DOM.** The header region picker and the store-coupon widget are web
  components with their own shadow roots.
- **New tabs.** Result cards open items with `target=_blank`.
- **Variant pickers.** Colour swatches are named only by `title`. Specification
  and Ships From are div chips. Clicking a chosen option clears it. Sold-out
  combinations refuse the click. The combination the tasks ask for has only 4
  in stock, and its Poland twin is sold out.
- **Locale formatting.** Prices are written per region: `22,99 €`, `£19.77` and
  `US $25.06`. On the page they are split across three spans. Delivery windows
  are also written per region.
- **Div buttons with poor accessibility.** Every button is a styled `div`. There
  are no roles and no `aria-label`s. The unit test asserts that the home page
  markup has none.

### How it is judged

The oracle reads only read-only elements in the header flyouts and footer:
`mini-cart-count`, `mini-cart-line`, `store-coupons`, `orders-summary` and
`build-marker`. These are on every storefront page, so a run is judged wherever
it ends.

The only test id on a control is `add-to-cart`, on the buy bar as it ships. It
has to be there because the repair contract (`recordedTargetGone` in
`tests/live-repair-tasks.test.ts`) only recognises a recorded `testid:` target
that the variant then removes. A unit test asserts it is the only one.

### Manifest

The seed is `7342` and the start path is `/scenarios/crossborder-marketplace/`.

| Workflow | What it asks | Judged by |
| --- | --- | --- |
| primary | Put 3 × Voltbay hub from Voltbay Official Store (Space Grey · 7-in-1 · Ships from Spain) in the cart and collect that store's coupon. | Playback goal: the cart line text and the coupon text. Final state: `Cart (3)` and `Orders to be shipped (0)`. |
| primary / `basket-redesign` | The buy bar was redesigned. "Add to cart" lost its test id, now reads "Add to basket" and moved left. "Buy now" now stands where it stood. | The same final state. The page fact `add-to-cart exists false`. |
| primary / `flash-deal` | The flash-deal popup appears over the item page. | The same final state. |
| `spain-hubs` | Every hub that ships from Spain, ships free and is rated ≥ 4.5, without ads and each once, in Best Match order. | `expected.extracted`: 13 exact records (title, store, price, rating). |
| `spain-hubs` / `list-layout` | Results use a list layout; price and store move to a side column. | The same 13 records. |
| `place-order` | Buy 2 of the same option set with the store coupon and the saved Visa, then read the confirmation. | `expected.extracted`: one record (order, item, options, quantity `2`, total `43,98 €`). Final state: `Orders to be shipped (1)`. |

The 13 records are computed from the catalogue (`manifest/answers.ts`), not
read off a page. The browser test reads the same 13 off the rendered site in
two independent ways, and both must match.

### Tasks

In `live-tasks.ts`:

- `crossborder-marketplace-spain-hubs` is the extraction task.
- `-spain-hubs-list-layout` is the existing-Flow edge case, with
  `variantArmedAfterBuild`.
- `-hub-to-cart` is the state-changing task, judged by the playback goal.
- `-hub-to-cart-flash-deal` is the edge-case popup, with
  `variantArmedAfterBuild`.
- `-buy-hub` is the consequential task, judged by the `extract-order` dataset.
  The comment on it records that, without purchase permission, the correct
  outcome is `flow_bootstrap.permission_required` before playback, following
  the precedent of `order-operations-refund-quote`.

In `repair-tasks.ts`: `crossborder-marketplace-repair-basket-redesign`
(`expect: "repair"`, `temporary_target_override`). A positional repair lands on
"Buy now".

### Registrations outside the scenario directory

The brief asks for exactly one appended line per file, but that is not enough
to compile or register the scenario. These are the minimum:

- `src/types.ts`: 1 line, adding the id to `scenarioIds`. `defineScenario`
  requires a `ScenarioId`, and the registry test requires the registry order to
  equal this list. The brief does not list this file.
- `src/registry.ts`: 2 lines, the import and the map entry.
- `src/scenarios/live-instructions.ts`: 2 lines, the import and
  `...CROSSBORDER_MARKETPLACE_LIVE_TASKS,` at the end of `TASKS`.
- `src/scenarios/live-repair-tasks.ts`: 2 lines, the import and the spread.
- `src/scenarios/index.ts`: 1 line, re-exporting the scenario. This is harmless
  but not needed; the campaign reaches the tasks through the two lists above.
- `docs/architecture/testing-facility.md`: 1 row appended to the table of
  application fixtures, after `member-directory`.

The imports cannot be folded into the spread lines, and a `TASKS.push` after
the freeze would be too late. Every addition is at an end of its list, so the
supervisor's merge is still a union.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in `apps/scenario-lab` → no output.
- `node --test dist/scenarios/crossborder-marketplace/tests/scenario.test.js` →
  `# pass 11 # fail 0`.
- `node --test dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js`
  → `# pass 12 # fail 0`, about 30 s. The runs are headless full Chromium
  (`channel: "chromium"`, as `e2e/playwright.config.ts` launches it, because
  the headless shell crashes on launch on this host). Each test has its own lab.
  - **Honest paths that pass every oracle:**
    - The cart script meets the goal and the final state.
    - The filtered extraction returns the 13 records exactly.
    - Paging the whole search and deduplicating returns the same 13. That test
      also checks that Next is dead and throws, and that page 3 brings the
      traffic check, which it passes.
    - The purchase returns the order record and one paid order.
    - `basket-redesign` is repaired by "Add to basket".
    - `flash-deal` passes once the popup is closed.
    - `list-layout` returns the 13 from the list rows.
    - The feed recovers after Retry.
  - **Naive paths that fail:**
    - A click at the centre of Add to cart hits the chat pill and opens the
      chat panel; the cart stays empty.
    - Taking the sponsored "VoltBay Store" ad puts the wrong store's line in the
      cart.
    - An extraction that keeps the ads returns 16 records, not 13.
    - Keeping repeats returns 15.
    - Filling the fax honeypot gets the order held for review.
    - On `basket-redesign`, clicking where Add to cart used to be presses Buy
      now, goes to checkout and leaves the cart empty.
    - On `flash-deal`, the recorded path times out behind the popup.
    - On `list-layout`, the recorded grid read returns 0 records.
    - On a first visit, the consent banner, and then the welcome scrim, is the
      topmost element at Add to cart's centre.
  - **Console errors:** every honest path logs none beyond the manifest's
    `allowedConsoleErrors`.
- `pnpm test` in `apps/scenario-lab` → `# tests 354 # pass 354 # fail 0`. This
  includes the corpus-wide registry, `live-instructions` and
  `live-repair-tasks` tests.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (81 warning(s),
  122 baselined)`, with no finding under `crossborder-marketplace`.
- `pnpm check` at the repository root → `exit 0`. Its node suites reported
  182/182, 74/75 (0 failing) and 113/113. The structure audit passed and every
  package typecheck finished `Done`.
- **Live run 1.** `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t042-crossborder pnpm lab:campaign crossborder-marketplace-spain-hubs`
  - Run `test-runs/run-mubnrznd-299a2c1f`. Verdict `failed`, `flowCreated: false`.
  - The build made 2 provider calls, 19,160 tokens, $0.0086, in 29 s.
  - Steps: `inspect_current_page` ✓, then `navigate_same_origin` ✓ (effect
    applied), then `build.failure` `flow_bootstrap.evidence_tool_failed` at
    stage `provider_output_validation`, HTTP 400.
  - The dataset judgement was not measured, because there was no Flow.
- **Live run 2.** The same command, run to check reproducibility.
  - Run `test-runs/run-mubo1as3-a957f143`. The build made 9 calls, 109,947
    tokens, $0.049, in 82 s.
  - Steps: inspect, navigate, `detect_repeating_structure` (detected), inspect,
    navigate, `detect_repeating_structure`
    (`web.action.rejected.no_repeating_structure`), navigate, navigate
    (`rejected.no_progress`), inspect.
  - It then failed the same way: `flow_bootstrap.evidence_tool_failed`, stage
    `provider_output_validation`, HTTP 400.
- **Isolation of both runs.** Both used ports in the 5818x range, and Core was
  `quiet` at `F:\fxwork\!FluxIQ`. `FLUXIQ_TEST_ENV_FILES=none` was set on both,
  and the credential came from `.env.local` by its one name. The user's panel
  and ports 3000 and 4711 were not touched.

## Fixture defects found and fixed

All five came from my own browser tests, none from the live runs.

1. **Route mutations were ignored.** The mutations carried no `payload`, and
   `mutateMarketState` ignores a non-record payload. So the traffic check, the
   feed's 429 and the page-view count never fired. Every route mutation now
   carries `payload: {}`.
2. **The 404 favicon broke the console rule.** Every page's `/favicon.ico`
   request got a 404, which Chrome logs as a console error. The Lab's console
   watch fails any run on an unlisted console error. Every document now declares
   an inline icon.
3. **The lazy grid missed jump scrolls.** It only watched the 11th skeleton, so
   a single large scroll past it never loaded the rest. It now watches every
   remaining skeleton.
4. **The redesign build renamed every class.** The recorded Flow would then have
   failed on an unrelated control before reaching the drifted one. Now only the
   buy bar's four classes change.
5. **The recording script's `text="Spain"` matched two elements.** The second
   was the region picker's `<option>` inside its shadow root. The site's
   ambiguity is realistic, so the script was what was wrong; it now targets the
   option group.

## Product gaps found (recorded, not fixed)

1. **A failed exploration tool ends the whole build.** Both builds ended on a
   thrown tool error, which Core maps to `flow_bootstrap.evidence_tool_failed`
   (`evidence-loop.ts:450`). Core does not return it to the model as a
   recoverable refusal. On the domain side, `capture.ts:95` throws when a
   snapshot capture does not succeed, and `capture.ts:128` throws when a page
   interaction does not succeed. On this site that would happen, for example,
   when a press is aimed under the welcome scrim, the consent banner or the
   notification card, or when the traffic check reloads itself after its press.
   The same code ended the builds reported by the `auction-marketplace`,
   `company-website`, `job-board` and `professional-network` workers.
2. **The bundle cannot say which call failed.** `evidenceLoop.steps` stops
   before the failing call: its tool id, target and reason are not recorded.
   `observedCalls` is empty (`perCallRecords: "not recorded"`). In run 2, the
   `no_repeating_structure` result followed by `no_progress` very likely means
   the model's URL navigations reached the traffic check, but I cannot prove
   that from the evidence.
3. **The model explored by typing URLs, not by using the page.** Run 2 made
   four `navigate_same_origin` calls and never pressed the search box, a filter,
   or the check. Navigating by URL triggers the traffic check just as page loads
   do.
4. **The Lab's screenshot shows the wrong tab.** In both runs the failure
   screenshot shows the home page with the welcome modal. That is the Lab's own
   tab, not the page the exploration was on, so it adds no evidence.

## Not verified

- **The Lab recording lane** (`pnpm lab run crossborder-marketplace [--workflow …]`
  without `--live-llm`) was not run. Its scripts are proven only by my
  Playwright harness, which mirrors `step-runner.ts`. These are unknown:
  - whether the extension records clicks inside the coupon shadow root and the
    payment frame;
  - whether its extraction intent accepts the `:has()` and `:is()` selector
    that `extract-spain-hubs` uses. This is standard CSS that Chromium
    supports, but only Playwright ran it.
- **The other tasks were not run live:** the cart, flash-deal, list-layout and
  buy tasks, and the repair task. In particular, whether `-buy-hub` actually
  ends in `permission_required` is unmeasured.
- **Timing of the cart oracle.** `checkFinalState` reads the page once, with no
  waiting, and "Add to cart" posts after a 700 ms spinner. A Flow that stops
  right after the click could therefore be read before the line exists. An
  honest person waits for the "Added to cart!" toast.
- **The vacuous page fact.** Page facts are checked on the start page (home),
  so `basket-redesign`'s `add-to-cart exists false` holds there trivially. The
  real removal is on the item page, and the browser test asserts it there.

## Open questions or contradictions found

1. **The one-line rule cannot be met.** "Exactly one appended line each" is not
   possible, as explained under Registrations. `types.ts` also has to change,
   and it is not in the brief's list.
2. **The catalog cannot judge a permission request.** `LiveInstructionTask`
   only has `judgeBy: "playback-goal" | "expected-dataset"`, so "must end in a
   permission request unless granted" is written only as a comment, as the
   existing precedent does. `-buy-hub`'s verdict is its dataset, so a correct
   ungranted run reads as `failed` in the campaign totals. A judgement type for
   `permission_required` would need a change in `live-instructions.ts` and the
   Lab, which are not mine.
3. **The browser test adds time to `pnpm test`.** It adds about 30 s and needs
   the Playwright Chromium installed. It uses `channel: "chromium"`, as the e2e
   config does.
