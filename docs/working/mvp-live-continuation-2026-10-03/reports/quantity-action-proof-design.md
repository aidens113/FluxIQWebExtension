# Quantity action proof — diagnostic worker report

## Current State

Read-only diagnosis; no source/test/build/provider/runtime/store/profile/guard operations. Own report only. Initial eight source owners plus five explicitly released fault/comparison/test owners and five caller contexts inspected. Both final adapters inspected and synchronized nine-source Core partition confirmed. Actual executed-action diagnosis is complete; implementation is not authorized by this report.

Confirmed B2 defect: a real successful increment action retaining an unrelated old navigation `url` is classified as `step_only_arrives` by generic Core value scanning. This is distinct from an unsuccessful action or an idempotent setter rejected for `effectApplied=false`. Six quantity repair increments actually succeeded with `effectApplied=true` and `pageChanged=true`; a blanket no-effect-success patch is unsupported.

## Evidence and distinct paths

Private ignored evidence root: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-mut6bevx-d8b7956f`. Only bounded authored metadata/parameter shapes are published here; raw pages/provider messages/selectors stay private.

- Early model authoring omitted a proper quantity setter and claimed `a2.quantity` on existing step4 in `steps/0025-decide/decision.json`. Later authoring also changed repeats/claims on other steps. This was a wrong attribution, not proof that Core rejected a successful setter.
- Later repair actually targets the increment control and succeeds: `steps/{0112,0116,0120,0126,0134,0141}-tool-core.run_node/{call,result,meta}.json`. Each is a dom-click, target handle object, `ok:true`, status succeeded, `resultCode:web.action.succeeded`, `effectApplied:true`, `pageChanged:true`. Last three durations: 3126/3097/3067ms. These are increments, not an absolute-value setter with text/value "2".
- Node-changing rerun at `steps/0123-decide/decision.json` patches node/parameters onto a previous input. Subsequent click calls retain parameter shape `{url:string, consequences:array, target:{handle}}`; current metadata identifies the executed node as click. That stray location does not establish navigation.
- `steps/0144-decide/request.json` shows the exact contradiction: draft step9 actionId dom-click, `changed:yes`, disposition kept, `inResult:true`, act a2.quantity, control category increment, and parameter keys url/consequences/target. Its quantity checklist nevertheless says `todo:step_only_arrives`, step9. No written or checked-candidate marker is involved in this increment's proof.
- `steps/0146-decide/request.json` includes amendment refusal step9 `changes_nothing`; this is a later repeat refusal, not the result of the succeeded quantity actions. Existing repeat guard keys the full request and starting state; it can refuse failed/no-change/same-result requests. The retained artifact does not expose which private guard outcome was selected, so the exact repeated-outcome subtype is not claimed proved.
- Other refusals remain separate: earlier failed opening was invalid input, later rerun target-not-found; neither shows an idempotent quantity setter. Cart verify answers have `effectApplied:false` by design and must remain checked/not-performed evidence. A correct final numeric quantity/full-test pass is not established by seeing six successful increments.

## Confirmed source chain

Core runtime root `R = packages/fluxiq/src/programs/automation-studio/runtime/`.

`flow-bootstrap/instructed-acts/checklist.ts` constructs `onlyArrives` by calling `reachability/step-goes-to-location.ts` with the start location. That helper delegates the entire `step.ranWith ?? step.input` to `location-agreement.ts`. The latter accepts any string sharing the first12 characters with the opaque start location (or the shorter whole start), scanning nested values. It never identifies the action or arrival parameter. A retained same-place url on a click therefore suffices.

Checklist → `standing.ts` → `step-fault.ts`: the common fault rule first checks kept/proposable mutation, then `onlyArrives`; it returns `step_only_arrives` before quantity standing is consulted. This explains the actual successful-plus/checklist contradiction. `quantity-fault.ts` and choice matching cannot repair a step already classified as arrival.

`flow-draft/step.ts` proposability accepts these real succeeded calls because effectApplied is true. `flow-draft/amendment.ts` is not refusing them as did_not_work. `domain/src/runtime/llm-evidence/node-run/run.ts` explicitly reports true after a succeeded dispatched command, separately reporting pageChanged. Idempotent successful calls whose sanitized page looks equal are deliberately still successful. Failed commands take the refusal path. No changed-nothing semantics correction is justified here.

`llm/repeat-guard/outcomes.ts` keeps failed, changed_nothing and same_result distinct internally; a third same-request/same-start-state repeat can be refused after two calls end on the same result, even when each call succeeded. That protects against repeated churn; the checklist misclassification can cause the model to keep rerunning a correct increment, but it does not establish a repeat-guard defect.

## Minimal truthful correction direction

Use the existing declared arrival identity `AutomationStudioLlmEvidenceRuntimeBinding.runsNodes.arrival {node,parameter}` (confirmed in preceding D bounded seam investigation). Core compares opaque action/node identity to that declaration before considering the declared location argument. Downstream already selects the arrival node through its own navigation action catalog and declares its parameter. No browser node-name special case, URL parsing, or cart-specific heuristic belongs in Core.

Preserve other reachability location comparisons: do not globally rewrite `location-agreement.ts`, which is also used by plan-level reachability. Narrow the step classifier to the actual declared arrival action and its declared parameter, using resolved input first. A click carrying a leftover location is not arrival. A true declared arrival remains arrival even with opaque/non-URL location spelling, and true arrival cannot satisfy a quantity/add choice merely by a claim. Without a declared arrival identity, location text alone must not become authoritative action classification; decide compatibility for legacy callers explicitly.

Synchronize all classification consumers: arrival restoration, completion/checklist and the build-test judge's checklist must use the same declaration. Current helper call-site inventory (filenames only) names `reachability/start-step.ts`, instructed-acts/check.ts/checklist.ts, `llm/harness-options/draft-acts.ts`, result-verification/build-test/summary.ts and service.ts. Exact propagation is confirmed below; completion restoration and judge/classification consumers must agree.

Host proposes/effectApplied semantics, actual permission gates, replay/testing, written/candidate proof and original lasting history remain unchanged. An arrival-identity fix removes the false advisory fault; it does not demonstrate the model selected the wanted numeric quantity or that the resulting full Flow passes.

## Meaningful failed-before tests proposed, not run

1. A synthetic registered non-arrival increment action succeeds with effectApplied=true, declared quantity claim and leftover parameter.location matching start. Expect it not to be classified as arrival and quantity checklist not to say step_only_arrives. Existing helper's indiscriminate scan should fail this assertion.
2. Same fixture through real service/host binding to verify the declaration reaches both model checklist and judge/build-test checklist; do not test only a helper with hand-supplied declaration. Setter remains kept/proposable without invented written or performed evidence.
3. Real declared arrival action/parameter with same location remains arrival, and is refused as quantity evidence; a URL in some other parameter or non-arrival action does not confer arrival. Resolved input takes precedence; absent declaration never infers navigation from address syntax. Opaque/non-URL location supported.
4. True failed increment remains proposes:false/no effect and cannot be added by changing a claim. Successful unchanged-page setter remains successful under the existing domain contract. Permission-denied execution remains denied; candidates and lasting verifies retain effectApplied:false and separate provenance.
5. Repeat control: identical request whose first result failed/no-change stays blocked as appropriate; two succeeded calls ending at the same result retain same_result protection. A successful setter's real proof is not downgraded to an action failure by that later refusal.
6. Existing wrong-choice-object, quantity repeat/counting, numeric choice, afterAct, optionality, opener, stale marks and true arrival restoration regressions remain intact. No new completion restriction or automatic action.

## Remaining uncertainty

Initial incorrect quantity claim and later successful increments are separate confirmed facts. The final desired quantity, each reset's starting numeric value and the exact guard repeated-outcome subtype were not independently proven here; full B2 debug remains authoritative for overall ending. The correction does not resolve every wrong-control/model-binding choice or imply a clean Flow.

## Caller propagation findings

- `checklist.ts` and `check.ts` independently construct the same onlyArrives predicate before shared standing; both need the declared arrival argument.
- `reachability/start-step.ts` uses the same step classifier to decide whether kept steps arrive and which withdrawn successful step to restore. It must receive the identical declaration so a stray location on the kept increment does not suppress restoration of an actual dropped arrival.
- `llm/harness-options/draft-acts.ts` reconstructs the model's checklist per decision from instruction/start, so its input must carry arrival and forward it.
- `result-verification/build-test/summary.ts` independently reconstructs both checklist and check for the judge. Its input must carry arrival and forward it to both.
- `service.ts` already passes full runtime `binding` into `checkAutomationStudioFlowBootstrapCompletion`. It must forward existing `this.llmEvidenceRuntime?.runsNodes?.arrival` to draft-acts at1590, stopped checklist at1621 and build-judge at1571; do not add a new reader, provider request or action.
- Both adapters confirmed: bootstrap-completion narrows binding to resolvePlanNodeParameters, so its Pick must also include runsNodes and forward declared arrival into restoration. Its completion permission check stays unchanged; it does not perform the advisory instructed-act classification. Build-judge adds arrival to its input and forwards into summary, whose checklist/check both receive it.

## Exact coherent proposed fix partition

Single serialized Core-only implementation unit under `R`, after a separate written supervisor release:

```text
flow-bootstrap/reachability/step-goes-to-location.ts       classify declared action and parameter only
flow-bootstrap/reachability/start-step.ts                  same declaration for restoration
flow-bootstrap/instructed-acts/check.ts                    same declaration for check
flow-bootstrap/instructed-acts/checklist.ts                same declaration for checklist
llm/harness-options/draft-acts.ts                          forward to model checklist
llm/harness-options/bootstrap-completion.ts                derive from existing binding; forward to restore
service/flow-bootstrap-commands/build-judge.ts             forward to summary
result-verification/build-test/summary.ts                  same declaration for judge checklist/check
service.ts                                                existing runtime declaration to model/stopped/judge
```

Reuse the existing public binding's declared arrival type; do not duplicate a browser-navigation vocabulary. Shared step classifier first requires `step.actionId === arrival.node` (host-reported opaque action identity), then reads only the resolved/original parameters' declared `arrival.parameter` for the existing location comparison. Resolved record retains precedence. A url in another slot or a non-arrival action cannot satisfy the predicate. No declaration means there is no declared arrival classification; do not infer it from address syntax. Existing genuine generic arrival fixtures must explicitly declare their synthetic arrival identity; legacy no-declaration compatibility is a deliberate contract change needing tests and supervisor review, not a fallback URL scan.

Keep `location-agreement.ts` and its other plan/location consumers unchanged. No source edit needed in downstream domain, `quantity-fault.ts`, `choice-evidence.ts`, step/proposability, amendment, repeat guard, permission, provider, purse, or tool-result strict parser. No new performed-evidence field or automatic action is necessary. The declared arrival is configuration/identity metadata, not proof that a checked candidate performed navigation.

Exact owning tests to edit/run:

```text
flow-bootstrap/reachability/tests/{step-goes-to-location,start-step}.test.ts
flow-bootstrap/instructed-acts/tests/{check,checklist}.test.ts
llm/harness-options/tests/{bootstrap-completion,draft-acts}.test.ts
service/flow-bootstrap-commands/tests/build-judge.test.ts
result-verification/build-test/tests/summary.test.ts
tests/service-authoring/tests/quantity-arrival-build.test.ts     new scripted real service fixture
```

The service fixture must exercise host-declared arrival with a succeeded non-arrival increment carrying leftover location, actual model checklist and actual build-test judge summary; a hand-supplied helper-only test is insufficient. It must also show arrival restoration and permission/quantity-repeat behavior preserved. New fixture final details depend on adapter confirmation; no source/tests were executed during design.

Future narrow command through heavy wrapper from paired Core cwd (not run):

```text
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/reachability/tests/step-goes-to-location.test.ts src/programs/automation-studio/runtime/flow-bootstrap/reachability/tests/start-step.test.ts src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/check.test.ts src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/checklist.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/draft-acts.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/build-judge.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/summary.test.ts src/programs/automation-studio/runtime/tests/service-authoring/tests/quantity-arrival-build.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/rerun-check.test.ts
```

Supervisor runs Core package type check and structure audit, rebuilds Core and validates paired downstream packages before any changed-source live run. This fixes false arrival attribution/advisory evidence. Actual requested quantities, complete build/playback/whole-Flow judgement and deterministic saved-Flow reuse remain live acceptance requirements.
