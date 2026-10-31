# P8 action-effect contract checkpoint

Outcome: Done (Phase 1 only; source frozen for lead acceptance)

Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQ`.
No executor, service, native-runtime implementation, permission-gate, or legacy `model/actions.ts` edits.

## Frozen public interface

Published by `fluxiq/automation-studio/nodes` (and the existing root Automation Studio barrel):

```ts
type AutomationStudioActionEffectClass = "observe" | "state" | "commit";

type AutomationStudioNodeActionEffect = {
  effectClass: AutomationStudioActionEffectClass;
  commitWhen?: string;
  permissionConsequences?: readonly AutomationStudioActionConsequence[];
};

type AutomationStudioResolvedActionEffect = {
  effectClass: AutomationStudioActionEffectClass;
  permissionConsequences: readonly AutomationStudioActionConsequence[];
};

function resolveAutomationStudioNodeActionEffect(
  definition: Pick<AutomationStudioNodeDefinition, "actionEffect" | "parameters">,
  parameterValues?: Readonly<Record<string, unknown>>
): AutomationStudioResolvedActionEffect | undefined;

function readAutomationStudioResolvedActionEffect(
  value: unknown
): AutomationStudioResolvedActionEffect;
```

`AutomationStudioNodeDefinition.actionEffect?: AutomationStudioNodeActionEffect` is the trusted definition field.
`AutomationStudioActionDeclaration.actionEffect?: AutomationStudioResolvedActionEffect` and its parsed form carry an optional resolved client floor. Legacy `effect: observe | mutate` remains unchanged; an absent new field is omitted from the parsed object, preserving existing declaration shapes.

## Resolution and trust rules

- No actionEffect returns undefined. Model `metadata.actionEffect`, `metadata.effect`, idempotency claims, and parameter fields with those names do not establish or lower a floor.
- `commitWhen` must name an existing boolean parameter, with a boolean default when one is declared. An explicit boolean false preserves the base class; an absent value uses the trusted parameter default. True, absent-without-default, explicit undefined, null, malformed values and unresolved bindings raise to commit. A binding with a false fallback is still unresolved until its caller actually resolves it.
- **Runtime integration must preserve unresolved parameters when calling the resolver.** Dropping a failed binding before this call could make it look absent and incorrectly apply a false default. Resolve from raw values or retain unresolved slots until the floor is determined.
- Known client permissionConsequences are always present in the resolved result, deduplicated in the existing Core order. Any nonempty known class list raises the effect class to commit even if a predicate is false or the base class says observe/state. Commit alone introduces no money/delete/etc class.
- The resolved parser is strict: both fields are required, unknown fields/predicates/classes fail, sparse/unknown consequence slots fail, and a known class beside an unknown one refuses the whole contract. It is a shape parser, not a trust mechanism; only a trusted client definition/callback may supply authoritative values.
- Canonical definition validation rejects bad fields with `node.invalid_action_effect`. Declaration parsing rejects a bad resolved field with `AutomationStudioActionDeclarationError("action_effect_invalid")`.
- Declaration parsing retains model consequences and the client floor separately. Union and observe-exemption precedence belong to the permission follow-up, not this checkpoint.

## Closed consequence ownership

The existing consequence vocabulary and its pure functions now live in `model/action-consequences/`, with one export per source file. `runtime/action-permissions/consequences.ts` re-exports the same existing names. No consequence strings, order, phrases, parser bounds, error messages, absent semantics or public runtime names changed.

This avoids a nodes-to-runtime value dependency. The new node effect files use the narrow pure model directory; the only definition import from the resolver is type-only.

## Changed paths

All implementation paths below are under Core `packages/fluxiq/src/programs/automation-studio/`:

- `model/action-consequences/{values,types,phrases,is-consequence,in-order,parse-permitted,index}.ts` (new pure home of existing consequence contract).
- `nodes/action-effect/{effect-class,definition,resolved,read-resolved,resolve,index}.ts` (new contract and pure resolution).
- `nodes/{definitions,index}.ts` (field, validation and public exports).
- `runtime/action-permissions/{consequences,declaration}.ts` (compatible reexports and strict additive declaration field).
- New tests: `nodes/action-effect/tests/{resolve,read-resolved}.test.ts`, `nodes/tests/action-effect-definition.test.ts`, `runtime/action-permissions/tests/{action-effect-declaration,consequences}.test.ts`.
- Existing test extended: `runtime/tests/native-node-runtime.test.ts` now owns the native getDefinition/SDK/clone/JSON roundtrip case. The temporary new `runtime/tests/native-node-action-effect.test.ts` was removed during lead acceptance; no other test file was removed.

## Observed validation

Working directory for the commands: Core `packages/fluxiq` in t824.

`pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/resolve.test.ts src/programs/automation-studio/nodes/action-effect/tests/read-resolved.test.ts src/programs/automation-studio/nodes/tests/action-effect-definition.test.ts src/programs/automation-studio/runtime/tests/native-node-action-effect.test.ts src/programs/automation-studio/runtime/action-permissions/tests/action-effect-declaration.test.ts src/programs/automation-studio/runtime/action-permissions/tests/consequences.test.ts src/programs/automation-studio/runtime/action-permissions/tests/declaration.test.ts --maxWorkers=2 --minWorkers=1` -> **7 files, 24 tests passed**, 43.37 s.

The last small parser hardening materialised sparse consequence slots before strict reading. After it:

`pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/read-resolved.test.ts --maxWorkers=2 --minWorkers=1` -> **1 file, 3 tests passed**, 703 ms.

The registration tests prove the field survives structuredClone, JSON serialization, canonical manifest registration, native SDK copies, listDefinitions and getDefinition. Native implementation call count remains zero. Tests cover absent legacy clients; all three classes; true/false/default/missing/binding parameters; model observe/idempotent/empty claims; fixed-class precedence; strict new declarations; unknown consequence refusal; and preservation of the old public consequence API.

Initial `pnpm exec ...` was blocked before test launch by PowerShell's disabled script policy (`pnpm.ps1`). Running the same CLI via `pnpm.cmd` completed successfully; no policy was changed.

Not verified by this worker: package types/builds/structure audit (not authorized in this brief); runtime floor propagation; retry/throw/timeout handling; permission union and both gate entries; browser behavior. No full suite, live action, paid API, browser or panel run; no mutating git. The later owning native-runtime test rerun uses its existing local fake implementations.

## Lead-acceptance structural corrections

The lead independently reran the initial seven files (24/24 passed) and Core's package check (passed). Its audit found exactly two structural failures from this checkpoint: the new conditional property spread in `runtime/action-permissions/declaration.ts`, and a 26th source file in `runtime/tests/`.

The parser now creates an explicitly typed `AutomationStudioReadActionDeclaration`, assigns `actionEffect` only when present, and returns it. No contract field arrives via a spread, and absent declarations still omit the new property. The native registration case now extends existing `runtime/tests/native-node-runtime.test.ts` using its typed fixtures. The added one-case file was removed; the existing test is 299 lines and `runtime/tests/` is back to 25 files. No baseline changes or runtime implementation changes.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/action-effect-declaration.test.ts src/programs/automation-studio/runtime/action-permissions/tests/declaration.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1` -> **3 files, 27 tests passed**, 33.35 s. This includes the preserved native roundtrip case and all 17 existing native-runtime cases.

