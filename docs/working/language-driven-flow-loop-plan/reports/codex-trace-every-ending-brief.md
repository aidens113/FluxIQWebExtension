# Codex task brief

## Worker Briefs

### Brief: codex-trace-every-ending
- Repository: isolated pair C:/Users/osrs_/FluxStuff/fxwork/t217/!FluxIQWebExtension and sibling !FluxIQ
- Task: execute Task 5 from this document; preserve complete build traces for every ending.
- Required reads: Current State, Shared Rules and Task 5; t214-chat-build-and-endings.md; Core AGENTS boundary/code structure.
- Owns: Core runtime/flow-bootstrap/unfinished-build/phases.ts and callers, focused unfinished-build/deepseek-bootstrap-exploration tests; downstream packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts and focused tests only if needed; related architecture docs.
- Must not touch: main checkouts/other worktrees; Core runtime/llm/**/context-packet*, runtime/conversations/**, storage/**, runtime/service tests. Never run Lab/browser/Playwright/provider calls; never commit/push/merge.
- Definition of done: all endings retain all rounds with consistent numbering and no duplicate trace; reader accepts it; focused regressions and Task 5 checks, no timeout raises/skips. Build private Core first; heavy commands via Git Bash heavy.sh.
- Report to: docs/working/language-driven-flow-loop-plan/reports/codex-trace-every-ending.md
- Return: exact changed files and observed commands/results, omissions. Record findings incrementally in own report. Setup may still be running in b2; read-only until setup exits before edits/checks.
