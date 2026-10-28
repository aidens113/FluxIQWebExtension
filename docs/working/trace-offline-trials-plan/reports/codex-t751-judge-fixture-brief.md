# Brief: t751 final integrated judge fixture migration

- Repository: ONLY C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ.
- Task: trace and repair exactly2 stale judge fixtures exposed by final t751+t752 integrated SQL selection; no production changes.
- Required reads: downstream codex-t751-integration.md Current State and failure log integrated-core-owners.log external codex-t751-review; Core two files below and related narrow verifier helper only if necessary. Accepted t752 schema requires structured current-negative defects; immutable request and actual measurements govern.
- Owns: packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/tests/project-build-facade.test.ts and project-build-time-limit.test.ts; own report downstream reports/codex-t751-judge-fixture-migration.md.
- Must not touch: any other source/test, shared docs/index/baselines, worker751 report or words/admission changes. No commits/merges/pushes.
- Failure: facade:282 expected draft verdict no got not_judged; time-limit:218 expected candidate.trial_judged_no got candidate.trial_not_judged. Preserve scenario intent and meaningful acceptance assertions; prove the actual diagnosis/schema cause before editing.
- For supported negatives use actual measurable rows/conditions and located structured defects; no fabricated global defaults, fake judge pass or weakened oracle. Unsupported empty/action-only claims must stay unconfirmed, and explain any revised expected outcome honestly.
- Worker751 concurrently moves unchanged refusal guidance into owning WORDS function. Start inspection/fixture edits now, but WAIT for root/751 sourcefreeze notice before running your exact2file grouped parallel+realSQL gate. Keep logs external codex-t751-review; no full suite/build/browser/paid/panel work.
- Definition of done: exact root cause documented, bounded fixture corrections, two-file grouped gate passes native0, no temporary diagnostics, changed files frozen. Source fixes require explicit supervisor partition.
- Return: Outcome, Changed, Validation, Not verified, Report, Notes, at most12lines.