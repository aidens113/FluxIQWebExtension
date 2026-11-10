# Judge read-pages evidence (hubs attempt 2, cause 3)

## Outcome

Partial. The judge is now given a `readPages` entry for a result made of rows, built from the row sink's account of each read. It carries the view of the site, the place in the list, and the rows kept. It is complete for reads the model made by hand. It is not complete for reads made by a saved Flow's run (the live case), because Core's record batch carries no address (see Not verified).

## Where evidence is built

- The completion check builds the summary in `summaryOf` (`answer-first/completion/check.ts`).
- `automationStudioFlowLessJudgedSummary` (`result-verification/flow-less/judged-summary.ts`) screens and bounds it into what the model is sent, with the `question`.
- The row sink (`answer-first/rows/row-sink.ts`) already held each read's rows and place per list ("pages", reset when the list starts over). It did not hold the address.

## The change

- **Sink.** `rows/list-page.ts`: a page gains `where` (the view's address with paging words removed) and the file exports `AutomationStudioAnswerFirstReadPage`. `rows/list-after-read.ts` records `where` from the read's evidence `list`. `rows/sink-type.ts` and `rows/row-sink.ts` add `readPages()`, which returns `{ where?, place?, kept }` for each read of the result's list. It is empty while no read stored a row.
- **Check.** `completion/check.ts` takes an optional `readPages()` and adds `readPages` to the summary only when the result has rows. `attempt/run-attempt.ts` wires `readPages: () => sink.readPages()`.
- **Judge evidence.** New `flow-less/read-pages-shown.ts`: no page text, one entry per read, `where` cut to 300 characters and `place` to 80, screened like `looked`, at most 40 reads (`readPagesNotShown` counts the rest). A screened address marks the summary withheld. `judged-summary.ts` sends `readPages` and `readPagesNotShown`. `types.ts` adds the field. `index.ts` exports the builder.
- **Question.** One generic sentence in `flow-less/question.ts`: readPages lists the reads the rows in recordSets came from, oldest first, each with where (the view) and place (the position in it) and kept (the rows kept); the rows are those of every page listed, not only the page endView shows. It names no scenario, site or task. The digest covers the new field because it hashes the whole summary.

## Files

Changed: `packages/fluxiq/src/runtime/result-verification/flow-less/{types,question,judged-summary,index}.ts`, new `flow-less/read-pages-shown.ts`; `packages/fluxiq/src/framework/automation-service/service/answer-first/{completion/check.ts,attempt/run-attempt.ts,rows/list-page.ts,rows/list-after-read.ts,rows/sink-type.ts,rows/row-sink.ts}`.
New tests:
- `flow-less/tests/read-pages.test.ts` (4)
- `rows/tests/read-pages.test.ts` (2)
- `completion/tests/read-pages-evidence.test.ts` (2)

No pinned-prompt digest or snapshot test existed for the question, so none needed updating.

## Commands and results

- The new tests (8) passed on first run. With the change disabled (sink `readPages` returning `[]`, check and judged-summary guarded `false &&`, question sentence deleted), 4 of the 8 failed:
  - the sink two-pages test,
  - the judged-summary entry test,
  - the question and digest test,
  - the completion two-page test.
  The "absent for no rows" tests pass either way, as they should. All files were restored.
- `vitest run src/runtime/result-verification src/.../answer-first/{completion,tests,rows,attempt}` -> 280 files, 2146 tests passed.
- `pnpm --filter fluxiq check` -> printed no errors, build-cache step ran 207 s. My command piped it to `tail`, so I did not read the exit code itself, only that no tsc error was printed.
- `pnpm structure:check` (Core) -> exit 0, "structure-audit: passed (538 warning(s), 1095 baselined)". Two more warnings than the last report's 536 are in the existing file-lines advisory list; I did not check which files.

## Not verified

- **Saved-run reads carry no address.** For rows from a saved Flow's run (`recordBatch`), the entry has only `kept`: the engine's `AutomationStudioRecordBatch` has no address, and the host's page summary is opaque to Core. So the live hubs case would show "read 10 rows" twice, which tells the judge there were other reads, but not which pages. Giving the page address here needs the engine's batch capture (`engine/automation/records/capture.ts`) or the run gate (`flow-run`, `run-acts`, owned by the parallel worker) to pass the call's answer `location` on to the batch. I did not touch those. This should be decided before this is counted as closing cause 3.
- No live or scripted Lab run, no `pnpm build`.
- The `check` exit code, as above.
