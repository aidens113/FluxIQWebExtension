# Browser matcher integration

Role: Heavy worker, gpt-6.1-sol, max effort.
Goal: Trace and fix realistic-site content identity browser failures after matcher extraction.
Repository: C:/Users/osrs_/FluxStuff/fxwork/t842/!FluxIQWebExtension.
Read: Current State in ../../runtime-ownership-refactor.md; .fluxiq/refactor-browser.log; relevant identity tests/harness and scorer consumers.
Owned: apps/extension/src/content/identity/**; domain/src/element-fingerprint/**; apps/extension/e2e/content/** only where actual migration requires it.
Must not touch: Core source, shared working documents, package/config/barrels outside owned paths, unrelated files. Never commit/push/spawn.
Existing lead run: Chromium 34 tests, two workers; wait until finished before browser rerun. It logs .fluxiq/refactor-browser.log.
Determine real cause, compare original dev behavior when needed. Preserve scoring weights, target safety, exact test oracles.
Do not weaken assertions or add test-shaped product guidance. Only approved realistic fixtures; no paid calls or panel server.
Acceptance: selected identity-resolution, identity-ambiguity, identity-veto browser specs; focused changed unit tests. No full suites.
Report: docs/working/runtime-ownership-refactor/reports/browser-integration.md.
Return: Outcome; Changed; Validation (exact command/result); Not verified; Report; Notes <=3 lines.
