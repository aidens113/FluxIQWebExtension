# t408 handler boundary scope: report

## Outcome

Partial. Handlers now fire only at steps that act on or read the host, and the merge boundary costs 0 ms. The coordinator's extra item (a closed `run.outcome_uncertain` stop code) is stamped on the trace. Two things are still open, both in files this task does not own:

- **The remaining ~4-5 s per acting boundary.** The time is not in the fact check, which takes 3-34 ms. It is in Core's trace withholding at the end of each handler-body run (details below). The fix belongs in `runtime/executor/lifecycle-run/**` or `trace-withholding.ts`.
- **Readers of the stop code.** The run detail, the activity ending and the Lab do not read `trace.failure` yet, and their files are outside this brief.

## What changed and why

Core (`packages/fluxiq/src/programs/automation-studio/`):

- `runtime/executor/lifecycle/event-applies.ts` (new) holds the one rule, `automationStudioLifecycleEventApplies(event, node)`:
  - `start` fires at a frame's first node, whatever that node is.
  - `before`, `retry`, `fail` and `before_next` never fire at Core plumbing. Plumbing is every control-flow node except Call Subflow, which covers Start, End, Merge, Parallel, Branch, Switch, Loop, For Each, Repeat, Handler and Handler End, plus `builtin.timing.wait`.
  - The list comes from `controlFlowNodes`, so a control node added later is treated as plumbing by default.
  - The function is exported from the `lifecycle/` barrel.
- `runtime/executor/step-loop/lifecycle-dispatch.ts`: the dispatcher asks that rule first. At plumbing it returns `pass`, after standing the cursor and before any registry or fact work.
- `model/validation/flow.ts`: a node-scoped registration naming a node where its event never fires is refused with `flow.handler_scope_plumbing_node`.
  - It imports `event-applies.ts` directly, not the barrel. Going through the barrel closed an 11-module import cycle (lifecycle/budget.ts -> model/index -> validation -> lifecycle/index), which the audit flagged. The imports rule allows the direct import for that reason.
- Coordinator item: `runtime/executor/step-loop/uncertain-stop.ts` (new) holds `automationStudioOutcomeUncertainTrace`.
  - It ends the run failed with the plain "Outcome uncertain: ..." sentence.
  - It adds `trace.failure = { category: "ambiguous_or_unknown", code: "run.outcome_uncertain", retryable: false, stage: "confirmation", effect: "ambiguous" }`.
  - All three uncertain endings go through it:
    - `lifecycle-dispatch.ts` stopTrace;
    - `failed-attempt.ts` settledUncertainAct (the effect check answered `unknown`);
    - `failed-attempt.ts` the ladder stop on a fault with `actUncertain`.
  - The failed attempt keeps its own failure, for example `timeout/web.action.timeout`.
  - No `executor/defensive/**` edit was needed.

Tests:

- `runtime/executor/step-loop/tests/lifecycle-plumbing.test.ts` (new) uses the flow start -> s1 -> merge -> wait -> s2 -> done. It checks:
  - before and before_next ask the host only at s1 and s2;
  - a handler whose facts hold runs before s2, not before the merge;
  - the classification table, and that the Wait id matches the timing node's id.
  - With the guard switched off, three of the four tests fail.
- `runtime/executor/step-loop/tests/uncertain-stop.test.ts` (new) checks two runs:
  - a committing press that timed out ends with `run.outcome_uncertain`, keeps its sentence, and its attempt keeps `timeout/web.action.timeout`;
  - a run that failed any other way has no stop code.
- `model/validation/tests/flow.test.ts`: new case. Merge, Wait and End are refused for `fail`; acting nodes are accepted; Start is accepted for `start` and refused for `before_next`.

## Measurement (row 5, crossborder `flash-deal-stuck`, provider-free, headed)

Method:

- I added temporary timing logs to Core's compiled `dist`, then rebuilt Core to remove them. A grep for `__t408` in `dist` now finds nothing.
- To run row 5 in this tree, I temporarily copied t404's uncommitted locator-fact version of `packages/test-runner/src/recovery-matrix/flows/hub/promotion-handler.ts`, then reverted it with `git checkout`. Without that copy the row is blocked: "names 2 element(s) by an evidence handle".
- The baseline runs used `FLUXIQ_LAB_ALLOW_STALE_CORE=1` on the old build.
- Every run reproduced the existing verdict: "the run ended with unexpected_state/web.action.blocked_by_dialog, not the declared unexpected_state/web.target.not_actionable". That mismatch comes from before this task.

### Before (old build)

