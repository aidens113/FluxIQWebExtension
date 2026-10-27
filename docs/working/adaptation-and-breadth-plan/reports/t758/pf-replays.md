# t758 provider-free replays (pf-replays)

Tree: C:/Users/osrs_/FluxStuff/fxwork/t758/!FluxIQWebExtension, instance `t758-pf-replay`, headed, model-free (`env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_PROVIDER_KEY_FILES=none FLUXIQ_DEMO_HEADLESS=false FLUXIQ_LAB_INSTANCE=t758-pf-replay pnpm lab replay ...`). No source edited, nothing outside this tree written except copies. Receipts: `test-runs/instances/t758-pf-replay/replays/<replayId>.json`.

## Outcome

Partial. Crossborder is established: the drift is NOT absorbed. Everything-store and social have no saved Flow for the gate task or its base task, so those two are proxies only (stated per site).

## Key findings

1. crossborder basket-redesign: the unadapted Flow built on the unchanged site passes unarmed (control) and fails armed at the add-to-cart step after its first attempt plus 3 retries. Nothing absorbed it, so a paid gate run's playback will meet the drift and the repair is genuinely needed.
2. TRAP for the gate: the Flow of run-mv79nr9o-89a70c81 (the suggested candidate) is already repaired, so it is useless as a pre-drift Flow. Its step s11 carries a `target` of visibleText "Add to basket" / selector `main > div:nth-of-type(4) > div:nth-of-type(2)` (adaptation applied, revision 1 to 2, snapshots/adaptation.json). Unarmed it fails (see below); armed it passed in its own earlier replay (t418 replay-mv79t4ms-c8a3b890). So a replay of a repaired Flow measures nothing about drift.
3. everything-store deal-wheel (proxy Flow, extraction only): a Flow that only extracts and pages was not broken by the wheel (all 24 actions succeeded, 13 records same as unarmed), and the wheel was not dismissed by anything (`wheel-closed` final state did not hold). The generic runtime did not close it. But this Flow never pressed a control on the covered page, so it says nothing about a Flow that does (the gate Flow presses search). Do not read it as "deal-wheel is absorbed".
4. social regrouped: no saved Flow exists; the only available thing is the scripted base run (passed). The armed variant cannot be exercised provider-free in this tree.
5. Windows MAX_PATH trap for `lab replay` on a copied workspace: 111-char instance dir + 148-char browser-profile file path (>260) makes the extension's LevelDB fail (`Unable to create writable file ... MANIFEST`), surfacing as `gateway.connection: Extension pairing status transport failed during pre-approval`. Fixed here only by renaming the copy to a short workspace name (`es-earbuds`). Keep workspace names short and instance names short when copying.

## Saved Flows found (search of all `test-runs/instances/*` in fxwork/* and the main checkout, 337 creation-context.json)

- crossborder hub-to-cart: many. Base-task Flows with no adaptation: t563/a8-slot-1 workspace `a8e-project-crossborder-marketplace-hub-to-cart` (many projects, one per run). Chosen: run-mvbykx6v-e7cf27c4 (newest passed build), project 92d2e687-cd80-4441-b724-a9bfd9847182, flow flow.46a97464-1d7e-4c7b-a6a3-30974aa369ff, savedFlowHash 74c2eb2c..., `adaptation.json` has no adaptations. Gate-task Flows: t418-slot-3 run-mv79nr9o-89a70c81 (repaired, see finding 2), t418-proofs run-mv4itxkr-163e04a8.
- everything-store: none for `...-first-page-plus-earbuds` or its deal-wheel task (the only first-page-adjacent Flows are `everything-store-plus-earbuds-under-50`, t451/a8e runs). Chosen proxy: t563/a8-slot-1 run-mv9tx8tp-c53b0ecb, project 80f65255-34a8-4e7b-b028-2d5811002893, flow flow.d4eadfb5-25c5-444c-829b-ae5758b13914.
- social group-post: none. Only `confirm-requests`, `delete-stranger-requests`, `feed-digest`-style Flows exist for social. Task ids in run.json were matched by regex on `social-network-feed-group-post`; no hit.
- Persistent workspace store: `<instance>/persistent-isolated/<workspace>/{fluxiq-root/.fluxiq, browser-profile, .identity, scenario-port.json}`; the Flow source is `fluxiq-root/.fluxiq/artifacts/automation-studio/projects/<projectId>/flows/<flowId>*/source/flows/*.flow.ts`. Copies made with `cp -r` (sources untouched) into `test-runs/instances/t758-pf-replay/persistent-isolated/`: `adapt-crossborder-continuation-1` (from t418-slot-3, 46M), `a8e-project-crossborder-marketplace-hub-to-cart` (from t563 a8-slot-1, 403M), `es-earbuds` (from `a8e-project-everything-store-plus-earbuds-under-50`, 265M, renamed for finding 5). All Flows loaded under current code; no load error.

