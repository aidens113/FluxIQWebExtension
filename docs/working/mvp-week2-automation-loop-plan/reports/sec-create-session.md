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

---

# Follow-up round — remaining gaps closed, web view, docs

Scope widened by the coordinator after the first round was verified: close the
`create-user` and `begin-totp`/`confirm-totp` gaps, edit
`apps/web/src/features/programs/live-views/identity-access.tsx` as the recheck
requires, record the twelve endpoint classifications without adding the field,
and write the rule into `docs/operations/data-and-state.md`.

## Outcome

Done. Three more endpoints gated, three more regression tests that fail without
the fix, the web panel updated to collect the factors, and the rule documented.
Nothing outside identity-access, that one view, and that one doc was touched.

## What I changed

**1. `create-user` now re-proves the caller's credentials**
(`api/handlers.ts`, `api/contracts.ts`). This was the worse of the two gaps, for
the reason you gave: the account outlives the session that made it, and the
caller picks both its role and its password. `CreateIdentityUserRequest` gained
the four optional recheck fields. I checked that this cannot leak the operator's
password into storage: `upsertUser` builds the stored `User` field by field and
never spreads its params, so the authorization fields are read by the handler
and dropped.

**2. `begin-totp` and `confirm-totp` now re-prove them too.** Enrollment issues
the authenticator secret for the named account and replaces any secret already
set up for it, so leaving it open let a hijacked admin session move a user's
second factor onto its own device while `disable-totp` next door demanded a full
recheck. `begin-totp` takes the recheck inline, as `disable-totp` does;
`TotpConfirmRequest` gained the four fields. A first enrollment by an operator on
their own account still asks only for the password (and PIN if configured),
because `authorizeSessionCredentials` requires an authenticator code only when
the *acting* user already has one — and during a first enrollment the new secret
is still `pendingTotpSecret`, not `totpSecret`.

**3. Three regression tests** in `api/tests/handlers.test.ts` (9 there now, up
from 6). The `confirm-totp` one is worth explaining: it asserts that an
unauthorized confirm is refused *before the code is ever checked*. Without the
gate the response is `{ ok: false, error: "Invalid TOTP code" }` — a refusal,
but one produced by the service after it had already accepted the request, and
with no `requiresRecheck` for the client to act on. With the gate the caller
gets `requiresRecheck: true`, and a correct recheck then lets the request
through to the service, which is what rejects the wrong code. Both directions
are asserted.

**4. The web panel supplies what the gates now require**
(`apps/web/src/features/programs/live-views/identity-access.tsx`). No refactor;
the existing `AuthorizationFields` component and the existing modal idiom were
reused.

- **Add User** gained `AuthorizationFields`, and its submit button stays
  disabled until the acting user's factors are complete, exactly as the Change
  Role and Change Credential modals already are. The entered factors are cleared
  on cancel, on close, and after a successful create.
- **Set up 2FA** gained an authorization step in front of it, mirroring the
  existing Disable 2FA modal, and a failed authorization shows its error inside
  that modal rather than in the page status line.
- Enrollment is two gated calls, so the factors entered once at the start are
  held in component state for the confirm call and dropped when the enrollment
  closes, by whichever route it closes. That is the same lifetime the existing
  Change Credential modal already gives an entered password. The alternatives —
  prompting twice in one flow, or issuing a short-lived server-side grant of the
  kind Secret Keys uses for reveals — meant either a worse flow or a design
  change well beyond this brief. Flagged for your judgement.
- No other caller in `apps/web` touches these endpoints; I searched the whole app
  for all five endpoint names. Nothing in the first-run or login path calls
  `create-user`, because the default administrator is created inside the service
  by `ensureDefaultAdmin` rather than over the wire, so the new gates cannot lock
  anyone out of a fresh install.

**5. The rule is written down** in `docs/operations/data-and-state.md`, under
`## Identity State`, as a new subsection "Which Identity Access endpoints require
a credential recheck". It lists the gated endpoints with the reason each one
hands out authority, states that `revoke-session` and `lock-vault` are
deliberately ungated and why revocation in particular must never sit behind a
prompt, records the vault-unlock rule, and notes that `withProgramAuthSession`
overwrites `authSessionId` server-side so a client cannot name someone else's
session as the one being re-proved.

## Endpoint classifications for the atomic Phase P pass

No `classification` field was added, as instructed. These are the twelve values
that pass should use, following your decision that removing access is not
destructive:

| Endpoint | Classification | Why |
| --- | --- | --- |
| `snapshot` | `read` | Persists nothing; lists sessions by digest only. |
| `create-user` | `program-gated` | Now runs its own password/PIN/2FA recheck. |
| `update-user` | `program-gated` | Runs its own recheck on a `roleId` change. See the note below. |
| `set-password` | `program-gated` | `setPasswordAuthorized` runs the recheck. |
| `set-pin` | `program-gated` | `setPinAuthorized` runs the recheck. |
| `begin-totp` | `program-gated` | Now runs its own recheck. |
| `confirm-totp` | `program-gated` | Now runs its own recheck. |
| `disable-totp` | `program-gated` | Already ran its own recheck. |
| `create-session` | `program-gated` | Now runs its own recheck. |
| `revoke-session` | `authoring` | Your decision: removes access, not persisted user data, and must not sit behind a PIN. |
| `unlock-vault` | `program-gated` | Now runs its own recheck, and the service proves the named account's own factors. |
| `lock-vault` | `authoring` | Your decision: withdraws access only, and must never be the step that fails. |

