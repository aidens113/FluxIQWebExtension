# t1095 ext-bg report

## Outcome
Done. All six items landed in the owned paths. Remaining test failure is outside them (see below).

## What changed (before / after)
1. Defect 3. Before: `conversation-relay.ts` `listAll` merged `list-panel-threads` into the all-projects list and returned a refusal as the whole list. After: `listAll` is one `list-conversations` call; `assistant-chats.ts` deleted. Tests rewritten (`conversation-relay.test.ts`, `panel-control.test.ts`).
2. Defect 4 / I5. Before: a project switch lived only in browser storage. After: `writeCoreActiveProject` (`connection/core-api.ts`) POSTs `{ activeProjectId }` to `/api/client-gateway/automation-studio-context` with the client's bearer token; `ProjectContext.shareChoice` -> `PanelProjectAccess.choice().shareChoice` -> `relayProjects` `select` calls it before `choose`. A refused (403/401/other failure) write returns Core's sentence and the choice is not made; unreachable, timed_out or not_paired keeps the browser copy as the offline fallback. Following Core (null) writes nothing. Adoption from the snapshot is unchanged. Tests: `core-api.test.ts` (request shape, 403 sentence, unreachable, no token), `projects-relay.test.ts`.
3. panelCreateProject removed from `shared/constants.ts`, `shared/panel/projects.ts`, `shared/protocol.ts` re-exports and `projects-relay.ts`; test now asserts the message is gone.
4. I6. `PanelOpenFluxIQRequest` gains `conversationId`/`projectId`; `panel-control.ts` opens `/chats/<conversationId>?project=<projectId>` (uses existing `fluxIQWebPageAddress` "chat", both encoded). Either alone, or with flowId/runId, is `invalid_request`. Two tests added.
5. D11. `relay-failure.ts` `no_project` and the flowId branch of `panel-control.ts` now say "Make a project in the FluxIQ panel, or send a message and FluxIQ makes one." Link purpose "projects" already exists in `panelOpenFluxIQ`; ext-ui attaches it. Owned tests updated.
6. I4. New test in `connection/tests/gateway-session.test.ts`: a second `server.pairing_required` on the same socket replaces `pairingReferenceCode` (REF-A to REF-B); it passed with no code change, so no fix was needed.

Docs: `docs/architecture/extension-client.md` (Project Focus section and the Open FluxIQ paragraph).

