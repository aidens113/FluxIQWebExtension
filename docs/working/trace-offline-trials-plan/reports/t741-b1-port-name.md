# t741 b1-port-name report

## Outcome

Done. The plan's port names and a script part's port names now go through one rule, so a plan that names a port `item` is refused when the plan is written. Before, it was accepted and then could not be built.

## What changed and why

All paths below are in Core, under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- New `flow-bootstrap/script-statements/part-port-name.ts` exports `automationStudioFlowScriptPartPortName(name)`. It accepts `/^[a-z][A-Za-z0-9]{0,31}$/u` and rejects `item`, the name a loop's row takes. The barrel `script-statements/index.ts` exports it, and its header comment now mentions it.
- `script-statements/called-parts.ts`: `partOf()` uses the predicate for inputs and outputs, as it did before. The local `PORT_NAME` and `ROW_NAME` are gone. The refusal now reads `never "item", the name a loop's row takes`. The script still reserves `item`.
- `project-agents/supervisor/plan-input.ts`: `ports()` uses the same predicate for both sides, replacing the local `PORT_NAME`. A rejected name is refused with `project.plan_port_name` at the port's path. The doc comment says why.
- `project-agents/supervisor/guidance.ts`: the words for `project.plan_port_name` now end with `, and never \`item\`, the name a loop's row takes.` I changed no other words.

### Tests (written first)

- New `script-statements/tests/part-port-name.test.ts` (14 tests): names the predicate takes and names it refuses.
- New `script-statements/tests/called-parts.test.ts` (2 tests):
  - good names are kept;
  - `item` is refused as an input (`flow.line.4`) and as an output (`flow.line.20`).
- `supervisor/tests/plan-input.test.ts` gains a describe block (7 tests):
  - outputs `["item"]` are refused at `subflows.0.outputs.0` and inputs at `subflows.0.inputs.1`, both with `project.plan_port_name`;
  - a parity test over `item`, `items`, `itemName`, `row` and `total`: the plan accepts a name exactly when `automationStudioFlowScriptCalledParts` accepts it as both an input and an output, and only `item` is refused;
  - the guidance words.

## Commands run and observed results

From `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`:

1. Before the fix: `pnpm exec vitest run` on `plan-input.test.ts`, `part-port-name.test.ts` and `called-parts.test.ts` printed `Test Files 2 failed | 1 passed (3)` and `Tests 17 failed | 30 passed (47)`. The failures were the missing predicate and the missing guidance words, which is the expected red.
2. After the fix: `pnpm exec vitest run` on eight files printed `Test Files 8 passed (8)` and `Tests 88 passed (88)`:

| Test file | Tests |
| --- | --- |
| `supervisor/tests/plan-input.test.ts` | 31 |
| `script-statements/tests/part-port-name.test.ts` | 14 |
| `script-statements/tests/called-parts.test.ts` | 2 |
| `supervisor/tests/guidance.test.ts` | 5 |
| `supervisor/tests/plan-dispatch.test.ts` | 4 |
| `authoring/tests/state-statements.test.ts` | 22 |
| `candidate/tests/refusal-locator-corpus.test.ts` | 6 |
| `plan/tests/issue-feedback-words.test.ts` | 4 |

## Not verified

- No typecheck, structure audit or wider suite was run, per the shared rules. The lead should run the structure audit for the new file and its barrel line.
- No live run or Lab replay of the office case.

## Open questions or contradictions found

- `flow-bootstrap/authoring/script-binding.ts:83` keeps its own copy of the same rule for `$input.<name>` (a Flow input's name, also never `item`). I don't own that file, so I didn't change it. It could use the new predicate later.
- The bootstrap plan reader's own `PORT_NAME` in `flow-bootstrap/plan/parsing.ts` still accepts `item`. That file is b2-sort's. The supervisor's plan now refuses `item` before it reaches that reader.