`git diff --check` -> exit 0, no output. The lead still owns the final structure-audit acceptance.

## Phase 1 handoff (historical)

Lead independently accepts this contract before dispatching its parallel permission and web consumers. Runtime follow-up must resolve the floor before dispatch, retain it through throw/retry paths, and never promote free node/model metadata into trust. This worker stopped at the requested source freeze.

## Phase 2 runtime checkpoint

Outcome: Done; source frozen for independent lead verification. Phase 1 fields stayed frozen. Permission, authoring projection, package/version/public-subpath and downstream edits belong to the lead/peers, not this worker.

### New method and helper

```ts
// Pure nodes/action-effect export, also on the lead's pure public subpath.
function combineAutomationStudioResolvedActionEffects(
  effects: readonly (AutomationStudioResolvedActionEffect | undefined)[]
): AutomationStudioResolvedActionEffect | undefined;

// Canonical native registry and registered-output lookup; bound by graph-options.
AutomationStudioNativeNodeRuntime.resolveActionEffect(
  node: AutomationStudioFlowNode,
  parameterValues?: Readonly<Record<string, unknown>>
): AutomationStudioResolvedActionEffect | undefined;

// Additive trusted caller input on automationStudioDispatchWithNodeRetries.
actionEffect?: AutomationStudioResolvedActionEffect | undefined;
```

