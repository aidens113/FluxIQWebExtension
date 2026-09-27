# t220 Run-2 Acceptance Audit

## Scope

Read-only audit of the `everything-store` created-Flow task and the runner paths that resolve, execute, judge, observe, and evaluate it. No run artifacts, provider/page payloads, browser state, secrets, builds, or live work were read. No product or shared-document files were changed.

## Files inspected

- `apps/scenario-lab/src/scenarios/everything-store/manifest.ts`
- `apps/scenario-lab/src/scenarios/everything-store/workflows/plus-under-fifty.ts`
- `apps/scenario-lab/src/scenarios/everything-store/workflows/earbud-records.ts`
- `apps/scenario-lab/src/scenarios/everything-store/workflows/shared-steps.ts`
- `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts`
- `packages/test-runner/src/flow-lane/creation/instruction-task.ts`
- `packages/test-runner/src/flow-lane/creation/request.ts`
- `packages/test-runner/src/flow-lane/creation/judgement.ts`
- `packages/test-runner/src/flow-lane/creation/own-page.ts`
- `packages/test-runner/src/flow-lane/creation/lane.ts`
- `packages/test-runner/src/flow-lane/lane-observation.ts`
- `packages/test-runner/src/flow-lane/run-flow-lane.ts`
- `packages/test-runner/src/flow-lane/expectations.ts`
- `packages/test-runner/src/run-expectations/extraction/judgement.ts`
- `packages/test-runner/src/lane-rules/built-flow.ts`
- `packages/test-runner/src/run-evaluation/run-outcome.ts`
- `packages/test-runner/src/run-evaluation/single-run-evaluation.ts`
- `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`
- `packages/test-runner/src/bench/aggregate-report.ts`
- `packages/test-runner/src/run-scenario.ts`

## Exact qualifying conditions

The selected task is the positive `navigate-and-extract` task for the `plus-under-fifty` workflow. It uses `judgeBy: "expected-dataset"`, names the workflow's one expected extraction, requests no variant or special permit, and expects the complete qualifying catalog result in original result order.

A formal runner pass requires all of the following:

1. **Request resolution:** the task resolves uniquely to the positive workflow and to an extract step with a declared record/count expectation.
2. **Runnable Flow:** instruction build/review produces an approved Flow. For an evaluated Flow lane, `assertFlowLaneBuiltFlow` prevents recording/setup success from substituting for a built Flow.
3. **Owned navigation:** because the task kind is `navigate-and-extract`, the created Flow must contain and execute its own navigation node; starting it on the fixture page does not satisfy this.
4. **Completed runtime:** the run must not stop with unvisited actions and no failed attempt. The workflow declares no expected failure, so no runtime failure may remain.
5. **Dataset oracle:** at least one extract node must exist, every value across the run's extracted datasets must be a string, and the first dataset by node execution order must match the declared dataset exactly:
   - exactly 13 records;
   - all four required fields (`name`, `price`, `rating`, `url`) present with values;
   - every record has exactly the declared keys and values at the same position (there are no optional fields), preserving ordering and duplicates exactly as declared;
   - same-origin absolute URLs may match their root-relative expected form.
6. **Scenario/facility guards:** the fixture's at-load facts must hold, the scenario permits no console errors, the network guard must report no violation, and final scenario evidence must be reached.
7. **Published evaluation:** the raw runner verdict must be `passed`, and the evidence-budget invariant must not downgrade the evaluated outcome.

For a **qualifying MVP run-2 result**, use the stricter evidence tuple already used by aggregate reporting: evaluation verdict `passed`, `flowCreated: true`, `oracleVerdict: "passed"`, and `reportedVerdict: "passed"`. Also inspect `resultVerification`: `confirmed` is affirmative self-judgement; `unverified` is not. This matters because the created-dataset assertion path does not itself assert `reportedVerdict === "passed"`; exact fixture records can make the runner pass even when Core explicitly reports the result as `unverified`. Conversely, the mapping treats `no_result` or an absent verification as `passed`, so `reportedVerdict: "passed"` alone does not prove that answer judgement occurred.

## Important measurement semantics

- Unexpected extra fields are counted as a measurement rather than asserted separately, but they still fail this task because exact record equality rejects keys outside the expected record and there are no optional fields.
- Additional extraction datasets are measured as unpaired; the created task judges the first dataset by execution order. Extra later datasets do not by themselves fail, provided they introduce no non-string extracted value. If an irrelevant dataset executes first, it is the judged dataset and fails even when a correct one follows.
- The workflow's recorded action expectations, recording-event expectations, and ordinary final-state assertions are not the created dataset task's oracle. The exact expected dataset is its oracle; owned navigation and runtime/failure checks are separate guards.
- Repeatability or repair is not declared by this scenario as a single-run pass condition. A campaign command may impose an additional streak/replay requirement, but that is outside this manifest's acceptance contract.

## If instruction build stops early

No qualifying pass is possible. The fallback Flow observation records `flowCreated: false`, `oracleVerdict: null`, `reportedVerdict: null`, no actions, `extraction: null`, `harnessRecovery: null`, and zero harness activations. The nulls mean **not reached/unmeasured**, not an empty correct result or proof that no recovery would have been needed.

Consequently, all of the following remain unmeasured: owned navigation, runtime status and action success, early-stop behavior, expected-failure comparison, extraction node presence, dataset count/records/fields/order/value types, result self-judgement, and any recovery/replay behavior. Fixture facts checked before the build and build-stage evidence may still exist, but neither can qualify the run. A thrown build failure also bypasses the normal post-lane console/network/final assertions, although cleanup/failure publication still runs.

## Risks

- A green raw runner verdict is weaker than the desired self-judged MVP claim unless the published observation also has `reportedVerdict: "passed"` and affirmative result verification.
- Later extra datasets can coexist with a pass, although extra fields in the judged records cannot; acceptance review should inspect unpaired-dataset measurements if redundant extraction is considered a product defect.
- `extraction: null` after an early build stop must not be interpreted as a judged extraction with zero mismatches.

## Commands/checks

- Read-only source inspection with `Get-Content` and `rg` over only the files above.
- One provider-free, read-only TypeScript import evaluated the declared workflow expectation: `count = 13`, `records.length = 13`, and the four expected field names. It did not print record values.
- No build, test suite, browser, Lab, provider, runtime process, or artifact inspection was performed.
