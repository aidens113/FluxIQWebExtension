# t905 execution-use seal design

Design only, against the accepted nonsecret owner/store. Lead acceptance: 53/53 adjacent tests, 33.59 s; matching typecheck stamp reused, 750 ms; structure audit 545 warnings / 914 baselined, exit 0. Those are lead-reported acceptance results, not checks run for this design. No source, generated output, git or shared document changed here.

## Proposed first implementation brief (29 lines; requires lead approval)

1. Role: heavy worker, gpt-6.1-sol, Max; implement only a private graph-entry input-use controller and typed child handoff.
2. C means paired Core `packages/fluxiq/src`; owned paths are exactly unit A in the table below, plus this own report.
3. Must not touch service.ts, existing input owner/store, secrets owner, node dispatch, replay/admission, task memory, result/judge, public package exports or other lanes.
4. Add runtime-safe injected authority/lease/controller contracts; import input revision/read types only from runtime/input-basis/contracts/index.ts.
5. Never import the Node-dependent runtime/input-basis value barrel, storage, paths, crypto or Node utilities into this engine unit.
6. GraphExecutionOptions receives one optional private inputUse port backed by an explicitly created run session; no new ALS/global authority.
7. The injected authority closes over trusted scope, producer authorities and source bindings; request JSON cannot nominate those authorities.
8. Preserve existing secret precedence exactly: effective inputs = {...ambientSecrets, ...options.inputs}; explicit options win.
9. Any active ambient secret context yields unknown without calling the normal snapshot authority, even when explicit inputs shadow every secret key.
10. After overlay, before runState/withholding, isolate the complete effective dictionary before the first asynchronous authority call.
11. Do not infer nonsecret status from absent ALS secrets: the trusted normal owner must still inspect actual values and their origins.
12. Validate/copy exact supported JSON without dropping fields, redacting, coercing, hashing or using invocation/repeat/trace projections.
13. Obtain an authenticated lease for that capture, verify it current, and require its executionCopy to equal the isolated dictionary exactly.
14. On successful preparation, replace this execution's private options.inputs with that execution copy; never merely attach a reference beside the original mutable inputs.
15. Mint a graph-entry seal only at executeAutomationStudioGraph's actual working-values initialization, from the same prepared options.inputs.
16. Evidence states coverage=graph_entry_inputs, never whole_execution or node_dispatch; initial unknown cannot upgrade at completion.
17. Leave original execution behavior in place when the port is absent, unsupported, unknown or ordinarily fails; record a closed unknown code.
18. Do not freeze existing node-facing objects or change public invocation input projections to obtain a stronger claim.
19. In boundary.ts, synchronously retain the full defaults, bindings, resolved call inputs and resulting child dictionary before request.frame projects anything.
20. For every actual child attempt, fork a distinct private child port inside the existing bounded-child callback, using its real signal/deadline.
21. Remove the parent's frame port from childBase; a child without an authenticated fork executes normally with unknown coverage.
22. At child graph entry, compare the raw handoff to the actual pre-overlay inputs, then seal the exact post-overlay dictionary actually consumed.
23. A missing/changed handoff, child source binding or producer authority is unknown; never choose a latest child/version or reconstruct inputs from frame.inputs.
24. Before publishing a completed observation, recheck the frame's owner/producer authority; stale/closed authority invalidates that observation.
25. Cancellation uses the supplied operation signal and exact reason; close all live leases/controllers in finally, including waiting/failed/cancelled graphs.
26. Graph-level cancellation keeps its current trace/error conversion; no new task ending, rollback claim, judge exception or persisted proof is added.
27. A seeded resume is unknown until a separately authenticated seed/variable/loop continuation contract exists; ordinary resume still runs.
28. Add the causal regressions below, first red then green; use one coordinated narrow adjacent-test/Core-type/audit job after source release.
29. Report actual endpoints, remaining node/secret/service coverage and final freeze; do not call this saved-Flow continuation acceptance.

