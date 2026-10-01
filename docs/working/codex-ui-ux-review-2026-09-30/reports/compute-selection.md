# Report: Compute visible selection

## Outcome
Focused correction verified by supervisor; coordinated broad web gates pending.

## What changed and why
Core compute-control.tsx used all nodes to resolve its selected detail even when
the selected node was absent from search/health/capability results. It now uses
the existing visible-selection reconciler and persists that effective selection.
All-empty results clear detail/activity; removed nodes choose a visible fallback.
Owns this source and live-views/tests/compute-selection.test.tsx only.

## Commands run and observed results
- heavy.sh 'codex t224 compute selection reproduce' pnpm exec vitest run
  compute-selection (Core apps/web): session4141 exit1,4tests failed. Search,
  health and capability retained hidden Beta; all-empty retained detail/activity.
- Corrected heavy.sh 'codex t224 compute selection corrected' pnpm exec vitest
  run compute-selection compute-control: session38824 exit0,2files/6tests pass,
  9.58s. Same assertions, no skips/timeout changes.

## Not verified
Full web types/build/tests for active batch; browser/visual/accessibility and
freshness are distinct work. No provider calls, runtime changes, merge or push.

## Open questions or contradictions found
Visibility-aware fresh snapshots still belong to the next operational freshness
step; local clock progression alone must not be presented as fresh remote health.
