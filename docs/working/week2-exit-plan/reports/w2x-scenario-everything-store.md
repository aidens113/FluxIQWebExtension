# w2x-scenario-everything-store

Worker report for `### Brief: w2x-realistic-scenarios`, scenario `everything-store` (task t041, worktree `F:\fxwork\t041-scn-everything-store`, branch `task/t041-scn-everything-store`). All changes are uncommitted.

## Outcome

**Done.** The site, its oracles, five live tasks and two repair tasks are built. Every check the brief names was run, and every one passed:

- the scenario's unit tests;
- honest-path and naive-path browser tests;
- the whole scenario-lab suite;
- `pnpm check`.

The brief asked for one live `create-flow` run of the extraction task. I made four live runs: two of the hard extraction task, one of the first-page task, and one control run of an existing fixture. **None built a Flow.** Every failure was on the product side, and I found no fixture defect. The control run of the existing `product-catalog-first-page` task also failed to build. That places the product's current baseline on this machine below what this site demands.

## What changed and why

### The site: Brightaisle, a fictional everything store

The scenario lives in `apps/scenario-lab/src/scenarios/everything-store/`: 96 files, about 4,500 lines, the largest 240 lines.

| Directory | Holds |
| --- | --- |
| `catalog/` (`earbuds/`, `kettles/`) | Authored data and search |
| `state/` | Store state; mutations are the oracle |
| `pages/` (`cart/`, `results/`, `challenges/`) | Server-rendered pages |
| `client/` | Browser scripts |
| `style/` | Per-seed class names and ids |
| `workflows/` | Manifest workflows |
| `tests/` | Unit tests and browser paths |

The catalogue is seed-independent, so every oracle is fixed and exact:

- 70 earbud listings over five results pages;
- 12 adverts and a sponsored house-brand carousel;
- a Tidewell kettle in six variants (one unavailable), with cheaper marketplace offers and a one-letter-off knockoff advert;
- a returning shopper's cart (phone case and batteries), with two items saved for later.

The lab seed changes only three things: every class name, every generated id (React-style `:r4k2a:`), and the robot check's characters.

**Realism (the brief asks for six; there are fifteen):**

1. A cookie banner fixed over the bottom of the viewport.
2. An app banner that arrives at 2 s, in the page flow, and shifts the layout.
3. A notifications modal at 4 s that makes the page inert until it is answered.
4. A support chat in a shadow root that opens itself over the buy box at 5 s, and stays open across pages until minimised.
5. Placeholder results, with real cards rendered from a template after 700 ms.
6. A results tail (the last 4 or 5 results on each page) that loads only after a scroll.
7. Sponsored cards with the same container as organic ones, linking through an ad redirect in a new tab.
8. A sponsored carousel labelled only at its heading, and a "frequently viewed" widget of non-results.
9. Class names and ids generated per seed.
10. Prices written twice in markup (a hidden readable span plus split visible parts), and "List:" prices beside them.
11. Real UI bugs:
    - every later results page repeats the previous page's last result;
    - Next on page 2 links back to page 2;
    - the cart badge adds 1 per add, whatever the quantity;
    - the buy box ignores clicks until hydrated at 1.2 s;
    - Save for later fails once, and its spinner clears only on "Try again" after 4 s;
    - the results count claims "over 1,000".
12. Variant pickers that are `div`s with only a `title`; the quantity stepper and cart actions are `span`s.
13. Checkout preset to the store's preferences: Brightaisle Day delivery rather than standard, and a Plus free trial pre-ticked that becomes $14.99/month. There are two "Place your order" buttons.
14. A payment-method iframe, and an iframe-free confirmation page.
15. Filter-rail semantics that differ from a shopper's:
    - "4 Stars & Up" rounds to the star icon, so it admits a 3.8;
    - "$25 to $50" includes $50.00;
    - two accessories share every search word with earbuds.

**Anti-bot defences (all passable by honest behaviour except the hard challenge):**

