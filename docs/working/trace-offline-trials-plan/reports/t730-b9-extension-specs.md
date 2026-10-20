# t730-b9-extension-specs: extension specs off synthetic pages

Worker report for brief `t730-b9-extension-specs`, tree `fxwork/t730-realistic-only-browser-specs`.

## Outcome

Partial.

- I moved every page-serving test I own onto a realistic Scenario Lab page, except where a realistic site lacks the construct. Those tests are left unchanged and marked Blocked below, each with the hook it needs.
- One retargeted spec, `meaningful-assert-wait`, now fails on the realistic page. The cause is a product defect, not the move; it is described under "Open questions".
- The cancellation specs open no page. Their servers are Core gateway and API stand-ins, so they stay as they are.

## What changed and why

| spec | test | capability | disposition | new home (file › test) | headed run result |
| --- | --- | --- | --- | --- | --- |
| `action.spec.ts` | executes actions through the real content-script message path | snapshot, type and click through `chrome.tabs.sendMessage` `executeAction` | Retarget | same file and test. Uses the everything-store home page. The snapshot must name the button `[data-testid="nav-search-submit"]`. It types into `input[name="k"]` and the value must arrive. It clicks `[data-consent="accept"]`; the banner must disappear and `/__control/final-state` must show consent `accepted`. | passed (11.1s) |
| `install-and-content.spec.ts` | loads the current MV3 artifact and its extension page | manifest and side panel | unchanged (no page served) | n/a | passed (8.2s) |
| `install-and-content.spec.ts` | mounts the shared panel… | panel UI | unchanged (no page served) | n/a | passed (12.8s) |
| `install-and-content.spec.ts` | injects the content script into a loopback scenario page | the content script is injected and answers `fluxiq.ping` | Retarget | same file. Test renamed "injects the content script into a realistic loopback scenario page". Uses the everything-store home page. | passed (12.7s) |
| `fixtures/scenario-page.ts` | (fixture) | synthetic inline page | Deleted. Nothing referenced it after the retargets (checked with grep over apps, packages and scripts). | n/a | n/a |
| `runtime/tests/browser-navigation-readiness.spec.ts` | explicit open validates ordinary, HTTP404 and person-only robot landings without retrying the open | how `web.browser.tab` open judges where it landed, plus the tab count to prove there were no retries | Retarget | same file and test. Ordinary landing: `/scenarios/everything-store/`. 404: `/scenarios/everything-store/no-such-aisle`. Robot landing: the store's `robot-check` variant, armed with `/__control/arm` (`first-page-earbuds`) before the third open. | passed (1.1m) |
| `runtime/tests/meaningful-assert-wait.spec.ts` | production content refuses missing predicates and preserves authored literal text | empty or blank assert and wait predicates are refused at once; the text "null" is treated as text | Retarget | same file and test. Uses bigbox-retail `search?q=null`, which echoes "Results for “null”". The sort select is focused. Targeted checks: `[data-testid="atc"]` absent and `h1` exists. Consent and the promo are answered through the API. | **failed**: 3 soft failures. The `wait-0`, `wait-1` and `wait-2` refusals took 2258–2577 ms against the 2000 ms bound. This is a product defect, explained under "Open questions". |
| `runtime/tests/requests-settings.spec.ts` | requests Settings stays unavailable and persisted OFF | the requests setting cannot be turned on; the content script's build identity matches | Retarget | same file and test. The everything-store home tab supplies the build identity. | passed (14.6s) |
| `runtime/tests/sanitized-field-typing.spec.ts` | native numeric/date values survive sanitization; malformed and refused edits stay truthful | typing into number, date, time, month, week and datetime-local inputs; edits the page cancels, reverts or replaces; read-only fields; a field covered after typing; password redaction; per-key input events | **Blocked** for the native, cancel, revert, replace, read-only and cover cases (hooks below). The test is left unchanged. The password and per-key parts are retargeted into the two new tests below. | unchanged | passed with `--timeout=120000` (1.2m). Times out at the config's 30 s under concurrent load, which was already the case before this task (see "Open questions"). |
| `runtime/tests/sanitized-field-typing.spec.ts` | (new) typed text reaches the page key by key: the store opens its suggestions, and nothing is submitted | each key sends an input event the page reacts to, and typing does not submit | Retarget (part of the above) | same file › this test. Types "kettle" into the everything-store search box. A passive input listener records `k … kettle`. The store's own "Search suggestions" listbox shows 5 options, and the URL does not change. | passed (13.8s) |
| `runtime/tests/sanitized-field-typing.spec.ts` | (new) a password is typed into the field and never echoed in the result | typing into a sensitive field without leaking it | Retarget (part of the above) | same file › this test. Uses `input[name="password"]` on photo-social `/accounts/login/`. The field must hold the value, the result JSON must not contain it, and the URL must not change. | passed (6.9s) |
| `runtime/tests/typed-browser-readiness.spec.ts` | controlled check reaches application state once; no-op, radio refusal and reverts remain truthful | check presses a control once to change app state; "already set" is a no-op; a checked radio is not unchecked; reverted, deferred-reverted and replaced checkboxes are reported as failed | **Blocked** for the controlled, reverted, deferred and detached cases (hooks below). The test is left unchanged. The no-op, radio and once-to-app-state parts are retargeted to the new quote-drawer test. | unchanged | passed with `--timeout=120000` (1.2m). With the default 30 s, the first test in a worker fails on teardown; a HEAD copy did the same. |
| `runtime/tests/typed-browser-readiness.spec.ts` | Next observes semantic mutation in existing row once and distinguishes disabled end and unchanged timeout | `next_page` moved, ended on `control_disabled`, and an unchanged press that times out | **Blocked** only for "moved by rewriting the existing row in place" (hook below). The test is left unchanged. The ended and unchanged parts are retargeted to the two new tests below. | unchanged | passed with `--timeout=120000` (44.1s). One run failed on teardown at 30 s, as above. |
| `runtime/tests/typed-browser-readiness.spec.ts` | (new) quote drawer: check reaches the request once; no-op, radio refusal and pre-ticked box stay truthful | the same check semantics on realistic controls | Retarget | same file › this test. Uses the company-website `#quote` drawer. The `contactBy` Email radio: checks, then "already set", then an uncheck that fails. `marketing` (pre-ticked): "already set", then unticks. `privacy` ticks. The person then submits and passes the human check; the confirmation must show `quote-contact` "Email" and `quote-marketing` "No". | passed (1.0m) |
| `runtime/tests/typed-browser-readiness.spec.ts` | (new) Next loads the next results page as a new document, and ends on the last page's disabled Next without pressing | moved, then ended on `control_disabled`, through the real worker across documents | Retarget | same file › this test. Uses everything-store `s?k=wireless+earbuds&page=4`, with the soft check passed and the nudges answered through the API. The first move goes to page 5; the second ends on `control_disabled` and the page stays at 5. | passed (44.3s) |
| `runtime/tests/typed-browser-readiness.spec.ts` | (new) a press the list ignores times out unchanged, is pressed once, and is not called the list's end | an unchanged press is reported as a timeout, not as the list's end | Retarget | same file › this test. Uses the photo-social giveaway post's "Load more comments" (`mode: "loadMore"`), which ignores its first press. Result `timed_out`, still 13 rows, exactly 1 press. | passed (30.8s) |
| `user-script-feasibility/**` | chrome and edge: USER_SCRIPT permission, document, CSP and DOM-network boundaries | the userScripts world on a strict-CSP page; isolation from the page world; network effects counted by the server | **Blocked**, left unchanged. It only runs with `FLUXIQ_USER_SCRIPT_PROBE=1` and uses its own probe extension and the branded browsers. | unchanged | `2 skipped` (gated, as designed) |
| `cancellation/tests/cancel-build.spec.ts`, `cancel-run.spec.ts` | Stop cancels a Core build / run | side-panel Stop through a gateway | **Keep**. The HTTP+WebSocket server stands in for the Core gateway and API (`/client` socket, `cancel-flow-bootstrap`, `cancel-runtime-session`). No tab opens a page on it. | n/a | not run (unchanged) |

