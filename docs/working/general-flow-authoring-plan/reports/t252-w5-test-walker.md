# t252-w5-test-walker: report

## Outcome

Partly done. All six brief items are implemented in the t252 Core tree, and nothing is committed. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

All of these pass:
- the new tests and the existing ones in `R/llm/node-tools/tests` and `R/flow-draft/tests`
- `pnpm --filter fluxiq check`
- the structure audit

**The new looping does not run in a live build yet.** The walker can only tell a list span from a check span, and which members take the row, if it knows each step's node definition. Nothing in node-tools has the node registry, so I added an optional `nodeOf` lookup to:
- the replay
- the gate (`AutomationStudioFlowDraftDryRunGateInput.nodeOf`)
- the part run

Nothing passes it in yet, because the three callers are outside my files: `R/llm/evidence-loop.ts:386`, `R/service.ts:1621` and `R/llm/node-tools/run-flow.ts:94`. Until they pass it, every repeat runs once on the explored row and is excused, exactly as before t252. See open question 1.

## What changed and why

**New: `R/llm/node-tools/replay-span.ts`.** This holds the span logic.

- **Codes.** `core.replay.loop_bound` and `core.replay.unresolved_binding`.
- **Node lookup.** `AutomationStudioFlowDraftReplayNode` is `{inputs:[{id}], outputs:[{id,type}]}`. It has the same shape as the catalog entry, so `automationStudioLlmNodeDescriptions(...).definition` can be passed in directly. `AutomationStudioFlowDraftReplayNodeOf` is the lookup function's type.
- **`automationStudioFlowDraftReplayLoopBound()`.** Reads the default `maxIterations` from For Each's own definition (100).
- **`automationStudioFlowDraftReplaySpanPlan`.** Uses the same rule as `draft-routing.ts`:
  - **List span:** the `over` step's node has an array output. Its rows are `outputs[port]` from that step's answer in this test. The answer must be readable, sent in replay mode, have status `replayed`, and every row must be a JSON object.
  - **While span:** the node has no array output, and the check is the step immediately before the span.
  - **No plan** in any other case, so the span is sent once and excused. That covers: no `nodeOf`, an unknown node, the list step was verified or failed, no `outputs`, or rows that are not records.
  - **Members** are the draft's span (first step through `through`), limited to the steps this walk runs.
- **`automationStudioFlowDraftReplayPassCall(step, mode, row?)`.**
  - It resolves `$state` leaves only when `ranWith.parameters` holds a binding. It uses `resolveAutomationNodeParameterValues` against `{item: row}` on a list pass and against `{}` otherwise, so an `$input` takes its test value.
  - `item` is sent only when the member's node declares an `item` input.
  - A call that carries an `item` has `produced` deleted.
  - Missing paths give `{unresolved}`, and nothing is sent.
  - A step with no bindings, outside a pass, is sent byte-identical to before.
- **`automationStudioFlowDraftReplaySpanRun`.**
  - **List span:** every member runs once per row, in order, with call ids `<callId>.pass.<n>`. If there are more rows than the bound, no member call is sent and every member fails `loop_bound`.
  - **While span:** the body runs, then the check is asked again (`<checkCallId>.pass.<n+1>`), until the check stops replaying. Past the bound, every member fails `loop_bound`.
  - **Member mode** is lane A's `automationStudioFlowDraftStepReplayMode(step, lastingActs)` on every pass, so a lasting act is a verify call per row.
  - **Outcomes:** each member gets `passes: [{pass, status, resultCode?}]`. Its status is the first non-passing pass's, otherwise `replayed`. Its resultCode is that pass's, otherwise the first pass's. An empty list gives `passes: []` with status `replayed`.
  - **Observations** carry `pass` and `of`.
  - **Evidence** is the first non-passing pass's page.
  - **`stops`** is a hook used by the part run.

**`R/llm/node-tools/replay-draft.ts`.**
- New optional inputs:
  - `nodeOf` on both the replay and `automationStudioFlowDraftReplaySteps`.
  - `stopsAt(step, excused)`: when present, a step that does not pass ends the walk there. The part run uses it.
  - `answered(step, result)`: called with every readable answer.
