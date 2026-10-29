# t789-glue report (lane B1, hosted H1)

## Outcome
Partial: all four tasks done; one structure:check failure remains by design (the `fluxiq/platform` package export is the supervisor's to add).

## What changed and why
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ`.
- `packages/fluxiq/src/platform/provisioning/service/envelope-kind-repository.ts` (new): `createEnvelopeKindRepository(inner)`. Stores `{ envelopeKind, data }` as the row data, restores `kind` and `data` on get/list/put. `list` skips rows not in that shape; `get` throws a clear error naming the id (nothing of the row). It returns the scope that was asked for, because SQLiteRepository lower-cases the domain id and `IamRecords` compares exactly.
- `service/create-platform-services.ts`: options now take `repository` (platform rows) and a required, separate `iamRepository`, which is wrapped by the adapter for the platform IAM store and every workspace store. I made `iamRepository` required (not optional) so SQLite callers cannot fall back to the broken shared-repository shape. Memory callers pass the same object for both (`tests/provisioning-fixture.ts` now does).
- `service/index.ts`: exports the adapter.
- `provisioning/tests/sqlite-services.test.ts` (new, `// @fluxiq-test-group real-sql`): two real `SQLiteRepository` in a temp dir, real `IdentityAccessService` (weak scrypt), `MemoryEmailSender`. createAccount over http with sendWelcome, then token from the memory sender, `links.redeemWelcome`, `identity.authenticate({username: email, password})` succeeds, then new services over the same files: a second createAccount with the same email answers `exists` (which also proves the provisioner is still allowed).
- `service/tests/envelope-kind-repository.test.ts` (new): adapter restores kind/scope when the inner stamps its own kind; skips/refuses foreign rows.
- `platform/index.ts`: `export * from "./provisioning/index.ts";`. No duplicate export names arose (tsc clean), so no renames.
- `provisioning/cli/main.ts` (new, not in the barrel): `fluxiq accounts ...`. Data root from `--data-root`, else `FLUXIQ_ROOT`, else cwd. `FluxIQ.create`, SQLite repos kinds `platform.store` / `platform.iam` under `paths.databases`, `FileEmailSender` into `<fluxiq>/platform/outbox` unless `FLUXIQ_EMAIL_SENDER=none`, persistent audit (`BufferedIamAuditSink` over `IamAuditStore` at `<fluxiq>/platform/iam-audit.sqlite`, flushed and closed at exit). Prints the offline warning to stderr when the in-process transport is built. Uses `selectAccountsTransport` and `runAccountsCommand`.
- `apps/web/src/server/provisioning-listener/platform-services.ts` (new): `getPlatformServices()`, WeakMap-keyed by `getFluxIQ()`, the same composition, a failed composition is not cached. Imports `fluxiq/platform` and `fluxiq/database-manager` (the latter already exists).

## Decisions to confirm
- Single-tenancy workspace id: no docs I could find name one ("parity-workspace" is only the parity default; the test fixture uses "workspace-main"). I used `"workspace-main"`, overridable by `FLUXIQ_WORKSPACE_ID`, in both main.ts and platform-services.ts. Change the constant if B2/H1 docs fix a different id.
- Audit: B2 provides a persistent sink (`IamAuditStore` + `BufferedIamAuditSink`), so both entries use it; no MemoryIamAuditSink in production paths.
- The composition is duplicated between main.ts and platform-services.ts because `platform/` must not import `programs/` and the web app can only use public exports. A shared helper could take repositories as arguments if wanted.

## Commands run and observed results (from packages/fluxiq unless noted)
- `pnpm test src/platform/provisioning`: parallel 12 files / 75 tests passed; real-sql 1 file / 1 test passed.
- `pnpm test src/platform` (both groups): parallel 33 files passed, 1 failed (2 tests, `iam/catalog/tests/live-registry.test.ts`, the known CRLF checkout diff, not touched); 328 passed / 330. real-sql 4 files / 17 tests passed.
- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p .`: no output, clean (run after the final edits).
- root `pnpm structure:check`: one FAIL left, `[package-exports] apps/web/src/server/provisioning-listener/platform-services.ts: loads "fluxiq/platform", but packages/fluxiq/package.json exports no "./platform"`. Everything else passes (earlier failures in main.ts, deep imports and a dropped rejection, were fixed).

## Not verified
- apps/web typecheck, and platform-services.ts at runtime (blocked on the `./platform` export and a Core build of dist).
- `main.ts` was typechecked but never executed (no CLI run against a data root; no server).
- I did not run the SQLite test against the old code to watch it fail.
- No live browser, no Lab, no model calls.

## Open questions
- Single-workspace id (above).
- Supervisor to add to `packages/fluxiq/package.json` exports: `"./platform": { "types": "./dist/platform/index.d.ts", "import": "./dist/platform/index.js" }` and decide how `fluxiq accounts` is launched (main.ts is an entry only).
