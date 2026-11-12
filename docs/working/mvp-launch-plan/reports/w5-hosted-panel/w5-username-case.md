# W5 username case (lane t901, W5): worker report

Worker: w5-username-case (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing committed, no branch switched, no server started, no library build. Every edit is inside `packages/fluxiq/src/programs/identity-access/**` and the update-user note of `docs/architecture/package-boundaries.md`.

## Outcome

Done. Both acceptance checks pass. There was **no uniqueness check at all before this change**: the service let two people have the same sign-in name, even an exact match. This change adds one, in the service, and makes the update-user unchanged-field check ignore case.

## The comparison (one function)

`runtime/usernames/username-key.ts`: `usernameKey(name) = name.toLowerCase()`.

- This is Unicode's default lower-casing and does not depend on locale. Sign-in already folded case this way, so I kept it rather than switching to `toLocaleLowerCase("en-US")`. For en-US the two give the same result.
- It does not trim, and it does not apply NFC/NFKC normalisation or full case folding.
- Three places now use it: sign-in (`authenticate`, unchanged in behaviour: the input is still trimmed and then keyed), the uniqueness check, and the update-user unchanged check. None of them can disagree with another.

## What was built

1. **Uniqueness, in the service** (`runtime/usernames/refuse-taken-username.ts`, called from `upsertUser` and `updateUser`).
   - A write is refused with `IdentityUsernameTakenError` (code `identity.username_taken`) when the new name's key equals another person's key and differs from the person's own current key.
   - If no name is written, nothing is checked.
   - Because it is in the service, it covers every caller: the `create-user` and `update-user` endpoints, and provisioning's `createAccount` and its other `upsertUser` calls.
   - `create-user` and `update-user` answer the refusal as `{ ok:false, error, errorCode:"identity.username_taken" }` through a small `written()` wrapper in `api/handlers.ts`. The registry's generic catch reads `error.diagnostic.code`, not `error.code`, so the wrapper is needed.
2. **The unchanged-field check** (`withoutUnchangedFields` in `api/handlers.ts`).
   - A `username` whose key equals the stored name's key is not a change for any decision. It is never refused by the authority check and never needs a recheck.
   - **Held elsewhere** (an account holder, or an owner that cannot answer): the name is dropped and nothing is written for it.
   - **Held here** (a person without an account): a name that differs only by case is written as sent. This satisfies "renaming yourself to your own name in another case is allowed and stored as sent" at the endpoint. An exact resend is still dropped.
   - The check costs one extra owner probe, and only when the case differs.
   - `displayName`, `roleId` and `enabled` are still compared exactly.
   - **Decision for the supervisor:** if case-only renames should be dropped for everyone (the lead's words taken literally), delete the `recased` branch. That is a one-line change, but then nobody could correct a name's case through update-user.
3. **Names that already differ only by case.** The rule for the count:
   - Stored data is never rewritten, and loading both names works.
   - An update that writes no name always works.
   - Re-casing your own name always works, because your key is unchanged and no new clash is made.
   - Moving to a free name works. After that, the other person cannot take the name either.
   - Moving onto any other person's key is refused, and so is a third person taking the shared key.
   - So the number of people sharing a key can only stay the same or fall, never rise.
4. **Sign-in today, with case.** `authenticate` trims the typed name, lower-cases it and takes the first stored person with an equal lower-cased name, in load order.
   - With an existing case-duplicate, only the person stored first can sign in by name. The second always gets "Invalid username or credentials", even with their own password.
   - If the first is disabled, nobody with that name can sign in.
   - A test pins this. I did not change sign-in matching; the uniqueness check does not require it.
5. **To stay under the 800-line limit**, I moved `TotpRequiredError` out of `service.ts` into `runtime/totp-required-error.ts`.
   - The program barrel exports it, so `fluxiq` still exports it and every consumer imports through a barrel. This also fixes that file's "one exported class" violation.
   - `service.ts` is now 796 lines.
   - The baseline entry `exported-values service.ts::classes: 2` can now shrink. I did not run `pnpm structure:baseline` because that file is shared.

## Files (Core)

- New: `runtime/usernames/{index.ts,username-key.ts,refuse-taken-username.ts}`, `runtime/username-taken-error.ts`, `runtime/totp-required-error.ts`.
- Changed: `runtime/service.ts` (uniqueness calls, sign-in uses `usernameKey`, `TotpRequiredError` moved out), `api/handlers.ts`, `index.ts` (exports both new errors).
- Tests:
  - New `runtime/usernames/tests/refuse-taken-username.test.ts` (8).
  - New `runtime/tests/service-usernames.test.ts` (9, including stored case-duplicates loaded from a repository, and sign-in).
  - New `api/tests/username-case.test.ts` (6).
  - `api/tests/authority-held-elsewhere.test.ts` (26, was 23). The old "real sign-in name change" test sent `Holder@example.test`, which is now a case-only resend that passes, so it now sends `someone.else@example.test`. Added: the account holder resends their email in another case and no name is written; renaming a person without an account onto the holder's email in another case is refused; with an owner that cannot answer, a case-only resend passes and writes no name.
- Doc: `docs/architecture/package-boundaries.md`, the update-user bullet only.

## Commands run and observed results

From the Core root:

- `pnpm structure:check` → `structure-audit: passed (537 warning(s), 916 baselined).` The only identity-access warnings are on `service.ts` (40 methods; 796 lines past the 400 advisory) and on tests I did not touch, and all of them were there before.
- Free memory read 557 MB at first. A background wait reported 2639 MB, and a recheck read 2516 MB just before the run.
- `pnpm --filter fluxiq exec vitest run src/programs/identity-access` → `Test Files 15 passed (15)`, `Tests 139 passed (139)`, duration 223 s.

## Not verified

- **No typecheck.** The brief forbids a whole-package typecheck, and vitest does not type-check.
- **Tests outside identity-access were not run.** That includes `programs/tests/global-identity-access.test.ts`, which imports `TotpRequiredError` through the barrel; free memory was back at 1972 MB. I also did not run provisioning or apps/web tests.
  - I grepped every `upsertUser` call in packages and apps for one name used under two ids, and found none outside my new tests.
  - The `reset.test.ts` re-upsert uses the same id, so it passes the new check.
- **The provisioning path was not tested.** In `createAccount`, an email that a person without an account already holds in any case now throws `IdentityUsernameTakenError` at `upsertUser`, the first write, so nothing is half-done. Provisioning does not map that code, so it comes out as a generic error. Before this change, it silently created a second person with the same sign-in name, which made sign-in ambiguous.

## Open questions or contradictions found

1. **The brief's goals pulled against each other.** "Nothing is written" for a case-only name conflicts with "stored as sent" for a self-rename. I resolved it by where the name is held (point 2 above). Please confirm, or ask for the one-line drop-for-everyone variant.
2. **Provisioning should probably answer `identity.username_taken` by name** (for example as `email_taken`), the same way it answers `identity.last_administrator`. That is in `platform/**`, which I may not touch.
3. **`pnpm structure:baseline`** can shrink the `service.ts::classes` entry. The supervisor should run it on the shared baseline.

## Later: storage normalisation with a migration

- **Store a key beside each name.** Each stored user record would carry `usernameKey` beside `username`, with the display form kept as sent.
- **Write a load-time migration.**
  - The migration fills in the key for every user record.
  - It also reports every group of people who share a key.
  - It should not merge or rename anyone silently. Each group needs a decision: keep the person stored first (who is the only one who can sign in today), and rename or disable the others with a notice. Provisioning should also be asked, because an account holder's name must stay their account email.
- **Lookup and uniqueness then use the stored key.** Sign-in could become a key lookup with a `refuse if more than one match` guard, instead of first-match-wins.
- **Settle the key's definition first.** Consider `trim()` plus NFKC plus full case folding, in place of the current lower-casing only. That would decide, for example, whether `ß`/`SS` and composed/decomposed forms are the same name. Make it match provisioning's `normalizeEmail` (`trim().toLowerCase()`) for email-shaped names. Change `usernameKey` in one place; the migration then recomputes every stored key.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/programs/identity-access/{api/handlers.ts,index.ts,runtime/service.ts,runtime/totp-required-error.ts,runtime/username-taken-error.ts,runtime/usernames/*,runtime/usernames/tests/refuse-taken-username.test.ts,runtime/tests/service-usernames.test.ts,api/tests/username-case.test.ts,api/tests/authority-held-elsewhere.test.ts}; docs/architecture/package-boundaries.md (update-user note)
Validation: `pnpm --filter fluxiq exec vitest run src/programs/identity-access` -> 15 files / 139 passed; `pnpm structure:check` -> passed (537 warnings, 916 baselined)
Not verified: typecheck; tests outside identity-access (global-identity-access barrel test, provisioning, apps/web); provisioning createAccount now throws username_taken for a case-colliding non-account person
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-username-case.md
Notes: No uniqueness check existed; added in the service (toLowerCase key shared with sign-in and the unchanged check).
Case-only own-name resend: dropped where held elsewhere, written as sent where held here (one-line switch if unwanted).
TotpRequiredError moved to its own file to keep service.ts under 800 lines; baseline may shrink.
```
