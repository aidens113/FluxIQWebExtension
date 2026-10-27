# Brief: t754 package exports cleanup

- Repository: paired task/t754-package-exports-cleanup, only C:/Users/osrs_/FluxStuff/fxwork/t754/{!FluxIQ,!FluxIQWebExtension}.
- Task: execute the package-exports-cleanup brief in the hub; remove all existing non-exported build-path loads without copying code.
- Required reads: hub Current State and package-exports-cleanup brief; both repositories' AGENTS.md worker/boundary/validation rules; matching baseline entries; owning package manifests and affected scripts/tests.
- Owns (may edit): Core root scripts named by package-exports/module-reach baseline, their adjacent tests, packages/fluxiq/package.json exports; downstream root scripts named by baseline and adjacent tests, packages/test-runner/package.json exports, the named domain test. Confirm exact list in report before edits.
- Must not touch: main checkouts, t751/t752, source runtime modules, shared plans/Current State/ledger/index, generated reference, task lifecycle scripts outside the required export imports. No commits/merges/pushes.
- Definition of done: explicit public exports for each required seam and imports by package name/subpath, no direct dist paths; owning builds then each switched script's smallest actual command (--help or provider-free dry path); adjacent node tests; both audits, Core docs:check, downstream core-mirror. No browser, paid run, panel, full suite or sweep.
- Before builds freeze every package input. Keep logs external C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t754-review, never package input directories. If validation finds runtime fallout, report exact error before extending ownership.
- Baseline regeneration belongs to supervisor; report exact removed entries, do not edit .structure-baseline.json yourself. Existing warnings may remain until supervisor regenerates.
- Report to: docs/working/trace-offline-trials-plan/reports/package-exports-cleanup.md in task downstream tree; record exact changed files, before/after findings, commands, native exits, genuine validation limits. Append UNIT READY when frozen.
- Return contract (at most12 lines): Outcome, Changed, Validation, Not verified, Report, Notes.
Supervisor ownership expansion before edits: root package.json and pnpm-lock.yaml in each paired repository are authorized for explicit workspace/link dependencies and owning install, because root scripts otherwise cannot resolve package imports. Preserve prebuild realistic-scenario guard behavior. Lifecycle initial build is still running; freeze package inputs until supervisor notice.
