# Lane 3: trial failure feedback and repeat no-progress guard

Brief: `lane3-trial-failure-feedback`. Core lane tree `C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQ`, branch `task/t566-a8-lane-4`. Nothing committed. Core dist not rebuilt.

## Outcome

Mostly done. Both causes are found with file:line, both fixes are in with tests, the package typecheck passes and the structure audit passes.

One thing could not be pinned down: the exact exception the trial port threw. The gate threw the error away, and the Lab's Core data store for the run no longer exists. The evidence narrows where it was thrown (see cause 1). From now on the error's kind is reported.

## Cause 1: why the trial ended `execution_failed`, and why its feedback named nothing

What the evidence shows:
- **The Flow ran to its end; it was not stopped by a limit.** The run's snapshot `snapshots/flow-lane.json` (instance `bf-slot-3/run-mvcvzwk1-c1d869e4`) lists both revision-4 whole trials as `execution: "succeeded"`:
  - `trial.321c3f22…` ran from 21:14:33.97 to 21:22:41.98 (488 s);
  - `trial.e55b70c9…` ran from 21:22:56.50 to 21:30:53.57 (477 s).
  The ~480 s is the 40 passes of `repeat most: 40`: the read plus a move-on step that moved nothing.
- **No judge was ever asked.** `snapshots/live-llm.json` shows judge calls (`loop_verification`) at indices 23-24, 27-28, 36-37 and 50-51. None of them falls between the decisions around steps 83 and 85.
- **Something threw about 11.5-12 s after each execution ended.** The tool ended at 21:22:53.47 and 21:31:05.50 (`logs/core.log`, `tool end … resultCode=subflow.trial_execution_failed`).

So the throw came from Core's own code that runs after a successful execution and before the judge call.

Why the feedback was empty:
- The whole-Flow gate catches any throw from its trial port and answers `{ code: "candidate.trial_port_failed" }`, discarding the error: `flow-bootstrap/candidate/trial-gate.ts:513-519` before this change. The subflow gate does the same at `subflow-trial-gate.ts:550-554`.
- The single-subflow path (`project-agents/single-subflow/single-subflow-trial.ts:206-218`) copies that feedback to the builder unchanged.
- The builder's gate then answered with `INSTRUCTIONS.execution_failed`, "Read the feedback for the step that failed" (`subflow-trial-gate.ts:298`), though no step existed.
- The same-failure rule could not close the revision. `stoppingStep` (`trial-gate.ts:593-602`) needs a failed last step in `feedback.steps`, so the builder re-tested blind.

Where the throw can be, given the order of `service/candidate-trial/run.ts`:
- the session was written as succeeded at lines 127-130;
- the summary at 146-155 is inside try/catch;
- the judge's own `verify` is wrapped by `automationStudioResultVerificationWithinDeadline`, which never rejects.

That leaves the unguarded calls:
- in `run.ts`: frame evidence (133), `wayOutHandles` / `clearedControlHandles` (134), learned paces (136), landed acts (138);
- in `judged()`: `ports.judge` → `AutomationStudioProjectBuildTaskChecklist.whole` and `automationStudioBuildTestSummaryWithTaskChecklist` (judge.ts:289-292), and `Feedback.judged`;
- the whole-trial wrapper in `service/project-build/whole-trials.ts:67-76`.

I ruled out the domain's `clearedControlHandles`: it is local, has no timeout and catches its own failures. I also ruled out the purse paths: refusals come back as values. The next live run will name the error kind under `feedback.stoppedBy.failure`.

A second defect, found on the way: `service/candidate-trial/feedback.ts:211,320` (`MAX_STEPS = 40`, `ran.slice(0, MAX_STEPS)`) keeps the **first** 40 steps. A long loop that fails late therefore never lists its stopping step, and the gate's `steps.at(-1)` is a succeeded step. That file is outside my ownership; see Open questions.

## Cause 2: was there a guard for a repeat loop that makes no progress?

No. The only "no progress" guard is `executor/state-routing/progress-guard.ts`. It covers state routes only, and its progress mark counts every Repeat body pass as progress (lines 11-12 and 21-29), so it can never stop a do-while loop.

