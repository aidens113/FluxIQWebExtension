# t515a: judge exclusion quotes (worker A report)

Brief: t515 worker A (judge-exclusion-quotes). Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t515/!FluxIQ`, branch `task/t515-judge-exclusion-quotes`. No commits.

## Outcome

**Partial (updated after the continuation).** All four goals are now built, wired and tested. One test outside my files fails because its fixture now hits the new rule as designed.

- **Wired:** `verify.ts` passes `wording` to the verdict and the agreement, and the re-ask closure takes the call number. This is done in the "Continuation" section below.
- **One failing test, not mine to edit:** `result-verification/build-test/tests/judge.test.ts` ("yes, then no, is unknown carrying the no's reading..."). The fixture's no advises "excludes only accessory items", under a request about paper towels that never mentions accessories.
  - Core now marks that advice as an unstated exclusion and re-asks the call. The test expects the advice unmarked and 2 calls; it gets the marked advice and 3 calls.
  - This is the intended goal-2 behaviour. Suggested fix: change `NO.changed` at `build-test/tests/judge.test.ts:340` to advice with no exclusion cue, for example "Narrow the name condition so it keeps the earbuds sold with a charging case."
  - The other option is to update the expectation to the marked advice and `calls: 3`.

The first round's account follows. The "Continuation" section supersedes its "Not verified" and "Open questions" items 1 and 3.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

### Goal 1: a yes quotes the request's excluding words

New `result-verification/request-rows/request-wording.ts`:
- `automationStudioRequestWording(instructions, summary)` returns the request read for a judge's words:
  - `says(text)`: the text's words run word for word in the request.
  - `ownWords(text)`: words that carry meaning, less two groups. One is the generic list words (row, result, page, condition and so on). The other is the words the request searched by.
  - `has(word)`.
- The words it searched by are the words of request phrases that every row a read kept names.
- It returns `undefined` when the request says nothing (a run verified with `instructions: []`).

New `request-rows/unquoted-rows.ts`:
- `automationStudioResultLeftOutRowsUnquoted(summary, reply, wording)` covers every row that a condition alone left out of the result. That means any condition and any column, processing conditions included.
- Each such row must be named (the existing `row-naming.ts` rule) in a sentence of the reply. That same sentence must quote, in double, curly or single quotes, words that:
  - appear in the request word for word; and
  - include at least one word of their own (not only the search words or generic list words).
- Rows that fail this are returned per condition.

`result-verification/verdict.ts` (the item-3 file, named below):
- New optional `wording` on `AutomationStudioResultVerdictInput`.
- With `wording`, a yes with unquoted rows is not taken. It becomes `does_not_answer` in the same way the existing unaccounted-rows refusal does: the refusal reason says "without quoting", and `repair.checked` gets one Core line per condition naming the rows.
- Rows the named-rows check already reported are not repeated.
- `refusedYesReason` now joins any of the three causes.

`agreement.ts` `said()`: a yes refused for missing quotes is described as such in a split's reason.

### Goal 2: a split's no that adds an unstated exclusion

New `request-rows/unstated-exclusions.ts`:
- `automationStudioRequestUnstatedExclusions(advice, wording)` finds the advice's exclusions:
  - the words after "exclude", "filter out", "leave out", "rule out" or "weed out", or after a negated test ("not contains", "does not include"), up to the end of the clause, at most 10 words;
  - the words before a passive "is/are/be excluded / left out / filtered out".
- Negated cues are skipped ("do not exclude", "should not be left out").
- "remove" and "drop" are never cues, because advice says them of conditions as often as of rows.
- An exclusion is unstated when it has words of its own and none of them is the request's.

`agreement.ts`:
- New optional `wording` on the agreement input.
- **Marking.** On a split (`model_disagreed`), if the no's advice adds an unstated exclusion, `unconfirmedReading.advice` is labelled the way t501 labels readings: `Judge call N (Core's check: this advice adds an exclusion the request never states, "<exclusion>", ... so do not add it unless the request's words say so): <advice unchanged>`. The builder receives this through `build-test/judge.ts` as before, with no change to that file.
- **Re-ask.** `automationStudioResultVerificationReaskContradicted` re-asks such a no once (the t503 pattern):
  - Its `ask` callback now also receives the call number: `ask(recheck, call)`.
  - Words sent with the re-ask: the request excludes only what its words state, and search words exclude nothing.
  - The re-asked answer takes that call's place under the same agreement rule. `verdicts` gains a third entry and `calls` becomes 3.
  - If the re-asked call repeats its advice, the mark adds "asked once more with this named, it advised the same".
- The existing t503 path now passes `marked.call` to `ask`.
- Double-no refutations (`bothReadings`) are not marked. The brief scoped goal 2 to a split.

### Goal 3: a runtime yes with `patchNeeded: true`

Where it became `reportedVerdict passed`:
1. `verdict.ts` mapped any `answersRequest: yes` to `answers`, ignoring `patchNeeded`.
2. `agreement.ts` (runtime single-yes path, old line 85) returned that single yes unchanged as the run's verification. Its status became `confirmed`.
3. The Lab then reads `run.resultVerification`: `!FluxIQWebExtension/packages/test-runner/src/flow-lane/lane-observation.ts:191-200` (`reportedVerdict`). `confirmed` gives `passed`, `unverified` gives `unverified`.

Fix, all in Core:
- `verdict.ts` gives such a yes the code `AUTOMATION_STUDIO_RESULT_VERDICT_CODES.answersWithChangeAdvised` (`core.result.answers_with_change_advised`). Its verdict stays `answers`.
- `agreement.ts`: a runtime single yes with that code is recorded as unsure, basis `model_unconfirmed`, with the same code.
  - It carries no failure and no repair, and keeps `answeredReading`.
  - Status is `unverified`, the chat card label is "not confirmed", and the Lab reportedVerdict becomes `unverified`.
  - Reason: "...the same answer said the Flow needs a change, so it is not taken as a clean pass..."
- A build test's two yeses are untouched. The cause-10 rule that a yes's advice is never a directive still holds.

### Goal 4: the instruction sentence

`llm/diagnosis-instructions.ts`:
- I added one abstract sentence after the `leftOutNamingTheItem` sentence. It holds every left-out-only row (reads, and `processing.conditions`) to the request's own words: name the row in a sentence that quotes, in double quotes, the request's excluding words. It adds that search or navigation words exclude nothing, and that a yes leaving such a row without a quote is not taken.
- The sentence is 583 characters, with no scenario words, plus a header-comment paragraph.
- `llm/deepseek/tests/system-prompt-pins.json`: `loop_verification` and `loop_verification_build_test` are updated with the same insertion (a 2-line diff).

### Supporting changes

- `request-rows/words.ts` now owns the empty-word list. It was moved from `request-phrases.ts` and is exported as `automationStudioRequestRowWordCarries`. `request-phrases.ts` uses it, and its behaviour is unchanged.
- `request-rows/types.ts`: added `AutomationStudioRequestRowsUnquoted`.
- `request-rows/index.ts`: added the barrel exports and a header note.

### Tests (generic garden-tools catalogue; no scenario words)

- New `request-rows/tests/request-words-fixture.ts`: the request states one exclusion, a read keeps 3 rows, and two conditions each leave out 1 row.
- New `request-rows/tests/unquoted-rows.test.ts`: 8 tests.
- New `request-rows/tests/unstated-exclusions.test.ts`: 6 tests.
- Appended to `result-verification/tests/verdict.test.ts`: the "held to the request's own words (t515)" block, 4 tests.
- Appended to `result-verification/tests/agreement.test.ts`: the "needs a change (t515)" block, 4 tests.
- Appended to `result-verification/tests/agreement-both-readings.test.ts`: the "unstated exclusion (t515)" block, 5 tests.

The appended blocks first ran as three separate files. The structure audit then failed, because `result-verification/tests/` reached 28 source files against a limit of 25. So I merged them into the existing files for their subjects, and the folder is back at 25.

## Commands run and observed results

All run from the Core tree.

1. **Fail-first.** I wrote the new tests before the `verdict.ts`/`agreement.ts` changes and ran them from `packages/fluxiq` with `npx vitest run <5 new test files>`.
   - Result: `Test Files 3 failed | 2 passed (5)`, `Tests 6 failed | 21 passed (27)`.
   - All six verdict and agreement tests failed. For example, the first "marks the no's advice" test got "expected 'Add a condition to the read that excl…' to match /^Judge call 1 \(Core's check…/", and the "asks…once more" test got "expected "spy" to be called 1 times, but got 0 times".
   - The two request-rows files passed on the first run, because their modules were written before them. They are not fail-first.
2. **After the implementation**, the same 5 files: `Test Files 5 passed (5)`, `Tests 27 passed (27)`.
3. **Brief scope, final state (after the merge):** `npx vitest run src/.../runtime/result-verification src/.../runtime/service/candidate-trial src/.../runtime/llm/deepseek src/.../runtime/llm/tests/diagnosis-channel.test.ts`
   - Result: `Test Files 89 passed (89)`, `Tests 878 passed (878)`. This includes worker B's in-progress changes in the same tree.
4. **Core typecheck:** `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`. No output, exit 0.
5. **Structure audit:** `node scripts/structure-audit.mjs` at the Core root.
   - First run: `FAIL [directory-files] .../result-verification/tests/: 28 source files exceeds the 25-file limit`. I fixed this with the merge described above.
   - Final run: `structure-audit: passed (342 warning(s), 1159 baselined).`, exit 0.

## Not verified

- **Goals 1 and 2 end to end through `verifyAutomationStudioRunResult`.** They are unwired; see the next section. No test exercises verify.ts with `wording`.
- **The mechanical limits of the quote check:**
  - A quote counts for every row named in the same sentence. One valid quote beside several rows covers all of them.
  - Core cannot tell whether the quoted words really exclude that row.
  - A request phrase that every kept row names is treated as a search term. A judge that quotes only a qualifier every kept row's label shares is therefore refused.
- **Judge reply size.** Every left-out-only row must now be named. The diagnosis fields are capped at 500 characters each, but the reply `summary` is also read. With many left-out rows (for example 4 sponsored rows plus 1), a judge may run short of room. Not measured.
- **Unstated-exclusion detection.** It was calibrated against the evidence run's 0021/0027/0033 advice texts, read from `lab-runs/2026-10-13/run-mv6v2hx5-f448e662/steps`. Other phrasings may be missed, such as "is not an accessory" or "keep only X".
- No Lab or provider runs, no full suites, no commits.

## Open questions or contradictions found

1. **The wiring needs `verify.ts` (worker B's file).** The supervisor or B should make three edits:
   - In `askOnce`, pass `wording: automationStudioRequestWording(request.instructions, request.summary)` to `automationStudioResultVerdict({...})`. Import it from `./request-rows/index.ts`.
   - In `verifyAutomationStudioRunResult`, add `wording: automationStudioRequestWording(request.instructions, request.summary)` to `input`.
   - Change the re-ask closure to `ask: (recheck, call) => askCheck({ ...request, summary: { ...request.summary, recheck } }, provider, call, interventions, true)`.
   - The third edit is required whenever the second is made. The current closure reads `settled.contradictedUnsure!.call`, which is undefined on an exclusion re-ask and would throw.
   - After wiring, add a `verify.test.ts` case: a stubbed provider returns a no with unstated advice and then a yes, and the test expects three calls.
2. **Brief versus code ownership.** Goal 1 names `agreement.ts`, but the yes is refused in `verdict.ts`, where the existing unaccounted-rows refusal lives. `verdict.ts` is the item-3 file, so I took it under that item.
3. **Contract docs (unowned).** `result-verification/contracts.ts` describes `contradictedUnsure` and `verdicts` length 3 only for the t503 re-ask. A 3-call verification can now also come from an exclusion re-ask, which leaves no `contradictedUnsure`. The doc comment there may want a line.

## Continuation: wiring through verify.ts

The coordinator handed me `result-verification/verify.ts` and `tests/verify.test.ts` after worker B finished. B's ask-again changes (`askAgainAfter` and its header) are kept unchanged.

### What changed

- **`verify.ts`:**
  - Imports `automationStudioRequestWording` from `./request-rows/index.ts`.
  - `askOnce` passes `wording: automationStudioRequestWording(request.instructions, request.summary)` to `automationStudioResultVerdict`.
  - `verifyAutomationStudioRunResult` adds the same `wording` to the agreement `input`.
  - The re-ask closure is now `(recheck, call) => askCheck(..., call, interventions, true)`, so both the t503 contradicted-unsure re-ask and the t515 exclusion re-ask ask the call the agreement names.
- **`verdict.ts`, the Core line for unquoted rows:**
  - **Problem.** Once wired, `build-test/tests/judge-rows.test.ts` ("from a yes Core did not take") failed. My line said `the condition "X" ... : rows`, and `request-rows/checked-rows-named.ts` parses that shape into `checkedRows`. Those are the rows the request asks for, and a repair's rerun is measured against them (`rerun-rows.ts`).
  - **Why that is wrong.** Unquoted rows are only rows the yes did not justify. Core does not claim they are wanted.
  - **Fix.** The line now reads: `The check answered yes without quoting, beside this row, words of the request that exclude it; it was left out by condition "X" alone (Read r) -- <rows joined by " | ">. A row the request's own words do not exclude is one it asks for.`
  - **Test.** The verdict test now also asserts that `automationStudioResultCheckedRowsNamed` reads no rows from that line.
