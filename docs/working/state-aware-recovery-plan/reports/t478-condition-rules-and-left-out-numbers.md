# t478 report: condition rules always offered, and no yes over a left-out row whose number was kept

Worker report for brief t478 (Core-paired). Nothing committed.

## Outcome

Done. Both fixes are in place and the named checks pass.

- **F2:** the `where` rules now come from one Core text, which is always offered with `core.submit_candidate`. The domain's detect description uses the same text.
- **F1:** Core flags a left-out row when its stated number lies within the range its own text condition kept. A yes over such a row is refused, and the repair is told the rows, their numbers and the change to make.

I replayed the real judge summaries from run-mv5yaapw (steps 0055 and 0070) through the new check. Both flag Jonas Weber (states 5, kept range 5 to 23), and both turn the judges' yes into `does_not_answer`.

## Cause, verified

- The step logs agree with the debug.
- Judges 0055 and 0070 carry `reads[].conditions[0]`, which is `<col> matches ["([5-9]|[1-9][0-9]+) mutual friend"]`. Its `leftOutOnlyByThis` includes `Jonas Weber — <col>: Aisha Khan and 4 other mutual friends`. The listing's record set holds 23, 11 and 5, with `processing.passes[].node` equal to the read's node.
- `read-number.ts` (`NAMED_AND_OTHERS`) reads that value as 5.
- `look-withdrawal.ts` keeps `core.submit_candidate`, and its input schema carries `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT` (`candidate/authoring-loop.ts:73`). So that format is a place no withdrawal reaches, and `look-withdrawal.ts` did not need changing.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t478/!FluxIQ`):

- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/flow-script-format.ts`
  - New exported constant `AUTOMATION_STUDIO_FLOW_CONDITION_RULES`. It covers presence; the number bounds and what number they read (first number, or the total of a combined count); "a quantity is always compared with a bound, never a text test"; the text tests; and `not`.
  - `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT` gains one line after the listing-condition sentence: "A where condition, on a listing or in `recordOutput.process`, names a column by field and must hold for a row to be kept." followed by the rules.
  - The constant lives here, not in a new file, because `plan/` is at its 25-file directory limit. This file already exports the other script-format pieces.
  - The text is generic, with no scenario wording. Its examples are $49 and 3.7 out of 5.
- `.../flow-bootstrap/plan/tests/condition-rules.test.ts` (new)
  - Every key of Core's condition vocabulary (`AUTOMATION_STUDIO_RECORD_CONDITION_BOUNDS` and `_TEXTS`, plus equals, `is:` and `not: true`) must be named in the rules.
  - The quantity sentence is pinned.
  - The loop format must carry the rules whole.
- `.../result-verification/request-rows/left-out-stating-a-kept-number.ts` (new): `automationStudioResultLeftOutStatingAKeptNumber(summary)`. Per `summary.reads[]` and per condition, it works like this:
  - **Which conditions:** the wording must hold a text relation (matches, contains, startsWith, endsWith, or `equals` with text), and its operand must write a digit or `\d`. A condition with a numeric `equals` is skipped, because it keeps a set of numbers, not a range.
  - **Kept numbers:**
    - the tested column's values in record sets whose every pass is this read's node;
    - where a set has no passes, sets that hold none of the left-out labels;
    - plus the `(read "…" on a row it kept)` value when the wording says one.
  - **Left-out numbers:** from `leftOutObservations` when one witness is sent per row, otherwise from `label — column: value`.
  - **Flagged:** a left-out row whose number lies between the lowest and highest kept number.
  - **Not flagged:** rows that are in the stored result anyway, and reads marked `unfiltered`.
  - Numbers are read with `readAutomationStudioRecordNumber` from `@fluxiq/contracts`.
- `.../request-rows/types.ts`: new type `AutomationStudioRequestRowsKeptNumberLeftOut` (`nodeId`, `condition`, `low`, `high`, `rows`, `numbers`).
- `.../request-rows/index.ts`: exports the new module, and its barrel comment names it.
- `.../result-verification/verdict.ts`
  - A yes is refused when either the existing unaccounted check or the new check finds rows. The reason for the unaccounted-only case is byte-identical to the old sentence. The new reason is "...judged to answer the request over rows a text condition alone left out that state a number the same condition kept on another row, so it is not taken as an answer."
  - `repair.checked` gets one Core line per condition, with rows written `label — column: value (states N)`. That shape keeps `checked-rows-named.ts` and `rerun-rows.ts` able to read the rows back.
  - A `no` also carries the finding, so the build gets it whatever the judge says.
- `.../result-verification/repair-directive.ts`
  - New finding code `result.left_out_stating_a_kept_number` and a new input `leftOutKeptNumber`.
  - New finding text: where it is, the condition, the kept range, and each row with its number.
  - New fix line: "A text test reads characters, not the number a value states; write the threshold the request asks for as a bound on that column (atLeast, atMost, greaterThan or lessThan)…".