The shared `automationStudioRunGraphOptions` installs the lead's optional `resolveActionEffect` callback from the native runtime, for normal/trial runs and inherited child/resume options. Direct native definitions resolve their own typed field. `builtin.policy.action` resolves the registered output's canonical definitions using the wrapper's `outputId` and nested `parameters`; all matching known floors/classes are unioned conservatively. Unknown outputs acquire no executability; existing IO registry, output-action boundary, version, domain and grant checks remain in place.

### Execution-only state and ordering

Each graph execution owns `runState.actionEffects: Map<nodeId, resolved>` and `runState.dispatchedActions: Set<nodeId>`. Neither enters authored metadata or saved traces. Child frames construct separate run states; internal source reruns copy both collections. No module-global trust map was added.

A fresh executed pass clears the previous pass's entries, seeds the conservative raw canonical floor before its first await, then replaces it with the actual resolved-parameter floor before dispatch. Unresolved slots are retained by using raw parameters whenever resolution has missing paths. An actual resolved false specializes the conditional class; absent/default-false and unknown binding remain distinct. A late native-emitted policy output can raise the same map entry immediately before its dispatcher is called.

The dispatch phase is recorded immediately before entering a native/composite/child/effect callback capable of acting. Framework-only preparation does not mark an action made. Lookup/parameter/version/grant refusals and exceptions before any such callback carry explicit `unacted` evidence. A region timeout consults the same current-pass phase flag, so an in-flight act remains ambiguous, while a preparatory timeout proves no action was dispatched. An attempt whose before-action snapshot arrives after cancellation is prevented from dispatching later.

The explicit floor is threaded through fault assessment, retryability, ladder repeat decisions, effect checks, recorded-effect verification and failure continuation. Commit outranks model observe/idempotent/idempotency-key/empty consequences/record-output/replay-safe claims. A state class raises mutation/host context and does not itself promise observation or idempotency; existing explicit legacy idempotency behavior is retained for state, with no exception for commit. Specific permission classes are never inferred from commit alone.

The completed-act, lifecycle replay, state-route reopen/repeat and source-reacquire checks also consume the trusted floor, preventing an alternate path from treating a client-known commit as a harmless read. Planned-path checks use canonical raw values conservatively; immediate attempt/retry assessment uses that execution's retained resolved entry.

Outside a graph, the caller's optional resolved contract is strictly read before the first dispatch. Bare failed readings and failure records without producer effect metadata cannot erase commit. Positive landed/not_landed and explicit unacted retain their existing precedence and automatic retry allowance. A generic throwing dispatch still rejects after one call: Core never invents a result of arbitrary T. The web peer converts its own gateway exception into its typed unknown result, without exception text, so that path can return `lastingAct: uncertain` through this same helper.

### Exact Phase 2 changed paths

Under Core `packages/fluxiq/src/programs/automation-studio/`:

- `nodes/action-effect/{combine,index}.ts`; `nodes/action-effect/tests/read-resolved.test.ts`.
- `runtime/native-node-runtime.ts`; `runtime/service/runtime-session/graph-options.ts`; `runtime/tests/native-node-runtime.test.ts` (484 lines; no new flat runtime test file).
- `runtime/executor/{graph-run,node-execution,run-state,ladder-run,retry-policy,transition-comparison}.ts`.
- `runtime/executor/defensive/{assess,continuation,lasting-act,node-side-effect}.ts`; new `defensive/tests/lasting-act-client-floor.test.ts`.
- `runtime/executor/node-execution/{attempt,failure,recorded-effect}.ts`; new `node-execution/tests/action-effect-frames.test.ts`.
- `runtime/executor/outside-graph/retries.ts`; new `outside-graph/tests/action-effect.test.ts`.
- `runtime/executor/lifecycle/replay-restriction.ts`.
- `runtime/executor/state-routing/{decision,reopen,repeated-act}.ts`.
- `runtime/executor/step-loop/{already-done,ask-or-park,failed-attempt,lifecycle-route-guard,uncertain-stop}.ts`.
- `runtime/executor/target-reacquire/{read-only-source,source-rerun,step-reacquire}.ts`.

The new graph-option field itself was authored/frozen by the lead; this worker did not edit `contracts/graph-execution-options.ts`. No permission/projection, service.ts, recovery annotation, downstream, package, version, authored architecture or baseline edits by this worker.

### Phase 2 observed checks

All commands below ran in t824 Core `packages/fluxiq`, through `pnpm.cmd`, with `--maxWorkers=2 --minWorkers=1`. No package build/typecheck/audit/full suite, paid API, browser, panel or mutating git command ran in this phase.

1. Initial focused additions:

`pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/read-resolved.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1` -> **5 files, 39 tests passed**, 30.61 s.

