# t193-wZ: do-only directive (cause 7)

## Outcome

Done. A refuted Flow that reads nothing no longer gets `result.no_record_set` or a fix about stores, rows or list reads. It gets a new finding, `result.acts_judged_undone`, whose fix tells the repair to compare each act with the step that does it. The re-author brief for that refutation swaps its five list-read "What to do" items for act-oriented ones.

## What changed and why

Core root: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/result-verification/repair-directive.ts`
  - New code `actsJudgedUndone: "result.acts_judged_undone"`.
  - New private predicate `flowReadsNothing(summary)`. It uses the same content-free markers the executor uses to decide a node carries the answer (`executor/defensive/continuation.ts` `carriesAnswer`), applied to what the summary already holds. It returns true only when all of these hold:
    - no `reads`;
    - no `buildTest`;
    - no `flowParametersWithheld`;
    - at least one authored step, with start and end left out;
    - no step is `builtin.data.write-records`;
    - every authored step has `parameters` in view;
    - no step has a non-null `recordOutput`;
    - no withheld path under `recordOutput`.
  - When `recordSetCount === 0` and the predicate holds, the findings are `[actsJudgedUndone]`, plus `summaryWithheld` if that applies. The fix line is: "Compare each act the request asks for -- with the item, option, size, quantity and order it names -- against the step that does it, as the check's reading and advice describe: add the step for an act no step does, and correct the parameters of a step that did its act differently."
  - In every other case (Core cannot see a step's parameters, a read reported, a record writer or record output exists), the old `noRecordSet` behaviour is unchanged.
  - Build tests keep their old findings, so `build-test/judge.ts:78` still drops `noRecordSet` for them as before.
  - Moved `DERIVED_CONTROL_NODES` above its first use, with the same contents, and factored out `withheldFinding()`.
- `R/recovery/refuted-result/brief.ts`
  - It detects the do-only case from the entry's directive, which carries the `acts_judged_undone` code. It uses a type-only import of `AUTOMATION_STUDIO_RESULT_REPAIR_FINDING_CODES`, so the compiler pins the literal and no value import cycle is added.
  - For a do-only refutation:
    - The "What to do" items are act-oriented (`ACT_STEPS`), including "do not add a step that reads or stores anything unless the request asks for something to be read back".
    - "Stored" says the Flow reads and stores nothing.
    - The step line reads "The run was judged at step X ...: where the run ended, not a step known to be wrong", where it used to say "The rows came out of step X".
    - The history "then produced" text and the unchanged-repair hint no longer mention reading the items.
  - Reading Flows get the same five items and lines as before, byte for byte (`READ_STEPS`).
- New tests:
  - `R/result-verification/tests/repair-directive-do-only.test.ts` has 6 tests:
    - do-only gets no `noRecordSet` and no record-oriented fix;
    - a Flow with reads keeps `noRecordSet`;
    - so does one with a `recordOutput` step;
    - so does one with `builtin.data.write-records`;
    - so does one whose parameters are not in view or whose `recordOutput` is withheld;
    - a build test is unchanged.
  - `R/recovery/refuted-result/tests/brief-do-only.test.ts` has 2 tests: the do-only brief carries no list-read advice, including on a second attempt with unchanged history.

## Commands run and observed results

- Failing-first, before the fix: `heavy.sh ... npx vitest run R/result-verification/tests/repair-directive-do-only.test.ts R/recovery/refuted-result/tests/brief-do-only.test.ts` -> `Tests 3 failed | 5 passed (8)`. The failures were:
  - `expected [ 'result.no_record_set' ] to not include 'result.no_record_set'`;
  - both brief tests: `expected 'This build is repair attempt 1 of at …' not to match /step that reads the items|condition …/i`, and the same for attempt 2.
- After the fix: `heavy.sh ... npx vitest run R/result-verification R/recovery/refuted-result R/recovery/tests/context-whole.test.ts` -> `Test Files 28 passed (28)`, `Tests 253 passed (253)`.
- `heavy.sh ... npx vitest run R/tests/refuted-result` (`reauthor-service.test.ts` asserts on the brief's read wording) -> `Test Files 6 passed (6)`, `Tests 33 passed (33)`.
- `npx tsc --noEmit -p .` in packages/fluxiq:
  - The first run printed errors only in `src/ui/activity-action/tests/*` (failure-reason, icons, record). Those files are another worker's and are not mine.
  - The rerun printed 0 errors.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (218 warning(s), 349 baselined)`, with no warning naming the files I changed.

## Not verified

- No Lab or live run and no provider call, so the do-only directive has not been seen working on a real refuted cart run.
- The detection is reliable only when every authored step carries screened `parameters`. That happens only when the bound domain declared denied keys; it did in the bigbox run, whose brief showed parameters. With no declaration, the old `noRecordSet` stays: safe, but no improvement.
- A domain read node that supplies its own record output must either report a read (`metadata.extraction`) or carry `recordOutput` in its parameters. Otherwise the predicate would wrongly call the Flow do-only. `node.metadata.recordOutput` / `metadata.recordsPath` are not in the summary's `flowShape`. The web domain's `dom-extract_list` reports `metadata.extraction`, so it is covered, but I did not check this against any other domain.

## Open questions or contradictions found

- More reliable signal, outside my ownership: `result-summary.ts` `step()` could carry a per-step marker computed like `carriesAnswer` (parameterValues.recordOutput, metadata.recordOutput, metadata.recordsPath, write-records). Then do-only detection would not depend on screened parameters being in view. That needs a change to `contracts.ts` and `result-summary.ts`.
- The brief said Lane D changed brief.ts for C4/C5 ("a refuted result names no innocent step"). brief.ts and its tests in this worktree had no such change; the C4/C5 text is in `ladder-skip.test.ts`. All of `R/recovery/refuted-result` tests pass, including `ladder-skip.test.ts`.
- `attempt.ts:25` and `history.ts` still describe the filed step as "the step the rows came out of". That is accurate for reading Flows; I did not edit them because they are not mine.
