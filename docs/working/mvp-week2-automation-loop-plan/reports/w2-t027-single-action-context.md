# t027 single-action provider context repair

Status: Complete; live baseline passed
Updated: 2026-09-20
Worker: `w2-t027-single-action-context`

## Result

The single-action baseline now reaches the real provider, creates a Flow, runs
it in isolated Chromium, and passes the scenario oracle. The repair is confined
to Core's DeepSeek evidence-loop context validator plus its focused provider
test. No main-task source, user panel state, or stored user data was changed.

Passing live run: `run-muafvw5y-b6ec972e`

## Exact cause

The evidence loop correctly built its decision schema with
`allowMultipleToolCalls=false` when `maxActionsPerDecision=1`. DeepSeek's
pre-send context validator reconstructed the schema by calling
`buildAutomationStudioLlmEvidenceLoopDecisionSchema` without that argument, so
it compared the single-action schema against Core's default multi-action
schema. The mismatch produced
`flow_bootstrap.provider_evidence_loop_context_invalid` before the HTTP call in
failed run `run-muafn7g4-81347d25`.

The validator now accepts exactly either canonical schema Core itself builds:
single-action or multi-action. It still rejects an arbitrary or altered
decision schema.

## Files changed in the isolated Core worktree

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek-provider.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-provider.test.ts`

The test adds a DeepSeek transport check for the canonical single-action
schema. It also updates the pre-existing default-schema assertion to include
the `tool_calls` variant introduced by t027 batching.

## Live-first validation

The identical real-provider baseline was rerun before adding or running the
unit regression:

- Frozen downstream base: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Frozen Core base: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`, plus the two-file repair above
- Target: isolated Chromium, `social-scheduler` /
  `social-scheduler-schedule-post`
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: `1`
- Result: evaluation `passed`, oracle `passed`, reported verdict `passed`
- Flow created: yes
- Provider decisions/calls: 4
- Exploration tool calls: 3, one per decision as configured
- Playback browser actions: 9
- Input/output/total tokens: 39,815 / 935 / 40,750
- Estimated cost: USD 0.0187528
- Build duration: 37,483 ms
- End-to-end evaluation duration: 181,607 ms
- Permission/refusal/failure stop: none

The credential was supplied only to the live process. It was not printed,
persisted in this report, or copied into either worktree.

## Focused automated validation after live success

- Core build: `pnpm --filter fluxiq build` -> passed.
- First focused provider-test run: 6 passed, 1 failed because the older default
  assertion omitted t027's already-present `tool_calls` schema variant.
- After correcting that assertion:
  `pnpm exec vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop-provider.test.ts --no-file-parallelism`
  -> 7 passed.

No broad or full test suite was run. No commit, merge, or push was performed.

## Integration note

The supervisor should port or integrate the two Core file changes into the
active paired t027 task, verify the diff, and rerun the affected live A/B lane
after composing it with any newer t027 work. This result removes the baseline's
provider-request blocker; it does not by itself compare baseline performance
against the multi-action lane.
