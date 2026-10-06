# Report: s2-walker (read-list redesign S2: the build test's walker)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ`, branch `task/t283-read-list-s2-loop`. No commits.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The walker plans and runs a do-while span. It runs the members pass by pass and ends when the last member answers `core.replay.ended`; reaching `most` ends the loop without a failure. Both 4.2(e) defects are fixed. The fail-first tests failed first and pass now. All 11 `replay*`/`dry-run-gate*` test files pass: 133 tests.

## What changed and why

- `R/llm/node-tools/replay.ts`: added `ended: "core.replay.ended"` to `AUTOMATION_STUDIO_NODE_REPLAY_RESULT_CODES` (C6). `STATUS_BY_CODE` is unchanged, so `automationStudioNodeReplayStatus` still reads it as `failed`.
- `R/llm/node-tools/replay-span.ts`:
  - The plan union gains `{ kind: "do-while"; members; most }`. It is made first, whenever the span's first step carries `automationStudioFlowDraftRepeatIsWhile(routing)`. It needs no `over` and no `nodeOf`, so a do-while never reaches the `routing.over` lookup or the over-based plans.
  - `most` comes from the routing. Otherwise it is the `most` default on the Repeat node (`builtin.control.repeat`), read from its definition the way For Each's bound is, with 50 as the fallback. The helper `repeatBound` is module-private, so the file gains no export.
  - Run rules:
    - `runPass` now returns `stopped | ended | failed | passed`.
    - When the last member answers `ended`, that pass counts as `replayed` and the loop ends.
    - Otherwise, after a pass in which every member passed, another pass runs.
    - After a pass in which any member did not pass, the loop goes no further, because the Flow stops there. That pass's status and code are kept, as a list pass keeps them.
    - Reaching `most` sets no `overBound`, so it is not a failure.
    - `ended` from any member but the last reads as `failed`.
    - When the last member is only checked (verify mode), the span runs once, mirroring the existing `once` rule for while plans.
  - Observations carry `pass` and `of` (the pass count). The step-log pass scope is kept: `{ pass }` only, because a do-while has no row count or labels.
  - `nodeOf` on the run input is now optional (absent only for a do-while).
  - Defect fix: the `replayed` status check on the asked `over` step now runs before the list/check split. A while plan is made only when the check's own first ask held; before this, it needed only that the check was asked in replay mode and its answer was readable.
- `R/llm/node-tools/replay-draft.ts`:
  - The span plan is asked for on every step, with `nodeOf` possibly absent, so a do-while is planned without a node lookup.
  - New private `whileCheckIds(steps, nodeOf)` finds the step a repeat-over's `over` names when all of these hold:
    - it is the proposed step right before the span, where the assembler requires it;
    - its node is known;
    - its node declares no array output.
    A list is never in it, and with no `nodeOf` it is empty. Such a step gets `excusable: "check"` on its call and `excused: "check"` on its outcome when it does not hold. A part run's `stopsAt` treats it as excused. `verdictOf` adds outcomes excused as `check` to the exempt set, so the verdict passes over it (private `checkExcusedIds`).
  - Headers updated.
- `R/llm/node-tools/dry-run-gate.ts`:
  - Item 4 (~:446, `repeatedStepIds`/`notReached`): confirmed right for a do-while, so that logic is unchanged. `repeatedSpan` in `routing.ts` takes the span from `through`, which works for both shapes. A do-while is now always walked, so it is never "unwalked", and it always gets at least one pass, so the zero-passes case cannot arise.
  - Edited elsewhere: `unchangedLine` and `madeOptional` rebuild the verdict's exempt set, and both now include check-excused outcomes (private `checkExcusedIds`). Without this, a refusal that made another step optional would be judged again with the excused check blocking.
