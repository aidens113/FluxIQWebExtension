# t244-w2 — `core.run_flow`, the partial-run tool (Core)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, branch `task/t244-partial-runs-full-judged-gate`, not committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done, with two placement deviations from the brief (both forced by the structure audit, see below) and one
offering condition added (the tool is offered only where the caller's own tools can act).

## What changed and why

- **`R/llm/node-tools/run-flow-part.ts` (new)** — `runAutomationStudioFlowDraftPart({steps, value, callId, executeTool, signal?})`.
  Validates `{from, to?}` (whole numbers >= 1, no other keys; `to < from` is also `run_flow.input_invalid`),
  `run_flow.nothing_in_flow` when no proposed step, `run_flow.not_a_flow_step` + `flowSteps` (proposed positions)
  when `from`/`to` is not a proposed step's position. Runs proposed steps in range in order: no runnable call ->
  `not_run_in_this_build`, stop, nothing sent; otherwise D1 mode, `automationStudioNodeReplayStepCall`/`VerifyCall`
  sent as `${callId}.${position}` to `automationStudioNodeReplayToolId(step)`, status via
  `automationStudioNodeReplayStatus`, word via `automationStudioFlowDraftReplayOutcomeWord`. Unreadable/throw =
  `failed` (named `{readable:false}` answer, as replay-draft does); rethrow only when the signal is aborted.
  Non-pass of a conditional step continues; any other non-pass stops. No reset, no re-anchor, never writes
  `step.replayed`. Result `ok:true, passed, from, to, steps[{step, actionId, ran, resultCode?}], stoppedAt?,
  last{step, evidence}, instruction`; resultCode `core.run_flow.ran|stopped`; effectApplied = any inner;
  stateDigests = first inner `before`, last inner `after`, when given.
- **`R/llm/node-tools/run-flow.ts` (new)** — `AUTOMATION_STUDIO_LLM_RUN_FLOW_TOOL_ID = "core.run_flow"`,
  `automationStudioLlmRunFlowTool()` (effect mutate, schema `{from: integer>=1, to?: integer>=1}`, required
  `["from"]`, additionalProperties false; description 706 chars, Core's words, no "page"), and
  `automationStudioLlmRunFlowBinding({tools, executeTool, steps, enabled})` -> `{tools, executeTool, offered(tool)}`,
  patterned on `evidence-recall/binding.ts`. One cohesive group in one file (id + tool + binding), like
  `describe-nodes.ts`. The tool is added only when `enabled` (= `drafting && input.dryRun !== false`), the caller's
  tools are a non-empty array of < 32, **include a mutating tool (`effect: "mutate"` or `perCallEffect`)**, and do
  not already hold `core.run_flow`. `offered(core.run_flow)` is true only while a proposed step has `ranWith` and
  `replay`.
- **`R/llm/node-tools/index.ts`** — exports both new files.
- **`R/llm/evidence-loop.ts`** (797 -> 799 lines, cap 800) — builds the binding once; validation, `toolIds`,
  `toolsById`, `mutableTools` and the eligible filter read the bound `tools`; the eligible filter also requires
  `runFlow.offered(tool)`; `runCall` sends the model's call through `runFlow.executeTool` (answers `core.run_flow`
  with the runner over `draftSteps` and `input.executeTool`, passes everything else to `input.executeTool`); the
  `draftRecord` call is skipped for `core.run_flow`. Row, history, repeat guard, epochs, evidence entry and
  `accounting.toolCalls += 1` stay the ordinary path. Dry-run gate, rerun placement and the opening look still use
  `input.executeTool` directly.
- **`R/activity/wording/core-tool.ts`** — `Running steps 3 to 5 of the Flow` / `Running step 4 of the Flow` /
  `Running the Flow from step 3` / `Running part of the Flow` (unreadable input).
- Tests: `R/llm/node-tools/tests/run-flow-part.test.ts` (9), `run-flow.test.ts` (6),
  `run-flow-in-loop.test.ts` (2), one new `it` in `R/activity/wording/tests/wording.test.ts`.

### Deviations

1. **Loop test placement.** Brief: one new loop test under `R/llm/tests/`. That folder is at 25 files; the audit
   failed `[directory-files] ... llm/tests/: 26 source files exceeds the 25-file limit`. `R/llm/evidence-loop/tests/`
   is also at 25. Moved to `R/llm/node-tools/tests/run-flow-in-loop.test.ts` (header says why).
2. **Offered only where the caller's tools can act.** With the brief's literal wiring (bound `tools` feeding
   `mutableTools` and validation), adding a mutate tool to observe-only loops broke 6 existing tests:
   `evidence-loop.test.ts` x2 ("requires a successful mutation before repeating a protected observation",
   "offers an implicit one-shot initial observation again when nothing can mutate"),
   `repair-exploration-tools.test.ts` ("keeps the free first look ... when nothing offered can mutate"),
   `harness-options/tests/registry.test.ts` ("drops a repeat policy the loop would reject when nothing offered can
   mutate"), `evidence-loop/tests/cost-purse.test.ts` x2. Verified each passes with HEAD's `evidence-loop.ts`.
   Fix: the binding adds the tool only when a caller tool can mutate, so "nothing can mutate" loops are unchanged;
   all six pass again.

## Commands run and observed results

Failing first (before any implementation), in `packages/fluxiq`:
`npx vitest run .../node-tools/tests/run-flow-part.test.ts .../node-tools/tests/run-flow.test.ts .../llm/tests/evidence-loop-run-flow.test.ts .../activity/wording/tests/wording.test.ts`
-> `Test Files 3 failed | 1 passed (4)`, `Tests 16 failed | 13 passed (29)`
(`runAutomationStudioFlowDraftPart is not a function`, `automationStudioLlmRunFlowBinding is not a function`,
loop test `expected { ok: false, …(4) } to match object { ok: true }`, wording `expected {...} to match object { kind: 'tool', …(3) }`).
Then the wording `it` alone failed the same way after the file was read and edited.

After implementation:
- Touched test files (final paths): `npx vitest run .../run-flow-part.test.ts .../run-flow.test.ts .../run-flow-in-loop.test.ts .../wording.test.ts` -> `Test Files 4 passed (4)`, `Tests 30 passed (30)`.
- `npx vitest run src/programs/automation-studio/runtime/llm` -> `Test Files 1 failed | 125 passed (126)`, `Tests 2 failed | 1137 passed (1139)`.
  The 2 failures are `tests/evidence-loop-seeded-draft.test.ts` ("shows the model the seed...", "lets an amendment
  edit a step the loop never took"); they fail identically with HEAD's `evidence-loop.ts` restored (checked:
  `Tests 2 failed | 56 passed (58)` over the five affected files), so they come from the concurrent
  dry-run-gate / flow-draft work (seeded carried steps without `ranWith`), not from this change.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/activity`
  -> `Test Files 118 passed (118)`, `Tests 1658 passed (1658)`.
- `node scripts/structure-audit.mjs` (Core root) -> first run 2 violations (llm/tests 26 files; `failure-as-empty`
  in run-flow-part.ts `call()` returning undefined), both fixed; final -> `structure-audit: passed (220 warning(s), 349 baselined)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t244 w2 check" pnpm --filter fluxiq check` (Core root),
  run after the final edit -> `tsc --noEmit` printed no errors; build-cache line `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store"`.
  No type errors anywhere, including the other worker's files at that moment.

## Not verified

- No live/Lab run; no downstream (web domain) behaviour: whether the web host answers `{replay:"step"|"verify"}`
  calls mid-build the way it does in the dry run was not exercised.
- Provider-side: the tool schema was not sent to DeepSeek; only `automationStudioLlmEvidenceValidTools` accepted it.
- The re-author path (extend build seeded by `draft-from-flow.ts`): carried steps have no `ranWith`/`replay`, so the
  tool is offered there only once the build has a proposed step that ran in this build; not tested end to end.
- Full Core vitest run not run (per the twice-a-day rule).

## Open questions or contradictions found

- **Chat wording of the inner calls.** Inner calls go out as `<callId>.<position>` with `replay:"step"`;
  `R/activity/wording/tool-call.ts` (not owned) words only `dryrun.*` calls as verifying, so each inner step reads as
  an ordinary exploring action (e.g. "Clicking “Add”") under the outer "Running steps 3 to 5 of the Flow". A
  `run_flow`-aware prefix there would be needed to label them as part of the run.
- Brief said "replace the input.tools uses ... mutableTools"; done, but only safe together with deviation 2.
- `to < from` is refused as `run_flow.input_invalid` (with `expected: "to at or after from"`); the brief did not name a code for it.
