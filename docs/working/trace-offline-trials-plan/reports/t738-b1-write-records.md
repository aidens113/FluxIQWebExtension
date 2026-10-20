# t738-b1-write-records: report

## Outcome

Done. Write Records now takes its rows in a `records` parameter. Each row value can be a `$step.<label>.<output>` binding, and a script can write it. The Records input port is no longer required. A `records:` line matches that parameter by id before the `records -> recordOutput` synonym is tried. When no schema is written, the record output's columns come from the row keys. A generic example (an account settings page) is now in the script-format guidance. The shapes from 0211 and 0226-0231 now assemble.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQ/packages/fluxiq/src/programs/automation-studio/`.

- `nodes/data/write-records.ts`
  - The `records` input is now `required: false`.
  - New parameter `records`, labelled "Rows": an array, state-bindable, with no default, and a generic example `[{name: $step.name.value, date: $step.date.value}]`.
  - Where the rows come from: the parameter when it is written, otherwise the input. The parameter is checked first because a built-in node's `context.inputs` also carries every bare run-state value (`collectNodeInputs`). An earlier listing's bare `records` would otherwise replace the written rows.
  - New clear failures, each with no effect:
    - `record_output.no_records`: no rows were given at all.
    - `record_output.invalid_records`: the rows are not a list of objects.
    - `record_output.unresolved_value`: a row still holds a binding. The failure names the fields, never the values or paths.
  - A binding that is missing at run time already fails earlier, in the executor (`attempt.ts` missingPaths). A test shows that `resolveAutomationNodeParameterValues` reports it.
- `runtime/flow-bootstrap/authoring/script-binding.ts`
  - This is where script bindings are resolved during assembly (`assemble.ts:592` calls it for every line).
  - A value written as a JSON list or object is now searched at any depth (up to 16). Each string that is a `$row`, `$input` or `$step` binding is read exactly as a whole line would be, and refused the same way.
  - When JSON parsing fails, bare keys and bare `$step`/`$row` tokens are quoted and the text is parsed again. So `[{a: $step.x.value}]` also works.
  - Not searched: a parameter with `allowStateBinding: false` (the record output), and a `{"$state": ...}` object that is already written. Draft steps reach assembly as JSON holding `$step.<draft id>` paths, so that object must be left alone.
  - A value with no binding returns `undefined`, so it is read exactly as before.
- `runtime/flow-bootstrap/authoring/assembled-record-output.ts`
  - New `writtenRowKeys`: a parameter whose id is also an input port id and that holds a list of objects is "rows given as written". Its keys are used as the columns when nothing else supplies them.
  - When no record output is declared and such rows exist, a record output is derived. The dataset id and label come from the step's words.
- `runtime/flow-bootstrap/authoring/record-output.ts`: doc comment only. The columns derivation already existed and now receives the row keys.
- `runtime/flow-bootstrap/authoring/matching.ts`: comment only. Matching by id already comes before synonyms, so the new parameter wins with no code change. "rows" matches by its label.
- `runtime/flow-bootstrap/plan/flow-script-format.ts`
  - One statement and one example added at the end of `AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT`, which is shown only in candidate mode.
  - The example reads an account settings page's plan name, renewal date and price one by one, then saves them as one row.
  - It went there rather than into the loop format, because `loop-format.test.ts` (which I do not own) pins the loop format's example list. The legacy format and its completion schema digests are unchanged.
  - The header docblock records why.
