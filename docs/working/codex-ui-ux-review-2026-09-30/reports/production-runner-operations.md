# Report: Production Runner operations

## Outcome
Partial: supervisor correction passes final11/11 focused tests; coordinated
type/build/full-suite verification pending.

## What changed and why
Core production-runner.tsx now guards launch synchronously via existing operation
lock; advance/cancel share one per-run lock, leaving unrelated workloads usable.
Local launch and per-workload errors preserve inputs and allow explicit retry.
Parameter drafts belong to effective target type/id, with immediate safe defaults
and reconciliation when type changes or a target disappears. Snapshot generations
reject older completions and teardown ignores pending results.

Owns Core apps/web/src/features/programs/live-views/production-runner.tsx,
tests/production-runner-operations.test.tsx and existing production-runner.test.ts.
The existing source contract now asserts the added launch busy condition.
No backend/runtime/storage/protocol changes, private data or real provider calls.

## Commands run and observed results
- heavy.sh 'codex t224 production reproduce' pnpm exec vitest run
  production-runner-operations: exit1,5failed. Duplicate launch/run submissions,
  missing local launch refusal and carried-over target parameter values reproduced.
- Narrow diagnostic -t 'shows a failed launch':1fail, other4excluded by CLI
  selection, no source test skip added. Existing StatusText publishes a global
  toast rather than rendering local feedback; local alert now added.
- Corrected heavy.sh pnpm exec vitest run production-runner: session33282
  exit0,2files/9tests passed,14.79s.
- Added transport-rejection lock release and out-of-order refresh regressions;
  final focused session49742 exit0,2files/11tests passed,15.77s. Source names the started
  target explicitly, preserving draft edits during a pending launch.

## Not verified
Live rendering/accessibility, provider/backend execution and full web suite on
this active batch. Wait for all workers frozen before whole-tree checks.

## Open questions or contradictions found
Production schema completeness and visibility-aware freshness remain later
roadmap work. Continue past this batch boundary at user's explicit request.