Other files the brief asked me to check: `runtime/harness-entry.ts`, `runtime/harness.ts`, `content/tests/live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts`, `content/tests/run-opened/tests/bigbox-store-picker-kept.spec.ts`, `runtime/tests/opened-tab.spec.ts` and `runtime/tests/navigate.spec.ts`.

- None of them opens a synthetic page.
- They open only auction-marketplace, bigbox-retail, crossborder-marketplace and everything-store.
- They matched only on the word "navigation". I did not edit them.

How the retargets were built:

- **Site traps.** The specs answer consent walls, prompts, docks, soft checks and the promo through each scenario's own `/api/<id>/<op>`, as a returning visitor would have answered them.
- **No injected markup.** No spec adds markup to a page.
- **Passive listeners.** Three new tests attach a passive listener: one records input values, two count clicks. These listeners do not change what the page does.
- **Helpers.** Each spec keeps its own small `mutate` helper, the same pattern the content specs use. I added no shared module.

### Hooks needed for the Blocked parts (scenario-lab, for the lead to add as armable variants)

1. **Native typed inputs.**
   - Need: `type=number|date|time|month|week|datetime-local` fields in a realistic form.
   - Example: a company-website quote-drawer variant asking "Preferred visit date/time" with date, time, week, month and datetime-local fields, plus a number "How many radiators?".
   - Alternative: bigbox-retail pickup scheduling with a date and a number quantity.
