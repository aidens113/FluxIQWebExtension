# t520 Windows SQLite long paths

Status: implemented and source/tests frozen for supervisor independent verification. No commit, merge, push, build, broad typecheck/audit, live/browser/provider run or process management was performed by this worker.

## Change

Only two files changed in paired task Core `fxwork/t520/!FluxIQ`, branch `task/t520-windows-sqlite-long-paths`:

- `packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts`: pass `path.toNamespacedPath(filePath)` at both native sqlite3 constructors (read/write/create and pinned existing read-only). Logical repository/database paths, directory creation, pool keys, schemas and persisted values retain ordinary form. POSIX behavior is unchanged by the Node path function. No public contract or downstream source dependency.
- Its adjacent `tests/sqlite-repository.test.ts`: port the greater-than300-character workspace regression, explicitly create the parent and assert it is empty before opening. Assert write, fresh repository reopen/read, existing-read-only read and expected sole database file. The journal-mode test helper also normalizes its native open, so the helper cannot independently reproduce the fixed subject defect.

The bounded source repair is the generic two-file portion of historical t518 `e60bfbe0`; no recording conversion code, terminal runtime contracts, fixtures, t518 docs or generated data were imported. Instructions-first bootstrap, subflow listing/saving and recovery graph creation reach the same generic repository independently of retired recording approval. Full ownership/evidence is in `codex-continuation-recovery-triage.md`. Supervisor owns generic storage architecture documentation.

## Observed checks

From task Core `packages/fluxiq`, BEFORE production source edits:

```powershell
pnpm.cmd exec vitest run src/programs/database-manager/storage/tests/sqlite-repository.test.ts -t 'writes, reopens and reads existing storage beneath a long workspace path'
```

Observed fail-first:1 failed,8 skipped; native `SQLITE_CANTOPEN: unable to open database file`. This used a new generic OS-temp directory with an existing empty parent, not user/runtime data.

After the two constructor changes:

```powershell
pnpm.cmd exec vitest run src/programs/database-manager/storage/tests/sqlite-repository.test.ts src/programs/database-manager/storage/tests/connection-pool.test.ts
```

Observed PASS:13 tests across2 files (9 repository,4 pool),1.95s. `git diff --check` passes; task status contains only the two owned modified files.

## Limits

Current Windows native failure and both repository native opening paths are exercised by the regression. POSIX was not executed on this Windows host. Existing exact264-character private-copy proof is historical t518 evidence, not rerun here; this regression uses entirely generic new temp state. No instruction-created live build/repair was launched. Supervisor must run the final independent owning checks, touched package typecheck, structure audit, narrow public-library rebuild and integration before qualification uses the fix. No approval endpoint was restored and no retry/oracle/authority guard was relaxed.
