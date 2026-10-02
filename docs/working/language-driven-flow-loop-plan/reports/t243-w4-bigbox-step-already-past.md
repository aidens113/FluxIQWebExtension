# t243-w4: bigbox-retail, a pickup-cart step the site has already done

## Outcome

Done. bigbox-retail's primary workflow (the pickup cart) now has a variant, `store-remembered`, armed by `{ operation: "remember-pickup-store" }`. In it the site already remembers Millbrook Crossing Supercenter, so the recorded `choose-millbrook` press has no control to land on. The armed start page is byte-for-byte the page the base site shows right after that press. The tests were written first and failed before the change; they pass after it.

## What changed and why

**Step chosen: `choose-millbrook`**, which targets `vr-fulfillment-picker li:has(strong:text-is("Millbrook Crossing Supercenter")) button`. Reasons:

- "Switch my pickup store" is the task's first clause. A retailer remembering your store from an earlier visit is the most common real case of a step the site has already done.
- On the base site the step's client handler is `mutate('set-store')` then `location.reload()`. Every step before it is a click or a wait on the start page, so the step ends on the start path with no client-only state left behind. A server state with `storeId = 1187` therefore reproduces the post-step page exactly.
- The step changes nothing except the store. The cart, consent and promo are untouched, so the oracle (`PICKUP_CART_FACTS`) and the playback goal are unchanged.

Files changed, all under `apps/scenario-lab/src/scenarios/bigbox-retail/`:

- `catalog/stores.ts`, `catalog/index.ts`: added `PICKUP_CART_STORE_ID = "1187"`.
- `state/mutate-state.ts`: new arm `remember-pickup-store`, which returns `{ ...createBigboxState(state.mode), storeId: PICKUP_CART_STORE_ID }`. Like `set-mode`, it starts the shopper over and does not log to `activity` (there is now an `ARM_OPERATIONS` set), so the armed state equals base plus `set-store` exactly.
- `manifest/store-remembered-variant.ts` (new): `STORE_REMEMBERED`. Its `pageFacts` are the store chip reading Millbrook and the leftover cart "1 item · Subtotal $3.97". Its `finalState` is `PICKUP_CART_FACTS`.
- `manifest/expected-values.ts`: added `REMEMBERED_STORE_FACTS`.
- `manifest/manifest.ts`: `variants: [REDESIGNED_BUY_BOX, STORE_REMEMBERED]`, and the doc comment mentions the new variant.
- `manifest/index.ts`: barrel exports for the new names.
- `tests/store-remembered.test.ts` (new, 5 tests):
  - the variant is declared, its arm is right, it resolves, and its afterArm facts are correct;
  - on the base site, Millbrook's card has the `Set as my store` button;
  - when armed, Millbrook's card has no button and reads "Your store";
  - the armed start page equals the base site after the step, checked by path (no earlier step navigates, and the step reloads) and by control names (buttons, links and fields by name). The full HTML is also identical, both on a fresh visit and after the opening steps. The unarmed start page differs;
  - arming resets a dirty state.
- `tests/scenario.test.ts`: the manifest test now expects `["redesigned-buy-box", "store-remembered"]` and also resolves `{ variantId: "store-remembered" }`.

## Commands run and observed results

Run in `apps/scenario-lab` of this tree unless noted.

- **Before the change:** `node ../../scripts/build-cache/cli.mjs test-contracts:build && node scripts/build-scenario-lab.mjs` built in 12.4 s. Then `node --test dist/scenarios/bigbox-retail/tests/store-remembered.test.js` gave `# tests 5 # pass 1 # fail 4`:
  - test 1: `AssertionError 'the primary workflow declares store-remembered'`;
  - tests 3 and 4: `TypeError "Cannot read properties of undefined (reading 'arm')"`;
  - test 5: `AssertionError` (an unknown operation leaves the state dirty);
  - test 2 passed: the base site has the control.
- **After the change:** `node scripts/build-scenario-lab.mjs` built with no output. Then `node --test dist/scenarios/bigbox-retail/tests/store-remembered.test.js dist/scenarios/bigbox-retail/tests/scenario.test.js dist/scenarios/bigbox-retail/tests/person-check.test.js` gave `# tests 22 # pass 22 # fail 0`, duration 942 ms.
- **Shared tests over every manifest and the live catalog** (none import Playwright): `node --test dist/scenarios/tests/*.test.js dist/tests/*.test.js` gave `# tests 42 # pass 42 # fail 0` in 2.6 s.
- **Typecheck:** `pnpm run check` (tsc src plus tsc e2e) finished in 19.2 s with no diagnostics. The build-cache line was `"step":"scenario-lab:check" ... "ms":18106`.
- **Structure audit:** `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (157 warning(s), 118 baselined)` in 8.6 s. Grepping its output for "bigbox" found nothing.

