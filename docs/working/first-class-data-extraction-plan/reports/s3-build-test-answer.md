# Report: s3-build-test-answer (read-list S3, build-test judge)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t291/!FluxIQ`, branch `task/t291-read-list-s3-judges`. Nothing committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. `buildTest.stores` now judges the answer that the run's end would make, not the raw appends. Each dataset gives
`passes`, `collected`, `answer {rows, labels}`, `removed?`, `keptNone?` and `repeated?`, where `repeated` is computed on
the answer. The rows come from the stored records that the replay now carries on each observation. A do-while Flow no
longer loses every step from its Repeat node on.

## What changed and why

- `R/llm/node-tools/replay-span.ts`
  - `AutomationStudioFlowDraftReplayObservation` gains an internal `records?: JsonObject[]`.
  - New `automationStudioFlowDraftReplayStoredRecords(answer, mode)` returns `outputs.records` (Core's capture key).
    It returns them only from a step that was asked to run and ran (the same rule as `...ReplayProduced`), and only
    when every member is an object.
  - Every pass observation, the while-check's included, carries the records it stored. They sit beside `evidence`,
    never inside it.
- `R/llm/node-tools/replay-draft.ts`: a straight step's observation carries its `records` in the same way.
  - I checked every consumer of observations:
    - `dry-run-gate.ts` hands the report only to `observeTest`, which keeps it in memory in `build-judge.ts`.
    - `step-place.ts:161` sends only `seen.evidence`.
    - `summary.ts` maps only `{pass, evidence}` into what is sent. Its new `records` path feeds `stores` alone.
    - Nothing else reads observations. No step log or model request reads them.
- `R/result-verification/build-test/stores.ts` (rewritten core):
  - `ROUTING_NODES` adds `builtin.control.repeat`. This was the fail-first cause: `stores` came back `[]` for a
    do-while Flow.
  - Each storing node's record output is parsed with `parseAutomationStudioRecordOutput`, giving its schema and
    `process`. A node that names no `recordsPath` is parsed with `"records"`, Core's capture key.
  - Answers carry `at`, their index in the report. Rows are collected per dataset in that capture order (pass order),
    one batch per answer: `nodeId` is the node's id and `batchKey` is `at`.
  - `replace` clears the dataset before each batch it writes.
  - The answer is made with `processAutomationStudioRecordRows`, using the first writer's schema and `process`.
  - A Symbol key carries each answer row's place in the collected list through the function. Spread keeps it, and it
    is in no column. `process.columns` is taken off so the key survives, and when `dedupe` is absent its whole-row key
    is kept as `dedupe: {by: columns}`. Rows, order and counts are therefore the same as the function would give.
  - Labels: label n of a read's `readRows.rows` names record n only when `labels.length === records.length` and there
    is no `rowsNotShown`. Otherwise those rows count and have no label. Screening (denied column, credential- or
    locator-shaped label written `(withheld)`, never called a repeat) is unchanged.
  - When a read sends labels but no records, the dataset is `labelsOnly`. Its answer is then the collected rows as they
    came, and `removed` is absent. The same holds when the record output does not parse.
  - `keptNone` is set when `collected > 0` and the answer is empty.
- `R/result-verification/build-test/summary.ts`:
  - The report observation type gains `records?`.
  - `answers` now passes `{at, evidence, records}` for each matching observation.
  - The step-match predicate was factored into `observes()`, which `observationsOf` also uses.
  - The header line for `stores` was updated.
- `R/result-verification/build-test/judge.ts` and `R/result-verification/verdict.ts`: the count reads `store.answer.rows`
  where it used to read `store.rows`. Nothing else changed.
- `R/result-verification/build-test/read-rows.ts`: unchanged, because nothing in it needed to change.
- Tests:
  - `build-test/tests/stores.test.ts`: the existing cases now use the new shape, and the labels-only cases assert
    that `removed` is absent. A new describe has 6 do-while cases:
    - a boundary repeat;
    - a declared `process` (dedupe by url, then sort by price, then limit 3);
    - `replace`;
    - `keptNone` from `process.where`;
    - unlabeled answer rows;
    - labels only.
  - `tests/observation-would-store.test.ts`: the fixture uses the new shape, with collected one more than the answer,
    so the head is shown to count the answer.
  - `build-test/tests/judge-rows.test.ts`: fixture moved to the new shape.
  - `llm/node-tools/tests/replay-draft-loop.test.ts`: one new walker test. Each do-while pass observation carries its
    own pass's records, a straight read carries its own, and no evidence contains them.
  - Outside the named list: `R/flow-bootstrap/unfinished-build/tests/judged-wrong-rows.test.ts:35` had the same
    one-line store fixture and failed `fluxiq:check` (TS2353 `rows`) because of the contract change. I moved it to the
    new shape (one line). Revert it if another worker owns that file.

## Commands run and observed results

Run from `packages/fluxiq` unless noted.

- Fail-first:
  - Command: `npx vitest run R/result-verification/build-test/tests/stores.test.ts R/llm/node-tools/tests/replay-draft-loop.test.ts --testTimeout=120000`
  - Result before the source change: `Tests 7 failed | 33 passed (40)`.
  - The 6 new stores cases failed with `expected [] to deeply equal [ { …(7) } ]` or `expected undefined ...`.
  - The walker case failed with `expected [ [ 1, undefined, undefined ], …(4) ] to deeply equal ...`.
- After the change, the 4 changed test files gave `Test Files 4 passed (4)`, `Tests 47 passed (47)`.
- I ran every file in `R/result-verification/build-test/tests/`, `R/result-verification/tests/` and
  `R/llm/node-tools/tests/` four times:
  - Run 1: `Test Files 56 passed (56)`, `Tests 609 passed (609)`.
  - Run 2: `Tests 2 failed | 610 passed (612)`. Both failures were in `tests/repair-directive.test.ts`
    ("a result that kept nothing while its reads' conditions rejected rows"). They are another worker's fail-first
    tests (`keptNoneRowsRejected`, which did not exist yet), not my files.
  - Runs 3 and 4 added `judged-wrong-rows.test.ts`: `Test Files 57 passed (57)`, `Tests 616 passed (616)`, exit 0
    both times.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root):
  - First run: exit 1. Errors were `judged-wrong-rows.test.ts(35)` (fixed as above) plus other workers' in-progress
    files: `read-account/tests/looped-read.test.ts(112)` (TS2352) and `tests/repair-directive.test.ts`
    (TS2339 `keptNoneRowsRejected`, TS2379).
  - Second run: exit 2. Only `looped-read.test.ts(112,21)` TS2352 and `repair-directive.test.ts(282,38)` TS2379
    remained, and both are in files I do not own. No errors in any file I touched.
