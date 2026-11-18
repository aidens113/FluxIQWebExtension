# Pre-existing Core test failures before t915 (CORE = fxwork/t915/!FluxIQ)

## Outcome
Done. Every listed failure now passes on t915. No migration was renumbered: there is no ID collision. "On dev" below comes from git ancestry and source at 04e7b1650. No dev tree was created.

## Per failure
1. **Persistence, 11 files / 34 tests** (keyring, durable-removal, object-addresses, object-address-backfill, administration, store-legacy-rows, store-persistence, rekey interruption/durable-removal/migration/rotation). Fails on Core dev: **yes**. Introduced by t909 `9167d7141` (adds `0037_dataset_snapshots` to `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`, administration.ts:154) and `35e75a9f1`. The second commit switched the production stores to `automationStudioSchemaMigrationOrder`, which sorts the set by ID, but left the tests stale.
   - Cause: three test fixtures still build `[...ADMINISTRATION, 0030|0033]` by hand (keyring-fixture.ts:32, store-legacy-rows.test.ts:53, migrated-project.ts:144). 0033 follows 0037 in that list, so `validateMigrations` throws (schema-migrations.ts:293). The fixture then never released its lease, so the temporary-root `rm` hit EBUSY.
   - Two invariant tests also still asserted the old rule that extension migrations sort after the administration head (administration.test.ts EXTENSIONS, store-persistence.test.ts:106).
   - Fix: the fixtures now compose with `automationStudioSchemaMigrationOrder`, the same way the stores do. `openTestProject` now releases its lease and pool when the open fails. The administration invariant now checks what the composed design actually needs:
     - each extension ID is distinct from every administration ID;
     - on a database already at the administration head, the extension's older migration applies, and the ledger holds every ID once.
   - The trace invariant keeps "IDs of its own" and "chunks after traces".
   - Existing stores are unaffected. The runner records applied migrations by ID with a checksum and applies whatever is missing in any order (`compose.test.ts` proves this). No production code changed.
2. **flow-base.test.ts** (unmarked real SQLite). Fails on Core dev: **yes**. Introduced by t909 `595bb2b71`, which moved task-memory writes to `programJsonDocumentTransaction`. That opens `.document-locks/*/global.sqlite`. store.test.ts got the real-SQL marker in that commit, but flow-base.test.ts did not. Fix: add `// @fluxiq-test-group real-sql` on line 1. Reproduced first: "opened a real SQLite database 6 time(s) ... without the real-SQL marker".
3. **node-handles-load-order.test.ts**. Fails on Core dev: **yes**. The test has not changed since `5449a7768`; it fails even when run alone on t915 (5 of 8 timed out).
   - Cause: the file statically imported nothing, so the whole cold transform of `bootstrap-completion.ts`'s graph (transform 27 s for this file alone) ran inside the first 15 s test. `vi.resetModules()` in `beforeEach` then re-evaluated the graph in all 8 cases (about 3.5 s each when warm).
   - Fix (structure, timeout unchanged): one test file per load order, with static imports in the order under test, so each graph loads once at collection like any other test file. The 4 cases live in the support module `tests/node-handles-load-order.ts`, which imports none of the graph.
   - After: 8 of 8 pass, tests take 14 ms in total.
4. **apps/web: 4 tests**. Fail on Core dev: **no**; all were introduced by t914. Each one is a stale expectation of a deliberate t914 change:
   - operational-routes: `6ba2e1f29` moved io/io-validate onto held tenant authority (`withWorkspaceRouteJson`/`workspaceRouteContext`). The test now asserts that path. It also checks that the route context decides through `authorizeAppRoute`, and setup's direct check is kept.
   - app-route-iam-service (2): `c564c2b3a` moved GET members/audit to `withWorkspaceAccountRead`. That path refuses a bearer caller with 403 "This endpoint is not available to a paired client." (routes/context.ts:20), not 401. The test now expects exactly that for those two routes, and 401 for the other seven.
   - conversation-architecture: `79f175d2a` removed the `asksTotp` prop. The test now expects `<GlobalClientGatewayPairing />`.

## Commands run and observed results
- Before the fix: `npx vitest run src/framework/persistence/automation` → 101 of 105 files completed before my 900 s shell timeout. Exactly the 11 files above failed.
- After: the 11 persistence files plus flow-base (13 files) → `Test Files 13 passed, Tests 69 passed`. The task-memory/tests folder → 5 files, 50 passed. The plan/tests folder → 2 files, 8 passed.
- t914 web run: the same 4 tests failed (reproduced).
- t915 web run: 3 files, 37 passed. The changed web folders (app/api/tests, app/api/framework/tests, conversation/tests) → 6 files, 99 passed. These web runs used a scratchpad copy of apps/web's vitest config without its stale-dist guard; see Not verified.
- `pnpm --filter fluxiq check` → exit 0 (build-cache reuse, inputs matched the stamp).
- `pnpm --filter @fluxiq/web check` → exit 0 (tsc ran).
- `node scripts/structure-audit.mjs` → exit 1. Both violations are in another worker's untracked `programs/automation-studio/api/handlers/across-projects/tests/across-projects-iam.test.ts` (`as never`; a barrel import). None are in my files. It also printed "2 baseline entries can be lowered"; .structure-baseline.json was not touched.

## Not verified
- The web tests could not run under the real config. Core's dist is older than `packages/contracts/src/iam/actions.generated.ts`, which another worker is editing (new studio list actions). Rebuilding dist would disturb that worker and the :3000 panel, so I ran against the 12:44 dist instead. operational-routes and conversation-architecture read source only. app-route-iam-service uses dist, but its subjects do not include the new actions.
- Real-SQL files were run by path, which gives the guard's 60 s timeout per marked file. They were not run under `vitest-groups --groups=real-sql`: that group ignores paths and runs all 447 files.
- Not checked: whether the load-order test still catches the t358 regression. The harness barrel no longer re-exports those constants, so no mutation was tried.
- Core dev was not run. The "on dev" verdicts come from ancestry and source.
