# Brief t1057: no count ends a recovery

**Goal.** The recovery ledger still ends a recovery on counts: `maxActions` 24, `maxProviderCalls` 24,
`maxRepeatsPerAction` 2 and `maxRefusedActions` 2 (`packages/fluxiq/src/runtime/adaptation/recovery/**`; t1049's
report, "Decisions for you" 2). Since t1049 removed the progress guard, a circling recovery runs to its 24-call
allowance. The user's rule (AGENTS.md, "No arbitrary limit ends or resets a run"): no count ends a round. A repeat
is handled by loop detection and the model's own loop decision. Only the result, the purse or a person's Stop ends
a task. "Every node retries automatically" and "a stale target is found again from the step that found it" still
apply.

**Do.**
- Remove those four endings. A repeated action or a refused action now steers:
  - the model is told what it repeated or what was refused and why;
  - the loop decision follows.
- Never repeat a lasting act whose earlier attempt may have landed. That guard stays, because it is about safety,
  not a count.
- The recovery's spending comes from the task's purse; when the purse is gone, the recovery ends `budget_out` as
  today.
- Keep the ledger's records (what was tried, how often). They are evidence and steering input, never a stop.
- Delete result codes nothing produces any more.
- Model-facing words stay generic.

**Proof.**
- Provider-free tests that fail before the change: a recovery that repeats an action, is refused, or makes far
  more than 24 calls runs on, steered, until it recovers or the purse ends it.
- Update `iteration-guards`, `deepseek-recovery-requests` and every other test pinning the old allowances, and list
  them. In `deepseek-recovery-requests`, t1049 raised the test timeout to 60 s because its hang variant spent 24
  one-second timeouts. Make that variant end on its purse, and restore the timeout.

**Owned paths (Core).** `packages/fluxiq/src/runtime/adaptation/recovery/**` and its tests, the recovery tests under
`framework/**` that pin these allowances, Core `docs/architecture/` lines on them.
**Must not touch.** `runtime/llm/**`, `runtime/loop-limits/**`, `runtime/flow-authoring/**`,
`runtime/project-agents/**` (the loop-counts brief runs beside this one). No git, no paid runs, no `node -e`.

**Checks (heavy gate).**
- `pnpm --filter fluxiq check`.
- Vitest groups (parallel, real-sql) over `src/runtime/adaptation src/framework/automation-service`.
- Core audit.
- Downstream model-text.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1057.md`, ending with the return contract.
