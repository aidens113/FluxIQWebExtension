# Gateway project focus (t915)

CORE = `fxwork/t915/!FluxIQ`, EXT = `fxwork/t915/!FluxIQWebExtension`. Nothing committed.

## Outcome
Done. A paired client sends `client.focus_project { projectId: string | null }`. Core checks it through the same path a paired program call uses, then moves `session.projectId`. After that, `server.activity` follows the chosen project. The activity filter is unchanged.

## What changed and why
- **Contract** (`packages/contracts/src/client-gateway.ts`, +test):
  - New client message `client.focus_project`.
  - New server reply `server.project_focused { projectId }`.
  - `CLIENT_GATEWAY_PROJECT_FOCUS_REFUSAL_CODES`: `project_focus.invalid`, `.not_paired`, `.refused`, `.unavailable`.
  - Each answer carries the request id as `correlationId`. No capability is involved, and an older Core ignores the message.
- **Core gateway** (`client-gateway/service/`):
  - New `project-focus/` collaborator.
  - Routes the message only after the existing ready gate, so an unready session gets `server.pairing_required`.
  - Refuses with `not_paired` any session that is not person-paired (managed host, channel-scoped, or no operator).
  - Refuses a malformed id with `invalid`.
  - `null` returns the session to `pairedProjectId`, which `trust-grant.ts` and `lifecycle.ts` record when the session becomes ready.
  - A project id goes to an installed authority. A missing authority or a thrown error gives `unavailable`; a "no" gives `refused`.
  - Only the latest request per session is applied. A late answer, or one arriving after a disconnect, is dropped.
  - The new fields are stripped in `toPublic`.
  - The facade exposes `readonly projectFocus` (port: `setAuthority`), plus option `projectFocusAuthority`. This is a field, not a method, because the facade is at its 40-method limit.
- **Core authority, outside the brief's owned paths** (`programs/automation-studio/api/project-focus/` plus one line in `handlers/register.ts`):
  - The gateway holds no identity or IAM, and the composition root `programs/_shared/runtime.ts` is being edited by the model-key worker. So the authority is installed from `registerAutomationStudioApi`, which already receives the registry, service, `identityAccess` and the gateway.
  - It mirrors the route:
    - **Actor:** the approving user, who must be enabled and have a role, with permissions narrowed to `programs.read` on the `paired-client` channel.
    - **Domain:** `assertProjectDomainAccess(projectId, declared domain)`.
    - **Read check:** `registry.call(automation-studio/projects)` as that actor must list the project. That call is filtered by IAM item by item.
  - Another tenant's id is unknown to the instance, so the domain gate refuses it.
- **EXT**:
  - `background/projects/project-focus.ts` (`ProjectFocus`) sends on choose and on clear (`null`).
  - It sends only while connected and is never queued. After each `server.session_ready` while a choice is held, it sends again; `ServerCommandChannel.handleSessionReady` calls it right after `markSessionReady`.
  - `focus-refusal.ts` reads the `project_focus.*` errors. The channel logs a warning activity, does not call `markFailed`, leaves lastError alone, and keeps the choice.
  - Wired in `connection.ts`: the `projectChoice().choose` wrapper, and an announce after the stored choice loads.
- **EXT bug found and fixed** (`connection/project-context.ts`): `loadChoice()`, which starts at worker start, overwrote a choice the person made before its storage read returned. It now skips an outdated read and returns whether it changed the choice.
  - In the same file and in `connection.ts`, I gave the earlier projects worker's swallowed `.catch`es a stated best-effort reason and switched their imports to the barrel. The audit had flagged these.
- **Docs:**
  - CORE: `docs/integrations/client-gateway-websocket.md` has a new "Project Focus" section and updated message lists. **`docs/architecture/client-gateway.md` does not exist in Core.**
  - EXT: `docs/architecture/extension-client.md` has a new "Project Focus" section and updated message lists.

## Commands run and observed results
| Command | Result |
|---|---|
| CORE `pnpm --filter fluxiq exec vitest run src/client-gateway` | 74 files, 581 passed. Includes the new `project-focus/tests/focus.test.ts` (14 tests). |
| CORE `vitest run src/programs/automation-studio/api/project-focus` | 3 passed. Real runtime, service profile: own project focused and its activity delivered; Bob's project, another domain's, a missing one, and a disabled approver are all refused. |
| CORE `pnpm --filter @fluxiq/contracts exec vitest run src/tests/client-gateway.test.ts` | 15 passed |
| CORE `pnpm --filter fluxiq check` | 1 error, in `framework/.../runtime-adaptation/tests/result-check.test.ts` (`unlockSessionId`). That file belongs to the model-key/unlock worker. My one earlier error is fixed. |
| CORE `node scripts/structure-audit.mjs` | 13 FAIL, none mine: apps/web, `programs/_shared/runtime.ts`, `runtime-result-check-authority.test.ts`. |
| EXT `node apps/extension/scripts/test-extension.mjs src/background/projects src/background/connection` | 398/398 |
| From `apps/extension`: `src/background/tests src/background/panel` | 218/218 |
| EXT `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json --noEmit` | exit 0, 0 errors |
| EXT `node scripts/structure-audit.mjs` | 3 FAIL, none caused by me (details below) |

The three EXT audit failures:
- `FluxIQConnection` has 42 methods. The earlier projects worker added `panelProjectId` and `projectChoice`; my diff adds no methods.
- `connection/tests/` holds 26 files, because of the earlier worker's `project-context-panel.test.ts`.
- `shared/` has three files sharing the `panel-` prefix, from the earlier worker's `panel-projects.ts`.

## Not verified
- No live browser or hosted server was run.
- The authority reads `identityAccess.snapshot()`. The program route can be given a different hosted `identityAuthority` (apps/web), so on a hosted tenant whose people are not in `identityAccess` a focus would be refused. I have not checked this.
- I did not rebuild any Core dist. Contracts `dist` was already rebuilt at 10:54 with the new types, and my later contracts edit changed only comments.

## Open questions or contradictions
1. The brief names CORE `docs/architecture/client-gateway.md`, but the file does not exist. I documented the change in `docs/integrations/client-gateway-websocket.md` instead.
2. Authority checks run when a focus is requested, not on each push. A person who loses read access after focusing keeps receiving that project's activity until the session ends. This is the same as the pairing-bound project today.
3. A focus also changes the default project for token calls and recordings that name none, through `pairedClientProjectTarget` and `bridge.startRecording`. On guarded hosts, a focus that lands between the route's two authentications makes that single call 401, because `sameCallerBinding` compares the project.
