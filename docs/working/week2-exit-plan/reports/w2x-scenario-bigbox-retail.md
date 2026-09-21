# w2x-scenario-bigbox-retail — report

Worker for `bigbox-retail` (brief `w2x-realistic-scenarios`), task t039, worktree
`F:\fxwork\t039-scn-bigbox-retail` (branch `task/t039-scn-bigbox-retail`). Changes are
uncommitted. Nothing outside the worktree was touched except this report.

## Outcome

Done. ValueRidge is a fictional big-box retailer, built deliberately difficult and
with no targeting affordances beyond the one test id the repair harness requires.
It has three workflows, five live tasks, one repair task, and two variants.

- **Honest paths pass every oracle, in a real browser.** An honest scripted path
  for every workflow and variant passes all of its oracles in headless Chromium,
  replayed with the Lab's own target and step semantics.
- **Naive paths fail.** Seven naive paths fail as designed.
- **Checks.** The scenario-lab suite passes 358 of 358, and `pnpm check` exits 0.
- **Live run.** The one live `create-flow` run of the extraction task failed
  before any Flow was built. This is a product gap, not a fixture defect.

## What changed and why

### New: `apps/scenario-lab/src/scenarios/bigbox-retail/`

84 files, about 3,370 lines, split to stay inside the audit budgets. The
directories are `catalog/`, `search/`, `cart/`, `state/`, `theme/`, `shell/`,
`listing/`, `pages/`, `client/`, `manifest/` and `tests/`, plus `scenario.ts`,
`route.ts`, `types.ts`, `live-tasks.ts`, `repair-tasks.ts` and `index.ts`.

**What the site is.** A storefront, search with a filter sidebar, sort and
numbered pagination, product pages, a cart, and a guest pickup checkout.

- **Catalog.** 32 "paper towels" listings plus 5 pantry items. The listings mix:
  - the store brand and four invented national brands;
  - marketplace resellers, one reselling the store brand as a two-pack;
  - holders and a dispenser that match the words but are not paper towels;
  - items the home store has only tomorrow, or only by truck.
- **Stores.** Four stores; two towns each have a Supercenter and a Neighborhood
  Market.
- **Fixed clock.** All dates come from a fixed moment, Mon Sep 21 10:05, so
  nothing reads the wall clock.
- **Seed.** The seed reaches only the generated class names and element ids.

**The mess.** All of the following are verified in a browser unless marked
otherwise.

- **Consent dialog.** It sits over a scrim that takes every click until it is
  answered.
- **Delayed email offer.** It opens 2.2 s after consent. Its close control is a
  bare `×` in a div, and its form has a hidden honeypot field.
- **Support widget in a shadow root.**
  - On product pages a proactive card opens 3 s after load, over the pinned
    Add to cart.
  - On the cart page the launcher lies across the centre of Continue to checkout.
- **Store picker in a second shadow root.** It offers four identical "Set as my
  store" buttons.
- **Generated class names and ids.** They change per seed and per build; the
  redesign variant renames every class on the site.
- **Ads.** Three per page, labelled only "Sponsored". They ignore every filter,
  and most repeat a listing, sometimes on the same page.
- **Prices drawn in pieces.** The visible "$8 97" has raised cents; the whole
  "$8.97" exists only in visually hidden text. Rollbacks add "Now" and a struck
  price. Unit prices print like "1.2 ¢/sheet".
- **Bot check.** The third results document is replaced by "Robot or human?". It
  clears on a 2 s press-and-hold or by waiting out an 8 s countdown; clicks do
  not clear it.
- **Real UI bugs.**
  - The Next arrow on a filtered or sorted result set drops the filters and the
    sort (page numbers keep them).
  - The first press of any Add or Add to cart button after a load only "wakes"
    the page.
  - The header's cart count badge goes stale until the next load.
  - The pickup-time request is refused once with 429 and `Retry-After: 2`. Its
    spinner never clears on its own; a Retry link appears after the Retry-After.
- **Delayed rendering.** The buy box shows "Checking availability…" for 700 ms,
  and the cart shows "Loading your cart…" for 500 ms.
- **Poor-accessibility controls.** Size swatches, fulfilment choices and the
  quantity stepper are divs and spans.
- **Sign-in wall.** At checkout; the way through is a small "Continue without an
  account" link.
- **Honeypot in checkout.** An off-screen `company_website` field; filling it
  gets "Error VR-417" and no order.
- **Cross-origin card iframe.** Served from the lab's second origin; it posts a
  token, never the card number.
- **New tabs.** Seller pages and the Weekly Ad open in new tabs.
- **Other difficulty.** Lazy images, a hero carousel that rotates every 4 s, and
  duplicate labels ("+ Add", "Search", "Set as my store").

**Workflows.** Every oracle is literal text in
`manifest/expected-values.ts`, and `tests/scenario.test.ts` re-derives each one
independently from the catalog and state machine.

