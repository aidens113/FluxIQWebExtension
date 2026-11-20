# t958: provisioning connections

## Outcome
Done (final confirmation run of the whole provisioning-listener test folder was queued at the gate when this was written; see "Not verified").

## What changed and why
Root cause: both platform `SQLiteRepository` instances were built with no connection pool, so every read or write opened, prepared (WAL pragma, create table) and closed a database; `put` was also get-then-put (two operations). Fix, in the Core tree `fxwork/t958/!FluxIQ`:
- `apps/web/src/server/provisioning-listener/platform-services.ts`: one `SQLiteConnectionPool` per platform composition, passed as `connections` to both repositories (they share `global.sqlite`); every function on the provisioning service (`run`, `runDueDeletions`, links, sign-in) runs in `pool.keepWhile`, which covers each request and each deletion-sweep pass; `closePlatformServices` calls `closeAll` after the sweep stops. `links` is the same wrapped service.
- `packages/fluxiq/src/platform/store/repository/platform-records.ts` and `.../iam/store/repository/records.ts`: `put` is one repository operation (no read first). The repository's own `put` already keeps an existing row's `createdAtMs` inside one statement, and nothing reads the envelope's created time back, so the port needed no change and no transaction.
- `packages/fluxiq/src/programs/database-manager/index.ts` (outside the listed paths, one line): exports `SQLiteConnectionPool` and `SQLiteConnector`, which the web app could not import before. Needed for the fix.
- `docs/architecture/platform.md`: "Connections" paragraph under Platform store.
- Tests: new `apps/web/src/server/provisioning-listener/tests/platform-services-connections.test.ts` (4 tests, real SQLite, counts opens and closes at the pool connector); new `packages/fluxiq/src/platform/store/tests/platform-records.test.ts` and `.../iam/store/tests/iam-records.test.ts` (put makes no get; SQLite keeps the creation time). Two existing web tests (`platform-services-cascade`, `platform-read-factories`) mocked `fluxiq/database-manager` with only `SQLiteRepository`; their mocks now keep the real module's other exports.
- AsyncLocalStorage scope through the provisioning SerialQueue: it survives (the continuation after `await previous` keeps the caller's context). Proven by the test that runs three overlapping `createAccount` calls: opens stay bounded and every open is closed. No change to `connection-pool.ts` was needed.

## Measured open counts
- After: one `createAccount` opens exactly 2 databases (`databases/global.sqlite`, `databases/domains/<ws>/domain.sqlite`), printed by a temporary log in the test (removed). Second account adds at most 3; closes equal opens after each run and after shutdown.
- Before: not measured live. The design note's static estimate is 21-27 (the "before" run was not repeated for lack of gate time). The identity service is in memory in the test, so the identity database's own opens are not counted either way.

## Commands run and observed results (all through the heavy-slot gate)
- `contracts:build sdk:build fluxiq:build` -> exit 0 (fluxiq rebuilt, 188 s).
- web `vitest run` of platform-services-connections + cascade -> 2 files, 6 tests passed.
- `vitest run src/platform/store src/platform/iam/store src/platform/provisioning` (fluxiq) -> before fixing a bad import path in my iam test: 34 files, 219 tests passed, 1 suite failed to load (my import path; fixed).
- `pnpm --filter fluxiq check` -> tsc ran, no errors (stamp stored, 99 s). `pnpm --filter @fluxiq/web check` -> tsc ran, no errors (80 s).
- `vitest run src/platform/store src/platform/iam/store` (fluxiq) -> 8 files, 66 tests passed (twice, the second after the import fix).
- `node scripts/structure-audit.mjs` -> first run 2 [imports] violations in my two new tests (reached into `../repository/*.ts`); fixed to import from the barrel; rerun: "structure-audit: passed (555 warning(s), 911 baselined)".
- `npx vitest related --run src/server/provisioning-listener/platform-services.ts` (apps/web) -> 101 files passed, 1 failed (2 tests): `platform-read-factories.test.ts`, whose mock lacked `SQLiteConnectionPool`. Fixed the mock; rerun of the whole `src/server/provisioning-listener/tests` folder plus `tsc --noEmit` was queued.

## Not verified
- The rerun after the `platform-read-factories` mock fix (queued at the gate, not yet observed when this report was written).
- "Before" counts by measurement; identity database opens; live behaviour on a real server; the commerce ledger (unpooled, out of scope here).

## Open questions or contradictions found
- Commerce (`compose-commerce.ts`, ledger) remains unpooled; the design's Worker C covers it after t953.
- `PlatformRecords.put` relies on the repository keeping `createdAtMs`; memory repositories do not, but nothing reads it back.
