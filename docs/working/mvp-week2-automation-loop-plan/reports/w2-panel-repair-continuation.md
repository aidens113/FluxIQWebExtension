# W2 Panel Repair Continuation

## Status

`BLOCKED` at the first provider repair terminal boundary. The real panel presented the controlled runtime failure and completed the one authorized diagnosis-and-patch attempt, but the run produced no durable repair adaptation or change proposal. Review/apply, passing rerun, restart, and zero-provider saved reuse therefore could not be exercised without retrying the model decision. No provider retry was made.

## Scope and environment

- Downstream: `F:\fxlab\t027-panel\!FluxIQWebExtension`
- Core: `F:\fxlab\t027-panel\!FluxIQ` (read-only during this continuation)
- Isolated evidence/workspace: `F:\fxlab-runs\t027-panel-live`
- Isolated ports: panel `3357`, fixture `4927`; both were closed after the run
- User port `3000`, user panel state, and user data were not touched
- Continuous project, generated Flow, selected Router/Subflow, and bootstrap adaptation identity were preserved through readiness and the failed repair run. No source repair adaptation ID was created.

## Live-first progression

1. The first readiness run stopped with `adaptation_readiness.topology_invalid` because the downstream driver still required exactly one graph-backed owned Subflow. The generated Flow validly contains a primary graph and a Router-selected utility graph.
2. The readiness driver was narrowed to choose the Router-selected Subflow from the newest successful zero-provider deterministic baseline, require a matching Subflow run entry, and inspect that exact graph. The real readiness path then passed with a four-node, three-edge selected graph, three adaptable targets, and zero provider calls.
3. The first repair launch induced controlled drift and opened the production Runtime Debug UI, but waited at the high-token confirmation modal. Persisted state showed no new run/adaptation and zero provider calls, so this was a driver wait, not a model attempt.
4. The panel driver was updated to detect `Confirm high-token LLM Execution`, record only a bounded observed flag, and activate `Continue high-token execution` while the response listener remained active. The next live run visibly proved that dialog path.
5. A settings-only execution-digest change exposed a second stale driver assertion: it incorrectly required a reverted target adaptation before any ordinary runtime adaptation existed. The assertion now permits only that bounded settings-only drift; ordinary adaptation mismatches still require the exact reverted target.
6. The one authorized provider repair run then visibly executed the intended failure: `web.dom.type` failed, surrounding snapshots succeeded, and the panel response completed. It stopped at `exploration_adaptation_run.proposal_identity_invalid` because no exact repair proposal was created.

## Terminal evidence

- Evidence run: `demo-llm-exploration-adaptation-2026-09-21T01-06-07-932Z-6d4072`
- Run activation: `01:06:15.827`
- High-token confirmation observed: `01:06:16.663` (about `0.84 s` after activation)
- Intended type action: `01:06:22.280` to `01:06:23.388`, terminal `failed`
- Panel response complete: `01:06:34.881`
- Run-to-response time: about `19.1 s`
- Terminal code: `exploration_adaptation_run.proposal_identity_invalid`
- Provider calls: `2`, the bounded diagnosis call plus patch call for this single repair decision
- Action attempts: `1`; failed actions: `1`; interventions: `2`
- New adaptation IDs: `0`; new change-proposal IDs: `0`; runtime-patch attempts: `0`
- Bounded runtime-patch diagnostic codes: none
- The earlier modal wait used zero provider calls and was not a provider retry.

The existing bootstrap adaptation remained the only adaptation. Because the single provider decision returned no durable repair proposal, proceeding to review/apply would have required fabricating an identity or retrying the model. Both are outside the brief and would invalidate the continuity proof.

## Downstream-owned corrections

- `packages/test-runner/src/demo-llm-adaptation-readiness.ts`
  - Selects the newest valid deterministic baseline and its Router-selected graph-backed Subflow instead of requiring a single graph-backed Subflow globally.
- `packages/test-runner/src/demo-workspace/adaptation-ui.ts`
  - Handles the real high-token confirmation dialog inside the response-listener lifetime and emits only a closed observed diagnostic.
- `packages/test-runner/src/demo-workspace/exploration-adaptation.ts`
  - Distinguishes bounded settings-only digest drift from an ordinary adaptation mismatch.
- `packages/test-runner/src/tests/demo-llm-adaptation-readiness.test.ts`
  - Supplies the durable Router/Subflow binding exercised by the readiness contract.
- `packages/test-runner/src/demo-workspace/adapting-run/tests/run-timeouts.test.ts`
  - Covers the asynchronous response dispatch and high-token confirmation path while preserving the adapting-run timeout assertion.

No Core source was edited in this continuation.

## Focused validation after live testing

Executed only after the live terminal boundary:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/tests/demo-llm-adaptation-readiness.test.js packages/test-runner/dist/tests/demo-llm-exploration-adaptation.test.js packages/test-runner/dist/demo-workspace/adapting-run/tests/run-timeouts.test.js
```

Result: build passed; `25/25` tests passed, `0` failed.

No broad suite, commit, or push was performed.

## Next exact owner

The next investigation must remain at the provider repair-result boundary: determine why the completed bounded diagnosis-and-patch decision persisted neither an adaptation nor a change proposal. It must use a fresh explicitly authorized provider attempt; this lane intentionally did not retry.
