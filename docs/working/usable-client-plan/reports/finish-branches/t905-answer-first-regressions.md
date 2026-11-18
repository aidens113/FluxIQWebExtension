# finish-branches/t905-answer-first-regressions

## Outcome

Partial. 36 of the 38 failures are fixed at their causes. The other 2 are in tests whose expectations
conflict with t905's design, and changing those tests is the lead's call. They are listed under Open questions.
No dev change was involved. Every cause is in t905's own phase-2 wiring: `rows/row-sink.ts` publication,
`result-feed/feed.ts`, the fake domain's `place`, and t905's own edits to these tests. Dev touches none of
those files, and the seven failing files that are identical to dev have no recorded t905 run (WIP 096fc1975).
The captured-row guard was not involved. Its files are untouched, and `src/engine/automation/{input-use,tests}` passed.

## Causes, by group, with evidence

1. **The store refused the result's publication, and that read as `setup_needed` (30 tests).** Groups:
   carry-on 13 (including the Stop test's AbortError), double-act 6, second-attempt-proof 3,
   apply-proven 3, interrupted 2, caller-replay 1, run-overrides-press 1, two-presses 1.
   A temporary print in `setup/setup-needed.ts` showed `flow_bootstrap.pre_provider_validation_failed` with
   `issueCodes ["thrown.Error","thrown.at:...run-dataset-store.ts:187"]` 12 times (the "Run dataset schema
   changed within one run" error) and `:188` 17 times ("processing changed"). Both are store errors, and they came with
   `totalProviderCallCount` 4-6, so model calls had already been made. `publish` wrote the whole answer to
   `step.<id>.v<n>` as an ordinary batch. The store fixes a dataset's schema and processing for the whole run.
   Two things change them:
   - The answer's columns are the union of the row keys when the contract is unsure (`result/answer.ts`), and a later page can widen it.
   - A carry-on copies the earlier segment's publication into the new run under the same id, with no processing
     (`rows/copied-rows.ts`). Then `publish` adds `{dedupe:false}`.

   I inferred which batches clashed from the line numbers and the test groups. After the fix, a run with a
   per-batch print showed no refusal.
2. **A stand-in's pages dropped out of the result (second-attempt-proof "run's deadline": `totalRows` undefined).**
   `automationStudioAnswerFirstStandIn` sets `standsFor` = the broken step at the ending. Then `feed.ts` `idOf` took the
   chain id first, so the hand read's ledger id ("again") was replaced by the broken step's empty one, and the page was "dropped".
3. **Paths after t905 changed `readLoans("again", {})` to `readLoans("again")` (later-attempt 2, apply-proven 1).**
   Under D1 (design (b)1: "A read not in the draft (no add) | A look ... It never changes the result"), the hand read
   has to be a draft step. So it stands in for the broken step and runs, which `attempt/path.ts` already calls a repair.
   Received `run_flow_then_repair`. Expected `..._explore`.
4. **No place on the fake domain's reads (latest-read 3).** t905 p2-place moved `place` to the domain's answer
   (`read-of.ts`: "A call's requested page or address cannot declare it"). The fake library never said one, so the
   received lines read "unplaced read 2" and pages appended instead of replacing.

## The fixes

- `rows/row-sink.ts`, `rows/sink-input.ts`: a publication now goes through a new optional `startOver` writer.
  It starts the dataset over and declares its own schema and processing (the store's `startsOver`).
  `attempt/run-attempt.ts` wires it to `datasets.restartedPass(projectId, runId).onRecordBatch`, one pass per batch.
  `attempt/contracts.ts` adds `restartedPass` to the `datasets` Pick, as a required member. That is the existing public seam.
  A dedicated `RunDatasets` method would be cleaner, but `datasets/` is outside my paths.
- `result-feed/feed.ts` `idOf`: a step's own id is looked up before its `standsFor` chain. A rerun is a new step,
  so it still takes the replaced step's id.
- `tests/fake-library.ts`: an opt-in `pager` makes a read say `place` from the address's `page` or a `page` parameter.
  This is how `result-feed/tests/service.test.ts`'s domain already does it. `tests/latest-read.test.ts` sets it in the
  7 tests that use places, and its header comment now says so.
- `tests/later-attempt.test.ts` (2) and `apply-proven/tests/apply-proven.test.ts` (1): the paths changed to
  `run_flow_then_repair`, with "Changed by lane t905" comments. One test title now says "a hand read in its place ... is a repair".
  apply-proven's second (broken-run) expectation stays `explore`, as observed.
- I removed the temporary debug prints (`rounds.ts`, `setup-needed.ts`, `row-sink.ts`). `grep T905DEBUG` finds none.

## Commands (all through `heavy-slot.mjs run`)

- dbg3: the 10 failing files with a print, before the fix. Exit 0 from the wrapper. "Tests 38 failed | 109 passed (147)". Stack lines as above.
- dbg4: the same 10 files after the fixes. "Tests 3 failed | 144 passed (147)". That left latest-read:116, keep:51, and
  apply-proven:205. I then reverted the apply-proven expectation I had guessed.
- Validation (`t905-af-validate.sh`):
  - `pnpm.cmd exec vitest run src/framework/automation-service/service/answer-first src/runtime/answer-first src/runtime/flow-authoring/draft src/engine/automation/input-use src/engine/automation/tests --maxWorkers=1 --minWorkers=1`
    exited 1: "Test Files 2 failed | 235 passed (237)", "Tests 2 failed | 2164 passed (2166)". The two failures are latest-read:116 and keep:51.
  - `pnpm.cmd --filter fluxiq check` exited 0 (tsc, no errors).
  - `node scripts/structure-audit.mjs` exited 0: "passed (554 warning(s), 909 baselined)".
- One mis-launched run (an unquoted `-t` filter) started the whole suite. I stopped it after a few seconds.

## Not verified

- Which batches clashed in group 1 is an inference. The before-fix run had line numbers but no per-batch print.
- I did not add a unit test for the start-over publication or the `idOf` order. The failing integration tests above are the regression guard.
- No Lab, browser, or full suite was run.

## Open questions and contradictions (lead)

1. **keep.test.ts:51** (identical to dev) expects `{collected 6, duplicates 3}`. `read.2` has no `add`, so under D1 it is a
   look and never joins the result. The published answer is stored once, which gives `collected 3, duplicates 0`. The test's own guards
   (the row says 3, the dataset serves 3, `recordCount` 3) still pass. Either update line 51 or keep looks in the result's processing.
2. **latest-read.test.ts:116** (t905-modified, expectation left unchanged) expects the run to hold only the result dataset.
   The sink stores one capture dataset per call (`read.*`, per its header), and an earlier output step's publication (`step.first.v1`) also stays.
   Data/export lists all 5. Decide whether captures or superseded publications should stay out of the run's datasets, or loosen the test.
3. **Outside my paths:** an error thrown at the ending, after model calls, was labelled `pre_provider_validation_failed`.
   Answer-first then turned it into a setup step that says "before anything was done or spent"
   (`service.ts` catch → `generation-catch.ts` → `setup-needed.ts`). That is what hid the store refusal. It needs its own fix.
