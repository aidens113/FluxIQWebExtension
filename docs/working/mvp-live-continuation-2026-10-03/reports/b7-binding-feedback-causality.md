# B7 binding feedback causality

Status: Complete readonly causality and scoped regression proposal; report frozen for supervisor review. No implementation/tests executed.
Owner: resume-ab; paired t262.

## Current State

B7's binding requests target the original tool-facing target object. The actual runnable click declaration uses selector and element parameters instead, as confirmed by matching full-test calls. bindStep checks step.ranWith before step.input; target is absent from that authoritative parameters object, so bind_new_key is correct at that layer. No arbitrary replacement or permission relaxation is warranted.

The proposed whole-object defect is not established: collectBindLeaves recognizes a binding form as a single replacement at its existing path, even when the old value is an object. The translator accepts a nonnull object fallback without nested bindings. A valid existing-path object binding should therefore pass by source reasoning. B7 uses a string test for an original target object, a separate value-shape mismatch, but its refusal occurs earlier at the missing authoritative key. Source does not presently validate fallback type against the replaced value in bindStep, so do not attribute bind_new_key to such validation.

Confirmed actionable representation gap: bind_new_key feedback tells the model to name a parameter the draft shows, while entry.ts shows RenderBindings(step.input) and the mutation owner checks ranWith's normalized selector/element. The model repeated this apparent contradiction. No source defect in whole-object grammar is claimed; no regression executed yet.

## Initial bounded source facts

Six owners read: Core runtime/flow-draft/{amendment.ts,binding-forms.ts,tests/amendment.test.ts}; runtime/llm/{draft-amendment-feedback.ts,tests/draft-amendment-feedback.test.ts,evidence-loop/call-record.ts}.

- amendment.ts bindStep chooses ranWith ?? input and unwraps its parameters. Every bind leaf must exist there; literal concrete leaf, absent key and malformed form are distinct refusals. Mutation is atomic after validating all leaves. Original instance is retained where appropriate; written/checked-only candidates do not gain performed instance.
- Whole-object binding form is recognized before recursing. collectBindLeaves permits replacing an existing object parameter with a binding; it does not require its internal keys to match a binding's grammar keys. translateForm accepts object test values that are nonnull and contain no nested forms/state bindings.
- Without explicit test, bindStep derives the current replaced value (or existing input binding fallback). Source-only inference: this works for a concrete existing object. Missing/malformed/null/nested binding test and reserved input names remain refused. No test run in this brief.
- Existing amendment tests cover scalar/nested binds, absent new key, malformed forms, row outside repeat, written steps and preservation of original performed instance; the selected existing fixture keeps target at both input and ranWith even when the nested target representation differs. It does not cover original target key normalized to selector/element keys.
- Call-record retains declared input and separately declared ranWith. The latter is authoritative executable identity, rather than blindly executing a model-supplied tool input.
- Model feedback exposes closed refusal reason and parameter path where retained, but bind_new_key wording refers the model back to values shown by the draft. Projection/producer cause still requires the exact additional reads.

## Actual B7 artifacts, screened

Reviewed exact decisions0019/0049/0051/0053/0055, their immediate answer artifacts and preceding current draft requests; original values/control labels remain private.

| Decision | Binding request shape | Actual refusal | Supported interpretation |
| --- | --- | --- | --- |
|0019|step9 target:{$input:string,test:string}|bind_new_key|Original displayed target exists; authoritative click parameters have no target.|
|0049|step9 target.handle literal plus text binding; steps10/18 target.handle literal|bind_new_key|Literal patch leaves are not valid bind forms; named target path also absent from normalized parameters.|
|0051/0053|steps9/10/18 target:{$input:string,test:string}|bind_new_key|Same authoritative path mismatch; string fallback also fails to preserve original object shape, though not the recorded refusal cause.|
|0055|steps9/10/18 target:{$row:string}|bind_new_key|Absent authoritative target is encountered before row-span validation; no row repeat is established.|

Matching whole-test calls0066/0067/0072 show normalized selector:string/element:object (and text/submit where applicable), not target. Final0147 likewise has selector/element. These are retained executed/verified call declarations; page text/locators/fingerprint values are not copied. This supports correct missing-key refusal while revealing a possible mismatch between advertised tool input and binding parameter surface.

## Remaining bounded work

Requested readonly exact Core flow-draft/entry.ts and llm/decision-handlers/amendment.ts plus downstream node-run/run.ts. Need establish projection, actual normalized declaration producer and refusal field retention, then smallest causal fixture/fix partition. No source/test/build/type/audit/browser/provider/runtime/state/key/shared-doc/git action performed. A8 reuse is supervisor-owned and pending; no B retry.

### Approved expansion findings

Core flow-draft/entry.ts stepLine displays only step.input after binding render, not the distinct ranWith parameters. Its prose calls these the arguments the step ran with. llm/decision-handlers/amendment.ts calls the same amendment applicator over current draftSteps and carries refusal fields into model feedback. Latest actual B7 preceding request confirms parameter:target and bind_new_key were delivered; no next or executable binding affordance was provided. Thus the field is not silently dropped from actual model feedback (central answer projection omits it, but the following model request retains it).

Discovered exact downstream owner is domain/src/runtime/llm-evidence/node-run/run.ts. The initial attempted flow-creation path did not exist; no fictional file was read. Its successful/standing draft declarations intentionally pair safeCall(value,written) with nodeCall(value,flowParameters(written,ran)). Its KEPT_ELEMENT_SLOT comment explicitly says selector is domain-denied and must not appear in model-facing input. Therefore exposing ranWith or telling a model to write private selector/element is not an acceptable remedy.

