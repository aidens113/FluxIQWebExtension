# P8 / CC12 Core action-effect discovery

Outcome: Done (read-only discovery)

## Concrete gap and smallest useful slice

A client-known committing action has no typed, authoritative floor which reaches both retry classification and the permission gate. Today the model can declare `consequences: []`; Core falls back to node flags or the producer's failure record. Producer `effect: ambiguous` already protects lost acknowledgements, but a throw/timeout without that producer record has no equivalent client declaration. This is the CC12 gap to close; stale-target, transience and repeat-loop work are separate slices.

One additional risk is ordering: `executor/defensive/lasting-act.ts:55` consults `automationStudioNodeRepeatIsSafe` before mutation/consequences. `node-side-effect.ts` accepts `metadata.effect/parameterValues.effect: observe` and idempotency markers as safe. A new trusted commit floor must not be checked after those legacy/model values, or it can still be downgraded. Distinguish proven client idempotency from a model-authored claim; preserve intentional idempotent actions only through a trusted declaration.

## What exists, with source seams

All paths below are relative to Core `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQ` under `packages/fluxiq/src/programs/automation-studio/` unless stated otherwise.

- `model/actions.ts:29`: `ActionDefinition` has safety metadata and free metadata, but no effect class. `runtime/adapters.ts:25` exposes `actionDefinitions()`. A source search finds no call of this method anywhere under `packages/fluxiq/src`: wiring this legacy adapter API alone would have no runtime effect.
- The active native registry is `nodes/definitions.ts:68` (`AutomationStudioNodeDefinition`), with `capabilities`, `safety`, `outputAction`, free metadata. It has no typed observe/state/commit contract. Capabilities concern executability/recovery; native safety concerns grants, network/filesystem/process requirements, not lasting consequences.
- `runtime/native-node-runtime.ts:66` exposes `getDefinition`; `execute` resolves that trusted definition before calling the implementation. It returns declared output ports, but not action effect. Timeout/catch return generic failed results. Defining a floor only on the returned result would miss an executor throw and cannot establish pre-dispatch permission.
- `runtime/service/runtime-session/graph-options.ts:54-66` is the shared normal-run/candidate-trial factory. It installs both policy-effect dispatch and native execution, but no definition-effect resolver. A narrow resolver here can obtain the native definition's trusted contract without teaching the graph browser terms.
- `runtime/executor/node-execution/attempt.ts:148` passes sideEffectClass to native host context. That classification is from the execution node; no client definition effect is currently present. Native results and built-in results then meet in effect dispatch in this file.
- `runtime/llm/harness-options/plan-parameter-resolution.ts:394` stamps model `declaredConsequences` onto plan node metadata; `draft-from-flow.ts:207` reads it back. This is a claim, not a client floor.
- `runtime/executor/defensive/lasting-act.ts:54`, `node-side-effect.ts`, and `assess.ts:75-131` decide retry safety. Builtin policy dispatch is external, but is deliberately not automatically a mutation: many outputs read/navigate/wait. Marking every web press/unknown output commit would be a behavior expansion, not a correct client fact.
- `runtime/executor/outside-graph/retries.ts:105` accepts caller node metadata and uses the same defensive policy/effect check. Any new floor needs to be passed by its callers too, not only graph runs.
- `runtime/action-permissions/declaration.ts:77,180` is the actual per-action permission seam: strict declaration parsing, effect limited to observe/mutate, client calls before taking the action. `gate.ts:304-312` treats observe as consequence-free; `gate.ts:449-455` has a second gate path which also bypasses observe. A floor must apply in both paths.
- `runtime/flow-bootstrap/action-permissions.ts` wraps exploration and plan-step checks; existing declared-class permission approval is authoring/approval-time. `graph-options.ts` explicitly says normal playback/trials do not request permission per action. Do not add new per-run prompts.

## Existing protections to preserve