- `.../request-rows/tests/left-out-stating-a-kept-number.test.ts` (new, 8 tests). The fixture is a generic shared-documents site with "N editors" and "Ravi Menon and 3 others". The tests cover:
  - the flag itself;
  - the observation path;
  - the seen value standing in for an unstored column;
  - a text test without digits not being flagged;
  - a bound, and a numeric `equals`, not being flagged;
  - a record set collected by another read not being used;
  - a row in the result, and an unfiltered read, not being flagged;
  - a number outside the range not being flagged.
- `.../result-verification/tests/verdict.test.ts`: new describe block, 3 tests, on a generic forum site with "N replies" and "Dana Ruiz and 4 others". It covers:
  - a yes that names the row is still refused (code, reason, finding, fix, checked);
  - a no carries the finding;
  - a yes is taken when only out-of-range rows were left out.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t478/!FluxIQWebExtension`):

- `domain/src/runtime/llm-evidence/tools.ts`
  - The detect description's own Presence, Number and Text vocabulary is replaced by `AUTOMATION_STUDIO_FLOW_CONDITION_RULES`, imported from `fluxiq/automation-studio`. The description is now 1,993 characters, within the 2,000 limit.
  - A t478 comment paragraph explains why.
  - To stay at or under 800 lines (the comment had pushed the file to 809), I removed two stale comment passages: the "between them these two bounds are what a model ever learns about where" clause, which is now false, and the "Room came from wording" list. The file is 799 lines.
- `domain/src/runtime/llm-evidence/tests/tools.test.ts`: asserts that the detect description includes `AUTOMATION_STUDIO_FLOW_CONDITION_RULES` whole.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/flow-bootstrap/plan` (in `packages/fluxiq`): "Test Files 70 passed (70) / Tests 689 passed (689)".
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/llm/deepseek src/programs/automation-studio/runtime/llm/decision-handlers`: "Test Files 39 passed (39) / Tests 306 passed (306)". This run includes `system-prompt.test.ts`. The pins were not changed, because the script format is not in any system prompt; it rides on the tool's input schema.
- A temporary replay test fed the real 0055 and 0070 `resultSummary`, extracted from the step logs, into the new check and into the verdict with a yes. Both returned the Jonas flag (low 5, high 23, numbers [5]) and `does_not_answer`. I deleted the temporary test file afterwards.
- `pnpm run check` (fluxiq typecheck): exit 0.
- Core `pnpm structure:check`: "structure-audit: passed (336 warning(s), 1159 baselined)". It also printed "2 baseline entries can be lowered". I did not run `structure:baseline`, because `.structure-baseline.json` is not mine to change.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (in the Core worktree): done. The domain imports Core's compiled dist, so this build was needed.
- `DOMAIN_TEST_BUILD_LABEL=t478 node scripts/test-domain.mjs src/runtime/llm-evidence/tests/tools.test.ts`: "# tests 14 # pass 14 # fail 0". I ran it again after the comment trim, with the same result.
- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0 ("core-build: ... current with its source").
- Downstream `pnpm structure:check`: it first failed with "tools.ts: 809 lines exceeds the 800-line limit". After the trim it printed "structure-audit: passed (187 warning(s), 646 baselined)".
- No paid run.

## Not verified

- **Live behaviour.** I did not check whether the model now writes `atLeast` with looks withdrawn; that needs a paid run.
- **False positives on other runs.** I did not replay F1 against stored summaries from other lanes. A text test with digits that legitimately keeps non-adjacent numbers would be flagged and the yes refused. An example is a name pattern for model numbers 13 and 15 that leaves out 14.
- **Build-test `readRows`.** F1 reads only `summary.reads`. In a build test's `buildTest.steps[].observed.readRows`, the condition is a field key with no relation words, so it is not checked. In this run the trial judges were sent `reads`, so the live trial path is covered.
- **Unstored filter columns.** For such a column, the only kept value is the one `seen` value, so the range is a single number.
- **Full suites and documentation.** I did not run the full Core or domain suites (narrow checks only, per the rule). I updated no architecture documentation in either repository, because none was in my file list.

## Open questions or contradictions found

- **Is in-range too broad?** The brief asks for the in-range rule. It is gated on the condition's operand writing a digit, but the supervisor may prefer a narrower rule that flags only a left-out number equal to a kept number. That would still catch Jonas (5 equals a kept 5) and remove the non-adjacent-set case above.
- **The debug's F3** (a submit-time note `candidate.pattern_compares_number`) was optional and not in the brief, so it is not done.
- **The extract-list catalog line** (`domain/src/output-nodes/extract-list/catalog-text.ts:248`) still carries its own short `where` keyword list. It was not in my file list.
