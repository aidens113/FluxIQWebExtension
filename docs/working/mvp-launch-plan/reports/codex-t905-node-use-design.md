# t905 node-input consumption design

Design only. Unit A is independently accepted by the lead: 82/82 tests, 63.92 s; matching typecheck stamp 870 ms; audit 546 warnings / 914 baselined, exit 0. That acceptance predates the newly identified captured-row reachability concern below. No source/dependency, generated output, shared document or git changed for this report; no tests/build/browser/provider calls were run.

## Priority: A's copy can lose captured-row identity

Reachable source path: `records/capture.ts` puts the same validated array/row objects into result and records outputs; `runState.records.record` registers them by object identity. Parameter resolution can bind `extract.records` into a Call Subflow's `inputs`. `frames/call-subflow.ts` passes those objects through `call.inputs` into `composite/boundary.ts#childInputs`. A's child lease executionCopy and `input-use/frame.ts#Capture.object(..., false)` then deep-copy them before the child runner initializes values. A child constant can hand that cloned array back through an output binding. The parent includes child-owned capture maps, but the echo child captured no new rows; its clones are absent from the parent's existing `records/summary.ts` map.

The parent's scalar withholding may still hide supplied text/numbers; that is not preservation of dataset/row markers and does not cover every value kind. This reading proves an identity/withholding-contract risk, not a tested plaintext disclosure. A normal authority may truthfully approve nonsecret JSON yet know nothing about record-trace identity; secrecy approval does not establish copy compatibility. `components/automation/data/shared.ts#keptJsonValue` explicitly preserves record references for this reason.

Proposed causal regression, before any repair: run a synthetic parent extract with recordOutput, then typed Call Subflow binding `items = extract.records`, then child constant echo, then bind that output into the parent. Compare with/without an accepting normal input authority. Require unchanged real array/row reference identity, dataset markers in the parent's saved outputs/values, no raw row text, and excluded fields absent. The current A copy can return different objects despite equal values. Use the existing graph-run captured-record fixtures and the actual typed boundary; do not infer a pass from scalar redaction alone.

Exact proposed negative guard: `graph-run.ts#runGraphWithInputs` privately connects the live frame controller to its actual `runState.records` owner before node execution. Before boundary handoff cloning, internal input-use integration asks that owner whether ORIGINAL nested inputs/defaults/call values contain registered arrays/rows. `records.captured()` supplies a current identity map; inspect original references with cycle-safe traversal. Known captured context => unknown input-use evidence, no normal authority/copy, and ordinary original objects continue to the child. Checking after Capture.object or only in `Controller.child` is too late. Keep records.summary, its issued-marker checks and identity-only matching unchanged; no value matching, hash, ordinal-as-identity or caller-supplied marker.

This guard needs a separate approved repair brief before C. Proposed owned repair paths: existing `engine/automation/{graph-run.ts,composite/boundary.ts,input-use/controller.ts,input-use/integration.ts,input-use/frame.ts,input-use/unknown.ts}`; focused new `input-use/owned-capture/{index,context}.ts`; existing `tests/input-use.test.ts` and `composite/tests/boundary.test.ts`. Do not edit records.summary. A root/inherited input from an earlier or unrelated run has no automatically available capture map: B must authenticate its source/copy-compatibility through the existing private dataset/input owner. Shape or nonsecret status cannot establish that origin; absent provenance stays unknown. The local negative guard must not be described as solving that root-origin gap.

## Proposed C1 implementation brief (30 lines; unapproved)

