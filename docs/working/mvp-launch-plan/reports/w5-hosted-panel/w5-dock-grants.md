# w5-dock-grants (lane t901, W5)

## Outcome

Partial. `FluxIQUserAccess` now grants the panel assistant's endpoints a person needs for their own chats. New tests pin the grant, the cross-person refusal, the paired-browser refusal and the `FluxIQReadOnlyAccess` behaviour, and all of them pass. The structure audit passes.

The brief's acceptance vitest command still fails on one test, as expected. W4's `thread-changes.test.ts` has a case that asserts the old denial ("FluxIQUserAccess alone grants no panel endpoint"). The lead asked for that test to be updated, but the brief excludes W4's existing tests from my owned paths. So I left it alone, and the exact edit is under "Open questions". With that edit the command should pass: every other file in it passed (32 of 33 files, 299 of 300 tests).

## What changed and why

All paths are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`.

- `packages/fluxiq/src/platform/iam/predefined/user-access.ts`: a new statement, `OwnPanelAssistant`:
  - It allows the private list `OWN_PANEL_ASSISTANT` on `frn:fluxiq:iam:${fluxiq:WorkspaceId}:user/${fluxiq:PrincipalId}`.
  - It carries `Condition: { StringEquals: { "fluxiq:RequestOrigin": "panel" } }`.
  - The doc comment explains each choice. The actions are named one by one, never `*Panel*`.
  - Version stays `v1`. Every predefined policy is `v1`, `predefined-policies.test.ts` pins that, and platform.md "Known gaps" already records that no version bump is enforced.
- `packages/fluxiq/src/platform/iam/predefined/tests/user-access.test.ts`: evaluator-level pins. For each granted action:
  - allowed on the person's own user FRN from `panel`;
  - denied on another person's user FRN, on the workspace FRN and on Studio content;
  - denied from `extension-chat`, `api`, `schedule`, `cli` and `provisioning`.
  - It also pins that `SetPanelAssistantAllowance` is denied, and that a project-bound attachment is allowed only on an owned project.
- New file `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/user-access.test.ts`, marked `// @fluxiq-test-group real-sql`. It goes through the real registry, the real handlers and real per-person panel databases under `service`. The tests are listed below.
- `docs/architecture/platform.md`: the `FluxIQUserAccess` row of the predefined-policies table only.

### Each action, its resource, and why

Every panel endpoint declares `endpointResource.selfUser()`, so its resource is `frn:fluxiq:iam:<ws>:user/<caller>`, owned by the caller. The grant pins `Resource` to the principal's own user FRN, as `SelfService` does. No `*`, and nothing on the workspace FRN.

| Action | Granted | Why |
| --- | --- | --- |
| `studio:ListPanelThreads` | yes | The handler lists only the caller's own panel database. |
| `studio:GetPanelThread` | yes | Reads in the caller's database; another person's id answers "does not exist". |
| `studio:GetPanelThreadAttachment` | yes | The turn is read in the caller's database. A project-bound attachment is authorized again on the named project with the same action (`project-attachments.ts`), which `OwnData` decides: only projects the caller owns. |
| `studio:OpenPanelThread` | yes | Creates a thread in the caller's own database. It is not a `Create*` name, so `WorkspaceCreate` does not cover it. |
| `studio:RenamePanelThread` | yes | Caller's own thread; otherwise `conversation_not_found`. Classified `authoring`, so no PIN. |
| `studio:DeletePanelThread` | yes | Same as rename. Classified `authoring`, not destructive. |
| `studio:SendPanelMessage` | yes | Appends to the caller's thread, or opens one. Another person's id answers "does not exist". |
| `studio:AnswerPanelAsk` | yes | `getAsk(actor.userId, askId)` looks only in the caller's database. |
| `studio:GetPanelAssistantAllowance` | yes | It returns one dollar figure, the cap on the caller's own messages, and no other person's data. Settings reads it on load (`apps/web/.../use-settings-data.ts`). |
| `studio:SetPanelAssistantAllowance` | **no** | It is **not** the person's own setting. `bindSettings` (`programs/_shared/runtime.ts:373`) stores it in `secretKeys.modelKeys.setAssistantAllowance`. That is one record (`secret-keys:model-settings`, `assistantAllowanceUsd`) for the whole workspace, beside the workspace's assistant key. A user setting it would change what every person's messages may spend. This matches its `secrets.manage` permission, and matches `secrets:SetAssistantModel` being withheld from users. |

**Origin condition.** The registry opens a paired client's call with origin `extension-chat` and a panel call with `panel` (`program-iam-gate.ts:121`). Requiring `fluxiq:RequestOrigin = panel` means a paired browser's credential is refused by IAM itself; before, only the handler's channel check refused it, and the audit records the deny.

**`FluxIQReadOnlyAccess` (unchanged; decided and tested).** Its generated list already holds `ListPanelThreads`, `GetPanelThread`, `GetPanelThreadAttachment` and `GetPanelAssistantAllowance` on workspace content. So a read-only person:
- reads their own threads and the allowance;
- is refused open, rename, delete, send, answer and set-allowance;
- still never reaches another person's thread, because the database looked in is their own.

