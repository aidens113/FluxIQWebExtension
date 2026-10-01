# Codex task brief

## Worker Briefs

### Brief: codex-cleared-wait-gaps
- Repository: isolated pair C:/Users/osrs_/FluxStuff/fxwork/t216/!FluxIQWebExtension and sibling !FluxIQ
- Task: execute Task 4 from codex-tasks-2026-09-30.md, all three gaps.
- Required reads: task document Current State, Shared Rules and Task 4; t191-chat-ui.md round 6; Core AGENTS boundary and code structure.
- Owns: downstream apps/extension/src/runtime/**, domain/src/** touched by clearedWait; Core packages/fluxiq/src/programs/automation-studio/runtime/{executor,service/runtime-session,parking}/**, transport-client path, service.ts deleteProject/expiry only; focused tests and related architecture docs.
- Must not touch: main checkouts, all other worktrees, Core runtime/llm/**/context-packet*, runtime/conversations/**, storage/**, runtime/service tests. Never run Lab, browsers, Playwright or provider calls. Never commit, push or merge.
- Definition of done: cleared waits survive failed/refused actions and transport results; expired/deleted parked waits settle; focused regression tests, specified Task 4 validation, no timeout raises/skips. Use Git Bash heavy.sh for heavy commands; build private Core first. If setup build still running, inspect first and wait before source edits.
- Report to: docs/working/language-driven-flow-loop-plan/reports/codex-cleared-wait-gaps.md
- Return: exact files changed, observed validation, limitations. Record findings incrementally in your report only.
