# t174 — Remaining grant gates

Status: Complete

## Outcome

Neither t166 handoff I nor handoff J blocks the exact
`everything-store-plus-earbuds-under-50` live path in the current checkout.
No source fix is required before that measurement.

The lane deliberately uses two grants:

1. A `build_and_adapt` grant authors the initial Flow through the generation API.
2. After the proposal is applied, a newly issued `explore_and_adapt` grant runs the
   Flow, judges its result, and owns any refuted-result re-authoring.

That separation makes the initial build grant's revocation harmless to this lane,
and the repair's generation call is a direct service call in `mode: "extend"`, not
the build-only generation HTTP handler.

## What changed and why

Only this report was added. The source trace supporting the verdict follows.

### Exact current call path

### Initial authoring

- `packages/test-runner/src/live-llm/live-llm-run.ts:312-318` authorizes the build
  from the run plan, which must have purpose `build_and_adapt`.
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts:260-275` saves the
  instruction, obtains that grant, and calls `generateFlowBootstrapAdaptation`.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-generation.ts:101-123`
  inspects exactly a `build_and_adapt` grant and forwards that same purpose to the
  service. Handoff I is therefore not reached as a mismatch during this scenario's
  initial build.
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts:1715-1717`
  revokes that build grant when generation finishes. This is handoff J, but the
  lane has no later consumer for that grant.

### Playback and wrong-answer repair

- `packages/test-runner/src/live-llm/live-llm-run.ts:82,241-242,333-340` defines a
  created Flow's repair purpose as `explore_and_adapt` and authorizes a fresh grant
  for playback.
- `packages/test-runner/src/flow-lane/creation/lane.ts:252-280` applies the authored
  proposal first and only then asks `authorizeRun` for that separate grant.
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:457-464` sends the new
  grant to `run-runtime-session` as `runIntent: "explore_and_adapt"`.
- When result verification refutes the answer,
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts:2635-2644`
  calls `this.generateFlowBootstrapAdaptation` directly with `mode: "extend"` and
  the run's `explore_and_adapt` grant. It never passes through
  `api/handlers/llm-generation.ts`, so handoff I's build-only API check is not on
  the repair path.
- `runtime/service.ts:1715-1717` expressly does not revoke an
  `explore_and_adapt` grant when that extend call finishes. The grant remains alive
  for the containing run and is revoked only in the runtime-session `finally` at
  `runtime/service.ts:2858-2864`, after repair, apply, rerun, and result verification
  have completed or the run has failed.

The service-level contract is also explicit in
`runtime/tests/service-bootstrap/tests/extend.test.ts:258-280`: an exploring grant
is rejected at the creation door without `mode: "extend"`, while the same purpose
successfully authors and applies an extend in place when the mode is present.

### Residual reachability and smallest fixes

These gates still exist, but only outside this exact lane:

- **Handoff I remains reachable** if a caller tries to use an
  `explore_and_adapt` grant through the public `generate-flow-bootstrap-adaptation`
  endpoint. The handler hard-codes `purpose: "build_and_adapt"`, and
  `runtime/llm/execution/grants.ts:364-373,761-763` treats a purpose mismatch as a
  scope mismatch and revokes the grant. The smallest correct fix is not to retry
  inspection with two literals (the first mismatch destroys the grant). Extend the
  grant service with one inspection operation accepting a closed set of purposes,
  validate the stored grant's purpose is in that set before any revocation, then
  have the handler forward the inspected purpose. Cover both accepted purposes and
  a truly disallowed purpose in `api/handlers/tests/llm-generation.test.ts`.
- **Handoff J remains reachable** for any workflow that expects a
  `build_and_adapt` grant to survive the generation call. The smallest safe fix is
  to remove grant revocation from `generateFlowBootstrapAdaptation` and end the
  lease at the owning workflow boundary instead. That requires an explicit owner
  for standalone HTTP builds; merely deleting the `finally` would leak failed or
  abandoned build grants. The present Lab lane does not need this because its
  authoring and playback/recovery grants are intentionally separate.

## Commands run and observed results

- Read the assigned current state, t166 handoffs I/J, the relevant Core handler,
  grant store, runtime service, tests, and the downstream live-lane callers.
- `git diff --check -- docs/working/mvp-today-plan/reports/t174-remaining-grant-gates.md`
  passed with no output.
- No build, test, Core mutation, or live Lab run was performed, as assigned.

## Not verified

The verdict is a static call-path result for the current checkout. Real-provider
behavior remains to be measured by the supervisor's live run.

## Open questions or contradictions found

No release-blocking mismatch was found for the named scenario. Handoffs I and J
remain policy/lifecycle inconsistencies for other callers, with the smallest safe
fixes recorded above; neither should delay this measurement.

## Files

- Added only `docs/working/mvp-today-plan/reports/t174-remaining-grant-gates.md`.
