# install-core-c5 (t707): a new key is usable in the current sign-in

## Outcome

Done. The suspected cause was right, and it had a sibling cause: rotating or editing a key also locked it until the next sign-in. Both are fixed in the Secret Keys service and its API handlers. No web route needed a change.

## Cause (file:line, before the fix)

- `packages/fluxiq/src/programs/secret-keys/runtime/service.ts:268`: `unlockSession` derives keys only for the records that exist at sign-in (`store.sealedFor(userId)`). At sign-in, `apps/web/src/app/api/auth/login/route.ts:97` calls it with the cookie session id, the user id, the password and the session's expiry. On a first run there are no keys yet, so the session unlock holds nothing.
- `service.ts:114-115`: `createKey` seals the new value under the password just verified, then zeroes the derived key at once (`key.fill(0)`). It never gives the key to the creator's held session unlock. The extension chat looks up `unlockedSessionFor(userId)`, which skips an unlock that holds no keys, and gets null. That gives `secret_unavailable`, shown as "your model key is locked". Signing in again worked because the new `unlockSession` now found the record.
- `service.ts:167-168, 178` (`rotateKey`): it zeroes the new key and revokes every holder, including the rotating person's own session. The key stays locked until the next sign-in.
- `service.ts:156` (`updateKey`, a metadata edit such as rename or enable): it revokes every holder, including the editor's own session, even though the seal does not change.
- Route trace: the Secret Keys page calls `POST /api/programs/secret-keys/create-key`. That is `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`. For a cookie caller it forces `authSessionId` to be the cookie session (`withProgramAuthSession`) and sets `actor.sessionId` and `actor.userId` from that same session. So the session id and the password already reached `registerSecretKeysApi` (`secret-keys/api/handlers.ts`). The handler verified the password and dropped the session.

## What changed and why

- `packages/fluxiq/src/programs/secret-keys/runtime/service.ts`
  - New exported type `SecretKeyActorSession { sessionId, userId, expiresAtMs }`. `createKey`, `rotateKey` and `updateKey` take an optional `actorSession` input.
  - `createKey` and `rotateKey` now call `holdForActor` instead of zeroing the key. It runs synchronously, right after the record write and after `rotateKey`'s `revokeKey`, so the held key always opens the record's current seal. It hands the newly derived key to the session only when all of these hold:
    - the session's user is the user the seal is stamped for (`createdBy` or `actorUserId`);
    - the held unlock for that session id belongs to that same user;
    - the session has not expired.
  - In every other case the key is zeroed.
  - If the person's session holds no unlock at all, for example after the server restarted while they stayed signed in, the service runs `unlockSession` once after the write. It uses the password just verified and the session's own expiry, which is the same thing sign-in does. If that fails, the new key is still saved and the session stays locked.
  - `updateKey` keeps a copy of the editor's own held key before `revokeKey`, then puts it back under the new `updatedAtMs`. Every other holder is still revoked. No password derivation happens here.
  - `createKey` now reads every input field before sealing. `rotateKey` zeroes the key if the record was deleted while the seal was being derived. Together these mean no exception can leave a derived key unzeroed now that the key is no longer zeroed immediately.
- `packages/fluxiq/src/programs/secret-keys/api/handlers.ts`
  - New `verifiedActorSession`, called after `authorizeSecretMutation` succeeds. It returns the session only when:
    - `payload.authSessionId` (the session the password was checked against) equals `actor.sessionId`;
    - `identityAccess.validateSession` says that session is live;
    - the session's user is `actor.userId`.
  - Create, rotate and update pass the result as `actorSession`. It is set after `...payload`, so a request body cannot supply its own.
  - A paired-client actor gets nothing, because its `authSessionId` is stripped and its `sessionId` is `client-gateway:...`.
- Custody invariants kept:
  - Only the user's own live session gets a key, and only after their password was verified.
  - A held key never outlives the session: the existing unlock timer revokes it, and a fallback unlock uses the session's `expiresAtMs`.
  - Every held key opens its record's current seal.
  - Every key that is not held is zeroed.
  - Nothing returns or logs key material.

