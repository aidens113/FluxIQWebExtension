# t194-w7: a re-authored Flow lost the optional route of a press it inherited

Worker report. Core paths are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/` in
`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`.

## Outcome

Done for items 1 and 2: the cause is found, fixed and tested. Item 3's cause is
found. It sits in the executor, outside my files, so it is not fixed here and
the proposed diff is below.

## 1. Cause: how routing decides `failed -> merge`, and why the seed lost it

- **The route comes only from the draft step's `routing` field.**
  `flow-bootstrap/authoring/draft-routing.ts:113-126` (`routing.kind === "optional"`)
  emits the step with `branches: [failed -> join]` followed by a new Merge.
  The step's success falls through into the Merge, so the assembler wires
  `failed -> merge:in` and `success -> merge:branches`. A step with no `routing`
  is emitted as a plain step (`:108-110`) with no branches. Nothing is derived
  from run evidence. `routing` is set only by the model's amendment
  (`flow-draft/amendment.ts:211`, `change: "optional"`).
- **The seed wrote no `routing`.** `llm/node-tools/draft-from-flow.ts`
  (`automationStudioFlowDraftSeedFromFlow`) turned every node except
  start/end (`DERIVED_CONTROL_NODES`, `:63`) into a plain step, and it read the
  edges only to order the steps. So the Continue press became an unrouted step,
  and routing gave it no `failed` edge.
- **Why the Merge survived with one input.** `builtin.control.merge` is not in
  `DERIVED_CONTROL_NODES`, so the Flow's own join was seeded as an ordinary step
  after the press and assembled into the straight line (`s4:success -> s5:in`).
- **Confirmed from the kept database** (run 4 `project.sqlite`,
  `graph_operations`):
  - Revision 1 (the build, `legacy_import`) had `s4:failed -> s5:in` and `s4:success -> s5:branches`.
  - Revision 2 (the re-author, "Reconcile recording-generated Flow graph") deleted both edges and added `s4:success -> s5:in`.
  - Revision 3 is the same straight line.

## 2. Fix

- **`llm/node-tools/draft-from-flow.ts`.** A new function, `optionalNodeIds`
  (`:171`), finds each node whose `failed` edge and `success` edge both lead
  into the same `builtin.control.merge`. The seed writes
  `routing: { kind: "optional" }` on those steps (`:104`, `:127`). Both edges
  are required: a node whose failure alone reaches a Merge is an `only_if`
  guard or an `on_failed` step, and seeding either as optional would change what
  the Flow does. The header comment is updated.
- **`flow-bootstrap/authoring/draft-routing.ts`.** When the step after an
  optional one is already a Merge with no routing of its own, the optional
  step's `failed` goes to that Merge (`:113-121`, `heldJoin` at `:249`). No
  second join is added. The seed keeps the Flow's own Merge as the step right
  after the press, because the seed's walk follows the press's edges into it.
  Keeping that Merge means:
  - the plan keys stay `s1..s6`, as the build numbered them;
  - `automationStudioFlowDraftPlanNodeIds` (positional, used at `service.ts:1614`) still maps every inherited node to its old id, the Merge included;
  - the graph has one join with two inputs, not a second join beside a one-input Merge.
- **Inherited and changed steps.** An untouched seeded step keeps its routing.
  A step the re-author adds or reruns is a new `d<n>` step, and its routing is
  whatever the model gives it, exactly as in a build. The model can still clear
  or change a seeded step's routing through `amend_draft`.

### Tests

- `llm/node-tools/tests/draft-from-flow.test.ts`, new describe "a re-authored Flow keeps the routing it inherited", modelled on run 4's graph:
  - `navigate -> type -> Go -> Continue (optional) -> merge -> extract_list`, with the edges in the build's order, failure first.
  - The seed marks only the Continue press `optional`.
  - A press whose failure alone reaches the Merge (a guard) is not marked optional.
  - The re-author leaves the Flow untouched except for one changed step: it drops the old extract and reruns it with an added field.
  - The assembled plan is `[navigate, type, click, click, merge, extract_list]`. Its edges include `s4:failed -> s5:in`, `s4:success -> s5:branches` and `s5:success -> s6:in`.
  - The node ids map `s1..s5` to the old ids, the Merge included.
- `flow-bootstrap/authoring/tests/draft-routing.test.ts`, new case "joins at the Merge already written after an optional step rather than adding a second". An optional step followed by a written Merge gives one Merge with both edges, and the Merge traces back to its draft step.
- **Fail without the fix.** I temporarily restored `HEAD`'s `draft-from-flow.ts` and `draft-routing.ts`, ran the new tests, then put my versions back. Both new seed tests failed:
  - `expected [ null, null, null, null, null, null ] to deeply equal [ null, null, null, 'optional', …]`
  - `expected [ 's1:success -> s2:in', …(4) ] to deeply equal ArrayContaining{…}`

  That run printed `Tests 2 failed | 10 passed (12)`. Only type annotations in the test changed after this run (`effect: "observe"`, and the `toolId` constant), not the logic it checks.

## 3. Why the Lab bundle showed only the re-run's two failed s4 attempts

`repair-rerun.ts` does not drop the attempts. It keeps them all:
`attempts: [...session.trace.attempts, ...retryTrace.attempts]` (`:136`). The
cause is an **attempt id collision**:

- The executor names an attempt `${node.id}.attempt.${attempts.length + 1}`, counting within one run (`executor/graph-run.ts:451,457,459`; `executor/node-execution.ts:77,103`; `executor/attempt-trace.ts:24`). A re-run starts a fresh count at 1.
- The re-author kept every node id (`node.bootstrap.5d98a75a68c43949.main.s1..s6`). So the re-run's `s1.attempt.1`, `s2.attempt.2`, `s3.attempt.3` and `s4.attempt.4` have the same ids as the first pass's attempts.
- The run store writes an event only when its id is new (`storage/project/runtime-stream-store.ts:220-224`). The event id is `action_attempt:${attemptId}` (`:525`, `:542`). Reading back also keys by `attemptId` (`:553`). So the re-run's first four attempts were dropped, and only `s4.attempt.5` and `s4.attempt.6` were new.
- **Evidence from the kept database:**
  - Event chunk 20-26 holds action events for `s4.attempt.5` and `.6` only (sequences 21-22), plus recovery "selected" rows naming `s4.attempt.4`, `.5` and `.6`.
  - `runtime_action_summaries` still shows `s4.attempt.4` as **succeeded**, with the first pass's timestamp. The re-run's own s4 attempt 4, which presumably failed, is therefore mis-recorded rather than only missing.
- This also affects `from: "resume"` whenever a resumed node's new attempt number equals one the first pass used.
- The Lab's `flowActionsSnapshot` only shows what the store holds, so it is not the cause.

**Not fixed; the files are outside my ownership** (executor). Renaming the ids
afterwards inside `repair-rerun.ts` would be unsafe. The attempt id is also
used during the run by host-state captures (`executor/host-state.ts:29,38`),
the defensive ledger, transitions (`executor/actual-transition.ts:6`), asks and
child-flow options (`node-execution.ts:166`). A rename would detach those
records. Proposed diff: continue the numbering from the prior pass.

```diff
--- runtime/executor/contracts.ts  (AutomationStudioGraphExecutionOptions)
+  /** Attempts already recorded for this run; a re-run numbers its own after them so ids never repeat. */
+  priorAttemptCount?: number;
--- runtime/executor/graph-run.ts  (:451, :457, :459, :463, :569)
-  attempts.length + 1
+  (options.priorAttemptCount ?? 0) + attempts.length + 1
--- runtime/service/runtime-adaptation/repair-rerun.ts:116
-    { ...(input.graphOptions ?? {}), ...(resumeNodeId ? { startNodeId: resumeNodeId } : {}) },
+    { ...(input.graphOptions ?? {}), priorAttemptCount: input.session.trace?.attempts.length ?? 0, ...(resumeNodeId ? { startNodeId: resumeNodeId } : {}) },
```

Before applying it, check whether anything relies on `attemptIndex = attempts.length` (`graph-run.ts:475`), for example to index into `attempts`. That index must stay local and must not take the offset.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq` unless noted.

