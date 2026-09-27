# t247 — Subflow repair-rerun port audit

## Outcome

t245's two-file production fix is complete in scope and preserves direct parent-Flow behavior.
`verifyAutomationStudioRuntimeSessionResult` already owns the authoritative selected `subflowId`;
the value is lost only because `rerunRepairedFlow` accepts and receives `{ detail }`. Making that
port field optional and forwarding it through the service callback reaches an existing, tested-by-
composition Subflow-aware branch in `repair-rerun.ts`.

No recovery decision, reauthor, adaptation, retry, verification-consensus, budget, grant, or
permission logic needs to change.

## Files inspected

- downstream `t245-post-reauthor-replay-root-cause.md`;
- Core `runtime/result-verification/run-outcome.ts`;
- Core `runtime/result-verification/tests/run-outcome.test.ts`;
- Core `runtime/service.ts` result-verification port and `rerunAfterRepair` adapter;
- Core `runtime/service/runtime-adaptation/repair-rerun.ts`;
- current t240 `runtime/tests/refuted-result/tests/reauthor-service.test.ts`.

Repository search found exactly three source/test files containing `rerunRepairedFlow`:
`run-outcome.ts`, its test, and `service.ts`. No other implementation or fixture consumes that port.
There is no direct unit test of `rerunAutomationStudioSessionAfterRepair`; the t240 composition test
is the real Subflow-path coverage.

No source/shared-document edit, test/build, live/provider/browser action, or commit was performed.

## Exact production changes

### 1. Result-verification port and call

File: `runtime/result-verification/run-outcome.ts`

Change the port input from:

```ts
{ detail: AutomationStudioFlowRunDetail }
```

to:

```ts
{ detail: AutomationStudioFlowRunDetail; subflowId?: string | undefined }
```

At the applied-reauthor branch, call it with:

```ts
{
  detail: repaired,
  ...(input.subflowId ? { subflowId: input.subflowId } : {})
}
```

`input.subflowId` is already forwarded into `repairAutomationStudioRefutedRunResult`; this makes the
subsequent replay use the same selected subject instead of dropping it at the next port.

### 2. Service port adapter

File: `runtime/service.ts`

Change the callback parameter from `async ({ detail })` to
`async ({ detail, subflowId })`, then add the optional field to the existing `rerunAfterRepair`
call:

```ts
{
  projectId,
  session,
  detail,
  graphOptions,
  adaptationContext,
  from: "start",
  ...(subflowId ? { subflowId } : {})
}
```

No other service line needs to change. `rerunAfterRepair` already derives its input type from
`rerunAutomationStudioSessionAfterRepair`, whose input already includes optional `subflowId`.

## Every consumer and fixture affected

| Consumer/fixture | Required edit | Why |
| --- | --- | --- |
| `AutomationStudioResultVerificationPorts.rerunRepairedFlow` | Add optional `subflowId` | Public port must carry the selected subject. |
| Applied-reauthor call in `run-outcome.ts` | Forward `input.subflowId` conditionally | This is the only loss point in verification. |
| Service `resultPorts.rerunRepairedFlow` callback | Accept and forward `subflowId` | Connects the port to the existing repair-rerun input. |
| `run-outcome.test.ts` `looping` fixture | Record the full request, or record `subflowId` separately | Existing fixture records only `detail`, so it cannot assert the new contract. |
| `run-outcome.test.ts` replay assertions | Add selected-Subflow and absent-parent assertions | Proves forwarding and backward compatibility. |
| t240 `reauthor-service.test.ts` | No fixture/type edit required; rerun unchanged as decisive validation | It uses the real service port, Router, Subflow, graph, and replay path. Its existing fourth-call expectation should become true. |

Search found no second mock or structural implementation of `rerunRepairedFlow`. The service's
other `rerunAfterRepair` callers are adaptive-resume paths that already pass `subflowId` where a
Router selected one; they do not consume this port and need no edit.

## Why parent-Flow behavior is unchanged

The new field is optional at both seams. For a direct parent-Flow verification:

1. `AutomationStudioRuntimeSessionVerificationInput.subflowId` is absent today and remains absent.
2. The conditional spread adds no port field.
3. The service conditional spread adds no repair-rerun field.
4. `changedFlow` continues down its existing `if (!input.subflowId)` branch and reads
   `getFlow(projectId, session.flowId)`.
5. Ownership checking, Subflow entry rewriting, and Subflow version tagging remain disabled exactly
   as before because each is already guarded by `input.subflowId`.

For a selected Subflow, the same value now reaches the existing alternate branch, which:

- loads the selected Subflow under the parent session Flow;
- loads its `graphFlowId` rather than the orchestration Flow;
- verifies `parentFlowId` and `parentSubflowId` ownership;
- reruns that graph from the start;
- updates only the matching Subflow entry and graph-version record.

The fix therefore selects between two already-existing behaviors; it does not modify either
behavior.

## Exact test assertions

### `result-verification/tests/run-outcome.test.ts`

Refine `looping` so `rerunRepairedFlow` records its whole request (or an adjacent
`rerunSubflowIds` array).

In `runs the corrected Flow again and judges what it produced`, call verification with
`subflowId: "sub-1"` and assert:

```ts
expect(context.rerunRequests).toHaveLength(1);
expect(context.rerunRequests[0]).toMatchObject({ subflowId: "sub-1" });
expect(context.rerunRequests[0]?.detail.metadata?.resultReauthor).toMatchObject({ applied: true });
expect(next.status).toBe("succeeded");
expect((next.metadata?.resultVerification as JsonObject).status).toBe("confirmed");
```

Retain a direct parent-Flow case with no `subflowId` and assert:

```ts
expect(context.rerunRequests).toHaveLength(1);
expect(context.rerunRequests[0]).not.toHaveProperty("subflowId");
```

Keep the existing no-apply, repair-once, and failed-rerun assertions. They prove the new field does
not bypass application gating or the structural one-cycle bound.

### `runtime/tests/refuted-result/tests/reauthor-service.test.ts`

Keep the success-path assertions without weakening the fourth call:

```ts
expect(taskKinds).toEqual([
  "loop_verification",
  "loop_verification",
  "evidence_tool_decision",
  "loop_verification"
]);
expect(run.status).toBe("succeeded");
expect(resultReauthor).toMatchObject({ routed: true, applied: true });
expect(appliedAdaptation).toMatchObject({ mode: "extend", status: "applied" });
expect(activeGrantCount).toBe(0);
```

Retain the failure-path assertions for the structured provider failure, absence of raw provider
text, no applied replay, and released grant.

No new repair-rerun unit test is required for this two-file forwarding fix. If one is later added,
it should separately pin the existing direct-Flow lookup and selected-Subflow graph/ownership
branches rather than duplicate result verification.

## Validation commands

From `F:/!FluxIQ` after the two source edits and test adjustment:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts `
  src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts `
  src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts

pnpm --filter fluxiq check
git diff --check -- `
  packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/service.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
```

After focused validation, run Core root `pnpm test`, `pnpm check`, and `pnpm build`, followed by the
paired downstream gates before authorizing a new live run.
