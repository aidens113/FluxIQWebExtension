# t243-w7: web state routing end to end

- Brief: t243-w7-web-state-routing-end-to-end, 2026-10-02
- Tree: `fxwork/t243/!FluxIQWebExtension`, branch `task/t243-state-routing-runtime`. Core sibling used through its built `fluxiq/automation-studio` entry.
- No source changes, no Lab, no browser, no provider call, no commits.

## Outcome

Done, with one contradiction to the brief. All three cases pass against the real code. Case (1) does not route by
`outcome: "routed"` as the brief expected. When nodes carry effects the way a build records them, it routes by
`effect_holds`. The destination is the same (step 3, forward, run succeeds). The test asserts the actual behaviour, and
a second test shows `routed` for the same Flow recorded without effects. See Open questions.

## What changed and why

The only file is a new one: `domain/src/runtime/tests/state-routing-run.test.ts`, with 4 tests and 243 lines.

**Placement.** The subjects are `runtime/host-runtime.ts` (`createWebAutomationHostRuntime`, where the four members
come from) and `runtime/route-state/` (the signer, comparator and effect it binds). The nearest directory containing
both is `runtime/`, so the test goes in `runtime/tests/`, next to `host-runtime.test.ts`.

**Harness.**

- Core's `runAutomationStudioGraph` comes from `fluxiq/automation-studio`.
- The host takes `signRouteState`, `compareRouteSignatures`, `signRouteEffect` and `routeEffectHolds` from a real
  `createWebAutomationHostRuntime`, built over a gateway that throws if it is ever reached. It is never reached.
- `observeRouteState` returns the scripted current route state and counts the reads.
- Route states have `webAutomationRouteState`'s shape: `{ page: { location, path, title, dialog?, blockedBy?, controls } }`,
  with names joined by `" | "`.
- Each node's `metadata.routeSignatures` is `{ before: sign(before), after: sign(after), effect: signRouteEffect(before, after) }`.
- The fake dispatcher fails with `webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND)`. That is
  `web.target.not_found`, category `target_not_found`, stage `target_resolution`. A step that lands moves the page to a
  scripted state.

**Cases, modelled on bigbox-retail.** The paths are the site's own: root, `search?q=`, `ip/<slug>/<9 digits>` and
`cart`. The controls are the shell's, the chip `Pickup or delivery? <store>`, the flyout's `×`, `Pickup`, `Delivery`
and `Set as my store`, and the product page's `Add to cart` and the "Added to cart" panel with `View cart` and
`Continue shopping`.

1. **Page already past a step**, a Flow of search, then open result, then add to cart.
   - Search lands straight on the product page, and open-result's target is not found.
   - Asserted: the run succeeds, the calls and attempts are `search, open-result, add-to-cart`, and attempt 2 is
     `succeeded` with route `state_routed`.
   - `skipped` is `{ reason: "state_routed", code: "web.target.not_found", toNodeId: "add-to-cart", direction: "forward" }`.
   - `stateRouting.outcome` is `effect_holds`. There is no failure or recoveryDecision, one observation, and no defence.
   - **1b, the same Flow with nodes signed but without `effect`.** It is routed by matching, and `stateRouting` deep-equals
     `{ outcome: "routed", candidates: 2, matched: 1, toNodeId: "add-to-cart", direction: "forward", closeness: 1 }`.
2. **The store is already chosen** (`store-remembered`).
   - Recorded: open the picker (Carden Falls chip, then the flyout as `blockedBy`), choose Millbrook (the picker closes
     and the chip names Millbrook Crossing Supercenter), then type the search.
   - At run time the page starts with the Millbrook chip. Opening the picker leaves the blocker and the Millbrook chip,
     and choose-millbrook's target is not found.
   - Asserted: the real comparator says the recorded type-search pre-state does not match the observed page (the layers
     differ). The run succeeds through `open-store-picker, choose-millbrook, type-search`.
   - Attempt 2 is `state_routed`, with `skipped` going forward to `type-search` and `stateRouting.outcome` `effect_holds`.
     There is one observation.
   - The serialised trace contains no `Millbrook`, `"controls"` or `"added"`.
3. **The out-of-stock twin**, a Flow of open result, then add to cart, then view cart.
   - Open-result lands on the product page without `Add to cart`, and add-to-cart's target is not found.
   - Asserted: every add-to-cart attempt is `failed` and not `state_routed`, with no `skipped`. Each has
     `stateRouting.outcome` `no_match` with `matched: 0`, `failure.code` `web.target.not_found`, and a recoveryDecision.
     No attempt in the trace is `state_routed`.

## Commands run and observed results

These ran from `domain/` unless noted.

1. `pnpm exec esbuild src/runtime/tests/state-routing-run.test.ts --bundle --platform=node --target=node22 --format=esm --external:fluxiq --external:'fluxiq/*' --external:@fluxiq/client-gateway-websocket --external:'@fluxiq/client-gateway-websocket/*' --outbase=src/runtime --outdir=.test-build-scratch/t243-w7 --out-extension:.js=.mjs`
   printed `state-routing-run.test.mjs 202.8kb`, `Done in 90ms`.
2. `node --test .test-build-scratch/t243-w7/tests/state-routing-run.test.mjs` printed `ok 1` to `ok 4`, then `# tests 4`,
   `# pass 4`, `# fail 0`.
3. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w7 check" pnpm --filter @fluxiq-web-extension/domain check`
   held slot b3. Build-cache printed `"build"` (inputs changed: core dist, core src, domain), and there were no tsc
   errors. I re-ran it to capture the exit code: `"reuse"`, `EXIT=0`. The check covers `tsconfig.test.json`, which
   compiles the new test.
4. From the repo root, `node scripts/structure-audit.mjs` printed `structure-audit: passed (157 warning(s), 118 baselined).`,
   exit 0. No finding names the new file. The only `runtime/tests` warnings are in `apps/extension`.

## Not verified

- Route states are hand-modelled on the fixture's markup, not captured from a live bigbox page through
  `webAutomationRouteState(sanitizeWebLlmSnapshot(...))`. I did not check that a real capture would name the chip
  exactly `Pickup or delivery? <store>` or put the picker under `blockedBy` rather than `dialog`. W5 used the same model.
- The build side was not exercised. Signatures were written directly, not through Core's `build-routing.ts`, so the
  digest-keyed recording path and its effect conditions are not covered here.
- In case 3, the ladder's exact course (how many retries, then the continuation rule) is deliberately not asserted.
- I did not run the full domain suite (by policy). No browser, Lab or provider call was made.

## Open questions or contradictions found

1. **Case (1) routes by `effect_holds`, not `routed`.**
   - Evidence: the real `routeEffectHolds(openResult.effect, observedProductPage)` is true. The effect's `added` holds
     product-page control hashes, and its `path` is the product path shape. The observed page is that same product page.
   - Core asks the failing node's own effect before matching pre-states (design, "Second case": order F38, then effect,
     then matching).
   - A step's after-state is the next step's before-state, so on a linear Flow built with effects, "the page is at step
     N+1's pre-state" generally also means "step N's effect holds". Routing by `routed`/matching only happens when the
     failing step's effect is absent or does not hold, for example when the page is two steps ahead or has gone back.
   - The destination, direction and success are identical either way. The lead should decide whether the design text
     or the brief's expectation needs updating. Test 1b pins the matching path.
2. Case (2) relies on choose-millbrook's effect `added` being the single chip-name hash (W5 noted this too). Any page
   whose chip names Millbrook satisfies it.
