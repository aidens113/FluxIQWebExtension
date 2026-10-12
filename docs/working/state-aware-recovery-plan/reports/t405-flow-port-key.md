# t405 — Flow port key: report

## Outcome

Done. `flow_ports` is now keyed `(flow_id, port_id)` by a new Core migration
`0024_scoped_flow_port_keys`; t404's case (two parts both declaring
`output: cart`) now applies through the real candidate path. Nothing committed.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t405/!FluxIQ`, under
`packages/fluxiq/src/programs/automation-studio/`:

- `storage/project/schema/flow-port-keys.ts` (new): migration
  `0024_scoped_flow_port_keys`. It rebuilds `flow_ports` the same way
  `0024_runtime_run_interrupted_status` rebuilds `runtime_runs`: copy the rows,
  drop the table, recreate it with the same columns in the same order plus
  `primary key (flow_id, port_id)`, copy the rows back unchanged, then recreate
  `flow_ports_flow_direction_name_uq` and the two `fk_flow_ports_flow_id_*`
  guard triggers. The old key implied the new one, so no row can be refused.
  The id sorts after `0024_runtime_run_interrupted_status` and before `0025`,
  because the stores that append `0025`–`0028` after the administration set
  need the ids ascending. `0002` is left unchanged, since its checksum is in
  every existing ledger.
- `storage/project/schema/index.ts`: exports the new migration.
- `storage/project/administration.ts`: imports it and appends it to
  `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`, as the last entry.
- `storage/project/flow-resource-repository.ts`: no change needed. Its only
  reader (`readFlow`: `where flow_id = ?`) and only writer (`replacePorts`:
  `delete ... where flow_id = ?`, then insert with `flow_id`) already address
  ports by Flow.

Tests:
- `storage/project/schema/tests/flow-port-keys.test.ts` (new): checks that the
  pre-migration table's SQL equals the literal old DDL, which is held in the
  test. It shows that the old key refuses `cart` on a second Flow. After the
  migration it checks:
  - the rows are identical;
  - the index and trigger names and SQL are identical;
  - the copy table is gone;
  - the primary key is `flow_id`, `port_id`, and the column order is unchanged;
  - `cart` is accepted on the second Flow;
  - a repeated `(flow, id)` pair is refused, and so is a repeated name in the
    same direction;
  - a port on a missing Flow is refused;
  - a second migration run applies nothing.
- `storage/project/tests/flow-resource-repository.test.ts`: new case. Two
  Flows, and two Subflow graphs of one automation (owned by real `subflows`
  rows), are saved with the same port ids and read back after reopening.
  Re-saving one Flow replaces only that Flow's ports.
- `storage/project/schema/tests/runtime-run-interrupted-status.test.ts`: its
  "is the last of the project migrations" assertion now checks that the
  migration is in the set and sorts between `0024_run_dataset_answers` and
  `0025`. It is no longer the last entry.
- `runtime/service/flow-bootstrap-commands/tests/same-named-part-outputs.test.ts`
  (new): t404's case. A script with parts `first` and `second`, each declaring
  `output: cart`, goes through `acceptAutomationStudioFlowBootstrapResult`,
  `validateAutomationStudioFlowBootstrapPlan`, `createFlowBootstrapAdaptation`,
  then approve and apply on a real `AutomationStudioService`. The test then
  reads project SQL and expects two distinct graph Flows that each own an
  output port `cart`. `assemble.ts` is untouched.

## What refers to `port_id` (confirmed from code)

- `flow_ports` is read only by `readFlow` and written only by `replacePorts`
  in `flow-resource-repository.ts`. `flow-resource-mutations.ts`,
  `graph-store.ts` and `compiled-plan-store.ts` never touch it.
- `graph_edges.source_port_id` / `target_port_id` name node ports. They are
  not Flow interface ports and have no link to `flow_ports`.
- Subflow `input_mapping_json` / `output_mapping_json` and the Call Subflow
  `inputs` / `outputs` parameters are JSON keyed by name. No SQL relationship
  points at `flow_ports`.
- `accepted-state/validation.ts` matches ports per Flow (`unique(resource[key])`
  within one Flow). Its `id()` check is a format check, not a project-wide
  uniqueness check.
- No other table holds a trigger or guard against `flow_ports`.
- Migration mechanism: `storage/schema-migrations.ts` provides
  `AutomationStudioSchemaMigrationRunner`. It keeps a checksummed ledger,
  requires ids in ascending order, and runs each migration in one
  transaction.

## Commands run and observed results

All commands were run in `C:/Users/osrs_/FluxStuff/fxwork/t405/!FluxIQ/packages/fluxiq` unless noted.

- Before the fix:
  `npx vitest run .../flow-bootstrap-commands/tests/same-named-part-outputs.test.ts`
  → 1 failed:
  `SQLITE_CONSTRAINT: UNIQUE constraint failed: flow_ports.port_id`. This
  reproduces t404.
- After the fix:
  `npx vitest run src/programs/automation-studio/storage/project src/programs/automation-studio/storage/tests src/programs/automation-studio/runtime/service/flows src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/applied-parent.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/same-named-part-outputs.test.ts src/programs/automation-studio/runtime/tests/authored-call-subflow src/programs/automation-studio/runtime/flow-bootstrap/authoring`
  → `Test Files 78 passed | 2 skipped (80)`,
  `Tests 622 passed | 4 skipped (626)`.
- The first run failed in `flow-port-keys.test.ts` only, because SQLite
  stores `CREATE TABLE` in upper case. The test's whitespace normalization
  now also lowercases. On rerun, `storage/project/schema` → 3 files passed.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  → exit 0, no output.
- From the Core root:
  `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`
  → `structure-audit: passed (317 warning(s), 1160 baselined).`

## Not verified

- No full suites were run, per the brief.
- No live run.
- The migration was not run on a real user project database. The test builds
  the old schema with the real earlier migrations and checks it against the
  literal old DDL.
- Downstream (extension) checks were not run. No downstream code changed.

## Open questions or contradictions found

- `flow_variables.variable_id` and `flow_errors.error_id` have the same defect.
  Each is the table's sole primary key, so the same variable id or error code
  on two Flows would collide the same way. `writeSqlFlowMetadata` writes
  `errorId: error.id`, which makes `flow_errors` collide whenever two graph
  Flows declare the same error id. This was out of scope and is not fixed.
  The same migration pattern applies.
- The t404 test lives in `runtime/service/flow-bootstrap-commands/tests/`,
  beside `applied-parent.test.ts`, which uses the same apply path. The brief
  forbids writing under `runtime/flow-bootstrap/**`, and a `storage/` test
  importing the service would invert the layering.
- Core `docs/working/automation-studio-scalable-data-architecture-plan.md`
  mentions `flow_ports`. I did not read or update it. The supervisor should
  decide whether it needs a note.

## Second pass (coordinator follow-up): variables and errors

The coordinator asked for the two sibling defects to be fixed in the same
migration. The migration has not been committed anywhere, so it was widened
and renamed instead of adding a second `0024_*` id. Some names in the sections
above are now out of date:

- `schema/flow-port-keys.ts` was replaced by `schema/flow-scoped-keys.ts`.
- The migration id `0024_scoped_flow_port_keys` is now `0024_scoped_flow_keys`.
  It still sorts after `0024_runtime_run_interrupted_status` and before `0025`.
- The export `AUTOMATION_STUDIO_PROJECT_FLOW_PORT_KEY_MIGRATION` is now
  `AUTOMATION_STUDIO_PROJECT_FLOW_SCOPED_KEY_MIGRATION`, renamed in
  `schema/index.ts` and `administration.ts`.

What the migration does now:
- It rebuilds three tables: `flow_ports`, `flow_variables` and `flow_errors`.
  Each is now keyed `(flow_id, <id>)`.
- All rows are carried over unchanged, with columns in the same order.
- Each table's unique index is recreated: `flow_ports_flow_direction_name_uq`,
  `flow_variables_flow_name_uq` and `flow_errors_flow_code_uq`.
- Each table's `fk_<table>_flow_id_insert` and `fk_<table>_flow_id_update`
  guards are recreated.
- The statements are generated from one small table description, so the three
  rebuilds cannot drift apart.

Readers and writers were confirmed: `replaceVariables`, `replaceErrors` and
`readFlow` already address these rows by `flow_id`. No other code touches
the three tables.

Tests:
- `schema/tests/flow-port-keys.test.ts` was replaced by
  `schema/tests/flow-scoped-keys.test.ts`. It runs the same old-DDL migration
  checks on each of the three tables. The literal old DDL for all three is
  held in the test.
- The repository test now also saves variable `count` and error
  `error.blocked` on two Flows and on two Subflow graphs, and reads them back
  after reopening.

Commands re-run (same set as above):
- vitest → `Test Files 78 passed | 2 skipped (80)`,
  `Tests 622 passed | 4 skipped (626)`.
- `tsc --noEmit` → exit 0.
- Structure audit → `structure-audit: passed (317 warning(s), 1160 baselined).`

The open question about `flow_variables` and `flow_errors` above is resolved.
