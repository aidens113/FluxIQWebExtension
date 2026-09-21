# PANEL-002 Runtime Initialization

Status: Implemented and live-validated in isolated t027-storage pair
Date: 2026-09-20
Worker: `w2-panel-runtime-initialization`

## Outcome

The Core web panel now initializes a genuinely fresh FluxIQ store to layout v2
before authentication or program writes can occur. Initialization is serialized
through one runtime-owned promise. Legacy v1 and incomplete-migration stores
fail startup with an actionable error and are not modified.

The change remains uncommitted in the isolated Core worktree for supervisor
review. No downstream source changed, no user `.fluxiq` was accessed, no
migration was run, and no full suite was run.

## Provenance

- Downstream frozen commit: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Core frozen commit: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`
- Core worktree: `F:/fxlab/t027-storage/!FluxIQ`
- Live importer roots: isolated disposable roots under `F:/fxlab/`; never the
  t027 authoring root or user's panel storage
- Browser: headless Chromium through the real Next.js panel
- Panel: Next.js development server on isolated ports 3317-3319; client gateway
  disabled for this storage-focused lane

## Implementation

Changed only the brief-owned Core files:

- `apps/web/src/lib/fluxiq.ts`
  - added `initializeFluxIQWebRuntime()`;
  - stores a single `initializationPromise` on the global runtime state;
  - invokes `FluxIQ.setup()` only when inspection is exactly `fresh`;
  - verifies that setup reached v2;
  - refuses v1 and `migration_incomplete` rather than migrating;
  - applies the same readiness check when reloading a runtime.
- `apps/web/src/instrumentation.ts`
  - awaits full runtime/storage initialization before Next.js serves requests.
- `apps/web/src/lib/tests/fluxiq.test.ts`
  - covers concurrent fresh initialization and non-mutating refusal of legacy
    and incomplete layouts.

## Live-first evidence

### Fresh empty root

1. Started the real panel against a new empty isolated importer root.
2. Before login, metadata showed `.fluxiq/config.json` already present with
   `version: 2`, `layoutVersion: 2`, and `createdBy: fluxiq`.
3. Used the rendered panel to sign in with the bootstrap account, replace its
   temporary password, and configure its security PIN.
4. Opened Automation Studio through the panel, created a project, and observed
   the project workspace.
5. Reloaded the browser and observed the same project.
6. No API response at HTTP 500 or above was observed.

Result: **passed**.

### Real panel restart

1. Stopped the isolated Next.js panel cleanly.
2. Restarted it against the same isolated importer root.
3. Signed in through Chromium, opened Automation Studio, found the saved
   project in the project browser, and reopened it.
4. No API response at HTTP 500 or above was observed.

Result: **passed**.

### Legacy v1 refusal

1. Started the panel against an isolated marker-less root containing only a
   controlled legacy `data` sentinel.
2. Instrumentation refused startup with `found v1` and migration guidance.
3. Port 3318 had no listener after refusal.
4. No config marker or global database was created; the sentinel was unchanged.

Result: **passed; preserved without migration**.

### Incomplete migration refusal

1. Started the panel against an isolated root containing a controlled v1
   sentinel and an inventory-stage migration journal.
2. Instrumentation refused startup with `found migration_incomplete`.
3. Port 3319 had no listener after refusal.
4. No config marker or global database was created; journal stage/id and the
   sentinel were unchanged.

Result: **passed; preserved without resume, rollback, or migration**.

Two early Chromium driver attempts failed on incorrect test-driver selectors,
and one inline invocation failed on shell quoting. They occurred before the
relevant product action and were corrected without a product retry being
classified as success.

## Focused checks after live pass

- Built only the packages needed for the web test resolver:
  `@fluxiq/contracts`, `fluxiq`, and `@fluxiq/client-gateway-websocket` — passed.
- `pnpm --filter @fluxiq/web test -- src/lib/tests/fluxiq.test.ts` — passed,
  16 tests.
- `pnpm --filter @fluxiq/web check` — passed.
- The first focused-test invocation failed before collection because the
  isolated worktree had no built `fluxiq` package entry. The narrow package
  builds resolved that environment prerequisite; it was not a product failure.
- Full suites were intentionally not run.

## Supervisor integration notes

Core has exactly three modified tracked files listed above. Downstream remains
clean in the isolated pair. The supervisor should review that failing panel
startup for v1/incomplete is the desired interim operator experience; this
brief intentionally did not implement the migration UI. After integration,
the user's existing uncommitted-v2 t027 state still needs the separate safe
recovery decision from the PANEL-002 diagnosis—it must not be reset or treated
as a fresh root.
