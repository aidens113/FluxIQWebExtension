# t957: two stale Core tests

## Outcome
Done. Both failures were stale tests; the product is right in both. Only two Core test files changed.

## What changed and why
1. `packages/fluxiq/src/programs/tests/global-secret-keys.test.ts`: expected a version 2 (scrypt, password) seal.
   Since t928 (merged `9c7ba4524`; `value-sealer.ts` `sealForHost`, types.ts `EncryptedSecretValueRecordV3`) every saved
   key is host-sealed: AES-256-GCM under a random data key held only as the record's `hostProtection`, with no
   password, KDF or acting-user hint. v2 now only comes from credential changes and seal upgrades of older keys.
   So v3 is right for a freshly created key. The test now asserts: version 3 and aes-256-gcm; iv, tag and
   ciphertext are strings; kdf, kdfParams, salt and sealedByUserId are absent; ciphertext does not contain the
   plaintext; `hostProtection` is present. The reveal-needs-TOTP assertions are untouched.
   The old v2 content checks (N=131072 params, sealedByUserId) no longer apply to a v3 seal and are covered by
   the v2 tests (e.g. credential-changes.test.ts).
2. `apps/web/src/features/chat-widget/tests/core-chat-transport.test.ts`: the empty list now expects
   `{ conversations: [], unreadableProjects: [] }`. `unreadableProjects` was added in c5f6f511c and is always
   returned by `listConversationsForRequest` (`conversation-requests/list.ts`): it names each project whose store
   could not be read and why, so a short list is never mistaken for a whole one. `[]` is the right value for a
   fixture whose only project reads fine.

## Commands run and observed results
- `heavy-slot run t957-t -- npx vitest run <both files>` -> 2 files passed, 5 tests passed.
- `pnpm --filter fluxiq check` -> FLUXIQ_EXIT=0
- `pnpm --filter @fluxiq/web check` -> WEB_EXIT=0
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (555 warning(s), 911 baselined)."

## Not verified
No product file changed, so no folder-wide or `vitest related` runs. The install and build setup was already
present in the worktree and was not re-run.

## Open questions
None. Nothing committed.
