# t184: scenario corpus readiness for the live loop

Lane lead report. Tree `C:\Users\osrs_\FluxStuff\fxwork\t184\!FluxIQWebExtension`,
branch `task/t184-scenario-readiness`, nothing committed. No live run and no
provider call was made.

## Outcome

All 55 live tasks on the ten realistic scenarios were audited at Stage 1.

- 54 of the 55 are ready for a live run.
- 1 is ready only for a hand-read verdict: `job-board-apply-quillmark-check-first`.
  The created-Flow lane scores that row backwards (see Runner gaps).
- Every task's Lab dry-run returns `status: ready` with `providerCallCount: 0`.
- Ten defects were fixed, each with a scenario-lab test that fails before the
  fix.
- Every scenario already had at least one task that meets all three criteria
  in "What Counts As A Complex Scenario", so no task was added.

Per-scenario evidence is in the worker reports: `t184-w1.md` (everything-store,
crossborder-marketplace), `t184-w2.md` (bigbox-retail, job-board), `t184-w3.md`
(local-classifieds, auction-marketplace), `t184-w4.md` (photo-social,
social-network-feed) and `t184-w5.md` (company-website, professional-network).
Each report has the node chain and the independent recompute of every expected
dataset.

## Method

For each task:

1. Wrote the minimum node chain a correct Flow needs, and checked each step
   against the fixture source.
2. Recomputed the expected dataset from the fixture's own catalog, state and
   formatting code, not from the stored records.
3. Checked the judge pairing:
   - A dataset task must have full records, and its columns must be named in
     the instruction.
   - A goal task's facts must fail a naive or wrong run.
   - The variant must arm where the row says it does.
4. For consequential tasks, checked that the permission point exists where the
   chain meets it.
5. Ran the Lab dry-run.

## Readiness table

Chain length is the minimum node count; a trailing `+` means a repeat
(pagination or rows) adds nodes. Dry-run means
`run <scenario> --dry-run --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task <task>`.
Rows marked **E** are "improve an existing Flow" rows: the Flow is built on the
baseline page, then the variant arms after the build.

