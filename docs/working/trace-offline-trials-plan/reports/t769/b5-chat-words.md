# b5-chat-words report

## Outcome
Done.

## What changed and why
- New `AS runtime/activity/candidate/offline-words.ts` (`automationStudioActivityCandidateOfflineWords`): wraps the live trial words for `checkedAgainst: "recorded_run"` and `offlineCheck` passed/gap/inconclusive. Lower-case voice of the file. A gap's `why` is quoted only if it reads as a sentence (no `_`/`.`, ids, long numbers; <=80 chars).
- `trial-words.ts`: exported function is now a thin wrapper; the original body is private `liveTrialWords`. Declined (gate-refused) results are not wrapped. One shared function serves candidate and subflow tests (`result.ts` TEST regex covers both), so `result.ts` is unchanged.
- New `candidate/tests/offline-words.test.ts` (7 tests, incl. subflow tool id, coded-reason and no-offline cases, internal-word regex).

## Commands run and observed results
- 2026-10-27 tests first: `pnpm test src/programs/automation-studio/runtime/activity/candidate` -> "Test Files 1 failed | 2 passed (3); Tests 6 failed | 25 passed (31)".
- After: `pnpm test src/programs/automation-studio/runtime/activity` -> "Test Files 53 passed (53); Tests 447 passed (447); all groups passed: parallel, real-sql".
- `tsc --noEmit -p .` -> no output (no errors).
- Core root `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` -> one FAIL, `[statement-packing]` in flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts line 179 (another worker's file; not fixed); "1 violation(s) across 1 rule(s)". Nothing in my files.

## Not verified
Real evidence shape of `why` from B2's gate (assumed plain text per B3); activity card rendering in the UI.

## Open questions or contradictions found
None.

UNIT READY: runtime/activity/candidate/offline-words.ts, trial-words.ts, tests/offline-words.test.ts
