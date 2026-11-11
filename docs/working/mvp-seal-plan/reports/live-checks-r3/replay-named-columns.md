# Replay declares the person's named columns

## Outcome
Partial. The replay code takes and uses `namedColumns` and is tested. It does not take effect live yet: no caller above `draft.ts` and `span.ts` supplies it. Those callers are outside my paths (see Open questions).

## What changed and why
Core: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src/runtime/llm/node-tools/replay/`
- `replay.ts`: `automationStudioNodeReplayStepCall`, `automationStudioNodeReplayVerifyCall` and the private `assembledRecordOutput` take `namedColumns?: readonly string[]` after `partOf`. It is passed straight to `automationStudioFlowBootstrapAssembledRecordOutput`, the same function assembly uses (`normalise.ts:121`). The list is passed as the reader returned it, so its `cutShort` marker survives. Header and doc comment updated.
- `span.ts`: `automationStudioFlowDraftReplayPassCall` takes `namedColumns` after `partOf` and forwards it. `AutomationStudioFlowDraftReplaySpanRunInput` gains `namedColumns`, used at both pass-call sites.
- `draft.ts`: `AutomationStudioFlowDraftReplayInput` gains `namedColumns`. It is forwarded to the steps input (`Pick` extended), to the span run, and to the plain pass call.
- New test `replay/tests/replay-named-columns.test.ts` (3 tests).
- With nothing named (absent or `[]`), the output is unchanged.

## Commands run and observed results
(in `packages/fluxiq` unless noted)
- `npx vitest run src/runtime/llm/node-tools/replay` -> 3 passed (new file).
- Revert check: I changed the `namedColumns` line in `replay.ts` back to `undefined` and reran. The result was 1 failed, 2 passed. The failing test is the one that declares exactly `name, price, rating`; the "nothing named" tests passed either way, as intended. I then restored the file; `git diff --stat` shows it with the change again.
- The tests:
  - A request "Give me a table with columns name, price and rating." reads as `["name","price","rating"]`.
  - Step, verify and span pass calls (replay and verify) all send a record output equal to the saved Flow's assembly output. Its schema fields are exactly `name, price, rating`, and `link` is absent.
  - Nothing named (undefined or `[]`) equals the previous output and the saved Flow's output without an instruction, with `link` kept.
- `npx vitest run src/runtime/llm/node-tools` -> 32 files, 386 tests passed, exit 0.
- `pnpm --filter fluxiq check` -> exit 0.
- `pnpm structure:check` (Core root) -> "structure-audit: passed (529 warning(s), 969 baselined)", exit 0.

## Not verified
- No live, Lab, paid, or build run. Nothing confirms a live replayed read now omits `link`.
- Nothing outside `node-tools` was run.

## Open questions or contradictions found
- **The live path needs wiring outside my paths.** Today nothing above `draft.ts` and `span.ts` carries the instruction's columns, so a live replay still declares `link`. `partOf` has no live source either (scoped builds only). The chain:
  - `runtime/llm/node-tools/dry-run-gate.ts:250,392` (add `namedColumns` beside `partOf`);
  - `runtime/llm/node-tools/run/flow.ts:93,123` and `run/flow-part.ts:88,130` (the `core.run_flow` replay in this run);
  - `runtime/llm/loop-configuration.ts:483`;
  - `runtime/llm/evidence-loop.ts:215,367`;
  - above these, wherever the loop's input is built. The value comes from `automationStudioFlowBootstrapInstructionColumns(instructionText)`; `harness-options/bootstrap-completion.ts` already has `instructionText`.
- Add `namedColumns` beside `partOf` at each of those points, computed once from the instruction.
- The test file is in `replay/tests/`, but the existing replay tests are in `node-tools/tests/replay*.test.ts`. I followed the brief ("tests beside each").
