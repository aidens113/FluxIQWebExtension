# Week 2 Uncommitted-v2 Adoption

Status: implemented and live-validated in isolated paired task t028  
Date: 2026-09-20  
Worker: `w2-uncommitted-v2-adoption`

## Outcome

Core now distinguishes an interrupted fresh-v2 bootstrap from legacy v1 and
provides one explicit, offline recovery function:
`adoptUncommittedFluxIQStorage()`. It validates the stopped root and database,
writes only the missing `config.json` commit marker, and never runs from setup,
migration, or panel startup.

The user's `.fluxiq` root and port-3000 panel were not accessed or changed.
All fixtures were disposable roots below `F:/fxlab/`; isolated panel ports 3320
and 3321 are stopped. The work is uncommitted for supervisor review.

## Provenance

- Downstream task/worktree: `F:/fxwork/t028/!FluxIQWebExtension`
- Core task/worktree: `F:/fxwork/t028/!FluxIQ`
- Shared branch: `task/t028-uncommitted-v2-adoption`
- Downstream base: `c0a62a5d153a2bc0d5afb7544971911effec29e5`
- Core base: `b6a7057b79d756d57c6d6fa7166cb3243a316f0d`
- Browser: headless Chromium through the real Next.js panel

## Implementation

Core changes:

- `packages/fluxiq/src/framework/storage-layout.ts`
  - recognizes only an unambiguous marker-less v2 top level as
    `uncommitted_v2`;
  - leaves `layoutVersion` null until the v2 marker is actually committed;
  - keeps journal, legacy, ambiguous, and unknown roots out of that class.
- `packages/fluxiq/src/framework/uncommitted-v2-adoption.ts`
  - exports the explicit standalone recovery function;
  - requires a regular root `global.sqlite` and only the clear v2 directories
    `artifacts`, `cache`, `logs`, `security`, and `tmp`;
  - rejects external overrides, SQLite sidecars, symbolic links, unknown paths,
    legacy/ambiguous roots, and migration state;
  - opens SQLite read-only with `immutable=1`, runs `quick_check`, and requires a
    recognized FluxIQ global table;
  - hashes the database before and after validation and aborts if it changed;
  - rechecks the top-level inventory immediately before atomically writing only
    `config.json`.
- `packages/fluxiq/src/framework/index.ts`
  - exports the recovery function;
  - resolves recognized uncommitted-v2 paths as v2, but setup refuses the state
    with explicit recovery guidance.
- `packages/fluxiq/src/framework/storage-migration.ts`
  - refuses to misroute this state through v1 migration.
- `packages/fluxiq/src/framework/tests/uncommitted-v2-adoption.test.ts`
  - covers byte preservation, exact marker-only success, and no-write failures.
- `docs/operations/data-and-state.md`
  - documents stopped-host backup requirements, the explicit API, accepted
    state, rejection rules, returned hash, and required restart.

No web startup or route invokes adoption. An operator must import and call the
public function explicitly while every host process is stopped.

## Live-first evidence

### Authentic fixture creation

1. Created a new isolated importer root and committed its normal v2 marker.
2. Started the real Next.js panel on port 3320.
3. Used Chromium to sign in with the bootstrap account, replaced the temporary
   password through the rendered secure-first-setup form, then signed in again
   with the replacement password.
4. Confirmed the real panel displayed the workspace and Automation Studio.
5. Stopped the isolated panel, confirmed the port was no longer listening, and
   removed only the fixture's `config.json` marker.

The resulting reproduction contained `security/` and a 40,960-byte root
`global.sqlite`, with no marker.

### Explicit adoption and restart

The final implementation reported `uncommitted_v2`, adopted the fixture, then
reported `v2`. The only added top-level entry was `config.json`.

On the first authentic fixture, the database SHA-256 was identical before and
after adoption:

`099F096E3E9C9676C713AF820DCCF963718FCEE93BCC61F0FED43873461B1A95`

After the panel restarted, Chromium signed in using the replacement password;
the login returned HTTP 200, did not return to secure-first-setup, and displayed
the workspace and Automation Studio. No response at HTTP 500 or above was
observed.

After adding recognized-schema validation, a second clone of that authentic
fixture was adopted with the final code. Its then-current database hash was
identical before and after:

`7222918165A6DBB3577027C4E684CEACAD62212AE35010FF9E04BBFBAE733E68`

The panel restarted on port 3321 and the same Chromium login again returned 200
and displayed the workspace and Automation Studio without any 5xx response.

### Live no-write rejection matrix

Each failure fixture was snapshotted recursively by path, type, byte length,
and SHA-256 before and after the call.

| Fixture | Result | Filesystem unchanged | Marker absent |
| --- | --- | --- | --- |
| legacy `data/` root | rejected as v1 | yes | yes |
| migration journal | rejected as incomplete | yes | yes |
| unknown top-level file | rejected as v1 | yes | yes |
| ambiguous `domains/` root | rejected as v1 | yes | yes |
| malformed `global.sqlite` | rejected by SQLite | yes | yes |

An early exploratory invocation attempted adoption through a constructed
`FluxIQ` instance. SQLite produced zero-length WAL/transient SHM sidecars in
that isolated fixture, and the fail-closed inventory rejected it before writing
a marker; the database hash was unchanged. The API was consequently kept as a
standalone recovery function so validation occurs before normal runtime
services exist. The disposable sidecars were removed only after the isolated
panel was confirmed stopped and the WAL was confirmed empty.

## Focused checks after live proof

- `pnpm --filter fluxiq test -- src/framework/tests/uncommitted-v2-adoption.test.ts`
  - passed: 1 file, 8 tests.
- `pnpm --filter fluxiq check`
  - passed.
- `pnpm --filter fluxiq build`
  - passed.
- `pnpm structure:check`
  - passed with existing baseline/advisory warnings only.
- `git diff --check`
  - passed.

No full test suite was run, matching the live-first brief.

## Supervisor integration notes

Core has six scoped changed/untracked files listed above; downstream has only
this report. The runtime-initialization task remains a separate dependency:
after both are integrated, startup will refuse `uncommitted_v2` without
mutation or adoption, while the offline function supplies the explicit repair.

Do not run this operation against the user's current root without separate
explicit approval, stopped-host confirmation, and a verified private backup.
This task implemented and tested the seam only; it did not authorize or perform
the user's recovery.