2. **Edits the page refuses.**
   - A field whose keydown handler refuses a character, such as a numeric quantity refusing ".".
   - A field whose input handler forces the old value back.
   - A field whose `beforeinput` handler is cancelled.
   - A field that reverts on change, both after a `setTimeout` and after a microtask. Realistic forms of this: a promo code the site rejects, a quantity clamped back.
   - A field that is replaced by a fresh node on input or change.
   - A field covered by a site dialog right after its change, where Enter must then not reach the field.
3. **Read-only field in light DOM.** local-classifieds has `kf-location`'s readonly Location input, but it sits inside an open shadow root. The worker's `selector` does not pierce shadow roots (`content/element-finder.ts` has no shadow syntax), so the test needs a read-only field in light DOM.
4. **Checkbox behaviours.**
   - A controlled checkbox, where click changes app state and the change event sets `checked` from that state, as React-style sites do.
   - A checkbox whose change handler unticks it, both synchronously and after a microtask.
   - A checkbox replaced by an unticked clone on change.
   - Candidate site: everything-store cart line "Select <title>" re-renders the cart with `innerHTML`. I did not try it, because it reflects the new state rather than reverting.
5. **List that updates in place.** A results list whose Next rewrites the existing row nodes in place, keeping the same elements with new text and href, then disables Next. For example, a professional-network people-paging variant that patches each `li[data-urn]` instead of replacing the list's `innerHTML`.
6. **user-script-feasibility.**
   - Missing: a realistic route served with a strict page CSP (`default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'self'`) that still carries an inline script. The probe proves page scripts did not run by checking that the inline script's side effect is absent. Example: an everything-store printable order receipt.
   - Missing: a Lab control endpoint that counts requests per path and query (for example `GET /__control/requests?path=`), for the fetch, image and navigation probes.
   - Already available: the page-world isolation check can use `window.storeModals` on everything-store, and the Lab already accepts `localhost` as the ungranted second hostname.
   - Every realistic page currently gets the Lab's own CSP (`script-src 'unsafe-inline'`, `connect-src 'self'`). The scenario frames' CSPs are no stricter.

## Commands run and observed results

All commands were run from `apps/extension` unless a different directory is named.

- From the repo root: `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` printed `extension build: e2e-chromium: verified 22 files`.
- Final combined run of every changed spec, which took 4.3m:
  `pnpm exec playwright test -c e2e/playwright.config.ts e2e/action.spec.ts e2e/install-and-content.spec.ts e2e/runtime/tests/browser-navigation-readiness.spec.ts e2e/runtime/tests/meaningful-assert-wait.spec.ts e2e/runtime/tests/requests-settings.spec.ts e2e/runtime/tests/sanitized-field-typing.spec.ts e2e/runtime/tests/typed-browser-readiness.spec.ts --headed --workers=2`
  printed `3 failed, 12 passed`. The failures:
  - `meaningful-assert-wait`: the product defect below.
  - The unchanged Blocked `native numeric` test: 30 s timeout.
  - The unchanged Blocked `semantic mutation` test: "Tearing down extensionSession exceeded the test timeout of 30000ms".
