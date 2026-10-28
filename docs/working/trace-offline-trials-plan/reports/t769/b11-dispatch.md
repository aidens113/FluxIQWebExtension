# t769 B11: dispatch wrapper keeps environmentKind and offlineFirst

AS = `packages/fluxiq/src/programs/automation-studio/` in Core `fxwork/t769/!FluxIQ`.

## Outcome

Done. `automationStudioProjectDispatchTrialPort` now copies `environmentKind` (F3) and `offlineFirst` onto the wrapper. A trial the gate keeps from `offlineFirst` is listed as the brief's trial.

UNIT READY: AS runtime/project-agents/dispatch/trial-port.ts, AS runtime/project-agents/dispatch/receipts.ts, AS runtime/project-agents/dispatch/tests/trial-port-check-rows.test.ts

## What changed and why

- `trial-port.ts`:
  - Copies `port.environmentKind` and `port.offlineFirst` onto the wrapper by reference, next to `prepareStart`. No lease scoping is applied to either: the other members are handed on as they are as well.
  - The wrapper remembers the result the port last answered (`answered`). In `weighed`, an answer matching it (same brief, revision, digest) takes the existing path (`receipts.weighed`). Any other answer is one the port never gave, so a trial the gate kept from `offlineFirst`. It is listed through the new `receipts.kept`, remembered under that reference, and set as `spend.trial`, the last trial heard. The brief's own `port.weighed` is told in both cases, as before.
- `receipts.ts`: a new method `kept(answer)` adds a reference from the gate's answer (`${briefId}.trial-N` unless the answer has a `trialRunId`), clears any pending port answer, and returns the reference. The supervisor and repair briefs read it through `list()` like any other.
- Not marked as checked against the recording. The reference shape (`contracts/receipt-ref.ts`, `AutomationStudioProjectTrialRef`) is fixed and its parser (`readTrial` in `contracts/builder-return.ts`) accepts only known fields, so a flag would need a contract change in files I do not own. Noted in the receipts header.
- Tests: four added to `tests/trial-port-check-rows.test.ts` (header comment updated), because `tests/` already holds 25 entries (the folder's advisory file count is past 15 in the audit). No new file.

## Commands run and observed results

2026-10-27, from `packages/fluxiq` unless noted.

- Tests first: `pnpm test src/programs/automation-studio/runtime/project-agents/dispatch/tests/trial-port-check-rows` printed `Tests 3 failed | 3 passed (6)`. The failures were `expected undefined to be 'trace'`, `expected undefined to be [AsyncFunction check]` and `expected [] to match object [ { kind: 'subflow_trial', ...} ]`.
- After implementation: `pnpm test src/programs/automation-studio/runtime/project-agents/dispatch` printed `Test Files 25 passed (25)`, `Tests 136 passed (136)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .`: exit 2, 14 errors, none in `project-agents/dispatch` (0 matches). 13 are in `service/project-build/subflow-trials.ts` (another worker's file: read-only `offlineFirst` assignment, implicit any) and 1 in `src/ui/activity-status/tests/truthful-test-labels.test.ts`. Not touched.
- Core root `node scripts/structure-audit.mjs`:
  - First run: `FAIL [as-never]` at my test line 81 (`as never`) and `1 violation(s)`. Fixed by casting through `unknown` to the port's parameter type.
  - A run in between hit an `ENOENT` on a transient `vitest.config.ts.timestamp-*.mjs` from a concurrent run, and was repeated.
  - Final: `structure-audit: passed (444 warning(s), 1152 baselined).`

## Not verified

- No end-to-end run of a project build with a real offline port: `service/project-build/subflow-trials.ts` (B9's) is not finished, so nothing sets `offlineFirst` on a brief's port yet. Only wrapper-level tests ran.
- Repair and supervisor reading of a kept trial was not exercised through `run-brief.ts`; the receipts' `list()` is what both read, and it is tested.
- Full suites not run (by instruction).

## Open questions or contradictions found

1. A kept offline trial cannot be flagged as checked against the recording in its reference (see above). If the supervisor wants the flag, `receipt-ref.ts` and `readTrial` in `builder-return.ts` must change together.
2. A kept answer's `rows` come from its `feedback.stored`, as for any trial. A recording-demonstrated failure has probably none, so the reference lists no rows. That is right for `closestTrial` ranking.
3. A port answer that the gate leaves untold (a `notRun`) leaves `answered` set until the next call. A later kept answer for the same revision and digest would then be taken as the port's. The gate asks `offlineFirst` before any port call for a key, so this cannot happen in the gate as built.
4. `tests/` in this folder is at 25 entries and `trial-port-check-rows.test.ts` now covers more than row checks. Renaming it is a supervisor call.