The merge `s9` boundary took 6.0 s in the retained t404 run and 10.8 s in run `rmx-2026-10-10T07-26-25-100Z-f94333`. In that run:

| Part | Time |
| --- | --- |
| Dispatch and registrations | ≤1 ms |
| `when` fact round trip, Core -> extension -> page and back | 7 ms |
| Handler body: the click, then a ~1.1 s after-action snapshot | 2.8 s |
| End of the body's graph run | **7.5 s** |
| Settle fact check | 457 ms (other boundaries: 19-34 ms) |

Across all boundaries in four instrumented runs, the fact round trips took 2-34 ms, with one outlier at 457 ms.

### Where the 4-7 s goes

`runGraphToTrace`'s `withholding.apply(...)` at the end of every handler-body run takes 3.7-4.5 s (run `...07-34-...`: 4483, 4288, 4036 and 3740 ms).

- The cause is `runAutomationStudioHandlerBody`, called from `lifecycle-run/dispatch.ts` `runCandidate` with `inputs: { ...input.values }`. It hands the body every value of the parent run, about 0.9-1.1 MB of node outputs, as its run inputs.
- `graph-run.ts` `runGraphToTrace` supplies all run inputs to the trace withholding, because their sensitivity is unknown. It then rewrites a 3.3-3.8 MB body trace against them.
- The root run's own withholding on an 11 MB trace with 96 bytes of inputs takes 71 ms. So the cost scales with the inputs handed to the body, not with the size of the trace.
- The remaining ~1.1 s per acting step is the click's after-action state snapshot. That is normal step cost.
- The command-run checkpoint is not involved: this Lab path never reaches the command-run fingerprint.

### After (new build, run `rmx-2026-10-10T07-57-54-921Z-ce1511`)

- Merge nodes s2, s4 and s9 get no dispatch, no fact check and no handler run. The time from the s9 step to the s10 fact check is **3 ms**.
- The `before` fact checks at acting steps take 3-13 ms each.
- A handler run at an acting step still costs ~4.8-6.3 s because of the withholding above.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/model/validation` (Core `packages/fluxiq`) -> `Test Files 86 passed (86)`, `Tests 764 passed (764)`.
- `npx vitest run .../runtime/executor/step-loop` with the dispatch guard switched off -> 3 failed, 1 passed. With the guard back in -> 6 passed.
- `npx tsc --noEmit -p tsconfig.json` (Core fluxiq) -> exit 0, no output.
- `node scripts/structure-audit.mjs` (Core) -> `structure-audit: passed (318 warning(s), 1160 baselined)`. The first attempt failed with 3 import-cycle violations, which the direct import fixed.
- `pnpm --filter fluxiq build` -> built. A second run restored clean output; `grep -rl __t408 dist` found nothing.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 5`, five runs: one blocked (evidence handle), three baselines, and one after the change. Each completed run gave verdict `failed` with the reason quoted above.

## Not verified

- No downstream code changed, so no downstream tests ran. The fact path there is already zero-wait, measured at 2-34 ms.
- Nothing reads `trace.failure` yet:
  - the run detail summary (`runtime/service/summaries/**`, owned by t406, must not touch);
  - the activity ending (`runtime/activity/**`);
  - the Lab, which derives `run.failure` from attempts in `packages/test-runner/src/flow-lane/persisted-flow-run.ts`.
  - Until they do, row 9 will still read `timeout/web.action.timeout`.
- A Call Subflow attempt now takes a child's `run.outcome_uncertain` as its own failure through the existing frame-failure handoff. Only the `runtime/executor` tests exercised this; they all pass.
- The lifecycle `stopTrace` outcome-uncertain path is not covered by its own test. Callers always pass `lastingActStatus: "none"`, so the dispatch path cannot reach it in a test.
- The extension, test-runner and scenario builds in this tree were rebuilt by the Lab. The test-runner was built from the temporary Flow copy, so it is stale against source now that the file is reverted. The next Lab run rebuilds it.

## Open questions or contradictions found

- The brief named `runtime/executor/step-loop/lifecycle.ts`; the file is `step-loop/lifecycle-dispatch.ts`.
- Reaching the "well under a second per boundary" target needs a change outside this brief, in `lifecycle-run/dispatch.ts` or `handler-body.ts`, or in `trace-withholding.ts`. Two options:
  - give the body only the parent frame's declared inputs (`current.inputs`) and read the parent's values in a way that is not treated as new run inputs;
  - pass the parent's withholding set instead of making all its values into inputs to withhold.
- `start` fires at a frame's first node even when that node is a Start. I read the brief's "Call Subflow for `start`" as Call Subflow counting as an acting node.
