# t412: uncertain stop surfaced

## Outcome

Done. Two edits fall outside the files the brief listed as mine, and both are needed (see Open questions).

## What changed and why

Core (`packages/fluxiq/src/programs/automation-studio/`):

- `runtime/service/summaries/run-stop.ts` (new, exported from the barrel): `automationStudioRunStop(code)` matches `run.outcome_uncertain` exactly. It returns the code, the status words "Outcome uncertain" and a plain reason.
- `runtime/service/summaries/conversions.ts`:
  - `runtimeSessionToFlowRunDetail` handles a failed session whose `trace.failure.code` is the uncertain code. It writes `detail.metadata.stopCode = "run.outcome_uncertain"`, and the uncertain reason becomes `terminalFailureReason`.
  - The attempt's own failure (for example `timeout/web.action.timeout`) is left unchanged.
  - `flowRunSummaryWithInterventionSummaries`, which runs on every save, copies `stopCode` and `statusWords: "Outcome uncertain"` into `summary.metadata` from the detail. It removes both when the detail stops carrying them.
  - `summary.status` stays `failed`, because the status enum lives in `model/`, which this task does not own.
- `runtime/service/summaries/run-detail-merge.ts`: `stopCode` is now a session-projection key on the detail, and `stopCode`/`statusWords` are summary-projection keys. If a later projection no longer has the stop, the merge drops it instead of carrying the stale value forward.
- `runtime/activity/wording/run-uncertain.ts` (new, exported from the barrel): reads the code from the session trace's failure code, or else the record's `stopCode`. It gives the title "Stopped", the label "Stopped: not sure the last step went through, so it was not repeated." and that sentence as the text.
- `runtime/activity/run.ts`: when a failed run is uncertain, its final row uses the wording above instead of "Run failed". The phase is still `failed` and the row is still `final`. It is not marked `stopped`, because that flag is reserved for cancellations.

Downstream:

- `packages/test-runner/src/recovery-matrix/checks/run-stop-code.ts` (new, exported from the barrel): `matrixRunStopCode(runDetail)` reads `metadata.stopCode`, falling back to `summary.metadata.stopCode`, and only accepts a value shaped like a closed code.
- `checks/case-evidence.ts`: `run.stopCode: string | null` added to the evidence.
- `checks/matrix-checks.ts`: rows 9 (`outcome-reconciled`) and 11 (`worker-restart`) now pass a non-succeeded run only when `evidence.run.stopCode === "run.outcome_uncertain"`. The old suffix match on the attempt's failure is gone. Both rows record `stopCode` in `observed`. Row 11 used the same broken predicate, so I fixed it too.
- `matrix-rows.ts`: no change needed.
- Chat: no wording case was needed. The marker row keeps Core's plain title and text, so the chat shows "Stopped" followed by the sentence.

## Commands run and observed results

- Core: `npx vitest run .../runtime/service/summaries .../runtime/activity`
  - First run: 46 files passed and 1 failed. The failure was my own test's assertion, because the fixture's trace message also contained "uncertain". I fixed the assertion.
  - Re-runs: `run-stop.test.ts` 6/6 passed; `scope.test.ts` plus `run-uncertain.test.ts` 23/23 passed.
- Core: `pnpm run check` (packages/fluxiq) exited 0, both before and after the test edits.
- Core: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` printed Done. The downstream checks require an up-to-date Core build.
- Core: `node scripts/structure-audit.mjs`
  - First run failed on statement-packing in my `scope.test.ts` lines.
  - After unpacking them: exit 0, "passed (319 warning(s), 1160 baselined)".
- Downstream: `pnpm run check` (packages/test-runner)
  - First run failed: `measures.test.ts` lacked `stopCode`.
  - After the fix it passed.
- Downstream: `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test dist/recovery-matrix/checks/tests/*.test.js dist/recovery-matrix/tests/measures.test.js`: 12 tests, 12 passed.
- Downstream: `node scripts/test-extension.mjs uncertain-ending messages` (apps/extension): 34 tests, 34 passed.
- Downstream: `pnpm run check` (apps/extension) succeeded.
- Downstream: `node scripts/structure-audit.mjs` exited 0, "passed (184 warning(s), 651 baselined)".

## Not verified

- No live run or Lab matrix run, so row 9 has not been seen passing end to end.
- I did not check that the run detail Core saves for a real uncertain stop carries `stopCode` through the typed store. Metadata is stored as JSON, and I read the code to confirm that, but nothing exercised it.
- I did not check the order between saving the detail and the activity's `readRecord`. The activity reads the session trace first, so it does not depend on that order.
- No full suites were run.

## Open questions or contradictions found

1. Two downstream edits fall outside the listed ownership:
   - `packages/test-runner/src/recovery-matrix/run/run-matrix-case.ts`: one import, plus `stopCode: matrixRunStopCode(runDetail)` where the evidence is built. Row 9 cannot read the run detail without this.
   - `packages/test-runner/src/recovery-matrix/tests/measures.test.ts`: `stopCode: null` added to its evidence fixture, because the field is required.
   - New test file `apps/extension/src/panel/chat/stream/step/tests/uncertain-ending.test.ts`. It pins how the chat reads Core's ending row; no extension source changed.
2. The activity contract (`@fluxiq/contracts/client-gateway`) has no field for a closed code on a row. `ref` is meant for a tool or node id. So the ending row carries the uncertain wording but not the code itself. Adding a code field would mean a contract change, which is outside this task's area.
3. When the run ends on a `failed` final row, the chat marks the open step's card as failed ("Didn't work"; `stepFailedBy` in `apps/extension/src/panel/chat/stream/step/messages.ts`). For an uncertain stop, that card should say something like "Not confirmed". This is a follow-up in `messages.ts`, which was not mine to edit.
4. `summary.status` is still `failed`. If the run status itself should become uncertain, that is a model enum change.
