# E5: Chat tab on every run, neutral idle record button (t376)

## Outcome

Done. Both fixes are in panel/shell and panel/recording only. No hook was needed in panel/chat, because the shell already runs its own activity feed (`replaceWorkingFeed` in `mount-panel.ts`).

## What changed and why

1. **Record button.** The idle "Start recording" was red because of two rules: `.top-actions .record-button { color: var(--danger) }` in `panel/shell/shell.css`, which wins on specificity, and `.record-button { color: var(--danger) }` in `panel/recording/recording.css`.
   - Both are removed. The button now inherits the neutral `--muted` colour of the other top-bar icon buttons.
   - It turns `--danger` only on `:hover` or `:focus-visible`, and never while it is disabled.
   - While a recording runs or is paused, `recordControl` already hides the button, and the recording bar (red dot, danger-soft background) shows that recording is under way. There is no visible "recording" state for the button, so it needs no red one.
   - The id `recordButton` and the name "Start recording" are unchanged. The SVG draws in `currentColor`, so it follows the theme tokens in light and dark.
2. **Chat tab when a run starts.**
   - New file `panel/shell/run-follow.ts` holds the decision as pure logic. It is exported from the `panel/shell/index.ts` barrel.
   - `mount-panel.ts` calls `followRun()` from the shell feed's `onChange`. That callback reads `feed.state.current` (a `ClientGatewayActivity`) and dispatches `{type:"tab",tab:"chat"}`, which also closes Settings.
   - Rules:
     - Only events with `subject.kind === "run"` count.
     - The run must belong to the panel's chosen project: `chat.target().projectId ?? status.projectId`, the same scope the chat's Stop control uses. When the panel has no project, any run counts.
     - The decision is made once per `activityId`, on the first event seen. Later events of the same run leave the tab alone, so a person who goes back to Automations is not pulled back. The last 64 ids are remembered.
     - A run's final event never switches the panel.
     - A run that starts while a recording runs or is paused never switches the panel, even after the recording ends.
     - If the person is typing in a field the switch would hide (a text input, textarea, select or contenteditable inside `main` but outside the chat screen), the switch waits and happens on a later event of the same run once focus has left the field.
     - If focus sat on a non-typing control that the switch hides (for example an automation row), focus moves to the Chat tab so keyboard users keep a place.
   - **Builds: the panel does not switch.** A build started from the chat is already on Chat, and Lab builds are typed into the chat. A build started elsewhere is long work the person may be arranging the panel around.

## Commands run and observed results

- My subset: every `*.test.ts` in `panel/shell/tests` and `panel/recording/tests`, bundled with the esbuild options from `scripts/test-extension.mjs`. The temporary runner and its output directory were deleted afterwards.
  - Result: `# tests 73 # pass 73 # fail 0`.
  - The new tests that passed:
    - `run-follow.test.ts`: 5 tests.
    - `mount-panel-navigation.test.ts`: 5 mounted tests. They cover the switch from Automations happening once per run, Settings closing to show Chat, a build not switching, recording and paused recording not switching, another project's run not switching, typing in a Settings field (`#gatewayUrl`) holding the switch, and the focus handoff to the Chat tab.
    - `record-button-style.test.ts`: 2 tests. Every `.record-button` rule that uses `--danger` must also have `:hover` or `:focus-visible` and `:not(:disabled)`, and the id and name are kept.
- Sanity check: I commented out the `followRun()` call and ran the subset again. Four mounted tests failed (31, 32, 34, 35), so the tests do catch a missing wiring. I then restored the file.
- `npx tsc -p apps/extension/tsconfig.json --noEmit` gave 0 errors in total.
- `node scripts/structure-audit.mjs` gave 2 violations, neither in my paths:
  - `[as-never]` in `apps/extension/src/background/panel/tests/run-control.test.ts`, lines 92, 101, 109 and 110. That file belongs to another worker.
  - `[working-docs] docs/working/README.md`, which was already failing.
  - There were no warnings for `panel/shell` or `panel/recording`.

## Each way a run starts

The shell switches on the activity event, not on which button was pressed, so every path below goes through the same code.

- **Automations strip Run:** covered. The strip sits on the chat screen, so the panel is usually already on Chat. If the person is on the Automations or Settings tab, the first run event switches the panel. This is tested through the mounted shell with a pushed `fluxiq.activity.changed`.
- **Chat "run it":** the panel is already on Chat, so dispatching the Chat tab changes nothing.
- **Run started over the API (Lab playback):** this gives the same relay event, so the logic is the same. It is not tested live.
- **While Automations or Settings shows:** tested by the mounted tests.

## Not verified

- No live browser check: the extension was not loaded, and the Lab and panel were not run. The CSS colours were not checked by eye in light or dark; only the stylesheet rules were read.
- The relay's first push when the panel opens mid-run: the panel already opens on Chat, so following that run there changes nothing.

## Open questions or contradictions found

- **The run's steps show only within the chat's own scope** (`panel/chat/stream/target-activity.ts`). If the chat is open on a different automation's thread (`target.kind === "automation"` with another `flowId`), or the run speaks through another conversation, the person lands on Chat but does not see that run's steps.
  - The shell could re-target the chat, but an `automation` target needs the Flow's name, and activity events do not carry it. Re-targeting would also move the person off a thread they chose. I did not do it.
  - If wanted, the hook would be either in panel/chat (follow the newest run's Flow, or fall back to `latest`) or a `ChatTarget` that can be opened by `flowId` alone.
- The extraction-entry lines in the `mount-panel.ts` diff (`openExtraction`, `onExtract`, `EXTRACTION_ENTRY_ID`) and the Extract test in `mount-panel-navigation.test.ts` were already uncommitted in the tree before I started. They are not mine.
