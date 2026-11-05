# Final-state facts audit: facts readable only on a page the task never asked to end on

Status: audit done and every fix applied in `apps/scenario-lab` (2026-11-05). No git, nothing paid.

Rule used: a fact fails when it is page-bound and the instruction does not explicitly ask to finish there. "Give me a table of X" does not count as asking to end on X's page, because that is what scored the saved-total run wrong. "Open my saved jobs so the list is showing" or "stop at the booking review" does count. Facts asserting absence (`exists:false`) cannot misjudge a correct run and were not counted. "Every page" was checked against each site's shell or layout code. The fact probe (`scenario-assertions.ts`) searches every frame of the page, first match wins.

## Verdicts

| Scenario | Verdict |
| --- | --- |
| everything-store | kettle-to-cart, first-page (3 rows), buy-kettle fixed |
| crossborder-marketplace | pass, nothing changed (facts are header flyouts on every page) |
| bigbox-retail | pass, nothing changed |
| job-board | halvard-careers-roles and apply-quillmark fixed |
| local-classifieds | make-offer fixed |
| auction-marketplace | pass, nothing changed |
| photo-social | pass, nothing changed |
| social-network-feed | group-post (3 rows), feed-digest, move-open-day, confirm-requests fixed |
| company-website | quote-request (2 rows), gas-engineers (2 rows), business-prices, book-service, plus four qualification files with a path fact fixed |
| professional-network | pass, nothing changed |

A second sweep over every `finalState` and `successFacts` list in the ten scenarios (all file styles) found four more page-bound facts that the first pass missed: the `document path` facts in the company-website qualification files (apprentices, newsletter-signup, saturday-certificate, heat-pump-quote) and heat-pump's `quote-details`. They are fixed below. The sweep now reports only `exists:false` facts.

## What changed, per task, and why it still fails when the site is wrong

"Honest" = the state the fixture reaches by the task's own steps; "wrong" = plausible bad endings. Both directions are asserted in the tests named in the last column; the browser suites listed under Validation also run each honest recording against the changed facts and each naive path against them.

