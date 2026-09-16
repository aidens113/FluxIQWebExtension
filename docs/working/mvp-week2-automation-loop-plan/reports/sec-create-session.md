# sec-create-session — `create-session` credential recheck (FluxIQ Core)

Repository: `F:\!FluxIQ` (Core), branch `dev`, nothing committed.
Owned paths: `packages/fluxiq/src/programs/identity-access/**`. Nothing outside
that was edited.

## Outcome

Done. The endpoint gap is closed, a second gap found below it is closed, and
five tests fail against the pre-fix source and pass against the fixed source.

## What I inherited, and my judgement of it

The killed worker's edits were on disk and, as far as they went, correct and
coherent. They were not complete. What was there:

1. `api/contracts.ts` — added the four optional recheck fields
   (`authSessionId`, `authorizationPassword`, `authorizationPin`,
   `authorizationTotp`) to `SessionRequest` and `VaultUnlockRequest`.
   `RevokeSessionRequest` deliberately left alone.
2. `api/handlers.ts` — extracted the `disable-totp` recheck into a shared
   `recheckCredentials(service, payload)` helper returning
   `{ ok: false, requiresRecheck: true, error }` or `null`, rewrote
   `disable-totp` to use it (no behaviour change), and called it from
   `create-session` and `unlock-vault`. This follows the existing pattern
   rather than inventing one, as the brief required.
3. `runtime/service.ts` — a second defect, found by that worker and not
   mentioned in my brief: `unlockVault` decided what to check from what the
   *caller sent* (`params.password ? verify : true`), so `{ userId }` with no
   password and no PIN unlocked the vault outright. Changed to decide from what
   the *account has configured* (`credential.passwordHash ? ... `).
4. `runtime/tests/service.test.ts` — a regression test for (3).
5. `api/tests/handlers.test.ts` — new, untracked: six endpoint-level tests
   covering create-session refused with no recheck, refused with a wrong
   password, allowed after a correct recheck; unlock-vault refused and allowed;
   and revoke-session/lock-vault still working without a recheck.

The helper's type (`CredentialRecheck`, `CredentialRecheckRefusal`) is
file-local and not re-exported through the `identity-access` barrel, so the
package's public surface grows only by the four optional contract fields, which
are backwards compatible.

## What I wrote

**a. A residual hole in the same method (`runtime/service.ts`).** The inherited
fix keys off `credential.passwordHash`, but `requireCredential` returns a
freshly minted *empty* credential for a user who has no credential record at
all — `upsertUser` only writes one when a password or PIN is supplied. With an
empty credential, `passwordHash`, `pinHash` and `totpSecret` are all undefined,
every `ok` flag stays `true`, and the vault unlocks in that user's name with
nothing proved. `unlockVault` now refuses outright when the account holds no
password verifier, after a dummy derivation so the refusal is not a timing
oracle — the same shape `unlockCredential` already uses for this case. Such an
account cannot sign in either, so nothing legitimate is lost.

