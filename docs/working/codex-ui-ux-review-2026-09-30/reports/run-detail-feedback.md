# Report: Selected run detail feedback

## Outcome
Supervisor focused verification complete; broad coordinated Core gates pending.

## What changed and why
Core web runtime/RunActionLogView.tsx now gives selected action/event detail
independent error/retry feedback, labels summary-only data, handles thrown/refused
or mismatched replies safely and clears busy/error state on a new selection.
Changing action pages also aborts previous selected-detail requests, preventing
late reopening. Existing scope/unmount/close request protection remains.
Owns this file and runtime/tests/run-detail-feedback.test.tsx only.

## Commands run and observed results
- heavy.sh 'codex t224 selected detail reproduce' pnpm exec vitest run
  run-detail-feedback (Core apps/web): exit1,3fail/2pass. Missing action/event
  error/retry surfaced; mismatched detail already rejected but no error shown.
- Corrected original five cases: exit0,5/5,7.21s.
- Expanded final command label 'codex t224 selected detail final focused':
  exit0,8/8,7.80s. Includes action paging, scope changes, event malformed/rejected
  response, close and selection races; assertions/timeouts/skips not relaxed.
- New loading-reset assertion checks actual aria-busy rather than only absent
  text, since the previous implementation exposed busy solely through aria-busy.

## Not verified
Broad web types/build/tests/audit running after coordinated source freeze. Live
browser, visual/focus/accessibility and backend execution remain unexercised.

## Open questions or contradictions found
Run list/load/export rejection and export-scope lifecycle deserve separate audit;
this correction owns selected detail only. User requests continued whole-system
audits, so it is queued rather than hidden or declared complete.
