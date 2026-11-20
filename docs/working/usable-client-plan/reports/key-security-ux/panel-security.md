# panel-security (t925, key-security-ux)

## Outcome
Done. All ten items are in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t925/!FluxIQ` (W = apps/web/src). Nothing committed. Not exercised in a live browser.

## What changed, by item
1. Four tabs. `page/SecurityTabs.tsx`, `SecurityTabPage.tsx`, `security-tabs.ts`; routes `/security/sign-in`, `/devices`, `/people`, `/activity` (new `page.tsx` each); `/security` redirects to `/security/sign-in`. `SecurityPage.tsx` deleted; the Keys summary is gone; `keys/**` untouched.
2. Your sign-in: new `sign-in/YourSignIn.tsx` (name, sign-in name, Change password, two-step in plain words, Sign out, link to Advanced). `change-password/ChangePasswordDialog.tsx` (Current / New / Repeat new password, inline "The new passwords do not match.", "Password changed."), `two-step/TwoStepSetupDialog.tsx` + `TwoStepOffDialog.tsx`, `SignOutButton.tsx`, `identity-call.ts`. Sign out (P27): `panel-shell/account/sign-out.ts` posts `/api/auth/logout` then goes to `/`, which shows the sign-in page; on failure it says so and stays. Users/roles/policy console is `/security/advanced` (`SecurityAdvancedPage`, `IdentityAccessLive`).
3. PIN removed from every person-facing surface: IdentityAccessLive (rows, menu, create-user field, authorization field, PIN credential kind), `ProofForm`, invite form. Authenticator code is asked only with two-step on (new `accounts/proof/two-step.ts` context, set from the route's `totpEnabled`). The wire still sends `authorizationPin: ""`.
4. Vault: confirmed nothing depends on it, so the row and the policy panel are removed. `vault` is read only by `unlockVault`/`lockVault`/`setVaultStatus` and the snapshot (service.ts:74,461-500,513,575,609); model access and key saving (`secretKeys.*`, `_shared/runtime.ts:392`) never read it. The snapshot validator still accepts `vault` because the server still sends it.
5. Devices and apps: `PairedClientsList` rewritten (one line "name · paired 9 Nov · last used 2 min ago", "Remove access", removed rows under "Removed (n)", no run-together text). `ConnectClientSection` is now the Devices page: waiting requests first (Approve / Decline), connected, how-to steps, panel address, discovery JSON and connection address behind "Technical details". Own styles in `connect/devices.css` (the old `settings-*` classes were in a file I do not own). The export name is unchanged so `SettingsPage.tsx` still compiles until the other worker removes the section.
6. `app/GlobalClientGatewayPairing.tsx`: no client id, Confirm has `data-autofocus`, Decline instead of Reject, plain wording.
7. People: `AccessSection` replaced by `access/PeopleSection.tsx` (people only). Role in words from `ACCOUNT_ROLES` (no permission ids, P29); the "changed by another administrator" line is gone (returns null for self). Invite asks the password only. "Invite created for X." plus Copy link only when the answer carries `payload.inviteUrl` (new `accounts/data/invite-link-of.ts`); otherwise no claim about email. The server does not return a link today, so Copy link does not show yet.
8. Activity: `activity/model/activity-sentence.ts`, `resource-words.ts` (decodes `key ~<hex>` to the key name, else "a key"; no hex), `is-system-activity.ts`; list shows one sentence per entry; "Show system activity" checkbox (default off) hides platform-admin entries, policy/service bookkeeping and lookups.
9. `app/connect/**` pages link to the panel (`OpenPanelLink` to `/security/devices`); `app/not-found.tsx` offers "Go to Home".
10. Top bar account menu: `panel-shell/account/AccountMenu.tsx` (Your sign-in, Sign out), in `TopBar.tsx`.

## Commands run and observed
- `pnpm --filter @fluxiq/web check` -> passed (tsc, no errors), run twice.
- `node scripts/structure-audit.mjs` (Core) -> "structure-audit: passed (549 warning(s), 914 baselined)". It failed first on five things I then fixed (swallowed catch x2, statement packing, `connect-` prefix, barrel import).
- Web vitest, all affected dirs (`features/security`, `accounts`, `settings-page`, `panel-shell`, `app/(panel)`, `app/connect`, `app/tests`): 753 passed, 1 failed (a dynamic-import timeout in my new tab test, then fixed with static imports); re-run of `features/security/page`: 10/10.
- New tests: tab bar order/links/current (`page/tests/security-page.test.tsx`), sign-out redirect and failure (`panel-shell/account/tests`, `sign-in/tests/your-sign-in.test.tsx`), password mismatch and success and refusal, two-step setup, folded removed devices (`security-page.test.tsx`, `connect.test.tsx`), invite link/no link, ProofForm password-only and code-only-with-two-step, pairing dialog, connect page links, activity sentences/hex/system, and `features/security/tests/no-pin.test.ts` (scans owned source, comments stripped, for "PIN").
- `grep -rniE "\bpin\b"` over owned sources: only wire fields (`pin: ""`, `authorizationPin`), `CredentialProof.pin?` and one comment. No UI text.

## Not verified
- No live browser run (tab styling, account menu, dialogs, sign-out redirect, focus on Confirm).
- Server side: a person who already has a PIN set will still be refused by `set-password`/invite if the server demands it. The brief's backend item (identity-access stops requiring and clears PINs) is still open.
- Ending your own session from People's "End session" still leaves the page on 401s (P27 covered only the Sign out button).
- Authored docs in `docs/architecture/` not updated.
- `SettingsPage.tsx` still renders `ConnectClientSection`, so Devices content shows in both places until the other worker removes it.

## Open questions
- Edited files that had CRLF line endings were rewritten with LF (`IdentityAccessLive.tsx`, `PeopleList.tsx`, `GlobalClientGatewayPairing.tsx`, `app/connect/*`, a few tests); expect whole-file diffs if the repo does not normalise.
- A hook blocked my `git checkout`, so I could not reset `IdentityAccessLive.tsx` after a partial scripted edit; it was finished by hand and the tests pass.
