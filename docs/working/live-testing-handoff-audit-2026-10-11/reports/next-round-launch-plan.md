# Next changed-source B/C/D launch plan
Status: Complete
Status detail: Read-only command reconstruction; no launch/build/readiness execution or approval implied.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: B-debug worker

## Current State
Next source pair is NOT yet frozen. t459 passive result observation and t454 recording repair remain isolated; supervisor must finish independent gates/integration and decide the relevant changed-source pair before launching. This report does not authorize an unchanged relaunch. Existing B/C/D round-six failures and full debug are retained. Only this new report in retained t262 was written; no source/env/profile/task/oracle/branch changes, tests, builds, ready checks, browser/provider calls, panel management, commits/merges/pushes.

## Budget meaning and source proof
Prominent limitation: --llm-max-run-tokens48000000 is an explicit Lab whole-run reporting/check bound. live-llm/live-llm-plan.ts documents it as the Lab POST-RUN token check; this source review does not establish a cumulative pre-dispatch token reservation. It does not shrink requests to fit residual run tokens. Keep actual initial chat versus build/verification accounting separate; the64call setting is passed to the authoring build budget, not evidence that all observed test calls including initial chat total at most64. Prior C/D48buildcalls plus initialchat made49whole-testcalls. Whole-test cost and token totals still need independent reconciliation.

Source trace: scripts/lab/live-campaign/arguments.mjs passes Lab options after -- unchanged and refuses only its own identity/task options there. lab-run/command.mjs removes a default CREATE_LIMITS option when labArgs names it, so --llm-max-calls64 replaces48 instead of appearing twice. --llm-max-run-tokens has no campaign default, so explicit48000000 survives. packages/test-runner/src/commands.ts reads it with optionalIntegerOption, then stores budget.maxTotalTokensPerRun unchanged. test-contracts/src/llm-validation.ts accepts a run cap from one full request through perRequest*calls, up to absolute64million. live-llm-plan.ts runTokenBudget returns min(declared,perCall*calls): min(48000000,1000000*64)=48000000. Declaration is a safe integer, at least1000000 and below64000000; therefore it is retained by this resolver, not widened to64000000. This is source/math confirmation, not executed resolver/preflight proof.

Preserve existing declared per-request limits: input992000, output8000, total1000000. The output value is the existing Lab declaration, not a new provider-output override. No provider retries introduced; existing profile maxRetries0 remains. Do not increase maxCalls beyond existing contract/Core64backstop. Cost launch-process environment0.25 is required; --llm-max-cost-usd0.25 alone cannot raise configured Core ceiling. Both plan purse fields maxEstimatedCostUsd and maxTotalEstimatedCostUsd must be0.25, with buildCostCeilingUsd0.25. No product default/.env modification.

## Retained lane identity

| Lane | Downstream directory under C:/Users/osrs_/FluxStuff/fxwork | Instance / slot / persistent workspace | Original task | Instruction chars / SHA256 |
| --- | --- | --- | --- | --- |
| B | t262/!FluxIQWebExtension | t262-slot-3 /3/ t262-b | bigbox-retail-pickup-cart-store-remembered-after-creation |330/8da0b9f6e700f4367a83ff2c1f01fb0c5e105d52947bf17b298357fbf4dc43d3 |
| C | t451/!FluxIQWebExtension | t451-slot-1 /1/ t451-c | everything-store-plus-earbuds-under-50 |415/d4f7835b8fc63ee857b5c15bd6a01f1f08fe3df19446153ad0f443045fd087ef |
| D | t275/!FluxIQWebExtension | t275-slot-4 /4/ t275-d | social-network-feed-confirm-requests |339/6c11d20a3be661961ff473c6c9e64c67191a8cd3756b1af7cdcdd7f97c37f8d3 |

Each Core is that downstream's sibling !FluxIQ. Keep profiles/projects and independent original oracles. B retains store-remembered variant and task-owned variantArmedAfterBuild; C/D have no new variant. None of these original task definitions has campaign-added permits; do not add --llm-permit or altered consequences. Instructions are loaded by original instruction-task identity, not pasted/reworded.

## Owning preparation and command distinction
Supervisor synchronizes each idle paired tree to the selected changed-source pair and records both exact heads/status; workers do not merge in this brief. Build changed owning Core libraries through their owners before Lab admission; fluxiq owner command, in each paired Core, is pnpm.cmd --filter fluxiq build (use FLUXIQ_BUILD_FORCE=1 only when a forced fresh owner build is required). Contracts/client-gateway owners must have current valid stamps where reached dependencies changed. The direct Lab launcher performs downstream owning prelude and refuses missing/stale/quiescing Core. Do not bypass those checks or integrate during a streak.

