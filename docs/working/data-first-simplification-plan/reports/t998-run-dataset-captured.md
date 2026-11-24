# t998: the run dataset's end-of-run answer reads captured-but-absent cells as "not shown"

Worker report, 2026-11-23. Brief: `briefs/t998-run-dataset-captured.md`. Trees: `fxwork/t998/!FluxIQ` (task/t998-run-dataset-captured, at dev 27e8fabc9) and `fxwork/t998/!FluxIQWebExtension` (this report only). No git mutation. No provider or paid call. Only temporary databases were used.

## Outcome

Done.
- **Write.** Migration 0041 stores each batch's captured field ids. They come from that batch's own stored schema at write time, never the dataset's reconciled one.
- **Read.** The end-of-run automatic answer passes them to each of the batch's rows as `captured`.
- **Agreement.** The store's answer equals the answer-first feed's answer on the same rows for a captured tag some items do not show. A test drives the real feed and the real store.
- **Unchanged cases.** A batch written before 0041 has a null list and still withholds. A batch from before the schema grew keeps its own narrower list and withholds, naming that batch.
- **Version and schemas.** `fluxiq` is now 0.54.2 (dev was 0.54.1). No public schema changed and no contracts file changed.

## What changed and why

**Migration 0041** (`persistence/automation/project/dataset-captured-schema/`, new, following 0040's pattern):
- `migration.ts`: `0041_run_dataset_captured_fields` runs `alter table run_dataset_batches add column captured_fields_json text`. Null means unknown, which is the pre-0041 case.
- `index.ts`: the barrel.
- `administration.ts` registers it after 0040.

**Write** (`run-dataset-store.ts` `appendBatch`): the batch insert and its on-conflict update write `captured_fields_json`.
- The value comes from `run-dataset-schema/captured-fields.ts` (new): `automationStudioRunDatasetCapturedFieldsJson(schema)`, which applies contracts' `automationStudioRecordCapturedFields` (include fields only) to the batch's own stored schema.
- The derivation lives beside the other batch-schema helpers, not in the store, so the store stays within its 800-line budget. Its diff is net 0 lines: 7 changed.
- The two identical-retry early returns are unchanged. An exact retry of a pre-0041 batch keeps its null.

**Read:**
- `processDataset`'s existing left join selects `b.captured_fields_json`. A row whose batch is missing gets null.
- `run-dataset-answer/types.ts`: `AutomationStudioRunDatasetCollectedRow` gains optional `captured_fields_json`.
- `run-dataset-answer/captured-fields.ts` (new): `automationStudioRunDatasetCapturedFields(stored)`.
  - Null or undefined gives `undefined`, meaning unknown, so the rows keep missing-evidence semantics.
  - A stored value that is not JSON, or not a list of strings, throws. The store writes this column itself, so such a value is corruption. It fails closed rather than reading as unknown. The structure audit's `failure-as-empty` rule flagged my first version, which returned `undefined` there.
- `run-dataset-answer/answer.ts`: each row gets its batch's list as `captured`. Each list is parsed once per batch. Nothing is inferred from other batches or from values.

**Tests:**
- `run-dataset-answer/tests/captured-fields.test.ts` (parallel group): a list, an empty list, null and undefined read as unknown, and corrupt values throw.
- `dataset-captured-schema/tests/migration.test.ts` (real-sql): migrates an existing `run_dataset_batches` fixture holding a legacy row. It runs twice (idempotent), and the legacy row ends with a null list and its other columns intact.
- `tests/run-dataset/tests/captured.test.ts` (real-sql, three tests):
  1. The stored list is `["id","title","tag"]` (the excluded field is left out). Tag present, absent and blank across rows give a ready answer of `[Atlas]`.
  2. Pre-0041: one batch's list is set to null, and a second batch keeps its list. The answer is not ready. The evaluator over the store's own selected rows names `tag missing` at batch `shelf`, row 1, and only that row: the other batch's untagged row is not shown, not missing.
  3. Schema growth: the lists are `early ["id","title"]` and `late ["id","title","tag"]`. The answer withholds, naming only `early`. A complete fresh pass with the grown schema then makes it ready.
- `framework/tests/run-dataset-feed-agreement.test.ts` (real-sql):
  - It drives the answer-first result feed (rows validated as the row sink validates them) and the run-dataset store with the feed's own stored bound declaration.
  - Both answers are ready, and the store's retained answer rows equal the feed's rows (`Atlas`, `Dunes`).
  - It imports `answer-first/**` only through its barrels and touches no source there. It sits in `framework/tests/`, the nearest directory holding both subjects.
- Updated tests that pinned superseded behaviour, each with a comment:
  - `tests/run-dataset/tests/automatic.test.ts`, "atomically invalidates…": the amended condition was `promoted equals true, not` over a row whose batch captured `promoted`, which is now a definite "not shown". The missing evidence now comes from an unreadable price (`ask` under `price atMost 5`), and the repair is `$2`. The test's intent is unchanged.
  - `tests/run-dataset/tests/store.test.ts` "installs migration 0019's batch table…": `pragma table_info(run_dataset_batches)` now lists `captured_fields_json`. Its legacy-database fixture also leaves out 0041, as it already leaves out 0019, 0024, 0036 and 0040 (0041 alters `run_dataset_batches`, which that fixture never creates).

**Docs:** Core `docs/architecture/retained-records.md` now replaces t993's "the run-dataset store … still withholds" sentence with the 0041 column, how it is written and read, and the pre-0041 case.

**Version:** `packages/fluxiq/package.json` is now 0.54.2.

## Commands run and observed results

All heavy commands ran through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- …`, one at a time, from `packages/fluxiq` unless noted. Logs are in the session scratchpad (`t998-*.log`).

- **First run of the touched files:** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <touched files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`.
  - parallel: 2 files, 3/3.
  - real-sql: 7 of 8 files passed, 50/51. The failure was store.test's exact column list, which now includes the new column; I updated it.
- **Second run:** store, schema and administration tests. 1 failed: store.test's legacy fixture ran 0041 on a database with no `run_dataset_batches`. I added 0041 to that fixture's exclusion list, as 0040 already was.
- **Third run:** `--groups=real-sql store.test.ts` → 1 file, 34/34.
- `pnpm --filter fluxiq check` (Core root) → exit 0, 0 `error TS`.
- **First structure audit:** `node scripts/structure-audit.mjs` → exit 1, "3 violation(s) across 3 rule(s)", all three mine:
  - `failure-as-empty` in `run-dataset-answer/captured-fields.ts`;
  - `file-lines`: `run-dataset-store.ts` at 805 lines, over 800;
  - `imports`: the agreement test reached into persistence files instead of the barrel.
  - Fixes: fail closed; move the derivation to `run-dataset-schema/captured-fields.ts` (the store is back to 800 with a net-0 diff); import from `persistence/automation/project/index.ts`.
- **Second structure audit** → exit 0, "structure-audit: passed (569 warning(s), 903 baselined)". These are the same counts as before t998. `pnpm structure:baseline` was not run, since I removed no baselined violation.
- **Final run of every touched file** in both groups (captured-fields, reference-time, both migration tests, captured, automatic, store, retained-rows, exclusions, schema, administration, the agreement test):
  - parallel: 2 files, 4/4;
  - real-sql: 10 files, 70/70;
  - "[vitest-groups] all groups passed: parallel, real-sql".
- **Final** `pnpm --filter fluxiq check` → exit 0, 0 `error TS`.

## Not verified

- A live run, a saved Flow's real later attempt, and the four-attempt acceptance itself. They need a paid round.
- Full suites (none run, per the brief).
- Migration 0041 on a real user database (never touched). It was exercised only on temporary fixtures and fresh test databases.
- Other callers of `appendBatch`, such as the dataset service and carry-on copies, were not tested. They inherit the write through the one insert path, but no test of mine drives them.

## Open questions or contradictions found

1. An exact retry of a batch written before 0041 returns early from `appendBatch`, so its list stays null and its rows keep withholding. This follows the brief ("a batch written before 0041 has no list") and is minimal. A complete fresh pass, or any non-identical retry, writes the list.
2. A corrupt stored list now throws inside `processDataset`. The dataset service treats processing as best-effort, so the dataset reads as its collected rows. That is deliberate fail-closed behaviour on corruption of a column the store writes itself.
3. The agreement test is in `packages/fluxiq/src/framework/tests/`, outside the owned paths but under the rule that a test with several subjects goes in the nearest directory containing them all. It changes no `answer-first/**` source.
