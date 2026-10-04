# Debug: B pickup-cart run 2, run-mustzxhi-2e2cda87

Date: 2026-10-03. Worker: resume-ab. Outcome: failed before Flow creation; no paid retry authorized by this debug. Source read-only. Old paired t193 source and ignored run data preserved.

## Expected behavior and actual ending

Scenario `bigbox-retail`, instruction task `bigbox-retail-pickup-cart-store-remembered-after-creation`, instance `t193-slot-2`, headed extension-chat entry. Expected: switch pickup store, retain existing cart item, add two packs of requested towel variant and one requested napkin variant for pickup, no checkout; then persisted Flow playback with remembered store.

Started 2026-10-03T20:15:18.358Z; ended 20:20:13.838Z. `run.json.status=failed`; `evaluation.json.failureCategory=runtime.behavior`; `flowCreated=false`; stoppedAt build. Product ending: not finished, last repair made no measurable progress, same Flow returned, only 2/6 requested acts/choices covered. A 9-step incomplete draft was kept; the product made no created-Flow claim. Playback, remembered-store validation, production persistence/reuse and result judges never ran.

## Spend and phases

| Measurement | Actual |
| --- | --- |
| Whole run | 40 provider calls, $0.049652802 |
| Build decisions | 38 calls, $0.049311372 |
| Instruction read | 1 call, $0.000194058 |
| Chat routing | 1 call, $0.000147372 |
| Per-build purse including instruction read | $0.049505430 / $0.10; overCeiling=false |
| Result judges | 0 calls |
| Runtime, reauthor, adaptation, persisted reuse | Not reached |

From `snapshots/live-llm.json.runSpend` and Flow build accounting. Failure was progress/checklist semantics, not budget exhaustion, provider balance or machine load.

Decision dump rounds:

| Round | Decision kinds | Actual progress |
| --- | --- | --- |
| Exploration | 17: 9 tool calls, 8 amendments | Switched store, navigated to towel product, chose size; incorrectly applied repeat to choice. Stopped unusable_decisions after repeated ineffective amendments. |
| Repair 1 | 12: 1 tool call, 11 amendments | Added/replaced quantity step but kept a row repeat on it. Draft grew 8 to 9 kept steps; checklist still 2/6. |
| Repair 2 | 9: 1 tool call, 8 amendments | More repeat/keep/act retagging; no missing cart acts. Same 9-step draft, same 2/6; stopped for no measurable progress. |

Thus **27/38 paid decisions were amendment decisions**, while only 11 were provider-selected tool calls. Evidence loop reports 17 tool executions, including setup/replay-associated executions; this count is distinct from provider decision kinds. Two repair-context entries say preceding tests were `replayed_clean`; product ending records three live attempts (exploration + two repairs). Zero judge calls means these clean partial tests must not be called successful whole-Flow judgements. The last partial test is reported clean by the ending, not independently reconstructed from complete per-step logs.

## Root causes

### R1: quantity became a row loop

Final draft checklist: store act a1 done at step5; towel quantity a2.quantity names step8 but `todo=quantity_is_a_repeat`; towel size a2.size done at step10; towel cart act a2 and napkin cart act a3 both `todo=no_step_added`; napkin size absent. Step8 runs `repeats through step8, over step7`. This repeats a choice over another step's rows/success, not two units of one item. The live final screenshot shows requested towel variant, pickup and quantity2 configured, with the cart still at its seeded one item; configuration is not Add-to-cart.

This is a semantic authoring failure with valid detection. Core `flow-bootstrap/instructed-acts/quantity-fault.ts` correctly classifies singular quantity under a row repeat and already says use the item's own quantity control. Relaxing that check would falsely finish the Flow. Exact product cart operations are absent from the final draft and screenshot; no inspected draft/tool record classified an Add-to-cart control.

### R2: refusal feedback steers an unrelated quantity toward a repeat

Current Core `llm/draft-amendment-feedback.ts` static `act_already_named` text tells an unfinished act to correct it by repeating a press over its listing, even for a singular quantity choice. The narrower `quantity_is_a_repeat` checklist advice competes with this generic repair instruction. Model repeatedly sends repeat/keep/act claims rather than moving on to missing cart presses.

Concrete late sequence: global iterations31-38 repeatedly repeat step8 over7, keep step8, and keep size step10. Refusals include `already_so`, `act_already_named`, `over_not_before`. No new cart act results. Changing `over` to8 is refused; changing it back to7 leaves the incorrect loop in place. This exact source feedback remains on t262 and is not repaired by advisory false-navigation claims, stable handles or toggle cancellation.