The Repeat node (`nodes/control-flow/repeat.ts:71-82`) ends only at `most`. Nothing compared one pass with the last.

## What changed and why

**Repeat no-progress guard (cause 2).** New module `runtime/executor/repeat-progress/no-progress.ts`, with barrel `index.ts`, called from `runtime/executor/graph-run.ts`, right after an attempt is stamped.
- **When a pass made progress:** one of its steps stored a row (`outputs.records`) that no earlier step of the run stored, or the host's own `stateRefs.stateDiff` for one of its steps shows a document or location change, or anything added or removed. Core already reads these diff keys in `landed-acts.ts:114-121`.
- **Only positive evidence counts against a pass:** the host traced at least one diff in the pass, and every step without a diff is a Core node that acts on nothing outside the run (side-effect class `none`). Two consequences:
  - A loop of Core-only steps is never stopped. The existing test of 300 passes of set/get variable still passes.
  - A host that traces no diffs is never stopped.
- **What happens on a stall:** after 3 passes in a row with no progress (`AUTOMATION_STUDIO_REPEAT_NO_PROGRESS_LIMIT`, matching the state-route limit of 3), the Repeat's arrival for the next pass becomes a failed attempt:
  - code `repeat.no_progress`, category `unexpected_state`, not retryable;
  - `expected`/`actual` text naming the passes and the pass it stopped before, for example: "Passes 2 to 4 of this repeat stored no new rows and left the page as it was, so the loop stopped before pass 5…";
  - the run ends failed with the same failure on the trace.
- **Effect on this run:** the Flow would have failed before pass 5, with roughly 22 steps listed (under the 40-step cap), instead of running 40 passes for 480 s.
- **Header note** added to `nodes/control-flow/repeat.ts`.

**Execution-failed feedback (cause 1).** New module `runtime/flow-bootstrap/candidate/trial-stop.ts`, exporting one object, `automationStudioCandidateTrialStop`, re-exported from `candidate/index.ts`.
- **Every `execution_failed` answer now carries `stoppedBy`** in the same feedback object the builder reads. It is one of:
  - `step`: number, label, failure code, `ranBefore` (times the step ran earlier in the trial, which shows the pass reached), and the step's `actual`;
  - `steps_left_out`: how many steps are listed and how many are not;
  - `graph`;
  - `start`;
  - `trial_runner`: the port threw, named by the error's `name` only and never its text; this kind also covers answers Core could not read;
  - `run`: no step failed and the run stopped between steps.
- **`trial-gate.ts`:**
  - a port throw answers `Stop.portFailed(...)`;
  - answers pass through `Stop.told`;
  - the execution-failed instruction is the gate's own first sentence (kept, so the t420/t661 tests still match), then what stopped it, then what to do for that kind of stop, including no-progress loop wording;
  - the same-failure rule now also closes a revision whose port threw twice with the same error kind (`Stop.signature`). Answers Core could not read never close it.
- **`subflow-trial-gate.ts`:**
  - the same port-throw handling, `stoppedBy` and instruction;
  - a trial-runner failure no longer gets `ENTRY_NOT_PREPARED`, which wrongly blamed "a subflow that runs before this one";
  - it gains the t368 same-failure rule: same signature twice → `retestsLeft: 0`, `failedStep`, and a later test refused `subflow.trial_same_failure`. This is what stops the blind re-test in the single-subflow path.
- **`activity/candidate/trial-words.ts` (chat):** `subflow.trial_port_failed` now has person words, and a `repeat.no_progress` step is described by its own `actual` sentence.
- **Tests:**
  - `executor/repeat-progress/tests/no-progress.test.ts` (9 tests);
  - `executor/tests/repeat-progress/tests/no-progress-run.test.ts` (2 tests, graph-run integration with a host that traces diffs). It lives in a feature subfolder because `executor/tests/` would otherwise hold 26 files, over the 25-file limit;
  - `flow-bootstrap/candidate/tests/trial-stop.test.ts` (8 tests);
  - `flow-bootstrap/subflow-candidate/tests/subflow-trial-stop.test.ts` (3 tests);
  - one new case in `activity/candidate/tests/result.test.ts`.