- `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/flow-bootstrap/authoring src/programs/automation-studio/runtime/service/runtime-adaptation` -> `Test Files 14 passed (14)`, `Tests 126 passed (126)` (final run).
- Wider run of the same three directories plus `llm/harness-options` and `flow-draft` -> `Test Files 27 passed (27)`, `Tests 282 passed (282)`.
- `npx vitest run ... llm/harness/tests/draft-screen.test.ts src/programs/automation-studio/runtime/flow-bootstrap` -> `Test Files 40 passed (40)`, `Tests 767 passed (767)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w7 tsc" npx tsc --noEmit -p tsconfig.json`:
  - The first two runs failed on my test file: `TS2322 '"read"'` and `TS2375 toolId`. I fixed both.
  - Final run: `[heavy] t194-w7 tsc holds b3`, no errors, exit 0.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (195 warning(s), 354 baselined).` It also said "1 baseline entries can be lowered". That entry is not mine to record.
- Fail-without-fix check: see Tests above (`Tests 2 failed | 10 passed (12)` with `HEAD`'s sources).

## Not verified

- No live or Lab re-run; the brief forbids it. That the re-authored Flow now skips a missing Continue press at run time is inferred from the plan's edges, not observed.
- `only_if`, `on_failed` and `repeat` are still not inherited by the seed. Only the `optional` shape is read back. A Flow that has those shapes still loses them on a re-author: the guard, the recovery and the loop are flattened.
- The item 3 diff is not applied or tested.

## Open questions or contradictions found

- **Positional node-id mapping, a pre-existing hazard.** `service.ts:1614` maps plan keys to old node ids with `automationStudioFlowDraftPlanNodeIds`. That function counts proposed steps positionally, but a routed draft inserts derived joins into the plan (`s<n>` shifts).
  - Suppose the re-author makes a step optional, or drops the seeded Merge after an optional press. Every later inherited node is then mapped to the wrong key.
  - A key with no mapping is then minted as `node.bootstrap.<ns>.main.s<k>` (`flow-bootstrap/adaptation.ts:203`). That id can equal an old id reassigned elsewhere in the same plan, giving duplicate node ids.
  - My fix does not trigger this for an untouched inherited Flow, because it keeps the Merge in place. It remains possible when the model adds routing.
  - The robust fix is to map through the assembler's own `draftStepIdByNodeKey` (`assemble-draft.ts`), which `bootstrap-completion.ts:374` already has. It would have to be carried on the verdict to `service.ts`, which I may not edit.
- **Guard only on the Merge id.** The routing change reuses the next step only when its written node matches `builtin.control.merge` and it has no routing of its own. A build whose model ran a Merge node on purpose right after an optional step would also join there. I judged that to be the same meaning.