## Actual consumption and ordering

`framework/automation-service/service/answer-first/flow-run/flow-run.ts#gatedOptions` overlays cloned caller inputs on inherited engine inputs. `service/runtime-session/graph-options.ts#runGraphOptions` itself only supplies inputs; neither location automatically merges root interface defaults. Do not invent such a merge. The service adapter must authenticate whichever layers the actual caller assembled, including their definitions, and explicitly account for an absent layer.

`engine/automation/composite/boundary.ts` creates child inputs from declared interface defaults, then overwrites them with defined explicit input bindings. No ambient parent normal values cross this boundary. It currently calls `request.frame(childInputs)` before `runChild`; `frames/child-frame.ts` projects minted/handle/evidence fields out of the item row. Child options retain the full dictionary. Root framing likewise precedes the later secret overlay. Therefore no existing call site is chronologically both after secret overlay and before child projection: retain a private full handoff before framing, then validate and seal actual effective inputs at graph entry without changing that public projection.

`graph-run.ts#runGraphToTrace` overlays ambient secrets first and explicit inputs second. The preparation seam belongs immediately after that merge and before `automationStudioRunState`, `withholding.supply`, declared-state resolution or graph execution. The consumption seam is `executeAutomationStudioGraph`'s `values = {...options.inputs}` initialization, where the prepared dictionary must actually be used, and the same prepared options must enter the loop context. A callback observing available child options without this connection is not use evidence. For a resume the initializer also incorporates seed.values, while seed variables/loops are restored separately; the first unit refuses to seal that broader context.

A graph-entry seal proves the exact initial input dictionary supplied to that execution. It does not prove the dictionary remained unchanged later, that each field was read, or which final node values were dispatched. Keep the consumed dictionary private and isolated from the original caller. Existing node-facing objects remain mutable; do not claim that before/after comparison detects an intermediate A-to-B-to-A mutation.

## Stable injected interface proposal

These are internal engine contracts, not serialized request options. Each named public type occupies its own file. The existing input owner/store contracts remain unchanged.

```ts
type InputUseLease = {
  readonly reference: AutomationStudioInputRevision;
  executionCopy(): JsonObject;
  verifyCurrent(signal?: AbortSignal): Promise<AutomationStudioInputRead<true>>;
  close(): void;
};
type InputUseAuthority = {
  open(entry: FrameInputCapture, signal?: AbortSignal):
    Promise<AutomationStudioInputRead<InputUseLease>>;
  child(boundary: ChildInputCapture, signal?: AbortSignal):
    Promise<AutomationStudioInputRead<InputUseAuthority>>;
};
```

`FrameInputCapture` contains the isolated effective values, declared-default metadata, graph/frame location and the private boundary handoff when present. It never takes projected frame.inputs as data authority. `ChildInputCapture` contains isolated full child inputs, declared defaults, exact ordered input-binding definitions, resolved call inputs and the actual parent/call/child location. Capture the value-bearing part before framing; complete location from the actual returned child frame. These captures are callback-lifetime private data, never trace payloads or evidence outputs. A missing frame/location/source correspondence returns unknown rather than inventing an identity.

`AutomationStudioGraphInputUseSession` is the proposed concrete per-run controller: construct it with the trusted authority, supply its opaque port through options, read closed graph-entry observations from that same session, and close it. Its private trace associations/child controllers belong to that instance, not an ambient registry. Only engine consumption records a seal; a request-shaped reference, manually supplied frame, copied trace JSON or other session's record cannot restore it. Do not expose a writer that accepts an arbitrary trace plus a claimed seal. Unit A needs no new persisted trace field or public package export.

