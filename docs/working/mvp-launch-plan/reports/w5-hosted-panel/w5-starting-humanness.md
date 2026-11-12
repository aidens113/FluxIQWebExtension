# w5-starting-humanness (lane t901, W5)

## Outcome
Done. All three tasks built; acceptance vitest (41 files, 267 tests) and `pnpm structure:check` pass.

## What changed and why
Core worktree: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ/apps/web/src/features/

Task 1 (starting humanness)
- No client-side User type exists in the panel: `app/layout.tsx` and `app/(panel)/layout.tsx` only use the server `currentFluxIQUser()` and pass `totpEnabled`, never the user. So I did NOT touch the layouts or add a user prop; the value is read through the fixed endpoint `identity-access get-my-preferences` instead. Tell the lead if a user-prop route is still wanted.
- New `settings-page/humanness/`: `my-preferences.ts` (readMyPreferences, saveStartingHumanness, startingHumannessFrom; a failed or thrown call reads as "not ok"), `use-starting-humanness.ts` (reads once, loading/unavailable/ready, no retry loop), `StartingHumannessSection.tsx` (shared `createHumannessControl`, label "Starting humanness", commit calls `update-my-preferences`, the control's clear sends null), barrel `index.ts`. Wired into `settings-page/ui/SettingsPage.tsx` (before Appearance; the page now creates its port once and shares it).
- Flow settings: `automation-studio/settings/settings-host.ts` gains optional `loadMyPreferences()` (get-my-preferences); `FlowSettingsView.tsx` reads it once and passes `starting={N}` to `HumannessSetting`, so it says "Uses your starting value (N)"; unavailable or none reads 0. (I touched settings-host.ts and FlowSettingsView.tsx, outside the literal "owned" list but inside the Flow-settings wiring the brief asked for.) The command is optional so three other test files' command mocks needed no edit. `HumannessSetting.tsx` comment updated.
- First attempt put a hook importing `useProgramApi` in `settings/humanness/` and grew an existing import cycle (55 to 58 modules) and imported `settings-page/data`, also a cycle; both were removed in favour of the settings-host command.
- Precedence is not implemented in this lane (Core side, t898); the panel only shows the stored value as the "starting" step.

Task 2: `panel-shell/dock/AssistantDock.tsx` now calls `useProjectChoices()` (from the `../top-bar` barrel) and passes `projectName` from new `dock/open-project-name.ts` (null with none open or not yet loaded) to `ProgramChatWidget`. This makes a second `projects` request beside the top bar's switcher; a shared project-names value in the panel context would avoid it, not done.

Task 3: `chat-widget/attachments/flow-graph-diff/draw.ts` no longer prints `attachment.ref`; unreadable proposals say "The proposed Flow change could not be read here, so nothing is shown." (param renamed `_attachment`).

Tests added/updated: `automation-studio/settings/humanness/tests/humanness.test.tsx` (starting value 35 shown as N, 0 when none, 0 when preferences unavailable), `settings-page/humanness/tests/StartingHumannessSection.test.tsx` (reads stored value, sets 60, clears to null, absent endpoint shows "not available right now" with exactly one call, and the pure read/save helpers), `panel-shell/dock/tests/AssistantDock.test.tsx` (project name passed, null with none, lookup), `flow-graph-diff/tests/draw.test.ts` (updated wording; a JSON reference with a project id never appears).

## Commands run and observed results
- Free memory gates: waited until a separate check read >= 2500 MB (2680, then 5084 before the final run).
- Library build under `.lib-build.lock` via heavy-slot: contracts reused, fluxiq built (289 s), ui-components built; lock removed.
- First acceptance run: 40 files passed, 1 failed (my dock test lacked a `window`); fixed by stubbing `window` in the test.
- `pnpm structure:check`: first runs failed (import cycles, barrel reach-in, packed statements, swallowed failure at FlowSettingsView); all fixed. Final: `structure-audit: passed (537 warning(s), 916 baselined).`
- Final: `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/features/settings-page/humanness src/features/settings-page/ui src/features/panel-shell src/features/chat-widget src/tests` -> Test Files 41 passed (41), Tests 267 passed (267).

## Not verified
- Against Core's real `get-my-preferences` / `update-my-preferences` (t898 not in this tree; tested with mocks only). If the real call returns a different payload shape, `startingHumannessFrom` reads anything non-integer or out of range as none.
- Real browser rendering of the new section; no typecheck run (brief forbids whole-package).
- The control's clear button reads "Use starting value" and the inherited line "Uses your starting value (0)" in the Settings section, wording owned by W4's shared control; it is slightly off for the person's own setting (clearing means no starting value, i.e. 0).

## Open questions or contradictions
- Layout/user-prop route not used (see above).
- Dock and top bar each fetch `projects`.
