# t790 quote-guard (F1 of the debug of run-mvswh11y-9d462629)

## Outcome

Done. A condition Core settled is now accounted for only by a sentence that itself names the condition and itself
quotes the request's own words. A tested column that is one of the answer's columns no longer names a settled
condition. The provider-free replay of the run's seven trial-3+ yeses holds every one of them for condition 3. All
requested tests pass, and so does the whole `result-verification/` directory.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t790/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.

- `request-rows/unquoted-rows.ts` (F1a). `Accounting` now records `quotes`, which says whether the sentence itself
  quotes the request. `automationStudioResultLeftOutRowsUnquoted` passes `boundUnquoted` only those sentences
  (`quoting`). It no longer passes sentences that got their quote from a neighbour. The row-by-row path (`accounting`,
  t574's lending) is unchanged, as are the stored-row (t691) and kept-row (t663/t692) paths. I added a t790 paragraph
  to the header, changed "beside a sentence" to "in a sentence" in the t574 paragraph, and updated the
  `boundUnquoted` doc.
- `request-rows/summary-reads.ts` (F1b). `automationStudioRequestRowsReads` collects `answerColumns`, the union of
  `columns` over the record sets it keeps (entry and working sets are already filtered out). It passes that set to
  `boundNames`, which no longer adds the tested column (whole or camel-split) when the column is in the set.
  `condition N` and a bound's numbers still name the condition. I added a t790 header paragraph and updated the doc
  comment.
- `request-rows/tests/unquoted-rows.test.ts`: a new describe block, "a settled condition, named and quoted in one
  sentence (t790)". It uses the library audiobooks fixture (`../../value-readings/tests/audiobooks-fixture.ts`), where
  condition 4 is `title not contains ["Sampler"]`, settled as text, and `title` is an answer column. It has four
  tests:
  - (positive) Each condition is named with its own quote, so nothing is held.
  - (1a) Condition 3's quoting sentence sits beside condition 4's sentence, which quotes nothing of the request.
    Condition 4 is held (`bound: true, boundKind: "text"`).
  - (1b) The sentence beside it quotes an unrelated clause of the request ("the order the catalogue shows them"). It
    is held.
  - (2) A sentence lists "title, author and rating" and quotes "columns title, author and rating". It does not name
    condition 4, which is held.
- `value-readings/tests/text-settled-judge.test.ts`: I removed the line-88 workaround (the `.replace(/ (?=Condition
  \d)/gu, "\n")` line split). All conditions now stay on one line, and the test asserts
  `expect(unquoted.observed).not.toContain("\n")`. The unquoted variant is still held. The positive case (line 69)
  passes unchanged: each sentence of `AUDIOBOOKS_YES` quotes the request itself. I did not change the fixture text.
- Existing tests that relied on lending for a settled condition: none. The whole `result-verification/` tree passes
  unchanged, so no fixture text was edited.

## Commands run and observed results

All were run from `$CORE` unless noted.

1. Fail-first: `pnpm --filter fluxiq exec vitest run <RV>/request-rows/tests/unquoted-rows.test.ts`, run before the
   source change. Result: 3 failed, 15 passed. Tests 1a, 1b and 2 each failed with `expected [] to match object [...]`,
   meaning nothing was held. The positive case passed.
2. After the fix, the same file together with `<RV>/value-readings/tests/text-settled-judge.test.ts`. Result:
   text-settled-judge 8 of 8 passed. In unquoted-rows the 3 new tests failed only because my expected condition name
   was wrong. The real name is `condition 4 (title not contains ["Sampler"])`. I corrected the expectation, switched it
   to `toEqual`, and reran unquoted-rows.test.ts: 18 of 18 passed.
3. Acceptance, under the lock, as one call: `pnpm --filter fluxiq exec vitest run <RV>/request-rows/tests
   <RV>/value-readings/tests`. Result: Test Files 24 passed (24), Tests 194 passed (194), exit 0.
4. Broader check for fixtures that relied on lending, under the lock: `pnpm --filter fluxiq exec vitest run <RV>
   src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts`. Result: Test Files 166 passed (166),
   Tests 1341 passed (1341), exit 0. A first attempt with `--maxWorkers=2` ran no tests, because vitest raised
   "options.minThreads and options.maxThreads must not conflict". I reran it without the flag.
5. Replay, provider-free with zero model calls. I ran
   `node --experimental-transform-types --no-warnings <scratch>/t790-quote-guard/replay.ts` from
   `$CORE/packages/fluxiq`. The scratch directory is
   `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/t790-quote-guard/`.
   - For each step, the script reads `context.resultSummary` (the judge's copy) and `context.instructions.instructions`
     from `request.json`, and the reply from `response.json`. It builds `automationStudioRequestWording` and the reply
     text with `verdict/reply-text.ts`, which joins expected, observed, changed and summary, as the verdict does.
   - It runs `automationStudioResultLeftOutRowsUnquoted` twice. The "before" run uses the HEAD copies of both files,
     taken with `git show HEAD:` into scratch with their imports made absolute. The "after" run uses the working tree.
     It also runs `automationStudioResultVerdict` with `basis: "model"` on the working tree.

   | Step | Before | After | Verdict after |
   | --- | --- | --- | --- |
   | 0048 | none held | condition 3 held [bound] | unsure |
   | 0049 | none held | condition 3 held [bound] | unsure |
   | 0051 | conditions 1 (3 rows) and 3 held [bound] | same | unsure |
   | 0052 | none held | condition 3 held [bound] | unsure |
   | 0053 | none held | condition 3 held [bound] | unsure |
   | 0062 | conditions 1 (3 rows) and 3 held [bound] | same | unsure |
   | 0063 | none held | condition 3 held [bound] | unsure |

   - Every "verdict after" carried the reason "The affirmative judgement did not supply the required row-local
     exclusion evidence, so the result remains unconfirmed."
   - So every yes from trial 3 onward is held for condition 3, and none comes out as `yes`. "Before" reproduces the
     debug exactly: five accepted, and 0051 and 0062 already held.

## Not verified

- No package typecheck (`tsc`) and no structure audit were run. The brief's acceptance did not ask for them, and they
  are heavy-lock work. The new test adds no `as never` cast (grep found none). `request-rows/` still has 25 source
  entries plus `tests/`, with no new source file.
- The replay used the judge's copy of the summary (`context.resultSummary`), not the raw run summary that `verify.ts`
  builds the wording from. The judge's copy says row ids before left-out rows, and `summary-reads.ts` strips those. I
  did not run the full `automationStudioBuildTestJudge` re-ask loop, only the verdict on each single reply.
- I did not check how F1(b) affects settled conditions whose tested column is an answer column in runs other than
  this one. Those conditions now need `condition N` (or a bound's number) in the quoting sentence. This is stricter by
  design, and no existing test depended on the old reading.

## Open questions or contradictions found

- `request-rows/types.ts` (not owned) still documents `settled.names` as "its `condition N`, its column, and the
  numbers its bound writes". It does not mention that the column is dropped when it is an answer column. The lead may
  want that one-line doc touched.
- The debug's stated residual risk is unchanged. Core still does not judge whether a quote in the condition's own
  sentence actually excludes the row. A judge that quotes unrelated request words in that same sentence would still
  pass. The positive test shows this: "every audiobook in the library catalogue" is accepted for the Sampler condition.
- The Core worktree holds other lanes' uncommitted edits (agreement/, located-defects/, refuted-no/count-claim.ts,
  value-readings sources, listed-values/). I did not touch them. The broad run tested them together with my change.
