# t194-w8: the judge and the re-author see how the read went

## Outcome

Done. The judge now gets a per-read account of each extraction step in
`resultSummary.reads`, and a short version of it in the observation that
becomes `failure.actual`. The re-author's brief gets the full account. The
account survives the 4,000-byte budget: step parameters are dropped first,
then the row sample, then the step list, and only after all of those the
wording of the conditions (their counts stay). Everything is in Core
(`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`). I did not commit, build
dist, or run anything in the Lab or a browser.

## Cause (file:line refers to the pre-change tree)

1. `runtime/result-verification/verdict.ts:147-156` (`automationStudioResultObservation`)
   builds the "actual" line from counts and definition ids only. That is where
   the judge's "8 records stored, across 1 record set; the Flow's steps were
   ...; part of the summary was withheld to fit the call" came from.
2. `runtime/result-verification/run-outcome.ts:422-426` builds the judge's
   summary from the record sets and the flow nodes only. The run record already
   holds each read's own account of itself on
   `actionAttempts[].metadata.extraction` (admitted by
   `service/summaries/conversions.ts:170,213` through `extraction-summary.ts`),
   but that was never read. `getFlowRunDetail` was called only later, at line
   439, and only for the model call.
3. `runtime/result-verification/result-summary.ts:333-340`: the step parameters
   are paid for last, in step order, out of whatever the sample left of the
   4,000-byte budget. The extraction was the last step (s6), so its parameters
   (`paginate`, `where`, `dedupe`) were the ones cut, and
   `flowParametersWithheld` was set. That produced "part of the summary was
   withheld". The judge's own `observed` field reads "flowShape has no
   pagination step, no sponsored/accessory exclusion step, and no dedup step".
4. `runtime/recovery/refuted-result/history.ts:94-95` and `brief.ts:93-94`: the
   brief carried the same summary's step parameters (absent when cut) and row
   counts, and nothing else about the read.

## What changed and why

- New `runtime/result-verification/read-account/`:
  - `accounts.ts`: `automationStudioResultReadAccounts`. For each step that
    reported a read, it joins the recorded account of that read with the
    step's authored parameters. The recorded account supplies pagesRead,
    paginationStop, truncated, itemsSeen, recordCount, and the conditions'
    rejected counts and unfiltered flag. The authored parameters supply
    whether the step paginates, `pageLimit` (the first `max*` bound of
    `paginate`), whether it dedupes and by which column ids, and each `where`
    condition, paired by position with its rejected count. It returns at most
    4 reads and 8 conditions per read. The read's parameter object is found by
    what it holds (`where`/`paginate`/`dedupe`/`fields`), not by the domain's
    key name. A retried step is described by its last successful read, with
    `attempts` set. If no denied-keys list was declared, only counts go out.
  - `condition.ts`: `automationStudioResultReadConditionText`. It writes a
    condition the way the model authored it, e.g.
    `name not contains ["ear tips", "charging case"]`, `rating atLeast 4`,
    `attribute data-sponsored is absent`. A condition's own `read` is never
    shown. When that read is the same authored object as one of the step's
    columns (compared inside Core, ignoring `required`), the column key is
    used instead. Otherwise it is named by its kind, plus the attribute name
    when that is a plain name. Numbers are carried whole. Strings are cut to
    60 characters and replaced with `(withheld)` when they look like a locator
    or a credential. The whole condition text is screened again.
  - `sentence.ts`: `automationStudioResultReadSentence(read, "brief" | "full")`.
    The brief form (used for `actual`) carries counts only. The full form (used
    for the re-author brief) names each condition and its rejected rows, and
    says "It already follows pages; do not add a paging step around it".
- `contracts.ts`: new `AutomationStudioResultReadAccount` type, and a new
  `reads?` field on `AutomationStudioRunResultSummary`, placed before
  `flowShape`.
- `result-summary.ts`: new input `actionAttempts`. The summary includes
  `reads`. The new `fittedToBudget` replaces the old "drop sample" fallback.
  It drops, in order: the sample, then the step list from the end (sparing
  steps a read speaks for), then condition wording from the last read
  (keeping the counts), and only last the reads themselves. Parameters are
  still paid for out of whatever is left, so they are always the first thing
  to go.
- `run-outcome.ts`: the run detail is now read before the summary is built,
  once, and reused for the model call. The new `attemptsOfThisSession` filters
  `actionAttempts` down to the attempt ids in the session's own trace. A
  re-run keeps its run id, so without this filter it could describe the Flow
  that was just replaced. A session with no trace takes the record as it is.
- `verdict.ts`: the observation puts the brief read sentences before the step
  list, so they survive the 1,024-character `actual` limit.
- `recovery/refuted-result/history.ts`: the entry carries `reads` from the
  summary.
- `recovery/refuted-result/brief.ts`: adds a `- How the read went: ...` line
  for each read, with the full sentence. Rule 3 now says: if the read already
  pages, dedupes or filters, change that setting or condition in place rather
  than adding a step; the condition that rejected wanted rows is the one to
  correct. It imports the `read-account` barrel directly, because importing
  the `result-verification` barrel as a value would close the cycle that
  `reauthor.ts:47-52` documents.
