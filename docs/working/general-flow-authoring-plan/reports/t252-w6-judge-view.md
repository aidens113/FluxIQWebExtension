# t252-w6-judge-view report

## Outcome

Done. All edits are in FluxIQ Core, t252 tree (`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`). Nothing is committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

1. **Pass lines in the build-test summary (D6).**
   - New `R/result-verification/build-test/pass-lines.ts` (`automationStudioBuildTestPassLines`). It reads the outcome's
     `passes` (`{pass, status, resultCode?}`) and each observation's `pass`, typed locally and loosely, so it compiles
     before w5's types land. Each pass becomes one line `{pass, row?, outcome, observed?}` under its step. A pass's
     outcome word comes from `automationStudioFlowDraftReplayOutcomeWord`, using the step's mode and the pass's own
     status and code. Its observation goes through the step's own observation reader, under the same rule as before:
     nothing is shown for a mutating step that was run again. Observations without a pass number stay in the step's
     `observed`, so steps outside a loop read exactly as before.
   - New `R/result-verification/build-test/span-rows.ts` (`automationStudioBuildTestSpanRows`). For each member of a
     `repeat` span, it takes the row labels from what the judge is already shown of the span's `over` step: its
     `readRows.rows`, which `read-rows.ts` has already screened. Pass n is labelled with rows[n-1]. A label that was
     withheld stays `(withheld)`. When the list names no label for a row (a while span, rows not shown, or a read with
     no `readRows`), that pass carries its number only. No row value is ever read.
   - `summary.ts` now builds `passes` for each step. It records what it shows of each step by id as it goes, so the
     span members can look up their list step's labels. It also adds `buildTest.inputs` once. The report input type
     gains optional `pass` and `of` on observations. The header comment is updated.
   - New `R/result-verification/build-test/test-inputs.ts` (`automationStudioBuildTestInputs`). It builds
     `[{name, test, steps}]` from `automationStudioFlowDraftInputs`. A test value that has a denied key, is shaped like
     a credential, or contains a locator is written `(withheld)` and sets `withheld`. An unusable name is dropped and
     also sets `withheld`. Inputs are only carried when `deniedEvidenceKeys` is declared, the same rule step words follow.
   - `R/result-verification/contracts.ts` gains the new types `AutomationStudioBuildTestPass` and
     `AutomationStudioBuildTestInput`, plus `passes?` on the step and `inputs?` on the account. This file is outside
     the brief's listed `build-test/*`, but the contract types live there; see the open questions.
   - The `build-test/index.ts` barrel exports the three new files.
2. **Judge instruction (`R/llm/diagnosis-instructions.ts`).** The build-test paragraph now says four things:
   - a repeated step runs once for each row of the list it repeats over;
   - `passes` gives each pass's number, row label, outcome and observation;
   - each pass is judged against its own row, not the row the build explored, and a step that did not pass on some
     rows has not done its act for those rows;
   - `buildTest.inputs` are the Flow's parameters at the values this test ran on.

   The header comment is extended. Only a build's test is told this. Because Core's prose changed, the
   `loop_verification_build_test` pin in `R/llm/deepseek/tests/system-prompt-pins.json` had to move. I spliced in
   exactly the new sentence; the diff is one line.
3. **Step log (`R/llm/step-log`).**
   - New `field-names.ts` (`automationStudioLlmStepLogFieldNames`). It is internal and not added to the barrel, like
     `files.ts`.
   - `tool-step.ts` writes a call's top-level `item` in `call.json` as `{fields: [...]}`. Any `item` value becomes
     field names, or `[]` when the value is not a record.
   - It writes an execution result's `outputs` in `meta.json` as `{<port>: {fields: [...]}}`, only when present.
   - `result.json` is unchanged: it never wrote `outputs`.
   - The folder contract in the barrel comment is updated.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/deepseek src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/step-log src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts`
  -> `Test Files 69 passed (69)`, `Tests 635 passed (635)`. Before the pin was moved, 2 tests in `system-prompt.test.ts`
  failed (the byte pin for `loop_verification_build_test`). After the pin was moved, they pass.
- New tests:
  - `build-test/tests/pass-lines.test.ts`: 5 tests. Pass lines carry the label, a withheld label, and each pass's
    outcome and observation. A mutating step's passes carry no observation. A value from a denied column never appears
    anywhere. The request passes the provider pre-flight. A pass with no label carries its number only. Steps outside a
    loop are unchanged.
  - `build-test/tests/test-inputs.test.ts`: 3 tests.
  - 2 new tests in `step-log/tests/tool-step.test.ts`.
  - 1 new test in `llm/tests/diagnosis-channel.test.ts`.
- Downstream consumers of `buildTest`:
  - `npx vitest run .../service/flow-bootstrap-commands/tests/build-judge.test.ts .../tests/refuted-result/tests/repair-replay-chain.test.ts .../tests/service-bootstrap/tests/judged-build.test.ts`
    -> first run: 6 failed. Re-runs: `judged-build.test.ts` alone gave 5 passed; all three gave `Test Files 3 passed`,
    `Tests 15 passed`.
  - I believe the first failure was transient, caused by another worker editing `llm/node-tools` at the same moment. I
    did not capture its message.
- `npx tsc --noEmit -p .` (packages/fluxiq) -> 21 errors, none in my files. All are in w5's area and come from types it
  has not landed yet (`passes`, `pass`/`of`, `nodeOf`, `../replay-span.ts`):
  - `flow-draft/tests/dry-run.test.ts`: 2
  - `llm/node-tools/tests/dry-run-gate-loop.test.ts`: 5
  - `llm/node-tools/tests/replay-draft-loop.test.ts`: 11
  - `llm/node-tools/tests/run-flow-part.test.ts`: 3
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (229 warning(s), 349 baselined).` Three new
  advisories touch my area:
  - `llm/step-log/` has 17 source files (advisory threshold 15); `field-names.ts` added one.
  - `result-verification/contracts.ts` is 562 lines.
  - The existing `live-run-drafts.ts` exports 11 values.

## Not verified

- I have not run against w5's real walker output. My tests use the shapes as briefed. Once w5 lands, a test that feeds
  `automationStudioFlowDraftReplaySteps` output into the summary would confirm the wiring.
- Row label alignment: I assume the list read's `readRows.rows` lists rows in the same order, and the same rows, as the
  `outputs.records` the walker iterates. If the domain filters differently between the two, labels would be off by
  position.
- `pnpm check` and full suites were not run, per the rules.

## Open questions or contradictions found

- **Request pre-flight gap.** `R/llm/harness/request-evidence-check.ts` (`sendableBuildTest`) re-screens only
  `steps[].observed` for denied keys. It does not re-screen `steps[].passes[].observed` or `buildTest.inputs`. The
  locator check and the credential check still cover the whole summary. I am not the owner of that file, so I left it
  alone. The supervisor may want the second line of defence extended to `passes[].observed` and `inputs`.
- **Duplicated span rule.** `span-rows.ts` copies the span-membership rule from `flow-draft/routing.ts`
  (`repeatedSpan`, which is not exported) because I may not touch `flow-draft`. Exporting that helper from `flow-draft`
  later would remove the copy.
- **Files outside the brief's list.** I edited `result-verification/contracts.ts` (the types) and
  `llm/deepseek/tests/system-prompt-pins.json` (the byte pin that has to move when the judge prose changes). Neither is
  in the brief's Owns list. Both changes are minimal, and no other worker owns these files.
- **Shared tree.** I did not stash or reset anything in the shared tree.