## How variants are armed (read-only answers from packages/test-runner and testing-facility.md)

- **The recording lane never arms.** It always records the workflow unarmed (`packages/test-runner/src/lab-control/arm-variant.ts` doc comment). Arming is `POST /api/<scenario>/<operation>` with the controller token.
- **The existing and clone lanes arm before the page opens** (`run-scenario.ts` around line 276: `if (workflow.variant && !flowLane) armScenarioVariant(...)`).
- **The two Flow lanes arm inside `prepareFlowPage(moment)`,** before every exploration and every run (`run-scenario.ts` lines 286-306).
  - The recorded-Flow lane (`--flow`) records unarmed, then runs the Flow it built against the armed page. That is "built on base, playback meets the variant", with no provider.
  - The created-Flow (live) lane arms at both moments, except for a task with `variantArmedAfterBuild: true`. There, `unarmedBuild = moment === "build" && creation?.task.variantArmedAfterBuild === true` keeps the build unarmed and arms only for playback.
- **An existing mechanism already arms only for playback, after a build:** `LiveInstructionTask.variantArmedAfterBuild` (`packages/test-runner/src/flow-lane/creation/instruction-task.ts` lines 31 and 142-156; it requires a `variantId`). bigbox already uses it for `redesigned-buy-box` and `list-layout`.
- **Lab commands:**
  - Provider-free, recorded Flow meets the variant: `pnpm lab run bigbox-retail --flow --variant store-remembered`. This follows the documented `pnpm lab run auth-gate --flow --variant expired`, testing-facility.md:1057.
  - Live, built from chat on the base site with playback armed: this needs a catalog row, which I did **not** add (see Open questions). With the row in `live-tasks.ts`, the command is `pnpm lab:campaign bigbox-retail-pickup-cart-store-remembered-after-creation`. The row would be:

    `{ id: "bigbox-retail-pickup-cart-store-remembered-after-creation", scenarioId: "bigbox-retail", variantId: "store-remembered", variantArmedAfterBuild: true, kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" }`
- **testing-facility.md line 984** (the bigbox-retail row of the scenario table) lists the variants. In its third column, after "variant `redesigned-buy-box` (repair);", add: "variant `store-remembered` (step already done: the site remembers Millbrook, so `choose-millbrook` has no target and the page already shows its result);".

## Not verified

- Nothing ran in a browser: no Playwright, no Lab run, no provider call. `tests/browser-paths.test.ts` uses Playwright and was not run, and neither was the full `pnpm test` (it includes that test).
- The `--variant store-remembered` CLI selection on bigbox's primary workflow was not exercised. The manifest only resolves it through `resolveScenarioWorkflow` in a unit test.
- Whether Core's state routing actually matches the next node's recorded pre-state on this page is untested. The fixture only guarantees identical server HTML.

## Open questions or contradictions found

1. **Open flyout at routing time.** The recorded step before `choose-millbrook` is `open-store-picker`, which clicks the store chip. The chip is still present in the variant, so a replay opens the flyout first and only then finds `choose-millbrook` absent. At that moment the live page has the picker flyout open (client state: `hidden` removed, so three "Set as my store" buttons and the tabs are visible). The recorded pre-state of the step after `choose-millbrook` is a freshly reloaded page with the flyout closed. If Core's pre-state signature counts only visible controls, the two may not match until the flyout is closed. Options:
   - Core treats this as a match;
   - routing triggers on `open-store-picker`'s pre-state instead;
   - change the variant so the chip itself is gone. I did not do this: it would make the armed page differ from the post-step page and would be unrealistic, since real sites keep the chip.

   The supervisor should decide this against the routing design.
2. **The live catalog row was not added.** I left it out even though `live-tasks.ts` is inside my owned directory, because the brief asked only for the manifest variant and the row widens the live corpus. The exact row is given above.
3. **Untracked changes from other workers.** The tree had changes under `domain/src/runtime/**` and a `docs/working/.../t243-state-routing-runtime.md` report that I did not make. I did not touch them.
