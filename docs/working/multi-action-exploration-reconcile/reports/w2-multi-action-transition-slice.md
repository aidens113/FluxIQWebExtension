# w2 multi-action transition slice

## Outcome

Complete. Core now accepts and executes the canonical ordered `tool_calls`
decision only when one explicit test-level `maxActionsPerDecision` value is
greater than one. The effective default remains one, no production caller opts
in, and the current singleton transition remains the same path used by a list
item.

No service, permission, recovery/state, Flow Bootstrap caller, downstream
product, provider/browser, user-state, shared-document, or git-history change
was made by this worker. No provider call was made.

## Implemented transition

- `maxActionsPerDecision` now reaches the evidence-loop schema and parser, the
  harness request/parser, and DeepSeek's recomputed schema authentication. The
  request field is internal control metadata and is not placed in the model's
  context/user payload.
- Default one still omits the `tool_calls` schema variant, rejects list output,
  emits no multi-action system instruction, and leaves the request field absent
  unless a caller explicitly supplies it.
- Enabled lists are parsed as 2-16 calls against the exact tools eligible for
  that iteration and each tool's closed input schema.
- `runtime/llm/evidence-batch/run.ts` owns a shared current action transition
  used by singleton and list decisions. It preserves call/request bookkeeping,
  action and evidence accounting, mutation and observation epochs, evidence
  publication, trace fields, cancellation/tool failures, and current singleton
  behavior.
- Whole-list preflight is read-only: it checks the remaining action allowance,
  projected current repeat signatures/epochs, and a conservative evidence
  allocation that reserves all action results plus the bounded packet before
  action 1. A bad later tool/input, an identical same-epoch repeat, insufficient
  action budget, or insufficient evidence budget executes zero actions and does
  not mutate repeat/action/evidence accounting.
- Core assigns every listed action a collision-safe ID. The synthetic
  `core.batch_result` evidence entry uses the same namespace and allocator, so
  prior singleton IDs cannot collide with either action or packet IDs.
- Provider usage is charged once for the list decision and appears on only the
  first executed action trace row.
- Actions execute in authored order in one provider iteration. Observations may
  continue. A recoverable `{ok:false}` refusal, a non-applied mutation, or an
  applied mutation with missing/false `targetsUnchanged` records the action and
  stops every later listed action. An applied mutation continues only with
  explicit `targetsUnchanged:true`.
- The next decision receives one bounded `core.batch_result` containing ordered
  compact receipts and only the latest full action evidence. Raw intermediate
  action evidence is not published into the model evidence list.

## Focused proof

The focused tests pin:

- default-one schema/parser/executor refusal and unchanged singleton fixtures;
- explicit harness/DeepSeek schema authentication and non-model-visible control;
- exact tool-specific list inputs and later-item atomic rejection;
- action/evidence ceilings and identical same-epoch repeat rejection before any
  side effect;
- authored execution order, one provider iteration, collision-safe Core action
  and packet IDs, and provider usage exactly once;
- refusal, non-applied mutation, missing stability, and false stability stops;
- continuation for observations and for applied mutations with explicit stable
  targets;
- bounded `core.batch_result` receipts/latest evidence.

## Core files changed in this slice

- `runtime/llm/evidence-loop.ts`
- `runtime/llm/evidence-batch/input-schema.ts`
- `runtime/llm/evidence-batch/packet.ts`
- `runtime/llm/evidence-batch/run.ts`
- `runtime/llm/evidence-batch/stop.ts`
- `runtime/llm/evidence-batch/index.ts`
- `runtime/llm/harness/run.ts`
- `runtime/llm/harness/task-request.ts`
- `runtime/llm/deepseek-provider.ts`
- nearest `evidence-loop` and `evidence-loop-provider` tests

The contract-slice files already present in this same uncommitted task worktree
remain part of slice 1. The existing modification to Core's shared working
document belongs to the supervisor and was not edited by this worker.

## Validation

- Focused Vitest: 7 files, 101 tests passed.
- `pnpm --filter fluxiq check`: passed after the final extraction.
- `pnpm --filter fluxiq build`: passed after the final extraction.
- `git diff --check`: passed.
- `pnpm structure:check`: no owned structural violation. It remains nonzero
  only because the supervisor-edited `docs/working/multi-action-exploration-reconcile.md`
  makes `docs/working/README.md` stale; the brief forbids editing either shared
  document/index. The first audit exposed owned 800-line limits in
  `evidence-loop.ts` and `deepseek-provider.ts`; extracting the cohesive shared
  action/batch runner and compacting the provider wiring removed both failures.

No full suite, live browser/panel run, external provider call, commit, or push
was performed.

## Deferred by brief

Permission visibility, durable per-action state/reduction, recovery integration,
trace sanitation/service diagnostics, Flow Bootstrap limit derivation, and any
production caller opt-in remain for later slices. This slice does not claim
those behaviors.
