Role: Heavy worker. Model: gpt-6.1-sol. Effort: max. No spawning, git mutation, paid calls or panel management.
Goal: Resume t813 C1; adversarially review concurrency/key lifecycle and resolve defects within C1.
Owned: fxwork/t813/!FluxIQ C1-changed workspace manager/IAM/layout/background-task lifecycle files and their tests/docs.
Must not touch: other worktrees, shared Current State/Work Ledger/index, t814 product code, runtime/user data.
Read: Core AGENTS.md binding rules and code-structure before new files; hosted-production-plan Current State;
Core docs/working/hosted-production-plan/reports/t813-c1.md and reports/t813/manager.md; relevant changed source.
Review manager concurrency, eviction, in-flight construction, key/audit-store closing, domain probe lifecycle,
selection ordering and instance-busy against activity(). Fix confirmed defects with regression tests.
Run narrow owning tests and Core/web typechecks, structure and docs checks; no full suites or Next build.
Own checkouts isolate tests; no global heavy lock exists currently. No tenant migration (C2/C3).
Write report: main downstream docs/working/framework-heavy-lifting-plan/reports/codex-1030/t813-result.md.
End: Outcome; Changed; Validation (exact command + observed result); Not verified; Report; Notes (3 lines max).
