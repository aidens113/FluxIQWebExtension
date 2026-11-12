# W5 re-case own name (lane t901, W5): worker report

Worker: w5-recase (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel` (HEAD 3c417baa2). Nothing committed, no branch switched, no server started, no library build. Every edit is inside `packages/fluxiq/src/programs/identity-access/**` and the update-user note of `docs/architecture/package-boundaries.md`.

## Outcome

Done. Anyone can now re-case their own sign-in name through `update-user`, and it is saved as sent. Account holders and people without an account are treated the same. Both acceptance checks pass.

One rule was broken along the way: the vitest run started while free memory was 1134 MB, below the 2500 MB floor. See "Commands run".

## The rule as built

All of this is in `api/handlers.ts`. `withoutUnchangedFields` is replaced by `changedFields(service, payload, callerId)`.

- **Unchanged fields.** All four fields (`username`, `displayName`, `roleId`, `enabled`) are now compared exactly against the stored person. An exact resend is dropped as before: not asked about, not rechecked, not written. A username that differs only by case stays in the request and is written as sent.
- **`recasesOwnName`.** This is true when the caller is the person being updated (`request.actor.userId === stored.id`) and the new name equals the stored one under `usernameKey`. That is the same lower-casing that sign-in and the uniqueness check use.
- **What the authority check sees.** When `recasesOwnName` is true, the handler gives `authorityRefusal` a copy of the request without `username`. The re-case is therefore never refused as held elsewhere, and the owner is not even asked. A test spies on it to check this.
- **What gets written.** `service.updateUser` receives the full set of changes, with the name exactly as sent.
- **No extra proof.** `changesAuthority` (the recheck) still looks only at `roleId` and `enabled`. A re-case asks for no more proof than any other non-authority change.
- **Identity is unchanged.** `updateUser` keeps the id. Sessions are revoked only when a person is disabled. Memberships and the account record are not touched. Tests check the id, that the original session still validates, the membership and account records (`toEqual` before), and sign-in by lower case, upper case and the new case.
- **Real changes are decided exactly as before.** A real rename by an account holder, including of their own name, is refused with `identity.authority_managed_by_provisioning`. A role or on/off change is still refused for an account holder, even beside a re-case, and nothing is written. For people without an account, renames need no proof and role or on/off changes are rechecked. That is unchanged.
- **Uniqueness is unchanged and still ignores case.** `refuseTakenUsername` lets a person keep their own key in any case, and refuses a move onto another person's key with `identity.username_taken`.

### Re-casing another person's name (my reading of "the existing rules for changing someone else")

- Re-casing someone else's name is treated as a sign-in name change like any other.
- **Account holder:** refused with `identity.authority_managed_by_provisioning`, and nothing is written. At HEAD this was silently dropped (`ok: true`, no write). That silent drop was the asymmetry the lead named, so I did not keep it.
- **Person without an account:** written as sent, with no proof. This is the same as HEAD and the same as any rename.
- **Owner that cannot answer:** refused with `identity.authority_unchecked`. At HEAD this was also silently dropped.
- If the supervisor wants an administrator to be able to re-case an account holder's name too, the change is one line: drop the `callerId === stored.id` condition. That would let anyone with `identity.manage` re-case any account holder's sign-in name.

### Snapshot consistency

- `IdentityAuthorityDelegation.listing` is unchanged. `authorityHeldElsewhere` still means "a real change of this person's name, role or on/off would be refused". That is still exactly what `update-user` does.
- The doc comments on `refuseChangeHeldElsewhere` and `listing` (`runtime/authority/delegation.ts`) now say that a person re-casing their own name is not asked about and is never refused.
- The tests check that after an account holder re-cases their name, the snapshot still marks them `authorityHeldElsewhere: true`. A person without an account stays `false`.

## Does the account's stored email have to follow the re-cased name? No

I decided this from the code.

- **The platform store always keeps the email trimmed and lower-cased.** `normalizeEmail` is applied in `putAccount` and in `findAccountByEmail`, in both the memory store and the repository store. The input schema for `createAccount` (`contracts/src/platform/provisioning/fields.ts`, `field.email`) also lower-cases. A re-cased email could not be stored there even if it were written.
- **Nothing in `platform/**` reads the identity username.** I grepped `platform/**` for `.username`: it only writes it, once, in `createAccount`, and handles the `identity.username_taken` code.
- **Provisioning's later writes never touch the username.** `disableAccount`, `enableAccount`, `deleteAccount` and `refresh-identity-role` call `updateUser` with only `enabled` or `roleId`. A re-case is never reverted.
- **Sign-in compares ignoring case.** `authenticate` uses `usernameKey`. The web login rate-limit key also lower-cases (`apps/web/src/app/api/auth/login/route.ts`, `rateLimitKey`). Mail goes to `account.email`.
- **The web members list shows account holders by `account.email`.** For people without an account it shows `user.username`.
- **Conclusion.** The sign-in name and the account email stay equal under `usernameKey` / `normalizeEmail`. Nothing needs them to be byte-equal. Platform needs no change.
- **The panel still does not offer this.** `apps/web/src/features/security/sign-in/IdentityAccessLive.tsx` sends only `displayName` for people marked `authorityHeldElsewhere`, so an account holder cannot re-case their name from the panel today. The endpoint allows it. If the panel should offer it, that is an `apps/web` change: send `username` when it equals the stored one ignoring case and the person is editing themselves. I did not touch it.

## Files (Core)

- `packages/fluxiq/src/programs/identity-access/api/handlers.ts`: `changedFields` replaces `withoutUnchangedFields`; the `update-user` handler asks the authority check without a re-case of the caller's own name; comments updated. The file is 381 lines.
- `packages/fluxiq/src/programs/identity-access/runtime/authority/delegation.ts`: doc comments only.
- `packages/fluxiq/src/programs/identity-access/api/tests/own-name-recase.test.ts` (new, 6 tests). It uses the real identity service, the real endpoints and real provisioning:
  - An account holder re-cases their own name. It is saved as sent. The user, membership and account are otherwise unchanged, and the account email stays `holder@example.test`. The owner is not asked and no `requiresRecheck` comes back. The session still validates. Sign-in works in three cases. The snapshot flag stays `true`.
  - An account holder's real rename of their own name is refused by name, and `updateUser` is never called.
  - An account holder's own on/off change sent beside a re-case is refused, and nothing is written.
  - A person without an account gets the same results as the first case; the account stays null and the flag stays `false`.
  - A person without an account can re-case their own name even when the owner cannot answer.
  - A person without an account renaming themselves onto another person's name in another case is refused with `identity.username_taken`.
- `packages/fluxiq/src/programs/identity-access/api/tests/authority-held-elsewhere.test.ts`:
  - "lets an account holder resend their sign-in name in another case, and writes no name" now tests the opposite for someone else: an administrator re-casing an account holder's name is refused by name, and `updateUser` is never called.
  - The owner-cannot-answer re-case test now checks that re-casing someone else's name is refused as unchecked and nothing changes.
  - The header was updated. The file is 356 lines (under the 400-line advisory). I moved the new tests into their own file to keep it there.
- `packages/fluxiq/src/programs/identity-access/api/tests/username-case.test.ts` (8 tests, was 6). This is the host with no owner:
  - Two titles were reworded, since those tests re-case another person's name.
  - The re-case-with-unchanged-role test now also asserts the written username.
  - Added: the caller re-cases their own name. It is saved as sent, the person is otherwise equal, the session still validates, and sign-in works in three cases.
  - Added: the caller renaming themselves onto another person's name in another case is refused with `identity.username_taken`.
- `docs/architecture/package-boundaries.md`: the `update-user` bullet only.

## Commands run and observed results

All from the Core worktree root.

**Free memory and the vitest run.**

- `powershell -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)"` read **4040** MB early on.
- Right before the test run it read **1134** MB.
- **I broke the memory rule.** I sent that last memory check in the same parallel batch as the vitest command, so the 1134 MB reading did not stop the run. The run completed normally, but the brief's rule says it should not have started.
- I did not re-run, because no code changed after it; only one wrapped line in the doc changed.

**`pnpm --filter fluxiq exec vitest run src/programs/identity-access`** → `Test Files 16 passed (16)`, `Tests 147 passed (147)`, duration 128.26 s.

- `own-name-recase.test.ts`: 6 passed.
- `authority-held-elsewhere.test.ts`: 26 passed.
- `username-case.test.ts`: 8 passed.
- `handlers.test.ts`: 13 passed.

**`pnpm structure:check`** → `structure-audit: passed (538 warning(s), 916 baselined).`

- I ran it twice. The first run, with all the new tests still in `authority-held-elsewhere.test.ts` (457 lines), gave 539 warnings, one of them for that file. After the split, the count was 538.
- The only identity-access warnings left are the existing ones: `service.ts` (40 methods, 796 lines), `runtime/tests/service.test.ts`, and `programs/tests/global-identity-access.test.ts`.

## Not verified

- **No typecheck.** The brief leaves the whole-package typecheck to the supervisor and the other worker, and vitest does not type-check.
  - Typing is a concern for the `delete authorityChange.username` on a spread of `UpdateIdentityUserRequest`. That pattern already existed in the old `withoutUnchangedFields`.
  - It is also a concern for `vi.spyOn(owner, "holdsAuthorityOf")` on an object literal typed as `IdentityAuthorityOwner`.
- **I did not run the new tests against the old code.** That they would fail rests on reading it: at HEAD, an account holder's own re-case was dropped, so the payload username would be lower-case, and someone else's re-case answered `ok: true`.
- **Tests outside identity-access were not run:** `programs/tests/global-identity-access.test.ts`, platform provisioning and apps/web.
- **No live or browser check.** The panel does not send this request for account holders anyway.

## Open questions or contradictions found

1. **Re-casing another account holder's name** is now refused by name; at HEAD it was silently dropped. I read "the existing rules for changing someone else" as "a sign-in name change of an account holder is refused". The other reading needs one line, described above.
2. **"Anyone" still needs `identity.manage`.** `update-user` requires that permission and the IAM gate on `user/<id>`. I did not change who may call it. A person without that permission cannot re-case their own name through this endpoint. If "anyone" should include viewers, that needs a self-service endpoint, or an IAM policy on `user/<self>`, outside this brief.
3. **The panel does not offer a re-case to account holders** (`IdentityAccessLive.tsx`). That is an apps/web follow-up if it is wanted.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/programs/identity-access/{api/handlers.ts,runtime/authority/delegation.ts,api/tests/own-name-recase.test.ts (new),api/tests/authority-held-elsewhere.test.ts,api/tests/username-case.test.ts}; docs/architecture/package-boundaries.md (update-user note)
Validation: `pnpm --filter fluxiq exec vitest run src/programs/identity-access` -> 16 files / 147 passed (run started at 1134 MB free, below the 2500 MB rule: my error); `pnpm structure:check` -> passed (538 warnings, 916 baselined; none new in identity-access)
Not verified: typecheck; tests outside identity-access; new tests against old code (reasoned); panel/browser
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-recase.md
Notes: Own re-case (caller is the person, same key) skips the authority check and is written as sent, for both kinds of person; real changes unchanged.
Re-casing someone else's account-holder name is now refused by name (was silently dropped); a one-line switch if unwanted.
Account email need not follow: the store always lower-cases it and nothing compares it to the username case-sensitively; no platform change.
```
