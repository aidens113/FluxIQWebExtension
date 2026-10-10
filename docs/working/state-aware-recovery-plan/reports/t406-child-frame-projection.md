# t406: called-part attempts in the run detail and stored events

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t406/!FluxIQ`, branch `task/t406-child-frame-projection`. Nothing committed.
Paths below are under `packages/fluxiq/src/programs/automation-studio/` unless they say otherwise.

## Outcome

Done. The run detail and the stored runtime events now carry every frame's attempts, in run order. Each one has its `framePath`, `entry`, `lifecycle`, `failureClass` and `stateRouting`. The Call Subflow attempt carries `subflowTarget`. Step counts do not count a call twice, and a Flow with no Call Subflow projects exactly as before.

## Decision: the call attempt stays as a container row

- **Order.** Rows come depth first, in run order. A root-frame attempt comes first, and a Call Subflow attempt is followed at once by its part's attempts. A nested part follows its own call in the same way. `order` numbers the rows 1..N across every frame. For a Flow without Call Subflow, the numbering is unchanged.
- **The call row.** It keeps the trace's own id, route, failure and outcome, and it adds `subflowTarget`. It stays a row because it is the root frame's step: the calling frame's recovery, handlers and On Fail paths act on its outcome.
- **Child rows.** Each child row carries:
  - `parentAttemptId`: the run-detail id of the call that ran it.
  - `attemptId`: `<parentAttemptId>:<trace attemptId>`. The prefix keeps ids unique because a part's ids repeat when it is called twice. An id longer than 200 characters is shortened with a sha256 prefix, because the stream store's `requiredId` refuses longer ids.
  - `metadata.traceAttemptId`: the attempt's id inside its own frame's trace.
- **Step counting.** A container is any row that another row names as its `parentAttemptId`. It is not a step, and its children are. This is `summaries/step-count.ts`.
  - `summary.actionAttemptCount` and the run summary's `attemptCount` count steps.
  - The audit manifest `actionCount` also counts steps.
  - When rows and steps differ, `summary.metadata.actionRecordCount` holds the row count for the action pager.
  - A call that ran no part, or was refused, counts as one step.
- **Call Flow is not projected.** A Call Flow attempt's `childTrace` (a published Flow's own run, with no `subflowTarget`) stays unprojected, as before. That keeps Flows without Call Subflow exactly as they were. See open question 1.
- **Recovery records stay root-only.** `recoveryAttempts`, interventions and `recoveryAttemptCount` are still read from the root frame only.

## What changed and why

Summaries (owned):
- `runtime/service/summaries/frame-attempts.ts` (new): `automationStudioRunDetailAttemptsInRunOrder` flattens the root trace through each Call Subflow `childTrace` and assigns the ids.
- `runtime/service/summaries/step-count.ts` (new): `automationStudioRunDetailStepCount`.
- `runtime/service/summaries/conversions.ts`: the per-attempt mapper now runs over every frame. A part's attempt is classified against no Flow adaptation, because a part's node can share an id with one of the Flow's nodes. All counts are now step counts.
- `runtime/service/summaries/recovery-trace.ts`: parses `subflowTarget` (ids, and a revision that is a number or null).
- `runtime/service/summaries/run-audit.ts`: the manifest `actionCount` counts steps.
- `runtime/service/summaries/index.ts`: barrel.

Stream store (`storage/project/runtime-stream-store.ts`): no code change was needed.
- Events carry the whole record, so `subflowTarget`, `parentAttemptId`, `framePath`, `entry` and `lifecycle` reach the payload.
- Events sort by timestamp and then by `order`, and a child never starts before its call, so stored order is run order.
- `runtime_runs.action_count` is set from `summary.actionAttemptCount`, so it holds steps. `listRunActions` totals its rows.

Reader adjustments the projection forced:
1. `model/flow-adaptation.ts`: adds the optional `subflowTarget` and `parentAttemptId` to `AutomationStudioFlowRunActionAttemptRecord`.
2. These readers act on the Flow's own nodes, so they now read only the root frame (`parentAttemptId === undefined`). Before, the newest failed or succeeded row, or a part node sharing an id with a Flow node, would have pointed them at a part's node:
   - `runtime/recovery/unresolved-failed-attempt.ts`
   - `runtime/recovery/refuted-result/step-failure-target.ts`
   - `runtime/recovery/context.ts`: the failed record, step parameters, recovered failures and recent nodes.
   - `runtime/recovery/refuted-result/attempt.ts`
   - `runtime/llm/node-tools/run-start-pages.ts`
3. `runtime/llm/harness/context-packet.ts`: `recentActions` stays root-frame only. The packet's closed projection, and the DeepSeek preflight that checks it, have no field that tells a part's node from the Flow's. See open question 2.
4. `runtime/result-verification/run-outcome.ts` (`attemptsOfThisSession`, the judge path): a part's row is kept when its chain of calls leads to a root attempt of this session. Before, part rows were filtered out because their ids are not in `session.trace.attempts`.
5. `runtime/result-verification/read-account/accounts.ts` (judge and build-test read accounts): a part's read is its own account. It is keyed by its call plus its node, its loops are read from its own frame's rows, and it has counts only, with no authored parameters from the Flow's same-id node. A run with no parts gives the same result as before.
6. `runtime/service.ts` `listFlowRunActions`, legacy JSON-lines path: `total` reads `summary.metadata.actionRecordCount` before `actionAttemptCount`, so the pager does not stop short by the number of containers. One line was changed in place, so the file-lines baseline of 4360 still holds.
7. Left unchanged: `recovery/annotation/annotate.ts` `priorAttemptCount` now counts every row. That only raises the numbering offset for a trial's attempts, which cannot cause a collision.

Tests:
- `runtime/service/summaries/tests/frame-attempts.test.ts` (new) covers:
  - A two-level Call Subflow. It checks order, ids, `parentAttemptId`, `framePath` at depths 1, 2 and 3, the `entry` record, the `lifecycle`, `failureClass` and `stateRouting` records, and `subflowTarget` with a numeric and a null revision.
  - Counts: 8 rows, 6 steps, and `actionRecordCount` of 8.
  - The same part called twice gets distinct ids.
  - A call that ran no part is one step.
  - A Call Flow child is not projected.
  - A Flow without Call Subflow projects exactly as before.
  - Ids stay at or under 200 characters with deep nesting.
- `runtime/service/summaries/tests/step-count.test.ts` (new).
- `storage/project/tests/runtime-stream-store.test.ts`: a new describe round-trips a projected two-level run. It checks event order, `subflowTarget` on the call's event, the child payloads' `framePath`, `entry` and `lifecycle`, the detail read back, a summary `actionAttemptCount` of 4, a `listRunActions` total of 6, and `getRunActionDetail` for a grandchild. The test lives in this existing file because a new file broke the directory-files limit: `storage/project/tests` would have held 26 files against a limit of 25.
- New cases in the existing test files:
  - `recovery/tests/unresolved-failed-attempt.test.ts`
  - `llm/node-tools/tests/run-start-pages.test.ts`
  - `result-verification/read-account/tests/accounts.test.ts`

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t406/!FluxIQ` or from its `packages/fluxiq`.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` | No output. Run again after the final edits: still no output. |
| `npx vitest run` on `runtime/service/summaries`, `storage/project`, `runtime/tests/service-flows` and `runtime/tests/service-adaptation` | 89 test files passed and 2 skipped. 571 tests passed and 4 skipped. |
| `npx vitest run` on the readers: `runtime/recovery/tests`, `recovery/refuted-result/tests`, `recovery/annotation/tests/annotate.test.ts`, `runtime/result-verification`, `llm/harness/tests/context-packet.test.ts`, `llm/tests/recovery-context-packet.test.ts`, `llm/tests/harness.test.ts`, `llm/node-tools/tests`, `runtime/tests/refuted-result`, and the `service/runtime-adaptation/tests` files `reauthor-build`, `step-failure-port` and `refuted-result-port` | 116 test files passed. 1297 tests passed. |
| After the stream-store test moved into `runtime-stream-store.test.ts` | 14 tests passed. |
| `runtime/service/summaries` after the final trim | 12 test files passed. 89 tests passed. |
| `node scripts/structure-audit.mjs 2>&1 \| grep -E "FAIL\|structure-audit:"` | `structure-audit: passed (318 warning(s), 1160 baselined).` That is the same warning count as before the work. An earlier run gave one directory-files FAIL, which was fixed as described above. |

Line endings: the edited files went back to CRLF to match the checkout.

## Not verified

- No live run or Lab run. No full suites, per the brief.
- The web run log (`apps/web/.../runtime/attempt-story/`) was not changed or run. See note 3.
- The `listRunActions` summary rows (`actionSummaryFromRow`) carry no `parentAttemptId`, `framePath` or `subflowTarget`. Those fields are in each row's `detail_json`, which `getRunActionDetail` returns, but the paged list does not include them.
- Downstream Lab judge parsing of the new fields.

## Open questions or contradictions found

1. The brief says to recurse through every `childTrace`, and also that a Flow without Call Subflow must project exactly as before. A Call Flow attempt also has a `childTrace`, and projecting it would change Call Flow runs. Only Call Subflow children are projected. If Call Flow children should be included too, that is a decision for main.
2. The judge's LLM packet (`result-verification/verify.ts` passes `runDetail`, and `recentActions` comes from it) still shows only root-frame steps. Showing part steps needs a `parentAttemptId` (or a frame) field. That field would go into `AutomationStudioLlmRecentActionContext`, `RECENT_ACTION_FIELD_NAMES`, `isAutomationStudioLlmRecentActionContext` and the DeepSeek preflight. It is a prompt-shape change, which is main's decision. The judge does now see a part's reads in its read accounts.
3. For main, because `apps/web` is outside my scope: `runtime/attempt-story/lifecycle.ts` is still a stub that reads nothing, and `child-run.ts` reads only a raw `childTrace`. To show parts in the run log, the web needs to:
   - render `parentAttemptId` and `framePath` nesting, `subflowTarget`, `entry` and `lifecycle`;
   - count steps without the containers (the rows another row names as `parentAttemptId`).
4. A root loop that calls a part with a read each time gives one read account per call, not one looped account with passes. Joining them across calls would need the part's identity on child rows. The `subflowId` is on the container's `subflowTarget`.
5. The recovery records stored with the run (`recoveryAttempts`, interventions and `recoveryAttemptCount`) still come only from root-frame attempts. A part's own ladder decisions show only on its attempt rows, as `metadata.recoverySelected`.
