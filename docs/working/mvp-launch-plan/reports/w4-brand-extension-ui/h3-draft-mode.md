# W4-H3: draft mode for the humanness control

## Outcome
Done. Nothing committed.

## API (verbatim, Core `humanness-control.ts`)
`mode?: "commit" | "draft"` (default commit); `commit?: HumannessCommit` (required in commit mode, ignored in draft);
`onDraft?: (level: number | null) => void` (null = use the starting value); `canClear?: boolean` (default true; false hides "Use starting value");
`inputId?: string` (range input id); `explain?: string` (replaces the explanation line).
Draft mode never calls `commit` and never shows Saving/Saved./refused. It reports on drag release, arrow keys at rest (settleMs), blur, and clear.
The form calls `show(level)` after its own save/reset. README section "Draft mode" added.

## Where used
- Extension Settings "Starting humanness..." slider: `apps/extension/src/panel/settings/humanness/slider.ts` (draft, canClear false, level {own:v, starting:v}, inputId "humanness", same label); the wrapper keeps read/fill/onEdit so settings-view.ts is unchanged; onDraft feeds the dirty state. 0-100 step 5 come from the shared control, which matches limits.ts. Removed dead `.humanness-slider` css from settings.css.
- Task card and Flow strip: commit mode, unchanged. No other mounts found (grep of both worktrees; apps/web has none).
- The old `humannessValue` output id is gone (the shared value span is aria-hidden); no test used it.

## Tests changed
Core: two new tests in humanness-control.test.ts (draft never commits/"Saved.", reports drag release, arrow settle, clear null; canClear/inputId/explain). Extension: humanness-settings.test.ts and save-model.test.ts now dispatch `change` after `input` (the dirty state follows the release, as a real drag does).

## Commands
- Core `pnpm exec vitest run src/chat/controls src/chat/answer`: 13 files, 113 tests passed.
- Slot `pnpm build` (ui-components): built, tsc ok (output shown; piped through tail so exit code not captured directly).
- Extension `node scripts/test-extension.mjs panel/settings/tests panel/automations panel/chat/transport`: pass 255, fail 0.
- Both repos `node scripts/structure-audit.mjs`: passed.
- Extension `tsc --noEmit -p tsconfig.json` via slot: no errors.

## Not verified
Live browser dragging of the Settings slider.
