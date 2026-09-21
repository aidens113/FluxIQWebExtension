# PANEL-002 Storage-Layout Diagnosis

Status: Diagnosed
Date: 2026-09-20
Worker: `w2-panel-storage-layout`
Scope: read-only diagnosis of project creation failing with
`Program document transactions require FluxIQ storage layout v2`

## Result

PANEL-002 is primarily a **panel launch-initialization defect**, with a
secondary **missing operator UI/recovery path**. It is not evidence that the
user's project data needs to be reset.

The panel can construct a v2 runtime while the importer root is completely
fresh, but it does not call `FluxIQ.setup()` before authentication performs the
first durable write. That first write creates the v2 `global.sqlite`; because
`config.json` was never committed, later storage inspection calls the same root
v1. Automation Studio nevertheless retains the v2 artifact path selected when
the runtime was constructed. Project creation then opens a document
transaction at that v2 path, walks upward for a valid v2 `config.json`, cannot
find one, and emits the reported error.

No source, runtime state, process, migration, or test was changed or run.

## Current layout evidence

Only known-path metadata was inspected; no SQLite rows, project documents,
credentials, recordings, or other private `.fluxiq` content were read.

- Importer root: the paired t027 downstream checkout.
- `.fluxiq` exists.
- `.fluxiq/config.json` does not exist.
- `.fluxiq/.migration/v2/journal.json` and `.fluxiq/migration.lock` do not
  exist, so this is not an interrupted migration.
- `.fluxiq/global.sqlite` exists (28,672 bytes, last changed during the current
  panel session).
- The known legacy `data`, `databases`, and `recordings` roots do not exist.
- The running t027 panel process was observed and left untouched.

The current on-disk state is therefore an **uncommitted fresh-v2 bootstrap**:
one v2 database was created before the v2 config commit marker. The current
inspection implementation has no name for that state and reports any nonempty
root without the marker as v1.

## Code trace

1. `framework/index.ts:144` treats both `fresh` and `v2` as v2 when constructing
   paths. It selects `config.json` at line 156 and
   `artifacts/automation-studio` at line 169, then immediately constructs the
   program runtime at line 176.
2. `_shared/runtime.ts:38-56` infers layout v2 from that config *path name*, not
   from an existing committed config. It consequently gives Identity Access
   and Automation Studio v2 repositories.
3. `instrumentation.ts:6-9` only loads the host module. It does not create and
   set up the runtime. `lib/fluxiq.ts:102-105` creates it lazily on the first
   request.
4. Framework setup is implemented and idempotent for a genuinely fresh root
   (`framework/index.ts:316-325`), but nothing invokes it during panel launch.
5. After login writes `global.sqlite`, `storage-layout.ts:58-70` sees state but
   no valid config and reclassifies the root as v1/migration-required.
6. Automation Studio project creation uses `ProgramJsonStore.transaction` at
   `runtime/service.ts:4450-4466`. The transaction requires a v2 marker
   (`_shared/storage.ts:127-129`); its resolver rejects a missing or non-v2
   config (`_shared/storage.ts:227-249`). This is the exact throw site.
7. A protected inspect/setup/migrate API already exists at
   `app/api/framework/setup/route.ts:6-38`, but all three operations are
   explicitly `api-only` in `operational-route-contract.ts:14-16`. Automation
   Studio provides neither launch preflight nor a supported migration/setup
   prompt.

## Safe fix path

### Product fix (recommended)

Initialize storage before the web server accepts a request:

1. Add an awaited, process-wide `initializeFluxIQWebRuntime()` in
   `apps/web/src/lib/fluxiq.ts`.
2. Have `apps/web/src/instrumentation.ts` await it after loading the host
   module.
3. Create the runtime once, inspect its initial state, and call `setup()` only
   when it is genuinely `fresh`; confirm v2 before allowing authentication or
   other writes.
4. For v1 or `migration_incomplete`, fail closed for ordinary writes and expose
   an actionable operator state. Never auto-migrate existing storage at
   startup.
5. Guard initialization with one promise so development reloads cannot race
   two setup attempts.

This closes the causal gap without weakening the transaction invariant.

### Existing t027 state

Do not reset or delete `.fluxiq`. The framework migration route is designed to
commit `config.json` last and reload the runtime. In this exact metadata state,
the migration implementation finds no legacy roots, leaves the already-present
root `global.sqlite` in place, and commits the v2 marker. However, the framework
currently mislabels this accidental state as ordinary v1 and does not explicitly
validate an uncommitted-v2 database before that cutover.

The safest recovery is therefore either:

- first add a narrowly validated `uncommitted_v2` recovery path, then invoke it
  through the protected setup endpoint; or
- after a recoverable backup and supervisor review, use the existing protected
  `migrate` action and verify login/project persistence immediately afterward.

The second path is non-destructive by the present code trace, but it should be
treated as an operator recovery, not automatic launch behavior.

### Product UI

Add a storage-readiness screen/banner driven by the existing inspect endpoint:

- `fresh`: ordinarily invisible because launch setup completes it;
- `v1`: explain migration, require an authorized operator action, and preserve
  rollback/recovery details;
- `migration_incomplete`: show resume/rollback guidance;
- `v2`: allow Automation Studio.

Project creation should never surface the raw transaction invariant as its
only guidance.

## Implementation ownership

Smallest launch fix and coverage:

- `F:/fxwork/t027/!FluxIQ/apps/web/src/lib/fluxiq.ts`
- `F:/fxwork/t027/!FluxIQ/apps/web/src/instrumentation.ts`
- `F:/fxwork/t027/!FluxIQ/apps/web/src/lib/tests/fluxiq.test.ts`

If formal recovery of the already-created uncommitted-v2 state is included:

- `F:/fxwork/t027/!FluxIQ/packages/fluxiq/src/framework/storage-layout.ts`
- `F:/fxwork/t027/!FluxIQ/packages/fluxiq/src/framework/storage-migration.ts`
- their existing `framework/tests/` coverage
- `F:/fxwork/t027/!FluxIQ/apps/web/src/app/api/framework/setup/route.ts`

Operator UI ownership belongs under `apps/web/src/app/`; changing the current
API-only disposition also requires
`apps/web/src/lib/operational-route-contract.ts` and its tests.

## Focused live retest

1. Use an isolated, empty importer root and start the real panel.
2. Before login, verify by metadata that `config.json` exists and declares v2.
3. Complete first-user setup/login, create an Automation Studio project, and
   verify the project opens without a transaction-layout error.
4. Reload the browser and restart the panel; verify the same project is listed
   and opens.
5. Separately launch against an isolated v1 fixture. Verify startup does not
   auto-migrate it, the UI presents the operator action, authorized migration
   preserves the fixture, and the reloaded runtime is v2.
6. Repeat with an interrupted-migration fixture and verify explicit
   resume/rollback guidance rather than ordinary writes.

This live path comes before narrow tests. After it passes, run only the focused
web runtime/setup and framework storage-migration tests, then defer the full
suite to the integration boundary.

## Compatibility risks

- Never infer that every marker-less nonempty root is safe to initialize; real
  v1 data must still require explicit migration.
- Startup setup must not follow external storage overrides or migrate them.
- Development instrumentation can run more than once, so initialization must
  be idempotent and serialized.
- The config marker is the commit boundary. Writing it before repository state
  is compatible would falsely convert a legacy root to v2.
- A recovery path for the present accidental state should validate the v2
database shape without reading or exposing application rows.
