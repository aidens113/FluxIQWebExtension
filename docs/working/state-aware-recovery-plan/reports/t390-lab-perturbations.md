# t390 B6-perturbations: worker report

## Outcome

Done. All three items are complete:

- Item 1: every acceptance-matrix row has a confirmed site and switch.
- Item 2: the switches for rows 4 and 5 are built on `crossborder-marketplace` and covered by its scenario tests. A headed, provider-free check showed each one at the chosen point.
- Item 3: rows 9 and 11 are written up as feasible, with the mechanism and where each would live. Neither is built.

Nothing is committed.

## What changed and why

**The switch** is new, in `apps/scenario-lab/src/scenarios/crossborder-marketplace/state/interruption.ts`. It is an optional `interruption` field on the existing `set-mode` arm, so it can be added to any mode:

- Shape: `{ page: home|search|item|cart|checkout, visit: 1..50, dismiss: closes|inert, delayMs?: 0..10000 }`.
- What it shows: the store's known flash-deal promotion, using the same markup as the existing `flash-deal` variant.
- When it shows: over the `visit`-th load of `page`, and over every later load of that page until it is closed.
- Timing: it opens at load (`delayMs` 0), so it is on the page before any step on that page runs.
- `inert`: the close glyph takes the click and does nothing, and the server refuses the close operation too. The extension's rung-0 clearer matches `×` (`CLOSE_GLYPH` in `vocabulary.ts`), so it presses the glyph and nothing happens. That is the row 5 condition.
- An arm payload the switch cannot read leaves the state unchanged, the same as an unknown mode.

**Counting page loads.** Each load is counted on its route mutation:

- `page-view` now carries `{ kind }`. The four calls in `route.ts` were changed to pass it.
- `search-load` counts search pages.
- `beacon` counts the home page.

**Wiring:**

- `state/types.ts`, `state/create.ts` (`interruption: null`), `state/index.ts` and `state/mutate.ts` (`setMode`, the new `interruption` close operation, and the counters).
- `markup/overlays.ts` adds the `fb-tpl-interrupt` template, and `markup/shell.ts` adds `boot.interruption`.
- In `client/shell-script.ts`, the flash-deal stamping moved into one `openFlashDeal(templateId, onClose)` used by both the old variant and the new switch. The old variant behaves as before; its browser test still passes.

**Variants.** Three new ones in `manifest/manifest.ts`; their arms live in `manifest/interruptions.ts` (`INTERRUPTIONS`):

| Variant | Where it shows | Dismiss | Expected outcome |
| --- | --- | --- | --- |
| `flash-deal-on-arrival` | First home page load (before the first action) | closes | Same as `flash-deal` |
| `flash-deal-second-item` | Second product page load (a chosen loop pass; the recorded path never meets it) | closes | Same as `flash-deal` |
| `flash-deal-stuck` | Every product page from the first | inert | Declared failure `unexpected_state` / `web.target.not_actionable`; final state cart 0, no coupons, no orders |

**Tests:**

- New `tests/interruption.test.ts` (5 tests): arm validation and reset, before the first action, the chosen loop pass, the inert close never landing, and the switch off under every existing mode.
- `tests/scenario.test.ts`: the manifest test now expects six primary variants, the interruption arms, and the stuck variant's declared failure.
- `tests/browser-harness.ts`: new `armVariant(variantId)`, which arms through `/__control/arm`, the same path the Lab uses.
- `tests/browser-paths.test.ts`: three browser tests.
  - On-arrival: the deal is visible within 1 s of DOM ready, before the welcome coupons, and it covers Accept all. Closing it, then running the full recorded path, meets the goal.
  - Second-item: the first product page is clear. Reloading shows the deal at load, and closing it, then running the rest of the path, meets the goal.
  - Stuck: three presses on the glyph leave it visible, Add to cart is still under the scrim, a reload brings it back, the cart stays empty and the switch status stays `waiting`.

**Outside the owned paths, two edits:**

- `apps/scenario-lab/src/scenarios/tests/live-repair-tasks.test.ts`: one `EXCLUDED_ROWS` entry for `crossborder-marketplace/primary/flash-deal-stuck`. That test requires every row declared to fail to be classified, and this row is neither a repair task nor a refusal task.
- `docs/architecture/testing-facility.md`: the crossborder row of the realistic-scenario table now describes the switch and its three variants.

## Per-row assignments (item 1)

