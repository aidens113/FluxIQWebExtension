# t248 — Selected-Subflow replay compatibility audit

## Verdict

Forwarding the selected `subflowId` through the post-reauthor rerun is a
behavioral correction with an additive, source-compatible type change. It does
not change wire formats, stored documents, gateway messages, or downstream
extension contracts.

`AutomationStudioResultVerificationPorts` is exported through
`runtime/result-verification/index.ts`, `runtime/index.ts`, and the public
`@fluxiq/fluxiq/automation-studio` entry point, so the port type is technically
public rather than file-private. Even so, changing its optional callback input
from `{ detail }` to `{ detail; subflowId?: string }` is nonbreaking for normal
TypeScript consumers: existing callback implementations may ignore the added
property, and callers are not required to supply it. No major-version or
compatibility adapter is warranted.

## Required semantics

- A present, non-empty `subflowId` means: replay the selected Subflow's owned
  graph, starting at the beginning. It must be forwarded unchanged.
- An absent `subflowId` means: preserve the existing direct-Flow behavior and
  replay `session.flowId`.
- Explicit `undefined` must behave exactly like omission. Prefer conditional
  spread when constructing the callback input so the runtime object also keeps
  the prior absent-property shape.
- An empty string should remain equivalent to absence, matching the existing
  truthy checks used by result verification and `repair-rerun.ts`. It should
  not be introduced by Core, but forwarding logic should not redefine it as a
  real Subflow ID.
- A present but stale, missing, unreadable, or foreign `subflowId` must not
  fall back to the parent Flow. `repair-rerun.ts` already returns the typed
  `repair_rerun.subflow_*` decline or throws on ownership mismatch. Silent
  parent fallback would execute a different graph and conceal corruption.

The authoritative value is the `subflowId` already carried by
`AutomationStudioRuntimeSessionVerificationInput`. Inferring it from the run
detail's Subflow entries would be ambiguous when more than one entry exists
and would weaken the ownership proof already implemented by `changedFlow`.

## Exact implementation surface

Only two production edits are needed:

1. `runtime/result-verification/run-outcome.ts`
   - add optional `subflowId` to the `rerunRepairedFlow` callback input;
   - pass `input.subflowId` when present at the applied-reauthor branch.
2. `runtime/service.ts`
   - accept the callback's optional `subflowId`;
   - pass it to `rerunAfterRepair({ from: "start", ... })` when present.

`runtime/service/runtime-adaptation/repair-rerun.ts` needs no behavior change.
It already distinguishes direct versus Subflow replay, resolves the selected
Subflow's `graphFlowId`, checks parent ownership, updates only the selected
Subflow entry and graph version, and runs from the start.

## Test surface

### Success cases

1. In `result-verification/tests/run-outcome.test.ts`, extend the existing
   “runs the corrected Flow again and judges what it produced” case (or add an
   adjacent case) to call verification with `subflowId: "sub-1"` and assert the
   mock `rerunRepairedFlow` receives exactly that ID.
2. Add the complementary direct-Flow assertion: omit `subflowId` and assert
   the callback input does not acquire one. This pins undefined-to-parent
   compatibility.
3. Keep the real t240 service composition as the decisive integration test:
   assert the exact task-kind sequence is two negative verification calls,
   one reauthor provider call, and one successful post-apply verification;
   assert final success plus an `extend` adaptation in `applied` status.

### Failure cases

1. Existing result-verification coverage must continue to prove that no replay
   occurs when the reauthor was not applied.
2. A focused `repair-rerun` test is valuable for a present but missing Subflow:
   it should return `repair_rerun.subflow_absent` (or the corresponding typed
   unreadable code) and never read/run the parent Flow.
3. A focused ownership-mismatch test should continue to throw before graph
   execution; it must not fall back to the parent.
4. The t240 structured provider-failure case must retain exactly the original
   two verification calls plus the failed reauthor call, no replay call, and no
   raw provider response text.

The first three success assertions and existing no-apply failure assertion are
the minimum regression set for this fix. The direct `repair-rerun` failure
tests close an existing test-placement gap—there is currently no test file for
`repair-rerun.ts` under its owning `tests/` directory—but are not required to
change its already-correct implementation.

## Provider and accounting risk

The replay itself must remain deterministic and zero-provider:
`rerunAutomationStudioSessionAfterRepair` only reads the changed graph, runs
the canonical executor, and persists session/detail state. Forwarding a
Subflow ID must not resolve an LLM provider, create a new grant, or spend a
call.

One additional provider call after a successful replay is intentional and is
not replay cost: the recursive result-verification pass judges the replay's
answer. The expected successful composition therefore has four calls in
separate semantic buckets:

- two initial `loop_verification` calls establishing refutation;
- one `evidence_tool_decision` call authoring the extension;
- one post-replay `loop_verification` call confirming the repaired answer.

Risks and guards:

- Do not move provider resolution into `repair-rerun.ts`; keep it in recursive
  result verification so call records and budgets retain their existing owner.
- Assert exact task-kind order/count in the integration test. A loose
  “contains verification” assertion could hide duplicate judging.
- Preserve the one-repair marker carried in run-detail metadata. It prevents a
  second negative replay verdict from authoring again and bounds provider
  spending structurally.
- A failed deterministic replay must produce no post-replay provider call,
  because verification intentionally returns early for non-succeeded sessions.
- The same admitted grant remains in scope for the intentional fourth call;
  no grant mint/revoke boundary should be added between replay and recursive
  verification.

## Scope

Audited the t240 test, t245 analysis, exported/internal result-verification
types, service callback, repair-rerun implementation, and nearest tests only.
No source, test, or shared-document edits were made. No live, provider,
browser, Lab, build, or commit action was performed.