- Producer `effect: ambiguous` outranks `consequences: none`; failure `retryable: true` cannot authorize another lasting act (`assess.ts:105-130`).
- `effectCheck: landed` settles as done; `not_landed` is unacted and keeps the ordinary first attempt plus three retries; unknown stops Outcome uncertain before routes/alternatives. `host-act-landed.ts` defaults absent/throw/unrecognized answers to unknown.
- A successful lasting act rejected by later verification is a real failure and is never repeated. Confirmation/verification needs positive proof repeat cannot act.
- Target/pre-dispatch failures proven unacted may retry. A commit class does not mean every failure is ambiguous or forbid all retries.
- Observation's existing exemption must remain for truthful reads; transient UI state is not automatically a lasting action.

## Minimal additive contract recommendation

1. Add a distinct optional `effectClass: observe | state | commit` and optional typed client `permissionConsequences` to the active trusted node/action declaration, retaining legacy `effect: observe | mutate` compatibility. A class does not tell whether an act moves money, deletes, publishes or creates; never infer a specific permission class from `commit` alone. Absence retains today's behavior.
2. Resolve the trusted definition contract before execution through the shared graph options factory. Merge into an execution-only node/defensive context that is used for the attempt AND its later retry assessment; do not merely enrich the native return value or persist model-supplied metadata as authoritative. For policy-output dispatch, resolve by registered output, and keep executable output validation unchanged. Outside-graph callers pass the same trusted floor.
3. `commit` makes `ActLasts` true and prevents an observe/model safe claim from making `RepeatCannotAct` true; keep explicit trusted idempotency as the only documented exception. Model consequences may raise risk; cannot lower this floor.
4. At declaration parsing/gating, union client permission classes with model consequences before the observe exemption and before recording/checking missing classes. Both gate entry points and authoring plan-step projection must see the union. Preserve evidence-grounding, instructed-authority, declined permissions and existing reset/witness checks.
5. Do not stamp every browser click commit without client evidence: generic click may navigate/filter or submit. Downstream must declare commit only where it knows, while failure ambiguous continues to cover other dispatched presses. P8 can ship useful typed generic contract plus a downstream known commit consumer without redesigning permission derivation.

## Proposed disjoint implementation ownership

- Contract/floor worker: focused new `nodes/action-effect/` contract/helper + barrel exports; `nodes/definitions.ts`; optional compatible `model/actions.ts`; `runtime/action-permissions/declaration.ts` and its colocated tests. Freeze field names/types first.
- Retry/runtime worker after contract: `runtime/service/runtime-session/graph-options.ts`, executor graph option types, `runtime/native-node-runtime.ts` as needed, execution/defensive files, outside-graph retries and colocated tests. Must not touch permission gate or contract files after freeze.
- Permission worker after contract: `runtime/action-permissions/gate.ts`, `flow-bootstrap/action-permissions.ts`/projection only as required, colocated gate tests. Must not touch retry/native files.
- Lead owns shared contract integration and documentation. Downstream worker owns the known-action classification and native/command mappings; no Core imports of browser concepts.

## Narrow acceptance cases

- Trusted commit + model consequences none + retryable generic throw/timeout: no blind retry, outcome uncertain unless host settles it.
- Trusted commit + model effect observe/idempotent claim: cannot lower floor.
- Commit with unacted or not_landed: ordinary automatic retry allowance; landed completes; unknown blocks alternate execution.
- Commit success + failed verification: never dispatch twice.
- Observe/state legacy clients preserve behavior; absent fields preserve compatibility.
- Client permission class plus model none/observe still checks/records client class; model-added classes remain; both permission gate entry paths behave alike.
- Normal graph, candidate trial, direct native/outside-graph and policy-effect paths receive the same floor. Keep registered-output validation/grants intact.

Validation: Read-only `rg` and `Get-Content` source tracing completed. No tests/builds/checks/browser/model calls run, as required during preparation and exhausted full-suite allowance.
Not verified: Runtime reproduction; downstream capability propagation; exact final field names and honest trusted-idempotency semantics require lead integration with downstream discovery.
