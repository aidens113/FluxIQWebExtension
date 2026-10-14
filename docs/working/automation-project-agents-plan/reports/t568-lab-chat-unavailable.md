# t568: Lab chat unavailable (A8 round one)

## Outcome

Done. The cause was not one of the candidate merges. Core could not open a
project's `project.sqlite` once its path was too long for SQLite's default
Windows file layer. A8's workspaces put that path at 252-265 characters. So
every chat read of the run's project got Core's
`400 {"ok":false,"error":"SQLITE_CANTOPEN: unable to open database file"}`,
the panel set `scopeState: "error"`, and the Lab stopped at
`project-navigation/driver.ts:14`. The fix is in Core: the project database
now opens through Windows' extended path form (`path.toNamespacedPath`), the
same way the global store already did. A regression test fails without the fix
and passes with it. A Lab-started Core now answers 200 at a 272-character
project path.

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t568/!FluxIQ` (branch `task/t568-lab-chat-unavailable`):

- `packages/fluxiq/src/programs/automation-studio/storage/project/database.ts`:
  `openDatabase` passes `path.toNamespacedPath(filePath)` to `sqlite3.Database`.
  `AutomationStudioProjectDatabase.filePath` still holds the ordinary path, so
  the database's identity is unchanged. On non-Windows platforms the call does
  nothing. This is the cause fix.
- `packages/fluxiq/src/framework/storage-migration.ts`: the same one-call change
  in its `openDatabase`. It is the same defect class, and it runs on the same
  FluxIQ root during a layout migration. The comment is on the same line, so
  the file stays at 407 lines; it was already over the 400-line advisory.
- `packages/fluxiq/src/programs/automation-studio/storage/project/tests/database.test.ts`:
  new case "opens and writes a project database whose path is longer than
  Windows' 260-character limit". It asserts the path is over 260 characters,
  creates a table, inserts a row and reads it back, so the WAL is created too.

Nothing changed in the downstream repository except this report.

### How the cause was found

1. Trace: the panel controller (`panel/chat/conversation/controller.ts`
   `readOnce`) sends `panelConversationRead` `kind: "list"`. The background
   relay (`background/panel/conversation-relay.ts`) sends it as Core's
   `list-conversations`, with `subjectId` set to the project id. Core's handler
   (`api/handlers/conversations.ts`) calls `AutomationStudioConversations.listConversations`,
   which calls `withStore`, which calls `AutomationStudioProjectDatabasePool.acquire`.
   When a read fails, `readFailed` sets `scopeState = "error"`. The panel shows
   "Chat unavailable" without a notice until the failures have lasted.
2. Evidence: in every A8 workspace, `artifacts/automation-studio/projects/<id>/`
   had been created (`mkdir` handles long paths) but held no `project.sqlite`
   (slot 2 held only a bare `project.sqlite` and no WAL). Paths of
   `project.sqlite`: slot-1 a8 262, slot-1 a8b 263, slot-2 252, slot-3 263,
   slot-4 265. The last passing chat-started build (run-mv79nr9o, workspace
   `adapt-crossborder-continuation-1` under t418-slot-3) had a 249-character path.
3. Provider-free repro: a scratch script imported the test-runner's
   `startTopology`. It started a Lab Core the same way `environment.ts`/`coordinator.ts` do
   (production web build, host module, bootstrap identity, isolated target),
   with `FLUXIQ_PROVIDER_KEY_FILES=none` and `DEEPSEEK_API_KEY` unset. Its runs
   directory was in the session scratchpad, so the path was long. It created a
   creation project the way the run does and called `list-conversations` on
   `?domainId=web-automation` with the signed-in cookie. Before the fix:
   `400 SQLITE_CANTOPEN: unable to open database file`, for both the topology
   project and the creation project.
4. Threshold, measured with Core's `sqlite3` (SQLite 3.52.0) by opening a file
   and writing in WAL mode:

   | `project.sqlite` path length | Default open | Extended form (`\\?\`) |
   | --- | --- | --- |
   | 251 or less | ok | ok |
   | 252 to 258 | opens, then the first write fails with CANTOPEN | ok |
   | 262 or more | open fails with CANTOPEN | ok |

   The `?vfs=win32-longpath` URI also failed.

   So the limit is about the journal or WAL name passing 260 characters, not
   the database name. No bisect was needed: the cause is the root's path
   length, not a merge. The four candidate-adjacent merges are not implicated.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/storage/project/tests/database.test.ts`
  (in `!FluxIQ/packages/fluxiq`) before the fix: `1 failed | 16 passed`. The new
  case fails with `SQLITE_CANTOPEN: unable to open database file`.
