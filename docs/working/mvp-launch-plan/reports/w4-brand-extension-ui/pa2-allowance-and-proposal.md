# W4-PA2: the allowance is decided on the workspace, and a panel proposal keeps its project (lane t900)

## Outcome

Done. This is the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`. Nothing is committed. The `packages/ui-components` changes in that tree are not mine.

## 1. The spending allowance is declared on the workspace

### Declaration before and after

| Endpoint | Before | After |
| --- | --- | --- |
| `set-panel-assistant-allowance` (`studio:SetPanelAssistantAllowance`, `secrets.manage`, authoring) | `endpointResource.selfUser()`, evaluated on `frn:fluxiq:iam:<ws>:user/<caller>` | `endpointResource.workspace()`, evaluated on `frn:fluxiq:platform::workspace/<ws>` |
| `get-panel-assistant-allowance` (`studio:GetPanelAssistantAllowance`, `programs.read`, read) | `selfUser()` | `workspace()` |

The value is one setting for the whole workspace: `secretKeys.modelKeys.assistantAllowance()`, bound in `programs/_shared/runtime.ts:373`.

This follows the existing precedent. `secrets:GetAssistantModel` and `secrets:SetAssistantModel` hold the assistant's other workspace-wide setting, and both declare `endpointResource.workspace()` (`programs/secret-keys/api/handlers.ts`).

I moved the read as well. It reads that same workspace value, so the read and the write are now declared the same way.

### The change

In `register.ts`:

- The local `register` helper takes an optional `resource`, which defaults to `selfUser()`.
- The two allowance registrations pass `endpointResource.workspace()`.
- The header comment says why.

### Effect on the profiles

The new `tests/allowance-resource.test.ts` pins this table.

I also checked the old behaviour directly. I put `selfUser()` back temporarily and ran the test, then restored the fix:

- The own-user case failed: a grant on the caller's own user received `read: allow, change: allow`.
- The two profile cases passed unchanged.

So the only behaviour that changed is the person-scoped grant.

| Who | Before (read / change) | After (read / change) |
| --- | --- | --- |
| `local`, admin (`secrets.manage`) | allow / allow | allow / allow |
| `local`, viewer, or a user without `secrets.manage` | allow / deny | allow / deny |
| `service`, `FluxIQOwnerFullAccess` | allow / allow | allow / allow |
| `service`, `FluxIQAdministratorAccess` | allow / allow (content pattern matched the user FRN) | allow / allow (workspace FRN) |
| `service`, `FluxIQReadOnlyAccess` | allow / deny | allow / deny |
| `service`, `FluxIQUserAccess` | deny / deny | deny / deny |
| `service`, a grant on `user/${fluxiq:PrincipalId}` | **allow / allow** | **deny / deny** |
| `service`, a grant on the workspace FRN | deny / deny | allow / allow |

`local` decides by permission alone, so its row cannot change. No predefined policy relied on the old declaration, so no policy was edited.

### Regenerating the catalogs

I ran both regenerate switches. They changed nothing: every generated entry has `resourceTypes: ["*"]`, so the declared resource does not appear in the catalogs.

### Other panel-assistant endpoints

I checked every other panel-assistant endpoint. Each one acts only on the caller's own per-person panel database, so `selfUser()` matches what it changes:

- `list-panel-threads`, `get-panel-thread`, `open-panel-thread`, `rename-panel-thread` and `delete-panel-thread` work on the caller's own threads.
- `send-panel-message` and `answer-panel-ask` store turns in the caller's own threads. Any program call they start goes through the registry as the person and is decided on its own resource.
- `get-panel-thread-attachment` reads the caller's own thread. It decides a project-bound read separately, on the project (part 2).

No other endpoint has this defect.

## 2. A panel proposal's reference keeps its project

### Where the reference is written

No Core code writes a proposal (`flow-graph-diff`) or any other project-bound attachment into a panel thread today. The previous report said the same, and a fresh search confirms it:

- the only panel attachment writer is `loop/call-step.ts` `clientAction`, which writes `panel.client-action`;
- `flow-graph-diff` turns are written only into project threads, by `runtime/conversations/commands/execute.ts`.

Every assistant turn reaches the thread through one write path: `PanelAssistantTurnState.post` (`runtime/conversations/assistant/panel-assistant.ts`, `state()`). That is where the project is now stored. I made these changes:

- **`loop/types.ts`**: a new type, `PanelAssistantTurnAttachment = AutomationStudioConversationAttachment & { projectId?: string }`. `post` takes it.
- **`attachments/project-ref.ts` (new)**: `panelAssistantAttachmentProjects`.
  - `stored(attachment)`: a navigation is stored unchanged. Any other kind must name its project; it is refused when the project is missing, empty or `panel`, and an invalid id is refused too. The stored reference becomes `{"projectId":"<project>","ref":"<resolver ref>"}`.
  - `projectOf(attachment)`: answers `null` for a reference that does not start with `{`, which is every old reference. Otherwise it answers `{ projectId, attachment: { kind, ref: <resolver ref> } }`. A malformed project reference is refused as "This deployment cannot serve a conversation attachment of kind X." (or "Invalid project ID.").
- **`panel-assistant.ts` `post`**: stores `panelAssistantAttachmentProjects.stored(attachment)`.

The stored shape is still `{ kind, ref }`, so the store and the schema are unchanged. Old project-bound references are ids (`flowId:adaptationId`, a capability id), so they never start with `{` and cannot be mistaken for the new format. Panel turns are written only by Core: no endpoint lets a client supply a panel turn's attachment.

### Which project a read uses

`attachments/payload.ts` `panelAssistantAttachmentPayload` decides the order:

1. **`panel.client-action`**: unchanged.
2. **A reference that names its project**: read in that project. The request's `projectId` is not consulted, whether it names another project, `panel`, or nothing. `inProject` receives the reference's project and the bare resolver ref.
3. **A reference without a project (old turns)**: read exactly as before, in the request's `projectId`. It is refused with "…is read in its project: name the project." when there is none or it is `panel`.

IAM is unchanged and never weaker. `inProject` is `project-attachments.ts`:

1. `registry.authorize` with `studio:GetPanelThreadAttachment` and `programs.read` on `{ kind: "project", projectId }`;
2. then `service.assertProjectDomainAccess(projectId, request domain)`;
3. then Core's resolver.

All of that now runs on the reference's project.

The answer's `attachment` echoes the turn as stored, so the project reference appears in it, matching what `get-panel-thread` shows for that turn.

### Tests

**`thread-changes.test.ts`** (real-sql):

- New: "reads a proposal in the project its reference names, whichever project the request names". The proposal is written for A and read while `a-project.two`, `panel` or nothing is open. It resolves in A, and the domain check and the read are both called with A. When A is outside the request's domain, the read is refused before anything is read.
- New, under the service profile: bob's turn names alice's project and is read while `b-project.one` is open. The answer is `toEqual` to the old refusal for an old turn read naming alice's project (`authorization.forbidden`). Nothing is read and the domain check is never called.
- The existing first case still covers old turns: refused without a project, read in the request's project.

**`attachments/tests/project-ref.test.ts`** (new, 5 cases): storing, the refusals, old references, malformed references.

## Commands run and observed results

- `pnpm exec vitest run` on `allowance-resource.test.ts`, `project-ref.test.ts` and `thread-changes.test.ts` (in `packages/fluxiq`) -> 3 files, 16 tests passed.
- The same allowance test with the old `selfUser()` temporarily put back -> 1 failed (own-user grant got `read: allow, change: allow`), 2 passed. The fix was restored and the test re-run -> 3 passed.
- `FLUXIQ_REGENERATE_IAM_CATALOG=1 FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/platform/iam/catalog/tests/live-registry.test.ts src/programs/_shared/assistant/tests/generated-module.test.ts` -> 2 files, 5 tests passed. `git status` shows no change to the generated files.
- `pnpm exec vitest run` on these 32 files -> 32 files, 192 tests passed:
  - `panel-assistant/tests/` and `runtime/conversations/assistant/`;
  - `platform/iam/catalog/tests/` and `platform/iam/predefined/tests/`;
  - `_shared/tests/api-iam-completeness`, `api-iam`, `api-iam-escalation` and `api-iam-parity`;
  - `_shared/assistant/tests/generated-module`;
  - `programs/tests/endpoint-classification`;
  - `handlers/tests/domain-scope` and `handlers/tests/llm-generation`.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t900 -- node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` (in `packages/fluxiq`) -> exit 0. It ran twice; the second run followed the last edit (`heavy-slot: t900 took slot-2`).
- `node scripts/structure-audit.mjs` (Core root):
  - first run -> 1 violation: `shared-temp-root`, a fixed `os.tmpdir()` path in the new allowance test. The test opens no thread, so I removed the path (`root: undefined`).
  - re-run -> `structure-audit: passed (530 warning(s), 969 baselined).`

## Not verified

- Live HTTP through `apps/web`, and the dock drawing a panel proposal. `apps/web` is W5's.
- Writing a proposal through `post` from a real loop step: no step writes one yet. The write rule is tested through `stored`, and `post` is one line that calls it.
- Full suites, per the rules.

## Open questions or contradictions found

1. **The architecture doc now describes the old behaviour.** `docs/architecture/automation-studio/workspace.md` is not in my owned paths, so I did not edit it. Three places need changing:
   - line 843: it says every panel endpoint declares `selfUser()`; the two allowance endpoints now declare `workspace()`;
   - line 855: the allowance row needs that same note;
   - line 857: the attachment rule should say "read in the project its reference names; a reference stored without one is read in the request's `projectId`, refused without one".
2. **Under `service`, an ordinary user still cannot read or set the allowance.** `FluxIQUserAccess` grants neither action, before or after this change; only administrator and owner can set it, and read-only access can read it. That looks intended for the change. If hosted users should see the value in Settings, `user-access.ts` would need `studio:GetPanelAssistantAllowance` on the workspace FRN. This is the same gap as the earlier finding that `FluxIQUserAccess` grants no panel endpoint at all.
3. **The dock may show the new reference text.** `apps/web` `flow-graph-diff/draw.ts:29` prints `attachment.ref` in its "could not be read" line, so a new turn would show the JSON reference there. This is cosmetic. The dock can keep sending `context.projectId`; Core now ignores it for any reference that names a project.

Outcome: Done
Changed: register.ts, project-attachments.ts (comment), panel-assistant/tests/thread-changes.test.ts, panel-assistant/tests/allowance-resource.test.ts (new), assistant/attachments/project-ref.ts (new), attachments/payload.ts, attachments/index.ts, attachments/tests/project-ref.test.ts (new), assistant/loop/types.ts, assistant/panel-assistant.ts
Validation: vitest 16 tests (new and touched) plus 192 tests across 32 IAM and panel files passed; tsc exit 0; structure-audit passed
Not verified: live HTTP and dock drawing; a real loop step posting a proposal (none exists); full suites
Report: C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w4-brand-extension-ui/pa2-allowance-and-proposal.md
