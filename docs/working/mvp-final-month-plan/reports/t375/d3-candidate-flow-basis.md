# t375 d3: verdict basis for a trial on a candidate-built Flow

Read only. Nothing was built, run or edited except this report. Evidence came from lane A's passing candidate run `run-muz3cqdh-927fd2f1`, in the t342 slot-2 tree. The stored Flow came from a scratchpad copy of that workspace's `project.sqlite` (with its -wal and -shm files), for project `f2762330…`. Core was read at `fxwork/t375/!FluxIQ`. Below, `R/` is `packages/fluxiq/src/programs/automation-studio/runtime/`. Only structure is quoted here: ids, action types and key names. No page data appears.

## Outcome

Done. Blocker 4 does **not** bite through the path the audit described. For every press or typed field of this candidate Flow, a target-override trial ends `unverifiable` with `notResumableCode: "no_evidence"`, so S2's marker holds and the judged whole run becomes the evidence.

Two adjacent defects remain, and either can still stop a repair:

- **(A)** A changed node that needs one automatic retry inside the trial is read as `contradicted`.
- **(B)** The domain's `verifiesState` flag on `web.dom.wait_for_text` / `assert` / `wait_for_selector` is never seen by Core. The downstream wait therefore never counts as a basis, and it never contradicts a wrong override either.

## 1. The saved candidate Flow

- The source is the candidate text from `steps/0026-tool-core.submit_candidate/call.json`. Its keywords are only `flow` / `step` / `node` / `target` / `url` / `consequences` / `optional` / `checked` / `text`.
- The text has 10 steps. It uses **no loop, no `repeat`, no `subflow … when:` choice block, and no `runwhen`/`onlywhen`/`unless`**.
- Stored graph (`graph_nodes`, 12 nodes; `graph_edges`, 13 edges):
  - One primary Subflow `subflow.bootstrap.7b6719117bbda78d.main`. There are no router routes and no regions.
  - The graph is linear: `main.s1` to `main.s12`.

| node | definitionId | parameter keys | metadata keys |
|---|---|---|---|
| s1 | web.output.browser-navigate | newTab, url | outputActionId, bootstrap ids |
| s2 | web.output.dom-click (**optional**) | element.{selector,tagName,visibleText}, selector, timeoutMs | declaredConsequences[] (empty) |
| s3 | builtin.control.merge | mergeMode=first | |
| s4 | web.output.dom-click (**optional**) | same as s2 | declaredConsequences[] (empty) |
| s5 | builtin.control.merge | mergeMode=first | |
| s6 | web.output.dom-click | element.{context.shadowHosts,selector,tagName}, selector, timeoutMs | declaredConsequences[] (empty) |
| s7–s9 | web.output.dom-check | checked=true, element.*, selector, timeoutMs | |
| s10 | web.output.dom-type | element.*, selector, submit=false, text, timeoutMs | |
| s11 | web.output.dom-click | element.*, selector, timeoutMs | declaredConsequences=[modify_existing] |
| s12 | web.output.dom-wait_for_text | text, timeoutMs | |

- An optional step is compiled as the shape `sN -failed-> merge` plus `sN -success-> merge`.
- A raw search of every node's parameters and metadata finds **none** of: `expectedState`, `expectedRoute`, `expectedOutputs`, `expectedEffects`, `conditions`, assert, records, loop, choice.
- The only wait or check node is `s12` (wait_for_text, with its `text` parameter).
- Flow settings: `training.mode=continuous_adaptive`, `allowPromotion=true`, `proposalApprovalMode=auto`, adaptation `preset=adaptive`, `allowModifyActionTargets=true`.
- `runtime_action_summaries` shows the same pattern in all four stored runs, both trial runs included:
  - `s2` and `s4` "succeeded" with route `skipped` (target_not_found).
  - **`s6` fails once (`action_failed`) and then succeeds on its automatic retry.**

## 2. Trial verdict when a redesign breaks a press or typed field (s6, s7–s9, s10, s11)

Path: `recovery/annotation/patches.ts:146-185` → `executeAutomationStudioRuntimePatch` (`R/live-patch.ts:247`) → `trialAutomationStudioFlowChange` (`R/flow-change/trial.ts:72`). The trial starts at the changed node and continues through the rest of the Flow.