1. **Primary (state change, playback goal).**
   - The job: switch store to Millbrook Crossing Supercenter, then add two
     "12 Double Rolls" packs of the store-brand Select-A-Size towels and one
     "250 Count" napkins, both for pickup, keeping the dish soap already in the
     cart.
   - **Why order matters:** the 12-roll pack cannot be picked up at either
     Carden Falls store. Adding it before switching stores adds it for delivery,
     and the oracle fails.
   - **Judged by:** the mini cart's per-line and summary facts, `4 items ·
     Subtotal $43.39`.
   - **Variant `redesigned-buy-box`** (the repair entry point): Add to cart lost
     its test id and moved into the buy box, and "Buy now" (skips the cart,
     checks one item out alone) took its place in the pinned bar.
2. **`pickup-towels` (extraction, `expected.extracted`).**
   - The answer is nine records (name, price, unitPrice, rating): paper towels
     sold by ValueRidge, pickup today at the home store, rated 4.5 or better, ads
     excluded, in best-match order.
   - **Why reasoning is needed:** the filters cannot express the criteria.
     "Today" also counts delivery, and the rating filter stops at "4 & up", so 4
     of the 13 fully filtered listings are wrong. The filtered set still spans
     two pages.
   - **Variant `list-layout`** (the existing-Flow edge case): results render as
     list rows with plain prices, and ads carry an "Ad" pill instead of
     "Sponsored".
3. **`pickup-order` (consequential).**
   - The job: guest pickup order of one 6-roll pack, pay at pickup, earliest
     open slot (2pm–3pm; 11am–2pm are full), with the soap saved for later
     rather than bought or deleted.
   - **Judged by:** one confirmation record, order `2000958-40713`, total
     `$9.62`, pickup `Mon, Sep 21, 2pm–3pm`.

**Live tasks (`live-tasks.ts`).**

- `bigbox-retail-pickup-towels`
- `bigbox-retail-pickup-towels-list-layout-after-creation` (variant armed after
  the build)
- `bigbox-retail-pickup-cart`
- `bigbox-retail-pickup-cart-redesigned-after-creation`
- `bigbox-retail-pickup-order`

**Repair task (`repair-tasks.ts`).** `bigbox-retail-repair-redesigned-buy-box`
(expect `repair`, patch kind `temporary_target_override`).

**Tests.**

- `tests/scenario.test.ts`: 15 pure tests of the state machine and the oracles.
- `tests/browser-paths.test.ts` with its support module `tests/browser-harness.ts`:
  - The harness starts the lab in-process and allows loopback requests only.
  - It replays manifest scripts with the Lab's target and step semantics.
  - 5 honest-path tests and 7 naive-path tests.
- The browser test is the first `src` test to drive Chromium. It adds about 34 s,
  run concurrently inside `pnpm test`.

### Shared files (all appended; 8 lines in total)

| File | Lines added | What |
| --- | --- | --- |
| `apps/scenario-lab/src/types.ts` | 1 | `"bigbox-retail"` in `scenarioIds` |
| `apps/scenario-lab/src/registry.ts` | 2 | Import and map entry |
| `apps/scenario-lab/src/scenarios/live-instructions.ts` | 2 | Import, and `...BIGBOX_RETAIL_LIVE_TASKS` spread as the last `TASKS` entry |
| `apps/scenario-lab/src/scenarios/live-repair-tasks.ts` | 2 | Import on line 1, and the spread as the last `TASKS` entry |
| `docs/architecture/testing-facility.md` | 1 | Row after `member-directory` in the larger-application-pages table |

Two deviations from the brief:

- **Two lines per catalog, not one.** "Exactly one appended line" is not possible
  for the two catalogs: each exports `Object.freeze(TASKS.map(...))` at module
  load, so a task list needs an import plus a spread inside the array.
- **`types.ts` needed, `scenarios/index.ts` not.** `types.ts` is not in the
  brief's list but is required, because `ScenarioId` is derived from
  `scenarioIds`. `scenarios/index.ts` needed nothing, so it is untouched.

## Commands run and observed results

- `npx tsc -p apps/scenario-lab/tsconfig.json --noEmit` → exit 0 (final run).
- HTTP smoke of every route (scratch script) → all 200 except as designed:
  - `checkout/slots` answered 429 with `retry-after: 2`, then 200.
  - The bot check appeared on the third results load.
  - `nope` returned 404.
  - Order `2000958-40713` confirmed at `$9.62`.
- Inline-script syntax check over 34 rendered documents → first run `bad 4`: the
  payment frame's regexes had lost their backslashes, a defect I introduced and
  then fixed. Final run `documents 34 bad 0`.
- `node --test dist/scenarios/bigbox-retail/tests/browser-paths.test.js` →
  `# pass 12 # fail 0`, 34 s. Earlier runs failed on three defects I fixed:
  - an apostrophe escape broke the bot-check page's script;
  - the extraction selectors' `\.` and `\$` were unescaped by Playwright's CSS
    string parser, so the manifest now uses `[.]` and `[$]`;
  - three naive tests never opened the start page.
