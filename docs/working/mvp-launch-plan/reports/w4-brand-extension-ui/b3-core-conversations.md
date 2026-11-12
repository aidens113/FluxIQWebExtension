# W4-B3-core: rename, delete and fresh conversations in Core (lane t900)

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`, branch `task/t900-brand-extension-ui`. Nothing is committed.

## Final contract (as built)

| Endpoint | Body | Answer | Error codes |
| --- | --- | --- | --- |
| `rename-conversation` | `{ projectId?: string, conversationId: string, title: string }` | `{ conversation }`, the same record shape `get-conversation` returns | `conversation_title_required`, `conversation_title_too_long` (over 200 after trim), `conversation_not_found`, `conversation_ambiguous`, `authorization.forbidden` |
| `delete-conversation` | `{ projectId?: string, conversationId: string }` | `{ deleted: true, conversationId }` | `conversation_run_active`, `conversation_not_found`, `conversation_ambiguous`, `authorization.forbidden` |
| `open-conversation` | adds `fresh?: boolean`; only `true` counts | unchanged | unchanged |
| `list-conversations` | `projectId` absent or null lists across projects | unchanged | unchanged |

- **Rename** trims the title and refuses an empty one or one over 200 characters. The title is checked before the thread is looked up, so the answer about the title never depends on whether the thread exists. The thread's `revision` goes up by one and an `update` goes on the change feed. `updatedAt` does not change, so renaming does not reorder the thread list.
- **Delete** runs in one transaction. It removes:
  - the `conversations` row, the thread's `conversation_turns` and its `conversation_asks`;
  - every `mutation_records` row owned by the thread or by one of its asks, plus their `mutation_touched_entities` rows. Only the delete's own mutation record is kept.
  - It also writes a `delete` change on the feed.

  The mutation records go because each one stores its response JSON, which for a turn is the person's words. Leaving them would keep deleted text, and replaying `conversation.open:<id>` would bring back a deleted thread. The test opens a thread again under a deleted id and gets an empty new one.

  I found no other project-database rows that name a conversation. An attachment is only a kind plus a reference to something the thread does not own. The change feed holds ids and revisions, not words.
- **Fresh open** skips the "continue the open or ambient thread" branch and mints a new open thread. Core's own later writes about that subject continue the newest open thread, because the lookup orders by `updated_at_ms desc`. The old thread stays open and listed.
- **List without `projectId`** already existed (`listConversationsForRequest`, with the IAM list filter). I confirmed it and added tests for both IAM profiles.
- **Error codes** are carried as `diagnostic.code` on `AutomationStudioConversationRefusal` (`runtime/conversations/refusal.ts`). The registry already maps that to `errorCode`. A missing thread and a foreign thread get the same code and the same words: "I could not find that conversation."

## How authorisation is enforced

These endpoints reuse Core's existing IAM; there is no new ad-hoc check.

- Both endpoints are registered like `append-turn`: `programs.write`, classification `authoring`, actions `studio:RenameConversation` and `studio:DeleteConversation`, access level `Write`.
- The resource is the named project, decided by the registry gate. Under the `service` profile that means the project-owner condition: a conversation has no owner column, and a project's child carries its project's owner. When `projectId` is absent, the resource is the workspace, the same rule `list-conversations` uses.
- A named project also gets `assertProjectDomainAccess`, as every conversation endpoint does.
- With no `projectId`, the handler searches the domain's projects (`listProjects(domainId)`). It searches only the projects that `registry.authorize({ action, permission: "programs.write", resources: { kind: "project", projectId } })` allows. That is the registry's existing IAM decision API, so each project is decided exactly as a call naming it would be.

**Tenant isolation** (tested under the `service` profile with `FluxIQUserAccess` and prefix owners):

| What Bob does | Answer |
| --- | --- |
| Names his own project with Alice's thread id | `conversation_not_found`, byte-equal to the answer for a missing id |
| Names Alice's project | `authorization.forbidden`, equal whether or not the thread exists. This is the existing project-level rule every project endpoint follows; it reveals nothing about the thread. |
| Names no project | Refused alike for a real or a missing id. With a workspace-wide grant added, it is `conversation_not_found` for Alice's thread. |

**Limitation:** under the `service` profile, `FluxIQUserAccess` grants nothing on the workspace for these actions, so a call without `projectId` is forbidden unless the caller has workspace-wide access. This fails closed. Clients should send `projectId` from the thread record, which every `list-conversations` row carries. I did not change the predefined policy.

**Paired client:** both endpoints are on the allowlist and narrowed. A rename may carry only `projectId`, `conversationId` and `title`; a delete only `projectId` and `conversationId`. A token reaches only `read` and `authoring` endpoints, so delete has to be `authoring`. That matches `delete-flow`, which is also `authoring` (no PIN).

## The run-link finding

Core has no single record linking a run to a conversation. A delete is refused with `conversation_run_active` when any of the four links below holds:

1. **A pending ask with `parks = 1`.** A run is waiting on that ask's row. Checked in the store, inside the delete transaction, so this check is atomic.
2. **Background chat command work started from the thread** that is still running in this process. Builds, `run.execute`, explore and improve all write their ending into the thread. `commands/work.ts` now counts tracked work per thread, and `execute.ts` passes the thread.
3. **A task attempt the thread holds that is still `working` or `waiting_for_person`.** Read through the answer-first locator (`flowsOfConversation`) and the interrupted-aware read the person's read uses, so a row a dead Core left `working` reads as interrupted. An unreadable locator or attempts file throws, so the delete fails closed. Implemented in `conversation-requests/run-links.ts`; I only import answer-first, never edit it.
4. **A non-terminal runtime session that is the thread's own subject:** `subject.kind == "run"` with that `runId`, or `kind == "flow"` with that `flowId`. Runs and builds keep a writer bound to their subject thread's id, and deleting under it makes their next write fail with "Unknown conversation".

Gaps that remain:

- **Race windows.** Checks 2 to 4 run before the transaction, so a run that starts in between is not caught.
- **Process scope.** Check 2 only sees work in this process.
- **Builds.** A `build`-kind subject is not checked, because I found no active-build lookup. A build's asks go to its Flow's subject anyway.
- **No run-link source.** If no run-link port is wired in, every delete is refused (fail closed). Production wires it in `register.ts`.

## What changed and why (Core paths)

- `packages/fluxiq/src/runtime/conversations/`:
  - `refusal.ts` (new): the coded refusal class.
  - `inputs.ts`: rename and delete input types, and `automationStudioConversationTitleOrRefuse`.
  - `store.ts`: `renameConversation`, `deleteConversation` and `removeThreadRows`.
  - `conversations.ts`: rename and delete on the service, and `fresh` in `openConversation`.
  - `writer.ts`: `fresh?` on the open request.
  - `index.ts`: exports the refusal.
  - `commands/work.ts`: per-thread counting of running work.
  - `commands/execute.ts`: passes the thread when tracking work.
  - `tests/thread-changes.test.ts` (new).
- `packages/fluxiq/src/framework/automation-service/service/conversation-requests/`: new `thread-of-request.ts`, `rename.ts`, `delete.ts` and `run-links.ts`; `index.ts` exports them. This is the handlers' logic layer, kept here because Automation Studio's controller rule allows only 20-line functions in handlers.
- `packages/fluxiq/src/api-contracts/automation/`: `endpoints.ts` gets `renameConversation` and `deleteConversation`. `conversation.ts` gets the rename and delete request and response types and `fresh` on the open request.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/`:
  - `conversations.ts`: the two registrations, `fresh` passed through, and an optional `runLinks` dependency.
  - `register.ts`: wires `automationStudioConversationRunLinks(service)`. It is lazy and touches nothing on the service at registration.
  - `tests/conversations.test.ts`: endpoint list and mocks updated.
  - `tests/domain-scope.test.ts`: the two endpoints added to `DOMAIN_SCOPED`, and `conversationId` and `title` added to the probe payload.
  - `tests/conversation-changes/tests/conversation-changes.test.ts` (new). It sits in a feature folder because `handlers/tests/` was at the 25-file limit.