One nuance for whoever writes that pass: `update-user` is `program-gated` for its
privileged path only. It re-proves credentials when `roleId` changes and checks
nothing for a plain rename or an enable/disable toggle, so a single label
overstates the weaker path. If a classification is meant to describe the whole
registration rather than its strongest branch, `update-user` needs splitting or
its gate needs widening. That is a decision, not a defect, and I have not touched
it.

## Commands run and observed results (this round)

All from `F:\!FluxIQ`.

1. `pnpm --filter fluxiq exec vitest run src/programs/identity-access`
   → `Test Files 3 passed (3)`, `Tests 38 passed (38)`
   (`handlers.test.ts` 9, `service.test.ts` 24, `run-credential-change.test.ts` 5).

2. **The new tests fail without the fix.** Same method as the first round: only
   `api/handlers.ts` and `runtime/service.ts` restored to their committed content
   with `git show HEAD:<path>`, every test left at its fixed version, no
   `git stash`, so no other worker's in-flight files were touched. Observed
   `Test Files 2 failed | 1 passed (3)`, `Tests 8 failed | 30 passed (38)` — the
   five from the first round plus:
   - `refuses to create an account without a credential recheck, and creates one after`
     → `expected { ok: true, payload: { …(8) } } to match object { ok: false, requiresRecheck: true }`
     (without the gate the administrator account was really created)
   - `refuses to start an authenticator enrollment for another user without a credential recheck`
     → `expected { ok: true, payload: { …(5) } } to match object { ok: false, requiresRecheck: true }`
     (that payload being the authenticator secret itself)
   - `refuses to confirm an authenticator enrollment before the code is ever checked`
     → `expected { ok: false, …(1) } to match object { ok: false, requiresRecheck: true }`

   Fixed files restored from the scratchpad copy, re-ran: `Tests 38 passed (38)`.

3. `pnpm --filter fluxiq check` (`tsc --noEmit`) → no output, exit 0.

4. `pnpm --filter @fluxiq/web check` (`tsc --noEmit`) → no output, exit 0.

5. `pnpm --filter @fluxiq/web exec vitest run src/features/programs/live-views/tests/identity-access.test.ts src/lib/tests/program-route.test.ts`
   → `Test Files 2 passed (2)`, `Tests 10 passed (10)`. The first of those reads
   the view's source and asserts every privileged mutation still routes through
   `operation.run`, including `create-user`, `begin-totp` and `confirm-totp`; it
   passes unedited, so the busy-gate contract survived the change.

6. `pnpm --filter fluxiq exec vitest run src/programs/tests/global-identity-access.test.ts src/programs/tests/permission-matrix.test.ts`
   → `Test Files 2 passed (2)`, `Tests 12 passed (12)`. These call `beginTotp` and
   `confirmTotp` as service methods rather than endpoints, so they are unaffected
   by the new handler gates — which is itself worth recording: the gate is at the
   wire, and in-process callers still reach the service directly.

7. `node scripts/structure-audit.mjs` → `structure-audit: passed (136 warning(s),
   256 baselined)`. One advisory worth knowing: `IdentityAccessService has 37
   methods, past the 25-method advisory threshold`. I added none, but the hard
   limit is 40 and the class is close to it.

8. `node scripts/validate-docs.mjs` →
   `Validated local links in 134 authored/reference Markdown files.`

Nothing was committed or pushed, and no working document was edited.

## Not verified (this round)

- **No live browser validation of the changed panel.** The type check, the view's
  own test and the endpoint tests all pass, but nobody has opened the Add User or
  Set up 2FA modal in a browser and completed the flow. That is the one gap I
  would close before this ships, and it needs the panel running, which I am not
  authorized to start.
- The `confirm-totp` positive path is proved only as far as "the recheck passes
  and the service rejects the wrong code". I did not generate a valid
  authenticator code in the endpoint tests, because the helper that does that
  lives in `programs/tests/totp-code.ts`, outside my paths. The service-level
  enrollment round trip is already covered by `global-identity-access.test.ts`.
- I did not run Core's full `pnpm test` or `pnpm build`, or the web app's full
  test suite, per your instruction to ignore the red automation-studio work.

## Still open after this round

1. **`update-user`'s response shape.** Unchanged from the first round: when its
   role-change recheck fails it throws, and the registry converts that to
   `{ ok: false, error }` with no `requiresRecheck`, so a client cannot tell
   "collect the factors again" from "you lack permission". Every other gated
   endpoint now answers in the `requiresRecheck` shape, which makes this the lone
   exception. It is a small handler change plus one line in the view's
   `saveRoleEdit`; I left it because it changes behaviour on a path you did not
   ask me to touch.
2. **The enrollment password lifetime** described above — a design call, not a
   defect.
3. **`update-user`'s split personality** under Phase P, described in the
   classification table above.