Its attachment read in a project is workspace-wide, as every other read-only Studio read is.

## Tests (new file, through the real registry)

1. **Completeness.** Every registered panel endpoint is either granted or explicitly withheld, so a new W4 endpoint fails here until someone decides it.
2. **Alice under `FluxIQUserAccess` uses every granted endpoint on her own chats:**
   - list, get, a navigation attachment, a proposal attachment in her own project, open, rename, send (scripted model), answer, get allowance and delete;
   - the audit shows each decision on her user FRN matched `FluxIQUserAccess` / `OwnPanelAssistant`, and the project decision matched `OwnData`;
   - `set-panel-assistant-allowance` is refused (`authorization.forbidden`, one deny row) and the allowance is unchanged.
3. **Bob under `FluxIQUserAccess` cannot reach Alice's thread.** For get, attachment (both kinds), rename, delete, send and answer (using Alice's real ask id), each response on Alice's id equals the response on a missing id, and none is `authorization.forbidden`. Bob's list is empty. Nothing in Alice's project is read. Alice's thread keeps its title and 4 turns. Bob's own proposal turn read in Alice's project is refused by IAM; in his own project it is allowed.
4. **Alice's paired browser** (`channel: "paired-client"`, the paired permissions) is refused every panel endpoint, set-allowance included. The refusal comes from IAM, not the handler: the error is not the handler's message, and there is exactly one audit row per call, `deny` with origin `extension-chat`.
5. **`FluxIQReadOnlyAccess`:** the four reads are allowed, the six writes are refused, and Bob gets missing-thread answers on Alice's thread.

**Mutation check.** I replaced the origin condition with `fluxiq:PrincipalType = user` and reran both user-access test files. Two cases failed: the evaluator case (`extension-chat studio:ListPanelThreads: expected 'allow' to be 'deny'`) and the registry paired-browser case (the handler's message appeared). I then restored the policy from a backup and confirmed the restored line reads `"fluxiq:RequestOrigin": "panel"`.

## Commands run and observed results

All were run from the Core root, each vitest run after checking free memory was at least 2000 MB. One reading of 1560 MB was waited out.

- `pnpm structure:check`: `structure-audit: passed (537 warning(s), 917 baselined).`
- `pnpm --filter fluxiq exec vitest run src/platform/iam/predefined src/programs/automation-studio/api/panel-assistant/tests/user-access.test.ts`: 4 files passed, 31 tests passed.
- The mutation run described above: 2 failed, 10 passed, as intended. The policy was then restored.
- Acceptance, `pnpm --filter fluxiq exec vitest run src/platform/iam src/programs/automation-studio/api/panel-assistant src/programs/_shared/iam`: **1 failed | 32 passed (33) files; 1 failed | 299 passed (300) tests.** The failure is `thread-changes.test.ts > under the service profile, FluxIQUserAccess alone grants no panel endpoint`, with `expected { ok: true, …(1) } to match object { ok: false, …(1) }`. That is W4's pin of the old denial.
- Extra check, `pnpm --filter fluxiq exec vitest run src/programs/_shared/tests/api-iam-escalation.test.ts` (`FluxIQUserAccess` over every live registration): 6 passed.

## Not verified

- No live or hosted run, and no web tests; Core's dist was not rebuilt.
- Whether a hosted user who does not own the workspace's assistant key can actually get a model for `send-panel-message`. The key is released through `sessionKeyPorts`, and `secrets` keys are `OwnData`-scoped to their creator. IAM now lets the call through, but the model lookup may answer "locked key" for a non-owner.
- No whole-package typecheck, per the brief. vitest transpiles without a full type check.

## Open questions or contradictions found

1. **The brief contradicts itself on `thread-changes.test.ts`.** The lead says "update that test so it pins the grant", but the owned paths say "do not edit W4's existing tests". I did not edit it. The edit needed, in `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/thread-changes.test.ts`:
   - Delete the last case, `it("under the service profile, FluxIQUserAccess alone grants no panel endpoint (finding recorded in the report)", ...)`, about 6 lines at the end of the `describe`. The new `tests/user-access.test.ts` now pins the grant.
   - Optionally also remove the now-redundant `ownPanelThreads()` helper and `policies: [ownPanelThreads()]` in the "another person's thread" case. Its comment, "which `FluxIQUserAccess` does not grant", is now stale. That case passes either way.
2. **`set-panel-assistant-allowance` (and `get-…`) declare `endpointResource.selfUser()`, but the setting is workspace-wide.** That is W4's source. The resource should probably be `endpointResource.workspace()`. Otherwise any custom policy that grants `studio:SetPanelAssistantAllowance` on the caller's own user FRN would let one user change every user's allowance. Today no predefined policy does that: Owner and Administrator reach it on any resource, and User does not.
3. **Hosted Settings for a `FluxIQUserAccess` user still loads `secret-keys/get-assistant-model`**, which acts on the workspace and is refused to users. The allowance now loads, but the model choice does not. This is outside this brief.
