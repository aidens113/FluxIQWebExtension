# t027 Lab Batch Control

Status: Worker implementation complete; supervisor verification pending
Updated: 2026-09-20
Owner: w2-t027-lab-batch-control worker

## Result

The Lab's real created-Flow lane now accepts:

```text
--llm-max-actions-per-decision 1
--llm-max-actions-per-decision 16
```

The option is accepted only with explicit `--live-llm --llm-task create-flow`.
Any other integer, a non-integer, use without `--live-llm`, or use with another
LLM task is refused during command parsing before topology or provider work.

The selected value is carried outside the provider-budget profile into
`LiveLlmPlan`, printed by the provider-free dry-run description, and stored as
`maxActionsPerDecision` in `snapshots/live-llm.json`. The created-Flow build
authorizer then supplies it to the real Flow Bootstrap request as Core's
`maxActionsPerDecision` property. Omission preserves Core's existing default.

## Live commands for the supervisor

Use one frozen candidate and identical arguments except for this option:

```text
pnpm lab run <scenario> --target isolated --live-llm --llm-profile <profile> --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task <task> --llm-max-actions-per-decision 1 <identical-budget-options>
pnpm lab run <scenario> --target isolated --live-llm --llm-profile <profile> --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task <task> --llm-max-actions-per-decision 16 <identical-budget-options>
```

Before paid calls, append `--dry-run` to each command and compare the emitted
`live.maxActionsPerDecision` plus every other described plan field.

## Files changed

- `packages/test-runner/src/commands.ts`
- `packages/test-runner/src/cli.ts`
- `packages/test-runner/src/live-llm/live-llm-plan.ts`
- `packages/test-runner/src/live-llm/live-llm-run.ts`
- `packages/test-runner/src/flow-lane/creation/lane.ts`
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/existing-fluxiq-control.ts`
- This report

No Core, extension/domain, browser-test, or other working-document file was
edited by this worker.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed.
- No live, provider, browser, unit, or full-suite run was performed, per the
  brief and the live-first campaign order.
- No commit, merge, or push was performed.

## Supervisor follow-up

Review the diff against the paired Core request contract, then run the focused
Chromium proof and frozen real-provider A/B. In each resulting live snapshot,
confirm the requested `maxActionsPerDecision` value and inspect Core's evidence
loop call-by-call; the setting reaching the request is not itself proof that
the baseline stayed single-action or that a batch completed safely.