- `node scripts/build-cache/cli.mjs structure-audit:check` (Core root): `structure-audit: passed (276 warning(s), 349 baselined).`
  - File sizes: `stores.ts` 275 lines, `summary.ts` 484, `replay-span.ts` 499, `replay-draft.ts` 506.
  - Tests folders: `build-test/tests` has 15 entries; `node-tools/tests` has 25 (no new file).

## Not verified

- No Lab, browser or provider run: per the brief.
- I did not check whether the web domain's replay really sends `outputs.records` for a one-page read. That is the
  brief's premise. Without it every dataset falls back to labels only and `removed` is absent.
- `fluxiq:check` never went fully clean, because of other workers' in-progress files listed above.
- `now` defaults to `Date.now()`. Relative-date sorts and conditions in the test are measured from when the summary is
  built, and no test covers that path.

## Open questions or contradictions found

- **`R/llm/diagnosis-instructions.ts:157` (not mine, must not touch) still describes the old shape.** It says
  "rows, the count those steps' reads returned in this test, labels, every row in the order it would be stored, and
  repeated". The owner should change it to:
  - `passes`;
  - `collected`, the rows the reads returned on every page;
  - `answer.rows` and `answer.labels`, what the run's end keeps: each row once, then the read's own
    dedupe/where/sort/limit;
  - `removed {duplicates, filteredOut, cut}`, absent when the test could not make the answer from labels alone;
  - `keptNone`;
  - `repeated`, now computed on `answer.labels`.

  "Answer no when it would store a row twice" should then apply to `repeated` (design 5.1).
- **`passes` is not reset by `replace`.** It counts every answer that filled the dataset, so for a replacing loop,
  `passes: 2, collected: 3` means the last page only. The contract says "How many answers ... filled it", and I read
  that as the total.
- **Behaviour change in `replace`.** A replacing step with no readable answer no longer clears the dataset. The old
  code cleared once at the step itself. Now `replace` clears only before each batch it writes, as the run's dataset
  store does. No existing test depended on the old behaviour.
- **One schema and `process` per dataset.** The first writer's are used for the whole dataset. Design P3 says every
  writer to one dataset must declare the same `process`, so I did not check whether the writers disagree.
- The design (5.1) proposed a per-row identity digest on the observation. The brief chose the raw stored `records` as
  an internal member instead, and I followed the brief.
