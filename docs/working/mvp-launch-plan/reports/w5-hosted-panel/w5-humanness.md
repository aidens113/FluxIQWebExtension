# w5-humanness report

## Outcome
Done for Flow settings. No task-settings surface exists in the panel, so item 2 is reported, not built.

## What changed and why
Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, under `apps/web/src/features/automation-studio/settings/`:
- `humanness/` (new): `humanness-model.ts` (bounds 0-100, default 0, key steps, parse/payload helpers), `HumannessSetting.tsx` (the control), `index.ts` barrel, `tests/humanness.test.tsx`.
  - Control: native range input 0-100 with the number shown, "Fastest" / "Most human-like" end labels, and arrow, PageUp/PageDown, Home and End handled explicitly. With no value it shows "Uses the starting value" and a "Set a value for this Flow" button (sets 0). With a value, a "Use the starting value" button clears it.
- `flow-settings-model.ts`: draft key `humanness: string` ("" = none). `flowSettingsDraftFromFlow` reads `metadata.humanness` (integer 0-100 only). `buildFlowSettingsSavePayload` states `metadata.humanness` on every save. `flowSettingsFlowFromDetail` takes `detail.metadata.humanness` when the detail has a metadata object, and drops a stale value when it has none.
- `FlowSettingsView.tsx`: new "Humanness" panel (`#flow-settings-humanness`) after Runtime Defaults, inside the Runtime nav section. Saving, dirty tracking and concurrent-revision handling are the existing path (the draft is compared as before).
- `persistence-check.ts`: label "Humanness", so a save that does not take is reported.
- `index.ts`: exports `./humanness`.
- `tests/settings-round-trip.test.tsx`: added `humanness: "35"` to the all-keys round-trip values.

## Payloads sent
The save goes through the existing `saveFlow` command to `update-flow-settings`. The `flow.metadata` it carries has `humanness: <integer 0-100>` or `humanness: null` (null clears the Flow's own value). Verified through `commands.saveFlow` calls: 70 sent after setting, null after clearing, 0 and 100 at the bounds.

## Shared-component finding
`packages/ui-components` has no humanness or slider component (grep for humanness, slider and `type="range"` found nothing). Built locally at `apps/web/src/features/automation-studio/settings/humanness/` (`HumannessSetting`, props `value: number | null`, `onChange(number | null)`, `subject?`, `disabled?`). W4 can move it, together with `humanness-model.ts`, into ui-components. `@fluxiq/contracts` exports no humanness constants in this tree, so bounds and default are local, commented as I1.

## Task settings (item 2)
No panel surface uses `list-project-tasks` or `update-task-settings`. The only mentions in `apps/web/src` are the program-route allow lists in `app/api/programs/[programId]/[endpoint]/tests/route.test.ts` and the capabilities catalog. Nothing was invented. When a task-settings view exists, reuse `HumannessSetting` with `subject="task"` and send `humanness: number | null`.

## Commands run and observed results
- `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings src/tests` -> 16 files, 99 tests passed (run after the new tests were fixed; humanness file 10 tests). A later re-run of only `settings/humanness` after a lint-driven reformat of the test: 10 passed.
- `pnpm structure:check` -> "structure-audit: passed (535 warning(s), 917 baselined)". The first run failed on statement-packing in my test; fixed.
- Tests cover: absent value shows "Uses the starting value"; setting sends the number; clearing sends null; bounds 0 and 100; keyboard step (arrows, PageUp/PageDown, Home/End, clamped); the draft round trip; the save from the mounted view.

## Not verified
- Free memory was 1883 MB at the first vitest run and 446 MB at the second (under the 2000 MB threshold; the run still passed). Only the narrow runs above were done.
- No whole-package typecheck (supervisor runs it). No browser check of the control's look: it uses existing panel classes (`automation-settings-panel`, `automation-settings-inline-fields`) and no new CSS, because the stylesheets are outside the owned paths. Layout of the range input and end labels is unreviewed visually.
- The real `update-flow-settings` handler and the `get-flow-metadata-detail` response (lane t898, W2) were not present, so the field names are built against the brief. Whether the save response echoes `metadata.humanness` (else the "did not take effect" notice fires) is unchecked.
- Three other files in the folder show as modified (`FlowSettingsView.tsx` apart from my edit, `ai-provider-model.ts`, `tests/AiProviderSettingsSection.test.tsx`); these were changed by someone else, not by me, and my edit to `FlowSettingsView.tsx` is only the import and the new panel.

## e2e spec to add (not done, out of scope)
Hosted panel Flow settings: open a Flow, Settings > Runtime. Expect "Uses the starting value". Click "Set a value for this Flow", press ArrowRight and End (number reads 100), Save, reload and see 100. Click "Use the starting value", Save, reload and see "Uses the starting value" again.

## Open questions
- The default for "Set a value" is 0; confirm that is the wanted starting point (alternatives: the person's starting value, which the panel does not know).
