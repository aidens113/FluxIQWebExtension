# W5 IAM follow-up (lane t901, W5): worker report

Worker: w5-iam-followup (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing committed, no branch switched, no server started. Every edit is inside the owned paths; `apps/web/src/lib/fluxiq.ts` did not need to change.

## Outcome

Done. All three tasks are built and tested, and all four acceptance checks pass.

## What changed and why

### Task 1: the snapshot says who is managed, and the sign-in page hides their controls

**Core.** The flag reuses the same decision `update-user` makes.
- **`IdentityAuthorityDelegation.listing(snapshot)`** (`runtime/authority/delegation.ts`) marks each user with `authorityHeldElsewhere`.
  - It works by calling `refuseChangeHeldElsewhere({ id, enabled: true })` itself, so the flag cannot drift from `update-user`.
  - Managed refusal: true.
  - Unchecked refusal (the owner throws): true. This matches `update-user`, which refuses that case too.
  - No owner set: false.
- **New types** in `types.ts`:
  - `IdentityAccessListedUser = User & { authorityHeldElsewhere: boolean }`;
  - `IdentityAccessListing`.
- **The `snapshot` endpoint** now answers `service.authority.listing(await service.snapshot())`. `IdentityAccessSnapshotResponse` is now `IdentityAccessListing`.
- **`IdentityAccessService.snapshot()` is unchanged on purpose.** `deps-for-request`, `list-members`, `retire-default-admin` and the paired-client actor call it, and none of them should pay one owner lookup per user. The 799-line `service.ts` is untouched.

**Web** (`features/security/sign-in/`):
- **`IdentityAccessLive.tsx`, for a person with `authorityHeldElsewhere`:**
  - The row menu leaves out "Change role" and "Enable/Disable user".
  - The Role cell shows the role followed by a "Managed under Access" link.
  - The detail panel says "This person has an account: their sign-in name, role and whether they can sign in are Managed under Access".
  - The profile dialog shows the username read-only, with the hint "Their sign-in name is their account email.", and sends only `displayName`.
  - The role and on/off dialogs use a new `subjectHeldHere` check. If a refresh shows the person is now managed, the dialog closes and its retained submit sends nothing.
  - `saveRoleEdit` and `saveEnabledEdit` also refuse a managed person.
  - The snapshot check now requires a boolean `authorityHeldElsewhere`, so a snapshot without it is rejected rather than shown with every control.
- **People without an account keep every control.**
- **New `ManagedUnderAccess.tsx`** renders `<a href="/security#security-access">Managed under Access</a>`, linking to the `h2 id="security-access"` heading in `AccessSection`.
- **Fixtures.** The test fixtures in `identity-access-recovery`, `identity-subject-ownership` and `your-sign-in` gain `authorityHeldElsewhere: false`.

### Task 2: an account holder's username

- **`refuseChangeHeldElsewhere` also covers `username`.** It decides by presence, as it already does for `roleId` and `enabled`.
- **In the handler, `authorityRefusal` now runs for every update.**
  - It returns at once when no `username`, `roleId` or `enabled` is present.
  - It comes before the credential recheck, which still applies only to `roleId` and `enabled`.
  - So an account holder's rename is refused with `identity.authority_managed_by_provisioning`, and a display-name change still works without proof.
- **A username sent together with a display name is refused as a whole.**
- **The error message** now names the sign-in name and says it is the account email. The unchecked error's message changed the same way.
- **The assistant summary for `update-user`** now says an account holder keeps their email as their sign-in name.
- **Why presence and not "only when the name differs".** It matches how `roleId` and `enabled` are decided, and the UI no longer sends `username` for managed people.
- **No provisioning path changes a username after `createAccount`.** I checked `platform/provisioning/operations`, so the account email is the only source of the name.

### Task 3: docs

- **`docs/architecture/platform.md`:**
  - The Status paragraph now says route decisions are recorded on every profile: allowed state changes and refusals, not allowed reads.
  - The `audit/` row of the Layout table gains `IamDecisionAuditFilter` and `iamReadActionsOf`.
  - A "What is persisted" paragraph is added under Audit.
  - Three paragraphs are added to "Web workspace manager": `workspaceIam` per workspace, `WorkspaceDecisionAudit` (route decisions persisted on every profile, allowed reads not persisted), and the account holders' authority owner together with the snapshot flag and "Managed under Access".
  - The Known gaps audit bullet gains two lines: per-item `service` filter denials, and ordering within one second.
- **`docs/architecture/package-boundaries.md`:**
  - New migration note: "Next minor (unreleased): Identity Access leaves an account holder's sign-in name, role and on/off to provisioning (`fluxiq`)". It covers the delegation, `update-user` and `snapshot`.
  - The 0.6.0 `update-user` bullet gains a pointer to that note.
- **`docs/operations/data-and-state.md`:** a paragraph on audit volume. It fills on every profile, and covers what counts as a row, buffering, and per-item filter denials under `service`.

## Commands run and observed results

All commands ran from the Core worktree root. Free memory was checked before each vitest run, and every run started at or above 2000 MB: 2341, 4020, 2945, 3041, 2006.

**Acceptance checks:**
- `node scripts/structure-audit.mjs --rule docs-links` -> `structure-audit: passed (0 warning(s), 0 baselined).`
- `pnpm structure:check` -> `structure-audit: passed (534 warning(s), 917 baselined).` This ran after all source files existed.
- `pnpm --filter fluxiq exec vitest run src/programs/identity-access`:
  - first run: 2 of 106 failed. My two snapshot tests expected one user, but the service seeds a default `admin`. I fixed the assertions.
  - after the fix: `Test Files 12 passed (12)`, `Tests 106 passed (106)`.
- **Library build:** `node .../heavy-slot.mjs run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` -> exit 0, with 0 `error TS` lines in the log. The `fluxiq` tsc build type-checks the Core changes.
- `pnpm --filter @fluxiq/web exec vitest run src/features/security src/lib/tests` -> `Test Files 24 passed (24)`, `Tests 282 passed (282)`. This ran after the build.

**Extra runs:**
- `vitest run src/features/security/sign-in --reporter verbose` -> 6 files, 59 passed, including all 8 new `managed-under-access` tests. The only stderr is the existing "react-test-renderer is deprecated" warning.
- Core `authority-held-elsewhere.test.ts` alone -> 16 passed.

New tests:
- **Core**, in `authority-held-elsewhere.test.ts`:
  - renaming an account holder is refused by name, and the username stays equal to `account.email`;
  - a username sent with a display name is refused, and neither changes;
  - a person without an account can still rename, with no proof needed;
  - the snapshot marks the holder true and others false;
  - each snapshot flag equals what `update-user` decides for that person;
  - an owner that throws marks everyone true;
  - with no owner, nobody is marked.
- **Web**, in `managed-under-access.test.tsx`:
  - a managed person has no role or on/off controls, and a link to `/security#security-access`;
  - a person without an account keeps every control;
  - the detail panel shows the note;
  - a managed person's profile dialog sends only `displayName`, and the username is read-only;
  - a person without an account still sends `username`;
  - for both the role and the on/off dialog, a refresh that marks the person managed closes it and its retained submit sends nothing;
  - a snapshot without the flag is refused.

## Not verified

- **No whole-package typecheck of `apps/web`**, per the brief. The web files were checked only by vitest's transform. In particular, nothing type-checked that the spread `MenuOption` entries and the `IdentityAccessListedUser` typing in `IdentityAccessLive.tsx` compile.
- **No live server or browser.**
  - I did not open the link. That `/security#security-access` scrolls to Access rests on reading `AccessSection.tsx`.
  - I did not check how the read-only username input looks.
- **Snapshot cost.** The `snapshot` endpoint now makes one `platformAuthorityOwner` lookup per user, each a `getPlatformServices()` and a store `getAccount`. I did not measure it on a large workspace.

## Open questions or contradictions found

1. **Presence versus difference.** `update-user` refuses `username` for an account holder whenever it is present, even if unchanged. An outside client that always sends `username` with a display-name edit, as the old sign-in page did, will now be refused for account holders. The page no longer does this. If unchanged names should pass, the handler would need to compare against the stored user.
2. **A failed owner is shown as managed.** When the owner cannot answer, the page shows "Managed under Access" for people who may have no account. This follows the brief's rule (match `update-user`, which refuses them), but the wording is then not literally true. A separate "could not check" state would need a third value.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/programs/identity-access/{types.ts,api/contracts.ts,api/handlers.ts,runtime/authority/{delegation,managed-error,unchecked-error,index}.ts,api/tests/authority-held-elsewhere.test.ts}; apps/web/src/features/security/sign-in/{IdentityAccessLive.tsx,ManagedUnderAccess.tsx (new),tests/managed-under-access.test.tsx (new),tests/identity-access-recovery.test.tsx,tests/identity-subject-ownership.test.tsx,tests/your-sign-in.test.tsx}; docs/architecture/platform.md; docs/architecture/package-boundaries.md; docs/operations/data-and-state.md
Validation: `pnpm --filter fluxiq exec vitest run src/programs/identity-access` -> 12 files / 106 passed; `pnpm --filter @fluxiq/web exec vitest run src/features/security src/lib/tests` -> 24 files / 282 passed; `pnpm structure:check` -> passed (534 warnings, 917 baselined); docs-links rule -> passed; library build -> exit 0, 0 error TS
Not verified: whole-package web typecheck (per brief); live browser rendering and the /security#security-access link; snapshot cost of one owner lookup per user
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-iam-followup.md
Notes: The snapshot flag reuses update-user's own decision, so they cannot drift; an owner that cannot answer marks everyone managed.
An account holder's username is refused whenever it is present, and the page now sends only displayName for them.
fluxiq.ts unchanged; IdentityAccessService.snapshot() unchanged (only the endpoint adds the flag).
```
