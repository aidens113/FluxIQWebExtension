# t730-f1: receipt, request counter, user-script probe, click rows

## Outcome

Done, with one open item outside this brief.

- **Part 1.** Scenario routes can now set their own Content-Security-Policy (the Lab's stays the default). There is a new authenticated `GET /__control/requests?path=` counter, and everything-store has a printable order receipt served under a strict policy. Each has tests, all passing.
- **Part 2.** The user-script probe now runs on the receipt, `window.storeModals`, the Lab's counter and `localhost`, and its own HTTP server is gone. It typechecks and stays skipped unless `FLUXIQ_USER_SCRIPT_PROBE=1` is set.
- **Part 3.** A new everything-store mode, `help-and-offers`, hosts all seven rows the brief listed. Their injection code is deleted, and they pass headed.
  - Two rows the brief did not list (hidden; the control row's cover-then-remove) still change the page. The reason is below.
- **Open item.** One job-board row I did not touch failed in 2 of 3 full headed runs and passed 5 of 5 times on its own (details below).

## What changed and why

### Part 1: scenario-lab (`apps/scenario-lab/src/`)

- **`server.ts`**
  - *Per-route policy.* A route's own headers already overrode the Lab's, because `writeHead` gives the headers it is passed precedence over `setHeader`. I documented this on `setSecurityHeaders` and pinned it with a test rather than adding a mechanism.
  - *Request counter.* A per-lab `requestCounter()` (non-exported type and factory) records every non-control request by pathname and query. Both origins (main and frame) share it.
  - Every request is recorded after the host check and before routing, so a request answered with 404 still counts.
- **`control.ts`**
  - `GET /__control/requests?path=<p>` returns `{ path, count }`.
  - A path that carries its own query (`/a?v=1`, sent as one encoded parameter) counts only requests with exactly that query. A bare path counts every query.
  - Errors: 401 without the token, 400 when `path` is missing or not absolute, 405 for any method other than GET.
  - `/__control/reset` now also clears the counter, but only after `store.reset()` succeeds. The failed-reset test therefore still sees nothing change.
- **`tests/server.test.ts`** (one test added): the receipt's GET and HEAD carry exactly the strict policy, while the store home page, the cart and a 404 keep the Lab's policy.
- **`tests/control-requests.test.ts`** (new, 3 tests):
  - authentication and validation;
  - counts by path and by exact query, with HEAD, 404s and the frame origin all counted;
  - control requests never counted, and reset starting the count over.

### Part 1: everything-store receipt

- **`catalog/store-paths.ts`:** `STORE_PATHS.receipt(orderId)` gives `/scenarios/everything-store/gp/css/summary/print.html?orderID=…`.
- **`pages/receipt.ts`** (new; exports `receiptResponse`; added to the `pages/index.ts` barrel):
  - Content: a stand-alone print page. It has a masthead, "Final Details for Order #…", the order total, an items table (product thumbnails from the store's own image route, seller, quantity, price), delivery, shipping address, payment and an order summary.
  - Policy: it is served with `default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'self'`.
  - Inline script: it would set `html.className='js'`, hide `[data-print-hint]` and reveal the `hidden` `[data-print]` "Print this page for your records" button. Under the policy none of that happens, which is the probe's proof that page scripts did not run.
  - An unknown order gets the store's "We couldn't find that order." receipt, as a 404 under the same policy.
- **`route.ts`:** the `RECEIPT` subpath is a known route answered by `receiptResponse`. It still gives way to the robot check like every other page.
- **`tests/receipt.test.ts`** (new, 5 tests):
  - policy, contents, lines and images;
  - exactly one inline script, and the button served hidden;
  - the not-found receipt as a 404 under the policy;
  - no test vocabulary in the visible text;
  - in Chromium, on a placed order: the button stays hidden, the hint stays, `className` stays empty and the store images load. The same markup loaded with `setContent` and no policy runs the script and reveals the button.

### Part 2: `apps/extension/e2e/user-script-feasibility/`

- **`pages.ts`**
  - Starts an in-process scenario lab, places the returning shopper's cart order through `/api/everything-store/start-checkout` and `place-order`, and returns:
    - `receipt` and `store` URLs, plus `ungrantedStore` (`http://localhost:<port>/…`);
    - `asset(kind)`, a store product photo under `?v=<kind>`;
    - `requests(kind)`, which reads `/__control/requests` for that path and query.
  - The probe's own HTTP server is deleted.
- **`tests/probe.spec.ts`:** the same assertions, retargeted, and reformatted without packed statements.
  - The strict document is the receipt. The `h1` is read as the fact, and `[data-print]` hidden plus `[data-print-hint]` visible replace `data-page-inline`.
  - Page-world isolation: `typeof window.storeModals` is `"object"` in the page and `"undefined"` in the USER_SCRIPT world.
  - The allowed fetch now expects status 200 from the store's photo instead of a synthetic body.
  - Every network count comes from the Lab counter.
  - The `localhost` store is the ungranted site.
  - The env gate, browser.ts, extension.ts, types.ts and the config are unchanged.

### Part 3: the `help-and-offers` mode and `click.spec.ts`

- **`state/types.ts`:** `storeModes` gains `help-and-offers`, documented as a real-store story. I added no manifest variant, live task or repair task, so the manifest test is unchanged and passes.
- **`pages/cart/help-and-offers.ts`** (new). Only under the mode, the cart page ends with a "Help and offers" area:
  - "Read our delivery questions" (`#delivery-questions`), a plain link;
  - Delivery, Returns and Gift options help tabs linking to their panels;
  - a 150 px scrolling list of six delivery questions (accordion buttons). Its "Still need help? Contact us" bar is absolutely pinned along the box's bottom, over the last question;
  - "Deals for you" filters (`?dept=home|electronics|office`), with the line "12 deals picked for you";
  - a Subscribe & Save promo with "See terms" (`#promo-terms`);
  - "Customers also viewed" with "Page 2" (`?viewed=2`);
  - a lightning deal with two clocks and "Claim deal", shown only when the cart holds the descaler (see the busy-flag finding below).
- **`client/help-and-offers-script.ts`** (new). `cartScript(css, mode)` appends it under the mode only.
  - Tabs: cancel the click and toggle the panels.
  - Questions: toggle `aria-expanded` and the answer.
  - Clocks: tick every 100 ms. One rewrites its whole sentence (`textContent`); the other changes its timer's text node in place (`data`).
  - "Claim deal": on mousedown, gets a class and a ripple span; the click is cancelled.
  - Filters: set `aria-current` on the clicked link, then rewrite the count's text node 120 ms later.
  - "See terms": cancelled, with nothing behind it.
  - "Page 2": cancelled, then `aria-busy="true"` is set on the section.
- **`style/classes.ts` and `style/stylesheet.ts`:** nine new per-role seeded classes and their styles.
- **`pages/cart/page.ts`:** appends the area, and passes the mode to `cartScript`.
- **`tests/help-and-offers.test.ts`** (new, 6 tests):
  - arming the mode and starting over;
  - the area drawn only on the armed cart, with the home and product pages unchanged;
  - the structure;
  - the deal shown only with the descaler in the cart;
  - no test vocabulary;
  - in Chromium: each link behaves as described, the clock ticks, and the point at the last question's centre lands on the "Still need help?" bar. The fragment link moves the address.
- **`click.spec.ts`**
  - New `openHelpAndOffers(openHarness, descaler?)`: arms the mode first (arming resets the account), then answers consent, the app banner and notifications, and optionally adds the descaler.
  - The `addLink` helper and all six inline `page.evaluate` link injections are deleted.
  - The covered row now clicks `li:last-child > [data-faq]` under the pinned bar. It asserts:
    - the validation and failure `actual` name `p.<bar class>`, read from the page because classes are seeded;
    - `after absorbing obstructed_target`, and no `closing`;
    - no gesture event reached the question, and `aria-expanded` is still `false`.
  - The header comments are updated. The file went from 566 to 529 lines.

| row | before | now | headed |
| --- | --- | --- | --- |
| covered target rejected | spec cover over "Deliver to" | pinned "Still need help?" bar over "How do I cancel an order?" | pass |
| link navigation began | injected `#done` link on the cart page | `a[href="#delivery-questions"]` | pass |
| link handler swallows click | injected cancelled link | "See terms" `[data-promo-terms]` | pass |
| tab reveals panel in place | injected link and panel | Returns tab `a[href="#help-returns"]` | pass |
| filter marks itself current | injected link and count | `a[href="?dept=home"]`, giving "3 deals in Home & Kitchen" | pass |
| dead link with ripple and ticking clocks | injected clocks and link | "Claim deal", with the descaler in the cart | pass |
| dead link raising only a busy flag | injected link and region | "Page 2" `[data-viewed-page]` | pass |

**Rows kept as they were, and why.** The hidden row (spec sets `display:none` on "Deliver to") and the control row (spec covers the viewport, then removes the cover) were not in the brief's list, so I left both. Each needs the page to change under the spec's control part-way through the row: hiding a control, or uncovering the same control on cue. A store mode that did that would be a test construct dressed as a page. `coverViewport` stays for the control row only, and its doc comment now says so.

**Finding: the busy flag plus a ticking clock passes falsely.** In my first layout, the deal clock ticked everywhere on the mode. The busy-flag row then came back:

`{"status":"passed",...,"actual":"the page prevented the navigation and changed its content in place, 107 ms after the press"}`

- What happened: the `aria-busy` attribute change plus the clock's next tick (100 ms) satisfied the in-place rule. This is the same shape the filter row passes on, and the verb cannot tell an unrelated clock from an answer.
- The ripple row on the same page still failed correctly. There the changes inside the clicked link do not count, so nothing outside the link moved structurally.
- What I did: I kept the original row shapes. The deal and its clocks appear only for a cart holding the descaler, which only the ripple row sets up.
- Whether the verb should treat this as a defect is a product question; I did not change product code.

## Commands run and observed results

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- **Build.** `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (from `apps/scenario-lab`).
  - The first attempt failed with TS2584 (`document` in my receipt test). I fixed it to use string `evaluate`, and every rebuild after that succeeded. The final build was `"reuse" … inputs and outputs match the stamp`.
- **Server and counter tests.**
  - `node --test dist/tests/server.test.js`: `tests 15, pass 15, fail 0`. HEAD has 14; mine is the 15th.
  - `node --test dist/tests/control-requests.test.js`: `tests 3, pass 3, fail 0`.
- **Store tests.** `node --test dist/scenarios/everything-store/tests/*.test.js dist/scenarios/everything-store/*/tests/*.test.js` (all store tests, honest, naive and breadth paths included): `tests 77, pass 77, fail 0`. That is the 66 c3 reported, plus receipt 5 and help-and-offers 6.
- **Headed content runs.** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/click.spec.ts content/tests/keyboard.spec.ts --headed --workers=2 --output=test-results/f1-<n>`:

  | run | result | the failure |
  | --- | --- | --- |
  | f1-1 | 31 passed, 1 failed | my busy-flag row, before the fix (the finding above) |
  | f1-3 | 31 passed, 1 failed | job-board in-place filters, click.spec.ts:524: `aria-busy` was `"true"`, expected `"false"` |
  | f1-5 | 31 passed, 1 failed | the same job-board row |

  - In f1-3 and f1-5, all 16 everything-store, company-website and job-board results rows and all 15 keyboard rows passed.
- **The job-board row alone.**
  - `… -g "in-place filters" --headed --workers=1 --output=test-results/f1-4`: `1 passed`.
  - `… -g "in-place filters" --repeat-each=4 --headed --workers=2 --output=test-results/f1-6`: `4 passed`.
- **User-script probe.** `pnpm exec playwright test -c e2e/user-script-feasibility/playwright.config.ts` (from `apps/extension`): `2 skipped` (chrome, edge), as gated.
- **Typecheck.** `node_modules/.bin/tsc -p tsconfig.test.json --noEmit` (from `apps/extension`): exit 0, no output.
- **Structure audit.** `node scripts/structure-audit.mjs`: `structure-audit: passed (215 warning(s), 631 baselined)`.
  - The only line naming my files is the advisory `[file-lines] click.spec.ts: 529 lines`.
  - It also printed "1 baseline entries can be lowered". That is probably the statement-packing entries for the rewritten `user-script-feasibility/pages.ts` and `probe.spec.ts`. I did not run `pnpm structure:baseline`, because the baseline is a shared file.
- **Concurrent builds.** Before the content runs, I confirmed no `extension:build` or `test-content` process was running. I did not run `test:e2e:build`.

## Not verified

- **The probe itself.** I did not run it with `FLUXIQ_USER_SCRIPT_PROBE=1`: it needs branded Chrome and Edge and the settings toggle. Four expectations are new and unrun:
  - the receipt's hidden button and hint;
  - `storeModals` being `"object"` in the page;
  - the allowed fetch returning status 200;
  - the counts coming from the Lab's counter, including the navigation to an SVG photo under `?v=dom-navigation`.
- Whether the job-board row's intermittent failure is caused by another worker's in-progress job-board edits (several job-board files are modified in this tree) or by load. My scenario-lab builds compiled whatever was in the tree at the time.
- Firefox; the scenario-lab `check` (`tsconfig.e2e.json`); live Lab runs (none, by brief).

## Open questions or contradictions found

1. **The job-board in-place filters row is intermittent** (click.spec.ts:524). The reply arrived while the results column still had `aria-busy="true"`. It failed in 2 of the 3 full runs I made after f1-1, and passed 5 of 5 times run on its own. It is not my row or my scenario, but it needs an owner.
2. **Busy flag plus an unrelated ticking clock** is reported as content changed in place (the finding above). The spec rows keep the original shapes. If the product should reject this case, the `help-and-offers` mode can host the row directly: put the descaler in the cart and click "Page 2".
3. **Baseline.** "1 baseline entries can be lowered" is waiting for `pnpm structure:baseline` by whoever owns the shared baseline.
