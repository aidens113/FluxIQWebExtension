# w2-panel-evidence-runtime-binding

Status: live path passed through generation, apply, and deterministic execution; later broad golden stages were not run.

## Validation pair

- Downstream: `F:\fxlab\t027-panel\!FluxIQWebExtension` at pinned base `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`.
- Core: `F:\fxlab\t027-panel\!FluxIQ` at pinned base `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`.
- Isolated ports: panel `3357`, gateway `4927`; both closed after validation. User port 3000 was not touched.
- Evidence root: `F:\fxlab-runs\t027-panel-live` (ignored run data; no credentials or page data are included here).

## Live-first result

1. Closed pre-provider diagnostics narrowed the original generic failure through `flow_bootstrap.harness_preflight_failed` to `flow_bootstrap.pre_provider_request_total_exceeded` with provider-call count zero.
2. Root cause was Core web authoring issuing the obsolete exploration grant profile `8k/4k/12k` while the prepared Flow and Core grant defaults used `48k/8k/56k`. The web request now uses `48,000/8,000/56,000` plus the matching `560,000` run budget.
3. Real panel run `demo-llm-explore-2026-09-21T00-22-44-392Z-fdf63b` reached the visible high-token confirmation, executed three successful snapshot tools, received HTTP 200, showed no generic visible error, and produced a reviewable proposal. Confirmation-to-response was about 10.7 seconds; request-to-proposal was about 11.6 seconds. This generation used exactly one provider call.
4. Apply initially exposed two driver defects: an exact-role table locator counted hidden/inactive rendered tables, and the driver clicked Audit before `get-flow-adaptation` completed and reset the view to Summary. The visible-table scope and exact detail-response wait progressed the real UI through Select, Audit, Approve, and Apply Changes. Apply reused the persisted proposal and made zero provider calls.
5. Post-apply inspection then reported `exploration_apply.subflow_topology_invalid`. Bounded inspection proved this was not preexisting state or reconciliation duplication: the proposal itself contained patch kinds `edit_router`, `create_subflow`, `create_subflow`, with three applied mutations. Persisted topology was one active primary/fallback Subflow plus one active utility/rule-target Subflow. That is valid under Core's multi-Subflow bootstrap contract; the Lab's exact-one-Subflow invariant was stale.
6. The Lab now requires at least one graph-backed Subflow and exactly one primary, and its bound run validates the Subflow selected by the durable Router decision rather than assuming the primary is selected. The real UI continuation then passed: zero provider calls, zero interventions, four of four browser actions succeeded, owned routing was true, manifest final state was checked, and recording count remained zero.

## Scoped integration set

Downstream files (cumulative scoped driver changes from this serial live lane):

- `packages/test-runner/src/demo-llm-blank-workspace.ts`
- `packages/test-runner/src/demo-llm-create-ui/adaptation-lifecycle.ts`
- `packages/test-runner/src/demo-llm-create-ui/apply-proposal-ui.ts`
- `packages/test-runner/src/demo-llm-create-ui/explore-proposal-ui.ts`
- `packages/test-runner/src/demo-llm-create-ui/tests/adaptation-lifecycle.test.ts`
- `packages/test-runner/src/demo-llm-create-ui/tests/exploration.test.ts`
- `packages/test-runner/src/demo-workspace/bound-exploration.ts`
- `packages/test-runner/src/panel-golden-path/lane.ts`
- `packages/test-runner/src/tests/demo-llm-prepare.test.ts`

Core files:

- `apps/web/src/features/automation-studio/authoring/blank-flow-authoring-model.ts`
- `apps/web/src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx`
- `apps/web/src/lib/fluxiq.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/generation-failure.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`

## Focused checks after live progression

- Downstream test-runner build: passed.
- Downstream directly owned tests: 22/22 passed (`adaptation-lifecycle`, `exploration`, bound exploration request, blank preparation).
- Core web authoring: 16/16 passed.
- Core generation-failure diagnostics: 44/44 passed.
- Core evidence-guided bootstrap exploration: 8/8 passed.
- No broad or full test suite was run.

No source commit or push was made. Provider credentials were loaded only into child-process environments and were not printed, persisted, or included in this report.