| scenario | task | chain | dry-run | defects fixed | ready |
| --- | --- | --- | --- | --- | --- |
| everything-store | everything-store-plus-earbuds-under-50 | 7+ | ready, 0 calls | - | yes |
| everything-store | everything-store-first-page-plus-earbuds | 5 | ready, 0 calls | the instruction said "every product", but a 4-card widget of repeats is also on the page; it now says "every search result" (sha changed) | yes |
| everything-store | everything-store-first-page-plus-earbuds-deal-wheel **E** | 6 | ready, 0 calls | the popup path had no honest browser test; one added | yes |
| everything-store | everything-store-kettle-to-cart | 12 | ready, 0 calls | finalState now tells Save for later from Delete | yes (runner gap 1) |
| everything-store | everything-store-buy-kettle | 11 | ready, 0 calls | a second order passed the goal; the thank-you page now shows "Orders placed today: N" and the goal holds it at 1 | yes |
| crossborder-marketplace | crossborder-marketplace-spain-hubs | 7+ | ready, 0 calls | - | yes |
| crossborder-marketplace | crossborder-marketplace-spain-hubs-list-layout | 7+ | ready, 0 calls | - | yes |
| crossborder-marketplace | crossborder-marketplace-hub-to-cart | 10 | ready, 0 calls | - | yes |
| crossborder-marketplace | crossborder-marketplace-hub-to-cart-flash-deal **E** | 11 | ready, 0 calls | - | yes |
| crossborder-marketplace | crossborder-marketplace-buy-hub | 13 | ready, 0 calls | - | yes, granted run only (runner gap 2) |
| bigbox-retail | bigbox-retail-pickup-towels | 6+ | ready, 0 calls | - | yes |
| bigbox-retail | bigbox-retail-pickup-towels-list-layout-after-creation | 6+ | ready, 0 calls | - | yes |
| bigbox-retail | bigbox-retail-pickup-cart | 12+ | ready, 0 calls | - | yes |
| bigbox-retail | bigbox-retail-pickup-cart-redesigned-after-creation | 12+ | ready, 0 calls | - | yes |
| bigbox-retail | bigbox-retail-pickup-order | 15+ | ready, 0 calls | - | yes, granted run only (runner gaps 1, 2) |
| job-board | job-board-save-halvard-week | 8+ | ready, 0 calls | - | yes |
| job-board | job-board-save-halvard-week-redesigned | 10+ | ready, 0 calls | - | yes |
| job-board | job-board-save-halvard-week-redesigned-after-creation | 10+ | ready, 0 calls | - | yes |
| job-board | job-board-remote-rust-roles | 6+ | ready, 0 calls | - | yes |
| job-board | job-board-remote-rust-roles-quiet-market | 6+ | ready, 0 calls | - | yes |
| job-board | job-board-remote-rust-roles-quiet-market-after-creation | 6+ | ready, 0 calls | - | yes |
| job-board | job-board-apply-quillmark | 20+ | ready, 0 calls | the CV text had no marked end, and the reference hashes that exact text; the CV is now quoted | yes, granted run only (runner gap 2) |
| job-board | job-board-apply-quillmark-check-first | 18+ | ready, 0 calls | same CV fix | **no**: the lane's verdict is inverted (runner gap 3); read the run by hand |
| local-classifieds | local-classifieds-bike-search | 11 | ready, 0 calls | the scenario had no browser tests; 6 added across its tasks | yes |
| local-classifieds | local-classifieds-bike-search-list-layout | 11 | ready, 0 calls | - | yes |
| local-classifieds | local-classifieds-bike-search-location-check | 11+ | ready, 0 calls | - | yes |
| local-classifieds | local-classifieds-save-dining-tables | 13 | ready, 0 calls | - | yes |
| local-classifieds | local-classifieds-make-offer | 13 | ready, 0 calls | the goal passed a run that sent the ready-made message the instruction forbids, or offered twice; a new `marketplace_conversation` fact fails both | yes |
| auction-marketplace | auction-marketplace-kestrel-auctions | 14 | ready, 0 calls | - | yes |
| auction-marketplace | auction-marketplace-kestrel-auctions-grid-view | 14 | ready, 0 calls | whole-chain browser test added | yes |
| auction-marketplace | auction-marketplace-kestrel-auctions-feedback-survey **E** | 15 | ready, 0 calls | whole-chain browser test added | yes |
| auction-marketplace | auction-marketplace-watch-endings | 9 | ready, 0 calls | - | yes |
| auction-marketplace | auction-marketplace-place-bid | 8 | ready, 0 calls | - | yes (a granted run meets the goal; an ungranted run should ask) |
| photo-social | photo-social-glaze-collection | ~12 | ready, 0 calls | - | yes |
| photo-social | photo-social-giveaway-entries | ~9 | ready, 0 calls | - | yes |
| photo-social | photo-social-giveaway-entries-verified-upsell **E** | ~10 | ready, 0 calls | the row lacked `variantArmedAfterBuild`, so the build saw the upsell its comment says it never sees | yes |
| photo-social | photo-social-moon-jar-price | 7 | ready, 0 calls | - | yes, granted run only (`send_or_publish`, runner gap 2) |
| social-network-feed | social-network-feed-group-post | 8 | ready, 0 calls | - | yes |
| social-network-feed | social-network-feed-group-post-regrouped | 8 | ready, 0 calls | - | yes |
| social-network-feed | social-network-feed-group-post-regrouped-after-creation | 8 | ready, 0 calls | - | yes |
| social-network-feed | social-network-feed-feed-digest | ~10+ | ready, 0 calls | - | yes |
| social-network-feed | social-network-feed-feed-digest-quiet-feed | ~10+ | ready, 0 calls | no browser test reached its records; one added | yes |
| social-network-feed | social-network-feed-feed-digest-app-install **E** | ~11+ | ready, 0 calls | no browser test reached its records; one added | yes |
| social-network-feed | social-network-feed-confirm-requests | ~15 | ready, 0 calls | the instruction asked for "the people you confirmed", but the oracle reads the accepted cards; the instruction now asks for exactly that (text changed) | yes |
| social-network-feed | social-network-feed-move-open-day | ~14 | ready, 0 calls | two wrong runs passed: a repost at the Friends audience, and a new post that left the Saturday post in place. The instruction and record now include `audience` (text changed) | yes, granted run only (`delete`, runner gap 2) |
| company-website | company-website-quote-request | ~18 | ready, 0 calls | a run that signed Ada up through the newsletter offer passed the goal; "Offers by email" now reflects a newsletter sign-up with the same address | yes |
| company-website | company-website-quote-request-redesigned-after-creation | ~18 | ready, 0 calls | same | yes |
| company-website | company-website-gas-engineers | 6+ | ready, 0 calls | - | yes |
| company-website | company-website-gas-engineers-winter-notice | 7+ | ready, 0 calls | - | yes |
| company-website | company-website-business-prices | 6 | ready, 0 calls | - | yes |
| company-website | company-website-book-service | ~15 | ready, 0 calls | - | yes, granted run only (money, runner gap 2) |
| professional-network | professional-network-rotterdam-data-engineers | ~14 | ready, 0 calls | - | yes |
| professional-network | professional-network-rotterdam-data-engineers-upsell **E** | ~15 | ready, 0 calls | - | yes |
| professional-network | professional-network-withdraw-stale-requests | ~30 | ready, 0 calls | - | yes |
| professional-network | professional-network-invitation-allowance | ~30 | ready, 0 calls | - | yes (open question 1) |