- The result gains `stoppedAt`.
- At each step, the walker first tries to plan a span. If one is planned, it runs the span, adds the members to an `expanded` set and skips past them.
- Straight steps go through `PassCall`. An unresolved binding fails the step with `core.replay.unresolved_binding` and sends nothing.
- Reanchor and `leftUndone` treat a step as excused only when it is conditional and was not expanded.
- `withheldBy` is passed into a span, but passes never set it.
- The observation type now comes from replay-span.

**`R/flow-draft/dry-run.ts`.**
- New: `AutomationStudioFlowDraftReplayPass`, and the outcome field `passes?`.
- New: `automationStudioFlowDraftReplayPassWords`, which puts `passes: n` and `pass: <first non-passing>` on the feedback line.
- **Verdict rule:** an outcome that carries `passes` is never excused as conditional unless it has `withheldBy`. This one rule removes expanded members from the conditional set for both the replay and the gate's `madeOptional`.
- `DRY_RUN_INSTRUCTION` gains three sentences:
  - a repeated step runs once for each item, with that item and its bound values; a lasting act is checked per item; `passes`, `pass`, and `passes 0`
  - `loop_bound` and `unresolved_binding`
  - when items are unknown, the span runs once and is excused
- Lane A's verify-only words and end view are untouched.

**`R/llm/node-tools/dry-run-gate.ts`.**
- The gate passes `nodeOf` to the replay.
- `AutomationStudioFlowDraftTestObservation` is now the replay-span observation type, which adds optional `pass` and `of`.
- The full_run_required feedback is built by one helper, `refuseUnrunnable`.
- **`not_reached`:** after a replay, a written step whose outcome has `passes: []` and status `replayed` is refused `llm_evidence_loop.full_run_required` with the word `not_reached`.
  - It applies both when the verdict is `ok` and when it passes through `madeOptional`.
  - The step outcomes are still written onto the steps, and `targetMoved` still fires.
  - `cleanSignature` is not set, and nothing is reported as `observed`.
  - A recorded member of a zero-row span is not refused.

**`R/llm/node-tools/run-flow-part.ts`.** This now runs on the shared walker with `reanchor: false` and no reset.
- `stopsAt` is `!excused || unrunnable(step)`, so a carried step still stops the run with `not_run_in_this_build`.
- `answered` drives `effectApplied`, the state digests and `last`.
- The ran lines gain `passes` and `pass`.
- A span expands only when its list step is inside the range.
- A pass that does not pass stops the run there.
- New optional input `nodeOf`.
- One small difference: `before` is now taken from the first readable answer. Before, it came only from the first step.

**Tests.** I wrote them first. On the first run, 6 tests failed, and the 2 new files failed to import `replay-span.ts`.
- New `R/llm/node-tools/tests/replay-draft-loop.test.ts`, 15 tests:
  - passes per row in order
  - `item` only to row-taking nodes; bindings resolved; no `produced` with a row
  - a failing pass refuses, with that pass's code and page
  - a `remembered` pass passes
  - a lasting act is a verify per row
  - zero rows
  - over the bound
  - four "no rows known" cases, all unchanged behaviour
  - straight-step `$input`, and a byte-identical call when the step holds no binding
  - straight-step unresolved binding
  - a while span, and a while span past the bound
- New `R/llm/node-tools/tests/dry-run-gate-loop.test.ts`, 3 tests: a written step with zero rows gives `not_reached`; the same step passes with rows; a recorded step with zero rows is not refused.
- `run-flow-part.test.ts`, 2 new tests: the span expands when its list step is in range and runs once when it is not; a pass that does not pass stops the run.
- `dry-run.test.ts`, 2 new tests: the verdict does not excuse an outcome with passes (except `withheldBy`); feedback words and instruction.

## Commands run and observed results

Every vitest command was run from `packages/fluxiq`.

