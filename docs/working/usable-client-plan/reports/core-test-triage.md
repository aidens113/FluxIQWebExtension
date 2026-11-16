# Core test triage for t915 (CORE = fxwork/t915/!FluxIQ, baseline = fxwork/t914/!FluxIQ)

## Outcome
Done. Two failures were caused by t915 and are fixed (plus one stale test in a forbidden folder, below). Everything else is pre-existing on t914 or transient. The "Failed to load url zod" mass failure did not reproduce (transient).

## Commands and results
- Note: `--maxWorkers=4` alone fails ("minThreads and maxThreads must not conflict"); needs `--minWorkers=1 --maxWorkers=4`.
- packages/fluxiq: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <46 changed source dirs> --minWorkers=1 --maxWorkers=4`
  - parallel: 921 files, 920 passed, 1 failed (7801 tests passed). No zod load failures.
  - real-sql: 447 files, 13 failed (40 tests). The real-sql group ignores the path filter and runs every marked file.
- apps/web: `vitest run src/features src/app/product src/app/api "src/app/(panel)"` = 392 files, 8 failed (70 tests); rerun of those 8 = 7 failed; after fixes see below.
- After fixes: product/layout, core-contract, core-chat-transport = 3 files, 66 tests passed.
- `node scripts/structure-audit.mjs` = passed (550 warnings, 914 baselined). `pnpm --filter fluxiq check` = exit 0.

## Classification
Pre-existing on t914 (same failures run there):
- node-handles-load-order.test.ts: 3 of 8 tests time out at 15s on both trees (cold import under load).
- flow-base.test.ts (unmarked real SQLite): fails on t914 identically.
- 11 persistence files under framework/persistence/automation/project (keyring, content-address, gateway-trace, gateway-trace-rekey, administration): 34 tests fail on t914 with "Automation Studio migrations must have unique, ascending IDs" plus EBUSY unlink. t915 did not touch persistence.
- web: operational-routes.test.ts, app-route-iam-service.test.ts, conversation-architecture.test.ts (4 tests) fail identically on t914.

Transient (failed under concurrent load, pass alone on t915): whole-process.test.ts (5 failed in the group run, 16/16 pass alone, 359s), model-provider-disabled-run.test.ts, managed-hosts.test.ts. app/api/programs/.../route.test.ts failed once and passed on rerun.

Caused by t915, fixed:
1. core-contract.test.ts (58) and core-chat-transport.test.ts (8): t915's `installPairedProjectFocus` calls `clientGateway.projectFocus.setAuthority`, but the test world's gateway fake had no `projectFocus`. Fix in `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts`: `contractRegistry` hands the fake a `projectFocus.setAuthority` stub. Passes.
2. app/product/tests/layout.test.tsx: t915's `app/layout.tsx` now always declares icon `/fluxiq-mark.svg`; the test's expected metadata updated to match (intended behavior, not weakened).

Caused by t915, NOT fixed (forbidden folder app/(panel), in flight with UI workers):
- `apps/web/src/app/(panel)/tests/layout.test.tsx` line 28 expects the task-automation preset pages `["home","flows","runs","security","settings"]`; t915's preset is now `["home","projects","flows","runs","chats","security","settings"]`. Update that expectation.

## Not verified
- Real-sql group was not rerun in full after the fixes; no fix touched packages/fluxiq. The pre-existing migration-ID failure was not investigated (outside t915).
- web files outside the folders run (e.g. e2e) not run.

Outcome: Done
Changed: apps/web/src/app/product/tests/layout.test.tsx, apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts
Validation: scoped fluxiq groups and web runs as above; `pnpm --filter fluxiq check` -> exit 0; `node scripts/structure-audit.mjs` -> passed
Not verified: full real-sql rerun after fixes; the (panel) layout test fix
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/core-test-triage.md
