# t245 — Post-reauthor replay root cause

## Outcome

The t240 expectation is correct. The real service composition has a product
gap for a Router-selected Subflow: the refuted result is extended, approved,
and applied, but the replay is launched against the parent orchestration Flow
instead of the selected Subflow graph. That replay fails before result
verification, so no fourth provider call occurs.

The observed provider sequence is therefore truthful:

1. `loop_verification` — first negative verdict;
2. `loop_verification` — agreeing negative verdict;
3. `evidence_tool_decision` — successful extend/reauthor;
4. no call — the incorrectly targeted replay produces a failed session, and
   result verification deliberately returns early for failed sessions.

## Exact control flow

1. `verifyAutomationStudioRuntimeSessionResult` records the refutation and
   calls `repairAutomationStudioRefutedRunResult`.
2. The service's `repairRefutedResult` port routes `wrong_answer` to
   `automationStudioReauthorRefutedResult`, generates an `extend` bootstrap
   adaptation, approves it, applies it, and returns detail whose
   `resultReauthor` has `applied: true`.
3. `run-outcome.ts` correctly recognizes the applied reauthor and calls
   `rerunRepairedFlow`.
4. The verification input already owns the selected `subflowId`, but the port
   type accepts only `{ detail }`, and the call at the loop-closing branch
   forwards only `{ detail: repaired }`.
5. The service callback consequently calls `rerunAfterRepair` with
   `from: "start"` but without `subflowId`.
6. `repair-rerun.ts` treats an absent `subflowId` as a direct-Flow replay and
   reads `input.session.flowId`. For the t240 composition that is the parent
   orchestration Flow, not the Router-selected graph that produced the result
   and that the extend adaptation changed.
7. `runCanonicalAutomationStudioFlow` cannot execute that orchestration Flow
   as the selected graph, so the returned replay session is failed.
8. The recursive verification call receives that failed session;
   `verifyAutomationStudioRuntimeSessionResult` begins with
   `if (input.session.status !== "succeeded") return input.session`, explaining
   both the failed final status and the absent post-apply verification call.

The existing unit test “runs the corrected Flow again and judges what it
produced” does not expose this. Its mocked `rerunRepairedFlow` always returns a
successful session and does not model Router/Subflow targeting. The
`repair-rerun.ts` implementation itself already has the correct selected
Subflow path when a `subflowId` is supplied.

## Smallest fix

No change is needed to the reauthor decision, bootstrap adaptation, approval,
apply, grant, or result-verification consensus logic.

1. In
   `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts`,
   extend the `rerunRepairedFlow` port input with optional `subflowId`, and call
   it with `input.subflowId` when present.
2. In
   `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`, accept
   that field in the service port callback and forward it to
   `rerunAfterRepair`.
3. Keep `repair-rerun.ts` unchanged: its `changedFlow` branch already resolves
   the selected Subflow, loads its `graphFlowId`, verifies parent ownership,
   and reruns that graph from the start.

This preserves direct-Flow behavior because the new field remains optional.
It also uses the authoritative selected Subflow already carried by the
verification input instead of guessing from run-detail entries.

## Test plan

- Keep the t240 real service-composition assertion that expects
  `loop_verification`, `loop_verification`, `evidence_tool_decision`, then the
  post-apply `loop_verification`; assert the final run succeeds and the
  adaptation remains `extend`/`applied`.
- Add or refine the nearest `run-outcome.test.ts` replay case so its mock port
  records and asserts the forwarded `subflowId`.
- If the service callback is extracted or directly testable, assert that it
  forwards the same ID into the repair rerun. The t240 integration test is the
  decisive coverage because it exercises the real Router, stored Subflow, and
  real service callback together.
- Run the t240 focused test, the result-verification suite, the nearest service
  adaptation/refuted-result suites, `pnpm --filter fluxiq check`, and diff
  checks in both repositories.

## Scope and validation

Read only the t240 test, result-verification repair orchestration, service
rerun callback/run path, repair-rerun implementation, and nearest tests. No
source, test, or shared-document edits were made for t245. No live, provider,
browser, Lab, build, or commit action was performed.