- The **honeypot** is the search form's first text field, named `field-keywords`, off-screen and `aria-hidden`. The footer newsletter carries another. Filling either flags the session.
- The **rate limiter** refuses the 6th results page within 8 s with a 429 and a computed `Retry-After`. A refused request is not counted, so waiting as asked always works. The third refusal flags the session.
- The **soft check** meets the session's first search: "Click the button below to continue shopping". The button unlocks at 1.5 s, or the check passes by itself at 8 s.
- The **hard challenge** is the robot check. It is served for every page while the session is flagged or armed. Its characters are drawn on a canvas and never appear as page text. The right answer clears it; a wrong one marks `robot-check-error` and changes the image. The correct automated outcome is asking the person (`user_intervention_required`); the refusal repair task judges exactly that.

**Test ids:** only one interactive control has one, the header search button (`nav-search-submit`); see open question 3. All other test ids sit on passive status text the oracle reads: `cart-count`, `cart-subtotal`, `result-count`, `order-*`, `plus-trial`, `robot-check`, `robot-check-error`, `soft-check`, `rate-limited`, `deal-wheel`.

### Workflows and variants (in `manifest.ts` and `workflows/`)

- **Primary: buy one Matte Black 1.7 L kettle.** This is the playback goal, and the consequential task. The goal's nine facts are:
  - the order line (sold by Brightaisle);
  - no second line;
  - "FREE Standard Delivery: Thursday, September 24";
  - the home address;
  - "Paid with Visa ending in 4417";
  - "Order total: $44.99";
  - no `plus-trial`;
  - `cart-count` still 2.
- **`add-to-cart`: two Sage Green kettles, the phone case moved to Saved for later, the cart read back.** The dataset `extract-cart` has 2 records; the final state is `Subtotal (3 items): $107.47`. Its variant `redesigned-header` is the repair entry point: the test id is gone, the button that searches is renamed "Search Brightaisle" and moved left, and "Search with your camera" stands where it stood.
- **`first-page-earbuds`: the 16 organic results on page 1 of a Plus-only search**, as the dataset `extract-first-page`. It is recordable. Two variants:
  - `deal-wheel`, a spin-to-win modal over an inert first results page. This is the new-popup edge case for the existing-Flow entry point.
  - `robot-check`, the hard challenge, with expected failure `user_intervention_required`. Its final state is: the challenge still standing, no `robot-check-error`, no results reached.
- **`plus-under-fifty`: every Plus pair rated 4.0 or higher and priced under $50, excluding sponsored items and accessories, each once, in results order.** The dataset `extract-plus-under-fifty` has 13 records. No recording can pass this workflow (open question 4).

### Tasks

`live-tasks.ts` exports `EVERYTHING_STORE_LIVE_TASKS`:

- `everything-store-plus-earbuds-under-50`
- `everything-store-first-page-plus-earbuds`
- `everything-store-first-page-plus-earbuds-deal-wheel`, with `variantArmedAfterBuild`
- `everything-store-kettle-to-cart`
- `everything-store-buy-kettle`, judged by the playback goal. Its correct end without a grant is a permission request at "Place your order".

`repair-tasks.ts` exports `EVERYTHING_STORE_REPAIR_TASKS`:

- `everything-store-repair-redesigned-search`: expect repair, `temporary_target_override`.
- `everything-store-refuse-robot-check`: expect refusal.

### Shared registrations

The shared-file additions total 9 lines; see open question 1.

| File | Lines added |
| --- | --- |
| `src/types.ts` | 1: `scenarioIds` |
| `src/registry.ts` | 2: import and Map entry |
| `src/scenarios/index.ts` | 1: exports both task lists |
| `src/scenarios/live-instructions.ts` | 2: import and spread |
| `src/scenarios/live-repair-tasks.ts` | 2: import and spread |
| `docs/architecture/testing-facility.md` | 1: a row under the larger-application fixtures table |

## Commands run and observed results

