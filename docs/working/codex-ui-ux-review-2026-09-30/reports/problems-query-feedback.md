# Problems query feedback

Latest state: Supervisor released only the two fixture typing corrections after full Core suite63749 passed293files/1775tests. Those corrections are applied and frozen. Shared focused run90915 through heavy.sh `codex t224 fixture typing focused` exited0,6files/66tests,10.39s; all global/Problems behavioral and existing architecture/host/view/transport tests pass. Scoped diff check0. `body` now asserts mock-call presence before indexing; absent onListProblems is omitted instead of explicitly undefined. Expectations/typeconfig/product code unchanged. Full observed log `C:/Users/osrs_/AppData/Local/Temp/codex-t224-fixture-typing-focused.log`. Supervisor must rerun broad types/build; worker does not claim TypeScript success from Vitest. Source/test/report frozen again.

Status: Complete and frozen for supervisor review; bounded continuation brief and Current State read.

Owns only paired Core ProblemsView.tsx and problems/tests/problems-query-feedback.test.tsx, plus this report. No commits, broad suites, live/browser/panel/provider calls.

Confirmed source defect: remote loading/failure is not represented; !result.ok is silently discarded, rejected promises escape, and initial remote absence is rendered as clean validation. Filter changes retain rows without a stale label. Request generations change only when a request starts, leaving the debounce interval and unmount vulnerable to old completions.

Plan: behavioral deferred-request tests first; explicit query loading/error/denied/retry state; identify retained rows as previous-query results; invalidate completions on query/project/scope change and unmount, keep local validation behavior, suppress successful-validation claims before remote success. Source and report stay within ownership; focused tests through heavy.sh.

## Incremental evidence

- Reproduction through explicit Git Bash/heavy.sh `codex t224 problems query reproduction`: exit 1, new 8-test file 7 failed / 1 passed, plus one unhandled synthetic rejected request. Failures include false clean state, missing retry/denial/stale feedback and old filter/scope/project completion publication.
- Implemented explicit query state and query-key rendering, generation invalidation at effect cleanup/setup (before debounced replacement requests), caught failures, retained-row stale notice, generic errors without raw server text, and cross-project retained-row isolation.
- First post-fix run exposed a test helper serializing React element owners: 5 helper failures / 22 passed across 4 files. Replaced only the helper with direct string-child matching; no behavior assertions relaxed. Next observed exit 0, 4 files / 27 tests passed, 2.22s.
- Review found failed next-page retry must retain the requested cursor/page rather than reload the last successful page. Added exact request target retention and regression; also cover actual status403 permission denial, missing query callback and malformed successful response. Final fresh focused run pending; no active checks read source during edits.

## Final validation and handoff

Observed final explicit Git Bash/heavy.sh label `codex t224 problems final focused` exit 0: 4 files / 30 tests passed, 2.14s. Command in Core apps/web: `pnpm exec vitest run src/features/automation-studio/problems/tests/problems-query-feedback.test.tsx src/features/automation-studio/problems/tests/problems-view.test.tsx src/features/automation-studio/problems/tests/problem-host.test.ts src/features/automation-studio/problems/tests/problems-transport.test.ts`. New owning file contributes 11 behavioral tests; existing 19 host/view/transport regressions remain green. No skips or timeout increases; no unhandled errors. Expected React test renderer deprecation warnings only. Full raw final output: `C:/Users/osrs_/AppData/Local/Temp/codex-t224-problems-final-focused.log`.

Scoped `git diff --check` exit 0. The view remains below the 800-line file budget; no new exports or baseline changes. Query failure text is fixed and does not display raw server content. Local validation states and command/transport ownership remain intact. Only the assigned view, new owning test and this own report changed by this worker.

Both source files and report frozen. Supervisor must independently review/verify and run coordinated broader web checks after other workers freeze; no broad suite/typecheck/build or browser/accessibility certification performed by this worker. No commits/push, runtime edits, panel/live/provider calls, shared-document edits or other-worktree changes.

## Supervisor broad typecheck follow-up

Root broad web typecheck caught exactOptionalPropertyTypes in the new missing-provider fixture: it passes onListProblems explicitly undefined. Product source remains frozen while root fullsuite63749 runs. Pending narrowly scoped fix: omit the optional property instead of explicitly supplying undefined; preserve missing-provider/malformed-response behavioral assertions. No typeconfig/assertion changes. Await explicit source release before editing or focused recheck. The prior focused30/30 pass is Vitest behavior, not a claim of broad TypeScript success.