- **`tests/verify.test.ts`:** a new block, "a verification held to the request's own words", with 3 tests on the generic catalogue fixture.
  - A yes whose reason for the left-out handle row is only the search quote ("garden tools") is not taken. After the second call the outcome is `does_not_answer`, and `repair.checked` names the row.
  - A yes quoting the request's "replacement parts" beside the row is taken: one call, `answers`.
  - Exclusion re-ask on a split (yes, then a no advising "excludes refurbished bundles such as ...", then the re-ask says yes):
    - outcome `answers`, with verdicts `[answers, does_not_answer, answers]` and `calls: 3`;
    - interventions `[[1,-],[2,-],[2,true]]`;
    - the third request's `resultSummary.recheck` names the exclusion.

### Commands run and observed results

All run from `packages/fluxiq` unless noted.

1. **Fail-first for the wiring.** I temporarily removed the two `wording` lines from `verify.ts`, using a copy saved in the scratchpad, then ran `npx vitest run .../tests/verify.test.ts -t "request's own words"`.
   - Result: `Tests 2 failed | 1 passed | 14 skipped`. The "does not take a yes" and the "asks a split's no once more" tests failed. The "takes a yes" test passes either way.
   - I then restored the file: `git diff --stat` shows verify.ts at 42+/10-, B's edits plus mine.
