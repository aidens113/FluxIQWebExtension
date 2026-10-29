# t791 proof: crossborder cart page (report)

## Outcome
Done. No Core defect blocked the proof. New spec and updated job spec pass; the whole site-reset suite passes (30 of 30).

## What changed and why
- New `apps/extension/e2e/site-reset/tests/judged-change-cart-page.spec.ts` with two tests on crossborder-marketplace:
  1. Add-to-cart judged by the cart page. Item `1005008401187` (one colour, one warehouse, default choice complete) opened in the build's own tab; `/cart` read in that tab while empty; the read issued `destination-1` with `page: true` (count 4); Add to cart pressed naming it with `create_new`, answer carries no `resetDestinationUnreached`; submitted; trial ran (`yes`, no `candidate.trial_step_unwitnessed`, no retired codes); packet has a `list` witness at `/cart` whose lines moved "Cart (1)" to "Cart (2)", act outcome `changed`, proof `shown`, and no `unwitnessed` key. Note: the exploration press added the first unit, so the trial's change is quantity 1 to 2 (as the site shows it), not empty to one.
  2. Cross-tab: home page read in its tab (ref issued), a card opens the item in a new tab, Add to cart pressed naming that ref gets `resetDestinationUnreached`.
- `job-unexplored-step.spec.ts`: header and test name updated; the unexplored-step trial now asserts it runs (`yes`, trial run id, save step in feedback) and the first judge packet carries `siteChange.unwitnessed` (one step labelled "save the job", `said` string). Removed the "nothing ran" assertions and the act-1 assertion; part 3 now targets `trial.explored` and the second packet's `leftFromEarlier`.
- No helper changed.

## Commands run and observed results
Browser: Chromium (headed, `extensionSession` fixture, channel chromium). Build target: `e2e-chromium` (extension build output verified 22 files; chrome, firefox also built).
- Core libs were stale, so I ran `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the t791 Core tree (build output only, no source edit): done.
- `pnpm test:e2e e2e/site-reset/tests/judged-change-cart-page.spec.ts` (builds extension once): first run failed on my own assertion (`witness.change === "changed"`; the packet's `change` is an object of counts and the act outcome carries `changed`). Corrected to the real shape.
- `playwright test ... judged-change-cart-page.spec.ts` : 2 passed.
- Both specs together with `job-unexplored-step.spec.ts`: 3 passed (1.4m).
- Whole suite `playwright test -c e2e/playwright.config.ts e2e/site-reset`: 30 passed, 0 failed, 0 skipped (10.8m, 4 workers). All under the heavy lock.

## Not verified
- No Lab or live run; scripted provider only. The judge is scripted (bare yes), so the packet content is verified, its interpretation by a real judge is not.
- No tsc over the e2e tree (the specs compiled and ran under Playwright's transform only).
- The "values changed" digest false-positive risk from fix 1 is untested here.

## Open questions or contradictions found
- In the job spec the trial's own save runs before the explored press, so the explored heart press now acts on an already saved job; the spec still passes (answer ok, succeeded), but the explored press may toggle state. The spec does not assert the final My jobs state.
- Pre-existing failures: none seen. "Client gateway trace close failed" lines appear in the suite log, unrelated to results.