## Commands run and observed results
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t1095-ext-bg node scripts/test-extension.mjs src/background src/shared` -> tests 1056, pass 1055, fail 1. The one failure is `no extension source calls URL.canParse` naming `src/content/identity/destination/verdict.ts` (content, not owned, not touched by me).
- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` -> no output (clean) on the last run. The first run showed 3 errors in `src/panel/**` (ext-ui's in-flight edits: `create` missing on ProjectsPort, `"projects"` purpose, `changeProject`); they were gone by the second run.
- `node scripts/structure-audit.mjs` -> one FAIL, `[working-docs] docs/working/README.md is out of date` (not mine; needs `pnpm structure:baseline`). My own earlier statement-packing violation in projects-relay.test.ts was fixed. A baseline entry "can be lowered" (assistant-chats deletion likely); run `pnpm structure:baseline`.
- `node scripts/check/model-text.mjs` -> ok.

## Not verified
- Live browser behaviour; Core's I5 route (implemented concurrently by another worker), so the real 403 sentence shape is assumed to be `{ ok:false, error }`.
- `background/automation-relay/automation-relay.ts:62` still carries the old "Connect, then try again" sentence (not in my paths), and `src/panel/chat/transport/tests/thread-list-ports.test.ts:52` asserts the old sentence (ext-ui). Both need the new wording.

## Open questions
- Test-run note: an earlier run hung because my first core-api test stacked three `stubFetch` calls and leaked a stub; fixed to one stub.

## Follow-up
Removed (no panel caller, confirmed by grep of src/panel): panelModelKeySave/Replace/Remove (constants, `AUTOMATION_PANEL_MESSAGES`, `model-access/model-key-relay.ts` + test + index export, automation-relay branch), panelConversationRename/Delete (constants, `panel/thread-change-relay.ts` + test, panel-control branch, request types), panelFlowHumannessRead (constants, humanness-relay read branch, request/body types). panelCreateProject had no trace left. Kept: panelFlowHumannessSet, panelTaskHumannessSet, conversation read/send/answer. Tests updated to assert the removed messages are unhandled. Architecture doc rows removed.
no_project wording is one sentence in automation-relay.ts, connection.ts (recording variant "...makes one before recording."), diagnostics/recent-runs.ts and its test, and panel/chat/transport/tests/thread-list-ports.test.ts.

Results: tests `src/background src/shared src/panel` -> 1773, pass 1772, fail 1 (URL.canParse, content). tsc -> clean. model-text -> ok. structure-audit -> 4 FAILs: working-docs README (known) plus three in packages/test-runner/src/ui-e2e/journeys/** (failure-as-empty, swallowed-failure, statement-packing), not my files (another lane's edits).

## Follow-up 2
The browser's own humanness is gone. Removed `humanness` from `FluxIQSettings`; no longer sent by the run relay (automation-relay), the command channel (`withSavedHumanness` deleted), the conversation relay (`savedHumanness` deleted) or the relay contexts (`humanness` dep in background/index.ts, panel-control-deps.ts, relay-context.ts). Removed its merge in `settings-save.ts`, its normalisation in `storage.ts` and `saved-state.ts` (an old stored value is now simply ignored, with no repair note). Settings view no longer carries it through a save; `panel/settings/humanness/**` and its test deleted. Tests rewritten to assert nothing local is sent or stored.
Results: tests `src/background src/shared src/panel` -> 1769, pass 1768, fail 1 (known URL.canParse); tsc -> clean; model-text -> ok.
Remaining `humanness` in background/panel-settings (non-test): `background/panel/humanness-relay.ts` and its wiring (Core-owned per-Flow/task set), a saved-state.ts comment, the settings view's "Change humanness in the FluxIQ panel" link, and leftover slider CSS in `panel/settings/settings.css` (lines 55-58, 87, 99-104; one css assertion in unsaved-changes.test.ts still checks `.humanness-status`, so I left them).
For ext-ui: `panel/chat/transport/ports/task-settings/starting-humanness.ts` still reads `status.settings.humanness` (cast), which is now always absent, so the answer card's "starting humanness" fallback reads 0; it must read Core's stored starting value instead.

## Follow-up 3 (blocked, nothing changed)
Asked: a background read of the person's starting humanness via `identity-access` / `get-my-preferences`, for the task-settings port.
Finding: Core refuses a paired client this endpoint. The paired-client program allowlist, `PAIRED_CLIENT_ENDPOINTS` in `!FluxIQ/packages/fluxiq/src/server/program-route/program-route.ts:110`, holds only two programs, `automation-studio` (line 111) and `secret-keys` (line 190). `identity-access` has no entry, so `get-my-preferences` (registered in `packages/fluxiq/src/programs/identity-access/api/handlers.ts:452-470`, permission `programs.read`, resource `selfUser`) answers a token call 403 before its handler runs.
Second obstacle: the handler calls `readSelfOnlyPayload(request.payload, actor.sessionId, ...)` and `signInStoreFor(service, actor)`; the paired actor's `sessionId` is the gateway session, not an identity session (program-route.ts comment "the gateway session is not an identity session"), so these self-only/sign-in-store checks need confirming against a paired actor.
Change that would allow a self-only read: add `"identity-access": Object.freeze(["get-my-preferences"])` to `PAIRED_CLIENT_ENDPOINTS` (read only, not `update-my-preferences`), with its payload narrowing entry (empty body, like `remove-model-key: []` in the narrowing table near line 377), and a test in `program-route/tests/program-route.test.ts`; then verify `readSelfOnlyPayload`/`signInStoreFor` accept a paired actor (or have the allowlisted path resolve the self user from `actor.userId`). That is a Core change, so I did not work around it (for example, by adding the value to the client snapshot is a possible alternative for Core to choose).
Extension side is ready to follow: once Core allows it, add a typed runtime message (constants.ts, protocol.ts), route it in background/panel via `callCoreProgram(credentials, "get-my-preferences", {}, "identity-access")`, and have `task-settings/starting-humanness.ts` read it, with null or a failed read as 0. Until then `starting-humanness.ts` still reads the removed local field and shows 0.

## Follow-up 4 (done; supersedes the Follow-up 3 block)
Added `panelStartingHumanness` (constants) and `AUTOMATION_PANEL_MESSAGES.startingHumanness` (protocol). `automation-relay.ts` answers it with `deps.call("get-my-preferences", {}, "identity-access")` as exactly `{ startingHumanness: number | null }` (non-number -> null; failures pass through as Core said). `task-settings/starting-humanness.ts` now takes the panel `request`, asks that message each time, clamps to 0-100, and returns 0 for null, a failed read or a throw. `taskSettingsPort(request, _status?)` reads it after the task row (the `status` argument is now unused but kept so `create-extension-chat-transport.ts`, not owned, still compiles). Fixed the stale `create-project` mention in `projects-relay.ts`. Tests: automation-relay (call shape incl. programId, number/null/refusal) and task-settings-port (clamping, failure, throw, read again each time).
Results: tests `src/background src/shared src/panel` -> 1772, pass 1771, fail 1 (known URL.canParse); tsc -> clean; model-text -> ok; structure-audit -> only the docs/working/README note.