- **Typecheck:** `npx tsc -p tsconfig.json --noEmit` in `apps/scenario-lab` exited 0.
- **Manifest smoke:** `validateWebScenario` returned valid. The three datasets have 2, 16 and 13 records.
- **Scenario unit test:** `node --test dist/scenarios/everything-store/tests/scenario.test.js` passed 18 of 18. It covers:
  - the planted traps and the exact datasets;
  - that each filter-rail shortcut gives the wrong answer;
  - page composition (repeat, lazy split, ads, broken Next);
  - honeypot, 429 and soft-check behaviour;
  - robot solve and wrong guess;
  - cart and checkout state, and the goal's facts against the rendered confirmation.
- **Honest browser paths:** `node --test dist/.../tests/honest-paths.test.js` passed 5 of 5 in 24 s. The paths are: first page, five-page sweep with dedupe, cart change, purchase, and a robot check solved by reading the characters. Every declared final-state and goal fact held.
  - Before passing, two defects were found and fixed. The IntersectionObserver lazy loader missed a single large scroll (now a scroll-distance check). The test kit launched one browser per concurrent test, which hung the process (now one shared launch).
- **Naive browser paths:** `node --test dist/.../tests/naive-paths.test.js` passed 6 of 6 in 18 s. Each fails as designed:
  - filling the honeypot leads to the robot check, on every page;
  - a coordinate click under the chat panel adds nothing (the panel verifiably covers the button's centre);
  - a click before hydration adds nothing;
  - taking sponsored cards, or stopping at 12 results, gives the wrong table;
  - a fast burst of results pages gets a 429 with `Retry-After`, and waiting the stated time gets 200;
  - a robot-check guess leaves `robot-check-error`.
- **Catalog-wide tests:** `node --test dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/live-repair-tasks.test.js dist/tests/registry.test.js` passed 18 of 18.
- **Structure audit:** `node scripts/structure-audit.mjs` passed. After grouping `catalog/` and `pages/` into subdirectories, it reports no finding, not even a warning, in this scenario.
- **Live runs:** each ran as `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t041-everything-store pnpm lab:campaign <task>`. Every run set `FLUXIQ_TEST_ENV_FILES=none`; the user's store was not touched. The shared Core was `F:\fxwork\!FluxIQ` at 2d3e69a. Paths are under `F:\fxwork\t041-scn-everything-store\test-runs\`.

  | Task | Run | Verdict | Flow | Failure code (stage `provider_output_validation` unless noted) | Calls | Cost (USD) |
  | --- | --- | --- | --- | --- | --- | --- |
  | `everything-store-plus-earbuds-under-50` | `run-mubod6ms-b670fd7a` | failed | none | `lab.generation_http_400`, no diagnostic: Core's `flow_bootstrap.unclassified_failure` after 173 s | 1 | not recorded |
  | `product-catalog-first-page` (control) | `run-mubome83-7d6fb6cc` | failed | none | `flow_bootstrap.evidence_repeat_without_progress` | 8 | 0.0277 |
  | `everything-store-first-page-plus-earbuds` | `run-muboo4mv-a2f827d5` | failed | none | `flow_bootstrap.evidence_limit` | 15 | 0.0816 |
  | `everything-store-plus-earbuds-under-50` (rerun) | `run-mubos4jm-b93cd487` | failed | none | `flow_bootstrap.evidence_tool_failed` | 2 | 0.0073 |

  - **First hard-task run:** the failure screenshot shows the home page with the notifications modal still open. Core persisted no record of the build.
  - **Control run:** the extraction pagination the model proposed was rejected three times as `invalid_paginate`.
  - **First-page run:** it pressed controls (effects applied), entered the search, detected the result structure twice, then pressed a control that came back `target_unobserved`. The failure screenshot shows the unfiltered results, with the brand rail's "See more" expanded rather than the Plus filter applied.
  - **Hard-task rerun:** an inspection, then a direct same-origin navigation, then a tool failure. Its screenshot again shows the home page under the notifications modal.
  - **Campaign summaries:** `test-runs\campaigns\2026-09-21T20-04-18-608Z\`, `...20-12-15-593Z\` and `...20-16-35-539Z\` (`summary.md` in each).
  - **Oracle:** never reached in any run (`oracleVerdict: null`), because no Flow was built; `matchedRecords` does not apply. There were no playback-phase provider calls.
- **Full suite:** `pnpm --filter @fluxiq-web-extension/scenario-lab test` passed 360 of 360 in 33 s.
- **`pnpm check`** exited 0; "structure-audit: passed (81 warning(s), 122 baselined)". Every package's check reported Done.

**Fixture defects from the live runs:** none. Every page rendered and behaved as designed, and the screenshots confirm it.

**Product gaps:**

1. The **notifications modal** that makes the page inert defeated both hard-task builds before any action on the page.
2. An **unclassified Core exception** (`flow_bootstrap.unclassified_failure`, no diagnostic, nothing persisted) ended one build. Core should classify it.
3. Exploration **exhausts its evidence budget** (`evidence_limit`) before finishing a filter, scroll and read on a realistic results page. It picked a wrong rail control and a target it could not observe.
4. The **baseline** cannot build even `product-catalog-first-page` on this machine (`evidence_repeat_without_progress`, `invalid_paginate`).
5. **Recorded extraction** has no deduplication or rule-based row filter; see open question 4.

## Not verified

- **Recording lane.** Not run for any workflow: no extension recording, and no recorded Flow. The recording scripts are validated only structurally, by the manifest validator and the catalog tests. My honest browser paths mirror the scripts' steps but are not those scripts. So the recorded Flows that the repair tasks need are unproven, including whether the recording lane's console-error check tolerates Chrome's favicon 404, which every lab fixture triggers.
- **Other live tasks.** Not run live:
  - `everything-store-kettle-to-cart`;
  - `everything-store-buy-kettle`, so its permission-request outcome is unobserved;
  - the `deal-wheel` twin;
  - both repair tasks.
- **Cross-browser.** Firefox was not exercised; only Chromium, by the browser tests.
- **Timing at other paces.** Lab timings (nudges, hydration, rate limit) were checked only at the paces my tests use.

## Open questions or contradictions found

1. **"Exactly one appended line" is not achievable for three files.** `registry.ts`, `live-instructions.ts` and `live-repair-tasks.ts` each need an import plus an entry (2 lines each). `types.ts`, which is not on the brief's list, needs the id added to `scenarioIds`, or neither the `Map` nor `defineScenario` typechecks. The line in `scenarios/index.ts` is my reading of the brief: that barrel exports task catalogs, so it now also exports this scenario's two lists. All additions are appended at the end of their lists, so merges should be simple unions.
2. **`testing-facility.md` now has a stale count.** It still says "Three reproduce larger application pages" above the table I appended to. The count needs updating once the ten rows are merged.
3. **The repair lane forces one interactive test id.** It needs a recorded `testid:` target that a drift removes (`recordedTargetGone` in `tests/live-repair-tasks.test.ts`), so the header search button keeps `data-testid="nav-search-submit"` in baseline. This is the site's only interactive test id, against the "no test ids" direction. Passive oracle anchors must be test ids because the fact probe resolves nothing else.
4. **`plus-under-fifty` can never pass a recorded lane, and that is deliberate.** A recorded extract step cannot drop rows by rule or remove a repeat. The workflow exists for the created-Flow lane's dataset. If this scenario ever joins a bench corpus, that workflow's recorded-lane row should be excluded, with that reason.
5. **The browser tests live in the scenario's own `tests/` and launch Chromium under `pnpm test`,** adding about 45 s. The lab's convention puts browser specs in `e2e/`, which I do not own; they could be moved to `e2e/everything-store.spec.ts`.
6. **The Lab ran against my worktree's own `apps/scenario-lab/dist`** (`"instance": null` in its paths line), not an instance directory. I did not rebuild `dist/` while a live run was in progress.