| # | Site and switch (confirmed) | Notes |
| --- | --- | --- |
| 1 | crossborder primary (hub-to-cart), lane A's saved Flow, unarmed | No switch needed. |
| 2 | bigbox `store-remembered` | Exists: `choose-millbrook` has no target and the page already shows its result. |
| 3 | bigbox `pickup-towels` (nine listings over two filtered pages), page 2 by the Next arrow that drops the filters | Exists in the baseline site; no variant needed. |
| 4 | Before the first action: crossborder `flash-deal-on-arrival` (new). Midway: crossborder `flash-deal` (1.5 s after the product page loads, while options are chosen). Chosen loop pass: `flash-deal-second-item` (new). Also everything-store `deal-wheel` (first results page). | Any other page or load can be armed ad hoc through `/api/crossborder-marketplace/set-mode`, but only declared variants map to a variant id. |
| 5 | crossborder `flash-deal-stuck` (new) | Inert close glyph, close refused by the server, comes back on every product page load. |
| 6 | crossborder `flash-deal` or `flash-deal-on-arrival`, with hand-authored node and automation handlers | Same promotion as rows 4 and 5, so one handler definition serves rows 4 to 6. |
| 7 | bigbox, two parts, hand-authored | The trigger can be bigbox's email offer, which opens over a scrim on every page load until it is closed. The inactive part (store choice) registers a handler for it; the active part (adding items) must not run it. |
| 8 | bigbox `redesigned-buy-box` with a **single-size** listing. Primary way: open the listing and press `testid:atc` (gone under the redesign). Alternative: the results tile's `+ Add` quick-add. Both run the same check: the item is in the cart at the shopper's store. | See the row 8 notes below. |
| 9 | social-network-feed `confirm-requests` (confirm is the committing act) | Not built; see the feasibility notes. |
| 10 | social-network-feed `confirm-requests`, with its confirm rate limit (`CONFIRM_RATE_LIMIT`, at most 3 confirms in 15 s) | Exists. |
| 11 | crossborder primary, stopping the worker on the `add-to-cart` act (or social-network-feed confirm) | Not built; see the feasibility notes. |
| 12 | crossborder `basket-redesign` or bigbox `redesigned-buy-box` | Both exist, and both have repair tasks. |
| 13 | social-network-feed confirm rate limit handled by an authored On Fail path, plus an authored deliberate stop | Exists. |

**Row 8 notes.** bigbox shows a quick-add only for single-size products (`listing/tile.ts:24`); multi-size products get `Options` instead. Quick-add and the product page preselect the same fastest fulfilment (`catalog/fulfilment-text.ts:25`). The redesign renames the product page and theme classes but leaves the tile `+ Add`, as the code reads. The primary workflow's towels and napkins are multi-size, so the recorded task has no second way.

Minimal addition: none on the site. A hand-authored Flow on any single-size listing is enough. If the Flow should start from the recorded primary task instead, the alternative would need a quick-add for a chosen size, which is a fixture change. everything-store also has two ways for products without a family (the results card's `Add to cart` and the product page), but no variant breaks its product page, so it cannot produce "primary way fails".

## Feasibility notes, rows 9 and 11 (item 3; not built)

**Row 11: stop the extension's service worker mid-action. Feasible.**

- **Mechanism.** In `packages/test-runner` there is already a CDP session on the context. `extension-start-trace.ts` opens it and uses `Target.getTargets` / `Target.attachToTarget`. That session (or `browser.newBrowserCDPSession()`) can find the extension's `service_worker` target and call `Target.closeTarget({ targetId })`. That is the call behind Puppeteer's `worker.close()`, which Chrome's extension docs use to test service-worker termination. A fallback is `ServiceWorker.stopAllWorkers` from a CDP session on an extension page.
- **Timing.** Use the fixture's own committing request as the trigger. For example, on `page.on("request")` for `/api/crossborder-marketplace/add-to-cart` (or social-network-feed's confirm operation), close the worker before the response returns. The act then lands on the site while the worker dies before reporting it.
- **Where it would live.** A run-scoped perturbation in `packages/test-runner`, for example `src/perturbations/stop-worker-on-act.ts`, chosen by a run option that names the scenario operation. It cannot be a scenario variant, because the Scenario Lab server has no handle on the browser.
- **Risks.**
  - The network guard's worker proof (`network-guard.ts`) must accept a worker restart.
  - `extension-readiness.ts` must observe the restarted worker.
  - The t174 note in `network-guard.ts` says that evaluating into a half-started worker crashed the renderer. A restart therefore has to wait for the worker's scope again before any probe.