2. Added the real For Each conditional-order and canonical graph proof branches; ran nearby existing regressions:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/continuation.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/retries.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/interrupted-act.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/reacquire.test.ts src/programs/automation-studio/runtime/executor/tests/defensive-policy.test.ts src/programs/automation-studio/runtime/executor/tests/ladder-run.test.ts src/programs/automation-studio/runtime/executor/tests/transition-comparison.test.ts src/programs/automation-studio/runtime/executor/lifecycle/tests/replay-restriction.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/repeated-act.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/reopen.test.ts src/programs/automation-studio/runtime/executor/target-reacquire/tests/lineage.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/recorded-effect.test.ts --maxWorkers=2 --minWorkers=1` -> **15 files, 175 tests passed**, 35.67 s.

3. After moving raw-floor seeding before the first await:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts src/programs/automation-studio/runtime/executor/tests/graph-run.test.ts --maxWorkers=2 --minWorkers=1` -> **5 files, 102 tests passed**, 36.41 s.

4. Final phase-aware pre-dispatch proof/cancellation hardening:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts src/programs/automation-studio/runtime/executor/tests/graph-run.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/tests/defensive-policy.test.ts --maxWorkers=2 --minWorkers=1` -> **6 files, 124 tests passed**, 38.14 s.

`git diff --check` -> exit 0, no whitespace errors (Git only printed its existing LF-to-CRLF checkout notices). `runtime/tests` remains 25 files; the largest edited attempt module is 503 lines.

The tests prove:

- Canonical native generic throws and timeouts dispatch once under hostile observe/idempotency/none metadata; direct host context cannot be lowered to none.
- Canonical policy IO dispatch unions matching output definitions; an emitted output raises an otherwise undeclared native floor before a dispatcher throw; unknown outputs remain non-executable.
- Actual canonical graph landed succeeds after one act; unknown holds once; not_landed and explicit unacted retain four attempts. Success rejected by host verification is not dispatched again.
- Real For Each uses the same node ID with submit true→false and false→true; each pass gets its own class, and a committing pass's unknown outcome cannot inherit the observation pass's exemption.
- Actual nested invocation frames reuse the same node ID in both observe/commit directions without overwriting their parent/child floors.
- A synthetic in-flight timeout keeps commit and ends uncertain. A preparatory snapshot timeout has zero dispatches, proves unacted, and still has zero dispatches after its late snapshot is released.
- Missing bindings retain commit rather than defaulting false but still prove unacted; an actually resolved false specializes honestly. Lookup failure invokes no native action.
- Outside-graph strict contracts, bare/timeout failures, hostile metadata, all proof branches, legacy read retries and one-call generic rejection behave as specified.

Not verified by this worker: package typechecks/builds and structure audit, compiled/public-subpath artifacts, downstream browser/live behavior, or permission/authoring projection peer integration. Lead owns independent final verification. A trusted resolver throwing in a pre-arrival planned-path guard ends the graph before action; that case may have no node attempt row, which follows the existing graph fault boundary rather than acting without a floor.

## Final acceptance corrections and child-uncertainty propagation

Outcome: Done; source frozen again. The lead authorized this bounded extension after source inspection found a container-level bypass.

### Audit/type corrections

- Expanded only the new multi-statement callbacks flagged by the lead in `executor/node-execution/tests/action-effect-frames.test.ts` and `runtime/tests/native-node-runtime.test.ts`. No baseline changes. The native test is now 487 lines.
- Made the outside-graph test's effect-check callback async, matching its Promise contract.
- Added `resolveActionEffect` to `AutomationStudioStateRouteInput.options`' existing Pick, so the new canonical floor projection is available through that typed input.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1` -> **2 files, 30 tests passed**, 37.01 s, after the formatting corrections.

### Reproduced container bypass

`composite-execution/boundary.ts` retried every failed child up to its caller's maxAttempts. The canonical Call Flow owner supplies an authored `retry.maxAttempts`; Subflow pins one. Neither the boundary retry loop nor parent retry/alternative assessment preserved a child's already-checked uncertainty independently of hostile parent `effect: observe` / idempotency metadata.

The new closest owning test is `runtime/composite-execution/tests/child-uncertainty.test.ts`. It uses an actual canonical published Call Flow, registered native commit definition/implementation, generic lost acknowledgement, maxAttempts 3, hostile parent observe/idempotent/optional/continue metadata, and a failed alternative. It also runs the equivalent actual Call Subflow path.

