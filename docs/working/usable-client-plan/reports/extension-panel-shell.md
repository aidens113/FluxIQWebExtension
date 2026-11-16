# Extension panel shell (U5)

## Outcome
Partial. All six items are implemented and tested; the extension typechecks and `src/panel` + `src/background/panel` tests pass. `core-build.mjs`, `check` and `build` cannot pass: Core's `fluxiq:build` has no stamp because that package does not compile (see Open questions). No live browser.

## What changed and why
- Header (`shell/top-bar.ts`, `shell.css`): logo + `createProjectSwitcher` on the left, Chat/Automations tabs (ids kept), connection dot, labelled Settings button (id `settingsButton`), Open FluxIQ. Tabs wrap to their own row under 460px (popup is 380px). Open FluxIQ opens the open automation's flow page, else the web home.
- `panel/projects/` (new): `extensionProjectsPort` (panelListProjects / panelCreateProject), `createProjectSelector` (select -> panelSelectProject, `setCurrent` only when id/name changed, "All projects" -> panelOpenFluxIQ). `PanelPorts.projects` is the test seam.
- Settings: Project row = name + Change button (`#changeProjectButton`, shown only when connected) calling the same switcher's `open()`. `project-line.ts` copy changed ("Project: “name”").
- Deep links: Core's web app has only `/`, `/flows`, `/flows/<id>?project=`, `/runs/<id>`, `/data`, `/security/keys`, `/settings`. There is no project or conversation page. New `shared/fluxiq-web-routes.ts` holds the table; `background/panel/open-fluxiq.ts` uses it. The old `/programs/automation-studio` and `/programs/secret-keys` do not exist in Core, so flow links now go to `/flows/<id>?project=` and the keys link to `/security/keys` (tests updated, including one assertion in `background/panel/tests/panel-control.test.ts`).
- Automations strip: "Open data in FluxIQ" (`/data`) when the last run has rows, else "Open run in FluxIQ" (`/runs/<id>`); hidden while running. Opened from the panel with `window.open` because `shared/protocol.ts` (not mine) only allows `purpose: "model-key"`.
- `changes` port (`chat/transport/ports/changes.ts`) from `panelChanges`; wired into the transport. The chat's beat drops to its 10s ceiling. The ceiling read stays, so renames made elsewhere still arrive.
- One activity feed: `chat/feed/shared-activity-feed.ts` is a `ChatActivitySource` over the shell's feed (the shell's `onChange` and feed swaps notify it); passed as `activity`. Second `extensionSetupPort` removed (settings reuses the shell's).
- Status push: part renders skip when the status JSON is identical; library re-renders only when the project id changes; `draw()` still runs always (store loss changes re-push the same status).
- The extension never used `threads.onTitle`, so no title was dropped; the package chat bar shows it once.
- Tests added: projects port, changes port, strip data link, top bar, settings Project row, mount header, route table.

## Commands run and observed results
- `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` (apps/extension) -> no output.
- `node apps/extension/scripts/test-extension.mjs src/panel` -> 691 pass, 0 fail; with `src/background/panel` -> 789 pass, 0 fail.
- `node scripts/structure-audit.mjs` -> none of the remaining failures are in my files except none (`shared/` "panel-" prefix naming, `background/connection*` and `mount-panel-navigation` baseline fixed after my edit are the worker's or pre-existing).
- `node scripts/check/core-build.mjs` and `pnpm ... check` -> fail: "Stale: fluxiq:build: no stamp, ui-components:build: no stamp".
- `pnpm --filter ... fluxiq ... ui-components build` in Core (I ran it) -> `fluxiq` fails: `answer-ask.ts(66,73) Expected 1 arguments, but got 2` and `llm/index.ts(61,10) no exported member AutomationStudioSecretsLockedError`.

## Not verified
`pnpm ... extension build`; any live Chrome/Firefox behaviour (switching, create, new chat, Open FluxIQ landing pages, header wrapping at 360-380px); that Core's `ui-components` chat follows a project change from the status alone.

## Open questions or contradictions found
- Core's `packages/fluxiq` has uncommitted edits (deleted `locked-error.ts`, `locked-wait.ts`, `secrets-locked.ts`, etc.) that leave it not compiling, so Core cannot be stamped and the extension check/build gates cannot pass until that finishes. Not mine. My rebuild also cleaned `fluxiq/dist`; a later successful Core build restores it.
- "Current project's page" has no Core route; the button opens the web home (or the open flow).
- A `purpose: "data"`/`runId` page in `panelOpenFluxIQ` would let the background open data links; needs protocol and panel-control owners.