1. Heavy worker, gpt-6.1-sol, Max; implement node-invocation value coverage only, after the A captured-context issue is closed.
2. C means paired Core packages/fluxiq/src; own only C1 rows of the table, plus this own report.
3. Do not edit service.ts/B/t911, input storage/owner, result/judge/admission, task memory, secrets, public exports, baseline or generated output.
4. Put all new cohesive node contracts/controllers under engine/automation/input-use/node/; add no new flat files to A's 18-file root.
5. Extend the existing trusted authority with an OPTIONAL node(capture, signal) lease method; absent authority yields unknown.
6. Keep session.port methodless; only internal engine integration opens/consumes/completes a private node occurrence.
7. Maintain one private occurrence object per actual execute call; identical node/attempt/frame strings never substitute for owner authority.
8. Record each consumer branch separately: builtin execute, native callback, composite callback or Call Subflow helper.
9. Retain current resolution order and retry behavior; recapture each actual retry after that attempt's fresh target overlay.
10. Resolve parameters as today, including node-output path rewriting and fallback selection; do not rerun resolution after an added proof await.
11. Capture the exact input/parameter pair immediately before the chosen callback, after existing host/repeat checks and target refresh.
12. Builtin/composite inputs are current values plus wires; native callback inputs are Flow inputs plus wires, collected at actual dispatch.
13. Never substitute a repeat sample, trace projection, declared-port-only projection or earlier frame dictionary for those inputs.
14. Do not merge parameter schema defaults: those are not automatically applied by this engine/native runtime.
15. Snapshot/isolate supported copy-compatible normal values before the first evidence await; known owned rows and unverified origins stay unknown.
16. Verify the node lease/current producers, compare its full executionCopy exactly, and pass that prepared pair into the real callback.
17. For native/composite/subflow calls, the executionNode.parameterValues must also be that prepared parameter copy.
18. Only the actual callback invocation records node_invocation_values coverage; preparing or resolving values alone cannot mint it.
19. Keep mutable variables/iteration/time/random/host ports unchanged and explicitly uncovered; do not replace their semantics with snapshots.
20. Missing bindings, unavailable definitions, denied dispatch and synthetic readiness/gone attempts produce no invoked-value seal.
21. An undefined native callback result does not prove native implementation entry; the subsequent composite callback has its own event.
22. No child, effect-dispatch or final native-consumption claim follows from the outer callback event.
23. Recheck the owning lease/producer before completion; initial unknown cannot upgrade and stale authority cannot retain a current seal.
24. Close per-attempt copies/leases in finally on success, failure, waiting, exception, retry, session close and cancellation.
25. Forward each actual attempt/region/native signal and exact reason; preserve existing run/attempt/landed-act traces after execution.
26. Contain late malformed results and disposal failures with A's guarded operation helper; valid late leases close once.
27. Absent/unknown proof preserves ordinary execution/reference behavior; absent proof adds no asynchronous input-capture boundary.
28. Expose closed node metadata via the same session's read-only graph association; no public arbitrary-trace writer or copied-JSON restoration.
29. Add the causal regressions below, then narrow adjacent tests/Core type/audit through one coordinator job after release.
30. Report node-only scope and missing B/C2/C3 coverage; no aggregate whole-execution, judge exception or new task ending.

## Actual consumption boundaries

