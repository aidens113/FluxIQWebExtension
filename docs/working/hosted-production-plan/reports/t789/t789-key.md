# t789-key: key selection, per-call unlock resolution, session revocation (lane B1, H1)

Worker: worker-heavy, 2026-10-28. Core tree: `fxwork/t789/!FluxIQ` (task/t789-hosted-b1-platform-store).
Paths below are relative to `packages/fluxiq/src/programs/`. No git mutations, no model calls, no Lab runs.
No key, password, token or session id is printed by any test or in this report (tests use fake strings).

## Outcome

Done. All five goals are implemented with tests. The acceptance tests pass in both groups, `tsc` is clean,
and the structure audit passes. Three things need the lead's attention (see Open questions):
1. The `_shared/runtime.ts` wiring line (below) is not applied, because that file belongs to lane C.
2. The DeepSeek adapter hid the typed error, so the resolver now unwraps it.
3. The admin `revoke-session` endpoint takes a raw session id, but the snapshot only ever lists digests.

## What changed and why

**1. Selection fix** (`automation-studio/runtime/llm/deepseek/session-key.ts`)
- `releaseAutomationStudioSessionDeepSeekKey(ports, caller, options?)` has a new optional third
  parameter, `{ flowKeyId?, instanceHost? }`. `panel-command-key.ts` compiles unchanged.
- Which key it tries:
  - the Flow's key when `flowKeyId` is set. It is refused, with a plain message, when it is missing,
    disabled, not a DeepSeek key, or stamped for another user;
  - otherwise the caller's own enabled DeepSeek keys, newest first (`createdBy === userId`);
  - then legacy keys with no stamp. A legacy key is used only if one of the caller's unlocks actually
    opens it.
- It never offers another person's stamped key.
- `secrets:UseKey` goes through a new optional port, `authorizeUseKey?(userId, keyId)`. It is asked
  before any release. Absent means allowed. If it refuses every candidate, the call throws
  "…(secrets:UseKey)".
- New optional port `unlockedSessionFor?(userId)`. Sessions are tried in this order: the session the
  call names, then `unlockedSessionFor(userId)`.
- When nothing can release the key, it throws `AutomationStudioSecretsLockedError` instead of the raw
  "Secret key session unlock is unavailable".
- The panel chat gets the same fallback and typed error, because the runtime passes `secretKeys`
  itself as the ports.

**New file `llm/deepseek/secrets-locked-error.ts`**
- Defines `AutomationStudioSecretsLockedError`, which implements the contract's `SecretsLockedError`.
  It carries `code: "secrets.locked"` and the message `secretsLockedMessage(instanceHost ?? "the FluxIQ panel")`.
- Exported from `llm/deepseek/index.ts` and `llm/index.ts`, one line each. Those barrel edits are
  necessary to export the class. `llm/` is at its 25-file cap, so the file had to go in `deepseek/`.

**2. Per-call unlock resolution** (`llm/session-key-provider.ts`)
- The resolver now resolves the unlock on every call. `caller.actorSessionId` is only the preferred
  (started-from) session.
- New resolver options:
  - `instanceHost?`;
  - `flowSecretKeyId?({projectId, flowId})`. The Flow key comes from this host lookup first, then
    from `input.metadata.llmSecretKeyId`.
- **The adapter hid the typed error.** `deepseek/provider.ts` turns any throw from `resolveSecret`
  into `llm.provider_secret_unavailable`, and its outer catch turns that into
  `llm.provider_request_setup_failed`. So the resolver wraps `runTask`: it remembers a locked error
  per `requestId` and rethrows the typed error.
- `ports` stays `AutomationStudioSessionKeyPorts`, with `unlockedSessionFor` optional. Making it
  required broke five test files outside my ownership that build ports by hand. Production passes the
  real `SecretKeysService`, which has `unlockedSessionFor`.

**Caller and handlers**
- `conversations/commands/caller.ts`: the effective caller gains `preferredSessionId: string | null`.
  It is the request's own session, or for a paired client the unlock that is live at message time,
  or null. `sessionId` is still the session registry calls run under, so `conversations.ts` is untouched.
- `api/handlers/runtime-execution.ts:80`: `actorSessionId` is now `caller.preferredSessionId ?? caller.sessionId`.
  The deterministic fallback when `keyLocked` is kept as it was.
- `api/handlers/llm-generation.ts:126`: the code is unchanged (it already passes the started-from
  session). Only the comment changed, to say the session is the one tried first. Per-call fallback and
  `secrets.locked` both happen in the provider.
