# B provenance live validation — worker report

## Current State
**Prepared only; no launch authorized yet.** Awaiting supervisor's exact paired source checkpoint IDs and explicit launch release. One paid run maximum after release; no automatic retry, replay, guard override or source change. Stage1 below was authored before inspecting any new run artifacts or ending.

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

Latest baseline: previous B run-mut5amuc-c617cc21 failed after51calls/total.074950068, build.074802696, no created Flow; four full-test cart additions used replay:step with [], cart ended10items/$140.74, final failed size step250Count,5/6coverage. The actual instructed-read response missed reconstructed a2/a3 quote containment; internal cached store was not independently inspected. Persistent old draft remains preserved.

## Launch ledger
- Prepared Stage1; no new run ID/session/source checkpoint released yet.
- No provider call, browser launch, process/environment mutation, source/shared doc/store change, commit or push by worker during preparation.