# w2x-scenario-auction-marketplace — report

Worker for brief `w2x-realistic-scenarios`, scenario `auction-marketplace` (t040),
worktree `F:\fxwork\t040-scn-auction-marketplace`, branch
`task/t040-scn-auction-marketplace`. All changes are uncommitted.

## Outcome

Done, with one deviation from the brief's registration rule (see Open questions).
The site, its tests and `pnpm check` pass. One live DeepSeek `create-flow` run of
the extraction task was made on `persistent-isolated` with
`FLUXIQ_TEST_ENV_FILES=none`. FluxIQ failed it before building a Flow
(`flow_bootstrap.evidence_tool_failed`). That is a product gap, not a fixture
defect: the page served correctly and a person can finish the task.

## What changed and why

**New scenario `apps/scenario-lab/src/scenarios/auction-marketplace/`** (45 files,
all under the structure budgets; the audit reports no findings and no warnings for
it). It is **Hammerline**, an invented online auction marketplace modelled on eBay.
It covers film cameras around one invented camera, the Kestrel 35. The site has a
home page, keyword search with a filter rail, sort, pages, page size, listing pages
(bid, Buy it now, watch, save seller), a watchlist, seller shops (new tab), bid
histories (new tab), a cross-origin description iframe and a bot check.

- `catalog/`: 58 listings from 13 sellers. The data, money in GBP, EUR (Dutch/German
  style, `EUR 1.165,00`) and USD with the site's pound estimate, a fixed reference
  clock (Mon 21 Sep 2026 14:00 BST), bid increments with proxy bidding against a
  hidden rival maximum, and the search engine (broad prefix match, `-word`
  exclusion, facets, sorts, pages that overlap by two).
- `pages/`: the markup. `client/`: the browser behaviour. `state.ts`: mutations and
  rate limits. `route.ts`: every subpath. `manifest.ts`: the oracles.
  `live-tasks.ts` and `repair-tasks.ts`: the tasks. `tests/`: the tests.