Final exact import-owner node-run/node-call.ts was approved and read. webNodeFlowParameters keeps resolved ran parameters, except the documented extraction-list handle override; webNodeShownCall removes denied keys from the original written call. This is deliberate: element handles are transient page identities, while durable runnable elements are resolved. No hidden target alias or binding substitution contract exists in this owner. Generic Core must not guess Web target-to-selector translation or duplicate private identity.

## Conclusion and smallest proposed unit

**Confirmed defect:** the model-facing binding affordance/feedback describes displayed historical tool-input parameters as if they were the current parameters bindStep accepts. The underlying missing-key refusal is correct. The defect is neither failure to support whole-object bindings nor authority to bind arbitrary normalized Web targets. Original input/history and private normalized declaration must remain separate.

Recommended first fix is a generic, additive screened bindable-path projection, not a mutation-rule change:

1. Keep input unchanged as the original/model-safe tool argument. Clarify its role in authoring guidance. Add a separate bindable-parameter/path list for current runnable parameters compatible with that shown argument. Do not copy ranWith values, private selectors/element identities or old execution evidence.
2. Derive candidate paths only from the existing model-safe input parameters and require that the same path exists in ranWith ?? input with a compatible current value. Conservative source-safe recommendation: include only exactly matching existing public concrete values/subtrees (and matching already-bound public forms after the existing renderer), rather than infer equivalent identities. This is an affordance list, not a new permission/validity restriction. A compatible whole existing object can remain bindable as a unit; children may also be listed where supported.
3. For B7 click target, omit it from binding affordances and never advertise private selector/element keys. For a search/type text argument retained unchanged by normalization, advertise its public text path. Missing target binding is unavailable in this recorded runnable declaration; use the existing permitted call grammar to author the right action or bind an offered public value. Do not suggest adding a new raw locator parameter by rerun.
4. Make bind_new_key feedback truthful: the requested path has no current runnable binding target, even if an original tool-input alias is displayed. Direct the model to the current screened bindable paths and preserve the existing closed reason/path. If no public path is eligible, say so. No generic transformation/remapping, arbitrary object replacement, new model question or proof/permission weakening.

The exact descriptor naming/type and whether existing-bound paths can be included safely need supervisor review before release. This is a conservative projection recommendation, not an implemented/public API contract. A larger original-tool-alias-to-runnable binding contract is not justified by these artifacts and would require separate domain-specific design/consumers/tests. Fixing guidance does not guarantee the model authors the missing towel-cart action or passes B.

### Proposed exact source/test partition

Core only, after the supervisor releases source following both A reuses:

- Existing flow-draft/entry.ts and nearest tests/entry.test.ts: preserve original input/history; add screened current binding affordance and precise guidance. Nearest test filename was discovered only, not read in this readonly budget.
- New cohesive flow-draft/bindable/{paths.ts,index.ts,tests/paths.test.ts} plus existing flow-draft/index.ts barrel if a reusable helper is needed. One projection responsibility/function, values never emitted. Existing binding helpers already have a shared prefix; do not create another loose binding-prefixed file or raise an audit baseline.
- Existing llm/draft-amendment-feedback.ts and tests/draft-amendment-feedback.test.ts: replace the misleading 'as the draft shows' direction and point to the screened affordance. If specific per-step allowed paths are needed beside the refusal, reuse the same helper from this existing step input rather than a Web heuristic; the feedback step structural type must gain only the necessary original/current argument fields.
- Existing flow-draft/tests/amendment.test.ts: regression for valid whole-object binding at an existing compatible path, plus unchanged missing-key/malformed/refusal atomicity. Production amendment.ts/binding-forms.ts remain unchanged unless a fail-first real defect is separately reproduced.
- Downstream run.ts/node-call.ts remain unchanged. Their safe original-input/resolved-runnable separation is correct and required for privacy/durability. No wire, permission, default budget, rerun or execution policy change proposed.

### Meaningful fail-first assertions

Use fixture-owned values, no real page state/provider calls:

1. Actual draft entry fixture: input.parameters has target.handle, ranWith.parameters has a private selector/element plus common text. Current entry fails the expected additive bindable projection. After fix, text is offered; target and private locator/identity paths/values are absent; input stays byte-equivalent to its original safe shape.
2. Actual feedback fixture: a refused bind names target while normalized current declaration does not. Current wording incorrectly points back to the displayed target. After fix, feedback explains current-binding unavailability and references only screened eligible paths; it does not offer private selector/element or a forced rerun with guessed arguments. Closed reason and parameter are preserved.
3. Positive existing object case: both original/current arguments contain the same fixture-owned object at a supported public parameter path. Bind with $input and object test, and separately omit test to derive the existing object. Assert translated state binding and unchanged original instance; this is expected to pass before the projection fix and protects legal grammar.
4. Negative cases: new path, concrete nonbinding leaf, bad/reserved name, null/nested-bound test, row outside repeat, mixed valid/invalid bind leaves. Preserve existing precise refusal, atomic unchanged draft and original current/prior execution identity. No arbitrary target normalization or stale performed proof accepted.
5. Checked/written candidate projection: current eligible paths come from current declared parameters only, no old priorExecution parameter promotion; no performed:true state is manufactured. A generic tool with no ranWith uses its actual original current argument, preserving compatibility.

## Validation boundary

Ten exact owners read in total: initial six plus approved entry.ts, decision-handlers/amendment.ts, domain runtime/llm-evidence/node-run/run.ts and its node-call.ts import owner. Five named B7 decision/answer/preceding-request groups and matching existing whole-test arguments were screened; no new run or synthetic test execution. Whole-object support is source reasoning and existing adjacent tests read, not newly executed proof. No source/check/build/type/audit/provider/browser/runtime/state/key/shared-doc/git mutation; only this owned report changed. Supervisor independently accepted the B7 full debug before this investigation. No paid B retry authorized.
