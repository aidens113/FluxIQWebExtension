# Codex task brief

## Worker Briefs

### Brief: codex-extension-cleanup-names
- Repository: C:/Users/osrs_/FluxStuff/fxwork/codex-cleanup-2026-09-30/t219-codex-extension-cleanup
- Task: Task 3 part 1 only; replace obsolete Simple/Advanced mode identifiers with capability names, preserve wire message strings and behavior.
- Required reads: this document Current State, Shared Rules and Task 3; background/simple-panel and all identifier uses found by rg.
- Owns: background/simple-panel rename to automation-relay, protocol/constants/backgound index identifiers, every caller and relevant smoke-test scripts that imports/references renamed symbols; tests renamed with subjects.
- Must not touch: background/panel/{open-fluxiq.ts,panel-control.ts,tests/panel-control.test.ts}, panel/open-fluxiq/**, panel/automations/automation-strip.ts and new deep-link tests, docs/architecture/** (supervisor deep link owns); Core/main/other worktrees; no Lab/browser/provider/Playwright.
- Definition of done: SIMPLE_PANEL_MESSAGES, SimplePanel*, handleSimplePanelControl, simple-panel paths absent from authored active code, all imports/test-build selection repaired, wire strings unchanged; focused check/tests and report. No commits/push/merge.
- Report to: docs/working/language-driven-flow-loop-plan/reports/codex-extension-cleanup-names.md
- Supervisor owns Task 3 part 2 deep link and final validation/report. Existing Core route is /programs/automation-studio?project=...&flow=... (navigation.ts parseAutomationStudioDeepLink).
