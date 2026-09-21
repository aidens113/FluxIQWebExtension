# w2 multi-action diagnostics/callers slice

## Outcome

Complete. Core now derives Flow Bootstrap's total action allowance from the
same effective actions-per-decision value that controls the decision surface,
sanitizes and bounds multi-action traces without mistaking action rows for
provider calls, and accepts one optional run-scoped HTTP control. The Testing
Lab can select the exact same-code arms with
`--llm-max-actions-per-decision 1|16` on a live `create-flow` run.

The option is absent by default. Ordinary production and UI callers were not
changed and therefore retain the one-action schema/parser/executor behavior.
No provider, browser, UI, user state, global setting, or port was used.

## Diagnostics and accounting

- Flow Bootstrap trace sanitation moved from the oversized service into its
  diagnostics owner. It copies only categorical/bounded fields: iteration,
  decision, call/tool IDs, evidence byte count, `effectApplied`, `resultCode`,
  `targetsUnchanged`, batch position/size/stop, and already-sanitized usage.
  It never copies action inputs or evidence values.
- Action rows are bounded independently by the existing 64-action ceiling;
  Core decision rows remain bounded by the 64-iteration ceiling. The combined
  trace bound is consequently separate from either count.
- Provider calls and diagnostic `decisionCount` are the number of distinct
  positive iterations. Two batch action rows at iteration 1 count as one
  provider decision, while the deterministic iteration-0 observation counts
  as neither.
- At most one usage record is accepted per positive iteration. The service
  integration test records usage on batch action 1 only, no usage on action 2,
  and a separate usage record on the later completion decision.
- Public generation-failure steps retain bounded batch position/size/stop and
  target-stability facts alongside current effect/result codes. The downstream
  refusal projection retains the same categorical fields.

## Limits and caller control

- `automationStudioFlowBootstrapEvidenceLoopLimits` now emits
  `maxActionsPerDecision` and derives `maxToolCalls` as
  `min(maxIterations * maxActionsPerDecision + 1, 64)`. The extra one is the
  deterministic opening observation. Provider-call, token, cost, timeout, and
  unusable-decision limits are unchanged.
- Absent, non-finite, or non-positive helper input resolves to one and oversized
  helper input is capped at sixteen. Core's service and HTTP boundary reject
  non-integers and values outside 1–16, and reject the control unless
  evidence-guided generation is explicitly selected.
- The run-scoped value is forwarded through Core's request contract, API
  handler, service limit calculation, harness parsing/authentication, and loop.
  It is internal control metadata and is not model-visible.
- The Lab CLI accepts only the comparison arms 1 and 16, and only for
  `--live-llm --llm-task create-flow`. It threads the value through
  `runScenario`, the created-Flow lane, the generation client, and the HTTP
  request. No UI or durable/global setting was added.

## Focused proof

- The default service request still omits `tool_calls` from its decision
  schema.
- An explicit service value of 16 exposes the list schema, executes two
  ordered observations, records three trace rows across two provider
  iterations, assigns usage once to the batch iteration, and persists no raw
  page evidence.
- Limit tests pin default `maxToolCalls = maxIterations + 1`, enabled derived
  capacity, and the absolute 64-action cap.
- API tests pin exact forwarding plus fail-closed invalid/non-evidence values.
- Lab tests pin omitted behavior, explicit 1/16 request bodies, rejection of 2
  and non-create-flow use, and retention of bounded batch diagnostic fields.
- Accepted permission termination and same-iteration recovery-state tests were
  rerun unchanged in the final Core focused set.

## Files changed in this slice

Core:

- `runtime/service.ts` at the generation caller and trace-diagnostics seams
- `runtime/flow-bootstrap/generation-failure.ts` and its focused test
- `runtime/loop-limits/flow-bootstrap-evidence-loop.ts` and its focused test
- `api/contracts/adaptation.ts`
- `api/handlers/llm-generation.ts` and its focused test
- `runtime/tests/service-bootstrap/tests/generation.test.ts`

Downstream Testing Lab:

- `packages/test-runner/src/{commands,cli,run-scenario,existing-fluxiq-control}.ts`
- `packages/test-runner/src/flow-lane/creation/{lane,build-proposal}.ts`
- their focused command, build-proposal, and HTTP-client tests

The supervisor-owned shared working-document changes and all files from slices
1–3 were preserved and not attributed to this slice.

## Validation

- Core focused Vitest: 8 files, 130 tests passed, including accepted
  permission/state suites.
- Downstream focused Node tests: 3 files, 58 tests passed.
- `pnpm --filter fluxiq check`: passed.
- `pnpm --filter fluxiq build`: passed.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed.
- `pnpm --filter @fluxiq-web-extension/test-runner build`: passed.
- `git diff --check`: passed in both repositories.
- Both structure audits found no owned violation. They remain nonzero only
  because the supervisor-edited working document makes `docs/working/README.md`
  stale. Core additionally reports that the service file's existing baseline
  can now be lowered: the diagnostics extraction reduced it from 6,404 to
  6,377 lines.

No full suite, live run, provider call, browser run, commit, or push was
performed.

## Deferred by brief

The bounded live baseline/variant comparison, review of its user-visible Flow
and deterministic oracle, and any decision about production enablement remain
separate work. Receiving or executing a list is not by itself promotion
evidence.
