# Week 2 Panel Existing-Root Recovery

## Status

Read-only diagnosis complete. No source, tests, branches, processes, or runtime
state were changed. The panel listening on port 3000 was not stopped or
restarted. No database rows, credentials, tokens, or private `.fluxiq` file
contents were read.

## Current metadata inventory

Observed at `F:\fxwork\t027\!FluxIQWebExtension\.fluxiq` using existence and
file-size metadata only:

| Item | Observed |
| --- | --- |
| root | present |
| `config.json` | absent |
| `.migration/v2/journal.json` | absent |
| `migration.lock` | absent |
| `migration-history.json` | absent |
| root `global.sqlite` | present, 28,672 bytes |
| `global.sqlite-wal` / `global.sqlite-shm` | absent |
| `artifacts` / `domains` / `legacy` | absent |
| legacy `data` / `databases` / `recordings` | absent |
| `security` | present (contents not inspected) |
| TCP port 3000 | listening |

Core's current inspector classifies any non-empty marker-less root as `v1`.
That classification is technically deterministic but semantically inaccurate
here: this is an **uncommitted fresh-v2 bootstrap**, created when authentication
wrote the v2 root-level `global.sqlite` before `config.json` existed. It is not
the documented v1 layout.

## Official Core operations versus this state

| Operation | Contract result | Recovery suitability |
| --- | --- | --- |
| normal `FluxIQ.setup()` | Refuses the inspector's migration-required state | Correctly prevents further mutation, but cannot recover it |
| `fluxiq.migrateStorage()` / authenticated setup `action: "migrate"` | Accepts the state because the inspector calls it v1 | Happy path is likely to retain the existing root database and commit v2, but this anomalous state is not fully modeled or validated |
| resume `migrateStorage()` | Applies only after a migration journal exists | Not currently applicable |
| `rollbackStorageMigration()` | Currently returns no rollback because there is no journal | Unsafe as a general fallback if a new migration fails after archival; see below |
| fresh-root initialization | Applies only to a genuinely empty root | Not applicable and must not be forced |

`migrateStorage()` searches for legacy databases below `databases/global.sqlite`
and an active-domain legacy location, not the root-level v2 `global.sqlite`.
During cutover, however, it leaves a destination in place when there is no
staged replacement. Therefore the expected successful path is to leave the
existing root database untouched, write `config.json` last, write migration
history, and clean up the migration journal and lock.

That does **not** constitute a fully safe official recovery contract for this
case. The migration does not establish that the pre-existing root database has
the expected schema before adopting it. More importantly, pre-commit rollback
removes root `global.sqlite`, `artifacts`, and `domains` before restoring the
archived legacy roots. It assumes those root destinations were promoted by the
migration. In this anomaly, `global.sqlite` predates migration and contains the
authentication state to preserve. If migration reaches the archived phase and
then fails before `config.json`, automatic rollback can delete that database.

## Recovery decision

There is no presently implemented operation that both explicitly recognizes
this exact state and provides Core's normal non-destructive/reversible
guarantee. Do not call setup, migrate, rollback, reset, or copy state while the
current panel is running.

The robust official fix should be a purpose-built **uncommitted-v2 adoption**
path in Core. It should:

1. recognize a marker-less root containing only allowed v2-owned paths;
2. reject any migration journal, legacy source roots, or external override
   ambiguity;
3. validate database schema metadata without reading application rows;
4. record that the root database was pre-existing, never promoted;
5. atomically write the v2 marker and recovery history without moving or
   replacing the database; and
6. make rollback incapable of deleting pre-existing destinations.

Until that seam exists, the existing migration is only a contingency, not a
guaranteed non-destructive recovery. If it must be used, the safe operational
sequence is:

1. Obtain explicit user approval for downtime, a private-state backup, and the
   storage mutation.
2. Stop the port-3000 panel and confirm all SQLite handles are closed.
3. Take a recoverable offline backup of the complete `.fluxiq` root, including
   any SQLite sidecars that exist then, and verify that the backup can be
   restored. Keep it private and outside source control.
4. From the stopped host, inspect again and run `migrateStorage()` with the
   exact importer root and domain configuration.
5. If migration fails, do **not** invoke automatic rollback blindly. Preserve
   the failed-state evidence and restore from the verified offline backup, or
   review the journal and paths before any manual recovery.
6. Restart only the updated panel runtime, then validate login, project
   creation, and a second stop/restart cycle.

Using authenticated `POST /api/framework/setup` while the panel and database
are live is not recommended for this anomaly. The runtime-initialization repair
will refuse this marker-less non-empty root at startup, so recovery must be
completed before the repaired panel is restarted against it.

## Expected metadata transitions on the existing migration happy path

| Phase | Expected metadata |
| --- | --- |
| before | root `global.sqlite`; no marker, journal, lock, or history |
| migration | `migration.lock` and `.migration/v2/journal.json`; staging/archive metadata may appear |
| commit | existing root `global.sqlite` remains; `config.json` is written last; `migration-history.json` is written |
| complete | inspector reports v2; journal/lock are absent; legacy archive may exist |

After recovery, verification must confirm a valid v2 marker, no incomplete
journal or lock, continued login with the existing user, project creation, and
login/project availability after restart. Database contents must be verified
through supported panel behavior, not by exposing rows.

## Approval boundary

**Explicit user approval is required before execution.** The required operation
would stop the user's server, create a private backup of runtime state, and
mutate the storage layout. The current read-only brief and prior permission to
host/test the panel do not authorize those actions. No recovery operation was
executed in this task.

## Sources inspected

- Core `packages/fluxiq/src/framework/storage-layout.ts`
- Core `packages/fluxiq/src/framework/storage-migration.ts`
- Core storage migration and setup tests
- Core `docs/operations/data-and-state.md`, Storage Migration
- Week 2 PANEL-002 storage-layout and runtime-initialization reports
