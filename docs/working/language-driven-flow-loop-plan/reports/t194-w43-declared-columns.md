# t194-w43: every extraction Flow declares the columns the instruction names

## Outcome

Partial. The authoring change is in place and tested in Core: an extraction step with no declared columns now gets the columns the instruction names. It is **inert in the live build until lane B passes the instruction text in.** The only caller of both authoring entry points is `runtime/llm/harness-options/bootstrap-completion.ts`, which this brief does not let me touch. The wiring needed there is described exactly below.

Files owned and edited (all Core, `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`):

- `answerability/instruction-columns.ts` (new): `namedColumns` moved here as `automationStudioFlowBootstrapInstructionColumns`. The body is unchanged.
- `answerability/instruction-ask.ts`: now calls the moved reader. Its constants and the private function were removed.
- `answerability/index.ts`: exports `instruction-columns.ts`, and the barrel comment says why.
- `authoring/instruction-record-columns.ts` (new): `authoringInstructionRecordColumns({named, fieldKeys})` returns `{columns: {id,label}[], unmatched}`.
- `authoring/normalise.ts`: new optional `namedColumns` input. This is where a node's record output is filled or left null.
- `authoring/record-output.ts`: `columns` may now carry `{id,label}`, and the result gains `schemaDerived`.
- `authoring/assemble.ts`, `authoring/json-plan.ts`: forward `namedColumns`.
- `authoring/accept.ts`, `authoring/assemble-draft.ts`: new optional `instructionText`. Each reads the columns once.
- `authoring/index.ts`: comment only.
- `authoring/tests/instruction-record-columns.test.ts` (new): 9 tests.

## What changed and why

- **Where it happens.** In `normaliseAuthoringNodeParameters`, in the loop over parameters whose control is `record-output`. Both the draft path and the reply path go through that loop.
- **Which steps it applies to.** A node counts as an extraction when it has both of these:
  - a declared records path (`metadata.recordsPath`, read with `automationStudioFlowBootstrapDeclaredRecordsPath`, meaning "rows come out of this node");
  - field keys (`columnNames(parameters)`, i.e. `extractList.fields` keys).
- **Matching.** Each named column is compared with the field keys: exact first, then case- and separator-insensitive (`authoringKey`). Each field is used at most once, and the instruction's order is kept. The id is the field key; the label is the person's own spelling.
- **Value null or absent, at least one match.** The normaliser is given `{}` with the matched columns. It produces `{datasetId: <from step description>, schema: {schemaVersion, fields:[{id,label,valueType:"string"}]}, writeMode: "append"}` and drops `recordsPath` (supplied by the node). This is the shape `parseAutomationStudioRecordOutput` accepts; the test checks it with `automationStudioFlowBootstrapRecordOutputIssues`. Every id is a field key, so downstream F34 (`declared-columns.ts`) will narrow on it.
- **Author object without a schema** (for example `{datasetId}`). The schema is derived from the matched columns rather than from every field.
- **Author-declared schema.** Never touched, and no warning is raised.
- **No named columns, no instruction text, a non-extraction node, or no field keys.** Exactly the old behaviour.
- **Unmatched names.** These produce a warning `record_output.named_column_unmatched` at `...parameters.recordOutput`. It names the unmatched columns and what is stored instead: the matched columns, or every field when none matched. It is a warning only; nothing is refused.

## Commands run and observed results

All Vitest runs were made from `!FluxIQ/packages/fluxiq`.

- `npx vitest run src/.../flow-bootstrap/authoring src/.../flow-bootstrap/answerability` -> `Test Files 11 passed (11)`, `Tests 102 passed (102)`.
- **Tests against the old source.** HEAD's `normalise.ts` and `record-output.ts` were swapped in temporarily (current files backed up to scratchpad, then restored), and the new test file was run -> `5 failed | 4 passed (9)`.
  - Failed, as intended: run 12 (draft), run 12 (reply plan, `recordOutput: null`), partial match, no-match warning, author object without schema.
  - Passed on old source: "author-declared schema left alone", "no named columns", "no instruction text", and the matcher unit test. The first three assert that old behaviour is preserved, so by construction they cannot fail on the old source. The matcher file did not exist before.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w43 core check" pnpm check`:
  - First run -> exit 2, `TS2322: Type '"read"' is not assignable to type 'AutomationStudioFlowDraftStepEffect'`. This was in my test; fixed to `"observe"`.
  - Second run -> exit 0, `fluxiq:check` stored.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (211 warning(s), 349 baselined)`, plus `1 baseline entries can be lowered`. I did not determine whether that last line is mine. New advisory warnings: `authoring/` now has 18 source files (warn 15, limit 25), and `assemble.ts` is 501 lines (warn 400, limit 800).
- `npx vitest run src/.../flow-bootstrap` -> `Test Files 51 passed (51)`, `Tests 890 passed (890)`.

## Not verified

- **End-to-end in a live build.** It cannot take effect until lane B passes the instruction text in.
- **Downstream dispatch with the generated record output.** The downstream tree is read-only for me, and no downstream test was run. That F34 narrows on it is inferred from reading `declared-columns.ts` `declaredColumns`, which needs every schema id to be a field-map key; ids here are always field keys.
- **Lab pairing.** Whether the Lab pairs columns using the labels the person wrote, rather than titleised ids, was not checked.
- No Lab run and no model calls.

## Open questions or contradictions found

1. **Lane B wiring is required.** In `runtime/llm/harness-options/bootstrap-completion.ts`:
   - `fromReply` -> `acceptAutomationStudioFlowBootstrapResult({ result, registry, resolution, instructionText })`;
   - `fromDraft` -> `assembleAutomationStudioFlowDraftPlan({ ..., instructionText })`;
   - thread `input.instructionText` into both helpers.

   That is about four lines.
2. **The trace is lane B's.** A successful acceptance's warning issues (`accepted.issues`) are currently dropped by `checkAutomationStudioFlowBootstrapCompletion`; only errors reach a refusal. For the unmatched-column warning to reach the model and the judge, lane B must surface `record_output.named_column_unmatched` in the build's check or trace. Authoring cannot do it: the plan has no notes field, and an extra record-output key would be refused at dispatch.
3. **Contradiction with the run 12 debug.** The brief says run 12's `s8` had `recordOutput: null`. The debug (`run-muq66ff9-cb3767a1.md`, lines 150 and 159) says the model wrote a **4-column** schema. If the debug is right, F34 already covers that case and this change covers the null and absent case.