| Task | Old fact (page-bound) | New fact | Fails when | Test |
| --- | --- | --- | --- | --- |
| everything-store kettle-to-cart | cart-subtotal, saved-heading (cart page) | `everything-saved-cloths-account` literal: two kettles as new line L3, case first in Saved, nextLine 4 (`ACCOUNT_LITERALS.kettlesAddedCaseSaved`) | case deleted, case left in cart, one kettle, other colour, nothing done; two single adds still pass (adds merge) | `everything-store/tests/final-facts.test.ts` |
| everything-store buy-kettle | order-status, order lines, delivery, ship-to, payment, total, plus-trial, orders-today (confirmation page) | new hidden element `everything-placed-orders` (`qualification/orders-facts.ts`), fact `order-is-one-kettle-home-standard-visa`; `cart-left-alone` kept | no order, other kettle, office address, gift card, Plus trial on, ordered twice, other product | same |
| everything-store first-page (+deal-wheel, robot-check rows) | result-count text (results page) | removed | see below | same |
| job-board halvard-careers-roles | `job-closed-account` unreadable on the careers site where the task ends | same account element now on the careers list page (`ats/careers-page.ts`, list page only, so a stale copy never sits above an application iframe) | any save, follow, alert or application | `job-board/tests/final-facts.test.ts` |
| job-board apply-quillmark (+check-first) | application-reference (ATS thank-you page) | new hidden element `job-application-references` (board pages and the thank-you page); fact `[EXPECTED_REFERENCE]` | nothing sent, sent twice, other answers (other hash), spam-dropped (null) | same |
| local-classifieds make-offer | offer-receipt, only-the-offer (that listing's page) | `classifieds-account-contacts` equals the state after exactly the one offer (`accountIs(... "send-offer" ...)`), plus `buying-count 3` | no offer, other amount, other listing, offer twice, ready-made message too, honeypot offer | `local-classifieds/tests/final-facts.test.ts`, `session.test.ts` |
| social group-post (3 rows) | pending-posts (group page) | `social-account-changes` with the one pending post in `riverside-allotments` | not posted, other group, other words, twice, trap field, profile post | `social-network-feed/tests/final-facts.test.ts` |
| social feed-digest (3 rows) | document path = home | `social-account-changes` unchanged | any hide, post, chat message | same |
| social move-open-day | document path = home (only fact, no state at all) | account with old post trashed and the Sunday post created Public | nothing done, trashed only, reposted only, Friends audience, old words | same |
| social confirm-requests | document path = requests page | dropped; the per-request answer facts (already on every page) stay | n/a, they still fail on any wrong confirm or delete | same |
| company quote-request (2 rows) | quote-reference, service, contact, marketing, postcode, details; path (confirmation page) | new hidden elements `company-quote-record` and `company-quote-details` (`qualification/quote-record.ts`, `quote-details.ts`); facts: record equals {reference, service, contactBy, offers:false, postcode}, details contains "2009"; final state also `quoteCount 1` | no request, other service, phone contact, marketing ticked or newsletter joined (offers true), other postcode, 2009 not mentioned, second quote | `company-website/tests/final-facts.test.ts`, `naive-path.test.ts` |
| company gas-engineers, winter-notice, business-prices | document path | `company-review-account` untouched literal | any quote, booking, subscription, draft | same |
| company book-service | booking-deposit, booking-service (confirmation page) | new hidden element `company-booking-record` (`qualification/booking-record.ts`) equals {hollins-cross, service-combi, slot, deposit 3000}, plus account `bookingCount 1, deposits {1,3000}` | nothing booked, other slot, other service, other branch | same |
| company qualification: apprentices, newsletter-signup, saturday-certificate | document path (one page each) | dropped; each keeps its account literal | the account literal still fails on any act | `qualification/tests/*` |
| company heat-pump-quote | document path; quote-details (confirmation page) | path dropped; `company-quote-details` contains "Sallowmere"; `company-quote-record` literal (KQ-72474, Text message, offers false, KL6 2RN) | wrong branch named, wrong contact, marketing | `breadth-expected.test.ts`, `breadth-paths.test.ts` |

### first-page: why dropping the result count is sound

The count (`1-16 of N results for "wireless earbuds"`) read the results page only. The task's dataset already fixes it: `final-facts.test.ts` sweeps the same keywords over plus on/off, 4-star on/off, every price band, every sort and every department (400 searches) and asserts that whichever combination returns the dataset's exact first-page records returns the same total as the right search. Only the right filter set produces those records, so the count could never separate a right answer from a wrong one. The sweep does not cover free-text prices or brand filters, nor other keywords; the task names the keywords and the dataset compares record by record. The fact is not a state fact: nothing in the site's server state records the search, so there was no state element to move it to.

## New read-only elements, and what the model can see

All five new elements (`company-quote-record`, `company-quote-details`, `company-booking-record`, `everything-placed-orders`, `job-application-references`) are `<script type="application/json" data-testid=...>` elements placed beside the existing account elements, rendered from the same server state and refreshed by the same mutate wrapper. They add nothing to the visible markup, and tests assert that on the pages checked (`company-website/tests/final-facts.test.ts`, `job-board/tests/final-facts.test.ts`; the existing job-board test-id allow-list now names the new id).

Does the page view surface them? The extension's text reading excludes scripts (`content/action-runtime/text-sighting/sight-text.ts`: `NOT_PAGE_TEXT = "script, style, noscript, template"`; `interference/layer-text.ts` `UNREAD_TAGS`), the same treatment the existing account elements get, so their contents are not in the page text. Not verified: the page view and page search live partly in Core, and the model can search a page by any text or attribute. A search by attribute could match `data-testid="company-quote-record"` and read the element's text. That exposure is identical to the account elements already shipping (`company-review-account`, `everything-saved-cloths-account`, ...), and the new elements hold only state the model itself has just caused, but I did not run a model against the page view to prove nothing is surfaced. Proving it needs Core's page-view code run on one of these pages.

## Validation (observed)

- `node scripts/structure-audit.mjs` -> `structure-audit: passed (243 warning(s), 552 baselined)`. It first failed on two barrel-import rules in my new files, fixed.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` -> ran and printed only the build-cache line (no TypeScript errors). Its note says the stamp was not stored because Core's source changed while it ran (the other worker); not a failure.
- Built with `scenario-lab:build`, then `node --test` over every test file of each changed scenario, headless Chromium, no provider calls:
  - everything-store: 83 tests, 83 pass (includes the honest-path and naive-path browser suites that evaluate the changed facts against the real recordings and wrong paths).
  - job-board: 66 pass, 0 fail.
  - local-classifieds: 43 pass, 0 fail.
  - social-network-feed: 56 pass, 0 fail.
  - company-website: 68 pass, 0 fail.
- First full run had 7 failing tests, all tests that read facts from the page's visible markup only (`markupOf` strips scripts) or counted test ids; each was updated to read the document that carries the element, or to the new fact (everything-store `scenario.test.ts`, local-classifieds `session.test.ts` and `browser.test.ts`, job-board `scenario.test.ts`, company-website `scenario.test.ts`, `naive-path.test.ts`, `qualification/tests/breadth-expected.test.ts`, `breadth-paths.test.ts`). In the company naive path the newsletter-joined run now fails `quote-record` instead of `quote-no-marketing`: same bad ending, caught by the new fact.

## Not verified

- No full-model run and no paid run. The new facts were checked against the fixture's own state and scripted browser recordings, not against a live model ending on a page of its choice.
- `group-post`'s group value `riverside-allotments` and the sage kettle's `offerId: null` are confirmed by the state tests and the passing browser suites, not by an independent source.
- The booking widget runs in its own iframe; the booking record sits in the site shell, which the widget's confirmation redirect reloads, so it is fresh at the end of a booking. A run that ends inside the widget before that redirect would read the previous record.
- The `job-application-references` element is deliberately absent from the careers job page's main frame (it would be stale above the application iframe); a run that leaves the careers site for neither the board nor the thank-you page has no reference to read.
- Page-view exposure of the new elements (above).

## Files changed (all under `apps/scenario-lab/src/scenarios/`)

- local-classifieds: `manifest.ts`; tests `final-facts.test.ts` (new), `session.test.ts`, `browser.test.ts`.
- social-network-feed: `manifest.ts`; test `final-facts.test.ts` (new).
- company-website: `manifest.ts`, `expectations.ts`, `pages/shell.ts`, `qualification/{quote-record,quote-details,booking-record}.ts` (new), `qualification/index.ts`, `qualification/{apprentices,newsletter-signup,saturday-certificate,heat-pump-quote}/expected.ts`; tests `final-facts.test.ts` (new), `scenario.test.ts`, `naive-path.test.ts`, `breadth-paths.test.ts`, `qualification/tests/breadth-expected.test.ts`.
- everything-store: `workflows/{add-to-cart,first-page,purchase,account-literals}.ts`, `pages/shell.ts`, `qualification/orders-facts.ts` (new), `qualification/index.ts`; tests `final-facts.test.ts` (new), `scenario.test.ts`.
- job-board: `manifest.ts`, `board/shell.ts`, `ats/{careers-page,embed-pages}.ts`, `qualification/application-references.ts` (new), `qualification/index.ts`; tests `final-facts.test.ts` (new), `scenario.test.ts`.
