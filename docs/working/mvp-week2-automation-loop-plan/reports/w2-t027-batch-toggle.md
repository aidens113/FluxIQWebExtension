# t027 Same-Code Batching Toggle

Status: Worker implementation complete; supervisor verification pending
Updated: 2026-09-20
Owner: w2-t027-batch-toggle worker

## Result

The paired t027 Core worktree now exposes a real Flow Bootstrap request seam:

```ts
maxActionsPerDecision?: 1 | 16
```

`1` is the single-action baseline. It removes the `tool_calls` variant from
the evidence-decision schema and defensively reduces any forgivingly parsed
list to its first action before execution. `16` permits the existing bounded
ordered batch. Omitting the field preserves the existing batch-enabled
default.

The chosen value also sizes Flow Bootstrap's tool-call allowance, so the
single-action baseline receives one action per provider decision while the
batch candidate is not accidentally stopped by the former one-call-per-turn
calculation. Existing batch execution, refusal, permission, mutation,
target-continuity, evidence, and no-progress stops are unchanged.

## Live configuration path

Send `maxActionsPerDecision` on the existing
`generateFlowBootstrapAdaptation` API request together with
`evidenceGuided: true`:

- baseline lane: `maxActionsPerDecision: 1`
- batching lane: `maxActionsPerDecision: 16`

The API contract and handler validate that only `1` or `16` is accepted and
that the setting is used only for evidence-guided generation. The handler
passes it to `AutomationStudioService.generateFlowBootstrapAdaptation`, which
passes it to both `automationStudioFlowBootstrapEvidenceLoopLimits` and
`runAutomationStudioLlmEvidenceLoop`.

## Files changed by this worker

- Core `runtime/llm/evidence-loop.ts`
- Core `runtime/loop-limits/flow-bootstrap-evidence-loop.ts`
- Core `runtime/service.ts`
- Core `api/contracts/adaptation.ts`
- Core `api/handlers/llm-generation.ts`
- This downstream report

All pre-existing uncommitted t027 multi-action files and edits were preserved.

## Validation

- `pnpm --filter fluxiq build` from `F:\fxwork\t027\!FluxIQ`: passed.
- No live/browser/provider run was performed, per the brief.
- No unit or full suite was run, per the live-first plan and brief.
- No commit, merge, or push was performed.

## Supervisor follow-up

Thread the request property through the downstream Lab scenario configuration,
then run the same frozen candidate and task with values `1` and `16`. Inspect
the emitted decision schema and evidence trace to confirm that the baseline has
one executed action per provider iteration while the candidate completes at
least one batch of two or more actions without crossing a safety stop.
