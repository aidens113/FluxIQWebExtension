# t730-d2-bigbox-shadow-mode

## Outcome

Done. bigbox-retail has a new mode, `partner-widgets`, armed through the existing `set-mode`. In this mode the product page's buy box shows three partner embeds of the kind real retailers ship: a pay-over-time offer, a delivery estimate and review highlights. Every other page, and the default site, are byte-identical to the baseline; a unit test asserts this.

All three constructed rows in `shadow-root-in-place.spec.ts` now press these embeds. All their injection code is deleted. No row kept an injection.

| row | before | now | headed result |
| --- | --- | --- | --- |
| inserted component, its text already inside its root | `page.evaluate` built a `[data-testid=show-stores]` link that inserted a `div` with an open root into `main` 150 ms after the press | the `partner-widgets` delivery link `a[href=".../help/delivery-estimate"]` creates `<parcelwise-estimate>` 150 ms after the press (its open root and text are attached in its constructor) and appends it after the link | pass (3 of 3 runs) |
| root attached to an element already in place, with no mutation to observe | `page.evaluate` built a link and an empty `div`, then called `attachShadow` on the div 150 ms after the press | `<reviewloom-highlights>` is in the page, undefined, from load. Its link `a[href=".../help/review-highlights"]` calls `customElements.define` 150 ms later, and the upgrade attaches the open root to the element in place | pass (3 of 3) |
| panel opened inside a closed root is not seen, so the click still fails with `output_not_observed` | `page.evaluate` built a closed-root `div` with a hidden panel, and a `#closed` link that un-hid the panel | `<quartera-offer>` is defined at load and attaches a closed root. The link beside it, `a[href="#pay-over-time"]`, calls the element's `toggleDetails()` | pass (3 of 3) |
| Change store flyout (unchanged) | bigbox baseline product page | unchanged | pass (3 of 3) |

## What changed and why

### Scenario (`apps/scenario-lab/src/scenarios/bigbox-retail/`)

- **`types.ts`**: added `"partner-widgets"` to `bigboxModes`, with a doc entry. `account-recovery` is unchanged.
  - As with c2, I added no manifest variant. The specs arm the mode directly, so the manifest, the live tasks and the repair tasks are untouched.
- **`pages/partner-widgets/`** (new directory: `values.ts`, `strip.ts`, `index.ts`):
  - `values.ts` exports `PARTNER_WIDGETS`: each embed's tag, link words, href and text, plus `answerDelayMs: 150`. The specs and the browser tests import it rather than restating it.
  - `strip.ts` exports `partnerWidgetsStrip()`: three unstyled `<div>` lines placed in the buy box, after its live part. No class roles were added and the stylesheet is untouched, so baseline class names and CSS are unchanged.
  - All the vendor names are made up. I avoided "PayFlex" because it is a real company.
- **`client/partner-widgets-script.ts`** (new): exports `partnerWidgetsScript()`, which runs after the product page's own script, only in this mode.
  - Each link calls `preventDefault`, so it answers in place.
  - A second press of the delivery link adds no second estimate. The highlights define is guarded against running twice.
  - It starts no timers and makes no other DOM changes, so the only change a click's watch can see is the one that click caused.
- **`pages/product-page.ts`**: when `state.mode === "partner-widgets"`, renders the strip and appends `\n` + the script. Nothing else changed.
- **Barrels**:
  - `pages/index.ts` exports `PARTNER_WIDGETS` and `partnerWidgetsStrip`.
  - `client/index.ts` exports `partnerWidgetsScript`.
  - The scenario's `index.ts` exports `PARTNER_WIDGETS`.
- **`tests/partner-widgets.test.ts`** (new, 6 tests). It covers state, route, pages and client, so it sits in the scenario's own `tests/`. It checks:
  - arming, the reset on arming, and the default mode (`account-recovery` is still listed);
  - the baseline product page has none of the tags or words;
  - search, cart, checkout, weekly-ad, a seller page and home are byte-identical to the baseline;
  - the mode's product page equals the baseline once the strip and the script are removed;
  - the strip's place and markup;
  - the script's structure: one closed root and two open ones, the highlights defined inside the click's timeout, and the estimate defined at load but created and inserted only after the press;
  - the page and tag words contain no test vocabulary.
- **`tests/partner-widgets-browser.test.ts`** (new, 3 tests, headless Chromium through the existing `browser-harness`):
  - **Offer.** `shadowRoot === null`, a second `attachShadow` throws (so a root exists), and the host has no light children but renders. After the link is pressed, a document-wide MutationObserver records nothing, yet the host grows.
  - **Estimate.** At the moment the observer sees the element added, its `shadowRoot.textContent` already equals the text. A second press keeps one element.
  - **Highlights.** Before the press the element is undefined and has no root. After it, the element is defined, its root holds the text, and the observer recorded nothing.
  - Page code is passed as string expressions, because scenario-lab compiles without the DOM lib.

