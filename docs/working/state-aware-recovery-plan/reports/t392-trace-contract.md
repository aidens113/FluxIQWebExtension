# t392 unit B: trace and activity contract (C11)

## Outcome

Done. The contract is in place: types, projection, stream kind and wire field, each with a test. Nothing here runs a
handler. Later units fill these fields by calling the projector and emitter added here.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`. AS = `packages/fluxiq/src/programs/automation-studio/`.

1. **Attempt trace** (`AS/runtime/executor/contracts.ts`). The attempt trace gains three optional fields:
   - `lifecycle?: AutomationStudioLifecycleTrace`, which is `{ event, handlerId, occurrence, conditionEvidence[],
     disposition, completionCheck }`.
     - `event` is the C3 `AutomationStudioLifecycleEvent`.
     - `conditionEvidence` is a list of `{ truth, evidenceRef?, capturedAt }`.
     - `disposition` is `resume`, `route` (with `checkpointId`), `resolve` or `unhandled`. A `resolve` keeps no
       outputs, because they are run values.
     - `completionCheck` is an `AutomationStudioFactTruth`.
   - `entry?: AutomationStudioEntryTrace`, which is `{ kind: "default" | "entry" | "checkpoint", id?, evidence[] }`.
   - `failureClass?: AutomationStudioTraceFailureClass`.

   `framePath` and `subflowTarget` (from unit A) are unchanged. `contracts.ts` imports `AutomationStudioFactTruth`
   through the `lifecycle/index.ts` barrel, because the structure audit refuses a direct file import.
2. **Failure-class mapper.** It is in the new file `lifecycle/failure-class-trace.ts`, as
   `automationStudioTraceFailureClass(verdict)`, and is exported from `lifecycle/index.ts`.
   - `deliberate_stop` maps to `planned_fail`.
   - `retry_superseded` maps to `retry`.
   - `outcome_uncertain` maps to `uncertain`.
   - `on_fail_pending` maps to `undefined`, so it is never recorded.
   - The test is `lifecycle/tests/failure-class-trace.test.ts` (3 tests).
3. **Refusal types moved.** `AutomationStudioStateRouteRefusal` and `AutomationStudioStateRouteRefusalGuard` are now in
   `contracts.ts`, and `AutomationStudioStateRoutingRecord` gains `refused?`.
   - `state-routing/refusal.ts` re-exports both names.
   - `AutomationStudioGuardedStateRoutingRecord` is now an alias of the record.
   - `state-routing/index.ts` was already exporting those names from `./refusal.ts`, so it needed no change.
4. **Run detail** (`AS/model/flow-adaptation.ts`).
   - Every `stateRouting` variant gains `refused?: AutomationStudioFlowRunStateRouteRefusal[]`, which is
     `{ guard, toNodeId }`.
   - The action attempt record gains `framePath?`, `failureClass?`, `entry?` and `lifecycle?`.
   - The detail gains `handlerExecutions?: AutomationStudioFlowRunHandlerExecutionRecord[]`.
   - The model types are their own literal unions, because the model does not import runtime. The runtime projection
     type-checks against them.
   - I tried a new `model/flow-run-recovery.ts` first. It broke the structure audit (`model/` went over its file
     budget, and it made a third `flow-` prefix), so the types live at the end of `flow-adaptation.ts`.
5. **Projection** (`AS/runtime/service/summaries/`).
   - `state-routing.ts` projects `refused` as `{ guard, toNodeId }` only. It drops the node the guard named, unknown
     guards and malformed ids.
   - The new `recovery-trace.ts` (`automationStudioRunDetailRecoveryTrace`) parses `framePath`, `failureClass`, `entry`
     and `lifecycle` from the stored trace. Any field outside the closed shapes is dropped whole.
   - `conversions.ts` spreads that result onto each action attempt.
   - `run-detail-merge.ts` merges `handlerExecutions` by `executionId`, so a save does not lose them.
6. **Stream kind** (`AS/storage/project/runtime-stream-store.ts`).
   - `handler_execution` is added to `AutomationStudioRuntimeEventKind` and to `isRuntimeEventKind`.
   - `runtimeEventsFromDetail` emits one event per record: order 450_000, `entityId` = handlerId, status = outcome.
   - `runDetailFromEvents` folds them into `handlerExecutions`, writing the field only when there is at least one.
   - The record type is `AutomationStudioFlowRunHandlerExecutionRecord`, with these fields: executionId, handlerId,
     event, framePath, nodeId, incidentId?, disposition, outcome (`succeeded` | `failed` | `refused`), startedAt,
     finishedAt?. I added `executionId` because the stream's event id and the fold both need a unique key.
   - There is no contracts-package mirror of the stream kinds (grep found none).
7. **Wire contract** (`packages/contracts/src/client-gateway.ts`).
   - New constants and types: `CLIENT_GATEWAY_ACTIVITY_RECOVERY_KINDS`, `..._OUTCOMES`, `..._EVENTS` and
     `ClientGatewayActivityRecovery`.
   - `ClientGatewayActivity.detail` gains `recovery?`, documented as appearing on `step` rows only. I read "the `step`
     row" in the brief as the `detail.kind: "step"` row, not the `step` status field.
   - The doc comment's bounds now include `detail.recovery.subject` (160).
   - The protocol version is not bumped. Neither repository documents a bump rule, and the field is additive and
     optional.
8. **Emitter** (`AS/runtime/activity/step/recovery.ts`, `emitAutomationStudioActivityStepRecovery({ nodeId, recovery })`).
   It is exported from `step/index.ts` and from `activity/index.ts`.
   - The row it emits is `detail.kind: "step"`, with the subject as title, `ref` = nodeId, and status
     succeeded/failed.
   - Phase is `running` when the recovery succeeded and `repairing` otherwise.
   - The label reads "Recovered: …", "Recovery did not work: …" or "Recovery not tried: …".
   - It sets no `step` field.
   - An empty subject falls back to words for its kind.
   - `bounded.ts` keeps `recovery` only on a step row with closed values, clips the subject to 160 characters, keeps
     `event` only for a handler, and keeps `targetId` only when it is id-shaped.
   - Tests: `step/tests/recovery.test.ts` (4) and one new case in `tests/bounded.test.ts`.
9. **Extension.** There is no copied type: the extension imports `ClientGatewayActivity` from
   `@fluxiq/client-gateway-websocket`, which re-exports Core's contracts, so the field arrives with the type. I added
   the reader instead:
   - `apps/extension/src/shared/activity/step-recovery.ts` (`stepRecovery(event)`, type `ActivityStepRecovery`),
     exported from `shared/activity/index.ts`.
   - Its closed tables are `Record<union, true>`, so a change on the Core side fails the typecheck.
   - Test: `shared/activity/tests/step-recovery.test.ts` (3).
   - The panel does not render it yet.
10. **Docs** (Core).
    - `docs/architecture/automation-studio.md`: a new paragraph, "Recovery traces (state-aware recovery, C11)", placed
      before "A sometimes-present step…". The state-routing paragraph that holds the model-placement sentence is
      untouched.
    - `docs/architecture/automation-studio/client-gateway.md`: a `detail.recovery` paragraph.
    - `docs/architecture/automation-studio/persistence.md`: the list of stream kinds.

## Commands run and observed results

All Core commands were run from `packages/fluxiq` unless noted.

- `packages/contracts`: `npx tsc --noEmit --incremental --tsBuildInfoFile …` printed no errors.
- `packages/fluxiq` tsc:
  - The first run printed no errors.
  - The final run printed 2 errors, both in `runtime/live-patch.ts` (lines 574 and 593, `AddHandlerPatch` not
    assignable to `never`).
  - A run in between showed errors in `composite-execution/owner.ts`, which were gone by the final run.
  - Both files belong to concurrent work, not to this unit. None of my files has an error.
- The first vitest run had 4 failures in the activity recovery tests. The cause was a stale `packages/contracts/dist`:
  the new constants were undefined at runtime, so `recovery` was always dropped.
  - I rebuilt it with `npm run build` in `packages/contracts` and then in `packages/client-gateway-websocket`. The
    build-cache reported "inputs changed … stored".
- The final vitest run covered `lifecycle/tests`, `state-routing/tests`, `tests/state-routing-run.test.ts`,
  `tests/safe-state-routing-run.test.ts`, `service/summaries/tests`, `runtime/activity`,
  `storage/project/tests/runtime-stream-store.test.ts` and `storage/project/tests/runtime-stream-store-update.test.ts`.
  - Result: **64 files passed, 487 tests passed.** That is after moving the model types.
  - One intermediate run had 2 failures in `run-detail-preservation.test.ts`. Rerun alone, it gave 3/3 passed. The
    failures matched unit A's in-progress edits to the service, which the test imports.
  - `state-routing/tests` and `state-routing-run.test.ts` pass with no edits.
- Core root, `node scripts/structure-audit.mjs`: 7 violations, none in my files.
  - 2 are `[imports]` in `runtime/composite-execution/{boundary,child-bounds}.ts`.
  - 5 are `[naming]` depth violations in `runtime/llm/harness/unit-repair/*`.
  - My own 3 violations (a model file, the `flow-` prefix, the `contracts.ts` import) are fixed.
- Downstream `apps/extension`:
  - `npx tsc -p tsconfig.json --noEmit` exited with rc=0.
  - `EXTENSION_TEST_BUILD_LABEL=t392-b node scripts/test-extension.mjs shared/activity/tests background/activity/tests`
    gave 146 passed, 0 failed. The `step-recovery` subset alone gave 3/3. I removed the scratch build directory
    afterwards.
- Downstream `node scripts/structure-audit.mjs`: "passed (184 warning(s), 257 baselined)".

## Not verified

- No live run or browser test. Nothing calls the emitter or writes the trace fields yet; later units do.
- The full `packages/fluxiq` tsc is not clean, because of the 2 concurrent errors in `live-patch.ts`.
- No full suites were run, per the repository rule.
- I did not check whether the web panel renders run-detail `handlerExecutions` or the new attempt fields. It ignores
  unknown fields.

## Open questions or contradictions found

1. **`step` row.** I put `recovery` on `detail` (rows with `kind: "step"`), not on the `step` status object. If the
   supervisor meant `ClientGatewayActivity.step`, the field has to move.
2. **`completionCheck` is required** on `lifecycle`, matching `decideAutomationStudioDisposition`'s input. A handler
   with no completion check should record `"true"`.
3. **Callers must use `executionId`.** It is not in the brief's field list, but the record type requires it: callers
   must mint one unique per run.
4. **Stale dist.** `packages/contracts/dist` and `packages/client-gateway-websocket/dist` were stale until I rebuilt
   them, and fluxiq's vitest reads the contracts dist at runtime. Any later contract change needs the same rebuild
   before tests run.
