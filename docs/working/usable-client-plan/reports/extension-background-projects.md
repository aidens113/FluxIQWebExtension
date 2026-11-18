# Extension background: projects, selection, snapshot fetch (t915, U3)

## Outcome
Done for the worker side, with two caveats: `pnpm check` could not pass here (Core build stale, and the panel UI files other workers own fail to type check against a not-yet-built ui-components); see Commands.

## What changed and why
- Messages `panelListProjects`, `panelCreateProject`, `panelSelectProject`, `panelChanges` in `shared/constants.ts`; types in new `shared/panel-projects.ts`, re-exported from `protocol.ts`; `ExtensionStatus.projectChosenBy`. Storage key `projectChoice`.
- New `background/projects/` (barrel, `projects-relay.ts`, `choice-storage.ts`, `panel-changes.ts`, tests). List calls Core `projects` and returns only `id`, `name`, `updatedAt` (owners dropped) plus `selectedProjectId`; create sends `{ name }` only; select checks the project is in Core's list, then keeps `{ projectId, name }`; `null` follows Core. Listing drops a chosen project that no longer exists and falls back to Core's.
- Choice persisted in `chrome.storage.local["fluxiq.projectChoice"]`, keyed by lower-cased server address; reloaded at worker start and when the address changes.
- `ProjectContext` (`connection/project-context.ts`): `choose`, `loadChoice`, `chosenProject`, `chosenBy`, `noteName`, `held`, and `forPanel`. The choice wins in `current()`, `resolve()` and `forPanel()`, so recordings and automation relays use it too.
- Snapshot root cause: every panel relay awaited `resolve` -> `GET /api/client-gateway/snapshot` (bounded 1 s, reused 1 s). `forPanel` asks Core once per lease (invalidate on a new host lease clears it), then answers from the held project and refreshes in the background at most every 15 s (`CORE_PROJECT_CONTEXT_REFRESH_MS`). A changed Core project is adopted onto the session and now emits status (`adoptProjectId` calls `emitStatus`), so following Core still works when nothing is chosen. `resolve` itself is unchanged for recordings (its existing tests still pass).
- Panel wiring: `panel-control.ts` routes the three messages (control-page only, as the other panel messages); `PanelControlDeps.projects` added; `panel-control-deps.ts` uses `connection.panelProjectId()`.
- docs/user/quickstart.md step 3: unlock passage replaced; the saved key works at once; kept only the no-key card and the older-key one-sign-in note.

## Edits outside the listed paths (needed, small)
`apps/extension/src/background/connection.ts` (the `FluxIQConnection` facade): status fields, `panelProjectId()`, `projectChoice()`, `projectId()` using the choice, choice loading, `emitStatus` on adoption, `panelChanges` send. Nothing else owns status building, so it could not be done in the listed files.

## panelChanges: what Core pushes
Core pushes `server.activity` (`ClientGatewayActivity`) to sessions that declared the `fluxiq.activity` capability: it carries `subject.projectId`, an optional `conversationId`, `phase`, `final`, and a `detail` row. Nothing else usable (no conversation-list, attempt or run-change push; `server.session_ready` carries the project once on connect). So `panelChanges` is emitted (via `chrome.runtime.sendMessage`) for each accepted activity naming a project or conversation: `{ projectId, conversationIds?: [id], at }`. It does not fire for conversation changes made from another client with no run activity (for example a rename in the web app, or an append with no run); the panel must keep a slow read for those. It also does not report Core's project switching.

## Commands run and observed results
- `node scripts/check/core-build.mjs` -> exit 1: "Core's build is not current with its source" (stale: contracts, sdk, fluxiq, client-gateway-websocket; ui-components "no stamp"). Core is being edited by other workers; not mine to rebuild.
- `node apps/extension/scripts/test-extension.mjs src/background/projects src/background/panel src/background/connection src/shared` (from EXT; same path form as the brief) -> tests 520, pass 520, fail 0. New tests: `projects/tests/{projects-relay,panel-changes,choice-storage}.test.ts`, `connection/tests/project-context-panel.test.ts`.
- `pnpm --filter ... check` -> blocked by core-build (exit 1) before reaching tsc. `node scripts/check-extension.mjs` run directly: see Notes for the final result.
- `pnpm exec tsc --noEmit -p .` earlier: errors only in `src/panel/chat/chat-panel.ts` and `src/panel/projects/*` (ui-components does not export `createProjectSwitcher`, `ProjectsPort`, `ProjectSummary`, and `ChatWidgetOptions.activity` yet). None in files I own.

## Not verified
Live browser behavior (worker restart persistence, real Core `projects` response shape for tokens, which depends on U2's allowlist and projection). The projection assumes `{ projects: [{ id, name, updatedAt }] }` and `{ project: { id, name } }`.

## Open questions
- Following Core's project is a 15 s background refresh, not a push, because Core has no project-change push. If a push is wanted, Core needs one.
- A chosen project also drives recordings (`resolve` returns it), as the brief says "every call".
