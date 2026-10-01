# Report: codex-extension-cleanup (t219)

## Outcome

Done and supervisor verified. Isolated `task/t219-codex-extension-cleanup`, downstream only. Local delivery to Claude; no dev/main merge or push.

## What changed and why

Automation and recording relays now use capability names instead of the deleted Simple/Advanced modes. Every imported/exported name and path changed together; all 38 fluxiq.* wire literals are unchanged. The bounded rename report is `codex-extension-cleanup-names.md`.

Core already supports `/programs/automation-studio?project=...&flow=...` through its navigation parser and browser entry. The extension's automation strip now reads the selected Flow at click time, including a failed-run fallback. Background authorization runs first, derives the project solely from paired context, and URL-encodes both IDs. Forged project/token fields are ignored, malformed Flow IDs and non-HTTP(S) destinations are refused, and no authenticated program call is made. Generic buttons retain their generic destination. No Core route/source change is needed.

Regression coverage exercises selection changes, failure fallback, generic buttons, encoded IDs, forged fields, unpaired context, malformed requests and forbidden content-page senders. The test DOM implements replaceChildren so the actual strip is exercised.

## Every changed path

- `apps/extension/src/background/index.ts`
- `apps/extension/src/background/automation-relay/index.ts` (from simple-panel/index.ts)
- `apps/extension/src/background/automation-relay/automation-relay.ts` (from simple-panel/simple-panel-control.ts)
- `apps/extension/src/background/automation-relay/tests/automation-relay.test.ts` (renamed matching test)
- `apps/extension/src/background/panel/open-fluxiq.ts`
- `apps/extension/src/background/panel/panel-control.ts`
- `apps/extension/src/background/panel/tests/panel-control.test.ts`
- `apps/extension/src/shared/constants.ts`
- `apps/extension/src/shared/protocol.ts`
- `apps/extension/src/panel/recording/review/recording-review.ts`
- `apps/extension/src/panel/automations/controller.ts`
- `apps/extension/src/panel/automations/tests/controller.test.ts`
- `apps/extension/src/panel/automations/automation-strip.ts`
- `apps/extension/src/panel/automations/tests/automation-strip-open.test.ts`
- `apps/extension/src/panel/open-fluxiq/open-fluxiq-button.ts`
- `apps/extension/src/panel/chat/tests/fake-dom.ts`
- `packages/test-runner/src/run-scenario/ui-review/capture-extension-panel.ts` (comment points to current approval-code owner)
- `docs/architecture/extension-client.md`
- reports `codex-extension-cleanup-brief.md`, `codex-extension-cleanup-names.md`, and this report

## Commands run and observed results

All heavy commands use `C:/Program Files/Git/bin/bash.exe C:/Users/osrs_/FluxStuff/build-slots/heavy.sh` with a Codex label, from the private t219 downstream tree.

- Read-only Core navigation inspection confirmed existing route; no Core edit.
- Rename searches found no obsolete relay symbols/paths in source/scripts. Quoted fluxiq.* wire literals compared against HEAD: 38 unchanged. Historical comments about removed modes remain explicitly historical.
- Isolated setup -> exit 0, including private Core build. This was not used as implementation verification.
- Initial PowerShell validation script was rejected under default execution policy. Subsequent launches used `powershell.exe -NoProfile -ExecutionPolicy Bypass -File`.
- First extension check found the test fixture returning payload instead of PanelStore's value; corrected it.
- First full suite: 1678 passed, 1 failed, 0 skipped. Independently reproduced new strip regression with `node --test apps/extension/.test-build-scratch/codex-t219/panel/automations/tests/automation-strip-open.test.mjs apps/extension/.test-build-scratch/codex-t219/background/panel/tests/panel-control.test.mjs`: 13/14 passed; failing error was `exports.replaceChildren is not a function`. Added the missing DOM operation to the test helper. A logged full rerun started before that helper edit reproduced the same sole failure; no production defect or timeout change.
- Final chain, heavy label `codex t219 corrected DOM fixture final validation`, environment `EXTENSION_TEST_BUILD_LABEL=codex-t219-fixed`: `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0; `pnpm --filter @fluxiq-web-extension/extension test` -> exit 0, freshness/smoke passed, 1679 passed, 0 failed/cancelled/skipped/todo, 118090.5089ms. Output retained outside repository in OS TEMP.
- Final `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0, Chrome/Firefox/e2e-Chromium each verified 22 files; existing Firefox placeholder-addon-id warning remains. `node scripts/structure-audit.mjs` -> passed (135 warnings, 119 baselined). Entire final chain observed exit 0.
- Supervisor reviewed handler, URL construction, caller selection and rename diffs. `git diff --check` passes.

## Not verified

No real browser, Playwright, Lab, provider or panel run, as required. Tests use DOM/browser API fakes; no live navigation claimed. Claude's files/worktrees were not edited.

## Integration notes

Task1 also edits `extension-client.md` against the old dev baseline; retain this task's current relay names and deep-link paragraph. Task4 changes independent extension runtime files and adds wait documentation in the same architecture file. Nothing was merged or pushed; Claude owns integration and revalidation.
