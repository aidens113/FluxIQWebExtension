# t251-w4-test-paths report

R = `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
D = `C:/Users/osrs_/FluxStuff/fxwork/t251-general-flow-authoring/domain/src`.
Read only; no code changed, no tests run.

## Outcome

Done. All five questions are answered with file:line. The main finding: **during a build, the executor never runs the Flow graph.** The build's test (the dry run) and `core.run_flow` both send each draft step again, one tool call at a time, through the loop's `executeTool`, using that step's stored `ranWith`. No For Each runs, no edge carries an `item`, and no node parameter or port binding is ever evaluated. The executor runs only stored Flows (Flow runs, repair trials and the t249 judged pass) and the `repeat-loop` unit test.

## What changed and why

Nothing. This was a read-only investigation.

## Findings

### (1) Draft to written Flow

- A draft step can be written only if it went through `core.run_node`: `automationStudioFlowBootstrapDraftStepIsWritable` returns `step.toolId === AUTOMATION_STUDIO_LLM_RUN_NODE_TOOL_ID` (R/llm/node-tools/draft-step.ts:104-106).
- The node is `step.actionId` (draft-step.ts:59-60).
- **Parameters come from `ranWith.parameters` first, then `input.parameters` as the fallback** (draft-step.ts:49). The comment explains why: a handle names a page as it was, so the Flow carries what the node actually ran on (draft-step.ts:46-48).
- `step.settings` (amendments such as a wait condition or an expected state) is appended after the parameters and wins over them (draft-step.ts:50-56).
- `consequences` is read from `step.input`, never from `ranWith`. It is always written, as `none` when the list is empty (draft-step.ts:57, 63-66).
- Every value becomes text. JSON objects and arrays are stringified so the assembler can parse them back (draft-step.ts:19-23, 82-88).
- The domain fills `ranWith` with `nodeCall(value, flowParameters(written, ran))`, i.e. the resolved parameters (D/runtime/llm-evidence/node-run/run.ts:339, 458; comment at 439). Core treats it as opaque JSON (R/flow-draft/step.ts:116-119). Page words in `control` are never written as a parameter (step.ts:127-128).
- `assembleAutomationStudioFlowDraftPlan` works in four steps:
  1. Calls `write` for each step. A step `write` declines becomes `flow_draft.step_not_written` (R/flow-bootstrap/authoring/assemble-draft.ts:98-103).
  2. Converts the entries into script lines (assemble-draft.ts:104-113).
  3. Applies routing through `routeAutomationStudioFlowDraftSteps` (assemble-draft.ts:118).
  4. Hands the result to the same `assembleAutomationStudioFlowScriptPlan` that written scripts use (assemble-draft.ts:133-135).
- Nodes are keyed `s1..sN` and mapped back to draft step ids (assemble-draft.ts:156-166).
- **Each node gets the literal parameters from one exploration call. Nothing binds a parameter to a Flow input, an earlier output or a row.** The only row binding is the For Each `item` edge that the router adds (see 4).
- The plan becomes the stored Flow only after the build: the service validates it and normalises it into a topology (`normalizeAutomationStudioFlowBuildPlan`, R/service.ts:1733-1744, 1780-1787), and saves it as a proposed adaptation (service.ts:1788-1793).

### (2) What the judge reads, and whether the graph ever runs in a build

- The gate's `observed` hook receives `AutomationStudioFlowDraftTestReport`: `{verdict, observations[], reused, signature}` (R/llm/node-tools/dry-run-gate.ts:86-91). Each observation is `{step, stepId?, resultCode?, evidence}`, exactly what the domain's replay answer returned (dry-run-gate.ts:73; built at R/llm/node-tools/replay-draft.ts:202-209).
- The hook fires on every pass, whether the replay was fresh, a step was made optional, or an earlier clean replay was reused (dry-run-gate.ts:185-189, 221-223, 255-268). It never fires on a refusal.
- The loop connects it as `observed: input.observeTest` (R/llm/evidence-loop.ts:383-394, i.e. lines 15-26 of the excerpt starting at 369). The setting is declared at R/llm/loop-configuration.ts:326.
- The build judge keeps the round's last report (R/service/flow-bootstrap-commands/build-judge.ts:75, 86-87). It asks `automationStudioBuildTestJudge` with a summary of `loop.steps`, the report and the accepted plan's nodes, and stamps the verdict with `flowSignature` (build-judge.ts:88-100). The service creates the judge at R/service.ts:1571.
- **Where the build requests the judged run (t244):**
  - The loop's dry-run gate runs with `requireRunnable: input.fullRunRequired === true` and `requireLibrarySteps` (evidence-loop.ts:384-385).
  - A Flow that has steps the test cannot run is refused with `full_run_required` (dry-run-gate.ts:192-218).
  - The build phases are given `test: (steps) => automationStudioFlowDraftDryRunGate({...})()`, described as "the judgement's replay from the start, no provider call" (R/service.ts:1618-1621).
- **The replay is step by step.** It resets once (replay-draft.ts:116-124), then sends `{...ranWith, replay:"step"|"verify"}` for every proposed step through `input.executeTool` (replay-draft.ts:172-180; R/llm/node-tools/replay.ts:106-134). It never calls `runAutomationStudioGraph`.
- In the build paths (flow-bootstrap/, service/flow-bootstrap-commands/, llm/), `runAutomationStudioGraph` and `stopAfterNodeId` appear only in two test files, flow-bootstrap/authoring/tests/repeat-loop.test.ts and draft-routing.test.ts (grep). The non-test callers are compiled-plan.ts:158, composite-executor.ts:38 and flow-change/trial.ts:80.
- **t249, "the completed trial is the judged run",** applies to repairs of a *stored* Flow at run time, not to builds. The patch ladder trials a patch from the changed node; if that trial runs the Flow to its end, its pass is adopted as the judged whole run, and the patch is applied only after the run is judged `answers` (R/service/runtime-adaptation/judged-promotion.ts:1-40, especially 17-19). The trial uses `trialAutomationStudioFlowChange`, which really calls `runAutomationStudioGraph(request.candidate, ...)` (R/flow-change/trial.ts:72-80).
- **Conclusion:** in a build, the Flow graph (Router, Subflow, For Each, edges, `item`) is never executed before acceptance. Only the draft's straight list of calls is replayed and judged. The graph first runs when the stored Flow runs.

### (3) The replay call shape, and how the domain answers

- There are three calls, all sent to the tool that ran the step (`step.toolId ?? step.actionId`, replay.ts:137-139):
  - `{replay:"reset", from}` (replay.ts:92-94).
  - `{...ranWith, replay:"step", from?, produced?}` (replay.ts:106-115). `from` and `produced` come from `step.replay`.
  - `{...ranWith, replay:"verify", from?}`, with no `produced` (replay.ts:126-134).
- A step whose `ranWith` already holds `replay` gets no call (replay.ts:108, 128).
- The domain must answer in a closed set of codes: `core.replay.{replayed, failed, changed, unreproducible, reset_failed}` plus `verified`, `present` and `remembered` (replay.ts:65-82). Any other answer reads as `failed`. `verified` and `present` pass only a `verify`; `remembered` passes only a `step` (replay.ts:154-164).
- Which mode a step gets: a mutate step that declares any consequence other than none is verified instead of run (R/flow-draft/verify-only.ts:13-22).
- How the domain answers:
  - It detects the `replay` key (D/runtime/llm-evidence/node-run/replay.ts:200-209).
  - **reset**: navigates to `from.location` after the permission gate (D/.../replay.ts:219-240).
  - **step**: reads `value.node` and `value.parameters` (the stored `ranWith`), gates on `value.consequences` (replay.ts:250-280), re-resolves the parameters through `resolveWebPlanNode` (284-303), sends the gateway action (308-311), and maps a missing target to `remembered` or `unreproducible` (333-341). A read that collapsed answers `changed` (343-350); success answers `replayed` with its rows (358-360).
  - **verify**: handled in D/.../node-run/verify.ts (not read in detail).
  - The domain writes `from` and `produced` at call time (D/.../replay.ts:102-108).
- **No `item` is ever sent:** the call holds only `ranWith`, and the domain reads only `parameters`.

### (4) A repeat span (For Each) under the dry run and `core.run_flow`

- Routing kinds are `optional`, `only_if`, `on_failed` and `repeat {through, over}` (R/flow-draft/routing.ts:38, 50-63).
- `automationStudioFlowDraftConditionalStepIds` puts every step of a repeating span into the conditional set (routing.ts:115-131; span from 134-139). The reason given is that the row the build acted on is already done, so the step fails or is unreproducible on replay (routing.ts:104-113).
- **Dry run:** every proposed step, span members included, is replayed **once**, in draft order, with its own build-time `ranWith`, which is the single row the build clicked (replay-draft.ts:172-180). A span step that does not replay does not block, because the verdict excludes conditional ids (replay-draft.ts:228-237). Its re-anchor is skipped as well (replay-draft.ts:183).
  - So a loop body is never shown to work on any row other than the explored one, and its failure on that row is excused.
  - The list step before the span (`over`) is not in the span, so it replays as an ordinary step and is judged on `produced` (D/.../replay.ts:183-189).
- **`core.run_flow`:** runs proposed steps `from..to` once each with the same calls and no reset (R/llm/node-tools/run-flow-part.ts:57-103). A conditional step that fails is reported and the run continues; any other failure stops it (run-flow-part.ts:68, 100-102). It writes nothing back to the draft and is never the Flow's test (run-flow-part.ts:14-16, 129-136; tool description at R/llm/node-tools/run-flow.ts:36-43).
- **What the repeat becomes in the graph:** two Merges plus `builtin.control.for-each`. The list's `records` feed `items`, and `item` is wired to every span step whose node declares an `item` input (R/flow-bootstrap/authoring/draft-routing.ts:24-26, 65-72, 252-268).
  - The executor grants each For Each `body` pass `maxStepsPerIteration` extra steps (R/executor/graph-run.ts:226-248, 442).
  - Only repeat-loop.test.ts runs this graph, with fake implementations bound through `AutomationStudioNativeNodeRuntime` (R/flow-bootstrap/authoring/tests/repeat-loop.test.ts:150-161, 200-229).

### (5) What it would take to run the assembled graph as the build's test

What exists:
- `runAutomationStudioGraph(flow, options, onExecutedTrace)` never rejects and returns a trace (R/executor/graph-run.ts:70-76, 114-145).
- Its options include `startNodeId`, `stopAfterNodeId` (a partial run ending `succeeded` with `stopReason: "stopped_at_node"`), `inputs`, `nativeNodeExecutor`, `hostRuntime`, `onRecordBatch`, `maxSteps` and `signal` (R/executor/contracts.ts:388-485, especially 389-401, 440, 452, 470). The stop rule is at graph-run.ts:369-370 and R/executor/partial-run/stop-after-node.ts:43-70.
- A native node receives `inputs = {...options.inputs, ...collectWiredNodeInputs(...)}`, so a wired `item` arrives as a port value, along with `hostContext.sideEffectClass` and `target` (R/executor/node-execution.ts:148-164).
- `trialAutomationStudioFlowChange` already runs a candidate Flow document, observes the host's expectation answers and returns saved and executed traces (R/flow-change/trial.ts:72-107).
- The plan becomes a runnable document either through `normalizeAutomationStudioFlowBuildPlan` (service.ts:1780-1787, which needs a parent Flow) or through the simpler subflow-to-document mapping that repeat-loop.test.ts:216-229 uses. `compiledPlanToFlowDocument` handles compiled plans (R/compiled-plan.ts:130-158).

What is missing:
1. **A dry-run mode in the executor and native dispatch.** No option says "verify, don't act" (contracts.ts:388-485 has none). The verify-instead-of-act rule exists only as the replay `verify` call (verify-only.ts:13-22; D/.../replay.ts:206-209).
   - The cleanest seam is the `nativeNodeExecutor` request: it already carries `hostContext.sideEffectClass` (node-execution.ts:158-163). A build-test executor could send `replay:"verify"` for nodes with a lasting consequence, and `replay:"step"` or a normal dispatch for the rest. It would read the node's `consequences` parameter, which draft-step.ts:63-66 writes onto the node.
2. **A reset before the run.** The graph run has no reset. The build would send the existing `{replay:"reset", from}` (replay.ts:92-94) using the first step's `replay.from` (`automationStudioFlowDraftReplayFrom`, used at replay-draft.ts:111) before calling `runAutomationStudioGraph`.
3. **The build's executor connected as `nativeNodeExecutor`.** The build has only the loop's `executeTool` (tool-call shape `{callId, toolId, value}`), not a native runtime bound to the build session. An adapter would turn `{node, inputs}` into a `core.run_node` call. Today `item` would be lost in that adapter, because `replayStep` reads only `parameters` (D/.../replay.ts:251-253). The domain would need to accept the row input on that path.
4. **Verdict mapping.** `observed` / `AutomationStudioFlowDraftTestReport` expects per-step `observations` keyed by draft step (dry-run-gate.ts:73-91). A graph trace would be mapped back through `draftStepIdByNodeKey` (assemble-draft.ts:89-94, 156-166). Nodes added by routing, such as For Each and Merges, have no draft step. Per-pass attempts of one node would need representing; the judge summary (R/result-verification/build-test/summary.ts:75-114, 209) groups observations by step.
5. **The signature, the permission gate and the purse stay as they are.** The gate's verdict is keyed on the Flow signature (dry-run-gate.ts:15-35, 220). Permissions apply on the executeTool path (replay.ts:26-32). A graph test sent through the same executeTool adapter keeps both.
6. **`stopAfterNodeId` serves `core.run_flow`, not the whole test.** A partial graph run would be `startNodeId` plus `stopAfterNodeId` (contracts.ts:389-398) in place of run-flow-part's per-step loop.

## Seams a graph-run test would plug into

1. `automationStudioFlowDraftDryRunGate`: the replay call at R/llm/node-tools/dry-run-gate.ts:234-241, swapped for a graph run of the assembled plan.
2. `replayAutomationStudioFlowDraft` (R/llm/node-tools/replay-draft.ts:109-134): keep the reset (116-124) and replace the step loop with `runAutomationStudioGraph`.
3. `assembleAutomationStudioFlowDraftPlan` (R/flow-bootstrap/authoring/assemble-draft.ts:65-146): its `plan` and `draftStepIdByNodeKey` become the document under test and the map back to steps.
4. A plan-to-document mapping, as in repeat-loop.test.ts:216-229, or `normalizeAutomationStudioFlowBuildPlan` (R/service.ts:1780-1787).
5. `AutomationStudioGraphExecutionOptions.nativeNodeExecutor` (R/executor/contracts.ts:452; called at R/executor/node-execution.ts:149-164): an adapter onto the loop's `executeTool` that sends `replay:"step"|"verify"` plus the wired `inputs` (`item`).
6. The domain's replay handling (D/runtime/llm-evidence/node-run/replay.ts:206-209, 250-311): it must accept and apply the row input. Today it reads only `parameters`.
7. `stopAfterNodeId` / `startNodeId` (R/executor/contracts.ts:389-398; R/executor/partial-run/stop-after-node.ts:43): for `core.run_flow` (R/llm/node-tools/run-flow-part.ts:57).
8. `observed` → `AutomationStudioFlowDraftTestReport` (R/llm/node-tools/dry-run-gate.ts:73-91, 142) → build judge (R/service/flow-bootstrap-commands/build-judge.ts:87-100) → summary (R/result-verification/build-test/summary.ts:78-114).
9. `trialAutomationStudioFlowChange` (R/flow-change/trial.ts:72-107): an existing pattern for running a candidate document and reading its verdict.
10. The build phases' `test` hook (R/service.ts:1620-1621).

## Commands run and observed results

Only reads: `cat -n`, `sed -n`, `grep -rn` and `wc -l` over the files above. No tests and no builds.

## Not verified

- I did not read D/.../node-run/verify.ts, the domain's native-node runtime used in real Flow runs, the body of R/result-verification/build-test/summary.ts, R/flow-draft/dry-run.ts, or the inside of normalizeAutomationStudioFlowBuildPlan.
- I did not read the unfinished-build phases module (R/flow-bootstrap/unfinished-build/phases.ts) beyond its `test` wiring at service.ts:1620-1621.
- Line numbers for evidence-loop.ts are from an excerpt starting at 369 (gate at about 383-394).

## Open questions or contradictions found

- The gate comment says a Flow is finished only after "a run of the whole Flow from its start" (dry-run-gate.ts:15-18). In a build, that "run" is a per-step replay of the draft, not a run of the Flow graph, and repeat-span steps are excused rather than exercised (routing.ts:104-113). The judged artifact and the stored artifact differ in their routing and row bindings.
- `consequences` is taken from `step.input`, but the replay spreads `ranWith` (draft-step.ts:57; replay.ts:110). The domain gates on `value.consequences` (D/.../replay.ts:263). This works only if the domain puts `consequences` into `ranWith` as well (`nodeCall(value, ...)` in D/.../run.ts:339, which I did not check).