The words are generic and checked against a list of Lab scenario words in the tests. No feedback example is shaped like a scenario.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- `pnpm.cmd exec vitest run` over these folders:
  - `runtime/executor/repeat-progress/tests`, `runtime/executor/tests`, `runtime/executor/step-loop/tests`, `runtime/executor/state-routing/tests`;
  - `nodes/control-flow/tests`;
  - `runtime/flow-bootstrap/candidate/tests`, `runtime/flow-bootstrap/subflow-candidate/tests`;
  - `runtime/activity/candidate/tests`;
  - `runtime/project-agents/single-subflow/tests`.

  Result: `Test Files 117 passed (117)`, `Tests 863 passed (863)`. The new files: no-progress (9), no-progress-run (2), trial-stop (8), subflow-trial-stop (3), result.test (20).
- Earlier runs, kept for the record:
  - My first integration test expected a stop before pass 5. It actually stopped before pass 4, because in that test pass 1 also stores nothing. The guard was right; I fixed the test.
  - The first guard version would have stopped Core-only loops; the existing 300-pass graph-run test exposed this. I fixed the rule to require host evidence.
  - My first `trial-stop` version closed a revision on two step-less `execution_failed` answers, which broke the existing `trial-gate.test.ts` re-test-bound test. I narrowed the signature to port throws only.
  - One run failed to load five test files: `flow-bootstrap/plan/validation.ts` imported `./parameter-schema-fit.ts`, which did not exist. That was the other worker's in-flight edit; it resolved on its own before the final run.
- `pnpm.cmd exec tsc --noEmit -p tsconfig.json`: exit 0, no output. An earlier run caught type errors in my two new gate tests (`evidence` is a `JsonValue`); fixed.
- `node scripts/structure-audit.mjs`, from the Core root: exit 0, `structure-audit: passed (397 warning(s), 1155 baselined)`. An earlier run failed `[directory-files] executor/tests/: 26 source files`; fixed by the move above. The remaining warnings on my files are the 400-line advisory: `graph-run.ts` 525, `trial-gate.ts` 771, `subflow-trial-gate.ts` 741. All three were already over 400 before this change.

## Not verified

- The exact exception the trial port threw in `run-mvcvzwk1-c1d869e4`. The error was discarded and the store is gone.
- No live or browser run. In particular, I did not check against the real web host that:
  - a move-on step that does not move the page yields an empty `stateDiff`;
  - an `extract_list` read yields an empty `stateDiff`.

  I based this on reading the domain's host runtime (`domain/src/runtime/host-runtime.ts:261-268`; the diff is of the compact view's lines, whose header carries the view position). A page with lines that change on their own (clocks, live counters) would give non-empty diffs, so the guard would not fire there. That is the safe direction.
- No full suites (`pnpm check`, `pnpm test`), per the twice-a-day rule. Core dist not rebuilt, per the brief.

## Open questions or contradictions found

1. **`service/candidate-trial/run.ts` (outside my ownership).** A throw after a successful execution, at lines 131-156 or inside `judged()`, should be caught there. It should answer with the trial's own evidence (`Feedback.executionFailed` with the trace, or `not_judged`), not reach the gate as a bare port failure. Then even this case would list the steps and the pass reached. My gate change names only the error kind, because the gate never sees the trace.
2. **`service/candidate-trial/feedback.ts:211,320` (outside my ownership).** The step list keeps the first 40 steps. When it truncates, it should keep the last step (the one that stopped the run) as well. Until then the gate says `steps_left_out` honestly but cannot name the step.
3. **Files edited beyond the four the brief named,** all supporting the two fixes:
   - `flow-bootstrap/candidate/index.ts`: one barrel line;
   - new `flow-bootstrap/candidate/trial-stop.ts`, the gates' shared stop reader;
   - `nodes/control-flow/repeat.ts`: header comment only;
   - `runtime/executor/graph-run.ts`: repeat-loop execution;
   - new `runtime/executor/repeat-progress/`.

   Please confirm these fall within "repeat-loop execution and the gates".
4. **The single-subflow wrapper drops the whole gate's `instruction` and `failedStep`.** It forwards only `feedback` (`single-subflow-trial.ts:212-218`). That is why the builder's own gate now carries the same-failure rule. If the wrapper ever forwards `failedStep`, the two rules overlap but agree.
