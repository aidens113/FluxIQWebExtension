# Provider-free click effect observation

Status: reproduced fixture behavior; read-only product source, no paid launches.

## Scope and result

Supervisor authorized after failed round-six B full report: actual compiled realistic bigbox-retail fixture, fresh isolated headed Chromium profile, first two normal pointer clicks on existing Add button; no model, Core host, extension, panel, source edits, or changed guards. Result does not independently prove the extension action event path caused the live failure.

Actual compiled `apps/scenario-lab/dist/server.js` started directly with random in-memory run token and seed1. Authenticated ordinary control arm selects bigbox-retail/store-remembered; token never printed/saved. Browser visits home, normally dismisses consent/signup, then requested towel product variant. Availability settles1500ms; no script sets wake, cart, quantity, DOM, or input events. Existing `data-testid=atc` is clicked through Playwright Locator.click twice; no force or JavaScript click. Typed final-state observations and request-count listener collect quantities/sequence only.

| Observation | awake | towel quantity | total quantity | mutation sequence | add requests | Continue visible |
| --- | --- | --- | --- | --- | --- | --- |
| Before | false |0|1|3|0|false |
| After first normal pointer click | true |0|1|3|0|false |
| After second normal pointer click | true |1|2|4|1|true |

First click also lacks Added-to-cart confirmation. StoreId1187 stable. Nativeexit0; fixtureFirstClickNoEffect=true/fixtureSecondClickAddsOne=true. No provider wiring/imported model or Corehost/extension launched; providercalls0. Headed bundled Playwright Chromium; exact browser version was not captured (persistent context browser() returned null). Profile retained, context and fixture servers closed normally.

## Evidence and replay instructions

Ignored driver: `C:/Users/osrs_/FluxStuff/fxwork/t262/b-round6-click-effect-probe.mjs`.
Proof: `test-runs/instances/t262-slot-3/probes/click-effect-1791781090123/proof.json`.
Retained profile: same directory `/profile`.
Reproduction from t262 downstream PowerShell: `$env:FLUXIQ_TEST_ENV_FILES='none'; node 'C:/Users/osrs_/FluxStuff/fxwork/t262/b-round6-click-effect-probe.mjs'`. It allocates a new probe directory/profile and closes only its own browser/server. Browser child env uses existing withoutProviderSecrets; no env files loaded. Do not open secret values, page bodies or browser state in stdout.

Compiled artifact SHA256:
- client/shell-script.js:44973e269c8fec63302931dac7ee8591b42d116e82c1f3b8132a4745394dd785
- client/product-script.js:bc4c67eba6c86db628308f834bc92f72ed63821cec196b855123834dc92d2be7
- state/cart-operations.js:b75f05bf7fbf1ffe4616be9825cd5dfa7fd0da3752da628930d53e8e721b4f10

These are current owning compiled fixture output validated before round-six launch. No sources regenerated or modified for probe.

Initial probe `click-effect-1791781073713` failed during setup before observations because driver incorrectly supplied a live task ID as workflowId. Removed that invalid setup parameter and used supported variant-only control arm. Its empty failed evidence directory remains retained; it is not product failure evidence or a paid relaunch. No browser-profile reset.

## Owners and interpretation

Source owners: `apps/scenario-lab/src/scenarios/bigbox-retail/client/shell-script.ts:44` initializes awakefalse; `product-script.ts:93` exits before mutation when first wake returnsfalse; `state/cart-operations.ts:24` increments an existing same-SKU/method line after valid adds. Probe demonstrates those exact shipped wake semantics. A click dispatch/hit-test success cannot alone establish a lasting effect; the site may consume the interaction without acting. Do not patch fixture or teach a scenario-specific extra click.

Live B saved step54 first add reports hit-test passed, step55 continuation missing and captured baseline$3.97/noAddedconfirmation; second add step56 reports passed and next continuation exists; final exact cart has one towel. This matches independently reproduced fixture behavior, strongly supporting wake as mechanism. However probe does not load extension, exercise its target/read/validation APIs, establish exact event ordering inside original browser, or qualify saved Flow. An exact extension-control probe or existing recorded attempt-state evidence would be needed for the stronger causal claim. No new source behavior proposed here.

Three semantic judges also accepted incomplete/stale state. Their evidence gap is separately documented in `live-b-round6.md` and full run debug; fixture wake explains how action dispatch can differ from effect, not why every judge answered yes. B first creation still failed/no replay or second launch; source freeze remains while C active.