### R3: no explicit operation clears an erroneous repeat

Current `flow-draft/amendment.ts` schema says bare keep clears optional/only_if/on_failed **never repeat**; keep carrying act clears no routing. Its owning test explicitly pins this. Consequently repeated keep cannot make step8 unconditional, and an `already_so` reply does not offer an explicit repeat removal. The schema contains no clear-repeat operation. A model could replace repeat with optional and then keep, or drop/rerun/build a new step; neither is a direct safe correction offered for this specific fault. Do not alter generic keep to silently delete row loops: that would regress intentional repeated acts/act retagging.

### R4: remaining required work never happened

Both cart acts and napkin variant remain absent, despite configured towel state. This is not the prior run1 split-judge quantity observation defect: no judge was called here. Importing B's observation/progress changes alone cannot repair this newest failure.

## Screenshot review

Inspected local PNGs `02-mid-build-panel.png`, `07-mid-build-panel.png`, `12-failure-panel.png`, `12-failure-scenario.png` under the ignored run UI-review directory; no copies committed.

- Start: sent message has its bubble, composer is cleared, Starting status appears. B's send-start handshake/composer fixes are exercised, though elapsed start timing was not measured.
- Mid-build: refused-edit cards correctly say Not done and explain repeat placement; partial-test message names unusable decisions rather than treating attempted edits as successful. Status still says Fixing your Flow while heading describes partial testing, so surfaces do not fully agree.
- Failure panel: honest incomplete ending names missing asks, but the long final message dominates the panel and contains truncated phrase “not put into the.” This is a concrete wording defect, not a private-data excerpt.
- Failure scenario: cart remains seeded; towel settings are configured; bottom-left failure overlay avoids product image and bottom-right site chat. Native scenario horizontal scrolling remains visible. Overlay says Could not fix although the user requested creation; creation/repair wording needs review.

## Proposed next bounded fix, before any paid B retry

Core owns this generic authoring seam. Supervisor should write a file-partitioned brief, implement provider-free regressions, then narrowly validate before live retry:

1. Explicit repeat-removal amendment (name/design to be chosen by supervisor), preserving all existing keep semantics. Own `runtime/flow-draft/amendment.ts`, `tests/amendment.test.ts`, `tests/routing.test.ts`; if a new refusal/code is required, synchronize `runtime/llm/draft-amendment-feedback.ts` and its owning test. Decision parser imports the enum from amendment; inspect `runtime/llm/evidence-loop-decision.ts` and existing authored-draft tests if the new member needs shape validation. Clear obsolete replay marks on removal because the execution count/context changed.
2. Context-aware no-change feedback: `runtime/llm/draft-amendment-feedback.ts`, `tests/draft-amendment-feedback.test.ts`. Supply needed claim/routing/checklist context through the existing `steps` view/callers; default advice should direct the model to checklist.todo rather than prescribe a row loop unconditionally. Concrete quantity-is-repeat repair must name the clear-repeat operation and quantity control.
3. Tests: a mistakenly repeated quantity step becomes unconditional in one explicit edit; keep+act retains an intentional row loop; generic act_already_named for a singular quantity never recommends row repetition; removal clears stale test marks and preserves other steps/claims; the scripted sequence of repeated late B amendments no longer requires optional/keep gymnastics. Verify missing cart acts still prevent completion.
4. Keep `quantity-fault.ts` semantics. Run its existing owning check/checklist tests plus amendment/routing/feedback regressions, touched Core typecheck/build and structure audit. No full sweep today.
5. Fresh capped Flash live B run must prove requested cart facts and remembered-store saved-Flow replay. Debug first if it fails; no loop, guard override or model escalation.

## Evidence and limits

Read run/summary/evaluation, flow-lane/live-llm/decision-trace snapshots, three curated `decision-dumps/build-2026-10-03T20-{17-02-579,18-16-471,19-21-797}Z-9796.jsonl` files selecting decision kinds/codes/checklist/draft metadata, core trace lines, and four screenshots. Original per-call meta/request/result folders were not present in inspected preserved artifacts; no reconstructed prompt or page dump was emitted. Exact discarded temporary draft state around every rerun was not proven beyond dump entries. No tests/source changes or fresh live result by this worker.
