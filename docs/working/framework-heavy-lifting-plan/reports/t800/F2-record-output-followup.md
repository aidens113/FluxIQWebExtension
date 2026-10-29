# F2-record-output-followup (t800, Core K5)

## Outcome
Done for items 1 and 2; item 3 done in the files I own (replay.ts takes a resolver), the callers that hold the supervisor part are outside my ownership (exact edits below).

## What changed and why
Structure (item 1). Three violations had one cause: the authoring directory could not take more files, and a sub-directory under it is a tenth path segment (the cap is 9).
- `part/` moved out to a sibling `flow-bootstrap/record-defaults/` (barrel, `answer.ts`, `process-defaults.ts`, new `process-fields.ts`, `tests/`). Authoring is back to 25 files.
- assemble.ts was at 800 only because of squeezed lines. The edge-wiring block (`wire`, `joins`, `targetPort`, `edge`, ~115 lines) now lives in `flow-bootstrap/script-wiring/` (`wire.ts` exporting `automationStudioFlowScriptWire`, barrel, `tests/`). assemble.ts is 689 lines and the squeezed lines are restored to normal formatting.
- `script-wiring/wire.ts` imports authoring's types through its barrel (the audit refused a deep import).

## Date column kept
Rule (domain-neutral, no word lists): when the schema is declared by authoring (the model wrote no schema) from narrowed columns, every field the written `process.sort` / `process.where` names that the step reads and the columns left out is appended to the schema, so it is stored. `process.columns` still decides what the answer shows. Code: `record-defaults/process-fields.ts` (`authoringProcessFieldIds`), `withProcessFields` in `authoring/record-output.ts`, new `readableFields` input fed from `assembled-record-output.ts` (the extraction's field keys).
- Nothing else changes: a model-written schema, a field the step does not read, no sort/where, or no narrowed columns all give byte-identical output (test asserts the narrowed-only and written-schema cases).
- Limit: detecting "newest / most recent / in the last week" from the request, with no `process.sort` written, would need an English word list in Core. Not done. The model (or the supervisor part) must write the sort/where; this keeps its field stored.
- Storing needs no edit outside my files; the store already keeps every schema field.

## partOf wiring (item 3)
- `llm/node-tools/replay.ts`: `automationStudioNodeReplayStepCall` and `...VerifyCall` take an optional 4th argument `partOf?: AuthoringPartOfStep`, passed to the assembly as `part`. Absent: unchanged.
- Callers found: `llm/harness-options/bootstrap-completion.ts` (lines ~590 `fromReply` -> `acceptAutomationStudioFlowBootstrapResult`, ~637 `assembleAutomationStudioFlowDraftPlan`), `subflow-candidate/scoped-submission.ts:305` (accept), `llm/node-tools/replay-span.ts:351` (calls the replay functions). None holds a plan-part resolver today; bootstrap-completion.ts is in the must-not-touch list and the part source lives in candidate/submission.ts and the supervisor task spec.
- Exact edits for the owners: build one `partOf: (stepId) => AuthoringPartAnswer | undefined` from the task-spec part (`{id, label from the part's quote, columns: answer.columns, rowIdentity once reported}`) in candidate/submission.ts, then (a) pass `partOf` in the two bootstrap-completion.ts calls above (both inputs already accept it), (b) pass the same function into scoped-submission.ts:305, (c) pass it as the 4th argument at replay-span.ts:351. Note replay does not pass `namedColumns` either, so the test and the Flow already differ on instruction columns when the part is absent.

## Commands run and observed results
- `pnpm test src/.../flow-bootstrap/authoring .../record-defaults .../script-wiring .../llm/node-tools` (packages/fluxiq, inside the lock): "Test Files 54 passed (54) / Tests 602 passed (602)", "[vitest-groups] all groups passed: parallel, real-sql". Includes the new date-column test in `authoring/tests/record-output-part-defaults.test.ts`, `record-defaults/tests/process-defaults.test.ts` (2), `script-wiring/tests/wire.test.ts` (1).
- `pnpm check` in packages/fluxiq (tsc): no diagnostics, exit 0 (also on the final re-run after the import fix).
- `pnpm structure:check`: first run had one FAIL (deep import in wire.ts), fixed; re-run printed no FAIL and no violation line, and no authoring directory-files/file-lines failure (only the advisory warnings that existed before).
- I stopped two stale background commands from my own first attempt; they did not run.

## Not verified
Tests were not re-run after the one-line import change in wire.ts (tsc and the structure audit were). No live or model runs. The `caller dirs` test group beyond node-tools was not run because no other caller file was edited.

## Open questions
None blocking. The caller edits above need the lead to assign candidate/submission.ts and bootstrap-completion.ts.