Which checks the verdict (`R/flow-change/verdict.ts:37-84`) produces:

- `changed_node_succeeded`: passed, if the patched node succeeds first time.
- `expected_state`: absent. The node has no `expectedState`, so `R/executor/expected-transition.ts:9` gives none, and `trial.ts:176` gives none.
- `expected_route`: absent.
  - On success, `expected-transition.ts:12-20` yields no route for a `web.output.*` node.
  - The failed comparison's default `failed` is discarded at `trial.ts:172`.
- `expected_outputs`: absent (no outputs declared).
- `records`: absent (no records effect).
- `downstream_assertion`: **absent.** `s12` does not count, for these reasons:
  - `automationStudioAttemptVerifiesState` (`R/flow-change/attempt-projection.ts:44-48`) looks up the definition with `getAutomationNodeDefinition`. That function searches **only `builtinAutomationNodeDefinitions`** (`programs/automation-studio/nodes/registry.ts:26-36,53-55`).
  - Domain `web.output.*` definitions live in the native runtime's SDK registry (`R/native-node-runtime.ts:68`).
  - The caller fallback `request.verifiesState` (`trial.ts:56,178`; `live-patch.ts:143,285`) is passed by **no caller**: `patches.ts:146-166` builds no such field, and a repo-wide search found no other supplier.
  - So the domain's `verifiesState: true` (`domain/src/output-nodes/definitions.ts:165-169,265`) is invisible to Core. The domain comment at `:96-101` claims Core counts it; it does not.
- `continuation`: passed, because a next attempt exists (`verdict.ts:218`) or the run completed (`:219`).

Result: no failed check, no unknown check, the changed node succeeded, and the basis is empty. The outcome is **`unverifiable`** (`verdict.ts:80-81`).

Resume decision (`R/flow-change/resume.ts:33-40`): no failed or unknown check and a resume point exists, but no evidence check passed. The code is **`no_evidence`**.

S2's marker at `live-patch.ts:353` requires `temporary_target_override` + `unverifiable` + `no_evidence`. It **holds**, so the run gets `awaitsJudgedRun: true` and `retryOriginalAction: true` (`live-patch.ts:330-333`). The downstream readers are all shape-agnostic, keyed only on the marker:

- `service/adaptations/verification-awaits-judged-run.ts:14-16`
- `adaptive-retry.ts:81`
- `training-modes.ts:345`
- `runtime-promotion.ts:48,73`

The rule "unjudged or refuted never promotes" therefore holds as S2 designed it.

What falls outside S2:

- **(A) A retried changed node gives `contradicted`.** `changedNodeCheck` (`verdict.ts:131-135`) fails on *any* failed attempt of the changed node. The executor pushes each retry as its own attempt and leaves the earlier one `status: "failed"` (`R/executor/graph-run.ts:465,612,622-638`, with `retry.previousAttemptId` only on the *next* attempt).
  - Effect: a patched press that needs one of the default three retries (as `s6` does on every run here) reads `contradicted` / `check_failed`.
  - No resume follows, and a failed validation is recorded (`verdict.ts:101`). That leaves a `lastFailure` behind, which also blocks `judgedRunIsEvidence` (`training-modes.ts:345`).
  - No test covers this case (no retry case in `flow-change/tests/verdict.test.ts` or `trial.test.ts`).
- **`continuation_incomplete`** gives `check_unknown`, and the marker is not set. This happens only when the trial stops on the changed node's own last attempt without succeeding, failing or reaching a next node (a cancel or a step budget of 1). It is rare.
- **Loop or choice steps**: none exist in this Flow, so this was not exercised. By code, a loop body node is an ordinary `web.output.*` node under `builtin.control.for-each`/`repeat`. The same verdict path applies, but the trial starts mid-body at the changed node (`live-patch.ts:279`). Not traced further.

## 3. Is a target override offered for each node kind present?

- **s6, s7–s9, s10, s11: yes.** These are element-target web outputs, and `selector` is required, so they carry `elementTarget` (`definitions.ts:253-263`). A target-not-found failure maps to `action_target_override` → `temporary_target_override` (`R/recovery/plan.ts:97`), and the policy allows it (`plan.ts:176`).
- **s2, s4 (optional): never.**
  - An absent target is skipped with no retry and no recovery (`R/executor/step-skip/absent-step.ts:35-41`).
  - Any other failure keeps its retries, after which the ladder offers "Go on past the optional step" (`R/executor/recovery-ladder.ts:89-98`), spending no budget.
  - So a redesign that breaks an optional press is passed over silently. Nothing repairs it, and blocker 4 does not apply.
