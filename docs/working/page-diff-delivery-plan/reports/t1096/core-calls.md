# t1096 core-calls report

Outcome: Done.

## What changed and why
1. Pre-dispatch parameter check. New `packages/fluxiq/src/runtime/llm/node-tools/parameters/{refusal.ts,index.ts}`, wired in `node-tools/describing-failures.ts` before the domain's implementation is called, and exported from `node-tools/index.ts`. Uses the node's catalog entry (`memory.definition`): a required parameter with no default that is missing, or a key the node does not declare (`target` always allowed; bindings count as given), returns `core.run_node.parameters_refused` (`ok:false`, `effectApplied:false`, nothing sent) naming `missingParameters`, `undeclaredParameters`, `declaredParameters` and the shape (type, description, example) of the needed ones, and the first refusal also carries `describedNodes`. Nodes without a definition are not checked. There is no domain "shorthand" notion in the definition, so none was added.
2. Authoring properties. `evidence-loop-decision.ts`: act/place/add are offered only where `automationStudioLlmToolCallBecomesStep` holds: `core.run_node` or any non-`core.` tool. The draft records every non-core call (`evidence-loop.ts` draftRecord, excluding run_flow and set_result_processing). Core tools (loop_decision, full_page, describe_nodes, result processing) get none. The predicate is module-private (export cap of 15).
3. `core.loop_decision` `result`: defined in `runtime/llm/loop-decision/tool.ts` (not models/**), now takes the completion schema (`offered.ts` passes `input.completionSchema`), so `result` is closed with it. Not touched: models/providers/anthropic strictness itself (this lane did not test strict acceptance).
4. (?i): already honoured. `packages/contracts/src/record-sets/process/condition/pattern.ts` (`readAutomationStudioRecordConditionPattern`) reads a leading `(?i)`, `(?m)`, `(?s)` as the flag; `condition/tests/pattern.test.ts` asserts a `(?i)` pattern matches case-insensitively. No fix. The earlier observation that JS rejects it was wrong about Core. (A `(?i)` inside the pattern is refused with a reason.)
5. Trace of "up to 10 pages" -> `process.limit:10`: not in `runtime/conversations/commands/**`. It is the model's reading of the instruction, guided by `runtime/conversations/instructions/prompt.ts:45-46` ("declaring the requested data conditions, order, limit ..." with `limit` listed as a row key and no word that it counts rows rather than pages). Not edited (another lane).

## Commands and results
- `pnpm exec vitest run src/runtime/llm/node-tools src/runtime/llm/loop-decision src/runtime/llm/evidence-loop/tests/authored-draft.test.ts` -> 40 files, 492 tests passed (after the moves). Earlier broader run (decision-handlers, provider-task, evidence-loop.test.ts, provider-cache-prefix) -> all passed.
- contracts `vitest run src/record-sets/process/condition` -> 4 files, 26 tests passed.
- tsc (`tsc --noEmit` of packages/fluxiq incl. tests) -> only errors are `view-channel/tests/binding.test.ts` lines 88, 93, 94 (another worker's file); none in my files.
- `node scripts/structure-audit.mjs` -> 2 failures, neither mine: `evidence-loop/tests/` has 26 files (25 limit), `view-channel/tests/binding.test.ts` statement packing line 111.
- Tests: `node-tools/parameters/tests/refusal.test.ts` (0029's shape `{list}` for a node declaring required `nextPage`: implementation never called, refusal names `nextPage`), `loop-decision/tests/tool-schema.test.ts` (loop_decision has no act/place/add, result is the completion schema). Updated `node-tools/tests/node-descriptions.test.ts` (an undeclared `selector` is now refused before dispatch) and `evidence-loop/tests/authored-draft.test.ts` (core.describe_nodes no longer gets the properties; file at 800 lines).

## Not verified
- 0029/0063 recordings were not replayed directly; synthetic fixtures only. The real `web.output.dom-next_page` catalog entry was not loaded, so whether its `nextPage` parameter is `shownToModel` (listed) was assumed from the brief.
- Provider strictness of loop_decision with the closed result was not exercised (models/** untouched).
- No full suites run.

## Open questions
- Hidden (`shownToModel:false`) parameters are not in the catalog, so a model naming one is refused as undeclared. Intended, but worth knowing.
