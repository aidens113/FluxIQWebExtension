# t195-w43: pass and row in the step log

## Outcome

Done. Every call of a repeat's pass now writes `pass` and, for a list span, `of` into its step folder's `meta.json`. It also writes `row`, the screened label of the pass's row, when the span's list read answered `readRows.rows` in this test. The row's values, `item` and `outputs` are never written. Calls outside a pass write none of the three fields.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, `R` = `packages/fluxiq/src/programs/automation-studio/runtime`:

- `R/llm/step-log/scope.ts`: added the type `AutomationStudioLlmStepLogPass` (`{ pass; of?; row? }`), a `pass?` field on the context, and the method `automationStudioLlmStepLogScope.pass(pass, fn, env)`. The method is gated on the step log like `run`/`within`, and only calls made inside `fn` carry the pass. The module comment cites `run-musp474o-e0ed7432`.
- `R/llm/step-log/tool-step.ts`: `meta.json` spreads `passFields(scope?.pass)`, which adds `pass`, plus `of` and `row` only when they are known. The header comment cites the run.
- `R/llm/node-tools/replay-span.ts`:
  - The list plan gains `labels?`: the over-step answer's `readRows.rows` labels, in order (pass n = row n, as `span-rows.ts` reads them).
  - A new `sendPass` wraps every pass call in the scope: member calls, plus a while-span's re-asked check, which goes in as pass `count+1`.
  - Added a header section citing the run.
- New test `R/llm/node-tools/tests/replay-span-step-log.test.ts`, which runs the real walker with `automationStudioLlmStepLogTool` and `vi.stubEnv` for the directory.
- New case in `R/llm/step-log/tests/tool-step.test.ts`.

**Change from the brief: no value import from `read-rows.ts`.** A value import of `R/result-verification/build-test/read-rows.ts` (and also of `read-account/alone-rows.ts`) closes a module cycle back into the llm barrel. With it in place, `R/tests/service-authoring/tests/confirm-requests-build.test.ts` failed 4 tests with `flow_bootstrap.pre_provider_validation_failed`. Taking the import out made them pass (4/4). What I did instead:

- **The key:** a local `READ_ROWS_KEY: typeof AUTOMATION_STUDIO_BUILD_TEST_READ_ROWS_KEY = "readRows"`, with a type-only import through the `result-verification` barrel. If the key changes in `read-rows.ts`, the typecheck fails.
- **Screening:** each label (the first cell of a `rows` entry) goes through `screenAutomationStudioLlmEvidence({ [column]: label }, [])` from the `llm/harness` barrel. This is the same check `alone-rows.ts` applies to a label, and a refused label is written `(withheld)`. No denied keys are known in the walker, so only credential-shaped labels are withheld (see Open questions).

## Commands run and observed results

Commands ran from the Core tree root.

- **Failing first:** `npx vitest run --exclude ".tmp/**" <replay-span-step-log.test.ts> <tool-step.test.ts>` before the change gave 4 failed, 9 passed.
  - The 3 walker cases failed with `expected { step: 3, kind: 'test', …(14) } to match object { pass: 1, of: 2, row: 'Amara Osei' }` (and the same for the other two).
  - The tool-step case failed with `TypeError: automationStudioLlmStepLogScope.pass is not a function`.
  - The "non-pass call writes none" case passed before the change, as expected: it is a guard.
- **After the change:** the same two files gave 13 passed.
- **Brief dirs:** `npx vitest run --exclude ".tmp/**" .../llm/node-tools .../llm/step-log .../tests/service-authoring`
  - With the value import of `read-rows.ts`: 4 failed in `confirm-requests-build.test.ts`.
  - With the `alone-rows.ts` import: the same 4 failed.
  - Final: `Test Files 31 passed (31)`, `Tests 242 passed (242)`. The final run came after switching to barrel imports.
- **Core check:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w43 core check" pnpm --filter fluxiq check` exited 0. The final run printed "not stamped, because inputs changed while it ran": other workers are editing the same tree.
- **Audit:** `node scripts/structure-audit.mjs`
  - First run: FAIL `[imports]`, because replay-span reached past barrels (3 imports).
  - After the barrel imports: `structure-audit: passed (240 warning(s), 349 baselined)`, exit 0.

## Not verified

- No live run. I did not check that a real Lab run's `0050`-style folders now carry `row`.
- The while-span path has no new test. Its passes write `pass` and no `of`, by design.
- The tree has other workers' uncommitted edits (phases.ts, reserve-judging.ts, flow-draft tests, and others). My results are against that combined tree.

## Open questions or contradictions found

- **Denied columns:** the judge screens labels with the domain's `deniedEvidenceKeys`, and the walker has none. A label from a denied column would therefore be written to `meta.json`. That same label is already written verbatim in the list step's own `result.json` (see `0049-test-core.run_node/result.json` in the run, `readRows.rows`), so this adds no new page text. Passing denied keys in would need `nodeOf`-style plumbing from `service.ts`, which I do not own.
- **No `of` on a while span:** the pass count is not known when the pass is written, so a while span's passes record `pass` only.
- **Row alignment:** a `rows` entry whose label is not a string is skipped, as in `alone-rows.ts`. After a skip, label n would no longer line up with row n. The judge's `span-rows.ts` has the same behaviour.