- `node --test dist/scenarios/bigbox-retail/tests/scenario.test.js` →
  `# pass 15 # fail 0` (two of my test expectations corrected: the retailer count
  is 23, and the class scan now ignores inline scripts).
- **The live run**, with the environment
  `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t039-bigbox`:
  - Command: `pnpm lab:campaign bigbox-retail-pickup-towels`. The only live run
    I made; `FLUXIQ_TEST_ENV_FILES=none` was set, so it never touched the user's
    panel or store.
  - Run `run-mubnsyet-eb8063a7`, at
    `F:\fxwork\t039-scn-bigbox-retail\test-runs\run-mubnsyet-eb8063a7`.
  - Verdict `failed`, `flowCreated: false`, oracle not reached, judgement not
    measured.
  - Build failure `flow_bootstrap.evidence_tool_failed` (stage
    `provider_output_validation`, HTTP 400).
  - `build.providerCalls` 2 equals `observed.calls` 2; 18,822 tokens,
    $0.0084.
  - Evidence trace: `web.inspect_current_page` → `web.inspect.succeeded`, then
    `web.press_control` (applied) → `web.action.succeeded`, then the loop failed.
  - Campaign summary:
    `test-runs\campaigns\2026-09-21T19-48-00-927Z\summary.md`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` → `# tests 358 # pass 358 # fail 0`.
- `pnpm check` → exit 0:
  - structure:test 182/182, lab:test 74/74, task:test 113/113;
  - `structure-audit: passed (81 warning(s), 122 baselined)`, none in
    `bigbox-retail/`;
  - every package's `check` Done.

**Live-run classification: a product gap, not a fixture defect.** The failure
screenshot and a pixel check show the site in the designed state: consent
accepted, the email offer open over its scrim, which dims the page to grey
115/115/115. The source path:

1. The extension refuses a covered target
   (`apps/extension/src/content/action-runtime/actionability.ts:57`, "covered").
2. The domain turns any failed action into a throw
   (`domain/src/runtime/llm-evidence/capture.ts:128`, "web evidence interaction
   failed"). `tool-rejection.ts` has no recoverable "covered" code.
3. Core converts the throw into `llm_evidence_loop.tool_failed`
   (`packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts:450`).
   That ends the whole build instead of returning the covering dialog to the
   model as evidence.

The offer opens 2.2 s after the consent press, while the model's next decision
takes seconds. The action it chose from the pre-offer snapshot therefore meets
the offer. A person closes the offer and carries on.

Caveat: the snapshot's `evidenceLoop.steps` lists only completed steps, so the
failing third tool's id is not recorded. That missing observability is a second,
smaller gap.

## Not verified

- **The other live tasks.** No live run of the cart task, the order task, the
  two after-creation tasks or the repair task. The brief asked for the
  extraction task only.
- **The Lab's recording lane.** It was not run on these scripts. My harness
  mirrors the step runner's target parsing and step semantics, but not the
  extension recorder. Recording inside shadow roots, and the two-press Add to
  cart, are untested there.
- **Firefox.** Not exercised.
- **Viewports other than 1280×720.** Overlay geometry is anchored bottom-right
  and should hold at other sizes, but I checked only 1280×720.
- **Brief features not built.** Two items from the realism list are absent (the
  brief asks for six or more, and this site has well over that):
  - a login wall after scrolling (the sign-in wall is at checkout instead);
  - true infinite scroll (lazy images and "See more reviews" stand in).

## Open questions or contradictions found

- **The Lab cannot score a permission request.** `pickup-order` is
  consequential. Without a grant the right outcome is a permission request, but
  the created-Flow lane treats a build that ends in `permission_required` as
  "FluxIQ did not build a Flow", and `LiveInstructionTask` has no way to expect a
  request. Until the Lab can score one (L3 / t036?), the lane measures only the
  granted outcome, the confirmation record, so a correct stop-and-ask fails the
  row.
- **Product gap: a covered target kills the whole build.** Above: during
  exploration, a target covered by a late overlay should come back to the model
  as a recoverable rejection, with fresh evidence showing the overlay.
- **Two brief items did not fit the code.** The "exactly one appended line" rule
  cannot hold for the frozen catalogs, and `types.ts` must change. The
  supervisor's union merges will see two-line unions in three files.
- **`live-instructions.ts` is near its line limit.** It is now 757 lines (hard
  limit 800). Ten sites adding two lines each reach about 775; any site that
  inlines tasks there would breach it.
- **Known lab noise.** The lab server answers `/favicon.ico` with a 404 for every
  scenario, and Chrome logs it once per browser context. The `modal-flows` spec
  already notes it. My harness ignores that one console error, identified by its
  URL; no Lab lane change was made.
- **Tooling note.** The Bash tool halves doubled backslashes inside heredocs.
  That caused the escaping defects above; files containing regex escapes were
  corrected with the Edit tool.
