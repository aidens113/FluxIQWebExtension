# H1 extension humanness plumbing

Outcome: Partial (code and tests written; no acceptance check run, memory too low).

Changed (all under apps/extension/src unless noted): shared/protocol.ts (optional humanness), background/saved-state.ts, background/panel/settings-save.ts, background/storage.ts, domain/src/actions/types.ts (optional humanness on WebAutomationActionCommand); tests appended to background/tests/saved-state.test.ts, background/tests/storage-settings.test.ts, background/panel/tests/settings-save.test.ts.

Commands: free memory read 1151 MB then 1332 MB. All four acceptance checks not run: under 2.5 GB free.
Not verified: tests, typechecks (including that the @fluxiq/contracts root import resolves from the extension), structure audit.
