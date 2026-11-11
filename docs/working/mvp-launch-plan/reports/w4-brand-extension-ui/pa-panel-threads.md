# W4-PA: panel-assistant threads get attachment reading, rename and delete (lane t900)

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`. Nothing is committed. The ui-components changes already in that working tree are not mine.

## Endpoints (names as built)

All three are `automation-studio/<name>`, registered through the panel assistant's existing `register` helper (`programs/automation-studio/api/panel-assistant/register.ts`). Each one:

- uses `resource: endpointResource.selfUser()`;
- takes the user from the signed-in actor, never from the payload;
- refuses a paired client (`authorization.forbidden`, as the other panel endpoints do);
- is hidden from the assistant's tools.

| Endpoint | IAM action | Permission / class | Body | Answer | Codes |
| --- | --- | --- | --- | --- | --- |
| `get-panel-thread-attachment` | `studio:GetPanelThreadAttachment` (Read) | `programs.read` / `read` | `{ conversationId, turnId, projectId? }` | `{ attachment: { attachment: { kind, ref }, payload } \| null }` | thrown refusal for an unservable kind or a project-bound kind with no project; `authorization.forbidden` when IAM refuses the named project; whatever `assertProjectDomainAccess` throws |
| `rename-panel-thread` | `studio:RenamePanelThread` (Write) | `programs.write` / `authoring` | `{ conversationId, title }` | `{ conversation }` (the `list-panel-threads` record: `projectId: "panel"`, `subject: { kind: "panel", id: "panel" }`) | `conversation_title_required`, `conversation_title_too_long` (over 200 after trim), `conversation_not_found` |
| `delete-panel-thread` | `studio:DeletePanelThread` (Write) | `programs.write` / `authoring` | `{ conversationId }` | `{ deleted: true, conversationId }` | `conversation_run_active` (the same code as conversations; no panel-named variant), `conversation_not_found` |

The keys in `PANEL_ASSISTANT_ENDPOINTS` are `getThreadAttachment`, `renameThread` and `deleteThread`. The existing panel endpoints have no `api-contracts` entries; their names live only in `PANEL_ASSISTANT_ENDPOINTS`. For consistency I added none.

### Attachment read

It follows `get-conversation-attachment`'s contract:

- `null` when the person's threads hold no such turn, or the turn shows nothing;
- a thrown error, never an empty payload, when the kind cannot be served.

Panel threads belong to no project, so there are two sorts of attachment (`runtime/conversations/assistant/attachments/payload.ts`):

- **`panel.client-action`** (the navigations the loop writes) answers the `{ tool, input }` its reference holds.
- **Project-bound kinds** (`flow-graph-diff`, `panel-capability-result`) are read in the project `projectId` names (`project-attachments.ts`), in this order:
  1. IAM decides it through `registry.authorize` with the endpoint's own action on `{ kind: "project", projectId }`. This is the same decision mechanism B3 used.
  2. `service.assertProjectDomainAccess(projectId, scope.domainId)` runs.
  3. Core's own `automationStudioConversationAttachmentResolver` reads it, with the same limits: 50 entries and 300 characters.

  With no `projectId`, an empty one, or the thread's own `"panel"`, the read is refused with "A conversation attachment of kind flow-graph-diff is read in its project: name the project." The dock must send the project the proposal is in. `read-attachment.ts` today sends `context.projectId`, which for a panel thread is `"panel"`.

The thread is always read first, in the caller's own database. A foreign or missing turn therefore answers `null` before any project is decided or read.

### Delete: what is removed, and what refuses it

- It reuses the conversation store's `deleteConversation` (`removeThreadRows`), which runs in one transaction. It removes:
  - the thread, its turns and its asks;
  - every `mutation_records` / `mutation_touched_entities` row owned by the thread or its asks, which carry the person's words.
- **New panel migration `9004_panel_waiting_calls_follow_thread`.** An `after delete on conversations` trigger removes the thread's `panel_assistant_waiting_calls` rows inside the same statement. Those rows hold the message's words and its tool input. This closes B3's open question 4. The store files are not mine, so the trigger was the way to make this atomic without editing `runtime/conversations/store.ts`.
- **Run links for a panel thread.** I found exactly one link: the assistant's in-process work on the thread, meaning a message's work or the work an answered card starts. There are no others:
  - panel cards are `parks: false`, though the store's parked-ask check still runs inside the transaction;
  - runs and builds a tool starts write into their own project's threads;
  - the loop watch is per message, in memory.
- **`PanelAssistantThreadUse`** (`runtime/conversations/assistant/thread-use.ts`) holds a thread from the moment `send`/`answer` names it until its queued work ends.
  - A delete while it is held gets `conversation_run_active`.
  - A send or answer while a delete runs gets `conversation_not_found`.
  - Both checks are synchronous, so a hold and a removal cannot both pass.
  - The thread id is canonicalised (trimmed and validated) before keying, so `" id "` cannot slip past the check.

### Authorisation and tenant isolation

These endpoints decide exactly as the other panel endpoints do: `selfUser` through the registry. A thread is the caller's because it lives in their own database (`panelAssistantDatabaseId(actor.userId)`), so another person's thread id is simply absent. Rename and delete then answer `conversation_not_found`, byte-equal to a missing id, and the attachment read answers `{ attachment: null }`, equal to a missing id. Tested under the `service` profile (bob versus alice). Bob's own thread naming alice's project is refused by IAM (`authorization.forbidden`), and nothing in her project is read.

**Paired client:** no panel-assistant endpoint is on the program-route allowlist (`server/program-route/program-route.ts` names none). I added none, and the handler refuses a paired actor in any case.

## What changed and why (Core paths)

- `packages/fluxiq/src/runtime/conversations/assistant/`:
  - `store/migrations.ts`: `9004` trigger plus its comment.
  - `store/panel-threads.ts`: `turn`, `rename` and `delete`.
  - `thread-use.ts` (new): the holds.
  - `attachments/payload.ts` and `attachments/index.ts` (new): the panel attachment payload.
  - `panel-assistant.ts`:
    - `renameThread`, `deleteThread` and `readAttachment`;
    - `send` and `answer` hold the thread until their work ends;
    - `queued` releases the hold.
  - `index.ts`: exports.
  - Tests: `tests/thread-use.test.ts` (new); `store/tests/panel-threads.test.ts` (+1 case: a delete takes its waiting calls and leaves another thread's).
- `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/`:
  - `endpoints.ts`: three names.
  - `register.ts`: three registrations. `PanelAssistantApiDependencies.service` now also needs `getFlowBootstrapAdaptation`, `getFlow` and `assertProjectDomainAccess`. The production `AutomationStudioApiDependencies.service` already has them, and they are read only on use.
  - `project-attachments.ts` (new) and `index.ts`.
  - Tests: `tests/thread-changes.test.ts` (new, real-sql). In `tests/register.test.ts` and `tests/consent-attacks.test.ts`, the service stubs gained the three reads, which throw if used.
- Regenerated through their tests' switches:
  - `packages/contracts/src/iam/actions.generated.ts`: three actions;
  - `packages/fluxiq/src/platform/iam/catalog/generated/assistant-tools.generated.json`: three hidden entries;
  - `packages/fluxiq/src/platform/iam/catalog/generated/read-only-actions.generated.ts`: `studio:GetPanelThreadAttachment`.
- `docs/architecture/automation-studio/workspace.md`: a new subsection, "The assistant dock's threads", under "The Chat UI". No Core doc listed the panel-assistant endpoints before, so this is now that list: every endpoint's body and answer, and the rules above.

## Commands run and observed results

- `pnpm exec vitest run` on `panel-assistant/tests/thread-changes.test.ts`, `assistant/tests/thread-use.test.ts` and `assistant/store/tests/panel-threads.test.ts` -> 3 files, 14 tests passed. The new file was re-run after replacing an `as never` stub: 6 passed.
- `FLUXIQ_REGENERATE_IAM_CATALOG=1 FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/platform/iam/catalog/tests/live-registry.test.ts src/programs/_shared/assistant/tests/generated-module.test.ts` -> 2 files, 5 tests passed; the 3 generated files changed as listed.
- Touched and neighbouring tests, via `pnpm exec vitest run` on `register`, `consent-attacks`, runtime `panel-assistant`, `llm-generation`, `domain-scope`, `endpoint-classification`, `api-iam-completeness`, `live-registry` and `generated-module` -> 9 files, 65 tests passed.
- `pnpm exec vitest run src/platform/iam/predefined/tests/ src/server/program-route/tests/program-route.test.ts` -> 4 files, 51 tests passed.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t900 -- node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` in `packages/fluxiq`:
  - first run, before the stub fix: exit 0;
  - re-run after it: exit 0 (`heavy-slot: t900 took slot-2`).
