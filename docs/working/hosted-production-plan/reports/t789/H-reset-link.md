# t789-H: a password reset works after a restart and never burns its link on a failure

## Outcome

Done, including the lead's follow-up decisions (1)-(3) from 2026-10-28.

- Welcome and reset links set the password after a restart. A failure releases the link so it can
  be used again, and a used or expired link is still refused.
- The provisioning `setPassword` operation now works after a restart, for the offline operator
  and for the provisioner service identity in-process. It uses the same privileged path, the same
  two-factor rule and the same audit as the links.
- A two-factor account with a sealed credential is refused as `two_factor`, and nothing changes.
  The lead confirmed this, and it is recorded in `docs/architecture/platform.md` with the recovery
  path.
- The private listener still answers `setPassword` with `operation_unavailable`. See Open
  question 1 for why I read "the online listener path behaves the same" that way.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ/`.

**Cause (confirmed by reproduction).** A new `IdentityAccessService` holds every credential
sealed. The plain `setPassword` then throws "Credential recheck required". Links consumed their
token before that call, so the link was burned. The offline command line always starts a new
process, so its `setPassword` failed for any account that already had a password.

**Identity** (`packages/fluxiq/src/programs/identity-access/`):
- `runtime/service.ts`: `resetPassword(userId, password)`. It was named `resetPasswordByLink` in
  the first round and was renamed because both links and the operator use it.
  - It runs `changePassword(..., resetSealedCredential: true)`, the administrator-reset path: the
    credential-change port with no actor and no current password (Secret Keys leaves old keys
    sealed), persistence, and rollback on a failed write.
  - It never rechecks the old credential.
  - It refuses a disabled or unknown user before anything changes.
  - It refuses a sealed credential on an account with two-factor (`totpEnabled` or
    `totpConfigured`) with `IdentityTwoFactorResetError`, before any subscriber is asked to
    prepare.
  - A replaced sealed credential loses its PIN. A credential unlocked in this process keeps its
    PIN and two-factor.
- `setPassword` and `setPasswordAuthorized` are unchanged. The signed-in self-service recheck
  stays.
- New `runtime/two-factor-reset-error.ts` (code `identity.two_factor_reset_refused`), exported
  from the barrel.
- To stay within the structure-audit limits (40 methods, 800 lines), `with-credential-status.ts`,
  `hold-credential-key.ts` and `restore-entry.ts` were moved out of `service.ts`. There is no
  behaviour change. The file is now 795 lines.

**Contract** (`packages/contracts/src/platform/provisioning/`):
- `errors.ts` adds `two_factor: 409`, documented beside `last_administrator`.
- `set-password.ts`: doc only.
- `tests/operations.test.ts` asserts the new code and that the `setPassword` response schema
  accepts it.

**Provisioning** (`packages/fluxiq/src/platform/provisioning/`):
- `types.ts`:
  - `PlatformIdentityPort` has `resetPassword`. Its unused `setPassword` was removed, since nothing
    in provisioning calls it now.
  - `PlatformLinkRefusal` gains `two_factor`.
- `operations/set-password.ts` calls `identity.resetPassword`. The operation is already authorised
  and audited as one IAM decision on `platform:SetAccountPassword`.
- New `context/two-factor-refusal.ts`, matched by `code`. Both `service/run-provisioning-operation.ts`
  (beside `last_administrator`) and the link redemption use it.
- `links/redeem-account-link.ts`. The checks are unchanged. Then:
  1. Reserve the token.
  2. Call `resetPassword`.
  3. Write the audit row.
  4. Revoke the account's sessions.
  5. Verify the email.
  - On any failure the token is released (best-effort, and the catch block says why). A
    two-factor refusal is answered `two_factor`; any other error is rethrown.
- New `links/record-link-redemption.ts`. It records one allow of `platform:SetAccountPassword` on
  the account FRN, citing `{policy: "welcome-link"|"reset-link", sid: null}`, with the user's FRN
  as principal. The row holds no secret.
- New `authorization/user-principal-frn.ts`, shared with `inProcessActor`.
- Store: `releaseLinkToken(digest, usedAtMs)`, in memory and in the repository store.
- Tests:
  - new shared support `tests/restart-fixture.ts`;
  - `tests/link-restart.test.ts`, 7 tests;
  - new `tests/set-password-restart.test.ts`, 4 tests;
  - a release test in the store suite;
  - `tests/fake-identity.ts` is now `resetPassword`.

**Web** (`apps/web/src/app/`):
- `reset/submitReset.ts` and `welcome/server/submitWelcome.ts` answer `two_factor` with 403.
- `welcome/client/accountLinkMessage.ts` has the message for it.
- The harness `welcome/server/tests/accountLinkHarness.ts` keeps identity in a repository and
  gains `restart()` and `provisionWithPassword()`.
- New tests: in reset, a restart test with a console-secret check, a two-factor 403 test and a
  failed-set test. In welcome, a restart test.

**Docs:**
- `docs/architecture/platform.md`:
  - the store rule and the links section;
  - a new subsection "Two-factor and PIN on a reset", recording lead decisions (1) and (2) with the
    recovery path: a signed-in administrator's panel reset (`set-password`,
    `setPasswordAuthorized`), which rechecks the administrator's own factors first and leaves
    two-factor off;
  - the `setPassword` operation row.
- `docs/operations/data-and-state.md`: which credential paths provisioning uses.
- The reference docs were regenerated.

**Tests that the cause and fixes are real.**
- Identity `service.test.ts`, 4 tests:
  - a sealed credential is replaced while `setPassword` still refuses it;
  - a sealed two-factor account is refused, with no subscriber prepared and the rows unchanged;
  - a held credential keeps its PIN;
  - the change is announced with no actor or current password, and a disabled or unknown user is
    refused.
- `link-restart.test.ts`, across restarts:
  - reset and welcome both work;
  - one audit row is written;
  - a failed `resetPassword` leaves the link usable, even across another restart;
  - a failed session revocation after the password is set also leaves the link usable;
  - a two-factor account gets `two_factor`, with the link unused and no audit row;
  - an expired link is refused;
  - a used link is refused (covered inside the cases above);
  - every case checks that no token, digest or password appears in logs or audit, and that no
    token or password appears in stored rows.
- `set-password-restart.test.ts`:
  - the offline `accounts setPassword --password-stdin` command, through
    `inProcessAccountsTransport` (platform-admin), sets the password after a restart, revokes 2
    sessions, and writes one audit row (`platform-admin`, origin `cli`);
  - the provisioner service identity in-process does the same, with the decision made by IAM
    (`FluxIQProvisioner`, origin `provisioning`);
  - the listener caller (HTTP) after a restart gets `operation_unavailable`, and nothing changes;
  - a sealed two-factor account gets `two_factor` for both callers, with the identity rows,
    sessions and two-factor unchanged;
  - no password appears in logs, audit or rows.
- Reproduction:
  - with the old link ordering and the plain `setPassword`, `link-restart` failed 5 of 6 with
    "Credential recheck required";
  - with the operation pointed back at the plain `setPassword`, `set-password-restart` failed 3 of
    4. Only the listener case passed, as it should.
  - Both files were restored from scratch copies afterwards.

## Commands run and observed results

The final run was under the shared lock, from 22:18:51 to 22:26:52. The lock was removed.

- `pnpm structure:check`: "structure-audit: passed (452 warning(s), 1152 baselined)". The one new
  warning is advisory: `tests/restart-fixture.ts` exports 11 values (threshold 8).
- packages/fluxiq `pnpm test src/platform src/programs/identity-access src/programs/_shared`:
  - parallel: 60 files / 540 tests passed;
  - real-sql: 9 files / 35 tests passed;
  - "all groups passed".
- `pnpm --filter @fluxiq/contracts test`: 35 files / 489 tests passed.
- `pnpm --filter @fluxiq/contracts --filter fluxiq build`: exit 0. It ran before the web step.
- apps/web `pnpm exec vitest run src/server/provisioning-listener src/app/welcome src/app/reset src/tests/provisioning-welcome-smoke.test.ts`:
  12 files / 52 tests passed.
- `pnpm docs:reference`: "4258 public declarations".
- `pnpm check`: exit 0.
  - "# pass 471 / # fail 0";
  - "structure-audit: passed";
  - contracts, fluxiq, client-gateway-websocket and web checks all ran as commands, none from a
    stamp.
- `pnpm docs:check`: "Deterministic framework reference is current.", exit 0.

## Not verified

- No live browser and no real server restart. The restart is a new service over the same memory
  repositories. The SQLite restart test (`sqlite-services.test.ts`) passed but was not extended.
- The real `fluxiq accounts` binary (`cli/main.ts`) was not run. The test drives
  `runAccountsCommand` with `inProcessAccountsTransport` instead.
- The apps/web listener tests use an identity without a repository, so they were not run across a
  restart. The listener refuses `setPassword` before identity is touched, and the Core test covers
  the same caller after a restart.
- Cross-process races on consume and release; the full sweep.

## Open questions or contradictions found

1. **The listener and `setPassword`.** The frozen contract has `setPassword` with `http: false`
   ("a password is never sent over http"), and the CLI's HTTP transport refuses to send one. I did
   not change that contract. I read "the online listener path behaves the same" as: every caller
   that can reach `setPassword` uses the same privileged path, and the listener's answer is
   consistent before and after a restart. If the lead means the listener should accept a password,
   that is a contract change and needs its own decision.
2. **No operator recovery for a sealed two-factor account.** This follows from lead decision (1)
   being applied to the operator. The offline CLI cannot reset such an account, so recovery is only
   the signed-in administrator's panel reset. A single-tenant install whose only administrator has
   two-factor and has lost the authenticator has no path. This may need a break-glass decision.
3. **Ports changed.** `PlatformIdentityPort` lost `setPassword` and gained `resetPassword`.
   `PlatformStore` gained `releaseLinkToken`. The contract gained `two_factor`. Note these at
   integration (G called the port a B1-owned seam).