| Boundary | Actual values and remaining distinction |
| --- | --- |
| Resolver | `graph-navigation/inputs.ts#collectNodeInputs` = values then wires. Wire traversal ignores target in/missing sources; a later matching edge overwrites an earlier one. `parameter-refresh/inputs.ts` resolves rewritten authored parameters against Flow inputs, variables, values, then collected inputs; later layers win. Resolved values are not recursively treated as further bindings. |
| Refresh/retry | Each `NodeAttemptExecution.execute` resolves again. Arrival overlays in graph-run can replace nodeValues; parameter-refresh applies only its validated matching write-set/baseline and can deactivate after a binding change. Capture final executionParameters, including removals, not merely the original resolved map or advertised target. Missing paths return before invocation. |
| Builtin invocation | `definition.execute` receives collected inputs plus final executionParameters, and live variables/iteration/environment/host ports. Definition construction normalizes visual ports, not parameter defaults. Constant/get-variable/action execute code selects defaults itself; omission and explicit null remain distinct at this boundary. |
| Native callback | Attempt code passes final executionNode and a newly assembled Flow-input-plus-wires dictionary. Under required commandRun this direct native callback is not called; supported trusted builtin effects/composites take their existing paths. No bare upstream output fills an unwired native port. |
| Native implementation | `native-node-runtime.ts#execute` first resolves definition/version/binding/grants, filters supplied values to declared ports, then calls binding.implementation with shallow-frozen inputs/parameters and its own AbortController signal. It does not generically merge parameter defaults. Outer callback evidence cannot prove this final filtering or implementation entry. |
| Composite/child | Composite callback receives executionNode, collected inputs and child options. Call Subflow parses resolved parameter inputs into exact child bindings; the typed boundary then applies child interface defaults and bindings. Parent invocation, child graph-entry and each child node invocation are distinct events. |
| Effects and mutable ports | policy.action constructs a new defaulted payload before dispatchAutomationStudioEffects calls the actual dispatcher; records.write and ask effects have other owners. variables Map and iteration.get/set are live; implementations can read/change them independently of the captured pair. Captured-row copies require the owner guard above. |

## Stable interface proposal

```ts
type NodeUseValues = Readonly<{ inputs: JsonObject; parameters: JsonObject }>;
type NodeUseLease = {
  readonly reference: InputRevision;
  executionCopy(): NodeUseValues;
  verifyCurrent(signal?: AbortSignal): Promise<InputUseRead<true>>;
  close(): void;
};
// Optional method on the existing injected authority; no engine storage/Node imports.
node?(capture: NodeUseCapture, signal?: AbortSignal): Promise<InputUseRead<NodeUseLease>>;
```

`NodeUseCapture` privately carries the exact pair, selected consumer kind, frame reference/location, resolved-binding/refresh context and the private occurrence association. Its human-readable attempt/node/frame IDs are labels only. Producer authority must come from B's authenticated input/default/caller/binding owners, current complete stamped executable/dependencies/settings, actual value-producing occurrences and target-refresh owner; none can be inferred from a pointer, loop ordinal, node ID, random invocation ID, equal text or digest of private values. No new node producer implementation is assumed here.

The controller's consume operation takes a callback thunk owned by actual engine dispatch and supplies the prepared pair directly to it. No public session/handle operation accepts an arbitrary attempt/trace plus a seal. Use a session-private occurrence ledger and read-only `readNodes(graphTrace)` association at the existing final graph association seam: final attempts and saved traces are copied/rewritten, so an unverified ID lookup or copied attempt object cannot restore identity. Concurrent runs, repeated nodes, nested frames, retries and multiple callback branches retain separate private events. These ephemeral objects prevent mix-ups within one session; they are not B's missing durable producer/child-occurrence identity.

The node pair intentionally excludes the live variables Map/iteration/RNG/clock/expectation ports. Capturing their before/after values cannot detect intervening reads or A-to-B-to-A mutations. `set-variable` preserves record references and reads existing variables for merge/append; `iterationFor` returns a live object through get. A later typed state-owner/read/write contract is required before covering those ports. No cloning of them, declared-default normalization or broad trusted-builtin/name heuristic belongs in C1.

## Proposed file ownership and later boundaries

