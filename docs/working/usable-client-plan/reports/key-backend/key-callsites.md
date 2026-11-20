# Key callsites (t928, key-backend)

## Outcome
Partial: all 16 call sites fixed and fluxiq tests pass; the apps/web test could not run (stale Core dist).

## What changed and why
Rule: sites that unlock a session or test password custody now call `createPasswordSealedKey(service, {...same fields})` (import from `secret-keys/runtime/tests/secret-key-fixtures.ts`), which writes the pre-t928 record, so every assertion is unchanged. Sites on the real runtime drop the removed fields.
- `programs/_shared/tests/runtime-access-fixture.ts`: dropped `authorizationPassword` and `actorSession` (runtime has host protection). The unused `password` parameter stays.
- `programs/_shared/tests/runtime-model-access-push.test.ts`: dropped `actorSession` (same typecheck error, found by `check`).
- `programs/_shared/tests/runtime-credential-changes.test.ts` (2 sites), `runtime-session-revocation.test.ts` (2): `createPasswordSealedKey`.
- `programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts` (2): `createPasswordSealedKey` (uses unlock).
- `programs/identity-access/api/tests/handlers.test.ts` (1): `createPasswordSealedKey` (target session holds the key).
- `tests/anthropic-session-panel.test.ts` (4), `deepseek-session-key.test.ts` (1), `instance-leak.test.ts` (1), `model-provider-disabled-run.test.ts` (1), `session-key-provider.test.ts` (4): `createPasswordSealedKey`.
- `apps/web/src/lib/workspaces/tests/tenant-eviction.test.ts` (1): `createPasswordSealedKey`, imported by relative path into packages/fluxiq (precedent: core-contract-world.ts).

## Commands run and observed results
- vitest over the 12 changed/related files in packages/fluxiq: 12 files, 84 tests passed.
- vitest `src/programs/_shared/tests` after the actorSession edits: 20 files, 92 tests passed.
- `pnpm --filter fluxiq check`: only 3 errors remain, all `credential-unlock-proofs.test.ts` (79, 128, 192) "Expected 1-2 arguments, but got 3", in secret-keys (not mine). None in a file I own.
- `pnpm --filter @fluxiq/web check`: 0 `error TS` lines (log tail not read for exit code beyond that count).

## Not verified
- `tenant-eviction.test.ts` was not run: apps/web vitest refuses with "Core's library build is 141 minute(s) behind its source". Needs `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` first (shared Core dist, left to the lead).
- web check exit code not read.

## Open questions
- `runtime-access-fixture.ts` `createKey` still takes a `password` argument that is now ignored; tests passing a custom password (credential-unlock, result-check-authority) pass anyway.
- heavy-slot returned exit 127 once with no vitest output; a rerun worked.
