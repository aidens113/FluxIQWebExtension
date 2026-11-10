# Result list switch inside core.run_flow

## Outcome
Done. A `core.run_flow` run that switches the result's list now carries `resultList` on its own answer, so the model's next request shows it. By-hand reads are unchanged.

## What changed and why
Core src: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.
- New `runtime/llm/node-tools/run/result-list.ts` (exported from the barrel): `automationStudioFlowDraftPartResultList(evidences)`. From the passes' answers it takes each `resultList` note and builds one note for the run. It keeps the first note (code, `replaced`, instruction: what the result held before the run) and takes `rows` and `pages` from the last (what the run left). No note when no pass had one.
- `runtime/llm/node-tools/run/flow-part.ts`: collects each pass's answer evidence in `answered` and puts the note on the run's evidence. Header paragraph added.
- No answer-first file needed changing: the chain already puts the note on each pass's answer (a pass is a call through the chain); only the run summary dropped it.

## Commands run and observed results
- New end-to-end test in `answer-first/tests/latest-read.test.ts` ("a Flow run that switches the list ..."): real service, scripted model, real SQL. A by-hand read joins list A and goes into the draft. A different read makes list B the result. `core.run_flow {from:2,to:2}` replays A's read, so the result goes back to A. The next request's `forward` entry carries the `result_list_replaced` note, rows 3 and replaced rows 1 (lastReadBy "narrowed"), and the answered result has 3 rows. Passed.
- Revert check: I removed the `resultList` line in `flow-part.ts` and ran that test. Result: "expected undefined to match object", 1 failed. The file was restored (grep count 1).
- New unit test `run/tests/result-list.test.ts` (3 tests).
- `npx vitest run src/runtime/llm/node-tools/run .../answer-first/rows .../attempt .../tests` -> exit=0, "Test Files 69 passed (69), Tests 503 passed (503)".
- `pnpm --filter fluxiq check`: the first run failed on a type error in `result-list.ts` (undefined to JsonValue). I fixed it, then `pnpm check` in `packages/fluxiq` printed no tsc errors and finished (stamped). I did not capture the process's exit code line directly.
- `pnpm structure:check` -> exit=0, "structure-audit: passed (538 warning(s), 1095 baselined)". No new test file went in `answer-first/tests/`; the new test is in the existing `latest-read.test.ts`.

## Not verified
- No live run. Whether the model acts on the run's note is not observed.
- With several switches in one run, the note shows the pre-run list and the final state; interim lists are not named.
- The run_flow answer carries the note on a forward run and on a plain part run alike; only the forward run was exercised end to end.

## Open questions
None.