### Spec (`apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-in-place.spec.ts`)

- `openProduct(openHarness, mode?)` arms `set-mode` first, because arming resets the shopper. It then answers consent, the promo and the chat card. `mutate` now takes a payload.
- The three rows use `PARTNER_WIDGETS` imported from the bigbox barrel, by the same relative path `sensitive-names.spec.ts` uses. Their selectors are href-based.
- Each row now also checks the page itself:
  - the estimate's root text after the click;
  - the highlights root is null before the click and holds the text after it;
  - the offer's `shadowRoot` is null and its host height grows, so the details really opened while the click still failed.
- The header comment was rewritten; it no longer says these rows keep constructed components.

## Commands run and observed results

- **Build.** `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (from `apps/scenario-lab`).
  - First run: TS2304/TS2584 errors in the browser test, because DOM globals are not in scenario-lab's lib. I rewrote the page code as string expressions.
  - Second run: `stored in the shared store (1087 file(s), 4493769 bytes)`. It noted that it "waited 15.3s for pid 31772's run of this step", which was another worker's build of the same step.
- **New tests.** `node --test dist/scenarios/bigbox-retail/tests/partner-widgets.test.js dist/scenarios/bigbox-retail/tests/partner-widgets-browser.test.js` gave `# tests 9 # pass 9 # fail 0`.
- **All bigbox tests.** `node --test dist/scenarios/bigbox-retail/tests/*.test.js dist/scenarios/bigbox-retail/qualification/tests/*.test.js` (13 files, including account-recovery, browser-paths, breadth-browser-paths, scenario/manifest, store-remembered, person-check and qualification) gave `# tests 77 # pass 77 # fail 0`. That is c2's 68 plus my 9.
- **Narrow typecheck.** `npx tsc -p <scratchpad>/tsconfig.d2.json` (extends `apps/extension/tsconfig.test.json`, typeRoots set, files = the spec) exited 0 with no output.
- **Headed run 1.** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/shadow-roots/tests/shadow-root-in-place.spec.ts content/tests/evidence/tests/sensitive-names.spec.ts --headed --workers=2 --reporter=list --output=test-results/content/d2-artifacts` gave `8 passed, 1 failed (2.1m)`.
  - The failure was the delivery-estimate row: `Test timeout of 30000ms exceeded`.
  - Its trace shows the browser fixture setup (`pw:api@6`) took 26,986 ms. The row's own steps ran from about 27.0 s to 30.1 s, and the click reply had already matched the expected success (`expect@25`, at 30,011 ms) when the limit hit.
  - Passing siblings also showed 24-27 s, so setup was slow across the run (the machine was busy; another worker's build was running). This was not a row defect, and I changed nothing.
- **Headed run 2.** Same command gave `9 passed (4.3m)`: 5 sensitive-names rows and 4 shadow-root rows, the shadow rows taking 2.9-4.6 s.
- **Headed run 3.** The shadow-root spec alone (`--headed --workers=2`) gave `4 passed (3.6m)`.
- **Structure audit.** `node scripts/structure-audit.mjs` exited 0 with `structure-audit: passed (215 warning(s), 635 baselined)` and "1 baseline entries can be lowered". Grepping its output for `bigbox-retail` or `shadow-root-in-place` found nothing, so none of the warnings are on my paths.

## Not verified

- No whole-package typecheck, `pnpm check` or full suite was run. Only Chromium was used; Firefox was not.
- I did not watch the new tests fail before writing the implementation. I wrote them first, but the first build that compiled ran them against the finished code.
- I did not run `pnpm structure:baseline`. The entry it says can be lowered is not mine.
- Fixture setup time: one headed run hit the 30 s per-test limit during browser launch. I did not change the timeout, since playwright configs are outside my scope.
- No live or Lab run. No live task uses the mode.

## Open questions or contradictions found

1. **Default site unchanged.** Unlike c2, this mode adds no class roles and no stylesheet rules. Every baseline document is byte-identical, and the test asserts it for the product page and six other pages.
2. **Slow fixture launch.** The content harness's browser launch reached 27 s under load, which leaves little margin under the 30 s test limit. If this recurs on the merged branch, the harness or the config owner may want a longer fixture or test timeout. I saw it once in three runs.
3. **Hash link on the closed row.** That row uses a hash href (`#pay-over-time`), as the original `#closed` did. The reply is still "the page prevented the navigation", so the in-place watch treats hash links like the others.