- The three Blocked, unchanged tests rerun with more time:
  `... typed-browser-readiness.spec.ts sanitized-field-typing.spec.ts -g "semantic mutation|controlled check|native numeric" --headed --workers=2 --timeout=120000`
  printed `3 passed (2.1m)`.
- A HEAD copy of `typed-browser-readiness.spec.ts`, temporarily restored and then put back, run `--headed --workers=1`: `1 failed, 1 passed`. The first test failed on teardown at 30 s. So the 30 s budget problem was already there before this task.
- A HEAD copy of `sanitized-field-typing.spec.ts`: `1 passed (51.4s)`; the test itself took 46.5s.
- A HEAD copy of `meaningful-assert-wait.spec.ts` (the synthetic page): `1 passed (57.5s)`.
- The retargeted `meaningful-assert-wait` run 3 times, with and without consent answered: failed each time, wait refusals at 2258–2577 ms. A debug print, since removed, showed:
  - `wait-*`: `{"category":"action_failed","code":"web.action.failed","retryable":true, "actual":"The \"present\" wait condition needs a selector or text to wait for.; the execution did not recover within its 3 attempts after absorbing action_failed, action_failed, action_failed, waiting 750 ms"}`
  - Assert refusals: `web.validation.state_mismatch`, `retryable:false`, 1257–1410 ms.
- `pnpm exec playwright test -c e2e/user-script-feasibility/playwright.config.ts` printed `2 skipped`.
- From the repo root: `node scripts/structure-audit.mjs` printed `structure-audit: passed (215 warning(s), 635 baselined)`, with no line naming my files, plus "1 baseline entries can be lowered" (not mine to record).
- Dropped attempts:
  - A crossborder-marketplace "unchanged Next" test answered `moved`. `follow-next.ts` takes a script's Next to the pager's following number, by design.
  - A professional-network "Show more" test answered `moved` with 20 rows. The step pressed the page's own Retry.
  - Both are replaced by the photo-social test.

## Not verified

- I did not run a whole-package typecheck; the brief leaves it to the lead. Playwright transpiled and ran every changed file.
- I did not run the cancellation specs, which are unchanged.
- I did not run the user-script probe with `FLUXIQ_USER_SCRIPT_PROBE=1`, because it is unchanged and needs branded Chrome and Edge.
- No Firefox run, and no unit tests: I moved no logic to a unit test.

## Open questions or contradictions found

1. **Product defect: a malformed `web.dom.wait_for_text` is retried instead of refused.**
   - Cause: `src/content/action-runtime/wait-conditions.ts` `requireText` throws a plain `Error`. The recovery ladder classifies it as a retryable `web.action.failed` and retries it three times, waiting 750 ms.
   - The malformed `web.dom.assert` instead returns a non-retryable `web.validation.state_mismatch`.
   - On the old synthetic page the base cost per action was small, so the retried refusal stayed under the spec's 2 s bound. On a realistic page it does not.
   - Fix: return the wait refusal as a non-retryable validation failure, as `assert.ts` does. That is in extension `src/**`, outside my paths. I kept the spec's bound rather than loosen it to hide the defect.
2. **The config's 30 s timeout is too tight on this machine under load for the runtime specs.** The first test in a worker builds the harness bundle and launches the extension, and so fails on teardown; a HEAD copy did the same. My new tests set their own timeouts (60–90 s).
   - Suggested change to `e2e/playwright.config.ts`, which I must not touch: `timeout: 60_000`.
   - Alternatively, add `test.setTimeout(60_000)` to the three Blocked tests when they next change.
3. **Another worker's edit.** `apps/extension/e2e/fixtures/extension-context.ts` shows as modified (6 lines added). I did not edit it; another worker did.
4. **Passive listeners.** The new tests attach passive event listeners to observe typing and presses. If the lead's Wave C spec scan should forbid even passive page instrumentation, those three tests need another way to observe.