## Results

Zero counters in every passed/failed receipt below: `coreProviderCallCount`/`accountedCalls` 0 (null on the failures that reported no accounting), `interventions` 0, `harnessActivations` 0, `modelProvidersEnabled` false, `coreProviderKeys` preserved, `environmentCredentialVariables` empty. flowContentHash before equals after in every case that ran.

### crossborder-marketplace, unrepaired Flow (a8e, flow.46a97464...), project 92d2e687...

(a) Unarmed control, `--instruction-task crossborder-marketplace-hub-to-cart`: receipt replay-mvr8sqdc-e23de30a, verdict passed, reasons [], goal held, run succeeded, 15 actions, hash 74c2eb2c46... before and after. Step s11 (store coupon) failed once then succeeded, which is the fixture's designed "Network busy" first claim, not drift.

(b) Armed, `--instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` (variant basket-redesign): receipt replay-mvr8vedl-8c2428ef, verdict failed, reasons ["Core published no provider call accounting for the replay", "the scenario's playback goal did not hold after the Flow ran", "Core reported the run failed"]. Failure `target_not_found` / `web.target.not_found` at node s13 "add the hubs to the cart" (`[data-testid="add-to-cart"]`, fingerprint visibleText "Add to cart"). Actions 14 to 17 are s13 attempts 1 to 4 (first + 3 retries), each 4.2 to 4.3 s, each "nothing matched; 19 control(s) of the same family are on the page; best scored 0.29; did not recover within its 5 attempts after absorbing target_absent x5". Fingerprint matching did not find "Add to basket" (best 0.29), generic interruption handling did not apply. Steps s1 to s12 succeeded or were designed (s6 skipped, s11 coupon retry). `route.selectedRuleId` null, no repair, `llmGate` code llm.gate.training_mode (no model allowed). hash 74c2eb2c46... before and after. Out-of-request lasting acts: none; the Flow has no Buy now/checkout node (grep 0 hits) and the actions list contains no click after s13 failed. The coupon claim at s11 and quantity 3 are in the request.

### crossborder-marketplace, repaired Flow (t418, flow.2a225da2..., project a904b7b9...) (negative control for finding 2)

Base task, unarmed: replay-mvr7wdyb-a5845969 and, as the rerun, replay-mvr85nyb-25f47459, both failed identically: same reasons as above, `web.target.not_found` at s11 "add the hubs to the cart", 4 attempts (actions 11 to 14), hash bed6c6ec2d... before and after. Cause: the saved s11 carries the repair's `target` ("Add to basket", `main > div:nth-of-type(4) > div:nth-of-type(2)`, class css-0hem165), which the baseline site does not have (read in `flows/*graph/source/flows/*.flow.ts` of the copied workspace). Armed, the same Flow passed in t418 (replay-mv79t4ms-c8a3b890, calls 0, goal true), recorded before this tree. I did not run this Flow armed (not needed for the question).

### everything-store (proxy Flow: plus-earbuds-under-50, flow.d4eadfb5..., workspace es-earbuds)