**Row 9: drop the acknowledgement after one committing act. Feasible. Two routes:**

- **(a) Gateway relay (preferred).** The coordinator gives the extension `ws://127.0.0.1:<gatewayPort>/client` (`coordinator.ts:175`). A loopback WebSocket relay on its own allocated port would sit between the extension and the gateway:
  - It forwards every frame, remembers the command id of the next `execute_action` whose action is committing, and drops exactly that command's `client.action_result` frame. The connection stays open.
  - It would live in `packages/test-runner`, for example `src/perturbations/ack-drop-relay.ts`, and be armed per run.
  - The relay's origin must join the guard's `gatewayOrigins`.
  - It must never log frame bodies, because the pairing token and page data pass through it.
- **(b) Same trigger as row 11.** Stopping the worker on the committing request also loses the acknowledgement, but it tests restart reconciliation rather than a lost frame on a live connection.

Playwright's `context.routeWebSocket` was not considered reliable for a service worker's socket. `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` is documented in the code for HTTP routes only, and this was not tested.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/scenario-lab check` (both tsc projects): exit 0, no diagnostics. The build-cache line reported `"step":"scenario-lab:check" ... "ms":30503`.
- `node ../../scripts/build-cache/cli.mjs scenario-lab:build`: rebuilt, `"inputs changed: apps/scenario-lab"`.
- `node --test` on the dist builds of `crossborder-marketplace/tests/{scenario,interruption,live-tasks,person-check}.test.js` and `scenarios/tests/{live-repair-tasks,live-instructions,realistic-site-live-tasks}.test.js`: `# tests 43 # pass 43 # fail 0`.
- `node --test dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js` (headless, whole file): `# tests 17 # pass 17 # fail 0`. This includes the old `flash-deal` test and the three new ones.
- `node --test dist/tests/registry.test.js dist/tests/state-store.test.js`: `# tests 13 # pass 13 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (184 warning(s), 257 baselined)`, the same counts as before the change.
- Headed, provider-free check. Script: scratchpad `t390-headed-check.mjs`. It started the Scenario Lab, launched visible Chromium with no extension and no provider, armed each variant through `/__control/arm`, and took screenshots in scratchpad `t390-shots/`. Observed:

| Variant | Arm status | What happened |
| --- | --- | --- |
| `flash-deal-on-arrival` | `armed` | Deal visible on the home page 200 ms after DOM ready, with the welcome modal not yet shown. The glyph closed it, and the switch went to `closed` after 1 load. |
| `flash-deal-second-item` | `armed` | Home: not visible. First product load: not visible. Second product load: visible 46 ms after DOM ready, switch `loads: 2`, `waiting`. |
| `flash-deal-stuck` | `armed` | First product load: visible at 75 ms. Still visible after three glyph presses. Visible again 36 ms after reload, switch `loads: 2`, `waiting`. |

## Not verified

- No extension or Core run against the new variants. The claim that the extension's clearer presses the inert glyph and the run ends with `web.target.not_actionable` comes from reading `vocabulary.ts`, not from a run. The declared failure category should be confirmed by the first provider-free Lab run on `flash-deal-stuck`.
- Row 8's quick-add path under `redesigned-buy-box` was read from the code, not run in a browser.
- Rows 9 and 11 are untested design notes: `Target.closeTarget` on an extension worker in this Chromium build, and the relay.
- No full suites were run, and `packages/test-runner` tests were not run. Those that list manifests stub the registry.

## Open questions or contradictions found

- The brief says to run "vitest on the scenario's tests", but scenario-lab tests use `node:test` on the built `dist`. I ran them that way.
- The overlay comment in `markup/overlays.ts` says the overlays carry no test ids, so the stuck variant's final-state facts cannot assert "popup still showing" through the Lab's fact probe. They assert the flyout facts instead (cart 0, no coupons, no orders). If R2 wants the trace to prove that the interruption was still standing, it needs a test-id-free fact kind (B1's `dialog` fact) or the switch state from `/__control/final-state`.
- The consent banner paints above the flash-deal scrim, as it already does for the existing `flash-deal` variant. On the on-arrival variant, Accept all is reported under the scrim at its centre point, so this did not affect the tests.