A campaign-level --dry-run only lists campaign commands; it is NOT the actual zero-call Lab ready proof. Use the direct pnpm.cmd lab run ... --dry-run commands below after source/build readiness, inspect their actual ready JSON and owning artifact validators, then wait for supervisor clearance. They are documented future commands and were not executed here.

## Lane B exact future commands

```powershell
Set-Location 'C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension'
$env:FLUXIQ_LAB_INSTANCE='t262-slot-3'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_TEST_PERSISTENT_WORKSPACE='t262-b'
$env:FLUXIQ_DEMO_HEADLESS='false'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
pnpm.cmd lab run bigbox-retail --variant store-remembered --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25 --dry-run
```

After actual ready/expected-artifact supervisor review and explicit ONE-attempt clearance, in the same process environment:

```powershell
pnpm.cmd lab:campaign bigbox-retail-pickup-cart-store-remembered-after-creation --authoring-mode candidate --max-attempts 1 --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash -- --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25
```

## Lane C exact future commands

```powershell
Set-Location 'C:/Users/osrs_/FluxStuff/fxwork/t451/!FluxIQWebExtension'
$env:FLUXIQ_LAB_INSTANCE='t451-slot-1'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_TEST_PERSISTENT_WORKSPACE='t451-c'
$env:FLUXIQ_DEMO_HEADLESS='false'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
pnpm.cmd lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25 --dry-run
```

After actual ready/expected-artifact supervisor review and explicit ONE-attempt clearance, in the same process environment:

```powershell
pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --authoring-mode candidate --max-attempts 1 --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash -- --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25
```

## Lane D exact future commands

```powershell
Set-Location 'C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension'
$env:FLUXIQ_LAB_INSTANCE='t275-slot-4'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_TEST_PERSISTENT_WORKSPACE='t275-d'
$env:FLUXIQ_DEMO_HEADLESS='false'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
pnpm.cmd lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25 --dry-run
```

After actual ready/expected-artifact supervisor review and explicit ONE-attempt clearance, in the same process environment:

```powershell
pnpm.cmd lab:campaign social-network-feed-confirm-requests --authoring-mode candidate --max-attempts 1 --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash -- --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-max-run-tokens 48000000 --llm-max-cost-usd 0.25
```

## Mandatory admission and actual identity proof
Inspect real ready receipt: state ready, providerCallCount0; created-flow/chat/candidate entry, persistent-isolated owning workspace, trialRunner/startReset true; original task digest/length retained; maxCalls64; declared/effective maxTotalTokensPerRun48000000; per-request992000/8000/1000000; both purse fields0.25 plus configured build ceiling0.25. No direct-api-build, no-live-panel, fresh-login/profile reset, permit addition or overrides. Headed means FLUXIQ_DEMO_HEADLESS=false. Root decides whether changed source addresses that lane's prior failure; flags alone are not a semantic repair or proof that a larger budget will pass.

After the owning prelude stops, use current compiled expectedRuntimeIdentity/expectedHostIdentity/expectedServerAdapterIdentity owners under test-runner run-scenario/browser-session to validate complete source/artifact inventories and reached extension contracts; inspect current extension build-info. Stamp files, relative to each paired owner:
- Core packages/fluxiq/dist/runtime-build-identity.json
- Core apps/web/.server-runtime/client-gateway-server.mjs.identity.json
- downstream domain/.lab-instances/<instance>/host/web-panel-host.mjs.identity.json
- downstream apps/extension/.lab-instances/<instance>/dist/e2e-chromium/build-info.json

Send current ready/artifact paths and new source pair to supervisor BEFORE any paid launch; historical round-six hashes cannot substitute. After clearance, existing automatic run-scenario gates verify actual Core/host/server around252 and actual extension around290 before real chat dispatch around404; no new pre-dispatch human pause is invented. Immediately send actual four receipt paths as written under test-runs/instances/<instance>/.staging-<runId>/snapshots/ (then published <runId>/snapshots/): running-core-identity.json, running-host-identity.json, running-server-adapter-identity.json, running-build-identity.json. All verified true/actual matches expected; extension background and content both match. These future actual identities cannot be known at plan time.

Full saved-step/call/result/judge/UI/source/cost debug and exact original oracle must finish after that single creation. On pass, separate disabled-provider replay preserves project/Flow/hash and all five model/provider/intervention/harness counters zero before root can authorize second creation on the frozen pair. Failed oracle stops even if panel/judge says Passed; failure requires complete debug and changed relevant source, not an unchanged retry with larger caps. Balance failure stops paid work globally. No qualification or persisted adaptation claim from one passing verdict.

## Read-only completion
Read authoritative brief/Current State, retained B/C/D round-six reports, actual owning campaign/parser/resolver/token validation and identity order. No executable preflight/resolver proof is claimed. Only this report was written; all discovery activity now idle, available for separately written bounded claim review. No builds, tests, providers, browsers, ready execution, source/shared-document/environment-file/profile/task/oracle/branch mutations.