The closed observation is either `{status:"sealed", coverage:"graph_entry_inputs", reference, location}` or `{status:"unknown", code}`. Reference/location contain no input values, new digest, plan bytes or secret names. Completion revalidates authority but cannot promote a failed initial preparation. A frame that never reaches consumption receives no seal. Child-attempt observations remain distinct, including failed attempts; their existence cannot be collapsed into successful whole-run coverage.

The owner adapter can implement the proposed signal-aware lease without changing `NormalInputLease.verifyCurrent()`: retain trusted scope/ref privately and delegate each check to the existing `owner.verifyCurrent(scope, ref, signal)`. Its copy/close delegate to the existing normal lease. Storage errors remain errors at the owner; this optional engine evidence boundary converts ordinary authority failures to closed unknown while execution continues. AbortError and an aborted supplied signal are not mistaken for an ordinary authority failure; propagate the exact supplied signal reason into existing graph cancellation handling. An already-started owner write may commit after cancellation; it grants no returned use seal and is not rolled back by this controller.

## Producer authority, lifetime and missing seams

The service-created authority must resolve project/task/principal/logical-producer scope from authenticated owners, not from graph inputs or a caller's claimed IDs. Inherited/default/caller/binding dependencies use the accepted ordered producer references and registered producer-owner checks. Equal effective text does not excuse a changed upstream revision or binding definition. Preserve current producer verification before use and after execution, including a producer changing without anybody re-observing the composite binding.

Existing seams: durable normal owner IDs/revisions, private immutable snapshots, exact nonsecret capture, owner current checks and per-operation cancellation; typed child binding construction; existing independently checked stamped-executable/source identity. Missing seams: actual service adapters issuing/authenticating root layer revisions, authority-to-executable/callee correspondence, and durable child-occurrence producer slots. An invocation number, call position, mutable pointer, graph revision alone or a random per-run ID cannot issue cross-attempt identity. A fork must resolve its call/child against the already pinned complete executable and current source/settings/dependencies; if it cannot, it remains unknown. The engine does not create that durable authority by naming a frame.

Close each frame lease after its final current-check and release captures in finally; waiting/parking is the end of this controller lifetime. A resumed invocation needs fresh authority and authenticated continuation state, not a reopened ephemeral seal. Cancellation listeners are operation-scoped and removed on settlement. The controller retains closed metadata only while its explicit session is live; never retain raw values after close or serialize a lease. Active/unverified secret contexts stay unknown, including secrets arriving through caller/private origins even with no ALS secret map. No secret-owner integration, copied secret-bearing rows, value hashes or redaction-marker comparison is proposed here.

## Ownership table and later units

All paths below are relative to C; only A is proposed as the next implementation unit. This report authorizes no source edit.

| Unit | Exact proposed ownership | Boundary |
| --- | --- | --- |
| A: pure engine/frame | New `engine/automation/input-use/{index,authority,port,frame-capture,boundary-capture,lease,observation,session,capture}.ts`; `contracts/graph-execution-options.ts`, `graph-run.ts`, `composite/boundary.ts` beneath `engine/automation` | Type-only input-owner contract imports; explicit private session; graph-entry coverage only. Existing frame/public projections stay unchanged. |
| A: tests | New `engine/automation/input-use/tests/session.test.ts`, `engine/automation/tests/input-use.test.ts`, `engine/automation/composite/tests/boundary.test.ts` | Pure controller, real graph execution and typed boundary regressions; no browser/provider/storage wiring. |
| B: trusted producer/service adapter | New `framework/automation-service/service/input-basis/execution/{authority,producers,index}.ts` and its `tests/`; later `service/runtime-session/graph-options.ts`, `service/answer-first/flow-run/{ports,flow-run}.ts` and adjacent tests | Separate brief after t911 lands. Main `framework/automation-service/service.ts` belongs to t911 now; any later wiring needs an agreed typed authority seam, not an overlapping edit. No real producer authority is claimed by A. |
| C: node-use coverage | `engine/automation/node-execution/attempt.ts`, `parameter-refresh/inputs.ts`, new `input-use` node-capture types/controller support and adjacent tests; `runtime/native-nodes/native-node-runtime.ts` only if exact implementation-consumption proof needs its own typed hook | Separate serial unit after A; no whole-execution proof until resolved/default/wired/refresh coverage is complete. |

