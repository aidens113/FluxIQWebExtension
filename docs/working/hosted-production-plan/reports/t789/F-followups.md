# t789-F: close hosted lane B1's open items (Core)

Worker: worker-heavy, 2026-10-28. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ`, branch
`task/t789-hosted-b1-platform-store`. Nothing committed and no git mutation. No model calls. B1's
uncommitted work was kept. No token, password, key or session id appears in any test output quoted here.

## Outcome

Done. All six items are implemented and tested, and every check the brief names passed. Two fixes go
slightly past the brief's wording, both in service of its intent:
- `createSessionRevealAuthorization` no longer drops another user's unlock when given their session id.
- `setPolicies` now asks identity before changing anything.

## What changed and why

**1. IamRecords over real SQLite.**
- `platform/iam/store/repository/records.ts` now tells kinds apart by id only.
  - `get` reads by id (`<kind>/<key>`, or `<kind>` alone).
  - `list(kind)` keeps the ids equal to `<kind>` or starting with `<kind>/`.
  - The envelope kind `iam.<kind>` is still written but never read, which mirrors `PlatformRecords`.
- The scope post-filter is gone. Workspaces are kept apart by the repository's own scope (one database
  per workspace for SQLite). The filter was also broken over SQLite, because SQLite lower-cases the
  `domainId` it returns, so a workspace id with capitals would read nothing.
- The port doc in `record-repository.ts` now says this.
- Removed B1's workaround: `provisioning/service/envelope-kind-repository.ts`, its test, its barrel line
  and its use in `create-platform-services.ts`.
- New real-SQLite test, `iam/store/tests/sqlite-iam-store.test.ts`:
  - it writes every kind (policy with versions, attachments, inline, boundary, guardrails, group with a
    member, role with a boundary, service identity) under workspace `Workspace-A`;
  - it reads all of them back through a second repository and checks `resolvePolicySet`;
  - it proves `workspace-b` and the platform level see none of them, then deletes some.
- Proof that the test catches the bug: run against the old `records.ts` (from `git show HEAD`, restored
  right after), it fails. Against the new file, it passes.

**2. Drift check line endings.**
- New `iam/catalog/tests/generated-text.ts` defines `withLfLineEndings`, which reads CRLF as LF.
- `live-registry.test.ts` compares both sides through it, keeping its diff messages.
- `generated-text.test.ts` covers both directions:
  - an LF render and its CRLF copy compare equal;
  - a real content change (a render with one endpoint removed) still differs in LF and CRLF, and so does
    an extra trailing newline.

**3. Runtime wiring (`programs/_shared/runtime.ts`).**
- `identityAccess.subscribeSessionRevocation((sessionId, revoker) => { secretKeys.revokeSessionUnlock(sessionId, revoker); })`,
  added right after `identityAccess` is built.
- The resolver now gets `flowSecretKeyId`, which reads the Flow through `automationStudio.getFlow` and
  returns `metadata.llmSecretKeyId`.
- It also gets `instanceHost`, the host of `FLUXIQ_PUBLIC_ORIGIN` when that is set and a URL.
- **The Flow lookup fails closed:** an unreadable Flow fails the call. The first version swallowed the
  error, and the structure audit's `failure-as-empty` rule rejected it.
- New `_shared/tests/runtime-session-revocation.test.ts` exercises the real `createGlobalProgramRuntime`
  in memory:
  - an admin revokes a viewer's session by digest through `api.call`, and the viewer's unlock is dropped;
  - a viewer revoking the admin's session is refused (`authorization.forbidden`), and the admin's unlock
    is kept;
  - the admin's own sign-out drops their own unlock.
- With the subscriber line disabled, this test fails (checked once, then restored).

**4. Who may drop an unlock.**
- `SecretKeysService.revokeSessionUnlock(sessionId, revoker)`:
  - `revoker` is the new `SecretKeyUnlockRevoker` type, `{ userId: string | null; administrator: boolean }`;
  - the unlock is dropped only for its own user or an administrator;
  - anyone else gets a thrown refusal and the unlock is kept;
  - it returns false when no unlock is held.
- `createSessionRevealAuthorization` now drops only the caller's own expired unlock. Before, naming
  another user's session id dropped that user's unlock (the denial-of-service vector in t789-key Q4).
- Identity Access:
  - New types `IdentitySessionRevoker` and `IdentitySessionTarget = string | { digest }`.
  - The listener is now `(sessionId, revoker)`.
  - `revokeSession(target, revoker?)` follows the rules in the new
    `runtime/sessions/resolve-session-revocation.ts`:
    - a digest is accepted from an administrator only, and must be 64 hex characters;
    - a named revoker who is not an administrator may revoke only their own session;
    - with no revoker (a sign-out presenting its cookie), the revoke is announced as the session's own
      user;
    - a raw id the service does not know is announced to no one.
  - `revokeUserSessions` and `deleteUser` announce each session as its own user.
  - `IdentitySessionRevocations.revoked(digests, revoker, presented?)` passes the revoker on to listeners.
  - `service.ts` stays at 40 methods and is now 797 lines; no new method was added.
- Admin endpoint `revoke-session`:
  - it takes exactly one of `sessionId` and the new `sessionDigest` (`RevokeSessionRequest`);
  - it passes `{ userId: actor.userId, administrator: actor.permissions.includes("identity.manage") }`;
  - it is still one endpoint, so the IAM catalog is unchanged.
- `apps/web/src/app/api/auth/logout/route.ts` no longer calls `revokeSessionUnlock(cookie)`. The identity
  revoke's event drops the unlock.
- Tests:
  - `secret-keys/runtime/tests/revoke-session-unlock.test.ts`: owner yes, admin yes, other user refused,
    a revoke nobody vouches for refused, an unknown session gives false, and a reveal under another
    user's id keeps the unlock;
  - `identity-access/api/tests/revoke-session.test.ts`: admin by digest, announced as admin; non-admin
    refused by the permission check; payload validation; owner yes; other user refused; digest from a
    non-admin refused; unknown raw id announced to no one;
  - two revoker cases added to `sessions/tests/session-revocations.test.ts`;
  - existing tests updated to pass a revoker.

**5. Contract codes (`@fluxiq/contracts`, still 0.3.0).**
- `PLATFORM_PROVISIONING_ERROR_STATUS` gains `last_administrator: 409` and `internal_error: 500`, with
  doc lines. Contract test added.
- Identity access throws the new `IdentityLastAdministratorError` (`runtime/last-administrator-error.ts`,
  code `identity.last_administrator`) where it threw a plain `Error`. The message is unchanged.
- Provisioning maps it to the contract code:
  - `context/last-administrator-refusal.ts` matches the error by its code, as `PlatformIdentityPort` now
    documents;
  - `settle` answers `last_administrator`;
  - other failures still propagate, so they are never stored for idempotent replay.
- `setPolicies` now sets the identity role first. `refreshIdentityRole` gained an optional `replacing`
  argument, so a refused demotion changes nothing; before, IAM attachments and the membership changed
  before the refusal.
- The listener's 500 now uses the typed contract code and its status.
- Tests:
  - `provisioning/tests/last-administrator.test.ts` uses the real identity service:
    - with the last enabled admin, `disableAccount`, `setPolicies`, `deleteAccount scheduled` and
      `deleteAccount immediate` all answer `last_administrator`;
    - the account, membership and role are unchanged afterwards;
  - the listener test asserts the 500 body parses against the contract and that a `last_administrator`
    answer is 409 and logged.

**6. Docs.** `docs/architecture/platform.md`:
- the `workspace-main` / `FLUXIQ_WORKSPACE_ID` decision, recorded as the lead's, which lane C may
  revisit, with a note that changing it needs a migration;
- the Store section on id-prefix kinds and the real-SQLite test;
- the adapter paragraph replaced;
- the provisioning call order, `setPolicies` row and listener 500 updated;
- the Model keys revocation rules and wiring;
- the "Not yet wired" items that are now done removed: the runtime wiring, and the stale relative
  contract import.

The framework reference was regenerated: 4257 declarations.

## Commands run and observed results

Heavy steps ran under the shared lock.
- `tsc --noEmit -p .` (packages/fluxiq): exit 0, no output.
- `pnpm test src/platform src/programs/identity-access src/programs/_shared src/programs/automation-studio/runtime/llm`:
  - parallel: `Test Files 286 passed`, `Tests 2744 passed`;
  - real-sql: `Test Files 10 passed`, `Tests 37 passed`;
  - "all groups passed", exit 0.
- Contracts `pnpm test`: `Test Files 35 passed`, `Tests 489 passed`.
- `pnpm --filter @fluxiq/contracts --filter fluxiq build`: exit 0.
- apps/web `pnpm exec vitest run src/server/provisioning-listener src/app/welcome src/app/reset src/tests/provisioning-welcome-smoke.test.ts`:
  `Test Files 12 passed`, `Tests 48 passed`.
- `pnpm check`, first run: exit 1. Node tests reported "# pass 471 / # fail 0", then the structure audit
  failed with `failure-as-empty` at `runtime.ts:314`. I made the Flow lookup fail closed and reran.
- `pnpm check`, second run: exit 0. "# pass 471 / # fail 0"; "structure-audit: passed (451 warning(s),
  1152 baselined)"; contracts, fluxiq, client-gateway-websocket and web checks passed.
- `pnpm structure:check`: "structure-audit: passed (451 warning(s), 1152 baselined)".
- `pnpm docs:reference`: wrote both reference files (4257 public declarations).
- `pnpm docs:check`: exit 0, "Deterministic framework reference is current." Run before and after the
  last `runtime.ts` edit.
- After the fail-closed edit:
  - neighbour run (`npx vitest run` over the deepseek-recovery/bootstrap tests, global-identity-access,
    secret-keys, runtime/llm and api/handlers): `Test Files 271 passed`, `Tests 2492 passed`;
  - `src/programs/_shared` plus `src/platform/iam/catalog`: `21 passed`, `151 passed`.

## Not verified

- **Order of runs after the last edit.** The brief's Core group run and the apps/web run happened before
  the last `runtime.ts` edit (the fail-closed Flow lookup). The tests closest to that code were rerun
  after it (above), but not the whole group run. The fluxiq dist used by the apps/web run predates that
  edit too.
- **The drift check in an LF checkout.** The live drift check passed here in a CRLF checkout. The LF
  case is covered only by the unit test, not by a real LF checkout.
- **Live and browser behaviour.** No live browser, no Next build, and no sign-out through the real route.
- **The cost of the Flow lookup.** It runs `getFlow` on every model call, and I did not measure that.
- **The full sweep.** The whole Core vitest suite, `pnpm test` and `pnpm build` were not run; they are
  left to the twice-daily sweep.

## Open questions or contradictions found

1. **The sign-out no longer drops the unlock for an unknown cookie.** The unlock is now dropped only
   through the identity event, and a cookie the service does not know vouches for no one, so its unlock
   (if one exists in memory) waits for its own expiry. This follows the lead's rule, but it is a
   behaviour change.
2. **`flowSecretKeyId` reads the whole Flow on every model call.** If that is costly, a lighter metadata
   read would help, or passing `metadata: parent.metadata` at `runtime/service.ts:1544` (lane t787).
3. **SQLite folds workspace ids.** It turns them into a file name (lower-case, unsafe characters become
   `_`), so `Workspace-A` and `workspace-a` share one database. That is harmless for random UUIDs and
   `workspace-main`, but an overridden `FLUXIQ_WORKSPACE_ID` should stay lower-case.
4. **`deleteAccount immediate` on the last admin.** It still revokes that admin's sessions and connected
   clients before identity refuses. No data is lost, but the refusal is not free of side effects.
5. **The `addMember` demotion case is unchanged.** It could demote a sole admin (for example, the
   bootstrap user gaining a viewer membership); that would now answer `last_administrator`, but only
   after the membership is written.
