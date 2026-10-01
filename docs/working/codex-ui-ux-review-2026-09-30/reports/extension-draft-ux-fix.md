# Extension pending-operation draft preservation

Outcome: Complete - bounded source/tests finished; supervisor owns broader final gates and integration.

## Changed

- `apps/extension/src/panel/chat/conversation/composer.ts`: input/fill revisions prevent successful send from clearing a subsequent draft, including edited-then-retyped identical text. Unchanged success clears textarea/storage; failure preserves it.
- `apps/extension/src/panel/settings/settings-view.ts`: edit/draft-hydration revisions prevent pending save from clearing/refilling later edits. Newer dirty state/storage and unsaved notice remain; success explicitly says the earlier settings were saved. Reconnect uses submitted saved settings.
- New `chat/conversation/tests/composer-draft.test.ts` and `settings/tests/settings-draft.test.ts`: 12 cases cover unchanged success, later address/toggle/text edits, identical retyping, fill, IME Enter, send/save failure, reconnect failure, status pushes, persistent drafts and no automatic extra saves/sends. All data is synthetic.
- Supervisor explicitly approved `apps/extension/src/panel/chat/tests/fake-dom.ts`: added the identical `replaceChildren` operation already reviewed in t219 (clear existing children, then append). Intentional identical t219 integration overlap; no broad fake rewrite.

## Actual validation

Working directory: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQWebExtension`. Heavy commands use explicit `C:/Program Files/Git/bin/bash.exe` and `C:/Users/osrs_/FluxStuff/build-slots/heavy.sh`.

- `git diff --check`: observed exit 0, including after final fixture correction.
- Label `codex t224 draft typecheck`: `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit`; worker observed exit 0 (session 26271; source fixes and new tests included, before the shared fake helper correction).
- Initial label `codex t224 draft regressions`: `env EXTENSION_TEST_BUILD_LABEL=codex-t224-drafts node apps/extension/scripts/test-extension.mjs`; worker observed exit 1, 1685 tests / 1683 pass / 2 fail. New settings failure scenarios exposed missing fake-DOM `replaceChildren`; corrected the fixture under supervisor approval without product changes, timeouts or skips.
- Corrected label `codex t224 draft regression rerun`: same complete runner/scratch label; worker observed final TAP **1685 tests / 1685 pass / 0 fail / 0 skipped / 0 cancelled**. Outer PowerShell session 69616 reported exit 1: redirecting stderr with `2>&1` converted heavy.sh's slot notice into `NativeCommandError` (confirmed in log header). This is a passing TAP result, not a claimed shell exit 0.
- Durable corrected-run log: ignored `node_modules/.cache/codex-t224-drafts-test.log`, complete TAP and wrapper diagnostic. Source/tests frozen before this runner acquired a slot.
- Supervisor independently reported executing corrected focused bundles with native exit 0 and **12/12 pass**. Worker did not observe that command directly. Worker duplicate focused sessions 53929 (stale) and 15196 (corrected) were interrupted before slot acquisition; neither is a passing test claim. All worker sessions are finished.

## Resume and boundaries

Source/tests/report frozen. To repeat focused checks: run through heavy.sh `node --test apps/extension/.test-build-scratch/codex-t224-drafts/panel/chat/conversation/tests/composer-draft.test.mjs apps/extension/.test-build-scratch/codex-t224-drafts/panel/settings/tests/settings-draft.test.mjs`. If bundles are absent, regenerate with the complete runner/scratch label above first. For a fresh full-run exit, redirect inside Bash rather than PowerShell's `2>&1`, or explicitly exit with the captured native `$LASTEXITCODE`. Preserve the existing log.

Not verified by worker: live browser/popup lifecycle, provider execution or whole-worktree build/audit. Supervisor owns independent verification/integration. No Core/shared authored document edits, commits, merges or pushes. Studio discovery is separately preserved in `core-studio-ux.md`.