- `conversations/commands/tests/port.test.ts`: its `toEqual` assertions were updated for the new field.

**3. Identity Access service** (`identity-access/runtime/service.ts`, now 794 lines)
- `revokeUserSessions(userId): Promise<number>`. It first reloads from the store, so sessions minted
  by another instance are found too.
- `deleteUser(userId): Promise<boolean>`. It removes the user, the credential (memory and store, and
  zeroes the held key) and all sessions. It refuses the final enabled admin with `updateUser`'s message.
- `subscribeSessionRevocation(listener) => unsubscribe`.
- New option `sessionRevocationSubscribers`, in `types.ts`, plus the `IdentitySessionRevocationListener` type.
- `revokeSession`, `revokeUserSessions` and `deleteUser` tell every listener the raw id.

**New `identity-access/runtime/sessions/`**
- `IdentitySessionRevocations` keeps the raw id of each session this process minted (`createSession`)
  or was presented (`validateSession`). The map is keyed by digest and lives in memory only: never
  stored, and expired entries are pruned.
- It runs every listener and then throws an `AggregateError` if any listener failed. The session stays
  revoked either way, and the error message contains no id.
- `deleteStoredSessions` removes sessions from memory and the store together.
- Why remember raw ids: sessions are stored by digest only, so without this `revokeUserSessions` and
  `deleteUser` could not tell Secret Keys which raw-id-keyed unlocks to drop.

**4. Admin revoke endpoint** (`identity-access/api/handlers.ts`)
- Only a comment changed. The endpoint calls `service.revokeSession`, which now notifies listeners.
  Permission metadata is untouched.
- **Wiring for `_shared/runtime.ts` (lane C)**, one line after `identityAccess` is constructed:
  ```ts
  identityAccess.subscribeSessionRevocation((sessionId) => secretKeys.revokeSessionUnlock(sessionId));
  ```
  The constructor-option form also works: add
  `sessionRevocationSubscribers: [(sessionId) => secretKeys.revokeSessionUnlock(sessionId)]` beside
  `credentialChangeSubscribers`.
- This wiring is proven by `identity-access/api/tests/handlers.test.ts`, test "drops the revoked
  session's Secret Keys unlock…", using a real `SecretKeysService` and `IdentityAccessService` wired
  exactly this way.
- **Optional resolver wiring for the Flow key**, needed on the build path. `service.ts:1544` calls the
  resolver with no metadata, so a build only sees the Flow key through this host lookup:
  ```ts
  createAutomationStudioSessionKeyProviderResolver({ ports: secretKeys, flowSecretKeyId: async ({ projectId, flowId }) => { const id = (await automationStudio.getFlow(projectId, flowId)).metadata?.llmSecretKeyId; return typeof id === "string" ? id : undefined; } })
  ```
  You can also add `instanceHost: <public host>` for N4.

**5. Identity providers port** (new `identity-access/runtime/providers/`)
- `identity-provider.ts` defines `IdentityProviderId` (`"password" | "oidc"`), `IdentityProviderSignIn`
  and `IdentityProvider<Credentials>`.
- `password.ts` defines `createPasswordIdentityProvider(service)`, which delegates to `authenticate`.
- Both have a barrel, and the program barrel `identity-access/index.ts` re-exports them.

**Tests added**
- `llm/deepseek/tests/session-key.test.ts` (9 tests, real `SecretKeysService`, weak scrypt, fake keys):
  - the wrong-key-of-anyone regression (A's older key is released to A while B's key is the newest);
  - B is never offered A's key;
  - the Flow key is used;
  - a Flow key that belongs to someone else, or is missing, is refused;
  - a `UseKey` refusal releases nothing;
  - legacy keys open only for an unlock that holds them;
  - fallback to the user's other unlock;
  - `secrets.locked` code and message, for both the given host and the default;
  - another user's browser never reaches A's unlock.
- `llm/tests/session-key-provider.test.ts` (5 tests added, with a fetch stub):
  - logout of the started-from session mid-build while another unlock is alive: the next call
    succeeds, and when none is left the next call is `secrets.locked`;
  - an admin `revokeSession` drops the unlock, then `secrets.locked`;
  - single-user local is unchanged (admin/admin, one key, the login unlock pays for the build);
  - the Flow key through the host lookup and through metadata;
  - B's paired browser.
- `identity-access/runtime/tests/service.test.ts` (4 tests added): listeners from the option and from
  subscribe, and unsubscribe; `revokeUserSessions` across instances; `deleteUser`, including the final
  admin refusal and no store remnants; a failing listener.
