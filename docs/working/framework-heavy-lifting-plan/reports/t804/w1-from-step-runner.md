# t804 W1: from-step runner and port plumbing

## Outcome

**Partial.** All six items are built, and the tests in every directory I touched pass in both
groups. The structure audit shows no violation in any file I touched.

**The required `tsc --noEmit` did not run.** It waited about 80 minutes for the shared
`heavy-check.lock`, which other agents held one after another, with 4 other jobs still queued.
I stopped my job while it was still waiting, so it never held the lock. If it had taken the lock
after I handed back, it would have been killed mid-run and left the lock stuck. Type errors
therefore remain possible: vitest strips types without checking them.

## What changed and why

R = `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`. The stable interface in
`subflow-candidate/contracts.ts` was used as it stands. I did not change it.

1. **Start node by plan key.** I added `R/flow-bootstrap/verification/from-node.ts`. It checks
   the key and resolves it to the selected graph's node by `metadata.bootstrapSymbolicKey`. The
   refusal codes are `candidate.from_node_invalid`, `candidate.from_node_unknown` and
   `candidate.from_node_ambiguous`. In `detached-execution.ts` I added a `fromNodeKey?` input,
   checked early. It is resolved after the graph-ownership check and becomes
   `executionOptions.startNodeId`. A caller's own `options.startNodeId` is still refused
   (`candidate.partial_execution_unsupported`).
2. **Runner.** `R/flow-bootstrap/verification/detached-subflow-from.ts`
   (`runAutomationStudioDetachedSubflowFrom`) runs the target alone as the root frame. Its
   `rootPlan` takes the interface off the target, because a primary takes the Flow's interface.
   It refuses any identity that names predecessors.
   `R/service/subflow-trial/from-step.ts` (`runAutomationStudioSubflowFromStep`) handles the
   service side:
   - It refuses a mismatched scope, an unknown step and an unbound step before it opens a session.
   - It opens a session marked `metadata.subflowTrial` plus `fromStep: <key>`.
   - It has no start hook, arrival, predecessors, offline check, readings, judge or traced episode.
   - It returns `passedKeys`, `stoppedAtKey`, `code`, bounded feedback (the trial's own
     `executionFailed` step listing, `start: "from_step"`, and "Not the part's test" words) and
     the acts that landed.
   - The executor fails a frame as `executor.graph.unvisited_nodes` when the steps before the
     start were never visited. That ending is read as `ended` only when every unvisited step
     could not be reached from the start, or is the body of a loop that ran no passes.
   - `port.ts` exposes it as `port.fromStep` on **live** ports only, the same way as
     `prepareStart`. It is not recorded as a trial and spends nothing. A request from another
     build is answered `not_run` / `subflow.trial_other_build`.
3. **`stoppedAtKey` on trials.** `R/service/subflow-trial/stopped-at.ts` finds the subflow's own
   attempts through its graph's node ids, in any frame. It is shared with the from-step runner.
   In `run.ts`, when a trial is `execution_failed` and the last of the subflow's own attempts
   failed, the result gets `stoppedAtKey`. A step that failed inside a `part` helper is named by
   the subflow step that called it. When a predecessor or the arrival stopped the trial, no key
   is set.
4. **Forwarding.** `dispatch/trial-port.ts` passes `port.fromStep` through; it is not listed,
   remembered or spent. `single-subflow/whole-test-port.ts` passes `scoped.fromStep` through.
   **No `stoppedAtKey` on the single path:** the whole test's feedback names steps by their
   number and label in the whole Flow, never by plan key or node id. Matching by label could
   name the wrong step.
5. **Binding check.** `R/service/subflow-trial/from-step-binding.ts` works out the run order from
   `fromKey`: breadth first along control edges, meaning a target port of `in` or `branches`. It
   treats a step's producers as:
   - the sources of value edges into it;
   - `$node.<key>.*` references;
   - for `item` / `item.*` (that is, `$row`), the For Each whose `item` edge or `body` reaches it.

   A producer the run does not reach before its reader gives `subflow.from_step_unbound`, with
   `reader`, `producer` (the root of the unbound chain, e.g. `posts`) and `chain`. An interface
   input path with no fallback gives the same code with `input`. A key that is not a step of the
   subflow gives `subflow.from_step_unknown`.