- **Before implementing** (`npx vitest run R/llm/node-tools/tests/replay-draft-loop.test.ts R/llm/node-tools/tests/dry-run-gate-loop.test.ts R/llm/node-tools/tests/run-flow-part.test.ts R/flow-draft/tests/dry-run.test.ts`): `Test Files 4 failed (4)`, `Tests 6 failed | 29 passed (35)`.
- **After implementing:** 4 failed, all in my own "no rows known" test. It expected a step holding an unresolvable `$row` binding to be sent. I corrected the test to expect nothing sent; the step fails `unresolved_binding`, excused.
- **`npx vitest run R/llm/node-tools/tests R/flow-draft/tests`:** `Test Files 38 passed (38)`, `Tests 328 passed (328)`.
- **`pnpm --filter fluxiq check`:**
  - First run: 1 error, mine, a `readonly` tuple in the new test, which I fixed.
  - Re-run: no tsc output; the build-cache line says "stored in the shared store". It reported no errors in the other workers' files either.
- **`node scripts/structure-audit.mjs`** (Core root): `structure-audit: passed (230 warning(s), 349 baselined)`.
  - Advisories on my files: `dry-run.ts` has 13 exported values (advisory 8), and the existing `dry-run-gate.test.ts` is 552 lines.
  - Nothing on `replay-span.ts`, which is 306 lines.
- **Extra consumer check** (`npx vitest run R/llm/node-tools/tests R/flow-draft/tests R/llm/evidence-loop/tests R/llm/tests`): `Test Files 88 passed (88)`, `Tests 907 passed (907)`.

## Not verified

- **Any live or wired behaviour.** `nodeOf` is not passed by the loop, the service or `core.run_flow`, so a real build still runs each span once (open question 1).
- **Parity with `runAutomationStudioGraph`.** That is w7's test. For lists I followed For Each's semantics: rows over the limit fail before any pass, and the row goes only to nodes that declare `item`. For while spans I used the same bound of 100; the executor's real bound for a check loop is the run's step budget.
- **The domain against these calls.** Neither w3's `outputs.records` nor its `item` handling has been run against this walker.
- **The full Core suite**, and any directory beyond the four above. I did not run the result-verification and step-log directories, because another worker is editing them.
- **Assignability of the catalog entry to `AutomationStudioFlowDraftReplayNode`** is checked by reading the types, not by a typed call site.

## Open questions or contradictions found

1. **Wiring `nodeOf` (needed before the feature is live).** It is a one-line change at each of three call sites:
   - `R/llm/loop-configuration.ts` and `R/llm/evidence-loop.ts:386` pass `nodeOf` to the gate, from a new loop input or from the build's `automationStudioLlmNodeDescriptions(...).definition`.
   - `R/service.ts:1621`, the stopped-round test, passes it to the gate.
   - `R/llm/node-tools/run-flow.ts:94` passes it to `runAutomationStudioFlowDraftPart`.

   `step-place.ts` (the rerun put-back) uses the walker without it, so it stays unchanged.
2. **A while span whose body has a verify-mode (lasting) member runs exactly one pass.** The test never does the act that would make the check stop holding, so running further would always hit `loop_bound`. This is my decision; D6 does not cover it.
3. **Zero passes:** I followed the rule as written. A member with no passes gets status `replayed` and `passes: []`, and its feedback line says `replayed` with `passes: 0`. Only a written member is refused, as `not_reached`.
4. **A gap in `not_reached`.** A written member of a span the test could not expand (no `nodeOf`, no `outputs`, the list step verified or failed) is sent once and excused, as today. With a `$row` binding it fails `unresolved_binding`, but it is excused, so a written step can pass untested this way. Refusing it as `not_reached` would close the gap, but w1's `not_reached` sentence ("the list its repeat goes over had no items in the test") would then be the wrong explanation.
5. **A Flow refused `not_reached` does not set `refused`**, so completing the same Flow again replays it again, without the two-replay cap. Each completion is a model decision, so this is bounded, but it is not capped.
6. **Rows that are not JSON objects** (for example a list of strings) leave the span unexpanded. That is because the pass contract's `item` is a `JsonObject` (`replay.ts`), whereas For Each would hand over any value.
7. **Brief item 6 says "plus earlier outputs".** Only `{item: row}` (spans) and `{}` (straight steps) are resolved against, because `$step` is P5 and refused at parse. P5 has to add the earlier steps' output values to the resolution state.