- Tests:
  - `tests/replay-draft-loop.test.ts`: 2 tests in "a repeat over a check" (no while plan when the check did not hold, and the check excused `check` on its call and outcome; a failing list is never excused) and a new describe of 6 do-while tests:
    - 3 passes ending on pass 3's `ended`, not refused;
    - planned without `nodeOf`;
    - `most: 2` stops after 2 passes, not failed and not `loop_bound`;
    - the default of 50 passes;
    - a read failing on pass 1 is a real failure and the loop stops;
    - `ended` from a non-last member is `failed`.
  - `tests/replay-parity.test.ts`: a next-page definition (a click plus an `ended` branch output) is added to the test registry, along with an `ended`-capable fake implementation and host. A new do-while parity test runs `runAutomationStudioGraph` on the assembled Flow and checks that it sends the same 8 calls as the walker (search, three read+next passes, Done).

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq`; `T=src/programs/automation-studio/runtime/llm/node-tools/tests`.

1. Baseline before editing: `npx vitest run` on all 11 `$T/{replay*,dry-run-gate*}.test.ts`. Result: 11 files passed, 124 tests passed.
2. Fail-first, after writing the tests and before the source changes: `npx vitest run $T/replay-draft-loop.test.ts $T/replay-parity.test.ts`. Result: 8 failed, 21 passed. The failures were the while-check test, the 6 do-while tests and the do-while parity test; the parity failure was 4 stored calls against 8 expected. The list-not-excused guard passed, as intended, because it pins existing behaviour.
3. After the source changes, the same two files: 2 files passed, 29 tests passed.
4. All 11 `$T/{replay*,dry-run-gate*}.test.ts`: 11 files passed, 133 tests passed.
5. Neighbours that reach the walker (`run-flow-part`, `run-flow`, `run-flow-in-loop`, `run-flow-rows-in-loop`, `step-place`, `step-place-done-again`, `rerun-check`): 7 files passed, 59 tests passed.
6. Typecheck of my six files only, from a scratch no-emit tsconfig in my scratchpad that extends the package tsconfig (`npx tsc -p <scratch>/s2walker-tsconfig.json`): no output, `exit=0`. It writes nothing; it is not `fluxiq:check` and not a build.

Parity state: the do-while assembly in `R/flow-bootstrap/authoring/draft-routing.ts` and the C5 executor/io-policy changes were not in the tree when I started (`git status` showed only the lead's contract files). They landed while I worked, so the parity test ran against the real assembled Repeat loop and passes. The stored Flow's status is `succeeded` and both sides made the same 8 calls.

## Not verified

- The structure audit and `fluxiq:check` were not run, per the brief. My source files gain no exports. The new helpers are module-private.
- No Lab, browser or provider run.
- The parity test depends on other workers' in-flight `draft-routing.ts`, `node-execution.ts` and `io-policy.ts`. If they change before the lead merges, re-run it.

## Open questions or contradictions found

- The check excuse does not reach two exemption sets outside my files, which rebuild the set from `automationStudioFlowDraftConditionalStepIds` plus withheld ids only:
  - `R/llm/node-tools/step-place.ts` `firstBlocking` (~:194), used by a rerun's put-back;
  - `R/flow-draft/sometimes-present.ts` (~:66).
  Each should also add outcomes with `excused === "check"`. Otherwise, a put-back that meets a while-check whose first ask failed blocks on it, even though the full test excuses it. The cleanest home for this is a shared helper in `R/flow-draft/` (for example beside `automationStudioFlowDraftWithheldStepIds` in `verify-only.ts`, or in `excused.ts`), so that the replay-draft and dry-run-gate copies can call it too. I did not touch those files.
- When a while-check's first ask does not hold, the walker still sends the span once, unplanned and excused `repeat`, as it did before t252. The Flow would run that span zero times. The brief asked only that no loop be planned; skipping the span outright would be a further change.
- `R/flow-draft/routing.ts:112` `automationStudioFlowDraftRoutingReferences` returns `[routing.through, routing.over]`, so `over` is `undefined` for a do-while. That file is not mine; whoever owns it may want `routing.while` there instead.