New tests (each sits in a `tests/` folder beside the file it tests):

- `packages/fluxiq/src/programs/secret-keys/runtime/tests/actor-session-hold.test.ts` (6 tests):
  - a key created after sign-in is claimable at once;
  - a signed-in session with no unlock gets unlocked, bounded by its expiry, with the buffer zeroed at expiry;
  - another user's session, or a mismatched user, gets nothing;
  - with no session named, nothing changes;
  - rotation keeps the new value for the rotating session and revokes and zeroes the other user's copy;
  - an edit keeps the key only for the editing session.
- `packages/fluxiq/src/programs/secret-keys/api/tests/handlers.test.ts` (2 tests, on the real composed runtime). These two tests cover the API handlers, not the web route itself. They check that:
  - after sign-in and `create-key`, `unlockedSessionFor` returns the sign-in session and the key releases its value;
  - when the verified `authSessionId` is not the caller's session, the key is held in no session.

## Commands run and observed results

All commands ran from the Core root `C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ`.

1. Before the fix: `pnpm.cmd --filter fluxiq exec vitest run src/programs/secret-keys/runtime/tests/actor-session-hold.test.ts src/programs/secret-keys/api/tests/handlers.test.ts`
   - Result: `Test Files 2 failed (2) / Tests 5 failed | 3 passed (8)`.
   - Failures: `expected null to be 'session.one'` (create; and the no-unlock case), `promise rejected "Error: Secret key session unlock is unava…"` (rotate and edit), and the handler test failing the same way on `unlockedSessionFor`.
   - The 3 that passed are the negative guards (another user's session, no session named, mismatched verified session). They have to pass both before and after.
2. After the fix, the same command: `Test Files 2 passed (2) / Tests 8 passed (8)`.
3. Regression check on the existing tests beside the changed files and the two direct callers: `pnpm.cmd --filter fluxiq exec vitest run src/programs/secret-keys src/programs/tests/global-secret-keys.test.ts src/programs/_shared/tests/runtime-credential-changes.test.ts`
   - Result: `Test Files 12 passed (12) / Tests 71 passed (71)`.
   - This covers service, credential-changes, seal-upgrades, key-store, record-guard, record-write-queue, unlocked-session-for, value-sealer, the new files, global-secret-keys and runtime-credential-changes.

## Not verified

- No typecheck was run (the brief left it to the lead), and vitest does not typecheck. The places to look are the new `Omit<SecretKeyRecord, "sealed">` field object in `createKey`, and the `ProgramApiActor` / `SecretKeyActorSession` imports in `handlers.ts`.
- The structure audit was not run. `service.ts` now exports one more type, `SecretKeyActorSession`, next to its existing input types.
- No live or browser run: I did not repeat the real install flow (Secret Keys, then Continue, then Authorize New Key, then build from the extension chat).
- No web-app vitest was run, because no `apps/web` file changed.

## Open questions or contradictions found

- The chat wording is still unhelpful, and the file that holds it is outside my scope. `packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/progress.ts:56` says "unlock your keys in FluxIQ" without saying how. Secret Keys has no unlock control, so in practice the only way to unlock is to sign out and back in. This fix stops a newly added, rotated or edited key from reaching that state. But the state can still happen: after a server restart, sign-in sessions persist and held keys do not. The message should say "sign out of FluxIQ and sign in again", or Secret Keys should get an unlock control. Either change belongs to someone who owns automation-studio or the Secret Keys UI.
- Design choice to confirm: an edit used to revoke every holder by design (`held-keys.ts` docstring: "metadata edits ... revoke a key's holders"). Now the editor's own session keeps its key. Other holders and every one-use reveal authorization are still revoked. The held-keys docstring was left as it is, since the revocation itself still happens.
- The working copy also has other workers' uncommitted edits (client-gateway, get-started, onboarding, transport). None of them are mine. I changed only the four files named above.
