# W5 unchanged fields in update-user (lane t901, W5, lead's decision 4): worker report

Worker: w5-unchanged-fields (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. I committed nothing, switched no branch and started no server. Every edit is inside the owned paths.

## Outcome

Done. In `update-user`, a value equal to the person's stored value no longer counts as a change. Both acceptance checks pass.

## The rule as built

- **Where it happens.** `api/handlers.ts` has a new local helper, `withoutUnchangedFields(service, payload)`. Before the endpoint decides anything, it reads the stored person in the same request (`service.snapshot()`) and drops each of `username`, `displayName`, `roleId` and `enabled` whose value equals the stored one.
- **What uses the result.** All three later steps take the stripped request:
  - the authority check (`authorityRefusal` → `refuseChangeHeldElsewhere`);
  - the credential recheck (`changesAuthority`);
  - the write (`service.updateUser`).

  Each step still decides by presence, but only changed fields are left to be present.
- **Values are compared exactly (`===`).** `updateUser` stores each value as sent: it does no trimming or case folding. Only sign-in lookup folds case. So a value that would be stored differently counts as a change. For example, `Holder@example.test` against a stored `holder@example.test` is still refused for an account holder. The assistant's input schema trims `username` before the handler sees it.
- **No change is ever written without a check.** A dropped field is never passed to `updateUser`. If another change lands between the read and the write, this request cannot overwrite it with a value it never checked. Every authority field that is written was present after stripping, so it went through the authority check and the recheck.
- **Unknown person.** No stored person is found, so the request is passed through whole and follows the same path as before. A role or on/off change is asked for proof first, and then `updateUser` fails with `Unknown user`.
- **A request that changes nothing** still calls `updateUser` with only the `id`. That writes no field, but it does bump `updatedAtMs` and persist. I left this as it is.
- **The service had to stay as it is.** `IdentityAccessService` is at 799 lines, and the hard limit is 800. It has no single-user read, so the handler reads the person from `snapshot()`.

## How the snapshot stays consistent

- **`IdentityAuthorityDelegation` is unchanged in behaviour.** Its `listing` still probes a real change (`{ id, enabled: true }`), so `authorityHeldElsewhere` still means "a real change of this person's sign-in name, role or on/off would be refused".
- **The doc comments now state the rule.** On `refuseChangeHeldElsewhere`: the endpoint strips unchanged values before asking. On `listing`: the flag speaks of real changes, and resent values are never refused.
- **One existing test was sending an unchanged value.** "marks each person exactly as update-user decides" sent `roleId: user.roleId`, which is unchanged, so under this rule it would no longer prove anything. It now sends a real change, `enabled: !user.enabled`.
- **A new test pins the other side.** Resending every person's current values passes for everyone, whether they are marked or not.

## Tests

All new tests are in `packages/fluxiq/src/programs/identity-access/api/tests/authority-held-elsewhere.test.ts`. They use the real identity service, the real endpoint and real provisioning. The file now has 23 tests; it had 16.

The new `describe("update-user with values equal to the stored ones")`:

- **Account holder, unchanged sign-in name.** Resending the unchanged username with a display-name edit succeeds. Only the display name changes: username (still equal to `account.email`), role, on/off, membership policies and account status are unchanged.
- **Account holder, real sign-in name change.** It is still refused with `identity.authority_managed_by_provisioning`, even next to an unchanged role. Nothing changes.
- **Account holder, unchanged role and on/off.** These pass with no proof and no `requiresRecheck`. A real on/off change or a real role change sent next to them is still refused by name.
- **Person without an account, unchanged values.** Unchanged username, role and on/off need no proof. A spy on `service.updateUser` shows that the written update contains no `username`, `roleId` or `enabled`.
- **Person without an account, real role change.** A real role change next to unchanged values still returns `requiresRecheck` and leaves the role as it was. With the proof, it succeeds.
- **Unknown person.** A display-name edit fails with `Unknown user`. A role change without proof gets `requiresRecheck`. With the proof, it fails with `Unknown user`. This is the same as before.

In `describe("the snapshot endpoint")`:

- The consistency test now uses a real change, as described above.
- A new test checks that resending current values is refused for nobody.

The existing presence-based tests in `handlers.test.ts` all send real changes, and they pass unchanged.

## Files changed (Core)

- `packages/fluxiq/src/programs/identity-access/api/handlers.ts`: adds `withoutUnchangedFields`; the `update-user` handler strips the request before the authority check, the recheck and the write; the `changesAuthority` comment is updated. The file is now 352 lines.
- `packages/fluxiq/src/programs/identity-access/runtime/authority/delegation.ts`: doc comments only.
- `packages/fluxiq/src/programs/identity-access/api/tests/authority-held-elsewhere.test.ts`: the header comment, the `vi` import, the consistency test changed, and 7 tests added.
- `docs/architecture/package-boundaries.md`: the `update-user` bullet of "Next minor (unreleased): Identity Access leaves an account holder's sign-in name, role and on/off to provisioning". It now states the rule: an unchanged value is not a change, it is compared exactly, and an unknown person is handled as before.

## Commands run and observed results

All commands ran from the Core worktree root.

**Free memory before vitest** (`powershell -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)"`):

- The first reading was 840 MB, so I waited.
- A background wait loop reported 2615 MB. A recheck right before the run read 1934 MB, so I waited again.
- The second wait reported 2785 MB, and the run started then. No vitest ran below 2000 MB.

**`pnpm structure:check`** → `structure-audit: passed (538 warning(s), 917 baselined).` I ran it twice, before and after the tests.

- None of the warnings is in a file I changed. The only identity-access warnings are the existing ones on `service.ts` and on two tests I did not touch.
- The total of 538 differs from the 534 in the earlier reports. That comes from other work in the tree.

**`pnpm --filter fluxiq exec vitest run src/programs/identity-access`** → `Test Files 12 passed (12)`, `Tests 113 passed (113)`, duration 352.73 s (mostly transform and collect).

- `authority-held-elsewhere.test.ts`: 23 passed.
- `handlers.test.ts`: 13 passed.

## Not verified

- **I did not run the new tests against the old code.** The claim that they would have failed before rests on reading the old presence check: the unchanged-username case and the unchanged role/on-off case would have been refused, and the no-proof case would have returned `requiresRecheck`.
- **No whole-package typecheck and no library build.** The brief leaves both to the supervisor. vitest's transform does not type-check.
- **No web tests, and no live server.**
- **The cost of reading `snapshot()`.** Each `update-user` request now makes one in-memory snapshot read: all users with their credential status, plus the session list. I did not measure it on a large workspace.

## Open questions or contradictions found

1. **Changing `updateUser` needs a decision first.** A single-user read on `IdentityAccessService` would be cleaner than `snapshot()`, but `service.ts` is at 799 of its 800 lines. Adding one means moving methods onto a collaborator first, which the class-methods warning already asks for.
2. **Comparison is case-sensitive.** Sign-in lookup folds case, so an account holder resending their email in different case is a real stored change and is refused. That follows "the value the store would keep". If case-only differences should pass, `updateUser` would have to normalise usernames as it stores them, and that is a broader change.
3. **No UI change is needed.** The sign-in page already sends only `displayName` for managed people. With this change, older or outside clients that resend the username also work.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/programs/identity-access/{api/handlers.ts,runtime/authority/delegation.ts,api/tests/authority-held-elsewhere.test.ts}; docs/architecture/package-boundaries.md (update-user note)
Validation: `pnpm --filter fluxiq exec vitest run src/programs/identity-access` -> 12 files / 113 passed; `pnpm structure:check` -> passed (538 warnings, 917 baselined, none in changed files)
Not verified: new tests against the old code (reasoned only); typecheck/library build (supervisor's); web tests; snapshot-read cost per update-user
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-unchanged-fields.md
Notes: update-user drops fields equal to the stored value (exact compare) before the authority check, recheck and write; a real change is decided as before.
Snapshot flag unchanged in meaning (real changes); its consistency test now sends a real change.
Stored person read via service.snapshot() because service.ts is at 799/800 lines.
```