Not the gate Flow; no first-page Flow exists.
- Unarmed control, `--instruction-task everything-store-plus-earbuds-under-50`: replay-mvr97hz2-98392cab passed, reasons [], 24 actions, 13/13 records matched, hash c5df7cf77e... before and after, calls 0.
- `--variant deal-wheel` on that task: refused before any browser: replay-mvr9bnnp-4afe45c9, error "Scenario everything-store workflow plus-under-fifty has no variant deal-wheel" (the variant belongs to the first-page workflow). So the brief's "base task plus --variant" form only works for a base task whose workflow declares the variant.
- Armed preflight via the gate task id, `--instruction-task everything-store-first-page-plus-earbuds-deal-wheel` (selects the first-page workflow, variant deal-wheel, oracle for 16 first-page records): replay-mvr9datd-5138e3d9, verdict failed, reasons ["the records the Flow stored do not match the task's expected dataset", "the scenario's final state did not hold after the Flow ran"]. Run status succeeded, all 24 actions succeeded (no step failed, no retries), 13 records observed vs 16 expected, 0 matched in order and 4 in any order. The dataset mismatch is the proxy's (different task's Flow), not drift. The final-state failure is `wheel-closed` not holding, so the wheel was left open: it was not dismissed by generic handling. The Flow only extracts and pages, which the wheel's inert page did not stop. Which step "met" the drift: none. Cannot tell from the receipt whether the wheel opened before or after the extractions. No lasting act involved.
- Earlier failures on this workspace, replay-mvr8y9me-6cb09723 and a rerun (both `gateway.connection` pairing failure): cause is finding 5, traced to the MANIFEST IO errors in `replays/replay-mvr9370l-abef16e6/extension-start.local.json` and the swallowed error at `packages/test-runner/src/run-lifecycle/pair-extension.ts:105-111` (`safeTransport` replaces any extension.worker error with the generic message). Confirmed by the workspace-rename fix, not by reading a stack.

### social-network-feed

No saved group-post Flow. Fallback per brief: `pnpm lab run social-network-feed` (scripted base recording, the group-post workflow from `manifest.ts:96-112`): run-mvr9iajg-ae4e071a, verdict passed, oracleVerdict passed, lane recording, harnessActivations 0. This does not exercise a Flow or the `regrouped` variant (`lab run --variant` is create-flow only, `commands.ts:67`), so whether regrouped breaks a built Flow is unverified here.

## Commands run

- Searches: node scan over 337 `creation-context.json` (scratchpad `scan.mjs`), `find`, `grep`.
- Build (first replay only, 730 s; later reuse): inside `lab replay`.
- Replays and runs as listed above, plus `pnpm lab run social-network-feed` with the same env prefix. Exit codes: 1 for every failed verdict, 0 for passes.
- Logs are in the shared scratchpad dir (cb_unarmed1.log, cb_unarmed2.log, cb2_unarmed.log, cb2_armed.log, es_*.log, soc_run.log).

## Not verified

- No unadapted crossborder Flow built from the gate task itself; the unrepaired Flow is from the base task (same instruction, same site, built on the unchanged site), which is the equivalent pre-drift Flow.
- everything-store and social armed behaviour for the real gate Flows (see above); whether the wheel absorbs on a Flow that searches, whether regrouped breaks a group-post Flow.
- Whether the paid build's Flow will resemble these Flows; the paid run may author its own recovery steps.
- No screenshots inspected; the UI was not reviewed (replays are not live builds).

## Open questions or contradictions

- `lab replay --variant` is refused unless the Flow's task workflow declares the variant, so a cross-task armed preflight needs the gate task id (which swaps the oracle). The launch-path assumption "base task plus --variant" fails for everything-store `plus-under-fifty`.
- The replay receipt hashes only the parent Flow document (`flowContentHash`); the repaired graph under `flows/*.graph` changes without the parent hash changing (adaptation.json shows both). A replay receipt's `flowContentHash` therefore cannot detect a repair.
- Receipts for failed armed runs report "Core published no provider call accounting", so the counters are null there (not zero); treat the zero-call claim for failed runs as `modelProvidersEnabled:false` plus `llmGate` training_mode refusal.