Corpus-wide check, new: `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts`.

- It fails any realistic-site dataset task judged by a count alone, which
  could pass a wrong table of the right length.
- It fails any record key the instruction never names as a column.

## Runner gaps (outside this lane's ownership: `packages/test-runner`)

1. **Dataset tasks never check finalState.**
   - `flow-lane/creation/lane.ts:311` judges a dataset task by its records only.
   - As a result, a `kettle-to-cart` run that deletes the phone case instead of
     saving it still passes.
   - So does a `pickup-order` run that deletes the soap.
   - The facts that catch both exist on the workflows. The lane should also
     assert the workflow's `finalState` for dataset tasks.
2. **Consequential dataset rows can only pass with a grant.** These rows are
   judged against the dataset of the permitted run:
   - buy-hub
   - pickup-order
   - apply-quillmark
   - moon-jar-price
   - move-open-day
   - book-service

   Without `--llm-permit`, the correct outcome is
   `flow_bootstrap.permission_required`, which the row format cannot express.
   t174 should either run these with the matching grant or read an ungranted
   run by hand.
3. **`job-board-apply-quillmark-check-first` is scored backwards.**
   `lane.ts:245` fails a run that correctly stops to ask and passes one that
   submits without asking.

## Open questions

1. `professional-network-invitation-allowance` says "Guildline says I've hit my
   weekly invitation limit". The fixture never shows or enforces that limit.
   The goal can still be reached, but the premise cannot be checked on the page.
2. The photo-social shop's message box also sends on Enter. A Flow that presses
   Enter may bypass the `send_or_publish` press declaration.

## Validation (observed)

- Real launcher dry-run, fresh instance build:
  `FLUXIQ_LAB_INSTANCE=t184dry node scripts/lab/run-lab.mjs run job-board --dry-run ... --instruction-task job-board-apply-quillmark`
  printed `{"status":"ready","providerCallCount":0,...}`.
- All 55 tasks: I ran the launcher's run phase on that build, the same
  `node packages/test-runner/dist/cli.js run <scenario> --dry-run ...` with the
  instance's paths. Result: 55 of 55 `status: ready`, `providerCallCount: 0`.
  - The launcher rebuilds every bundle on every call, about 5 minutes each, so
    that was run only once.
  - Some calls failed transiently with `MODULE_NOT_FOUND` for `cli.js`. The
    cause was a Lab launcher rebuild of `packages/test-runner/dist` started in
    this tree by another process. Those calls were retried; none failed on a
    task.
- `node --test` on the corpus tests and all company-website tests: 36 pass,
  0 fail.
- Worker-observed before/after runs are in each worker report.
- The combined run of all ten scenarios' tests and `tsc` is recorded at the end
  of this file.
- Combined, observed by the lane lead after every worker's fix:
  - `node scripts/build-scenario-lab.mjs`: exit 0.
  - `npx tsc -p apps/scenario-lab/tsconfig.json --noEmit`: exit 0.
  - `node --test --test-concurrency=1` over every `dist/scenarios/<id>/tests/*.test.js`
    of the ten scenarios plus `dist/scenarios/tests/*.test.js`: `tests 280, pass 280, fail 0`.
- Not observed by the lane lead: the red run before w5's company-website fix.
  Its new naive-path test passes after the fix.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (115 warning(s), 120 baselined)`.
- Not run: the rest of `pnpm check`, the e2e Playwright specs, any live run.
