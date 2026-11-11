# t905 result ledger: sub-supervisor report

## Checkpoint 1, 2026-11-11: phase 0 done (Core only)

**Outcome:** Phase 0 is done and checked in the Core tree `fxwork/t905/!FluxIQ` (task/t905-result-ledger). Nothing in the extension tree changed apart from these reports. Phases 1 to 3b have not started.

### What changed (Core, `packages/fluxiq/src`)

**Phase 0a, the judge gets everything whole** (`runtime/result-verification/flow-less/`):

- `judged-summary.ts`: removed `LOOKS_SHOWN` (6), `FOUND_CHARS` (600), `WHERE_CHARS` (300) and `cut()`. Every look now reaches `sent` whole.
- `read-pages-shown.ts`: removed `READS_SHOWN` (40), `WHERE_CHARS` (300), `PLACE_CHARS` (80), `FOUND_CHARS` (200), `cut()` and the `notShown` count. Screening is unchanged.
- `question.ts` and `tests/__snapshots__/judged-summary.json` (my integration edit): dropped "readPagesNotShown counts any earlier reads left out", because that key no longer exists.
- Size is handled only by `window-fitting.ts`, which was not changed. New tests show it summarises `looked` and `readPages` by name.
- Tests changed: `tests/looked-view.test.ts`, `tests/read-pages.test.ts`, `tests/window-fitting.test.ts`. They cover a 2,000-character look, a 300-character left-out label, more than 40 pages, and an oversize summary being summarised and named.

**Phase 0b, the run's note gives the result after the run** (run-mwbk0twg):

- `framework/.../answer-first/rows/result-change.ts`: a new change kind, `carried_on`. It holds counts only and no instruction words, under the code `answer_first.result_list_carried_on`.
- `rows/row-sink.ts`: a replay pass (`call.value.replay`) that adds to the result's own list now records the result's rows and pages as they stand after it.
- `runtime/llm/node-tools/run/result-list.ts`: the run's note keeps `replaced` and the instruction from the first pass that switched the result. It takes the counts from the last pass that stored rows. A run that changed nothing still carries no note.
- I did not change `flow-part.ts`. The route through the row sink avoids every t885 file. The design's alternative, passing the sink's summary as a port, would have needed `evidence-loop*`.
- Tests: `run/tests/result-list.test.ts` (pass 1 replaces 11 rows, pass 2 carries on +5, so the note says 16 rows over 2 pages) and `rows/tests/carried-on-stamp.test.ts` (new). In `rows/tests/replayed-read.test.ts`, two assertions changed from "no note" to the stamp, on purpose.

### Workers

| Label | Tier | Brief | Outcome | What I checked |
| --- | --- | --- | --- | --- |
| p0-judge-cuts | worker (Sonnet) | phase 0a | Partial: its `pnpm check` was still queued when it stopped, and it flagged question.ts | I read the diff, fixed question.ts and the snapshot, and ran the tests, audit and tsc below |
| p0-run-note | worker (Sonnet) | phase 0b | Done | I read the diff and re-ran the tests, the neighbouring tests and tsc |

### Commands run (by me) and what they showed

- `npx vitest run src/runtime/result-verification/flow-less src/runtime/llm/node-tools/run src/framework/automation-service/service/answer-first/rows` printed "Test Files 30 passed (30), Tests 272 passed (272)".
- `npx vitest run .../attempt/tests/named-columns.test.ts .../answer-first/tests/latest-read.test.ts src/runtime/run-overrides/tests/prompt-text.test.ts .../answer-first/completion` printed "Test Files 12 passed (12), Tests 92 passed (92)". That includes the real-SQL latest-read case "a Flow run that switches the list: the run's answer says so".
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (535 warning(s), 969 baselined)".
- `heavy-slot run t905 -- pnpm check` (Core packages/fluxiq tsc) printed `{"build-cache":"build","step":"fluxiq:check",...}` and exited with code 0 (no type errors).

### Not verified

- The scripted towels Lab proof (`pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`) has not been run. It needs the downstream workspace built against this Core tree. I propose running it at the phase 2 proof, when the header replaces this note anyway.
- The `result-list.ts` unit test alone would still pass with the old `result-list.ts`, because the old "last note's counts" logic also yields 16 once pass 2 carries a stamp. The regression guard for the actual fault is the sink stamp test, `carried-on-stamp.test.ts`, which cannot pass without the `row-sink.ts` change.

### Open questions and notes for the lead

- The finished-run judge (`result-verification/build-test/change-lines.ts` `CHANGE_LINE_CHARS`, and `rowsNotShown`/`changedNotShown` in `read-rows.ts`/`stores.ts`) still cuts. That is phase 3b's ground, so I left it.
- `carried_on` is interim. Phase 2 deletes `result-change.ts` and `result-list.ts` in favour of the ledger header and change line.

Outcome: Partial
Changed: Core packages/fluxiq/src/{runtime/result-verification/flow-less/{judged-summary,read-pages-shown,question}.ts, flow-less/tests/{looked-view,read-pages,window-fitting}.test.ts, flow-less/tests/__snapshots__/judged-summary.json, runtime/llm/node-tools/run/result-list.ts, run/tests/result-list.test.ts, framework/automation-service/service/answer-first/rows/{row-sink,result-change}.ts, rows/tests/{replayed-read,carried-on-stamp}.test.ts}
Validation: `npx vitest run` (flow-less, run, rows) -> 30 files / 272 tests passed; neighbours -> 12 files / 92 passed; `pnpm check` (Core tsc, heavy slot) -> exit 0; `node scripts/structure-audit.mjs` -> passed (535 warnings, 969 baselined)
Not verified: scripted towels Lab proof; phases 1-3b not started
Report: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/t905-result-ledger.md
Notes: checkpoint 1 of the lane (phase 0); tiers: 2 Sonnet workers, no escalation
