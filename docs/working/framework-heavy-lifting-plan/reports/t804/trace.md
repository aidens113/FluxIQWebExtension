# t804 trace: why a project builder re-tests its whole part after every one-step change

Read-only trace. No code was edited and nothing was run except `ls`/`grep`/`sed` reads.
`R` = `C:/Users/osrs_/FluxStuff/fxwork/t804/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
`E` = evidence run `fxwork/t567/!FluxIQWebExtension/test-runs/instances/rr6d-slot-4/run-mvtdn37t-e1e4d0a7/steps`.

## Outcome

`core.test_subflow` has no start argument at all, so every test runs from the start. Nothing in Core
keeps any state about a failed whole test. The single-flow `core.run_flow` from t244 is
structurally closed to builders: it replays draft steps, and a builder has no draft. The executor
can already start from a chosen node, but the one detached runner every trial goes through refuses
to. The smallest design that fits the rule is: a `from` argument on `core.test_subflow`, a new
from-step entry in `flow-bootstrap/verification/`, and a refusal in the subflow gate. It needs no
edit to any forbidden path.

## 1. Why `core.test_subflow` always runs from the part's start

- **The tool cannot be told where to start.** Its input schema is `revision`, `digest` and
  `cannotUndo` only, and any other key is refused `subflow.trial_input_invalid`
  (`R/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:434-437`, `:491-494`). The request
  handed to the port is scope, proposal, signal, `startedWith` and `earlierAdvice`, with no start
  node (`:694-696`).
- **Scoped plans.** `runAutomationStudioSubflowTrial` (`R/service/subflow-trial/run.ts:142`):
  - it runs the start hook (`:169`);
  - it opens a session (`:189`);
  - it calls `runAutomationStudioDetachedSubflow` with the predecessors, the target and `arrival`
    (`:195-212`).

  That function builds a throwaway root: `start` → arrival → Call Subflow for each predecessor and
  then the target (`R/flow-bootstrap/verification/detached-subflow.ts:322-357`). A router-run
  target runs as the root of a second run (`:178-231`, `rootPlan` `:278-281`). Every run goes
  through `runAutomationStudioDetachedCandidate`, which explicitly refuses a partial start:
  `if (options.startNodeId !== undefined || options.stopAfterNodeId !== undefined ...) return refused("candidate.partial_execution_unsupported")`
  (`R/flow-bootstrap/verification/detached-execution.ts:53`). So the executor always picks the
  graph's own start: `chooseAutomationStudioStartNode` (`R/executor/graph-run.ts:301-302`).
- **Single-subflow plans (the evidence run).** The port is `AutomationStudioProjectWholeTestPort`
  (`R/project-agents/single-subflow/whole-test-port.ts:58-67`, wired at
  `R/project-agents/dispatch/run-brief.ts:382-384`). It calls `automationStudioProjectSingleSubflowTrial`,
  which assembles the whole Flow and runs the supervisor's `core.test_candidate` on it
  (`R/project-agents/single-subflow/single-subflow-trial.ts:156-176`). The builder is told this:
  `WHOLE_DESCRIPTION` "runs that once from its start" (`subflow-trial-gate.ts:346-348`) and
  `wholeTest.said` (`single-subflow-trial.ts:135-136`). E/0051 result: `wholeTest.said` = "This
  test ran the whole Flow from its start, as the build's judged run".

## 2. Is there a run-from-a-chosen-node test for project/subflow builders? No.

- **The single-flow one (t244).** It is `core.run_flow` `{from, to?}` (`R/llm/node-tools/run-flow.ts:32-62`),
  run by `runAutomationStudioFlowDraftPart` (`R/llm/node-tools/run-flow-part.ts:76-136`). It does
  **not** use the executor. It replays the draft's proposed steps through the loop's own
  `executeTool` (the `core.run_node` calls each step ran with, `step.ranWith`/`step.replay`) using
  the dry run's walker `automationStudioFlowDraftReplaySteps` (`:91-111`): no reset, no judge, on
  the target as it stands.
- **It cannot reach a builder, for two independent reasons:**
  - The binding offers it only when `loop.enabled` (draft and dry run on) and the draft holds a
    replayable step (`run-flow.ts:91-103`). A builder's loop sets `draft: false, dryRun: false`
    (`R/flow-bootstrap/subflow-candidate/builder-loop.ts:341`).
  - It is filtered out by name: `NOT_A_BUILDERS` includes `core.run_flow`
    (`R/flow-bootstrap/subflow-candidate/role-tools.ts:9`).

  A builder's proposal is a compiled script (graph nodes), not draft steps that carry
  `ranWith`, so the t244 entry cannot be reused as it stands. Its answer shape and words can be
  reused: `passed`, `stoppedAt`, and "This is not the Flow's test" (`run-flow-part.ts:122-153`).
- **The entry that can be reused is the executor's `startNodeId`.** It is a root-graph option
  (`R/executor/contracts.ts:677`), honoured at `R/executor/graph-run.ts:301-302`. With
  `startNodeId` set, the On Start lifecycle and entry routing are skipped (`:347`). Values come
  from `options.inputs` (`:299`). It reaches the executor unchanged through
  `runCanonicalAutomationStudioFlow` (`R/composite-executor.ts:6`, `R/composite-execution/owner.ts:88-89`).
  A Call Subflow child never receives it (`R/composite-execution/boundary.ts:62-68`), so a from-step
  run must run the target as a **root** frame (`rootPlan`).
- **Forbidden paths: none needs to change.**
  - `executor/**` and `service/runtime-session/**` are only called.
  - Admission reads only build, brief and lease (`R/service/runtime-session/build-trial-admission.ts:1-40`),
    so a session marked `metadata.subflowTrial` with an extra `fromStep` field is admitted as today.
- **Outside the owned dirs but not forbidden: one file must change.**
  `R/flow-bootstrap/verification/detached-execution.ts:53` refuses `options.startNodeId`, and
  `detached-subflow.ts:3-4` promises never to loosen that refusal. Recommended change: a new
  sibling `flow-bootstrap/verification/detached-subflow-from.ts` (plus its barrel export). It
  passes a separate, validated `fromNodeKey` input to `runAutomationStudioDetachedCandidate`,
  which resolves it to the node whose `metadata.bootstrapSymbolicKey` is that key
  (`R/flow-bootstrap/adaptation.ts:221,241`) in the selected graph, and only then sets
  `executionOptions.startNodeId` (after line 53; `:102`). Line 53 keeps refusing a caller's own
  `startNodeId`.
- **Seeding the failed run's values would need a forbidden edit** (say so, do not do it in v1).
  The values are in the failed trial's `trace.values`, and the trial ports are built in
  `service/project-build/subflow-trials.ts` / `brief-ports.ts` (`service/project-build/**`). For
  the whole path, the trace is the supervisor's (`service/project-build/whole-trials.ts`). v1
  avoids this: see §6, "binding closure".

## 3. What a failed test tells the builder to do next

All of these are in `R/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`:

- **execution_failed.** `EXECUTION_FAILED_HEAD` (`:422`) plus `Stop.instruction`
  (`R/flow-bootstrap/candidate/trial-stop.ts`, called at `:735`). As sent at E/0051:
  "The subflow did not run to its end, so this revision cannot complete. Step 15 ("open the post")
  failed, on its run 2 in this trial … (web.target.not_found). Read that step's entry under steps …
  Trace the preceding steps … If it may, test this same revision again; otherwise correct the step
  that caused the failure, submit the subflow with core.submit_subflow, then test the new revision."
- **no.** `INSTRUCTIONS.no` (`:354`), sent at E/0067, 0082, 0098 and 0113: "Read the feedback, change
  the subflow to fix it, submit it with core.submit_subflow, then test the new revision."
- **The submit answer's `next`, whole path** (`builder-loop.ts:388-389`): "Test next with
  core.test_subflow … This test runs the whole Flow from its start as the build's judged run".

Every path says "test", meaning the whole run again. None mentions running from the failing step.
The builder did exactly that: E/0055 resubmitted after the 0051 failure, and 0058 re-tested from
the start. The run alternates submit/test through 0113: five whole tests, one execution_failed and
four no.

## 4. Why each test is reset, then offline, then reset (E/0052-54, 0059-61, 0068-70, 0099-101)

| Step | Emitted by | What it does | Cost |
| --- | --- | --- | --- |
| `NNNN-reset`, `trialToolId core.test_subflow`, role builder | The builder's gate: `automationStudioLlmStepLogReset({stage:"site_check"...})` → `automationStudioTrialDefaultsBeforeTrial` (`subflow-trial-gate.ts:536-537`) | Admission, the start hook if any, then the before-state witness readings (t775) | 13-24 s |
| `NNNN-offline`, `trialToolId core.test_candidate`, role supervisor | The whole gate's `offlineFirst`, asked on each new whole revision's first test (`R/flow-bootstrap/candidate/trial-gate.ts:451`, `:608`; source `R/service/offline-first/whole.ts:42`, wired in `service/project-build/whole-trials.ts:87-118`) | `no_live_source`, `inconclusive` or `kept_no` | 2 ms to 16 s |
| second `NNNN-reset`, `core.test_candidate` | The whole gate's own site check (`trial-gate.ts:468`) | Reuses the fresh reads | 2-3 ms |

None of these steps undoes anything on the site: every one is `outcome: admit`, `start: not_reset`.
So the minimal-reset rule is not broken by site resets. The waste is in the order and in duplicated
readings:

- **The offline pass runs after the builder's 20-second check.** The builder gate's own
  offline-first check would run first (`:516-518`), but `WholeTestPort` never copies the whole
  port's `offlineFirst` onto the port it hands the gate (`whole-test-port.ts:68-71`; compare
  `dispatch/trial-port.ts:69`). The whole gate then asks it inside the port call. At E/0083-0084
  and E/0114-0115 the recording kept the no, so the site check before it was paid for nothing.
- **The builder gate's readings are never finished.** `single-subflow-trial.ts:156-176` drops
  `request.siteChange`. The whole gate takes its own readings (`supervisor/whole-trial.ts:39-50`),
  so the second check is redundant but cheap.
- **Verdict.** The offline pass is warranted: it saved two live runs. It belongs before the first
  check. The second check is harmless.
- **Owned-dir fix** (optional, not required for t804): for a whole port, do not hand the builder
  gate `reset`. Drop `ports.reset` at `run-brief.ts:411` when `whole`, and expose the whole port's
  `offlineFirst` from `whole-test-port.ts`. The whole gate keeps its own `prepareStart`
  (`whole-trials.ts:117`). Not verified: that the start hook then still runs exactly once.

## 5. Where Core can hold "failed whole test" state, and refuse

- **The object that survives builder turns is the brief's `AutomationStudioSubflowTrialGate`.** It
  is made once per builder loop (`builder-loop.ts:264`) and already holds per-revision memory:
  `verdicts`, `closedDigests`, `trials`, `stops`, `repeatedFailures` (`subflow-trial-gate.ts:440-455`).
- **State that crosses briefs** (build brief → repair brief) uses dispatcher-keyed maps such as
  `STANDING`, `ADVISED` and `adviceOf(dispatcher, subflowKey)` (`run-brief.ts:375-378, 405`), fed
  through `dispatch/trial-port.ts:74-79`.
- **How a refusal reaches the model.** As the tool's answer,
  `refused(code, instruction, detail)` → `{kind:"llm_evidence_tool_execution", evidence:{ok:false, code, instruction,...}, effectApplied:false, targetsUnchanged:true, resultCode}`
  (`:780-782`). With no `resultReason: "retry_allowed"`, the loop's repeat guard treats sending it
  again unchanged as a failed repeat (`R/llm/repeat-guard/candidate-feedback.ts:63-67`).
- **Patterns to copy:**
  - `subflow.trial_same_failure`: a map keyed by revision and digest, checked at `:506-507` and
    set in `recordStop` `:633-644`;
  - `subflow.trial_unchanged_after_no` (`:504-505`);
  - `subflow.trial_retest_limit` (`:509-511`);
  - the completion-side mirror `completion()` (`:614-626`).

## 6. Proposed design (smallest)

**Tool shape: an optional `from` on `core.test_subflow`, not a sibling tool.**

- It keeps `finishingTools.test` (`builder-loop.ts:344`), `role-tools.ts:9`, the repeat-guard ids
  and the activity map unchanged.
- Input: `{revision, digest, from: "<step key>"}`.
- Answer: `{ok:true, fromStep:true, passed, from, stoppedAt?, steps, instruction}`. It never carries
  `partial:true`, so `answeredTrial` (`builder-loop.ts:427-432`) never records it as a trial, and
  `completion()` never accepts it. It is never judged, never counted in `trials`, and runs no
  hook, no arrival, no predecessors, no admission, no readings and no offline check.
- Its acts are recorded through `this.input.reset?.trialRan(acts, runId)` (`:578`), so the next
  whole test's before-state includes them.
- Words: `"Not the Flow's test"`, as `run-flow-part.ts:148-153` says it.
- Alternative: a sibling tool `core.run_subflow_from`. It is cleaner for step-log names, but it
  touches `role-tools.ts`, `llm/loop-budget.ts` (finishing tools) and
  `activity/wording/core-tool.ts:16-29`.

**How the failing step is identified.**

- **execution_failed.** `stoppedBy` (`trial-stop.ts:95`) carries the run-order step number (E/0051:
  `"step": 15`), the label and the definitionId, but not the plan key. Add the plan node key to
  each feedback step entry in `R/service/candidate-trial/feedback.ts:433`, from
  `node.metadata.bootstrapSymbolicKey` as `R/flow-bootstrap/trial-change/steps.ts` already reads
  it. `stoppedBy` then inherits `key`. This file is shared with the whole gate, which is fine and
  not forbidden; only `reads.ts` is forbidden.
- **no** (the run ended; the judge said no). There is no failing step. Use the first step, in plan
  order, whose node differs between the judged-no revision and the latest proposal, compared by
  node `key`, over `latest.subflows` against the proposal the gate kept for that verdict.
- **Binding closure (v1, needs no seeding).** If the step at `from` reads a value an earlier step
  produces (`$row.*` under `repeat over: X`, or a named step's output), the run must start at or
  before the producer. E/0051: step 15 "open the post" sits in `repeat over: posts`, so `from` must
  be at or before `posts`. Otherwise it is refused `subflow.from_step_unbound`, naming the
  producer. A callable target whose steps from `from` read an interface input is refused the same
  way in v1.

**The gate (Core enforces the rule).** In `AutomationStudioSubflowTrialGate`:

- Add `pendingRepair: {revision, digest, key, said} | undefined`.
- Set it when a judged trial (entry prepared, not a runner failure) answers execution_failed with a
  step stop, or answers no.
- In `test()`, before the offline check: a whole test (no `from`) while `pendingRepair` stands is
  refused `subflow.trial_from_step_first`. This covers a new revision, and also a re-test of the
  same revision after execution_failed. The instruction says to run `{revision, digest, from}` from
  the failing step or the first changed step, on the page the test left.
- Clear it when a from-step run of the **latest** revision, starting at or before that key, passes
  the key's step. "Passes" means the run's stop is after it, or the run ended.
- Unsure and not_judged are judge-level, so their same-revision re-tests stay ungated.
- Mirror it in `completion()` with the same code.
- Append to `instructionFor` (`:715-737`) for execution_failed and no: "repair live from the page
  the test left; check the fix with core.test_subflow from: <key>; test whole only when you believe
  the whole part works". Do not edit `trial-stop.ts` or the whole gate's words.
- Carry `pendingRepair` across briefs through a dispatcher map, as `STANDING` is
  (`run-brief.ts:375`).

**Files to change.**

Owned:

- `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts` (schema, `from` branch, state, refusal,
  words);
- `.../subflow-candidate/contracts.ts` (the port's optional `fromStep(request & {fromKey})` and its
  result type);
- `.../builder-loop.ts:388-390` (`next` words);
- `service/subflow-trial/run.ts`: a new `runAutomationStudioSubflowFromStep`. It opens the same
  marked session, calls the new verification entry with `rootPlan(target)`, `fromNodeKey` and no
  arrival or predecessors, and returns steps, stop and acts with no judge. Or put it in a new
  `service/subflow-trial/from-step.ts`;
- `service/subflow-trial/port.ts:45-110` (expose `port.fromStep`);
- `dispatch/trial-port.ts:67-73` (forward `fromStep`);
- `single-subflow/whole-test-port.ts:56-71`: forward `scoped.fromStep`. The scoped port is passed
  in already, so a whole-path from-step run is the router-run target as root, which matches the
  assembled Flow minus its arrival;
- `dispatch/run-brief.ts`: the cross-brief map.

Not owned, not forbidden:

- `flow-bootstrap/verification/detached-subflow-from.ts` (new) plus `detached-execution.ts`
  (`fromNodeKey`);
- `service/candidate-trial/feedback.ts:433` (step `key`);
- `activity/wording/core-tool.ts` (a "Testing one part from a step" label, if wanted).

**Where the words live, and the tests that pin them.** No system prompt mentions testing.

- The domain builder instructions say nothing about it
  (`!FluxIQWebExtension/domain/src/runtime/llm-evidence/system-instructions/instructions.ts`, pinned
  at ≤3600 characters by `tests/instructions.test.ts:57`).
- Core's wrapper is `R/llm/deepseek/system-prompt.ts` (pinned by `tests/system-prompt.test.ts`).
- All test guidance lives in tool text and answers: `subflow-trial-gate.ts:343-358, 422-428`,
  `builder-loop.ts:275, 386-390`, `single-subflow-trial.ts:133-153`. A tool description is capped at
  2000 characters (`builder-loop.ts:42-44`); `WHOLE_DESCRIPTION` is about 800.

Tests to update or extend:

- `flow-bootstrap/subflow-candidate/tests/{subflow-trial-gate,subflow-trial-stop,subflow-trial-offline,role-tools}.test.ts`;
- `project-agents/dispatch/tests/whole-trial-port.test.ts`;
- `service/project-build/tests/project-build-single-subflow.test.ts` (read-only for us;
  `service/project-build/**` is forbidden, so it can be run but not edited);
- `flow-bootstrap/candidate/tests/trial-stop.test.ts` and `trial-gate.test.ts` (if `key` is added
  to steps);
- `activity/tests/person-facing-sweep.test.ts:78-90`;
- `llm/tests/loop-budget.test.ts:384-388`.

## Not verified

- That `startNodeId` together with `inputs` behaves inside a `rootPlan` graph: whether the
  normalized node ids are found by `bootstrapSymbolicKey` and whether a primary's Flow interface
  accepts the run's inputs. Read from the source, not run.
- That dropping the builder's reset on the whole path keeps exactly one start hook (§4).
- How a from-step run that repeats a toggle-like lasting act (E's "like the post") interacts with
  the executor's already-done handling (`R/executor/step-loop/already-done.ts`). The ledger records
  the act; whether it flips back was not checked.

## Open questions

- Should a from-step run be refused once `pendingRepair` is clear, or allowed freely? I recommend
  allowing it freely, since it costs no judge calls.
- Should the "no" case's changed-step rule also accept a from-step run from an earlier step? It
  does as written: "at or before".
- Seeding the failed run's values (v2) needs a session-read port added in
  `service/project-build/subflow-trials.ts`, which is forbidden.
