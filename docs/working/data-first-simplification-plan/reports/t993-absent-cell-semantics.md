# t993: a captured-but-absent cell reads as "not shown"

Worker report, 2026-11-23. Brief: `briefs/t993-absent-cell-semantics.md`, with the lead's three later messages: the scope addition for the result-feed sweep failures, the step 5 addendum, and the step 5 correction. Trees: `fxwork/t993/!FluxIQ` (Core 6318fac88 plus edits) and `fxwork/t993/!FluxIQWebExtension` (12b440d16 plus edits). No git mutation. No provider or paid call.

## Outcome

Done, with one stated limit (Open questions 1).

- **The fix.** In automatic processing, an absent or blank cell of a field the row's own read captured is now a definite "not shown". Missing evidence remains for a field the read never captured, and "unreadable" is unchanged. Saved processing is unchanged.
- **The proof.** t990's job-board recorded read passes with `easilyApply contains "Easily apply"` and no `present` test. 3 of 3 reads were admitted, 35 rows collected and 7 kept. The oracle matched 7/7 in column order, with 0 model, provider and external calls.
- **The sweep failures.** All four of the lead's result-feed failures are fixed: automatic.test, two storage tests, and service.test 5/5.

## What changed and why

**How "captured" reaches the evaluator (step 1).**
- The row validator (`contracts/src/record-sets/validate-records.ts`) omits a field a row does not state, whether undefined or null. It keeps `""`, which `cellText` reads as no value. So the row alone cannot tell "not shown" from "never read".
- `processAutomationStudioRecordRows` held only the merged schema. So the batch's field list is now carried explicitly, as the brief allowed.
- The answer-first feed already keeps each page's own stored schema (`schemas`, keyed by `page.source`, which is the row's `batchKey`). The extension's read declares that schema from the dispatch's record output (`webListReadRecordSchema`), not from row values.

**Core contracts** (`packages/contracts/src/record-sets/process/`):
- `captured-fields.ts` (new, exported): `automationStudioRecordCapturedFields(schema)` gives the include fields. It never gives exclude or encrypt fields, which the validator never keeps on a row.
- `not-shown.ts` (new, internal): `automationStudioRecordNotShown(values, captured, field, derive)`. It is true when the field, or a derived column's stored `from`, is in `captured` and the row states no value for it. With no `captured` it is always false.
- `process-rows.ts`:
  - `AutomationStudioRecordCollectedRow` gains optional `captured`.
  - In automatic mode, a not-shown cell produces no missing evidence in the filters, the sort key check or the columns check. It sorts last through the existing sort, and the answer omits it as an empty cell.
  - The header documents this.
- `readiness/filters.ts`:
  - A condition over a not-shown cell takes the saved verdict (`automationStudioRecordConditionHolds`): present is false, absent is true, every text, number and date test is false, and `not` inverts as before. A date bound never keeps a row it cannot date, so a negated date bound is still false.
  - `anyOf` follows its members.
  - A `compare` with a not-shown side takes the saved verdict too, which is false whatever `not` says.
- The barrel exports `captured-fields.ts`.

**Core fluxiq:**
- `result-feed/feed.ts`: the automatic `evaluate` rows carry `captured` from each page's own schema, and none when that page has no schema.
- `completion/check.ts`: a cause found through service.test.
  - With a declaration in force and only a look holding rows, the processing refusal ran first and said "processing_schema_missing / no retained schema". That is a consequence, and it hid the `take` that fixes it.
  - The empty-result refusal (`answer_first.result_empty`, naming the look and `take`) now runs first.
  - It only applies when the result's own output pages kept no rows, so a filtered-to-nothing or missing-evidence answer still gets its processing refusal.
  - The achieved state is still reset whenever readiness is missing evidence.

**Tests that pinned superseded behaviour, each updated with the reason in a comment:**
- `result-feed/tests/automatic.test.ts`:
  - "withholds rows…" pinned a captured-but-absent `promoted` flag as missing evidence. It now expects the definite no and a ready answer (this brief). The sort/unreadable half is unchanged.
  - The amendment test now expects that a step without a record output is left unchanged. This follows t984 (e2b1f2635), which writes an automatic declaration only into an existing record output. It then gives the step a `settings.recordOutput` and checks that the canonical declaration lands there.
