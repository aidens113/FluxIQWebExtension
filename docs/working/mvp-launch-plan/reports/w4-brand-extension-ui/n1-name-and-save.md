# N1: store name and Save accessible name

## Outcome
Partial. Edits done; narrow tests and structure audit pass. The two heavy-slot checks (test-runner tsc, build-extension) were queued behind five other jobs for over 90 minutes and had printed nothing when I stopped; they are NOT verified.

## What changed and why
- Manifest names: apps/extension/manifest.chrome.json and manifest.firefox.json "name" is "FluxIQ"; manifest.e2e.json is "FluxIQ (E2E)". No other keys touched.
- Settings Save button (apps/extension/src/panel/settings/settings-view.ts): removed the aria-label "Save" override, so the accessible name is the visible "Save changes"; id #saveSettingsButton kept. Header and SAVE_LABEL comments updated. The enclosing region (section.settings-save) keeps aria-label "Save"; it is a region, not a button, so it does not match button-by-name queries.
- Test updated: apps/extension/src/panel/settings/tests/save-model.test.ts (aria-label now null; title reworded).
- Callers changed from name "Save" to "Save changes" (exact):
  - packages/test-runner/src/demo-workspace/browser-session.ts:254 (Lab)
  - apps/extension/e2e/install-and-content.spec.ts:52
  - apps/extension/e2e/runtime/tests/lab-settings-driver.spec.ts:27
  - apps/extension/e2e/runtime/tests/requests-settings.spec.ts:34
  - apps/extension/e2e/content/tests/screens/tests/recording-settings-photo-social.spec.ts:192
- Not changed on purpose: e2e/content/tests/screens/tests/tasks-local-classifieds.spec.ts:144 (Save on a task rename, not settings). Only five settings callers found, not six (the sixth is presumably that task-rename one).
- Name strings in docs: docs/architecture/testing-facility.md:3462, docs/user/store-listing.md, install.md, privacy-policy.md now say "FluxIQ" (user docs were outside the stated owned list but quote the store name). Working-doc history reports left as written.
- scripts/release: nothing asserts the name (verify-extension-target only checks 1-75 chars).

## Commands run and observed
- `cd apps/extension; node scripts/test-extension.mjs panel/settings/tests release/tests` -> tests 74, pass 74, fail 0.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (245 warning(s), 552 baselined)".
- `heavy-slot.mjs run t900 -- node scripts/build-cache/cli.mjs test-runner:build` and `... -- node scripts/build-extension.mjs`: started, stuck in queue, no output.

## Not verified
- test-runner tsc, three-target build and dist manifest names. Lead should run them (the edits are one string changes in a .ts file, manifests, so risk is low).
- Playwright specs not run.
- No narrow test-runner unit test covers browser-session.ts's Save press (none found).

## Open questions
- Brief said b5b found six e2e callers; I found five Save-settings callers by grep.