- **s12 (wait_for_text): no target override.** It has no selector or element target. A timeout maps to `expectation_wait_retry` (`plan.ts:96`) or to a reroute. A changed text needs re-authoring through `R/recovery/refuted-result/` once the judged run refutes it (not traced in detail).
- **s1, s3, s5** (navigate and merge): no target override.
- **Choice steps and loop-bound steps**: not present in this Flow.

## 4. Conclusion and the smallest Core change

Blocker 4, as originally stated (`unverifiable` means no resume and no promotion), is closed for candidate-built Flows by S2's existing marker. Every repairable node in this Flow ends `no_evidence`. What can still stop a repair is defect (A), and defect (B) weakens it.

1. **(A), required.** Judge a node by its settled attempt.
   - In `R/flow-change/attempt-projection.ts`, add one shared projection: an attempt that a later attempt of the same node names in `retry.previousAttemptId` is superseded.
   - Mark superseded attempts in `trial.ts` `verdictAttempt` (`:157-190`) and in `R/adaptation-confidence/replay.ts:200-210`, so the two stay consistent as `attempt-projection.ts:5-8` requires.
   - Have `verdict.ts` `changedNodeCheck` (`:131`) and `downstreamAssertionChecks` (`:188`) skip superseded failures. A node whose final attempt failed still fails.
   - Test: the changed node fails, then succeeds on retry. Expected result: `unverifiable`/`no_evidence` plus the marker, not `contradicted`.
2. **(B), recommended.** Make the domain's `verifiesState` reachable.
   - Add a definition lookup beside `nativeNodeExecutor` in the graph options (`R/executor/contracts.ts:464`), for example `nodeDefinitionMetadata?: (definitionId) => JsonObject | undefined`, fed from `AutomationStudioNativeNodeRuntime.getDefinition`.
   - Read it in `automationStudioAttemptVerifiesState`, or pass it as `verifiesState` from `recovery/annotation/patches.ts:146`.
   - With (B), a passing `s12` gives `verified` with basis `downstream_assertion`, and a failing `s12` after a wrong override gives `contradicted`. (B) **must land after (A)**: a wait that times out once and then passes on retry would otherwise contradict a correct override.
   - Promotion stays gated as it is today. S2's marker is unchanged.

## Commands run and observed results

- Masked key-structure dumps (Node scripts in the scratchpad) of these snapshot files:
  - `snapshots/flow-lane.json`: lane `created-flow`, `authoringMode=candidate`, outcome promoted.
  - `snapshots/creation-context.json`: outcome `created`.
  - `run.json`: status `passed`.
  - Step 0026 `call.json` / `result.json` and step 0022 `call.json`.
- The db copy was opened with `node:sqlite` (read only). Queried:
  - `graph_nodes` and `graph_edges`: 12 nodes and 13 edges, as tabled above.
  - `flow_settings`
  - `runtime_action_summaries`: 4 runs, with the s6 failed-then-succeeded pattern in each.
  - `flow_graph_judgements`: one `confirmed`, one `unverified`.
- Core source reads and searches only. No builds, tests, Lab, browser or provider calls.

## Not verified

- Defect (A) is from reading the code; no trial with a retried changed node was executed.
- I did not check whether `s6`'s first-attempt failure would recur on a *patched* target.
- Loop-body and choice-block trials: not present in this Flow, and not traced.
- The exact priority between the optional way-on and an LLM repair candidate in the ladder.
- The re-author route for wait-text changes (`recovery/refuted-result/`) was only located, not traced.
- The t342 lane's still-running state was not touched or inspected beyond the files named above.

## Open questions or contradictions found

- `domain/src/output-nodes/definitions.ts:96-101` says Core's verdict counts a downstream node whose definition sets `verifiesState`. Core cannot see domain definitions (`nodes/registry.ts:53-55`), and no caller passes `verifiesState`. The flag is inert today.
- `verdict.ts:131-135` predates the 2026-10-07 retry-everywhere rule and treats a retried success as a failure.