- `result-feed/tests/storage.test.ts`, two tests: since t982 (3b85dd9d0, P1 retained schemas), a publication's summary carries its stored schema and its `process` names its displayed `columns`. The expectations now say so.
- `result-feed/tests/service.test.ts`, all 5 tests: a new data task needs a processing declaration (t984: omission is neither legacy nor N/A). Each scripted attempt now passes `taskProcessing: { process: {} }`, which truthfully states "List every loan on my library account."

**New tests:**
- `contracts/.../process/tests/not-shown.test.ts`, 13 tests:
  - The captured list.
  - contains, equals, present, absent, `not` contains, a number bound, a date bound and a negated date bound, each a definite verdict with a ready answer.
  - anyOf, compare and a derived column.
  - Sort last plus an empty column.
  - A field never captured by one batch: missing evidence naming `read/early` for where, sort and columns.
  - Unknown `captured`: still missing.
  - Unreadable `waived` and `[withheld]`: still unreadable.
  - Saved mode: identical with or without `captured`.
- `fluxiq/.../result-feed/tests/not-shown.test.ts`, 2 tests through the real feed:
  - A captured tag absent on some rows gives a ready answer.
  - A page whose retained schema lacked the field gives `processing_evidence_missing` naming `at source early` and not the later page. Both pages use the same read version: a read with different asked fields is a new step version, which drops the old pages.

**Versions:** `@fluxiq/contracts` 0.23.0 → 0.23.1 and `fluxiq` 0.54.0 → 0.54.1. Both have `publishConfig` and are not private.

**Docs:** Core `docs/architecture/retained-records.md` gains a paragraph on the rule, its exceptions, and the run-dataset store limit below.

**Downstream:** `packages/test-runner/src/recorded-attempt-replay/read-oracle/declarations.ts`. The job-board fixture drops `{ field: "easilyApply", is: "present" }` and keeps the instruction's words only. The comment cites t993.

**Proof input (step 5).** t990's tree and its `test-runs/t990-*` were gone, so I rebuilt the input from the originals:
- `lab-runs/2026-11-20/run-mwov5v61-01468cd3` → `test-runs/t993-evidence/run-mwov5v61-01468cd3`.
- `fxwork/t959/.../campaign-a/.attempt-work/run-mwov5v61-01468cd3/fluxiq-root` → `test-runs/t993-evidence/store-mwov5v61`.
- `diff -rq` showed both copies identical, and the originals were not touched.
- Input file: `test-runs/t993-oracle/remote-mwov5v61.json`, with project `15dc518c-…`.
- Steps: `0014`, `0024`, `0034`. t990's report gives no step numbers for job-board, only "unfiltered p1-p3". These are the run's three `dom-extract_list` calls with no `where`, separated by next-page clicks.

## Commands run and observed results

