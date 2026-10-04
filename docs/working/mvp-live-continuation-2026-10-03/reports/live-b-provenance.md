# B provenance live validation — worker report

## Current State
**One released launch completed, failed:** run-mut6bevx-d8b7956f, downstream7b5a3aa1/Core97e279de. Complete six-stage debug authored; source and persistent workspace preserved. Stage1 was prepared before release. One paid run maximum after release; no automatic retry, replay, guard override or source change. Stage1 below was authored before inspecting any new run artifacts or ending.

## Stage 1 — predeclared expectation
Scenario bigbox-retail; task bigbox-retail-pickup-cart-store-remembered-after-creation; persistent workspace t262-b; instance t262-slot-3; slot3 remains supervisor-owned t262.

Public authored task instruction:

> Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.

Expected chain:
1. Reach the store picker and set the requested pickup store; keep required opener/reaching steps. Store-remembered playback must handle the already-selected state.
2. Reach the requested towels product, select requested size and quantity two, then add exactly that intended quantity for pickup.
3. Reach the requested napkins product, select requested size and quantity one, then add it for pickup.
4. Preserve the seeded soap item, do not checkout, and verify final store, product identities, sizes, quantities, fulfillment and original-item retention. Expected fixture cart is four items/subtotal43.39.
5. Finish with a correct final Flow definition, whole-Flow test and judgement; save a created Flow if accepted. Separate deterministic replay is supervisor-coordinated later and is not part of this one launch authorization.

Wrong answers that can look superficially right: two product names added in wrong sizes; quantities typed on wrong control; requested store merely opened rather than selected; cart count correct after deleting seeded content; lasting cart adds repeated by whole tests; checked retarget reported as performed despite no press; judge approves exploratory cart state while final definition omits required action/choice; no accepted Flow but attractive screenshot.

Targeted correction expectations:
- Counted cart acts a2/a3 declared [] should still be protected by grounded source-clause attribution when the instruction read witnesses them. Whole build tests should send lasting cart steps as replay:verify, with no extra cart mutation caused by those tests. Ordinary size/quantity/opening/navigation dependencies must still execute as appropriate.
- A checked retarget is shown as candidate/not performed; historical effect proof remains tied to its original configuration. No speculative duplicate action is introduced to manufacture proof.
- Exact final size choice remains a required observed fact; removing duplicate test mutations alone does not establish full acceptance.
- Compare model amendment churn, failed/no-change reruns, all judge pairs, automatic repair, final definition, build playback and spend to previous B. No pass inferred from synthetic tests or source checkpoints.

## Run constraints and command
Public process environment after release only:

```text
FLUXIQ_LAB_INSTANCE=t262-slot-3
FLUXIQ_TEST_ENV_FILES=none
FLUXIQ_TEST_TARGET=persistent-isolated
FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10
npm_config_workspace_concurrency=1
```

$0.10 is Lab-only. Model Flash, headed bundled Chromium, real extension-chat entry. No direct API, added permits, Pro escalation, altered budget or guard override.

```text
node scripts/lab/run-lab.mjs run bigbox-retail --target persistent-isolated --workspace t262-b --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --llm-cost-ceiling-usd 0.10
```

Redirect all launcher output to ignored `test-runs/instances/t262-slot-3/launch-2.log` (confirm actual instance log directory from existing owning layout before launch). Preserve existing launch-1/run evidence and persistent workspace. Never remove slot ownership or workspace/draft/Flow state.

## Prelaunch prerequisites
- Supervisor explicitly releases exact downstream/Core checkpoints after linked package types, fresh build and audits; record IDs here before invocation.
- Prior failed B full debug run-mut5amuc-c617cc21 is authored and complete; source fingerprint changed by independently verified provenance/candidate fixes. Existing prior run ended; do not run against source while edits/checks remain active.
- Read only slot3 ownership and STOP-balance presence as needed. Owning launcher applies balance/behind-dev/loop/debug/unchanged guards. Any guard rejection ends this attempt: report refusal, no override or retry.
- Do not launch during this preparation turn. Read-only source/report preparation grants no provider authorization by itself.

## Evidence collection after released launch
Notify supervisor of session and run ID promptly. Capture safe ending/status/cost rather than raw provider/page/credential data. Complete a new named six-stage run debug on pass or fail with one ordered row for every model call (including instruction read/judges), argument shapes and exact ignored private references, full-test node modes/durations/results, final comparisons, repair, persistence and screenshot start/mid/end review. Mark NO EVIDENCE gaps; neither compilation nor a screenshot alone proves browser behavior.

Latest baseline: previous B run-mut5amuc-c617cc21 failed after51calls/total.074950068, build.074802696, no created Flow; four full-test cart additions used replay:step with [], cart ended10items/[observed subtotal withheld], final failed size step250Count,5/6coverage. The actual instructed-read response missed reconstructed a2/a3 quote containment; internal cached store was not independently inspected. Persistent old draft remains preserved.

## Launch ledger
- Prepared Stage1; no new run ID/session/source checkpoint released yet.
- No provider call, browser launch, process/environment mutation, source/shared doc/store change, commit or push by worker during preparation.
- Supervisor explicitly released one launch at checkpoints downstream7b5a3aa1/Core97e279de. Read-only preflight confirms both HEADs, slot3t262/B owner, and STOP-balance absent. Output path confirmed test-runs/instances/t262-slot-3/launch-2.log. Invocation follows once; no retry/replay.

- Launched once in session55342; new run ID run-mut6bevx-d8b7956f appeared in staging. Launcher remains active; status/spend/createdFlow pending. Source remains frozen; no retry/replay.

## Ending and validation
- Session55342 exited1, run finished02:06:22.690Z (summary02:06:22.932Z),373.177s. Failed/build/lab.chat_build_failed, no created Flow. Incomplete draft13keptsteps; contextFlowID preserved but not accepted/replay-ready.
- Central53ordered provider turns: chat1/explore31/read1/repair18/judge2. Loop49decisions. Snapshot profile reports49records/calls, retained as a discrepancy rather than silently equated with central count. All53 costs total.073861872; build.073644534 includes read+judges, chatdifference.000217338. BudgetBreaches0; spendbelow.10.
- Five cart test calls0079/0099/0103/0157/0161 all verify/core.replay.verified/effectApplied=false across3fulltests. Targeted lasting protection held; checked towel candidate step16/a2 marked performed:false/changed:no. Neither is full functional acceptance.
- Both judges0104/0105 answered no/patchNeededtrue. Quantitya2.quantity remains step_only_arrives on mixed dom-click configuration with url/consequences/target parameter shape. Repeated no-change/unchanged reruns stop repair; final screenshotcart2/[observed subtotal withheld] vs4/$43.39, requested napkin/store/pickup visible. No final per-SKU oracle/runtimeplayback/acceptedrepair/reuse.
- Full debug: docs/working/language-driven-flow-loop-plan/debugs/run-mut6bevx-d8b7956f.md;53turn rows,21draft rows,41test rows including modes/effects/durations/private refs, both judges/repair/ending, start/mid/end screenshots. Sidecar16moments,0capturefailures. No raw page/prompt/locator values authored.
- No retries/replay/source edits/extra library rebuilds, no profile/store mutation/reset/slot removal. Owning launcher handled the one run. Supervisor independent verification remains required before any targeted acceptance.