**How hard it is (the user's direction was that it be difficult on purpose):**

- **Controls:** no test ids on anything a run clicks, with one exception. The listing
  page's watch button keeps a shipped `x-watch-cta` hook, which the repair row needs.
  The oracle lists are the only other `data-testid`s, and a test pins that inventory.
- **Class names and ids:** class names are build hashes derived from the lab seed.
  Card ids change on every results page served.
- **Hydration:** cards arrive as skeletons and fill in 600 ms after load. The list
  stays `aria-busy` until then.
- **Overlays:**
  - A cookie banner is fixed across the bottom of the window; its Reject all is a
    div-button.
  - An app promotion opens 2.5 s after load on the home and results pages. Its modal
    scrim covers even the cookie banner.
  - The chat greeting opens 3.5 s after load, exactly over the bid drawer's Confirm
    button (checked: `elementFromPoint` at Confirm's centre is `hal-greeting`).
- **Anti-bot, all passable by honest behaviour:**
  - The 4th results page of a session is sent to a "checking your browser" page. It
    continues after 5 s, or at once on Continue.
  - The watch limiter refuses a 4th toggle within 5 s and says how long to wait.
  - Bids have a 10 s cooldown after a placed bid.
  - An off-screen "Bid reference" honeypot restricts the account when filled.
- **UI bugs:**
  - The sort button ignores its first press.
  - The Next arrow is stuck on page 2; the numbered links work.
  - Condition filter links drop the buying-format parameter.
  - The results header counts 2 ended auctions (52 stated, 50 real). The watch badge
    goes stale until the page reloads.
  - Enter in the price boxes submits nothing (two text inputs, no submit button); the
    arrow is a div.
- **Distractors:**
  - Advertisements sit in the results, with the "Sponsored" label obfuscated by hidden
    letters. One advertises a genuine target auction, so it appears twice.
  - Lookalike models (35S, "35-S", "35 S", Mk II, "MkII", "Mark 2", 350).
  - The same camera for parts, at fixed price, or over the price limit.
  - A pair, a job lot, and a lens and a case whose sellers filled in the camera's model.
  - A genuine Kestrel 35 typed as "Film camera", and two different auctions with one
    title.
  - A home-page hero offering harrow_cameras' 35S, the wrong auction, first.
- **Other realism:** shadow-DOM watch hearts (div, title only), a variation picker
  (div listbox), lazy images and lazy similar items, new-tab links, and several more
  div-buttons.

**Workflows and oracles** (every oracle is exact; hand-verified; pinned as literals in
`tests/catalog.test.ts`):

- **Primary: bid.** A consequential bid of £85 on harrow_cameras' Kestrel 35.
  - Recording: search, open the listing, bid, close the greeting, confirm.
  - Playback goal: the header lists read `…film tested · Your max bid £85.00 ·
    Highest bidder at £84.00`, with the watchlist, purchases and saved sellers
    unchanged.
  - With no grant, the right outcome is a permission request and no bid.
- **`watch-endings`: state change.** Watch the three qualifying auctions not yet
  watched and leave the fourth, already watched, alone (pressing it again removes
  it). Then read the watchlist back (5 records).
  - Final state: the exact watch list.
  - Variant `watch-redesign` is the repair entry point. `x-watch-cta` is gone, a heart
    labelled "Save item" sits on the photo, and "Save this seller" stands where the
    watch button was.
- **`kestrel-auctions`: extraction.** Every original Kestrel 35 auction, not for
  parts, under £150 at the pound estimate, listed once, soonest first, with columns
  title, price, bids and postage exactly as the card shows them: 10 records.
  - The recorded path uses the filters carefully: both Pre-owned and Seller
    refurbished, Auction chosen after Condition, Model plus both camera Types, a
    maximum of 150, and the bot check passed.
  - Variants `grid-view` (gallery layout; a column-reverse DOM order) and
    `feedback-survey` (a new modal on the second results page) are the existing-Flow
    entry point.

**Tasks.**

- `live-tasks.ts`:
  - `auction-marketplace-kestrel-auctions`
  - `…-kestrel-auctions-grid-view` and `…-kestrel-auctions-feedback-survey`, both with
    `variantArmedAfterBuild`
  - `auction-marketplace-watch-endings`, judged on the watchlist read back
  - `auction-marketplace-place-bid`, judged on the playback goal
- `repair-tasks.ts`: `auction-marketplace-repair-watch-redesign`
  (`temporary_target_override`).

**Shared files, appended lines only:**

- `apps/scenario-lab/src/types.ts`: +1 line (the id in `scenarioIds`).
- `src/registry.ts`: +2 (import and map entry).
- `src/scenarios/live-instructions.ts`: +2 (import and spread).
- `src/scenarios/live-repair-tasks.ts`: +2 (import and spread).
- `docs/architecture/testing-facility.md`: +1 table row, after `member-directory`.
- `src/scenarios/index.ts`: not touched, because nothing needed it.

## Commands run and observed results

1. `npx tsc -p tsconfig.json --noEmit` (scenario-lab): exit 0, no output. Re-run after the last edit: clean.
2. `node --test dist/scenarios/auction-marketplace/tests/browser.test.js` (real
   Chromium, `channel: "chromium"`): **13/13 pass** after one fix to a test matcher;
   the first run had 12/13. Duration 73 s.
   - **Honest paths:**
     - The manifest's bid, watch and extraction recording scripts, run step by step,
       meet every final-state fact and the playback goal. The recorded extraction
       returns exactly the 10 records and passes the bot check.
     - A person reading the keyword results by the numbered page links (50 unique,
       4 repeats), judging titles, condition, format and the pound estimate, reaches
       the same 10.
   - **Naive paths, each missing the oracle:**
     - The Next arrow gets pages `["1","2","2"]`. Ads are taken. Parsing `EUR 1.165,00`
       as 1.165 lets the £1,011 set in; `US $189.00` and `EUR 169,00` read as numbers
       drop real auctions.
     - Bidding on the hero 35S gets "Enter £90.00 or more." and no bid.
     - Filling the honeypot gets the bid refused and the account restricted, even for
       an honest retry.
     - A mouse click at Confirm's coordinates under the greeting opens the chat and
       places no bid.
     - Pressing every qualifying heart takes m3 off the watchlist, and the 4th press
       gets "Slow down!".
   - **Variants:**
     - `grid-view`: list-layout selectors resolve nothing, and a grid read gives the
       same 10.
     - `feedback-survey`: the survey intercepts clicks until declined.
     - `watch-redesign`: "Save this seller" saves `tinhorn.film`; "Save item" watches.
   - **Seeds:** class names and ids differ between seeds; the text does not.
3. `node --test` of catalog, state and scenario tests: 25/25 pass after I fixed two of
   my own assertions (the first `<ul>` on the page is the header flyout; the
   pagination sits after the hydration script).
4. Shared `registry.test`, `live-instructions.test`, `live-repair-tasks.test` and
   `state-store.test`: 21/21 pass.
5. **Live run** (`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated
   FLUXIQ_TEST_PERSISTENT_WORKSPACE=t040-auction pnpm lab:campaign
   auction-marketplace-kestrel-auctions`):
   - Run `run-mubngnqg-63897616`, bundle
     `F:\fxwork\t040-scn-auction-marketplace\test-runs\run-mubngnqg-63897616`.
   - Campaign summary:
     `test-runs\campaigns\2026-09-21T19-37-39-295Z\summary.md`.
   - Verdict `failed`, `runtime.behavior`, `flowCreated: false`, `oracleVerdict:
     null`, so the judgement was not measured (0 of 10 records).
   - Provider: `build.providerCalls` 1 and `observed.calls` 1 (all build, nothing at
     playback), 8,220 tokens, $0.0037.
   - `build.failure`: `flow_bootstrap.evidence_tool_failed`, stage
     `provider_output_validation`. `evidenceLoop`: 1 decision, 1 tool call
     (`web.inspect_current_page` → `web.inspect.succeeded`, 7,040 bytes).
   - The failure screenshot shows the home page rendered as designed, with the
     promotion modal, cookie banner and chat greeting up.
6. `pnpm --filter @fluxiq-web-extension/scenario-lab test`: exit 0, **369/369 pass**.
7. `pnpm check`: **exit 0**.
   - `structure-audit: passed (81 warning(s), 122 baselined)`, none of them in this
     scenario.
   - lab and task tests pass; `pnpm -r check` passes.

## Not verified

- **Recording lane and recorded-Flow lane never run.** No `pnpm lab run
  auction-marketplace` (recording) or `--flow` run was made. The recording scripts are
  proven only by my Playwright step runner, which mirrors the Lab's target grammar and
  reference reader. It does not use the extension's own extraction or its scripted
  navigation.
  - So `recordingEvents` carry no counts.
  - The repair row, the variant rows and the bid and watch tasks have had no live
    run.
- **Which tool call failed in the live build.** Core's trace keeps only succeeded
  steps, and the project store keeps no record of the failed bootstrap. The
  diagnosis below is inference.
- **Favicon console error.** Chromium logs a console error for the lab-wide
  `/favicon.ico` 404 on every page. This comes from the server, not this scenario, but
  it is not `allowedConsoleErrors: []`-clean if a lane counts it.

## Open questions or contradictions found

1. **Product gap (live run): one failed exploration action ends the whole build.**
   `evidence-loop.ts:446-455` returns `llm_evidence_loop.tool_failed` when
   `executeTool` throws or returns an unparseable result. The failure is not handed
   back to the model as an observation. The model's first action after inspecting the
   page failed and FluxIQ stopped, after 1 call.
   - The likeliest cause is the delayed promotion. It opens 2.5 s after load and its
     scrim covers everything, including the cookie banner. The inspected page was
     probably stale by the time the action ran, and the action hit the scrim. That is
     exactly what a person meets and handles by closing the modal.
   - A second gap: the failing tool call is not in `evidenceLoop.steps`, so the
     evidence cannot say what failed.
   - Fixture defects found: none.
2. **The brief's "exactly one appended line" cannot hold for an ES-module
   registration.** Each of `registry.ts`, `live-instructions.ts` and
   `live-repair-tasks.ts` needs an import and an entry: 2 appended lines each, one at
   the end of the import block and one at the end of the list. Top-level `await
   import()` would have made it one line; I judged that worse.
   - **`types.ts` was touched though the brief did not list it.** The registry test
     requires the id in `scenarioIds`, in registry order, and `ScenarioDefinition.id`
     is typed by it. It is one appended line.
   - When merging, keep `scenarioIds` and the registry map in the same order.
3. **Line limit to watch during the union.** `live-instructions.ts` is at 757 lines
   against the 800-line hard limit. Ten workers adding 2 lines each keeps it under the
   limit, but only just.
4. **The consequential bid task is judged on the playback goal, which only a granted
   run can meet.** An ungranted run's correct result (a permission request and no bid)
   is not itself a pass in the current catalog shape. This is the same as
   `order-operations-partial-refund`.
   - The watch task is judged on the watchlist read back, not by final-state facts,
     because a scenario can have only one playback goal. The `watch-endings` workflow
     still declares final-state facts for the recorded lanes.
