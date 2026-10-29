# t789-G: a provisioning operation that identity will refuse changes nothing first

## Outcome

Done. Both defects are fixed and tested. I checked every other operation and found no other case
of a refusal after a side effect. One related defect sits outside the operation table: a reset
link is used up before identity may throw. It is recorded under Open questions and is not fixed.

## What changed and why

**Approach: check-then-act inside each operation, with no transaction and no compensation.** The
platform store has no transaction API (there is nothing under `platform/store` for it). The
identity port has no "would you refuse?" query, and that port is a stable seam that changes only
with the B1 supervisor. So the identity call that can refuse goes first: it is the operation's
first side effect, and identity access decides the refusal before it changes anything.

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ/`:

- `packages/fluxiq/src/platform/provisioning/operations/complete-account-deletion.ts`
  (defect 1). `identity.deleteUser` now runs first. Then come `revokeUserSessions`,
  `revokeConnectedClients("account_deleted")`, the policy detaches, the personal workspaces and
  the rows.
  - The real `IdentityAccessService.deleteUser` refuses before it changes anything, and it
    revokes and announces the user's sessions itself. The explicit `revokeUserSessions` stays
    because the port does not promise this (for identity access it returns 0).
  - A retry still finishes a partial deletion, because `deleteUser` answers false for a user
    that is already gone. That keeps the `runDueDeletions` "retry next sweep" rule.
  - I rejected disabling the user first: on a retry after a partial deletion, `updateUser` throws
    "Unknown user", which would wedge the sweep.
- `operations/refresh-identity-role.ts`. The `replacing` parameter is now `pending`: one
  workspace's membership as it is about to be stored, active with the given policies. The role
  is computed from the other active memberships plus the pending ones, so it also covers a
  membership that is new or was removed. Before this change, a new membership's policies were
  left out. For `setPolicies` the result is the same as before.
- `operations/add-member.ts` (defect 2). It now calls `refreshIdentityRole(..., pending)`
  before `putMembership` and `syncMemberPolicies`, and the role refresh after them is gone. A
  demotion is now refused before any membership or attachment is written.
- `operations/delete-account.ts`: doc comment only (both modes ask identity first).
- `docs/architecture/platform.md`: the rule in "A call, in order", plus the `addMember` and
  `deleteAccount` rows.
- Tests:
  - `packages/fluxiq/src/platform/provisioning/tests/refuse-first.test.ts` (new) uses the real
    `IdentityAccessService` with a session-revocation subscriber.
  - For each refused call it compares before and after: every repository row in every scope
    (accounts, memberships, policy attachments, idempotency), the identity snapshot (users and
    sessions), announced session revocations, connected-client revocations, deleted workspaces,
    and the count of `iam-change` audit rows.
  - Cases: `deleteAccount immediate`; `deleteAccount scheduled`, `disableAccount` and a demoting
    `setPolicies`; `addMember` with a new membership; `addMember` re-adding a removed membership.
  - Positive checks: an `addMember` that keeps the admin is allowed (this would fail under the
    old `replacing` rule), and an allowed immediate delete still revokes sessions and clients.
  - `tests/memory-record-repository.ts` gained `snapshot()`.
- Reproduction: run against the code before the fix, the new test file failed 3 of 5. The
  immediate delete revoked 2 sessions and 1 client, and both `addMember` cases wrote rows.

Audit of the other operations:

| Operation | Finding |
| --- | --- |
| `createAccount` | Every refusal comes before `upsertUser`, which cannot refuse a new id. Fine. |
| `setPolicies` | The role is set first. Fine. |
| `disableAccount`, `deleteAccount scheduled` | `updateUser` runs first. Fine. |
| `enableAccount` | Enabling never refuses. Fine. |
| `rotateCredentials`, `sendWelcome` | Nothing can be refused after the account lookup. Fine. |
| `setPassword` | Its checks come first, then `identity.setPassword` is the first side effect. Fine. |

## Commands run and observed results

Heavy steps ran under the shared lock, from 21:21:03 to 21:26:57, and the lock was removed.

- `npx vitest run src/platform/provisioning/tests/refuse-first.test.ts`, before the fix:
  3 failed / 5.
- `npx vitest run src/platform/provisioning`, after the fix: 14 files passed, 80 tests passed.
- packages/fluxiq `pnpm test src/platform src/programs/identity-access src/programs/_shared`:
  - parallel: 58 files / 523 tests passed;
  - real-sql: 9 files / 35 tests passed;
  - "all groups passed", exit 0.
- `pnpm --filter @fluxiq/contracts test`: 35 files / 489 tests passed.
- `pnpm --filter @fluxiq/contracts --filter fluxiq build`: exit 0. This ran before the apps/web
  step, so its fluxiq dist is current.
- apps/web `pnpm exec vitest run src/server/provisioning-listener src/app/welcome src/app/reset src/tests/provisioning-welcome-smoke.test.ts`:
  12 files / 48 tests passed.
- `pnpm check`: exit 0.
  - node tests: "# pass 471 / # fail 0";
  - "structure-audit: passed (451 warning(s), 1152 baselined)";
  - fluxiq:check and web:check were rebuilt, not reused; contracts and client-gateway-websocket
    were reused from their stamps.
- `pnpm structure:check`: "structure-audit: passed (451 warning(s), 1152 baselined)".
- `pnpm docs:reference`: "4257 public declarations".
- `pnpm docs:check`: "Deterministic framework reference is current.", exit 0.

## Not verified

- No live browser or real sign-out route, and no SQLite-backed run of the new test. It uses the
  memory repository; the real-sql group passed but does not include it.
- The full sweep (the whole Core vitest run, `pnpm test`, `pnpm build`) was not run.
- If a transient failure happens after `deleteUser` (for example the lane D revoke throws), the
  identity user is already gone while the rows remain until a retry. This is by design and
  covered only by reading the code, not by a test.

## Open questions or contradictions found

1. **A reset link is used up, then identity throws, after a restart (found, not fixed; outside
   the operation table).** In `links/redeem-account-link.ts`, `consumeLinkToken` runs before
   `identity.setPassword`.
   - A throwaway probe (written, run, then deleted) showed the problem. A user with a password,
     in an `IdentityAccessService` restarted over the same repository, gets
     `setPassword` -> "Credential recheck required", because the credential is sealed and not
     unlocked.
   - So after any server restart, redeeming a reset link for an account that has a password is
     likely to burn the token and fail with an internal error. The provisioning `setPassword`
     operation fails the same way, but without the ordering problem.
   - The probable root cause is in identity access: `setPassword` passes
     `resetSealedCredential=false`, unlike `setPasswordAuthorized` for an administrator. It
     needs a decision from the lead on who owns it.
2. In `completeAccountDeletion`, `revokeUserSessions` after `deleteUser` is redundant for
   identity access, which returns 0. I kept it because the port does not promise that deletion
   revokes sessions. If the port's documentation is changed to promise it, the call can go.
