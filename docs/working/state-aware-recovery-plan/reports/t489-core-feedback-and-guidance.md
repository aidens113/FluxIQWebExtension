# t489 Core half: trial feedback, validation naming, guidance, row identity, wording

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t489/!FluxIQ` (branch `task/t489-record-columns-one-truth`). Nothing committed.
All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. Goals 1 to 6 are done, each with a test written first and seen to fail.
- Goal 5's page naming was dropped by the supervisor (decision c), because the domain half now says which page a read read.
- The continuation is also done: decisions a, b and d, and the addition about the submit boundary.
  - A domain refusal at submit may carry `issues`, and the model is told the field and the valid names in Core's sentence.
  - The flow-bootstrap/candidate and flow-bootstrap/authoring tests now run, and pass.
- One follow-up needs a file I don't own: `binding.ts` (Open question 1).

## What changed and why

1. **F3: trial feedback carries the node's own issues.**
   - New `service/candidate-trial/step-issues.ts` (exported from the barrel) reads a failed step's `outputs.error.issues`.
     - Each entry is either a code string or `{code, field?, valid?: string[]}`.
     - Only identifiers pass: a dotted code, and a field or name of `[A-Za-z0-9_.:-]`, up to 120 characters. Anything else is dropped whole.
   - `feedback.ts:steps` adds `issues` to a failed step (one whose state did not already hold).
   - `happened.ts` now takes the code as well as the category:
     - A `record_output.*` code says the step's recordOutput was refused as written, and points at `issues`.
     - An `executor.node.*` code keeps "The step names a node that cannot run."
     - Any other `graph_validation_or_unknown_node` failure says the step's node refused the step as written.
2. **F4: submit-time refusals name the field.**
   - New `automationStudioFlowBootstrapRecordOutputIssueMessage(code, value)` in `flow-bootstrap/plan/record-output-contract.ts`. It covers `process_unknown_field`, `process_excluded_field` and `process_where_column_dropped`.
     - It names the offending field ids, taken from the value being checked.
     - It lists the ids the schema stores, or the columns kept.
   - `validation.ts` uses that message.
   - `issue-feedback.ts` adds the three codes to `AUTHORED_CODES`, so the message reaches the model.
   - Only field ids the model wrote are quoted, never a value a condition compares.
3. **D2: narrowing guidance (`flow-bootstrap/plan/flow-script-format.ts`).**
   - The narrowing sentence now says:
     - A site control may narrow only when its words keep exactly what the instruction asks: no narrower range, and no category, option or value the instruction does not name.
     - Otherwise, narrow in the read's own condition, `extractList.where`.
   - The narrowing example moved from a shop's orders to a help desk's tickets (`desk.test`), titled "Example, narrowing with a control whose words are exactly the instruction's:".
   - The legacy format and completion-schema digests were updated in `tests/flow-script-format.test.ts`, with a comment saying the change was deliberate.
4. **D1: row identity (`result-verification/request-rows/`).**
   - New `row-values.ts`: `automationStudioRequestRowValuesAgree(text, cells)` compares currency amounts and decimal numbers written after a mention against the row's cells of the same kind.
     - Whole numbers are never compared.
     - Neither are bounds, meaning a value after words like "under", "at least" or "than".
   - In `checked-rows.ts`, a prefix mention of a stored row is dropped when the values written after it disagree with that row's cells. The window runs up to the next row mention or the end of the sentence.
5. **Wording (`activity/wording/issue-words.ts`).**
   - Each handle code now has true words. Only a handle the page never showed or never issued "wasn't seen on the page"; stale and other-page codes say "from another page than the one it runs on"; and so on per code.
   - The hint codes `web.handle.expected.*` and `web.handle.target_kind.*` say nothing of their own.
   - One old expectation changed: `unknown_field` now reads "reads a column the list it reads doesn't have".
6. **F5: repeat guard (`llm/repeat-guard/candidate-feedback.ts`).**
   - A refused-submission repeat names the earlier call ("in call <callId>").
   - A refusal coded `candidate.unchanged_submission` or `candidate.unchanged_after_no`:
     - says its refusal lists no issues, and that what failed is under `lastTrial` (or `judged`);
     - says to change the step that feedback names, and to retest only if that feedback says trying again may pass.
   - Any other refusal without issues says to read that call's answer.
7. **Continuation: a domain refusal at submit names the field.** Files: `llm/harness-options/plan-parameter-resolution.ts`, `flow-bootstrap/plan/contracts.ts`, `flow-bootstrap/plan/issue-feedback.ts`.
   - **Accepted shape:** `{status: "refused", issueCodes: string[], issues?: Array<{code: string, field?: string, valid?: string[]}>}`.
   - **`issueCodes`** is unchanged and still required:
     - each code matches `/^[a-z0-9_.:-]{1,100}$/i`;
     - duplicates are removed, and at most 16 are kept.
   - **`issues`** is optional:
     - If present but not an array, the whole answer is refused `bootstrap.parameter_resolution_invalid`.
     - Only the first 16 entries are read.
     - An entry with any key other than `code`, `field` and `valid` is dropped.
     - `code` must match the `issueCodes` pattern.
     - `field` must match `/^[A-Za-z0-9_.:-]{1,200}$/`; otherwise it is dropped.
     - `valid` must be an array of names matching that same pattern. Names that don't match are dropped, duplicates are removed, and at most 64 are kept.
     - An entry left with neither `field` nor `valid` is dropped.
   - **Which issue gets a detail:**
     - A detail attaches to the first refused code equal to its `code`, or to a code whose reason (the part before `:`) equals it.
     - A detail that no code takes becomes an issue of its own.
   - **What the model sees:**
     - The issue carries `detail: {field?, valid?}`. This is a new optional field on `AutomationStudioFlowBootstrapIssue`, typed `AutomationStudioFlowBootstrapIssueDetail`.
     - Its message is Core's sentence from `automationStudioFlowBootstrapIssueDetailSentence(code, detail)`: "The domain that runs this step refused it (<code>). It names "<field>", which the step cannot use there. The names it can use there are "<a>", "<b>": write one of those instead."
     - Codes without a detail keep "A node's parameters were not accepted by the domain that runs it."
     - `issue-feedback.ts` screens the detail again, and gives the model `message` (rebuilt from the detail, never the issue's own message), `field` and `valid`.
   - The resolver imports the sentence from the plan barrel. Importing it from the flow-bootstrap barrel closed an import cycle, which the audit refused.

Tests added or changed (each beside its subject):
- `service/candidate-trial/tests/feedback.test.ts`
- `flow-bootstrap/plan/tests/validation.test.ts`
- `flow-bootstrap/plan/tests/issue-feedback.test.ts`
- `flow-bootstrap/plan/tests/flow-script-format.test.ts`
- `result-verification/request-rows/tests/checked-rows.test.ts`
- `activity/wording/tests/issue-words.test.ts`
- `llm/repeat-guard/tests/candidate-feedback.test.ts`
- `llm/harness-options/tests/plan-parameter-resolution.test.ts`. Its four new cases:
  - Core's sentence with the field and the valid names;
  - non-identifier names dropped;
  - a malformed issue dropped while a well-formed one is kept;
  - an `issues` that is not a list refused.

`llm/deepseek/tests/system-prompt-pins.json` was not changed: none of the changed text is pinned there (I grepped for each phrase and got 0 hits).

## Commands run and observed results

Fail-first runs, from `packages/fluxiq`:

| Goal | Test file | Result |
| --- | --- | --- |
| F3 | `feedback.test.ts` | 4 failed, 25 passed |
| F4 | `validation` + `issue-feedback` | 5 failed, 35 passed |
| D2 | `flow-script-format` | 3 failed, 66 passed |
| D1 | `checked-rows` | 1 failed, 16 passed |
| Wording | `issue-words` | 12 failed, 12 passed |
| F5 | `candidate-feedback` | 2 failed, 7 passed |
| Continuation | `plan-parameter-resolution` + `issue-feedback` | 2 failed, 50 passed |
| Malformed-issue case | `plan-parameter-resolution` | see below |

The malformed-issue case was written after the fix. To check it, I restored HEAD's resolver, saw 2 failed and 34 passed, then put my version back.

Final runs:
- `npx vitest run <R>/service/candidate-trial/tests <R>/flow-bootstrap/plan/tests <R>/flow-bootstrap/candidate <R>/flow-bootstrap/authoring <R>/result-verification/request-rows/tests <R>/activity/wording/tests <R>/llm/repeat-guard/tests <R>/llm/deepseek/tests <R>/llm/harness-options/tests` printed "Test Files 119 passed (119)", "Tests 1241 passed (1241)".
- `npx tsc --noEmit -p .` exited 0.
- `pnpm structure:check` (from the Core root) printed "structure-audit: passed (338 warning(s), 1159 baselined)" and "2 baseline entries can be lowered".
  - An intermediate run failed `import-cycles`, caused by a value import from the flow-bootstrap barrel.
  - A direct file import then failed `imports`.
  - Importing from the plan barrel fixed both.

## Not verified

- No full suites, no Lab runs and no provider runs, as the brief says.
- No tests outside the directories listed above.
- The domain against Core, end to end. At the time of writing:
  - the domain's run-time dispatch sends bare string issues;
  - its submit refusal sends encoded codes, not `issues`;
  - no test runs the web domain's resolver through Core's.

## Open questions or contradictions found

1. **`binding.ts` needs one line, and it is not in my files.**
   - `AutomationStudioPlanNodeResolution` in `llm/harness-options/binding.ts` still declares `{ status: "refused"; issueCodes: readonly string[] }`.
   - Core reads the answer as `unknown`, so Core works today.
   - A domain resolver typed against Core's binding that returns a literal with `issues` would hit TypeScript's excess-property check.
   - Suggested line: `| { status: "refused"; issueCodes: readonly string[]; issues?: readonly { code: string; field?: string; valid?: readonly string[] }[] }`.
   - Please give me `binding.ts`, or add the line yourself.
2. **The domain should move its encoded submit codes into `issues`.** For example `{code: "web.handle.unknown_field", field: "<name>", valid: ["<key>", ...]}`, keeping its codes in `issueCodes`. Core does not decode `web.handle.unknown_field.name:` (that is web vocabulary).
3. **The domain's run-time dispatch should send structured entries.** Its `outputs.error.issues` should be `{code: "record_output.column_not_read", field, valid}` entries, which `step-issues.ts` reads, so that trial feedback names the field.
4. **Other shop examples remain.** The first example in the format ("Rename a member" on `shop.test/members`) is still on a shop domain. I left it, because the brief's site rule reads as applying to the narrowing guidance.
5. **2 lowerable baseline entries.** I did not identify them, and did not run `pnpm structure:baseline`, because the shared baseline file is not mine.