- Tests:
  - `nodes/data/tests/write-records.test.ts`: the input is no longer required. Added a block for rows given by the parameter: bound values resolved and written as one record, written rows chosen over a bare run-state `records`, a missing binding reported, an unresolved binding failing with field names, and the no-rows and invalid-rows failures.
  - New `runtime/flow-bootstrap/authoring/tests/written-rows.test.ts`:
    - JSON rows assemble with no `required_input_unconnected`, as `$node.sN.value` bindings, with the schema derived from the row keys.
    - The bare form `records: [{a: $step.plan.value, b: $step.price.value}]` gives fields a and b.
    - `recordOutput.datasetId` with no schema takes its columns from the row keys.
    - 0226's shape (a whole record output with datasetId, schema, writeMode and process, plus a records line) keeps the record output exactly as written.
    - A row naming no earlier label is refused as `flow_script.invalid_binding` at `nodes.4.parameters.records`, placed by `automationStudioFlowBootstrapIssuePlace` at the saving step's own line, 17.
    - With no rows, the refusal is still `record_schema.not_derivable`.
    - Unit tests for `matchAuthoringParameter` and for the nested binding reader, including the guard that keeps a written state binding.
  - `plan/tests/flow-script-format.test.ts`: added the new example to "finds every example of the four constants". This is the only pinned list I changed, and only because I added the example. Also added a describe block checking that the guidance stays out of the legacy format and schema, and that the example builds three reads and one bound row with columns plan, renews and price. The existing every-example checks (parse and assemble, Lab-word ban, plan validator and saved Flow validator) now cover it as well.

## Commands run and observed results

All runs from `C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQ/packages/fluxiq` with `npx vitest run <paths> --pool=forks --poolOptions.forks.singleFork`.

- Before the fix, `written-rows.test.ts`: 7 failed, 5 passed. The rows stayed as literal `"$step.plan.value"` strings.
- `runtime/flow-bootstrap/authoring/tests` (all of them), `nodes/data/tests`, `plan/tests/flow-script-format.test.ts` and `plan/tests/loop-format.test.ts`:
  - "Test Files 28 passed (28), Tests 371 passed (371)".
- The contract tests and the other consumers:
  - First run: 5 files passed: issue-feedback (20), validation (27), record-output-contract (28), catalog (14), extraction-vocabulary (5).
  - 8 files failed to load with "Failed to load url .../runtime/executor/executed-locations.ts ... Does the file exist?". That was another worker in the middle of moving the file into `executor/executed-locations/`; it is not my file.
  - Rerun once the import resolved: system-prompt (38), handle-only (6), answerability check (9), reachability check (14), record-output-processing-feedback (1) and executor node-execution (44) gave "Test Files 6 passed (6), Tests 112 passed (112)".
  - flow-change trial and repair-directive-do-only: "Test Files 2 passed (2), Tests 36 passed (36)".
- All three contract tests listed in `scripts/task/contract/list.mjs` pass: system-prompt, extraction-vocabulary and issue-feedback. No pin changed.
- `node scripts/structure-audit.mjs` (from the Core root): "1 violation(s) across 1 rule(s)". The one violation is `[statement-packing]` in `runtime/flow-bootstrap/site-reset/ledger.ts` line 220, which another worker owns. My only entries are advisory file-lines warnings on `flow-script-format.ts` (632 lines, was 603) and `flow-script-format.test.ts` (588 lines, was 560). Both were already past 400.

## Not verified

- No tsc or typecheck, as the brief instructed. One type alias to check: `ParsedRecordOutput` in write-records.ts, `Extract<ReturnType<typeof parseAutomationStudioRecordOutput>, {ok: true}>["output"]`.
- No live or Lab run, and no full executor run of a Flow that ends in write-records with bound rows. Run-time resolution is covered by the resolver plus node test, not by a graph run.
- A JSON plan (`json-plan.ts`, not a script) with `$step...` strings inside `records` is not resolved. Only script lines are. A JSON plan has to write `{"$state": ...}` objects.
- The downstream extension's catalog rendering of the new parameter.

## Open questions or contradictions found

- `validateRequiredInputConnections` (plan/validation.ts, another worker's file) no longer refuses a write-records with nothing connected. A write-records with neither rows nor a connected input now passes validation. Authoring still refuses it with `record_schema.not_derivable` when no columns can be found, and at run time it fails `record_output.no_records`. A plan check of "rows or a connected input" would belong in validation.ts.
- When both the parameter and a wired Records input are present, the parameter wins. The brief said "uses it when its input port is unconnected". The node cannot see edges, and its inputs carry bare run-state keys, so "written rows first" is the safe reading of that intent.
- The debug note's table shows 0211 with bare bindings. The recorded calls (0212, 0214) actually quote them inside JSON. Both forms are handled now.
- Line endings: the working-copy files are CRLF and git stores LF. My Python edits briefly wrote LF, and I converted every file I touched back to CRLF.