- `llm/diagnosis-instructions.ts`: one sentence tells the judge what
  `resultSummary.reads` contains, and not to advise adding paging, filtering
  or dedupe that a read already does.

Example output for the run's own read, taken from the tests:
`step node.bootstrap.5d98a75a68c43949.main.s6 read 5 pages of at most 5, paging stopped on page_limit and kept 8 of 56 items seen; it pages, keeps one row per url, its 4 conditions rejected 13, 20, 27, 16 rows`.

## Tests

- `result-verification/read-account/tests/accounts.test.ts` (7 tests), with
  fixture `read-account/tests/earbuds-read.ts` (the s6 read, with invented
  selectors). Covers:
  - the full account, with each condition's wording and rejected count;
  - no authored locator appears anywhere;
  - a locator-shaped operand is withheld and its count is kept;
  - only counts go out when no denied-keys list was declared;
  - a retried step is described by its last successful read;
  - an attempt without an account produces nothing;
  - the brief and full sentences.
- `result-verification/tests/judge-sees-the-read.test.ts` (4 tests):
  - with this run's shape, s6's parameters are still cut
    (`flowParametersWithheld: true`), `reads` carries pages, the stop and
    every rejected count, and the summary stays at or under 4,000 bytes;
  - a 36-step list is trimmed, the read's step and its conditions are kept;
  - end to end through `verifyAutomationStudioRuntimeSessionResult`: the
    `loop_verification` request's `resultSummary.reads` and the refutation's
    `failure.actual` both carry the read, and no locator appears in either;
  - an attempt that is not in the session's trace gives no read.
- `recovery/refuted-result/tests/brief.test.ts`: one new test. The brief
  carries "How the read went: Step ... read 5 pages of at most 5, paging
  stopped on page_limit ...", "It already follows pages", "It already keeps
  one row per url.", each condition with its rejected rows, and no locator.
- Mutation check (my own files, backed up to scratchpad and restored):
  - Removing `reads` from the summary and the brief loop: all 3 positive judge
    tests and the brief test failed ("Tests 4 failed | 5 passed (9)").
  - Inverting the session filter: the "did not make" test failed ("1 failed").
  - After restoring, the full run passes again (below).

## Commands run and observed results

All commands were run in `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`.

- `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/recovery/refuted-result`
  (in `packages/fluxiq`) printed "Test Files 16 passed (16)" and "Tests 172
  passed (172)". It passed both before and after the mutation restore.
- `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/recovery/tests src/programs/automation-studio/runtime/tests/refuted-result src/programs/automation-studio/runtime/llm/deepseek src/programs/automation-studio/runtime/llm/harness`
  printed "Test Files 41 passed (41)" and "Tests 504 passed (504)". This run
  includes `context-fit`, `request-locator-shapes`, `reauthor-service` and
  `repair-replay-chain`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w8 tsc" npx tsc --noEmit -p tsconfig.json`
  (in `packages/fluxiq`) printed "[heavy] t194-w8 tsc holds b2" and nothing
  else, with exit=0.
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (195
  warning(s), 354 baselined)". That is the same warning count as before my
  change. `run-outcome.ts` is now 702 lines; it was already over the
  400-line advisory threshold.

## Not verified

- Nothing was run live. The live judge's and re-author's actual text was not
  observed.
- I did not trace whether, in a live run, the run detail read at verification
  time already holds `actionAttempts` with `metadata.extraction` on every
  path. The main path saves the annotated detail before verifying
  (`service.ts:2732,2785`), and the Lab bundle's `actions[].extraction` shows
  the record carries it. I did not trace the re-run path
  (`rerunRepairedFlow`). If a re-run's detail is stale, the session filter
  means the judge gets no reads rather than stale ones.
- In this run the extension did not report `paginationStop` (F6), so live
  reads may have no `stop`. `pageLimit` (e.g. "5 of at most 5") still shows
  the limit was hit.

## Open questions or contradictions found

- The condition wording carries an item attribute's name
  (`attribute data-sponsored is absent`) when it is a plain name that passes
  the locator and credential screens. `recovery/repair-context/parameter-vocabulary.ts`
  withholds `read.attribute` in the step-parameter projection, so the two
  sections now differ on this one name. I carried it because without it the
  sponsored exclusion reads as "the item's attribute is absent", which is not
  enough to judge by. If the policy is that attribute names never leave,
  delete the `attribute` branch in `read-account/condition.ts` `subjectOf`.
- `summarizeAutomationStudioRunResult` still cuts the step list at `maxSteps`
  (40) before any budgeting. A read step past the 40th would lose its step
  entry, though its `reads` entry would remain.
- Other workers' uncommitted edits are in the Core tree (`flow-bootstrap/**`,
  `llm/node-tools/**`, `service/summaries/extraction-summary.ts` and its
  test). I did not touch them. My tsc and test runs include their current
  state.