All heavy commands ran through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- …`, one at a time.

- **Reproduce** (before my fixes): `npx vitest run result-feed/tests/automatic.test.ts result-feed/tests/storage.test.ts` (parallel group). 3 failed, the same 3 as the sweep.
- **Contracts process tests:** `npx vitest run src/record-sets/process --maxWorkers=1 --minWorkers=1 --fileParallelism=false`.
  - First run: 1 failed. My test helper's default parameter swallowed an explicit `undefined`; I fixed the helper.
  - Then: 16 files passed, 323 passed.
- **Result-feed, parallel group:** `node ../../scripts/vitest-groups.mjs --groups=parallel <result-feed/tests> …`.
  - First run: 12 of 14 files passed, 96/98 tests. The two failures were the old `promoted` pin and my wrongly built two-version feed test; both are fixed.
  - Rerun of the 3 changed files: 3 files, 20/20.
- **service.test, real-sql group.**
  - After the declaration fix: 4/5. The remaining failure is the completion-order cause above.
  - After the check.ts fix, run as `--groups=parallel,real-sql completion/tests result-feed/tests/service.test.ts`:
    - parallel: 12 files, 65/65;
    - real-sql: service.test 5/5. `completion/tests/judge-continues-decider.test.ts` failed 1/1 ("expected 0 to be greater than 0"). That test already fails in the same way in the 2026-11-23 sweep (`core-test-clean.txt` line 7951), it is not one of my listed files, and I did not touch it.
- `pnpm --filter @fluxiq/contracts check` → exit 0.
- `pnpm --filter fluxiq check` → exit 0, no `error TS`.
- **Core structure audit:** `node scripts/structure-audit.mjs` → exit 0, "structure-audit: passed (569 warning(s), 903 baselined)". Two advisory line warnings fall on files I touched, both already past the 400-line threshold: `process-rows.ts` (414 → 430) and `feed.ts` (503 → 509). I did not run `structure:baseline`, since I removed no violation.
- **Core build:** `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` → exit 0.
- **Proof:** `node scripts/lab/run-lab.mjs recorded-read job-board --task job-board-remote-easy-apply --input test-runs/t993-oracle/remote-mwov5v61.json --out test-runs/t993-oracle/remote-mwov5v61-r<N>.json`.
  - The prelude rebuilt test-contracts, scenario-lab, domain, extension, browser-host, test-evidence and test-runner.
  - r1: `recorded_read_fixture_receipt_mismatch`. My copied run folder was named `run-mwov5v61`, which does not match the entry's runId, so I renamed it.
  - r2: `{"passed":true,"phase":"done","gap":null}`.
    - Reads 0014, 0024 and 0034 were all admitted, with the control passed.
    - Readiness: ready. Declaration rewritten: none.
    - Account: collected 35, left out 28, repeats 0, kept 7.
    - Filters: `location equals "Remote (UK)"` left out 4; `easilyApply contains "Easily apply"` left out 27 (17 by it alone); `salary is present` left out 1 (alone).
    - Oracle verdict passed: 7/7 matched, 21/21 fields, column order matches, expectedInCollected 7.
    - modelCalls 0, providerCalls 0, externalCalls 0, fullAttemptAccepted false.
  - The report is `test-runs/t993-oracle/remote-mwov5v61-r2.json` and the log `test-runs/t993-logs/oracle-remote-r2.log`. Both are ignored.
- **Read-oracle owner tests:** `node --test --test-concurrency=1 dist/recorded-attempt-replay/read-oracle/tests/{collect,command,model-aliases,snapshot-gateway}.test.js` → 9/9 pass.

## Not verified

- Live behaviour, and any full suite (none run, per the brief).
- Only one job-board run was proven (mwov5v61). The other two runs t990 used, mwp1e5oc and mwoi785f, were not rebuilt.
- The run-dataset store's automatic end-of-run path. Its behaviour is unchanged and still conservative; see Open questions 1.
- The downstream structure audit and the downstream package checks, beyond the Lab prelude's builds (which typecheck test-runner through `tsc`).
- `judge-continues-decider.test.ts`, which already failed in the sweep and is left to t994.

## Open questions or contradictions found

1. **The run-dataset store's automatic answer still withholds over not-shown cells.**
   - `persistence/automation/project/run-dataset-answer/answer.ts` processes stored rows in automatic mode when the stored process carries a declaration stamp.
   - The store keeps only the dataset's reconciled schema, not each batch's (`run_dataset_batches` has no schema column, and its `evidence_json` is a strict evidence shape with the read's asked `fields`, not the retained schema). So it cannot tell captured from never captured, and it supplies no `captured`.
   - Rows there keep the old "missing evidence" reading, and the end-of-run answer can be `processing_evidence_missing` while the feed says ready. A saved Flow's later attempts are where this shows.
   - Proposed fix: store each batch's stored field ids, as a new `run_dataset_batches` column written by `appendBatch`. Then pass them as `captured` in `answer.ts`. This needs a migration (0041), so it is the lead's call. I did not infer the list from row values or from the asked `fields`, whose keys can differ from retained ids.
2. **I changed `completion/check.ts`,** which sits outside result-feed, to fix service.test at its cause. t994 is working elsewhere in `packages/fluxiq`, so this file may need serializing if t994 touches it.
3. **Read-version semantics:** a read whose asked fields differ is a new step version that drops earlier pages. So in the feed, "never captured" arises only between pages of one read version whose retained schemas differ (the retained reader detected fewer fields on one page). The feed test models exactly that.