- `npx vitest run src/programs/automation-studio/storage/project/tests/ src/framework/tests/storage-migration.test.ts src/programs/automation-studio/runtime/conversations/tests/ src/programs/automation-studio/api/handlers/tests/conversations.test.ts`
  after the fix: `Test Files 33 passed (33)`, `Tests 262 passed (262)`.
- `pnpm --filter fluxiq check`: exit 0 (`fluxiq:check` built, no tsc errors).
- `node scripts/structure-audit.mjs` (Core): `structure-audit: passed (350 warning(s), 1156 baselined)`.
  My changes add no warning.
- `pnpm structure:check` (downstream): `structure-audit: passed (194 warning(s), 639 baselined)`.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  and then `pnpm --filter fluxiq build`: built. The downstream
  `node scripts/check/core-build.mjs` then reported "FluxIQ Core's build ... is
  current with its source".
- Lab Core repro after the fix (scratch `t568-repro.mjs`, provider-free, about
  1 min 53 s): `list-conversations -> 200 {"ok":true,"payload":{"conversations":[]}}`
  for both projects. Then `open-conversation -> 200` returned a project thread,
  and `list-conversations -> 200` listed it. The creation project's directory
  held `project.sqlite`, `project.sqlite-shm` and `project.sqlite-wal` at a
  272-character path.

## Not verified

- The panel UI itself was not driven after the fix. The extension's panel
  path (controller to relay to `list-conversations`) did not change, and the
  only failure was Core's 400. The provider-free headed check
  (`packages/test-runner` `extension-chat-check`) puts its runs under
  `test-runs/.chat-check-work`, which gives a path well under the threshold, so
  it would not exercise this defect. It was not run.
- No `pnpm lab run` was made, live or dry. A full chat-started build needs a
  model key, and the brief forbids any provider call. The first live A8 run
  after this merges is the end-to-end proof.
- Candidate mode was not run separately. The failure depends only on the
  length of the workspace path and happens before any build or mode-specific
  code, so candidate mode in the same A8 workspaces fails the same way, and
  the same fix covers it.
- `framework/uncommitted-v2-adoption.ts` opens SQLite through a `file:` URI
  (read-only). The extended form does not apply to a URI, and that path was
  not tested at long lengths. `database-manager/storage/sqlite-repository.ts`
  already used `toNamespacedPath`. The Lab's own `sqlite-store-reader` reads
  staged copies under `os.tmpdir()`, so it is not affected.
- Core's full vitest run and the downstream full suites were not run (narrow
  checks only, per the twice-a-day rule).

## Open questions or contradictions found

- The brief assumed a regression in the merges of 2026-10-13/14. There was
  none: the A8 workspace names (`a8-project-<scenario>-<task>`, 36-46
  characters) inside `fxwork/t563/.../instances/a8-slot-N/persistent-isolated/`
  pushed the path over the threshold. Earlier workspaces were shorter.
- Diagnosability gap (follow-up, not done): the Lab's failure said only "The
  mounted chat project read returned an error". Neither the panel's scope
  attribute nor the Lab carries Core's refusal text, and Core's log has no line
  for a refused program call. Recording the relay's `error` string in the
  Lab's failure details would have shown `SQLITE_CANTOPEN` in the first run.
- Other Windows long-path risks under a deep FluxIQ root (for example Chrome's
  profile files inside the same workspace) were not surveyed.
