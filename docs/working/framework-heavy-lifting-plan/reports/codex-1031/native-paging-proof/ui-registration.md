Outcome: Done
Changed: `apps/extension/src/content/activity-overlay/status-pill.ts`, `apps/extension/src/content/activity-overlay/tests/status-pill.test.ts`, `apps/extension/src/content/activity-overlay/tests/fake-dom.ts`
Validation: `$env:EXTENSION_TEST_BUILD_LABEL='t840-ui-registration-20261031-01'; node apps/extension/scripts/test-extension.mjs content/activity-overlay/tests/status-pill.test` -> exit 0; 14 tests passed, 0 failed.
Not verified: Browser behavior, full extension/package checks, and type checks were not run per brief.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/native-paging-proof/ui-registration.md`
Notes: Registered the exact closed-shadow host immediately after `attachShadow`, before the host is appended. The ownership test confirms a real status pill host is owned while a markup and shadow lookalike is not.