- `node scripts/structure-audit.mjs` at the Core root:
  - first run: 1 violation (`as-never` in the new test); fixed with a typed `vi.fn<...>` and `as unknown as AutomationStudioBootstrapAdaptation`, as `attachments/tests/flow-graph-diff.test.ts` does;
  - re-run: `structure-audit: passed (530 warning(s), 969 baselined)`.

## Not verified

- Live HTTP through `apps/web`'s program route, and the dock drawing a panel-thread proposal (W5's U5). `apps/web` is not mine. The dock must call `get-panel-thread-attachment` with the proposal's real `projectId`.
- A delete racing work across processes. The holds are per process; the assistant's work runs only in the process that registered it.
- Full suites, per the rules. The `contracts` package type check was not run separately (its file is renderer output).

## Open questions or contradictions found

1. **Under the `service` IAM profile, `FluxIQUserAccess` grants no panel-assistant endpoint at all, old or new.** A test pins this (`list-panel-threads` and `delete-panel-thread` -> `authorization.forbidden`). `selfUser` evaluates on `frn:fluxiq:iam:<ws>:user/<self>`, which neither statement covers:
   - `OwnData` covers only `studio:`, `secrets:` and `gateway:` FRNs;
   - `SelfService` lists only credential actions.

   So, as that policy stands, a hosted user cannot use the dock. The tests grant the six panel actions on `user/${fluxiq:PrincipalId}` explicitly. The fix belongs in `platform/iam/predefined/user-access.ts` (not my path): add the `studio:*Panel*` actions on the caller's own user to `SelfService`, or give `selfUser` a studio FRN. The lead should route it.
2. **`readAttachment` in `apps/web` sends `context.projectId`.** For a panel thread that is `"panel"`, which I treat as no project, so a proposal is refused until the dock sends the proposal's project. W5 needs to know this; also, no Core code yet writes a `flow-graph-diff` turn into a panel thread. The fixture would plant one, as my test does.
3. **The answer-first locator still lists deleted thread ids** (B3's open question 1). This does not apply to panel threads: answer-first never names a panel thread.

Outcome: Done
Changed: listed above (Core worktree only, plus this report)
Validation: tsc exit 0; vitest 14 + 65 + 51 tests passed across the files named; structure-audit passed
Not verified: live HTTP and the dock's U5 drawing; cross-process delete races; full suites
Report: C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w4-brand-extension-ui/pa-panel-threads.md
