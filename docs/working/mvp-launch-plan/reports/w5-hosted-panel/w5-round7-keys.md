# W5 round 7: merged-tree fixes, offered-and-chosen workspace keys, the member's locked message

Worker: w5-round7-keys (lane t901, W5, Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel` at 3c417baa2. Nothing committed, no branch switched, no server started, no model called. Every edit is inside the owned paths. The parallel worker's identity-access edits were in the tree throughout; I did not touch them.

## Outcome

Done. All three parts are in place and every acceptance check passes (commands below).

## 1. The merged tree's failures: causes and fixes

### `pnpm --filter fluxiq check` exited 2: two type errors, both in owned test files

1. **`platform/iam/audit/tests/decision-filter.test.ts:100-109`** (TS7022/TS7024).
   - Cause: circular type inference. The registry's audit filter predicate `(action) => reads.has(action)` reads `reads`, and `reads` is computed from `registry.endpoints()`, so TypeScript cannot infer `registry` without `reads`, and the reverse.
   - The merge did not cause it: nothing under `programs/_shared`, `platform/iam/audit` or `platform/iam/types.ts` changed between e04d5a74d and 3c417baa2. The file dates from b5db7a001. Earlier W5 workers were not allowed to run a whole-package typecheck, so nobody saw it.
   - Fix: annotate `registry: GlobalProgramApiRegistry` and `reads: ReadonlySet<string>`. Test behaviour is unchanged.
2. **`panel-assistant/tests/user-access.test.ts:231`** (TS2345).
   - Cause: `READ_ONLY` was inferred as an array of four literal endpoint names, so `READ_ONLY.includes(endpoint)` rejected any other endpoint.
   - Fix: type it `readonly string[]`.

### `allowance-resource.test.ts` "...user access does neither"

- Cause: t900's test predates the decision that members read the allowance.
- Fix: the test now expects `FluxIQUserAccess` to give `{ read: "allow", change: "deny" }` and checks that the allowance stays unchanged. The header comment says this read comes from `IAM_USER_WORKSPACE_SETTING_READS` on the workspace.

### `user-access.test.ts`, two cases

1. **"...lets a person use every granted endpoint..."** failed with `get-panel-assistant-allowance: expected 0 to be greater than 0`.
   - Cause: the test's `GRANTED` list mixed the person's own-chat endpoints with the allowance read, and it asserted that every endpoint in it was decided by `OwnPanelAssistant` on the person's own user. Since the merge, the allowance endpoint declares the workspace, so no decision on the user FRN exists.
   - Fix (test only): split the list into `OWN_CHATS` (decided by `OwnPanelAssistant` on the user FRN, as before) and `WORKSPACE_READS = [getAllowance]`. The new assertion is that every decision for those is `allow` by `FluxIQUserAccess`/`WorkspaceSettingReads` and names no user FRN.
2. **"...a paired browser's credential is refused every panel endpoint by IAM itself"** failed because the allowance read was refused by the handler's channel check, not by IAM.
   - Cause: the read moved from `OwnPanelAssistant`, which requires `fluxiq:RequestOrigin = panel`, to `WorkspaceSettingReads`, which had no origin condition. IAM therefore let a paired browser's credential through for this read.
   - This was a real regression of a property W5 decided, so I fixed the policy rather than the test. The cause is in `platform/iam/predefined/user-access.ts`.
   - Fix: `WorkspaceSettingReads` now carries `Condition: { StringEquals: { "fluxiq:RequestOrigin": "panel" } }`. This also applies to `secrets:GetAssistantModel`.
   - Nothing in the extension repo calls either read (grep of `!FluxIQWebExtension` for `get-assistant-model`/`GetAssistantModel`: no source hits). Hosted Settings and the dock call them from the panel.
   - New evaluator pin in `predefined/tests/user-access.test.ts`: each setting read is allowed from `panel` and denied from `extension-chat`, `api`, `schedule`, `cli` and `provisioning`.

## 2. Keys in an organisation workspace: offered and chosen

The rule now: no key is ever shared automatically. Another person's key pays for a message only when both of these hold:

- **chosen**: an owner or administrator chose it as the workspace's key;
- **offered**: its holder offered it to the workspace.

### The offer (the holder's own act)

- **New endpoint** `secret-keys/offer-key`, payload `{ id, offered: boolean }`. IAM action `secrets:OfferKey`, `Write`, `program-gated`, `permission: secrets.manage`, declared on `endpointResource.key("id")`.
- **Who IAM lets through.** Under `FluxIQUserAccess`, `OwnData` reaches only the caller's own key. Owner and Administrator reach any key, so the service refuses anyone except the person who added the key (`createdBy === actor.userId`, never a payload): "Only the person who added a key can offer it to the workspace." This covers owners and administrators too.
- **Paired browsers** are refused by the handler.
- **The assistant** never sees the endpoint: it is `hidden`, with the reason that the person decides it in Settings.
- **What can be offered.** Only an enabled model key. A legacy key with no owner stamp cannot be offered. Withdrawing an offer is always accepted.
- **Storage.** In the model-settings record, as `keyOffers: [{ keyId, holderId, atMs }]`. An offer counts only while `holderId` equals the key's `createdBy`.
- **When an offer goes.** On withdrawal, and in `keyLost` (the key is removed, turned off, or is no longer a model key). Turning a key back on shares nothing until its holder offers it again.
- **What the UI reads.** The snapshot marks each model key `offeredToWorkspace`. `snapshotFor` marks the caller's own stamped keys `heldByYou`.

### The choice (owner or administrator, decided on the workspace)

- **Explicit acts only.** A key counts as chosen through `set-default-key` (with `defaultChosenBy`) or `set-assistant-model` with a key (with `assistantChosenBy`).
- **"The default key" for the assistant.** Choosing it records the default it names as chosen (it pins `defaultKeyId`/`defaultChosenBy`), so a default that later passes on by itself does not count as chosen.
- **Removed:** `ModelKeySettings.keyCreated` and its call in `createKey`, the rule that "the first key a member adds counts as shared". Adding a key now chooses nothing.
- **`set-assistant-model`** now takes another person's key only once it is offered ("That key belongs to someone else, who has not offered it to this workspace."). `set-default-key` still takes any key, as round 3 decided. The release refuses a key that is chosen but not offered.

### Release (`runtime/conversations/assistant/model/key-model-source.ts`)

`resolveAssistant()` now answers `chosenForWorkspace` and `offeredByHolder` in place of `sharedByOwner`.

- **The sender's own key, or a legacy unstamped key:** released to the sender's own unlock, unchanged. Single-user local and self-hosted, and an owner using their own key, need neither step.
- **Another person's key, chosen and offered:** released server-side, for that one call, to the holder's live panel unlock, under the existing unlock rules.
- **Otherwise:** a plain answer and no model call.
  - Not chosen: "No model key has been chosen for this workspace's messages yet. An owner or administrator of this workspace chooses one in Settings, from a key its holder has offered to the workspace."
  - Chosen but not offered: "The key chosen for this workspace's messages has not been offered to the workspace by the person who added it, so it pays only for their own messages. They can offer it in Settings, or an owner or administrator of this workspace can choose another."

The model-settings view (`get-assistant-model` and the snapshot's `modelSettings`) gains `assistantKeyChosen` and `assistantKeyOffered`.

### Settings (apps/web, `features/settings-page/**`)

- **The offer control.** `KeyList` shows an "Offer to the workspace" checkbox (`aria-label "Offer <name> to the workspace"`) only on rows with `heldByYou`. Another person's offered key is shown as text, "Offered to the workspace", with no control. `useSettingsData` gains `offer(keyId, offered)`.
- **`AiKeysSection` intro:** one sentence saying a person's keys pay only for their own messages until they offer one and it is chosen.
- **For choosers, a status line on the workspace key:**
  - nobody chose it yet: "Choose <name> as the workspace's key" (calls `set-default-key`);
  - chosen but not offered: says so;
  - chosen and offered: says it pays for everyone.
- **`AssistantModelSection`, for a member on someone else's key.** Driven by the new `workspaceKeyStatus(keys, choices)`, which returns `none`, `yours`, `shared`, `not-chosen` or `not-offered`:
  - not chosen: "No key pays for your messages to the assistant yet. An owner or administrator of this workspace chooses one in Settings, from a key its holder has offered to the workspace."
  - chosen but not offered: the not-offered sentence;
  - shared: the existing sentence, which now ends "An owner or administrator of this workspace chooses them."

## 3. The member's locked message

- **Contracts:** a new file `packages/contracts/src/platform/model-keys/workspace-key-locked.ts`, exported from the barrel. It defines `workspaceKeyLockedMessage(host)`: "This workspace's model key is locked: its owner must unlock it by opening <host> and entering their password once". Test: `model-keys/tests/workspace-key-locked.test.ts`. It never says "your key" or "sign in", it differs from `secretsLockedMessage`, which keeps its exact words, and it passes `isSecretsLockedError`.
- **Core:** `runtime/conversations/assistant/model/workspace-key-locked-error.ts` defines `PanelAssistantWorkspaceKeyLockedError`, a subclass of `AutomationStudioSecretsLockedError` with the same code and type and the workspace wording. It has no `signInUrl`, because the sender's own unlock cannot open the key.
- **Who sees which wording.** `key-model-source.ts` raises the new error only when the key is lent to someone other than its holder. The holder's own locked message is unchanged.

## Tests added or changed

- `secret-keys/runtime/tests/model-key-settings.test.ts`: the old "only one its own owner chose" block is replaced with eight cases:
  - the first key is neither chosen nor offered;
  - explicit choice, plus an offer only by the holder (the owner is refused for a member's key), then withdrawal;
  - offer refusals: missing, off, custom and unstamped keys;
  - a default that passed on by itself is not chosen;
  - the offer is dropped when the key is disabled and re-enabled;
  - "the default key" pins the default;
  - snapshot `offeredToWorkspace` and `heldByYou`;
  - a restart.
- `secret-keys/api/tests/key-offers.test.ts` (new, real registry and handlers, in-memory store):
  - a member offers and withdraws their own key;
  - a member is refused the owner's key by IAM; owner and admin are refused the member's key by the service; an outsider is refused;
  - a paired browser is refused;
  - an owner can choose a member's key for the assistant only after it is offered;
  - a member is refused `set-default-key` and `set-assistant-model`;
  - under `local`, viewer is refused and admin may offer.
- `panel-assistant/tests/workspace-key.test.ts` (real-sql, real release, fake Anthropic fetch):
  - offered + chosen releases;
  - chosen but not offered refuses;
  - offered but not chosen refuses;
  - withdrawing stops release;
  - a member cannot offer someone else's key or choose the workspace key;
  - the owner's choice of a member's key pays nothing until the member offers it, then it releases on the member's unlock;
  - the owner's first key answers the owner while a member gets the not-chosen answer;
  - owner on `local` is unaffected;
  - locked: the member gets `workspaceKeyLockedMessage`, the owner gets `secretsLockedMessage`, and `decide` rejects with the typed error carrying the workspace wording;
  - no provider call in any refusal.
- `runtime/conversations/assistant/model/tests/key-model-source.test.ts`: three cases on the decision table, release to the holder, and the two lock wordings.
- `secret-keys/api/tests/member-model-access.test.ts`: the expected view gains the two new fields.
- Web:
  - `model/tests/workspace-key-status.test.ts` (new);
  - `ui/tests/AiKeysSection.test.tsx`: four cases (offer only on own keys, chooser line in three states, no choice for a member);
  - `ui/tests/AssistantModelSection.test.tsx`: three cases.
- Generated files, regenerated from the live registry (each diff is exactly one new entry):
  - `packages/contracts/src/iam/actions.generated.ts`: `secrets:OfferKey`;
  - `platform/iam/catalog/generated/assistant-tools.generated.json`: `secret-keys__offer-key`, hidden, with its reason.
- Docs: `docs/architecture/platform.md`:
  - the `FluxIQUserAccess` row: the origin condition on the setting reads, the allowance copy gone, `secrets:OfferKey`;
  - Model keys, "The workspace's assistant key": rewritten for offered-and-chosen and the two lock wordings.

## Commands run and observed results

All from the Core root. Free memory was checked in a separate command before every vitest run; I waited out readings of 2472, 1718, 794, 522, 655, 1503 and 2136 MB.

| Command | Result |
| --- | --- |
| `heavy-slot run t901 -- pnpm --filter fluxiq check` (before any edit) | exit 2, the 4 errors above |
| vitest on the two failing panel-assistant files (before) | 2 failed, 6 passed |
| vitest panel-assistant + `iam/predefined` + decision-filter + escalation (after part 1) | 11 files, 82 tests passed |
| Under `.lib-build.lock` (created and removed by me): `heavy-slot ... pnpm --filter @fluxiq/contracts build` | build exit 0 |
| `heavy-slot ... pnpm --filter fluxiq check` | exit 0 |
| `FLUXIQ_REGENERATE_IAM_CATALOG=1 pnpm exec vitest run src/platform/iam/catalog` | 3 files, 11 tests passed; one added line |
| `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant` | 7 files, 36 tests passed; one added entry |
| `pnpm structure:check` | `structure-audit: passed (538 warning(s), 916 baselined)`. `SecretKeysService` is still at 36 methods: I moved my lookup onto `ModelKeySettings.offeredById` |
| **Acceptance:** `pnpm --filter fluxiq exec vitest run src/platform/iam src/programs/secret-keys src/programs/automation-studio/api/panel-assistant src/runtime/conversations/assistant src/programs/_shared` | exit 0: `Test Files 104 passed (104)`, `Tests 872 passed (872)` |
| Contracts: `pnpm --filter @fluxiq/contracts exec vitest run src/platform/model-keys src/task-attempts/tests/model-key-lock.test.ts src/iam` | 9 files, 101 tests passed |
| `pnpm --filter @fluxiq/web exec vitest run src/features/settings-page` (first try) | refused: "Core's library build is 13 minute(s) behind its source" |
| Under the lock: `heavy-slot ... pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` | exit 0, lock removed |
| Web settings-page vitest | first run 1 failed / 409 passed: my own over-broad assertion matched the new intro sentence; tightened |
| Web settings-page vitest (rerun) | `42 passed (42)`, `410 passed (410)` |
| Final `heavy-slot ... pnpm --filter fluxiq check` (after the method move) | exit 0 |
| Rerun after the move: vitest `src/programs/secret-keys`, `workspace-key.test.ts`, `src/runtime/conversations/assistant/model`, `src/platform/iam/catalog` | 29 files, 253 tests passed |

## Not verified

- **Web typecheck** (`@fluxiq/web` check) was not run. vitest does not typecheck the TSX. I read the new props and the optional fields for `exactOptionalPropertyTypes` by eye.
- **No live hosted session, browser or real provider.** A fake Anthropic `fetchImpl` stands in. DeepSeek uses the same release path but no test exercises it.
- **`docs:check` was not run.** It is not in the acceptance list. The new exported `OfferSecretKeyRequest`/`OfferSecretKeyResponse` types in `secret-keys/api/contracts.ts` will likely drift the generated `docs/reference/framework-reference.md` until `pnpm docs:reference` is run.
- **Stale contracts dist.** The contracts dist was rebuilt before `actions.generated.ts` gained its line. Only the data changed, not types, and vitest reads source; the next library build picks it up.
- **The parallel worker's edits were in the tree.** Its uncommitted identity-access edits were present during the check, the builds and the regeneration. The regenerated catalog diffs contain only my entries.

## Open questions or contradictions found

1. **Old settings records.** Records written by the removed `keyCreated` rule still carry a `defaultChosenBy` stamp, and now count as chosen. That stamp exists only on unreleased t901 builds (e04d5a74d), and an offer is still required, which no old record has. The supervisor may want a one-time clear if any shared test workspace matters.
2. **Settings still is not told the person's role.** Round 3's open question 1 still stands: `app/(panel)/settings/page.tsx` is not mine. Until it passes `mayChooseForWorkspace`, every person sees the chooser controls, the "Choose ... as the workspace's key" button among them, and the server refuses a member.
3. **`set-default-key` still accepts another person's key without an offer.** The release refuses it until the holder offers, so nothing is spent. Unlike `set-assistant-model`, it does not refuse at choose time, because it also sets the default for new Flows, as round 3 decided. Say if it should refuse too.
