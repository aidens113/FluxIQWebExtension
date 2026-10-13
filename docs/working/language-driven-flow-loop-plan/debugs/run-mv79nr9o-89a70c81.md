# Crossborder adaptation round one: run-mv79nr9o-89a70c81

Status: Passed; worker evidence ready for independent supervisor verification
Date: 2026-10-13
Worker: codex-t516
Source: downstream `6a46e66b`, Core `73550acb`; t418 paired lane, slot 3

## Launch and evidence

One authorized paid launch used the normal guarded Lab launcher, headed Chromium, real extension chat, candidate authoring and the authored `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` task. Target was persistent-isolated, fresh `adapt-crossborder-continuation-1`; profile lab-create-flow, DeepSeek flash, one requested in-run replay, $0.25 per Flow, 64 calls and 48 million run tokens. No direct API build, recording conversion, override, source alias, synthetic instruction, output cap or second paid launch was used.

The run started at 22:42:30.740 UTC and finished at 22:45:36.936 UTC. Its actual running extension/background/content, Core, host and server-adapter identity snapshots all report verified true. The source remained frozen. The bundle is retained privately at `C:/Users/osrs_/FluxStuff/fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-slot-3/run-mv79nr9o-89a70c81/`. Full model/tool/run evidence is under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-13/run-mv79nr9o-89a70c81/steps/`. No recorded values, selectors, runtime hashes or credentials are copied here.

## Build and baseline trial

The initial chat was submitted through the panel. Exploration navigated, located the requested task context, encountered a covered target, dismissed the two optional covering layers, located the item, chose the required options, collected the coupon and set quantity. The covered type at step 6 was rejected with no effect; subsequent actions succeeded. Exploration ended before executing the final cart addition. The candidate supplied that lasting final act explicitly rather than inferring success from exploration.

The model submitted one candidate, tested its exact revision/digest, received trial yes and completed promotion. The trial reported start reset and succeeded. All eleven stored trial steps passed: navigation, two optional dismissal clicks with merge continuations, three option checks, coupon click, quantity type and the cart addition. There were zero stored extraction rows, refusals or missing required fields. Two creation judges both answered the request yes with confidence 0.95, no patch or further exploration needed. The candidate was promoted after one trial. No second candidate build or retrying a failed authoring launch occurred.

Reset provenance is explicit: the ordinary Lab plan advertised `fixtureResetBetweenTrials: true`, and the trial reported start reset. This run proves the ordinary candidate reset path, not a model-only rollback of prior lasting acts through site controls. The harness also resets the fixture before the armed playback and deterministic replays. Existing pre-task user state was not used: this is the newly created isolated workspace.

## Armed playback and every attempt

The task variant was basket-redesign. The saved Flow reached its own page, then navigated and dismissed layers normally. The coupon press first returned `web.action.rate_limited`; its automatic retry succeeded. Quantity was set. The original cart-add target then failed on the same node four times with `web.target.not_found`: first attempt plus three retries. Diagnosis and repair ran after exhaustion; a validated runtime patch changed that target, and the same node then succeeded. There was no restart of the preceding lasting acts. No purchase action was performed; the independent task oracle passed.

| Playback action | Kind | Actual status |
| --- | --- | --- |
| 1 | Navigate | Succeeded |
| 2 | Optional dismissal click | Succeeded |
| 3 | Merge | Succeeded |
| 4 | Optional dismissal click | Succeeded |
| 5 | Merge | Succeeded |
| 6–8 | Required option checks | Succeeded |
| 9 | Coupon click | Failed: web.action.rate_limited |
| 10 | Coupon click retry | Succeeded |
| 11 | Quantity type | Succeeded |
| 12–15 | Original cart-add target, same node | Failed four times: web.target.not_found |
| 16 | Patched cart-add target, same node | Succeeded |

The recovery receipt contains two diagnoses and a runtime patch, each validationOk true. There is one repair adaptation, no refusal, one result check, and product result verification confirmed. The final model judge also answered yes with confidence 0.95. Runtime and independent oracle both passed. This was a real repaired drift, not an absorbed target move or no-proposal success.

## Durable application and reuse

The adaptation is applied, base revision 1 and applied revision 2. Core applied it inside the run before the Lab's post-run application read; the lane reports alreadyApplied and Flow change `changed_in_run`. The lane's own later before/after aggregate hashes are equal because both reads follow the application. Its owning classification relies on Core's recorded advancing revision; the helper alone cannot establish the gate's required before/after content-hash difference. The creation-context saved hash is a root-only exact-Flow hash and must not be directly compared with the repair lane aggregate hash. Exact hashes remain private in the receipts.

The follow-up read-only P4 audit located actual repair persistence in the project artifact SQLite, not global.sqlite. The global store has the separate creation bootstrap; its ID matches the promoted candidate and differs from the repair. The project repair adaptation ID matches the sealed repair receipt, targets an owned subflow and records the applied revision chain. This reconciles the initially incomplete global-store investigation; bootstrap misattribution was not confirmed.

Raw graph revision digests cannot prove P4: `graph-store.ts:106` hashes the imported nodes/edges/regions, while line 139 hashes baseRevision/operations for subsequent revisions. Both recorded snapshot-object references are absent. Comparing those incompatible digests would be invalid.

With supervisor authorization, the audit reconstructed the complete original runnable graph from immutable import history, then replayed every recorded operation. Revision 1 has 11 complete nodes, 12 complete edges and zero regions; revision 2 preserves those counts. All 25 operations have complete ordinal/count coverage; both repair operations' before_json exactly match their preceding recorded states. The full reconstructed final nodes/edges match current durable SQL rows. Both canonical rollback operations exactly restore the recorded base parameters and metadata. Only one node changed parameterValues and metadata; all edges remain unchanged. The repair's subflow ownership and parent revision chain match exactly.

The same deterministic full graph projection hashes differently before and after. Storage timestamps, physical partition and per-entity revision fields are excluded identically so the difference is not merely bookkeeping. This is **reconstructed evidence from complete durable history**, not a pair of hashes captured before and after the live application. External `p4-history-audit.cjs` provides the read-only reproducible algorithm; `p4-reconstructed-counts.json` records safe checks, and `p4-reconstructed-private.json` retains exact hashes and complete snapshots. All three are under the preparation evidence directory. The supervisor independently inspected and reran the complete reconstruction, then separately hashed executable node identity/definition/version/disabled/parameters plus edges/regions: those hashes also differ, with exactly one node's parameters changed. Actual-current equality, rollback equality and same graph ownership were independently verified. The supervisor accepted P4 as reconstructed immutable-history evidence, explicitly distinct from original captured hashes.

The requested in-run replay succeeded: goalPassed true, flowSucceeded true, providerCalls 0, harnessActivations 0 and modelCalled false. The gate helper records counted true. Adaptation validation remains provisional with one trial and zero accumulated replay validations; the runner's independent replay proof must not be confused with that policy tier or the absent adaptationReuse metric.

The separate later-session replay `replay-mv79t4ms-c8a3b890` used the normal replay CLI, the same task/drift, saved project/Flow and workspace, env files disabled and owning provider-secret stripping. It passed with goal true, succeeded runtime, unchanged saved Flow content hash and the saved address retained. Environment credential variables were empty, modelProvidersEnabled false and runIntent null. Core provider calls, accounted calls, calls, interventions and harness activations were all zero; llmGate invoked false. Stored provider key identities were preserved. Deterministic result verification is unverified, as expected without a model judge; the independent goal oracle supplied this replay's result proof.

Exact later receipt: `C:/Users/osrs_/FluxStuff/fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-slot-3/replays/replay-mv79t4ms-c8a3b890.json`.

## Accounting and UI

Complete run spend is 20 provider calls, accounted estimated cost $0.018806934. All cost phases are attributed: chat 1/$0.000275586, build 14/$0.010694082, runtime repair 2/$0.004428258 and judge 3/$0.003409008. No reauthor/read phase or unattributed calls exist. The per-Flow ceiling did not breach. This is the Lab's complete accounted estimate, not an independently obtained provider invoice. The build-only accounting snapshot excludes later repair/chat phases and must not replace the total.

The actual panel screenshots were reviewed at submitted chat, mid-trial and run end: `02-mid-build-panel.png`, `05-mid-build-panel.png` and `12-end-panel.png` in the run's ignored `run-mv79nr9o-89a70c81.ui-review.local` directory. The UI displayed the task, real Testing your Flow progress, completed option/coupon/quantity/cart cards, a coupon retry explanation and Run finished. The end screenshot does not itself show a retained-learning summary; durable change and reuse are proved by server/runtime/replay receipts, not inferred from UI copy. Screenshots stay local.

Safe independent no-purchase predicates were checked directly: the orders-shipped fact's expected and observed fields each exactly equal the owning fixture's `ordersShipped(0).value`; its held flag is true. All four task goal facts are held and finalState is held. No recorded strings or purchase/cart values are published in this debug.

The consequence cross-check classified a declared `create_new` as beyond_instruction against an empty instructed consequence list, although the written task explicitly authorizes the cart addition. No permission request or permission stop occurred, and no unrequested purchase occurred. This classification mismatch is reported for review rather than hidden or patched during the frozen run.

The paid launcher and later replay exited 0. Owned isolated scenario/Core servers and Chromium sessions were closed normally; server exit code 1 is recorded for terminated run-owned servers during cleanup, not treated as an independent product failure. Final matching-process inspection found no retained task process. Profile, project, Flow and workspace are preserved; slot 3 remains reserved. No source edit, user panel management, other-slot operation or paid relaunch occurred.

## Gate interpretation

P1–P3 have promoted judged baseline creation, real four-attempt drift failure, diagnosis, validated patch, same-node resumption and independent goal proof. P4's complete reconstructed same-domain graph change was independently verified and accepted by the supervisor; revision advance and helper counted true alone remain insufficient. P5 and P6 have explicit zero-call independent-goal replay and durable content preservation. P7 has the headed chat/UI review/full debug and complete accounted cost below $0.25. Final gate counting remains the supervisor's responsibility. Model-only reset and a provider invoice are not claimed. A second paid round is held because an upcoming store fix may change the frozen pair and reset the required streak.


## Complete retained step ledger

Each row below names the owning step kind, phase, result and closed code; raw requests, page packets, selectors and outputs remain in the ignored step evidence. The candidate trial has its eleven-step ledger above.

| Step | Kind | Phase | Status | Closed result |
| --- | --- | --- | --- | --- |
| 1 | chat | chat | ok | ? |
| 2 | tool | explore | ok | web.action.succeeded |
| 3 | decide | explore | ok | ? |
| 4 | tool | explore | ok | web.inspect.succeeded |
| 5 | decide | explore | ok | ? |
| 6 | tool | explore | ok | web.action.rejected.target_covered |
| 7 | decide | explore | ok | ? |
| 8 | tool | explore | ok | web.action.succeeded |
| 9 | decide | explore | ok | ? |
| 10 | tool | explore | ok | web.action.succeeded |
| 11 | decide | explore | ok | ? |
| 12 | tool | explore | ok | web.action.succeeded |
| 13 | decide | explore | ok | ? |
| 14 | tool | explore | ok | web.action.succeeded |
| 15 | decide | explore | ok | ? |
| 16 | tool | explore | ok | web.action.succeeded |
| 17 | decide | explore | ok | ? |
| 18 | tool | explore | ok | web.action.succeeded |
| 19 | decide | explore | ok | ? |
| 20 | tool | explore | ok | web.action.succeeded |
| 21 | decide | explore | ok | ? |
| 22 | tool | explore | ok | web.action.succeeded |
| 23 | decide | explore | ok | ? |
| 24 | tool | explore | ok | web.action.succeeded |
| 25 | decide | explore | ok | ? |
| 26 | tool | explore | ok | ? |
| 27 | decide | explore | ok | ? |
| 28 | tool | explore | ok | candidate.trial_yes |
| 29 | judge | judge | ok | ? |
| 30 | judge | judge | ok | ? |
| 31 | decide | explore | ok | ? |
| 32 | run | playback | ok | ? |
| 33 | run | playback | ok | ? |
| 34 | run | playback | ok | ? |
| 35 | run | playback | ok | ? |
| 36 | run | playback | ok | ? |
| 37 | run | playback | ok | ? |
| 38 | run | playback | failed | web.action.rate_limited |
| 39 | run | playback | ok | ? |
| 40 | run | playback | ok | ? |
| 41 | run | playback | failed | web.target.not_found |
| 42 | run | playback | failed | web.target.not_found |
| 43 | run | playback | failed | web.target.not_found |
| 44 | run | playback | failed | web.target.not_found |
| 45 | diagnose | repair | ok | ? |
| 46 | repair | repair | ok | ? |
| 47 | run | playback | ok | ? |
| 48 | judge | judge | ok | ? |