**b. A regression test for (a)** in `runtime/tests/service.test.ts`
("refuses a vault unlock in the name of an account that has no password
verifier to prove").

**c. `revoke-session` and `lock-vault`: checked, no gap, decision recorded.**
Both only take authority away. Gating `revoke-session` would leave a stolen
session alive while its owner tried to kill it, and a vault lock must never be
the step that fails. Both now carry a comment saying so, so the asymmetry with
the neighbouring endpoints is not read later as an oversight. The inherited
handler test pins the behaviour.

**d. The named internal path for minting sessions.** There is one legitimate
internal caller, `authenticate`, and it does prove the user's credentials — the
password, plus the authenticator code where one is configured — before calling
`createSession`. So no new internal entry point was needed; what was missing was
the statement of the rule. `createSession` now carries a doc comment saying it
proves nothing by itself, naming `authenticate` as the one internal path that
satisfies its precondition and the gated `create-session` endpoint as the only
other way in. I did not rename or narrow `createSession`: it is called from
`packages/fluxiq/src/programs/tests/global-identity-access.test.ts`, which is
outside my owned paths.

## Commands run and observed results

All from `F:\!FluxIQ`.

1. Identity-access tests, inherited state (before my changes):
   `pnpm --filter fluxiq exec vitest run src/programs/identity-access`
   → `Test Files 3 passed (3)`, `Tests 34 passed (34)`.

2. Identity-access tests, final state:
   same command → `Test Files 3 passed (3)`, `Tests 35 passed (35)`
   (`run-credential-change.test.ts` 5, `api/tests/handlers.test.ts` 6,
   `runtime/tests/service.test.ts` 24).

3. **The tests fail without the fix.** I restored only my two owned source
   files to their committed content (`git show HEAD:<path> > <path>` for
   `api/handlers.ts` and `runtime/service.ts`), left every test at its fixed
   version, and re-ran the same command. No `git stash` was used, so no other
   worker's in-flight files were touched. Observed:
   `Test Files 2 failed | 1 passed (3)`, `Tests 5 failed | 30 passed (35)`:
   - `refuses to mint a session for another user without a credential recheck` —
     `expected { ok: true, payload: { …(3) } } to match object { ok: false, requiresRecheck: true }`
   - `refuses to mint a session when the recheck credentials are wrong` — same
     `ok: true` result
   - `refuses to unlock the vault without a credential recheck` —
     `expected { ok: true, payload: { …(5) } } to match object { ok: false, requiresRecheck: true }`
   - `refuses a vault unlock that omits a credential the account has configured` —
     `promise resolved "{ initialized: true, …(4) }" instead of rejecting`,
     received `unlocked: true, unlockedBy: "user.one"`
   - `refuses a vault unlock in the name of an account that has no password
     verifier to prove` — resolved `unlocked: true, unlockedBy: "user.none"`

   I then restored both fixed files from a scratchpad copy and re-ran:
   `Test Files 3 passed (3)`, `Tests 35 passed (35)`. `git diff --stat` after
   the restore matches the intended change set (contracts +8, handlers +56/-8,
   service +21/-2, service.test +26).

4. Runtime-level identity suites (not required by the brief; run because the
   service change is reachable from them):
   `pnpm --filter fluxiq exec vitest run src/programs/tests/global-identity-access.test.ts src/programs/tests/permission-matrix.test.ts`
   → `Test Files 2 passed (2)`, `Tests 12 passed (12)`. That includes the
   existing `requires fresh credentials before disabling two-factor
   authentication` test, so the `disable-totp` refactor is exercised end to end
   through `createGlobalProgramRuntime`.

5. Core type check: `pnpm --filter fluxiq check` (`tsc --noEmit`) → no output,
   exit 0.

6. Structure audit: `node scripts/structure-audit.mjs` →
   `structure-audit: passed (136 warning(s), 256 baselined)`. The new
   `api/tests/handlers.test.ts` adds no violation. `runtime/service.ts` is now
   753 lines against the 800-line hard limit and the pre-existing 400-line
   advisory warning.

As instructed, I did not run the full suite and did not look at
`automation-studio/runtime/tests/live-patch.test.ts`.

## Not verified

- No live browser or running-panel validation. The `create-session` and
  `unlock-vault` endpoints have no caller in `apps/web` or anywhere else in
  either repository (searched for `create-session`, `createSession`,
  `unlock-vault`, `unlockVault` outside `identity-access/`), so there is no UI
  flow to exercise and no client to update. The only consumers are the tests.
- I did not run `pnpm test` or `pnpm build` for Core; the brief scoped me to
  the identity-access tests and the type check.
- The type check passed against `_shared/api.ts` as it stands now. See the
  first open question — that file changed under me during this task.

## Open questions and contradictions found

1. **`_shared/api.ts` is volatile, and a change in flight will break my file.**
   Early in the task `git status` listed `_shared/api.ts` and
   `_shared/runtime.ts` as modified, and the file on disk required a new
   `classification` field on every `registry.register(...)` call
   (`read` | `authoring` | `destructive` | `program-gated` |
   `destructive-ungated`), with the registry taking an `identityAccess`
   collaborator and enforcing a PIN for `destructive`. Minutes later both files
   were back to their committed content and the requirement was gone. My work
   is against the committed version, which takes no `classification`; adding
   one now would be a TypeScript excess-property error. **When that change
   lands, all twelve identity-access registrations need a `classification`, and
   there is a direct conflict to settle:** by that vocabulary `revoke-session`
   removes persisted user data, so classifying it `destructive` would make the
   registry demand the operator's PIN — the opposite of the decision recorded
   in (c) above. `create-session`, `unlock-vault` and `disable-totp` are
   `program-gated` under that vocabulary, since they now run their own stronger
   check inside the handler.

2. **Two endpoints in the same file have the same gap, and I could not close
   them without leaving my owned paths.**
   - `create-user` (`upsertUser`) takes a `roleId` and a password with no
     recheck, so a hijacked admin session can create a *new* admin account with
     a password it chooses and sign in as it. That is a fuller escalation than
     the one I was sent to fix, and it sits beside `update-user`, which *does*
     require a recheck to change an existing user's role — so the file
     currently guards promoting a user but not minting an admin.
   - `begin-totp` / `confirm-totp` re-enroll another user's authenticator
     secret with no recheck, while `disable-totp` requires one. Overwriting the
     secret achieves what disabling achieves, and more.

   Both are called from `apps/web/src/features/programs/live-views/identity-access.tsx`
   without authorization fields, so closing them means editing that file and
   its tests. That is outside my brief, so I stopped and am reporting instead.
   The transport side is ready: `apps/web/src/lib/program-route.ts` overwrites
   `authSessionId` with the trusted session id for every `identity-access`
   call, so a client cannot spoof it.

3. **`update-user` answers in a different shape.** When the role-change recheck
   fails it lets the error throw and the registry converts it to
   `{ ok: false, error }` with no `requiresRecheck`, where every other gated
   endpoint returns `requiresRecheck: true`. A client cannot tell "collect the
   credentials again" from "you lack permission". I left it alone because the
   web UI reads that response and the file is not mine to coordinate with.

4. **Documentation not updated, by brief.** Core's `AGENTS.md` asks for an
   authored-doc update in the same work unit for authorization changes, but my
   brief gave me `identity-access/**` and nothing else. The place for it is
   `docs/operations/data-and-state.md`, in the `## Identity State` section
   (around the session-digest and vault-key paragraphs, lines ~225-290): it
   should say that `create-session` and `unlock-vault` require a fresh
   password/PIN/2FA recheck of the *calling* session, that `revoke-session` and
   `lock-vault` deliberately do not because they only withdraw authority, and
   that a vault unlock is refused for an account with no password verifier.
   `docs/programs/global-programs.md` (lines ~73-114) describes the same
   recheck for the sensitive stores and could carry a matching sentence.

No secret, PIN, token or password value is quoted here. The tests use dummy
values only, at the test-only derivation cost.
