# Lane C r3 fix B: look withdrawal keeps the candidate finishing tools

## Outcome

Done.

## What changed and why

All paths under `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/`.

- `loop-budget.ts`: `CANDIDATE_FINISHING_TOOL_IDS` is now exported (one keyword). Wrap-up behaviour unchanged.
- `decision-handlers/look-withdrawal.ts`: `observeOnly` now also returns false for any tool in `CANDIDATE_FINISHING_TOOL_IDS`, so `offer` keeps `core.submit_candidate` / `core.test_candidate` while looks are withdrawn and `refuses` never refuses them. Imports the set from `../loop-budget.ts` (stays inside `llm/`; no import from `flow-bootstrap/candidate/`). Header comment cites run `run-mv0pa79q-ef91811b` steps 0019/0021 and the prompt-cache cost. `core.submit_candidate`'s declared `observe` effect is untouched.
- New test `decision-handlers/tests/look-withdrawal-finishing-tools.test.ts` (3 tests): with looks withdrawn, `offer` keeps submit and trial and drops another observe tool while keeping a mutate tool; `refuses` is false for submit and trial and true for another look; after the attempt epoch moves everything is offered again.

## Commands run and observed results

- `pnpm.cmd exec vitest run .../decision-handlers/tests/look-withdrawal-finishing-tools.test.ts .../llm/tests/loop-budget.test.ts` (from `packages/fluxiq`) -> 2 files passed, 24 tests passed.
- `pnpm.cmd exec vitest run .../decision-handlers/tests/state-digest-cost.test.ts` (existing test that exercises withdrawal) -> 7 passed.
- `pnpm.cmd run check` (package typecheck) -> tsc printed no errors; build-cache line reported the step stored (exit 0).
- `node scripts/build-cache/cli.mjs structure-audit:check` (Core root) -> first run after the export: `structure-audit: passed (330 warning(s), 1159 baselined)`. After the look-withdrawal edit, one run reported "the command failed with exit code 1" while waiting on another process's concurrent run of the same step (another worker is editing `authoring-loop.ts`, `progress.ts` and tests in this tree); an immediate rerun reported `structure-audit: passed (330 warning(s), 1159 baselined)`.

## Not verified

- No live run; whether the build now submits while looks are withdrawn in a real lane C run is unproven.
- The one failed audit run's cause was not inspected (output was the concurrent run's); the rerun on the current tree passed.

## Open questions or contradictions found

- The tree has uncommitted edits by another worker (`flow-bootstrap/candidate/authoring-loop.ts` and its test, `conversations/commands/progress.ts` and `candidate-endings.test.ts`); I did not touch them.
