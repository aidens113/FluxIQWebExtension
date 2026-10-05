# Unresolved terminal recovery cause

Status: Complete
Owner: resume-live-prep worker
Updated: 2026-10-03
Scope: Minimal Core recovery-cause selection; no run-status override.

## Current State

Implemented the released selector fix after [read-only cause investigation](./recovered-run-status.md). A healed historical failure no longer becomes the supplied terminal recovery cause merely because it is the last historical failure.

`automationStudioUnresolvedFailedAttempt` walks execution-ordered attempts backward. A failed or unknown attempt is excluded only when a later successful attempt names the same node. A more recent failure after that success remains unresolved; other-node faults, unnamed faults, unknown without actual success and result-refutation faults remain. It returns the original attempt reference and never edits history/status.

Both service canonical execution callbacks now call the helper, so an absorbed coupon fault does not reach the invocation gate as the terminal failed trace. Annotation's durable action-attempt fallback uses the same helper. Existing no_failed_attempt refusal remains provider-free. Deterministic-first rules and genuine known-recovery gates remain unchanged.

## Owned files

Core prefix `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `recovery/unresolved-failed-attempt.ts` new focused generic selector.
- `recovery/index.ts` barrel export.
- `recovery/tests/unresolved-failed-attempt.test.ts` seven cases.
- `service.ts` existing recovery import and two canonical execution callbacks only.
- `recovery/annotation/annotate.ts` import and fallback selection only.
- `recovery/annotation/tests/ladder-fixes.test.ts` real healed-failure boundary case plus test harness option.

No changes to executor status, preserved attempt records, Lab verdict/oracles, flow-draft, permissions, budgets, other worker source, shared docs or runtime state.

## Validation

Failing-first real annotation regression: failed summary with failed action followed by successful same-node attempt resolved a provider once when none should be resolved; **1 failed / 2 passed**. The regression explicitly preserves failed summary and both historical records rather than claiming that healing the action proves graph completion.

After implementation, heavy-slot wrapped focused suite **4 files / 34 tests passed**:

- helper selector 7;
- annotation ladder boundary 3;
- invocation gates 13;
- graph recovery ladder 11, including existing retry-success and genuine exhausted-failure status behavior.

`git diff --check` passed. Inspection confirmed both prior reverse-failed callbacks and annotation fallback were replaced. No full suite/typecheck/build/audit or live/provider/browser operation by this worker. Supervisor validates combined tree and downstream metadata work.

## Remaining uncertainty and next action

The actual terminal reason for run-mut4fvkm-e2fc03e6 remains unknown because its saved artifacts omitted Core trace/control termination metadata and isolated workspace was disposed. This fix prevents diagnosis of an already healed coupon fault; it does **not** change or explain away the failed graph status. Retain closed-category terminal diagnostics in Lab and privately inspect the exact trace of the next persistent replay before any status-semantic change.

Authored s7/unattempted versus playback s3/unlisted revision mismatch remains in the read-only report. Preserve and trace the actual executed Flow revision/edges; do not infer a successful graph solely from four held fixture facts or from successful final action.