- `packages/fluxiq/src/server/program-route/program-route.ts`: allowlist entries and `narrowThreadChange`. Its test `tests/program-route.test.ts` is updated.
- Regenerated through their owning tests' regenerate switches: `packages/contracts/src/iam/actions.generated.ts` and `packages/fluxiq/src/platform/iam/catalog/generated/assistant-tools.generated.json`. `destructive-actions.generated.ts` and `read-only-actions.generated.ts` were rewritten with no content diff (line endings only, so `git diff` shows nothing).
- `docs/architecture/automation-studio/client-gateway.md`: one bullet documenting the new endpoints.

## Commands run and observed results

- `FLUXIQ_REGENERATE_IAM_CATALOG=1 FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/platform/iam/catalog/tests/live-registry.test.ts src/programs/_shared/assistant/tests/generated-module.test.ts` -> 2 files, 5 tests passed.
- `pnpm exec vitest run` on `thread-changes`, `conversation-changes`, `conversations` (handlers), `domain-scope` and `program-route` -> 5 files, 66 tests passed.
- After the test move: `pnpm exec vitest run` on `conversation-changes` (new path), runtime `store`, runtime `conversations`, `inputs`, `panel-command-pin`, `llm-generation`, `endpoint-classification`, `api-iam-completeness`, `live-registry` and `generated-module` -> 10 files, 80 tests passed.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` in `packages/fluxiq`:
  - first run: 5 errors (a missing `route` on test ask options, and `actor` possibly undefined); fixed;
  - re-run: exit 0;
  - final re-run after the test move: exit 0.
- `node scripts/structure-audit.mjs` at the Core root:
  - first run: 3 violations (26 files in `handlers/tests/`, failure-as-empty in `work.ts`, a non-barrel import in `run-links.ts`); all fixed;
  - re-run: `structure-audit: passed (529 warning(s), 969 baselined)`.
- RAM was checked before each heavy command and I waited when it was under 2.5 GB. The exception is the second tsc: it started at 1.87 GB because I checked RAM but did not wait. It completed normally.

## Not verified

- Live HTTP through `apps/web`'s program route with a paired token. Only the allowlist, the narrowing unit and registry-level calls are tested.
- `pnpm --filter fluxiq check` through the build-cache wrapper. I ran the same `tsc --noEmit` directly.
- Full suites, per the rules.
- Run links 3 and 4 (task attempts and subject runtime sessions) have no dedicated test against real attempt files or sessions. The handler test stubs `runLinks`, and links 1 and 2 are tested for real.
- The `contracts` package type check was not run separately. Its generated catalog file is produced by the renderer.

## Open questions or contradictions found

1. **Dangling thread ids after a delete (not fixed).** The answer-first locator (`answer-first/attempt-store/locator.ts`, on the must-not-touch list) keeps `{conversationId, flowId}` entries. After a delete:
   - `list-project-tasks` can still offer "open in chat" for the deleted thread id;
   - `list-conversation-task-attempts` for that id still answers.

   Fixing it needs a "forget thread" operation in answer-first, owned by that lane.
2. **`apps/web` route test.** `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts` keeps its own `ALLOWLISTED` list. It still passes, because unknown endpoints fall back to classification `destructive` there, but it does not exercise the two new endpoints. The `apps/web` owner should add them.
3. **Delete classification.** Delete is `authoring` (no PIN) so the paired allowlist can reach it, consistent with `delete-flow` and "no PIN for normal actions". If the supervisor wants it PIN-gated, it cannot stay on the token allowlist.
4. **Panel assistant's reserved database.** Its `panel_assistant_waiting_calls` rows name a conversation. No endpoint deletes panel threads, so this is untouched; `store.deleteConversation` on a reserved database would leave those rows.
5. **Fresh threads in the same millisecond.** If a fresh thread is created in the same millisecond as another open thread for the subject is touched, which one Core continues falls back to `conversation_id` order. That order is arbitrary but harmless. The test waits 5 ms before opening the fresh thread.

Outcome: Done
Changed: listed above (Core worktree only, plus this report)
Validation: tsc exit 0; vitest 10 files / 80 tests passed; structure-audit passed
Not verified: live HTTP and paired-token path, run links 3 and 4 against real attempt and session data, full suites
Report: C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w4-brand-extension-ui/b3-core-conversations.md
