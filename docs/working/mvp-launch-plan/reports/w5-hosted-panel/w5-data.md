# w5-data report (lane t901, W5 P3)

## Outcome
Done. The Data placeholder is replaced by a working Data screen.

## What changed and why
Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ/apps/web/src`:
- `app/(panel)/data/page.tsx` renders `DataPage`.
- `features/data/` (new): `model/` (types, shape-dataset-row, filter-datasets, dataset-flow-options, any-dataset-filter), `data/load-dataset-rows.ts`, `list/` (DataPage, DataView, DataFilters, DatasetsListRow, DatasetDetail), `data.css`, barrels, tests in `model/tests`, `data/tests`, `list/tests`.
- Reuses via barrels: `automation-studio/datasets` (getRunDatasetPage, RunDatasetTable, runDatasetDownloadHref, currentProgramDomainId, RUN_DATASET_PAGE_SIZE), `home/model`, `home/data` (useResource), `panel-shell` (PublishPanelPage).
- Design choice: a row is one table (Flow + dataset) as its newest run left it, from `list-project-datasets` (one paged call per project) rather than `list-run-datasets` per run (N calls for up to 200 runs per project). Older runs of the same table are not listed separately; the row shows the latest run, with a link to /runs/<runId>. If every run's dataset must be a separate row, that needs a per-run fan-out (`list-run-datasets`) or `list-dataset-runs`; not built.
- Detail opens in-page (state, no new route): rows via `get-run-dataset-page` with Load more, Export CSV / JSON as links to the existing `/api/programs/automation-studio/run-datasets/...` route with domainId. Styling uses `var(--border)`, `var(--danger)` only.

## Endpoints used
`projects` (GET), `list-project-datasets`, `list-flow-summaries`, `get-run-dataset-page`, download route. No missing endpoint; packages/** untouched.

## Commands run and observed
- `pnpm --filter @fluxiq/web exec vitest run src/features/data "src/app/(panel)"` -> 5 files, 18 tests passed (includes layout test and graph-host test).
- Re-run `vitest run src/features/data` after a lint fix -> 3 files, 11 tests passed.
- `pnpm structure:check` -> 7 violations, all in `apps/web/src/features/security/**` (not mine, W5 security lane). My first run had one swallowed-failure in DatasetDetail.tsx; fixed, no violation in features/data now.

## Not verified
- Not rendered in a browser; DatasetDetail (effects, load more, export links) has no test, only the list states are tested via static markup.
- apps/web typecheck not run (supervisor).
- Export link domainId is read in an effect, so first paint has no domainId until mount.

## Open questions
- Per-table vs per-run rows (see above).