6. **Reset (§4): left unchanged, on purpose.** I did not forward `offlineFirst` through
   `WholeTestPort`, for three reasons:
   - The whole test is a bare function (`AutomationStudioProjectDispatchWholeTrial`,
     `dispatch/port.ts`) with no `offlineFirst`.
   - The whole gate's check is typed against the whole candidate's request and result, and is
     keyed by the whole revision, which `whole(request)` assembles only when it is called.
   - The whole gate asks the check again inside the port call, so moving it would either run it
     twice or need `service/project-build/whole-trials.ts` and `run-brief.ts:411`, which are
     forbidden.

   The reasoning is recorded in the header of `whole-test-port.ts`.

Barrels: I appended exports to `R/flow-bootstrap/verification/index.ts` and to
`R/service/subflow-trial/index.ts`. `types.ts` gained `executeFrom?`, a seam for tests.

Tests, each in `tests/` beside its subject:

- `service/subflow-trial/tests/from-step.test.ts`. This includes the required test: a run "starts
  at the named step on a subflow the router runs, with no reset, arrival, predecessor or judge".
  It asserts the steps that ran were `["b","c"]`, that `predecessorProposals` was never asked,
  that no judge was asked, and the session marker. The file also covers stopped, callable part,
  refusals, abort, the port, and trial `stoppedAtKey` in three cases.
- `service/subflow-trial/tests/from-step-binding.test.ts`
- `flow-bootstrap/verification/tests/from-node.test.ts`
- `flow-bootstrap/verification/tests/detached-subflow-from.test.ts`
- `project-agents/single-subflow/tests/whole-test-port.test.ts`
- Two cases appended to `project-agents/dispatch/tests/trial-port-check-rows.test.ts`. I did not
  add a new file there, because `dispatch/tests/` sits at the 25-file limit.

## Commands run and observed results

All were run from `!FluxIQ/packages/fluxiq` unless noted.

- `FLUXIQ_TEST_GROUP=parallel npx vitest run R/service/subflow-trial R/flow-bootstrap/verification R/project-agents/dispatch R/project-agents/single-subflow`:
  - First run: `Test Files 1 failed | 57 passed | 1 skipped (59)`. The failure was my own wrong
    expectation in `from-node.test.ts`: without a key, the start node also runs as an attempt.
  - After fixing it, re-running that file gave `Tests 5 passed (5)`.
  - All other files passed.
- The same four directories with `FLUXIQ_TEST_GROUP=real-sql`: exit 0,
  `Test Files 1 passed (1)`, `Tests 10 passed (10)`. Only `durable-session.test.ts` is in that
  group.
- From the Core root, `node scripts/structure-audit.mjs` gave
  `structure-audit: 3 violation(s) across 2 rule(s)`. None of them is in a file I touched:
  - `[as-never]` in `subflow-candidate/tests/from-step-repair.test.ts` (W2's);
  - `[directory-files]` in `subflow-candidate/tests/`, 27 files (W2's);
  - `[directory-files]` in `dispatch/tests/`, 26 files. The 26th is the untracked
    `pending-repair-memory.test.ts`, which is not mine.

  My own statement-packing failure in `whole-test-port.test.ts` is fixed.
- `npx tsc --noEmit -p .` under the heavy-check lock: **not run**. It was queued from about
  12:07 to 13:30. The lock was taken in turn by other agents (t802 web checks, a sweep, W2's own
  tsc on this same tree). I stopped my job before it took the lock (`tsc1.txt` was never
  created). To run it later: `L=/c/Users/osrs_/FluxStuff/lab-slots/heavy-check.lock; until mkdir $L 2>/dev/null; do sleep 20; done; npx tsc --noEmit -p .; rmdir $L`.
  W2's queued tsc on this tree (`scratchpad/w2-tsc.txt`) will cover my files too if it runs.

## Not verified

- No live or browser run: the brief forbade it. Whether `startNodeId` behaves on a real
  compiled builder plan with loops, handlers and an End node was checked only on test fixtures:
  a chain, a callable part, and the executor's own loop wiring as read from source.
- How a from-step run that repeats a toggle-like lasting act interacts with the executor's
  already-done handling (trace §Not verified).
- The binding check treats any edge into a port other than `in` or `branches` as a value edge.
  A node whose control input has another name would be misread.
- For a subflow the router runs, Flow inputs read without a fallback are not checked; only the
  target's own interface inputs are. Script `$input` outside a part carries its test value as a
  fallback.
- Offline ports offer no `fromStep`, so the gate's from-step-first rule does not apply to them.

## Open questions or contradictions found

- `rootPlan` is duplicated from `detached-subflow.ts`, adapted because it also drops the
  interface. That file was outside what I owned. Exporting a shared helper from it later would
  remove the copy.
- The supervisor should confirm that leaving `fromStep` off offline ports is the intended
  behaviour.