Node gaps are concrete. `parameter-refresh/inputs.ts` resolves against `{...options.inputs, ...variables, ...values, ...nodeInputs}`; later layers win. Parameter fallback/default definitions belong to executable identity, while their actual selected values require use coverage. `node-execution/attempt.ts` can then apply a target-refresh overlay. Built-ins receive resolved parameters plus collected node inputs; native dispatch receives Flow inputs overlaid by wired inputs, and the native runtime filters to its declared ports. Composite calls resolve their own inputs before crossing the typed boundary. Variable/output/wired/default-selection/refresh changes are therefore uncovered by A; mutation of a child handoff before its entry check and any stale frame producer explicitly invalidate A. A global whole-execution status stays unknown until C and executable/source composition establish every required use. A must not silently broaden its entry seal.

## Causal acceptance regressions for A

- Run a real graph that reads/echoes inherited inputs and explicit overrides: authority receives the exact dictionary, and the executed callback reads the same prepared values. Change the caller object while authority is gated; execution uses the isolated prepared copy. Returning a different lease copy yields unknown and preserves ordinary input behavior.
- Through the real typed boundary, defaults fill absent ports; explicit bindings preserve null/false/zero and overwrite defaults; ambient parent inputs remain absent. Assert raw item.handle/evidence fields reach authority and actual graph resolution while existing child-frame projection still omits them. An intermediary changing child inputs after handoff yields unknown.
- Ambient secret overlay preserves precedence at actual execution, including an explicit shadow; any active secret context invokes no normal persistence authority and gives unknown. Trusted secrecy rejection with no ambient map also remains unknown; identical withheld markers never establish equality.
- Change only a producer/default/binding revision while effective values remain equal; authentication rejects stale evidence. Gate execution, change a producer without composite re-observation, then finish: no completed current seal. Distinct children and repeated whole-child attempts obtain distinct controllers; missing/mismatched/foreign forks do not inherit the parent seal.
- No authority, ordinary authority failure, unsupported JSON, never-consumed entry, wrong-session/JSON-reconstructed evidence and initial-unknown-then-available all stay unknown with ordinary execution preserved. Seeded resume/park-close/reopen never manufactures coverage of seed state.
- Abort during root/child authority and before consumption/completion: pass the exact signal/reason, return no sealed observation, close once and remove listeners. Preserve existing graph cancellation semantics; a committed owner write is not claimed rolled back.
- A node changes variable/wired/target-refresh values after entry: the observation still declares entry-only coverage and the aggregate cannot become whole-execution proof. Node-use regressions that distinguish the actual dispatch values belong to C, not a pretend A acceptance test.

No tests were run for this design. On approval, use adjacent tests only, Core typecheck and unchanged structure audit through the coordinator; the lead independently verifies before acceptance. Browser replay, effect witnesses, task/result-contract proof, persistence/admission and judge behavior are outside every claim in this report.

## Return contract

Outcome: Done (read-only execution-use design).
Changed: docs/working/mvp-launch-plan/reports/codex-t905-execution-seal-design.md only.
Validation: Read approved design/implementation and owner/store contracts; traced real graph, child-boundary, input-resolution and native-consumption code. No tests, builds, browser, paid calls, source edits or git.
Not verified: Proposed interfaces/implementation, service producer authority, durable child occurrence identity, node-use coverage, secret continuity, whole-run/replay admission or effect witnesses.
Report: docs/working/mvp-launch-plan/reports/codex-t905-execution-seal-design.md
Notes: Next unit is pure engine/frame only and needs approval. Service authority wiring waits for t911. Existing source/dist freeze is preserved.