The first probe failed before any action because its fixture imported the internal `automationStudioRunGraphOptions` from the public runtime barrel. Both tests failed with `automationStudioRunGraphOptions is not a function` (42.64 s). The import was corrected to its existing internal owning barrel; no public API was invented or widened.

On the unfixed source, the same command then observed:

- Call Flow: **3 actual commit dispatches**, 1 failed alternative, no outer `run.outcome_uncertain`.
- Subflow: **1 actual commit dispatch**, 1 failed alternative, no outer `run.outcome_uncertain`.
- The unknown-case test produced seven failing assertions proving the bypass. The separate positive-case assertion also failed because the fixture lacked an explicit success End; that route was corrected before final validation. Its failure did not explain or invalidate the unknown-case duplicate dispatches and alternative calls.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts --maxWorkers=2 --minWorkers=1` -> **1 file, 2 tests failed**, 42.56 s, with the seven product assertions and one positive-route fixture assertion described above.

### Bounded fix

- `runtime/composite-execution/boundary.ts` stops the whole-child retry loop immediately on the authoritative failed child trace's `run.outcome_uncertain`. It skips only the checkpoints that would reject after that terminal child outcome; other failures, success, waiting and cancellation retain their existing behavior.
- `runtime/executor/defensive/assess.ts` recognizes uncertainty on the returned executed child trace before legacy parent claims or a parent's unrelated effectCheck. Model metadata is not read as a child trace or as authority.
- `runtime/executor/step-loop/uncertain-stop.ts` adds the internal `automationStudioStepChildOutcomeStop` helper; `step-loop/index.ts` exports it internally. The helper stamps/records the fault and terminates the calling frame without asking the parent's host to settle the child's act.
- `runtime/executor/graph-run.ts` propagates that stop immediately after recording the parent attempt, before any latched checkpoint, retry, alternative, handler or state route. `step-loop/failed-attempt.ts` applies the same terminal guard for its direct callers.
- The lead separately approved `runtime/composite-execution/owner.ts`'s single final checkpoint guard: an authoritative terminal `run.outcome_uncertain` trace is returned through a latched required-mode run, matching graph-run's existing rule. Other checkpoint refusals are not hidden.

No change to `frames/call-subflow.ts`, frozen contract fields, package exports/versions, permission peers, architecture documents, downstream code or baselines was needed.

### Final observed proof

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/decision.test.ts src/programs/automation-studio/runtime/tests/composite-executor.test.ts --maxWorkers=2 --minWorkers=1` -> **4 files, 29 tests passed**, 38.28 s.

The new three-case file proves actual Call Flow and Subflow commit dispatch count 1, alternative count 0, unrelated parent effect-check count 0, only the calling-node attempt in the outer trace, and outer `run.outcome_uncertain`. Positive child landed, not_landed and explicit unacted remain successful (one dispatch for landed, two when the first attempt was positively not-landed/unacted). A typed required-mode latch collaborator proves uncertainty returns with zero post-latch checkpoints and no later actions; an ordinary checkpoint refusal still rejects. The latter is a focused latch-contract test, not a live gateway receipt test.

`git diff --check` -> exit 0, no whitespace errors; existing LF-to-CRLF notices only. The new owning test is 157 lines. No worker build, typecheck, audit, full suite, browser, API, panel or mutating git command ran. Final package types/audit and compiled acceptance remain the lead's checks.

## Explicit trusted repeat safety for state setters

Outcome: Done; Core source frozen after the lead-approved follow-up in `repeat-safety-brief.md`. The additional API is optional `repeatSafe?: true` on both `AutomationStudioNodeActionEffect` and `AutomationStudioResolvedActionEffect`. No package version, export, permission-peer or downstream source edit by this worker.

### Read-only cause analysis

The lead's `test-runs/2026-10-31-t824-domain-tests.log` reports 139/145 passing, with six failures in the unchanged `retries/tests/uncertain-outcome.test.ts`: exploratory ordinary type, exploratory navigation, replayed ordinary type, direct navigation's four-attempt allowance, ordinary type read-back verification and desired-check verification.

Core's new state floor made `NodeMutates` true and prevented legacy observe from proving `NodeRepeatIsSafe`. This made state both mutating and, through `NodeActLasts`, lasting. Ambiguous failures therefore stopped at the mutation/lasting gate; verification failures stopped at `NodeRepeatCannotAct`. The old web seam deliberately omitted blanket mutate metadata for noncommitting setters and supplied declared lasting classes separately. Its tests and `webLastingActStatement` explicitly preserve ordinary type/check/navigation retries while still holding submit-type and plain type with a declared lasting consequence. The navigation opening refusal was a downstream consequence of stopping that same state-setting retry.