| Unit | Exact proposed paths relative to C | Limit |
| --- | --- | --- |
| C1 node invocation | New `engine/automation/input-use/node/{index,values,capture,lease,observation,authority,port,controller,integration}.ts` and tests; existing input-use/{authority,controller,frame,integration,session,index}.ts; node-execution/attempt.ts; parameter-refresh/inputs.ts only if a raw resolution/refresh capture seam is necessary; new node-execution/tests/input-use.test.ts | New files remain below directory/depth budgets. No public writers; no service/owner/native implementation edits. Reuse accepted exact-JSON/operation helpers and A's separately approved captured-context guard. |
| C2 final native/effect consumption | Later runtime/native-nodes/{native-node-runtime.ts,index.ts}, new adjacent tests; engine contracts/graph-execution-options.ts, node-execution/attempt.ts and input-use/node support | Optional per-attempt opaque handoff into runtime.execute, never into untrusted implementation context. Seal after actual declared-port filtering from prepared copies. Capture emitted effect payload at the actual dispatcher after builtin defaults. Legacy/custom executors missing the bridge remain unknown. |
| B transport/producers: held | service/runtime-session/graph-options.ts and service input-basis adapters, plus the t911-owned service.ts authority seam, under a separate brief after that lane lands | Current native wrapper forwards only node/inputs/signal/hostContext; it would drop a new node-use port. B must forward it explicitly and authenticate registry binding/current executable/default/producer/occurrence identity; C cannot declare production final-native coverage before that bridge. |
| C3 live state/aggregation: separate | Engine state/iteration owner seams and typed context contracts; exact paths require their own approved design | No generic revisioned variable/iteration owner exists in the inspected path. Future immutable dataset origin support must reuse its owner without copying secret-bearing rows. No Map snapshots or transient IDs as durable authority. |

## Causal acceptance and completeness

- Use real callbacks to inspect prepared pairs; mutate caller/state objects during gated authority work and require the captured pair to be the pair invoked. Reject different lease copies while preserving ordinary inputs/parameters. Change only binding/default/producer revision or target-refresh/removal and require invalidation or a newly authenticated occurrence.
- Prove wire precedence, no unwired bare-output injection, variable/value precedence, node-output alias rewrite, fallback selected versus missing path, omission versus null/false/zero, and changed retry/refresh values. Assert no automatic schema-default merge. Preserve normal-path timing with no proof.
- Cover every callback branch, undefined-native fallthrough, denied/unresolved/not-shown/gone paths with no false invocation, actual exceptions/failures/waiting, repeated identical nodes and concurrent/nested same-ID attempts. A callback-input seal never substitutes for native filtered-input, child entry, emitted-effect or mutable-port evidence.
- Reuse the captured-row baseline/authority regression above at node input and parameter positions. Unknown owned contexts execute original references and retain dataset/row markers; excluded fields remain absent. Unsupported/active/unverified secret origins call no normal persistence authority; equal withheld markers grant nothing.
- Attack public handle/constructor/prototype/JSON/manual-trace paths; foreign/session/retry/native-consumption capabilities cannot install or adopt evidence. Gate cancellation before invocation and during final freshness; preserve exact signals/reasons and existing attempt/act traces. Test late malformed status/value, failing disposal and exactly-once valid cleanup.

C1 returns component observations, not an aggregate-complete flag. A future argument-coverage aggregate can be complete only against a private enumeration of every required actual consumer event, with authenticated producer/executable/occurrence correspondence, every required native/effect/child boundary present, no unknown or uncovered input/state port, and current final owner checks. Synthesized/never-invoked events need engine-owned disposition, not absence from an external trace. Even complete argument coverage would not establish task/result-contract success or a post-clearance host-effect witness. B, C2/C3, secret continuity and Apply-effect evidence are missing; judging/admission remain unchanged.

## Return contract

Outcome: Done (read-only C design, with prior A privacy dependency identified).
Changed: docs/working/mvp-launch-plan/reports/codex-t905-node-use-design.md only.
Validation: Read-only inspection of accepted A contracts/implementation, actual resolver/wire/refresh/dispatch/native/default/variable paths and record-summary identity ownership. No tests, builds, browser, provider, source/dependency writes or git.
Not verified: Proposed A guard/regression, C implementation/interfaces, B transport/producer/occurrence authority, native/state completeness, secrets, host effects or replay admission.
Report: docs/working/mvp-launch-plan/reports/codex-t905-node-use-design.md
Notes: A captured-context repair needs its own approval before C. Service B waits t911. No source expansion or judge claim is authorized.
