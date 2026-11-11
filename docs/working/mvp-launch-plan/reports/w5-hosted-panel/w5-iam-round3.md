# W5 IAM round 3 (lane t901, W5): worker report

Worker: w5-iam-round3 (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing was committed, no branch was switched, no server was started and no library build was run. Every edit is inside the owned paths.

## Outcome

Partial. All four tasks are done in Core and tested, and the Settings page can now hide the workspace-wide choices. One gap remains: the page cannot actually hide them yet, because it is not told who the person is. That needs a two-line change in `SettingsPage.tsx` and the settings route, and both are outside my paths ("Open questions" 1).

The Core acceptance command ended with 2 failures, neither caused by this work:

- **Generated catalog drift.** `generated-module.test.ts` reports that the generated tool catalog no longer matches. The only drifted line is `identity-access`'s `update-user` summary. Another worker changed it in identity-access, which I must not touch.
- **A load timeout.** `unlock-cross-user.test.ts` timed out at 15 s during the full run. It passed when I reran it.

## What changed and why

### 1. Escalation test (`programs/_shared/tests/api-iam-escalation.test.ts`)

- **The refusal test.** "Refuses a user every unfiltered action on the workspace except a create" now leaves out `IAM_USER_WORKSPACE_SETTING_READS` (imported from the predefined barrel). Any other workspace grant to a user still fails it. It now covers 29 targets, `secrets:SetDefaultKey` among them.
- **A new test pins the list itself:**
  - every listed action that a registration declares on the workspace is allowed for a user;
  - `secrets:GetAssistantModel` is among them;
  - every listed action is registered, and every one is a `Read`.
- **Why the list cannot hide a grant.** Smuggling a write into the list to dodge the refusal test fails the `Read` check instead.

### 2. Members can read the allowance

- **Code.**
  - `platform/iam/predefined/user-workspace-setting-reads.ts`: `studio:GetPanelAssistantAllowance` is added beside `secrets:GetAssistantModel`, on the workspace FRN, through the existing `WorkspaceSettingReads` statement.
  - `OwnPanelAssistant` keeps its own copy, and a comment says why.
- **When t900 merges, remove `studio:GetPanelAssistantAllowance` from `OWN_PANEL_ASSISTANT` in `user-access.ts`.** In this tree the endpoint still declares the caller's own user, so the copy keeps Settings working until then.
- **Tests** (`predefined/tests/user-access.test.ts`):
  - `FluxIQUserAccess` allows `GetPanelAssistantAllowance` on the workspace FRN, and refuses it on another workspace;
  - `SetPanelAssistantAllowance` is refused on the workspace FRN, the person's own user and another person's user;
  - the existing "none on the workspace FRN" case now allows only the allowance read there.

### 3. Changing the default key is a workspace decision

- **The fix.** In `programs/secret-keys/api/handlers.ts`, `set-default-key` now declares `endpointResource.workspace()` instead of `key("id")`.
  - Before, a `FluxIQUserAccess` member could make their own key everyone's default, because they own the key.
  - Now IAM decides `secrets:SetDefaultKey` on the workspace FRN, exactly as `set-assistant-model` already did.
- **A required follow-on.** The registry requires a security act declared on the workspace to name what it acts on, so its assistant entry gained `target: { id: "key" }`, as `set-assistant-model` has `target: { keyId: "key" }`.
  - Without it, registration throws. That one error caused 70 failures on my first run.
  - The generated tool catalog does not record `target`, so it does not drift.
- **`set-assistant-model`** already declared the workspace. I checked it and added only a comment.
- **Who can change the two choices now:**

  | Who | Default key and assistant key |
  | --- | --- |
  | Hosted owner (`FluxIQOwnerFullAccess`) | Allowed |
  | Hosted administrator (`FluxIQAdministratorAccess`) | Allowed |
  | Hosted member (`FluxIQUserAccess`) | Refused, even for their own key |
  | Local or self-hosted, role with `secrets.manage` (`admin`) | Allowed |
  | Local or self-hosted `viewer` | Refused |
  | Outsider | Refused |

- **Own-key management is unchanged.** Create, update, rotate, reveal and delete are still decided on the key under `OwnData`.
- **Summary text kept.** The assistant summary still reads "Makes one of the person's model keys the default key." It is pinned in the generated catalog, which is not mine. A better wording would be "Makes one model key this workspace's default key."
- **New test** `programs/secret-keys/api/tests/workspace-choices.test.ts` runs through the real registry and Secret Keys' real handlers, with an in-memory store and no real-SQL marker:
  - the owner and an administrator set the default (to their own key and to the member's) and the assistant key;
  - the member is refused `set-default-key` (on their own key and the owner's) and `set-assistant-model` (with their own key, with a model, and empty). The model settings read the same before and after, and every audit row is a `deny` naming only the workspace FRN;
  - IAM still allows the member each act on their own key: `update-key`, `rotate-key`, `reveal-key`, `delete-key` and `create-key`, one `allow` row each;
  - the outsider is refused, and nothing changes;
  - under `local`, the `admin` role sets both and `viewer` is refused.
- **Evaluator test.** `FluxIQUserAccess` refuses `SetDefaultKey` on the workspace FRN and allows the four key acts on the person's own key.

#### Settings (apps/web)

What I built, all in owned files:

- **`model/may-choose-workspace-keys.ts`** (new), `mayChooseWorkspaceKeys(rolePermissions)`: true exactly when the role holds `secrets.manage`.
  - Local and self-hosted, that is the server's rule.
  - Hosted, owners and administrators get the `admin` role, and every other member gets `viewer` (`identityRoleForPolicies`).
- **`model/types.ts`**: `SettingsModelChoices.mayChoose?`. It is the panel's own fact about the person, never part of the server's answer.
- **`data/use-settings-data.ts`**: `useSettingsData(port, { mayChooseForWorkspace })` lays `mayChoose` over the server's answer.
  - Left out, it is true and nothing changes: the page offers both controls and the server decides.
  - `SettingsDataOptions` is exported from the barrel.
- **`model/assistant-choice.ts`**: when `mayChoose` is false, even the person's own key shows as the read-only "workspace's key" sentence, with no selects. `AssistantModelSection.tsx` needs no change for this.
- **`ui/KeyList.tsx`**: `onDefault` is now optional. Without it there are no default radios; the default row just says "Default", and Remove stays.
- **`ui/AiKeysSection.tsx`**: for a person who may not choose:
  - it passes no `onDefault` to `KeyList`;
  - its intro sentence says the workspace's owner chooses the default;
  - it marks "Default" only on the key the server names, never on a stand-in from the person's own list.

What is still needed, outside my paths: Settings has no role information on the client. Nothing in `data/**` can learn the role without a new route, and asking the server per read would be a speculative IAM decision, which `programs-port.ts` forbids. So the role must be passed in ("Open questions" 1).

New web tests:

- `model/tests/may-choose-workspace-keys.test.ts`;
- two new cases in `model/tests/assistant-choice.test.ts`;
- `ui/tests/AiKeysSection.test.tsx`: the owner gets radios; with nothing said about the person, radios too; a member gets no radio but keeps Remove, and sees "Default" only on the server's default.

### 4. Provisioning maps `identity.username_taken`

- **`platform/provisioning/context/is-username-taken.ts`** (new, exported from the barrel): `isUsernameTaken(error)` matches by the error's `code`, never its message, as `last-administrator-refusal.ts` does.
- **`operations/create-account.ts`**: `upsertUser` is the first write.
  - When it throws the taken error, `createAccount` answers exactly as for an email that already has an account, through a new private helper `emailInUse`: `email_taken` in-process, or `{status: "exists"}` with the account-exists mail over HTTP.
  - I reused the existing `email_taken` code. The HTTP contract says never `email_taken` over HTTP, to avoid revealing which addresses are in use, so HTTP gets `exists`.
  - Identity access refuses before writing, and nothing else has been written yet, so nothing is left behind.
- **`types.ts`**: `PlatformIdentityPort`'s documentation names the new refusal.
- **New test** `tests/username-taken.test.ts` uses the real `IdentityAccessService`, with a person without an account whose sign-in name is `PERSON@example.TEST`:
  - in-process, the lower-case and mixed-case emails and the command line all get `email_taken`;
  - over HTTP the answer is `exists` with one account-exists mail to `person@example.test`;
  - in every case there is no account, no workspace and no new identity user, and the person's own user is unchanged;
  - a different email still creates an account.

### Docs (`docs/architecture/platform.md`)

- The `FluxIQUserAccess` predefined row: both setting reads, the copy that goes when t900 merges, and that `SetAssistantModel` and `SetDefaultKey` are refused because they are decided on the workspace.
- The Parity paragraph's description of the escalation test.
- A new Model keys bullet: "The default key and the assistant's key are the workspace's choices."
- The Provisioning Transports paragraph: the username-taken mapping.

## Commands run and observed results

All from the Core root unless stated. Free memory was checked in a separate command before each vitest run. I waited out readings of 1170, 931, 2394, 1159, 972 and 2293 MB; the runs started at 2635, 2917, 2781, 2935 and 2679 MB.

- **`pnpm --filter fluxiq exec vitest run src/platform/iam src/programs/secret-keys src/programs/_shared src/platform/provisioning src/programs/automation-studio/api/panel-assistant`**
  - First run: 23 files and 70 tests failed (802 passed). Every failure I read was the registration error "set-default-key ... declare a target". I fixed it with `target: { id: "key" }`.
  - Second run: `Test Files 2 failed | 105 passed (107)`, `Tests 2 failed | 891 passed (893)`. The two failures are:
    - `generated-module.test.ts`: the generated tool catalog drifted. I rendered the live catalog to my scratchpad with a temporary test in my own directory, deleted right after, and diffed it. The only difference is `identity-access__update-user`'s summary, which now adds "A person with an account keeps their account email as their sign-in name, so only their display name changes here." That is not my change and not my path.
    - `unlock-cross-user.test.ts`: "Test timed out in 15000ms" under the full run's load.
- **`pnpm --filter fluxiq exec vitest run src/programs/secret-keys/api/tests src/platform/provisioning/tests/username-taken.test.ts src/platform/iam/predefined src/programs/_shared/tests/api-iam-escalation.test.ts`**: `Test Files 11 passed (11)`, `Tests 63 passed (63)`. This includes `unlock-cross-user` and my new files. The escalation output was `{"unfilteredWorkspaceTargets":29,"reached":[]}` and `{"workspaceSettingReads":["secrets:GetAssistantModel"],"refused":[]}`.
- **`pnpm --filter @fluxiq/web exec vitest run src/features/settings-page`**: `Test Files 41 passed (41)`, `Tests 400 passed (400)`.
- **`pnpm structure:check`**: fails, and none of its violations is in a file I changed.
  - First run: 5 violations. They are the import cycle closed by the parallel worker's new `FlowSettingsView.tsx` import of `../../settings-page/data`, plus `panel-shell/dock/AssistantDock.tsx` and its test.
  - Latest run: 7 import-cycle violations, all in `apps/web/src/features/automation-studio/settings/**`, where the parallel worker's edits are in progress.
  - No `settings-page` file appears in any loop.

## Not verified

- **No typecheck.** The brief forbids a whole-package typecheck, and vitest does not type-check.
  - Two spots I checked by reading: `KeyList`'s `onDefault?: ((keyId) => void) | undefined`, and `onDefault={choosesDefault ? ... : undefined}`. Both are valid under `exactOptionalPropertyTypes`.
  - The `emailInUse` return type, `{status:"exists"}`, is assignable to `createAccount`'s result type.
- **No library build, live hosted session or browser.** The hiding in Settings is not active until the role is passed in ("Open questions" 1).
- **No mutation run.** I did not mutate the escalation test to prove it fails on a new grant. I reasoned it instead: any workspace action outside the list is a target, and a write put into the list fails the `Read` check.
- **Not rerun after the timeout.** I did not rerun the whole acceptance set after the timeout, because of memory pressure; I reran the affected files instead.

## Open questions or contradictions found

1. **Wiring, two files outside my paths.** In `apps/web/src/app/(panel)/settings/page.tsx`, read `const auth = await currentFluxIQUser();` and pass `mayChooseForWorkspace={mayChooseWorkspaceKeys(auth?.role.permissions ?? [])}` to `SettingsPage`. In `ui/SettingsPage.tsx`, take `mayChooseForWorkspace?: boolean` and call `useSettingsData(port, { mayChooseForWorkspace })`. Do it after the humanness worker finishes, since both files are theirs now. `mayChooseWorkspaceKeys` is exported from `features/settings-page/model`.
2. **`identity.manage` versus `secrets.manage`.** The brief names "the identity.manage role" for local and self-hosted. The server's local rule is the role's `secrets.manage`. With the default roles both are only `admin`, but a custom local role with `secrets.manage` and no `identity.manage` is allowed by the server. I matched the server and used `secrets.manage`.
3. **HTTP answer for a person without an account.** Over HTTP, an email such a person signs in with now answers `exists` and sends the account-exists mail. That mail links to sign-in and the reset page; reset is for accounts, so for this person only the sign-in link is useful. Keeping one answer for every address in use is what prevents address enumeration.
4. **Generated catalog drift.** The supervisor should regenerate it (`FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1`, then `pnpm exec vitest run src/programs/_shared/assistant` in `packages/fluxiq`) once the identity-access `update-user` summary is final. If the default-key summary should say it is a workspace choice, change it in the same regeneration.
5. **`keyRows` marks a stand-in default.** For a person who may choose, `keyRows` still marks their first enabled key "Default" when the server's default is not in their list. That pin is in the existing `key-rows.test.ts` ("gone" case). I left it and avoided it only in the member view.
