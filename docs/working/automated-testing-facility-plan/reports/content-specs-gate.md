# Worker report: content specs gate

## Outcome

In progress. The spec edits and the singular-wording change are on disk. Validation is running.

## What changed and why

- The recovery account sentence (`apps/extension/src/content/action-runtime/recovery/account.ts`, since 36daa680) is now appended to a timed-out result's `validation.actual` and `failure.actual`. Eight content-spec rows asserted the older text with no account, so they were updated:
  - `waits.spec.ts`: too-slow, visible, and wait_for_text timeout rows (the shared `SPENT_WAIT` constant).
  - `actions.spec.ts`: the wait_for_selector timeout row.
  - `shadow-roots/tests/shadow-root-waits.spec.ts`: the unscoped job-board row. Its stale comment ("exactly as the resolver decides it") was corrected. The resolver widens a click with no host chain to open roots, but a wait does not.
  - `check-assert.spec.ts`: two assert-exists timeout rows (the shared `NEVER_RECOVERED` constant: 3 attempts, 750 ms, because the assert's window is `assert.timeoutMs` and the command names no budget of its own).
- Coordinator item: `account.ts` said "within its 1 attempts". It now picks "attempt" or "attempts" by count. `recovery/tests/record.test.ts` gained a row that pins the singular. The three single-attempt spec rows assert "within its 1 attempt".
- `extract-list-catalog.spec.ts` was left untouched and treated as green (fixed in e51193db by another worker).

## Commands run and observed results

- `pnpm test` in apps/extension, before the pluralization: exit 0, 990 tests, 990 pass, 0 fail, 74 s.
- (post-change runs pending)

## Not verified

(pending)

## Open questions or contradictions found

(pending)