- `identity-access/runtime/sessions/tests/` (5 tests).
- `identity-access/runtime/providers/tests/password.test.ts` (2 tests).
- `identity-access/api/tests/handlers.test.ts` (the wiring test).

## Commands run and observed results

All were run from `packages/fluxiq` unless marked root.

- **Acceptance tests:**
  `pnpm test src/programs/identity-access src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers`
  -> exit 0.
  - parallel group: `Test Files 269 passed (269)`, `Tests 2501 passed (2501)`, 190.88s;
  - real-sql group: `Test Files 19 passed (19)`, `Tests 199 passed (199)`, 107.01s;
  - `[vitest-groups] all groups passed: parallel, real-sql`.
  - grep of the log for the fake key or password strings: 0 hits.
- **Typecheck:** `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p .` -> no
  output, exit 0. The first runs failed, and both failures were fixed:
  - making `unlockedSessionFor` required broke 5 test files elsewhere, so it became optional;
  - the weak-KDF literal needed `as const`.
- **Structure audit (root):** `pnpm structure:check` -> `structure-audit: passed (450 warning(s), 1152 baselined)`.
  The first run had 2 `statement-packing` failures in my new tests, now fixed.
- **Neighbouring tests:**
  `npx vitest run` over these files, which use these ports or services:
  - `runtime/tests/deepseek-recovery-requests.test.ts`
  - `refuted-result/tests/reauthor-service.test.ts`
  - `refuted-result/tests/repair-replay-chain.test.ts`
  - `service-adaptation/tests/iterating-recovery.test.ts`
  - `runtime/tests/deepseek-bootstrap`
  - `programs/tests/global-identity-access.test.ts`
  - `programs/secret-keys`
  - `runtime/result-check-authorization`

  -> `Test Files 21 passed (21)`, `Tests 135 passed (135)`.

## Not verified

- The `_shared/runtime.ts` wiring is not applied, so in the real runtime an admin revoke does not drop
  the unlock until lane C adds the line. It is proven only in tests that wire it the same way.
- How `secrets.locked` reaches the person mid-build. The harness normalizes an untyped throw as
  `llm.provider_request_failed`, with the throw account `errorClass: AutomationStudioSecretsLockedError`,
  `errorCode: secrets.locked` and the screened sentence. I did not trace what the chat thread shows,
  or whether the retry policy retries it. The progress.ts:59 sign-out sentence before a build is
  outside my files and is unchanged.
- No live browser, web route, or apps/web test was run.
- I did not check that the regression test fails on the old selection code. I could not run the old
  code without git operations. The H0-S5 probe showed that failure.
- The full suites (`pnpm check`, `pnpm test`) were not run, per the twice-a-day rule.

## Open questions or contradictions found

1. **The admin revoke endpoint cannot reach other users' sessions in practice.** `revoke-session` takes
   a raw session id, but `snapshot` lists sessions by digest only, so an administrator never has the
   raw id of someone else's session. I did not make `revokeSession` accept digests. The logout route
   passes the raw cookie into `revokeSession`, so accepting a digest there would let anyone with
   `programs.read` (who can see digests) sign other people out through `/api/auth/logout`.
   Recommendation: a separate admin path `revokeSessionDigest`, or use `revokeUserSessions`, behind
   `identity.manage`.
2. **The Flow key on the build path.** `runtime/service.ts:1544` calls the resolver without
   `metadata`, so a build only uses the Flow's `llmSecretKeyId` once the host binds `flowSecretKeyId`
   (wiring above). Otherwise passing `metadata: parent.metadata` there would do it, but that file
   belongs to lane t787.
3. **`IdentityAccessService` is at 40 methods, exactly the class-methods limit.** The audit warns; it
   fails above 40. The next method needs an extraction first (session methods onto `runtime/sessions/`
   are the natural group). `service.ts` is at 794 of 800 lines.
4. **A pre-existing denial-of-service vector, not changed.** `SecretKeysService.createSessionRevealAuthorization`
   (`secret-keys/runtime/service.ts:309`) revokes an unlock when the named session belongs to a
   different user. A caller that knew another user's raw session id could drop that unlock. Session
   ids are bearer secrets, so this needs a leaked id. It is lane-owned (secret-keys), so I did not touch it.
5. **The panel chat behaviour changed.** It now also falls back to the user's other live unlock and
   raises `secrets.locked`, because the runtime passes `secretKeys` as the panel's ports. This matches
   the plan ("each model call resolves the user's live unlock"), but it is a change.
