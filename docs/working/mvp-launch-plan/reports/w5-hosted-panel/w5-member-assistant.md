# W5 member assistant: a member reads the model and sends on the workspace's key

Worker: w5-member-assistant (lane t901, W5). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`. Nothing committed.

## Outcome

Partial. Both defects are fixed and every acceptance check passes. One test outside my paths needs a one-line edit, which I did not make: `programs/_shared/tests/api-iam-escalation.test.ts` pins that a user reaches no unfiltered workspace action, and the new deliberate grant trips it. The exact edit is under "Open questions" (1).

## The cause

1. **Read.** `secret-keys/get-assistant-model` declares `endpointResource.workspace()`. `FluxIQUserAccess` grants nothing on the workspace FRN except creates and three filtered lists, so hosted Settings got `authorization.forbidden`. A member could already read the same data through the filtered `snapshot`'s `modelSettings`, so the refusal protected nothing. `FluxIQReadOnlyAccess` was already allowed by its generated list.
2. **Send.** IAM already allowed it (`OwnPanelAssistant` grants `studio:SendPanelMessage` from the panel). The failure came later, in the key release:
   - `runtime/conversations/assistant/model/key-model-source.ts` passed the workspace's assistant key as `flowKeyId` to `releaseAutomationStudioSessionProviderKey` with the member as caller.
   - `flowKey()` then refused it: "This Flow's model key belongs to another person, so it cannot pay for your calls".
   - The Anthropic and DeepSeek adapters turn any key-lookup throw into the generic `llm.provider_secret_unavailable` ("could not be released"). So a member got that misleading sentence.
   - The owner's own locked case also never reached the typed `secrets.locked`.
3. **A second risk.** A member's sends could not simply be allowed to spend "whatever key the assistant resolves to". The default is the oldest model key in the workspace, whoever owns it, and an Owner or Admin can make any person's key the default (`secrets:SetDefaultKey` on any key). Released to everyone, a member's key could be spent by others without their consent.

## The fix

Model-key resolution module, named before editing it: `packages/fluxiq/src/runtime/conversations/assistant/model/key-model-source.ts`. This is W4's `conversations/assistant/**`; see "W4 change" below.

### IAM: one action, one resource

| Policy | Action | Resource | Decision |
| --- | --- | --- | --- |
| `FluxIQUserAccess` (new statement `WorkspaceSettingReads`) | `secrets:GetAssistantModel` | workspace FRN | allow |
| `FluxIQUserAccess` | `secrets:SetAssistantModel` | workspace FRN | deny (unchanged) |
| `FluxIQUserAccess` | `secrets:RevealKey`, `UpdateKey`, `RotateKey`, `DeleteKey`, `SetDefaultKey`, `GetAssistantModel` | another person's `key/<id>` | deny (`OwnData` needs ownership) |
| `FluxIQUserAccess` | `ops:GetRecord`, `ops:ListRecords` (database manager) | any | deny |
| `FluxIQReadOnlyAccess` | `secrets:GetAssistantModel` | workspace FRN | allow (unchanged, now tested) |
| no membership (outsider) | anything | anything | deny |

- The list is `IAM_USER_WORKSPACE_SETTING_READS` in its own file, `platform/iam/predefined/user-workspace-setting-reads.ts`, exported through the barrel so the escalation test can name it.
- Sending needs no key action. The release is server-side, inside the `send-panel-message` handler's background work.

### The endpoint's answer

`ModelKeySettingsView` (the `get-assistant-model` answer and `snapshot.modelSettings`) gains one field, `assistantProvider`: the provider of the key in use, as the key names it.

- Nothing else changed. It carries key ids (as it already did for everyone), a provider and a model.
- It never carries a key's name, value, seal or owner.

### Who may pay: Secret Keys is the one source of truth

Changes are in `secret-keys/types.ts`, `runtime/model-key-settings.ts`, `runtime/service.ts` and `api/handlers.ts`.

- The settings record now stores who made each choice: `defaultChosenBy` and `assistantChosenBy`. The value is the acting user of `set-default-key` and `set-assistant-model` (`request.actor.userId`), never a payload.
- The workspace's first model key is recorded as its creator's choice (`ModelKeySettings.keyCreated`, called from `createKey`). Adding it already makes it the default every person sees in Settings.
- A default that passed on by itself is not recorded as anyone's choice (`keyLost`, `ensureDefault`). When the assistant's chosen key is lost, `assistantChosenBy` is cleared.
- `resolveAssistant()` now answers `ownerId` (the key's `createdBy`) and `sharedByOwner`. `sharedByOwner` is true only when the key in use was chosen for the workspace by its own owner:
  - picked for the assistant by them; or
  - the default they chose or added first; or
  - "the default key" picked for the assistant by them, when that default is theirs.
- A legacy key with no owner stamp is never shared.

### The key-release path for one dock message

`key-model-source.ts`, per message:

1. `resolveAssistant()` names the key and model. There is no value.
2. Whose key is it?
   - **The sender's own, or no owner stamp:** released to the sender's own unlock, exactly as before.
   - **Another person's, not `sharedByOwner`:** the dock answers in the thread: "The assistant's key belongs to another person, who has not chosen it as this workspace's key. Ask them to choose it in Settings, or add a key of your own." No call is made.
   - **Another person's, `sharedByOwner`:** the payer becomes `{ userId: owner, sessionId: null }`. `releaseAutomationStudioSessionProviderKey` then:
     - checks the key is the owner's (`flowKey`);
     - takes `fallbackUnlockFor(owner, null)`, which the host binds to the owner's live panel unlock (`unlockedSessionFor` excludes paired browsers);
     - creates a 10-second reveal authorization on that unlock, reveals the value and hands it to the adapter for this one HTTP call.
   - The value never enters the thread, the endpoint's answer or the sender's data.
3. **Locked:** when no unlock of the owner holds the key, the release throws `AutomationStudioSecretsLockedError` (`secrets.locked`). No other key is tried.
   - The model source remembers the lock and rethrows the typed error from `decide`. The adapter would otherwise hide it as a generic provider failure.
   - The loop posts it in the thread: "The assistant's model did not answer: Unlock your model key: open <host> and enter your password once. ..."
   - This also gives the owner's own locked messages the typed error, where before they got the generic one.

### W4 change (`conversations/assistant/**`), kept minimal

Only `model/key-model-source.ts` changed:

- the `ownerId` and `sharedByOwner` fields on `PanelAssistantKeyChoice`;
- the payer choice and the not-shared refusal;
- the typed-lock rethrow.

No change in `programs/automation-studio/api/panel-assistant/**` source. The host binding in `programs/_shared/runtime.ts` is unchanged, and its existing `() => secretKeys.modelKeys.resolveAssistant()` and `sessionKeyPorts` already carry everything needed.

### Settings page (assistant model section only)

- `model/types.ts`: `assistantProvider?`.
- `data/use-settings-data.ts`: one field added to `NO_CHOICES`.
- `model/assistant-choice.ts`: a `workspace` result when the key the server names is not in the person's own key list.
- `ui/AssistantModelSection.tsx`: in that case it shows "The assistant uses this workspace's Anthropic key, with <model or the provider's usual model>. The workspace's owner chooses them." It shows no key or model select.

### Docs

`docs/architecture/platform.md`:

- the `FluxIQUserAccess` row of the predefined-policies table;
- a new "The workspace's assistant key" paragraph in Model keys.

## Tests

- `platform/iam/predefined/tests/user-access.test.ts`: evaluator pins for the new statement and every denial listed in the IAM table above.
- `programs/secret-keys/api/tests/member-model-access.test.ts` (new; real registry, `service` profile, per-person memberships, in-memory key store, so no real-SQL marker):
  - owner, member and read-only person each read the identical answer, and its JSON holds no value, seal, name or password;
  - the outsider is refused `get-assistant-model` and `snapshot`;
  - the member is refused `reveal-key`, `update-key`, `rotate-key`, `delete-key`, `set-default-key` and `set-assistant-model`;
  - the member's `snapshot` lists none of the owner's keys.
- `programs/secret-keys/runtime/tests/model-key-settings.test.ts`:
  - five new cases: the first key shared by its creator, a default someone else chose, a default that passed on, who picked the assistant's key or "the default key", and a restart;
  - two existing `toEqual`s gained `sharedByOwner: false`.
- `programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts` (new, `// @fluxiq-test-group real-sql`). It runs through the real registry, the Secret Keys and panel handlers, real panel SQLite databases and the real release, with a fake Anthropic `fetchImpl`, so no model is called:
  - the owner reads and sends;
  - a member reads and sends, and both calls carry `Bearer <team key>`;
  - the member's answers and thread never contain the value;
  - with the owner signed out, the member's thread says the `secrets.locked` sentence, `decide` rejects with an `isSecretsLockedError` value, and the provider is never called;
  - when an owner makes a member's key the default, the owner's message gets the not-shared sentence and no call is made, while the member still sends on their own key;
  - the read-only person and the outsider are refused `send-panel-message`.
- `apps/web/src/features/settings-page/model/tests/assistant-choice.test.ts`: two new cases.
- `apps/web/src/features/settings-page/ui/tests/AssistantModelSection.test.tsx` (new): a member sees the provider and model and no `<select>`; an owner sees both selects.

## Commands run and observed results

All from the Core root. Free memory was checked before each vitest run (3159, 3537, 3709 and 3872 MB). I waited while it read 1958 and 1781.

- `pnpm --filter fluxiq exec vitest run src/platform/iam src/programs/secret-keys src/programs/automation-studio/api/panel-assistant`
  - First run: 2 failed, 496 passed.
    - `model-key-settings.test.ts:159`, an existing `toEqual` missing `sharedByOwner`. I fixed it.
    - `platform/iam/audit/tests/store.test.ts` "keeps 10,000 polling-like allow rows": a 60 s timeout under load. I did not touch it, and it passed on the reruns.
  - Second run: `Test Files 50 passed (50)`, `Tests 498 passed (498)`.
  - Third run, after moving the list to its own file: `Test Files 50 passed (50)`, `Tests 498 passed (498)`.
- `pnpm --filter @fluxiq/web exec vitest run src/features/settings-page`: `Test Files 38 passed (38)`, `Tests 386 passed (386)`.
- `pnpm --filter fluxiq exec vitest run src/runtime/conversations/assistant/model`: `Test Files 4 passed (4)`, `Tests 16 passed (16)`. This includes the unchanged `key-model-source.test.ts`.
- `pnpm --filter fluxiq exec vitest run src/programs/_shared/tests/api-iam`: 1 failed, 27 passed. The failure is `api-iam-escalation.test.ts` "refuses a user every unfiltered action on the workspace except a create": `expected [ 'secrets:GetAssistantModel' ] to deeply equal []`. This is the intended grant; see Open questions (1).
- `pnpm structure:check`: `structure-audit: passed (537 warning(s), 916 baselined)`. The same result came back after the last change.
- Library build, under `.lib-build.lock` (created and removed by me), via `heavy-slot.mjs run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`:
  - exit 0;
  - contracts reused from the cache, fluxiq rebuilt (tsc, about 106 s), ui-components rebuilt.
  - The build includes the other workers' uncommitted changes in the same tree.

## Not verified

- I did not run a whole-package typecheck (the brief forbids it). The test files are not compiled by the library build, so their types were checked only by vitest's transform, which does not typecheck.
- I did not run the escalation test with the fix applied, because the file is not mine.
- No live hosted session or real browser: the fake provider stands in for Anthropic. DeepSeek takes the same release path, but no test exercises it.
- I did not exercise a workspace whose settings record predates this change. By design, its default reads as unchosen, so it is not shared until the owner picks it once.

## Open questions or contradictions found

1. **Needed edit outside my paths** in `packages/fluxiq/src/programs/_shared/tests/api-iam-escalation.test.ts`, test "refuses a user every unfiltered action on the workspace except a create":
   - Import `IAM_USER_WORKSPACE_SETTING_READS` from `../../../platform/iam/predefined/index.ts`.
   - Exclude it from `targets`: `&& !IAM_USER_WORKSPACE_SETTING_READS.includes(actionOf(endpoint))`.
   - Optionally add `expect(IAM_USER_WORKSPACE_SETTING_READS.every((action) => endpoints.some((endpoint) => actionOf(endpoint) === action))).toBe(true)`.
   - Better still, assert each listed action is allowed for `bob`.
2. **A decision to confirm: the first key counts as shared.**
   - Rule: the workspace's first model key counts as its creator's choice for the workspace. That is what makes "owner adds a key, the member sends" work with no extra step.
   - Consequence: in an organisation workspace where a member adds the first key, that member's key is shared. Settings tells them it is "the default key", but not that others spend it.
   - The stricter alternative is to require an explicit `set-assistant-model` or `set-default-key` by the key's owner. Then members cannot send until the owner picks the key once.
3. **A related gap, not fixed: members can change the workspace default.** `secrets:SetDefaultKey` declares `endpointResource.key(id)`, so a member under `OwnData` can make their own key the workspace's default. That changes what every person's assistant uses, and the recorded chooser means it is then shared. It probably should be a workspace action like `SetAssistantModel`. That is Secret Keys' resource choice, so I am reporting it rather than changing it.
4. **The locked sentence is the existing one.** It says "Unlock your model key: open <host> and enter your password once". For a member, the key that must be unlocked is the owner's. The sentence comes from the contract's single source (`secretsLockedMessage`, `modelKeyLockedWords`), which I do not own. A member-facing variant would be a contracts change.
5. **The release uses any live panel unlock of the owner.** A member's message draws on any live panel unlock of the owner (`fallbackUnlockFor(owner, null)`), the same fallback an owner's own signed-out session uses. An owner who never signs in after a restart leaves members locked until they do.
