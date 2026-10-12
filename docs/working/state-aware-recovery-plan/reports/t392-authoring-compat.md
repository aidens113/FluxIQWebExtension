# t392 unit G: t388's authored output on t392's executor

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, uncommitted.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. All four items are implemented and tested. Typecheck is clean, and the structure audit passes. All narrow tests named in the brief pass.

## What changed and why

### 1. Call Subflow shape

**Directions matched; the `inputs` value form did not.**
- `outputs`: t388 writes `{ <part output>: <same name> }` (child output id -> parent key). That is A's direction and form, so no change was needed.
- `inputs`: t388 writes `{ <child input id>: <value> }`. The value is a literal, or a `$state` binding such as `{ $state: { path: "card", fallback: 4417 } }`. A's executor read each entry as the *name* of a parent value. The node's parameters are resolved before dispatch, so by the time the call ran, the binding was already `"5555"`, which was then looked up as a key and never found.
- **A second gap:** a part's declared output is an interface port carrying `metadata.binding` (for example `$node.s2.records`). Nothing in the executor read that binding, so the boundary handed back `null`.

**Executor-side fixes** (t388's output is unchanged):
- `AS/runtime/executor/frames/call-subflow.ts`:
  - `inputs` entries are now the values given. They are resolved like every other parameter, so a binding reads the parent's value when the step runs, and an input bound to a value the parent never produced fails the node with `executor.parameter.unresolved_state_path` before the child is loaded.
  - New `withDeclaredOutputs`: after the child runs, each declared output that has a `metadata.binding` is read from the child's executed values. A `$node.<key>` is resolved through the child graph's `bootstrapSymbolicKey`, using the same resolvers the executor already uses.
  - The request no longer takes `callInputs`.
- `AS/runtime/executor/node-execution/attempt.ts`: a one-line edit to drop the now-unused `callInputs` argument. This file is not in my owned list, and it is not C0's or C1's. Please review it.
- `AS/nodes/control-flow/call-subflow.ts`: the description and doc comment of the `inputs` parameter now describe the value form.

**Proof.** `AS/runtime/tests/authored-call-subflow/tests/call-subflow.test.ts` (2 tests):
- It takes a script with `part renewal` (`input: card`, `output: loans = $step.loans.records`) and a `call: renewal` with `card: $input.card = 4417`, and runs it through `acceptAutomationStudioFlowBootstrapResult`, then `savedFlowValidation` (plan validator, `normalizeAutomationStudioFlowBuildPlan`, Flow validator).
- It then runs the main graph on `runAutomationStudioGraph`, with a fake `nativeNodeExecutor` host and a `subflowGraphs` source over the saved topology.
- Asserted:
  - the child typed `"5555"`, the parent's input;
  - no child request saw the parent-only `secret`;
  - the call attempt's `outputs.loans` is the part's records;
  - the parent's next step typed those records;
  - without a parent input, the `4417` fallback crosses.
- I mutation-checked it: with `withDeclaredOutputs` disabled, the test fails with `expected ['5555', null]`.
- I placed it under a feature subfolder of `runtime/tests/`, because it has several subjects and `runtime/tests/` is at its file limit.

**A's unit test updated and extended.** In `frames/tests/call-subflow.test.ts`, the caller's input is now `automationNodeStateBinding("parentQuery", "none")`. Three tests were added:
- a literal value crosses as written, and a binding crosses as the parent's value;
- an unbound binding fails the call before the child is loaded;
- a declared output is read through its `$node.<key>` binding, and one whose binding names nothing comes back `null`.

### 2. Real Call Subflow in the fixture

- `flow-bootstrap/plan/tests/state-node-definitions-fixture.ts` no longer builds a stand-in. `stateNodeRegistryFixture(definitions)` is the default registry, which now includes the real `builtin.control.call-subflow`, plus the given definitions. `callSubflowDefinitionFixture` is deleted.
- Before this change, all three test files that used the stand-in threw `"builtin.control.call-subflow" is already registered`, because A had made it a built-in.
- Updated callers:
  - `authoring/tests/state-statements.test.ts`;
  - `plan/tests/flow-script-format.test.ts`;
  - `candidate/tests/refusal-locator-corpus.test.ts`: `calling()` is now `refusalTestRegistry()`, and case 91 ("library with no Call Subflow") now omits the built-in.
- Expectations changed:
  - two call nodes now also carry `errors: {}`, the real definition's default parameter;
  - the "no Call Subflow" test builds its library from the canonical built-ins minus Call Subflow.

### 3. Parent Flow `metadata.requires`

- New `AS/runtime/service/flow-bootstrap-commands/applied-parent.ts`, `automationStudioBootstrapAppliedParent(parent, adaptation)`:
  - It is the parent-Flow metadata block that `applyFlowBootstrapAdaptation` used to build inline: `bootstrapAdaptationId`, `bootstrapSourceInstructionIds` and `bootstrapInstructedConsequences`.
  - It now also writes `requires` when `topology.requires` is non-empty. The value is the union with any `requires` the parent already had, so an extend cannot drop an earlier requirement.
  - When the topology requires nothing, the parent's `requires` is left as it was.
  - It is exported from the barrel.
- `service.ts` calls it in one line. **`service.ts` went from 4380 to 4368 lines.** Rollback and revert already restore `parentBefore.metadata` wholesale, so `requires` is undone with the rest.
- Test `flow-bootstrap-commands/tests/applied-parent.test.ts` (5 tests):
  - Unit tests: keeps the parent's keys; writes no `requires` when nothing is required; union with an earlier build.
  - Through the real service (create, approve, apply, then `getFlow`):
    - a script calling a part gives `requires: ["flow.subflow-calls@1"]`;
    - a script with a handler (dialog `when`) gives `["flow.handlers@1", "web.facts@1"]`;
    - a plain script gives no `requires` key.

### 4. `{ handle }` in fact targets

New `AS/runtime/llm/harness-options/plan-fact-targets.ts`:
- `automationStudioPlanFactTargetSites(plan)` finds every fact whose target names a handle, in five places:
  - a handler's `parameters.when` and `parameters.completionCheck`;
  - `metadata["fluxiq.entry"].when` and `metadata["fluxiq.checkpoint"].when` on nodes;
  - `metadata["fluxiq.successCheck"]` on Subflows.
- Dialog targets do not name a handle, so they are never sites.
- It also defines `AUTOMATION_STUDIO_PLAN_FACT_TARGET_DEFINITION_ID = "fluxiq.fact.target"`.

`plan-parameter-resolution.ts`, `resolveAutomationStudioFlowBootstrapPlanParameters`:
- Before the node loop, each fact site is put through the existing `resolveNode`, as a synthetic step:
  - definition `fluxiq.fact.target`;
  - parameters `{ target: { handle[, location] } }`, exactly a step's target form;
  - `consequences: []`, so the domain receives `declaredConsequences: []`;
  - permission `automationStudioActionPermissionDenied`.
- So every rule a step handle gets applies to it: not issued, no resolver, a domain refusal, an `unchanged` answer, an answer still naming a handle, and `needs_permission`.
- A resolved answer's whole `parameters` object becomes the fact's target: the host's durable form, which C9 says Core carries without reading.
- Refusals are reported at the target's own path, for example `plan.subflows.0.nodes.1.metadata.fluxiq.entry.when.0.target`.
- A handler whose fact was refused is not asked about again, so it never gets a second "misplaced" refusal.
- `handleViews` are kept, with `node` set to the site's ref.

Both callers (`bootstrap-completion.ts` and `service.ts:1674`) go through this function, so neither needed a change.

`assertAutomationStudioFlowBootstrapPlanHandlesResolved` now also refuses fact handles in node and Subflow metadata. Handler facts are parameters and were already covered. This runs at `createFlowBootstrapAdaptation` and at apply, **so a saved graph cannot carry a fact `{ handle }`.**

`flow-bootstrap/plan/contracts.ts`: the fact `target` type is widened with `| JsonObject`, the resolved form, and the doc says so.

Test `harness-options/tests/plan-fact-targets.test.ts` (4 tests, with a fake domain resolver):
- all five places are resolved, and the dialog is left unchanged;
- each fact is asked about alone as `{ target: { handle } }` with `declaredConsequences: []`;
- the handler is asked about afterwards with its facts already resolved;
- the input plan is not mutated;
- an unissued handle is refused at its own path (entry and handler), and the handler is not re-asked;
- an `unchanged` answer, an answer still naming the handle, no resolver, and no exploration give `handle_unresolved`, `handle_unresolved`, `handle_resolution_unavailable` and `handle_not_issued`;
- the assert throws on metadata handles and accepts dialog-only plans.

## Commands run and observed results

All of these were run in `packages/fluxiq`, except the audit.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: the final run printed nothing and exited 0. One mid-work run showed an error in `executor/lifecycle-run/tests/dispatch.test.ts(29,129)` (`incidentId: undefined` under `exactOptionalPropertyTypes`). That file is C1's, and the error was gone on the final run.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` at the Core root printed `structure-audit: passed (304 warning(s), 708 baselined).`
  - The full output still lists two `directory-files` FAIL lines from other workers' new files: `runtime/executor/tests/` at 26 files (`graph-navigation.test.ts`) and `runtime/tests/` at 26 files (`host-runtime-fact-evaluation.test.ts`).
  - My own two `as-never` failures were fixed, and my e2e test was moved out of `runtime/tests/`.
- Baseline, before any edit: `npx vitest run` on `flow-bootstrap/candidate`, `state-statements.test.ts` and `flow-script-format.test.ts` gave **3 files failed**, each `"builtin.control.call-subflow" is already registered.`
- `npx vitest run` on `flow-bootstrap/{plan,authoring,script-statements,candidate,tests}`, `llm/harness-options/tests`, `executor/frames`, `nodes`, the e2e test, `service/flow-bootstrap-commands`, `runtime/tests/service-bootstrap` and `runtime/tests/service-flows` printed `Test Files 152 passed (152)`, `Tests 1292 passed (1292)`.
- `npx vitest run` on the whole of `flow-bootstrap`, `model/validation`, `executor/node-execution`, `executor/tests`, `runtime/tests/{executor,composite-executor,router-runtime}.test.ts`, `service/runtime-session` and `llm/node-tools` printed `Test Files 184 passed | 1 skipped (185)`, `Tests 2471 passed | 2 skipped (2473)`.
- After the final edits (file move and cast removal): `authored-call-subflow`, `llm/harness-options/tests`, `applied-parent.test.ts` and `executor/frames` printed `21 passed (21)`, `198 passed (198)`.

## Not verified

- **The real web domain refuses fact targets today.** `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` resolves a `target` only for its own selector node ids (`isTargetSlot`). Asked about `fluxiq.fact.target`, it will answer `web.handle.misplaced`, so a live build whose script writes `exists t5` is refused until the domain learns the new id (see Open 1). Before this change it was refused anyway: the handler node itself got `misplaced`, and metadata facts were never checked at all.
- No live or Lab run, and no host fact evaluation of a resolved target.
- Call Subflow under a `commandRun` (required-commands) run.
- An end-to-end service Router run that reaches a Call Subflow (A's open item, still open).
- The full package suite (the brief says narrow only).

## Open questions or contradictions found

1. **Domain contract for fact targets (downstream, `domain/**`, not mine).**
   - The domain's `resolvePlanNodeParameters` must accept `nodeDefinitionId === "fluxiq.fact.target"` with parameters `{ target: { handle, location? } }` and `declaredConsequences: []`.
   - It should resolve the target as it does a step's.
   - It should return `{ status: "resolved", parameters: <the durable target the host's fact evaluator reads> }`, for example `{ selector, element, browserFrameId }`.
   - The id is a Core constant, `AUTOMATION_STUDIO_PLAN_FACT_TARGET_DEFINITION_ID`, exported from the harness-options barrel. If the supervisor prefers a different presentation, for example the guarded step's own definition id, only `plan-parameter-resolution.ts` changes.
2. **The binding contract doc (`llm/harness-options/binding.ts`) does not mention fact targets yet.** It is outside my files. One paragraph under `resolvePlanNodeParameters` saying a fact is presented under that id would make the contract explicit.
3. **`attempt.ts` was edited by one line** (dropping `callInputs`). It is not in my owned list.
4. **The executor change to `inputs` is a semantic change of A's node.** An existing graph that wrote a bare string as a parent value *name* now passes that string as the value. Only A's own tests wrote that form, and they were updated. No saved Flow could have used it, because the node is new in t392.
5. **`errors: {}` is now in every authored call's parameters**, because it is the real definition's default. This is harmless, but t388's `flow-script-format` text does not mention `errors`, and authoring has no grammar for routing a declared error (`error.<id>`).
