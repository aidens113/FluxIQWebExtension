# W5 IAM root fixes (lane t901, W5): worker report

Worker: w5-iam-root (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing committed, no branch switched, no server started.

## Outcome

Done. Both tasks are built and tested, and all three acceptance commands pass.

Two edits fall outside the brief's listed paths:

- **`apps/web/src/lib/fluxiq.ts`.** The lead approved it mid-task, saying "apps/web/src/lib/fluxiq.ts is inside W5's owned paths (apps/web/**)". I edited it for both tasks, and sent the lead a message saying so.
- **`apps/web/src/lib/tests/fluxiq.test.ts`.** This is that file's own test. Its fake instance needed two fields, and it now holds the wiring tests the lead asked for.

## Task 1: `update-user` and stale workspace policies

### Choice: refuse, by name

`update-user` now refuses to change the role or on/off of a person who has a platform account. The refusal is `identity.authority_managed_by_provisioning`, and it says to use provisioning instead.

I chose refusal over routing because of what the code does:

- **The sign-in role is derived, not stored independently.** `refreshIdentityRole` (provisioning) sets the identity `roleId` from the policies of all the person's active memberships, using `identityRoleForPolicies`, which is many-to-one.
- **Routing would have to guess.** One `roleId` from `update-user` cannot say which workspace's membership to change, or which policy to attach. A viewer maps to Read only, and under `service` it could also map to Member. Turning it into `setPolicies` would mean guessing, and on a multi-tenant account it could change the wrong membership.
- **Refusal keeps one source of truth.** The membership's policies, written only by provisioning, decide the role.
- **On/off is refused for the same reason.** For an account holder, provisioning owns the account's status too (`disableAccount`, `enableAccount`, scheduled deletion).
  - Today `update-user {enabled:false}` leaves the account `active` while sign-in is off.
  - Worse, `{enabled:true}` would let a person sign in again whose account provisioning disabled, or scheduled for deletion.
  - Renaming stays allowed.

### How it works

- **Core: `programs/identity-access/runtime/authority/`.**
  - `IdentityAuthorityDelegation`:
    - The service carries one, as `service.authority`.
    - `holdElsewhere(owner)` hands account holders' authority to an owner. It can be set only once: the same owner again does nothing, and a different one throws.
    - `refuseChangeHeldElsewhere(update)` checks a role or on/off change and throws when the person's authority is held elsewhere.
  - Two named errors:
    - `IdentityAuthorityManagedError` (`identity.authority_managed_by_provisioning`).
    - `IdentityAuthorityUncheckedError` (`identity.authority_unchecked`). This one fails closed when the owner cannot answer, and never echoes the cause.
  - The `IdentityAuthorityOwner` port is in `types.ts`.
- **The `update-user` handler** asks before the credential recheck, so a refused call spends no attempt. It answers `{ ok:false, error, errorCode }`.
  - Provisioning still writes through `IdentityAccessService.updateUser` directly, and that path never asks.
  - With no owner set (a Core host without provisioning), behaviour is unchanged.
- **Web: `server/provisioning-listener/platform-authority-owner.ts`.**
  - "Has a platform account" means `platform.store.getAccount(userId) !== null`. That is the same rule `/api/accounts/members` uses to tell `account` people from `identity` people.
  - It composes the platform services on first use.
- **Web: `lib/fluxiq.ts`** installs the owner on every workspace instance as it is created: the primary, each reload, and each tenant. A lazy installation would have left a window in which a change got through.

### Accounts routes

The special case is still needed, so I did not simplify anything. People with an account must use provisioning (`/api/accounts/member`), and `update-user` now refuses them. People without an account still use `update-user`.

I updated only the comments that explain this:

- `features/accounts/data/apply-member-change.ts`;
- `features/accounts/model/types.ts`.

## Task 2: route decisions persisted on every profile

- **Core `platform/iam/audit/decision-filter.ts`: `IamDecisionAuditFilter`.** It sits in front of a sink and does the following:
  - keeps every `deny`, including refused reads;
  - keeps every `iam-change`;
  - keeps every `allow` of an action that changes state;
  - drops the `allow` of a read;
  - passes records through unchanged;
  - never awaits or throws: if its read check throws, it keeps the row.
- **Core `platform/iam/audit/read-actions-of.ts`: `iamReadActionsOf(endpoints)`.**
  - Reads are the actions whose catalog level is `Read` or `List`, decided with the catalog's own rule, `iamEndpointAccessLevel`.
  - An unknown classification counts as kept.
  - An action is a read only when every program that registers it registers it as a read.
- **Web `lib/app-route-iam/read-actions.ts`: `appRouteReadActions()`.** For app routes, a read is an action whose every contract is a `GET`.
- **Web `lib/workspaces/decision-audit.ts`: `WorkspaceDecisionAudit`.**
  - It wraps the deferred platform sink in the filter.
  - It knows the app-route reads from the start, and `learn(registry)` adds each instance's registered reads.
  - Before an instance is learned, its allowed reads are kept rather than dropped.
- **Web `lib/workspaces/iam-options.ts`: `workspaceIam(tenancy, workspaceId, deps)`.**
  - `multi` returns `serviceWorkspaceIam(...)` unchanged.
  - `single` returns `{ workspaceId, audit }` only. Decisions still follow the runtime's own profile and the caller's permissions, so local and self-hosted decide exactly as before.
- **`lib/fluxiq.ts`.**
  - The `DeferredIamAuditSink` is now built on every profile, not only `multi`. It still reaches the root-owned `BufferedIamAuditSink` in `platform-services.ts`.
  - Each workspace takes its `iam` option from `workspaceIam(..., decisions.sink)`.
  - Each new instance is passed to `decisions.learn` before it serves anything.
- **Off the request path.** `record()` never awaits: the deferred sink buffers, and the buffered sink writes in the background. The rows keep the existing compact shape.

### Audit volume

- **Local and self-hosted** now write one row for:
  - each allowed state-changing call: a registry endpoint at `Write` or `PermissionsManagement` level, or a non-GET app route;
  - each refusal.

  Before this change they wrote nothing.
- **Frequent write-level calls each persist a row.** This includes compute-control's `ops:Heartbeat` and `ops:PollCommands` if a node polls through the registry, and chat writes such as `append-turn`.
  - Allowed rows are buffered: they flush after 1 s or at 100 rows.
  - Denials flush at once.
- **`service` volume goes down.** Allowed reads were persisted there before and are now dropped.
  - Per-item list-filter denials under `service` (`authorizer.filter` on a list a member can only partly see) are still persisted, one row per hidden item.
  - That has not changed, and it follows the rule "every refused decision", but it is the largest remaining source of volume.
  - If those rows should be dropped, the cut belongs in `filterProgramList`. That is a product decision.
- **Ordering within one second.** Because allows are flushed up to 1 s after denials, store order within a second is not call order. Activity's order within one second can therefore differ from what actually happened. This was already true; my real-runtime test compares the rows as a set for this reason.

### The lead's two instructions disagree

- The brief says allowed reads are not persisted "on every profile", with tests per profile.
- The lead's message said "service-profile behaviour is unchanged".

I followed the brief:

- **Unchanged on `service`:** its decisions (the policy source and workspace from `serviceWorkspaceIam`, identical options), and the fact that every refusal and every change is still persisted.
- **Changed on `service`:** allowed reads are no longer persisted.

Please confirm. If `service` must keep its allowed reads, `workspaceIam` would hand `multi` the unfiltered sink, which is a one-line change.

## Files

Core, `packages/fluxiq/src`:

- New:
  - `programs/identity-access/runtime/authority/{index,delegation,managed-error,unchecked-error}.ts`
  - `programs/identity-access/api/tests/authority-held-elsewhere.test.ts`
  - `platform/iam/audit/{decision-filter,read-actions-of}.ts`
  - `platform/iam/audit/tests/decision-filter.test.ts`
- Edited:
  - `programs/identity-access/{index,types}.ts`
  - `programs/identity-access/runtime/service.ts`: +3 lines; it is now 799 lines, so the 800-line limit is close.
  - `programs/identity-access/api/handlers.ts`
  - `platform/iam/audit/index.ts`

Web, `apps/web/src`:

- New:
  - `lib/app-route-iam/read-actions.ts`
  - `lib/workspaces/{decision-audit,iam-options}.ts`
  - `lib/workspaces/tests/decision-audit.test.ts`
  - `server/provisioning-listener/platform-authority-owner.ts`
  - `app/api/security/server/tests/registry-decisions.test.ts`
- Edited:
  - `lib/app-route-iam/index.ts`
  - `lib/workspaces/index.ts`
  - `lib/workspaces/tests/web-workspaces.test.ts`: it pinned the old "no `iam` option on single tenancy" behaviour, and its cold-audit case recorded an allowed read, which is now dropped, so it records a refusal.
  - `server/provisioning-listener/index.ts`
  - `lib/fluxiq.ts`: approved by the lead.
  - `lib/tests/fluxiq.test.ts`: the fake instance gains `api.endpoints` and `identityAccess.authority`, plus five real-runtime wiring tests.
  - `features/accounts/data/apply-member-change.ts` and `features/accounts/model/types.ts`: comments only.

## Commands run and observed results

All commands ran from the Core worktree root.

**Narrow runs during the work:**
- `pnpm --filter fluxiq exec vitest run src/programs/identity-access/api`: 4 files, 31 tests passed. That includes the 9 tests of `authority-held-elsewhere`.
- `pnpm --filter fluxiq exec vitest run src/platform/iam/audit/tests/decision-filter.test.ts`: 8 passed.

**Library build:**
- Command: lock, then `node .../heavy-slot.mjs run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`, then unlock.
- Result: exit 0 and no `error TS` in the log. The `fluxiq` build is a tsc build, so it type-checks my Core changes.

**Structure audit:**
- `pnpm structure:check` first failed with `[naming] apps/web/src/lib/workspaces/: 3 files share the prefix "workspace-"`. I renamed `workspace-iam.ts` to `iam-options.ts`.
- Final result: `structure-audit: passed (534 warning(s), 917 baselined).`
- `lib/workspaces/` now has 17 source files, past the advisory 15.

**Web narrow runs:**
- `vitest run src/lib/workspaces/tests/decision-audit.test.ts src/app/api/security`: 4 files, 24 passed.
- `src/lib/tests/fluxiq.test.ts`:
  - first run: 4 of my new tests failed.
    - Two failed on row order, because allows are written after denials (see the volume note).
    - Two timed out at 5 s on full-strength scrypt from a password sign-in.
  - Fix: the order checks now compare a set, and the authority test uses a constructed actor (the refusal comes before any proof).
  - Final full file: 35 passed.
- `src/lib/workspaces`:
  - first run: 4 failed in `web-workspaces.test.ts`, which pinned the old wiring (see Files).
  - after updating it: 6 files, 57 passed.

**Acceptance commands:**
- `pnpm --filter fluxiq exec vitest run src/programs/identity-access src/programs/_shared/iam src/platform/iam`: exit 0, `Test Files 40 passed (40)`, `Tests 355 passed (355)`.
- `pnpm --filter @fluxiq/web exec vitest run src/lib/app-route-iam src/app/api/security src/app/api/accounts src/app/api/tests src/server src/features/security src/features/accounts "src/app/api/programs/[programId]/[endpoint]"`: exit 0, `Test Files 54 passed (54)`, `Tests 482 passed (482)`.
- `pnpm structure:check`: passed, as above.

**Rule breaches and incidents:**
- **Memory rule broken once.** The 12 s `decision-filter.test.ts` run started at 1658 MB free, below 2000, because the check and the run were in one command. Every later run checked first and waited when needed (observed 3540, 2866, 4523, 3507, 3944, 3607, 3075; one wait went through 1378, 1123, 603, 423 and 1070 to 3777).
- **The build lock disappeared mid-build.** While my backgrounded build waited for the heavy slot, `.lib-build.lock` vanished, and I did not remove it. I took it again at once, and my build script's own `rmdir` released it when the build finished. Possibly the other worker removed it; please check that it did not build at the same time.

## Tests that prove each claim

**Task 1, Core (real identity service, real program endpoint, real provisioning).** File: `authority-held-elsewhere.test.ts`.
- Changing an account holder's role is refused by name. The message names provisioning and `setPolicies`, and neither `roleId` nor membership policies change.
- The refusal comes before the proof, with no `requiresRecheck`.
- Turning sign-in off is refused, and the account stays `active` with sign-in on.
- A rename still works.
- `setPolicies` moves the policies and the role together.
- A person without an account still changes role and on/off, with the proof, and is still asked for the proof.
- An owner that throws gives `identity.authority_unchecked`, without leaking the cause, and changes nothing.
- The owner can be set only once.

**Task 1, web (real runtime, real platform store).** File: `lib/tests/fluxiq.test.ts`. On local and on self-hosted:
- an account holder made by `createAccount` is refused by name, and nothing changes;
- a person without an account passes the check and reaches the proof.

**Task 2, per profile.**
- `lib/workspaces/tests/decision-audit.test.ts`: a real registry with the real Identity Access endpoints, built from `workspaceIam` as the runtime builds it, on `local`, `self-hosted` and `service`.
  - An allowed write is kept: `update-user` rename, and the `iam:InviteMember` app route.
  - An allowed read is dropped: `snapshot`, and the `iam:ListAuditEvents` GET.
  - A refused read and a refused write are kept.
  - Rows name the workspace's principal FRN and carry no payload, password or session value.
  - Before `learn`, an allowed read is kept.
  - `workspaceIam("multi")` gives the same options as `serviceWorkspaceIam`.
- `lib/tests/fluxiq.test.ts`: the real web runtime with the real platform `iam-audit.sqlite` under a temporary root.
  - On local and self-hosted, the store holds exactly the allowed rename, the refused `snapshot` and the refused `update-user`.
  - On `service`, a refusal is still persisted.

**Activity.** File: `app/api/security/server/tests/registry-decisions.test.ts`. Two workspaces' real registries write into one sink, on local and on self-hosted. `readActivity` for the caller's workspace shows:
- the refused `update-user`;
- the refused `snapshot`;
- the allowed `update-user`.

It does not show the allowed read or the other workspace's rows. Neither "dummy", `session-`, `requestId`, `ipPrefix`, `matched` nor `frn:` appears in the page.

## Not verified

- No whole-package typecheck of apps/web or fluxiq, per the brief. The tsc library build covered Core; the web files were checked only by vitest's transform.
- No live server or browser.
- **The old Security sign-in panel.** `features/security/sign-in/IdentityAccessLive.tsx` is not mine and was not changed. It still offers role and on/off controls for every user, so for an account holder it will now show the refusal's sentence. I did not look at how it renders `error`.
- **Possible wait during a reload.** `platformAuthorityOwner` calls `getPlatformServices()`, which awaits `getFluxIQAfterReload()`. If a primary reload's `close()` waited on registry calls already in flight, an `update-user` sent during a reload could wait on that reload. The account routes use the same pattern, and I did not test it.
- Multi-tenant `service` with several tenant instances: only the primary was exercised against the real runtime.
- The real-runtime tests in `lib/tests/fluxiq.test.ts` took 2.1 to 3.2 s against the default 5 s timeout, so a heavily loaded machine may make them flaky. Per the rule, I did not raise the timeout.

## Open questions or contradictions found

1. **Allowed reads on `service`.** The brief says drop them on every profile; the lead's message says "service-profile behaviour is unchanged". I followed the brief; see the section above.
2. **Renaming an account holder.** `update-user` with `username` can still rename an account holder's sign-in name, which provisioning set to their email. That splits it from `account.email`, the same "two copies" defect for another field. I left it alone because the brief is about role, and the assistant's rename tool uses it.
3. **Per-item list-filter denials under `service`.** They are kept. Should they be?

## Docs to update (not mine to edit)

- **`docs/architecture/platform.md`.**
  - Lines 23 to 32 say local and self-hosted "decide exactly as before" and only `service` records into `iam.audit`. Now every profile records its route decisions (changes and refusals, never allowed reads) through `WorkspaceDecisionAudit`/`IamDecisionAuditFilter`.
  - Add `IamDecisionAuditFilter` and `iamReadActionsOf` to the `audit/` row of the table at line 51.
  - The web workspace manager section should mention `workspaceIam` and the authority owner.
- **`docs/architecture/package-boundaries.md`, around line 1034, under "`update-user`".** Add: a role or on/off change for a person with a platform account is refused with `identity.authority_managed_by_provisioning` (or `identity.authority_unchecked`), before the recheck, once the host has set `identityAccess.authority.holdElsewhere`. Provisioning is the only writer of their role and sign-in.
- **`docs/operations/data-and-state.md`, line 101.** `iam-audit.sqlite` now also fills on local and self-hosted, with one row per allowed state change or refusal.
- **`docs/working/hosted-production-plan.md`** (the lead's). Record the choice (refuse, not route), the new error codes, and the audit rule: every profile, changes and refusals, never allowed reads.
- **W5's accounts report (Missing item 4) and the IAM audit report (Missing item 4).** Both are resolved by this work.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/programs/identity-access/{index.ts,types.ts,runtime/service.ts,api/handlers.ts,runtime/authority/*,api/tests/authority-held-elsewhere.test.ts}; packages/fluxiq/src/platform/iam/audit/{index.ts,decision-filter.ts,read-actions-of.ts,tests/decision-filter.test.ts}; apps/web/src/lib/{fluxiq.ts,tests/fluxiq.test.ts}; apps/web/src/lib/app-route-iam/{index.ts,read-actions.ts}; apps/web/src/lib/workspaces/{index.ts,decision-audit.ts,iam-options.ts,tests/decision-audit.test.ts,tests/web-workspaces.test.ts}; apps/web/src/server/provisioning-listener/{index.ts,platform-authority-owner.ts}; apps/web/src/app/api/security/server/tests/registry-decisions.test.ts; apps/web/src/features/accounts/{data/apply-member-change.ts,model/types.ts} (comments)
Validation: Core acceptance vitest -> 40 files / 355 tests passed; web acceptance vitest -> 54 files / 482 tests passed; `pnpm structure:check` -> passed (534 warnings, 917 baselined); extra: src/lib/workspaces 57 passed, src/lib/tests/fluxiq.test.ts 35 passed
Not verified: whole-package typechecks (per brief); live server/browser; IdentityAccessLive's display of the refusal; an update-user during a primary reload; multi-tenant tenants beyond the primary
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-iam-root.md
Notes: update-user refuses an account holder's role and on/off by name, so provisioning stays the only writer; local and self-hosted now persist changes and refusals.
Contradiction: the brief drops allowed reads on every profile, but the lead said service is unchanged; I followed the brief, please confirm.
One memory-rule breach (1658 MB); the build lock vanished mid-build and I took it again.
```
