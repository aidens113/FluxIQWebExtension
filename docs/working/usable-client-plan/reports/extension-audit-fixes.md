# Extension structure-audit fixes (t915)

## Outcome
Done. `node scripts/structure-audit.mjs` passes (no baseline change), tsc clean, tests pass.

## What changed and why (EXT = fxwork/t915/!FluxIQWebExtension)
1. class-methods: `FluxIQConnection` 42 -> 40. `panelProjectId()` and `projectChoice()` moved to a new collaborator `PanelProjectAccess` (`background/connection/project/panel-project-access.ts`, barrel `project/index.ts`, re-exported from `connection/index.ts`). The connection exposes it as `readonly panelProjects` (`panelProjects.projectId()`, `panelProjects.choice()`). Call sites updated: `background/panel/panel-control-deps.ts`, `background/tests/project-focus-wiring.test.ts`. Behaviour is unchanged.
2. directory-files: moved `connection/active-recording.ts` into `connection/active-recording/` (own `index.ts` barrel, own `tests/` folder holding its two tests and the harness, per the sibling-feature-dir pattern such as `session/`). Importers repointed to `active-recording/index`. Test files stay in a `tests/` folder.
3. naming: `shared/panel-{conversation,humanness,projects}.ts` -> `shared/panel/{conversation,humanness,projects}.ts` with `index.ts` (`export type *`); `shared/protocol.ts` re-exports from `./panel/index`, so there were no other importers. Updated three path mentions in `docs/architecture/extension-client.md`.
- Side effect fix: moving the harness would have broken its `as never` baseline key, so I fixed it properly instead. `ActiveRecordingDeps.scriptedNavigation` is now `Pick<ScriptedNavigationIntent, "cancelAll">` (only member used), and the cast is gone.

## Commands run
- `node scripts/structure-audit.mjs` (EXT) -> `structure-audit: passed (250 warning(s), 551 baselined)`.
- `npx tsc -p tsconfig.test.json --noEmit` (apps/extension) -> no output (0 errors).
- `node scripts/test-extension.mjs src/background src/shared src/panel` (from apps/extension) -> tests 508, pass 508, fail 0.
- Same from EXT root as the brief wrote it (`node apps/extension/scripts/test-extension.mjs ...`): 1679 tests; one failure is cwd-dependent (`credential-messages.test.ts` reads `src/background/index.ts` relative to cwd). A second run also failed `getting-started/start/tests/steps.test.ts` (`signin:waiting` vs `signin:todo`). Those files are modified by someone else's in-flight work, not by me.

## Not verified
- No build run (dist untouched). No live browser check. The root-run `steps.test.ts` failure was not investigated further; it is in `panel/getting-started`, outside my files.

## Open questions
- Brief's test command only passes cleanly from `apps/extension` (cwd-relative file read in one test).