The existing canonical `capabilities.retryable` is not an idempotency promise: the built-in adapter exposes it for timing nodes, and the source search found no defensive reader making it a repeat-safety guarantee. Reusing it would silently change its meaning. State alone also cannot imply harmlessness. A separate explicit trusted promise is the minimal honest seam.

The web peer inspected replacement semantics and owns the five approved setter annotations plus the newTab predicate. This worker did not run browser actions or inspect every web setter implementation; the unchanged downstream six assertions remain the consumer acceptance, to be run by the lead after rebuilding the SDK.

### Exact contract/runtime semantics

- Optional `repeatSafe?: true` is accepted only from a trusted canonical contract/resolved callback, never from raw model metadata. Absent state stays mutating and unsafe; model idempotency claims cannot prove it safe.
- Canonical `state + commitWhen + repeatSafe` is valid. Proven false/default false preserves the explicit promise. True, unknown, malformed or unresolved predicate values raise to commit and omit safety. Known client permission classes also raise to commit and remove the canonical promise. Direct contradictory committing definitions are rejected.
- Resolved readers reject false, malformed values, commit plus repeatSafe true, or a positive known consequence list plus repeatSafe true. A resolved committing value always omits safety.
- The combiner carries explicit safety only if every known state contributor promises it; an unproven state contributor cannot borrow another's guarantee. Commit/known lasting classes remove safety. Existing absent-field shapes remain unchanged.
- Safe state remains a mutation in host/side-effect context, but can retry ambiguous and verification failures because the client explicitly proved repetition safe. It is not labelled observation.
- Explicit declared lasting classes dominate the promise on every retry/verification path. Destructive, external-side-effect, approval and legacy `effect: mutate` risk markers also veto it. These checks occur before accepting model idempotency; commit always vetoes safety. Absent-contract legacy behavior is preserved.
- The shared authored consequence metadata key moved to the already-pure defensive contracts module, with the original lasting-act export retained, so the new guard reuses the same key without a runtime import cycle.
- The earlier authoritative child-uncertainty terminal stop remains unchanged and passed its actual nested/latch regression again.

### Exact follow-up paths

Under Core `packages/fluxiq/src/programs/automation-studio/`:

- `nodes/action-effect/{definition,resolved,read-resolved,resolve,combine}.ts`.
- New `nodes/action-effect/tests/repeat-safety.test.ts`; extended `nodes/tests/action-effect-definition.test.ts`.
- `runtime/executor/defensive/{contracts,lasting-act,node-side-effect}.ts` and its `tests/lasting-act-client-floor.test.ts`.
- `runtime/executor/outside-graph/tests/action-effect.test.ts`; `runtime/tests/native-node-runtime.test.ts` (now 506 lines).

No native/factory lookup field, graph-option field, child stop field, wire consequence string or permission class changed. Permission declaration reading gains the strict optional field through its existing shared reader automatically.

### Observed checks

`pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/repeat-safety.test.ts src/programs/automation-studio/nodes/action-effect/tests/resolve.test.ts src/programs/automation-studio/nodes/action-effect/tests/read-resolved.test.ts src/programs/automation-studio/nodes/tests/action-effect-definition.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts --maxWorkers=2 --minWorkers=1` -> **8 files, 60 tests passed**, 37.66 s.

After the lead requested explicit legacy risk-marker coverage:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/nodes/action-effect/tests/repeat-safety.test.ts --maxWorkers=2 --minWorkers=1` -> **6 files, 76 tests passed**, 31.72 s.

Proof includes an actual canonical native state setter that retries verification twice and succeeds on attempt three, while the same setter with a declared lasting consequence is held on attempt one; outside-graph execution and verification retries; state without proof and model-only idempotency refusal; all explicit risk-marker vetoes; strict contradictory readers; JSON/registry roundtrip; conservative union; conditional true/false/raw unresolved behavior; and the existing actual nested-child unknown protection. Existing expectations were preserved; no baseline changed.

`git diff --check` -> exit 0, no whitespace errors (LF-to-CRLF notices only). No worker builds, types, audits, full suites, generated downstream tests, paid calls, browser/panel actions or mutating git. Lead must rebuild the SDK, rerun unchanged downstream assertions and perform final type/structure/compiled acceptance.
