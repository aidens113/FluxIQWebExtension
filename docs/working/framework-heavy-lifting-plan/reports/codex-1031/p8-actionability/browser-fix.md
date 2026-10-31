# t827 browser structural repair

Outcome: Done. Approved source repair complete and FROZEN for lead validation.

Changed:

- `apps/extension/src/content/actions/click.ts`: imports the existing portable helper through explicit `../action-runtime/actionability/index`.
- `apps/extension/src/content/actions/check.ts`: uses the same explicit barrel import.
- Moved `apps/extension/src/content/actions/tests/check.test.ts` to `apps/extension/src/content/actions/tests/check/tests/actionability.test.ts`; adjusted its four relative imports and expanded the two packed callback bodies. Assertions, fixtures and callback behavior are unchanged. The old test path is absent. The grouping directory contains only `tests/`, so no source/helper barrel or stale test facade was added.
- `apps/extension/src/content/action-runtime/tests/results.test.ts`: expanded the two throwing getters and proxy descriptor callback into separate statements without changing behavior.

The move's resolved old and new absolute paths were checked inside `C:/Users/osrs_/FluxStuff/fxwork/t827/!FluxIQWebExtension` before moving the file. All four moved-test imports were then resolved against existing source files. The first import-path probe incorrectly assumed `content/types/index.ts`; it stopped after the first successful resolution. The corrected probe used the actual `content/types.ts` and resolved all four targets. No source correction was needed for that probe assumption.

Validation: `git diff --check -- apps/extension/src/content/actions/click.ts apps/extension/src/content/actions/check.ts apps/extension/src/content/actions/tests/check.test.ts apps/extension/src/content/actions/tests/check/tests/actionability.test.ts apps/extension/src/content/action-runtime/tests/results.test.ts` -> exit 0, no whitespace errors (Git CRLF normalization warnings only).

Validation: PowerShell `Resolve-Path`, `GetFullPath` and `Test-Path` source-import probe -> exit 0, `Scoped whitespace check passed; all four moved-test imports resolve.` This is a source-path check, not a TypeScript or executable acceptance check.

Updated proposed narrow test command, from `apps/extension`, NOT RUN:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='t827-browser-actionability'; node scripts/test-extension.mjs content/action-runtime/actionability/tests content/action-runtime/tests/results.test content/action-runtime/recovery/tests/fault.test content/actions/tests/click content/actions/tests/check/tests/actionability.test
```

Not verified: generated tests/types/build, structure audit, SDK linkage, browser behavior, compatibility and storage reload. The lead owns those checks after SDK release. No generated checks, provider calls, browser, panel or APIs were launched.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/browser-fix.md`

Notes: Source FROZEN on the four logical approved files (five physical old/new paths listed above) plus this report. Helper barrel unchanged. No Domain/Core, measurement, policy, effect, retry, person, permission, baseline, rule, version, other report or git mutation.