2. `npx vitest run .../tests/verify.test.ts .../tests/verdict.test.ts` gave `Test Files 2 passed`, `Tests 53 passed`.
3. **Scope:** `npx vitest run runtime/result-verification runtime/service/candidate-trial runtime/llm/deepseek` gave `Test Files 1 failed | 87 passed (88)`, `Tests 1 failed | 854 passed (855)`.
   - The one failure is `build-test/tests/judge.test.ts`, "yes, then no, is unknown carrying the no's reading...".
   - Diff: `calls` was expected 2 and received 3. `advice` was expected "Narrow the name condition so it excludes only accessory items." and received "Judge call 2 (Core's check: this advice adds an exclusion the request never states, \"excludes only accessory items\", ...): Narrow the name condition so it excludes only accessory items." See Outcome above.
4. **Typecheck:** `npx tsc --noEmit -p tsconfig.json` gave exit 0 and no output.
5. **Audit:** `node scripts/structure-audit.mjs` at the Core root gave `structure-audit: passed (342 warning(s), 1159 baselined).`, exit 0.

### Not verified (continuation)

- No live or provider run. Whether real judges fit the quotes within the per-field limits, and in the same sentence as each row, is unmeasured.
- `run-outcome.ts:527` verifies with `instructions: []`. There `wording` is `undefined`, so neither check applies on that path, by design.

### Open questions (continuation)

- `build-test/tests/judge.test.ts:340` needs the one-line fixture change described in Outcome. That file was not in my brief.
- `result-verification/contracts.ts` doc for `verdicts` and `calls` still describes a 3-call verification only as the t503 re-ask (unowned).
