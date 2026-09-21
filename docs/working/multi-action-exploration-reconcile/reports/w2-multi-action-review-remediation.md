# w2 multi-action review remediation

## Outcome

Complete. All three integration-review findings are remediated in the paired
t033 Core worktree with focused real-ledger proof. The production/default-one
control, downstream product and Lab caller, accepted diagnostics, and live A/B
state were not changed.

No provider, browser, panel, live run, full suite, git-history operation, or
shared `dev` action was performed.

## Whole-list recovery admission

`AutomationStudioExplorationBudgetLedger.preflightActions` now projects both
the remaining action count and per-signature repeat attempts across the entire
list without charging an action. The evidence batch invokes the caller-owned
admission seam only after its existing eligibility/repeat/evidence checks and
before allocating or executing action 1.

Runtime recovery supplies the authoritative ledger projection. Ordinary
`admitAction` remains the sole charging path for both singleton and batch
items, so a list rejected at preflight has zero actions/steps/tool calls, while
a list stopped dynamically after an executed item still records only what was
actually attempted.

Focused real-runtime tests prove:

- two actions against one remaining ledger action execute no prefix and finish
  as `action_limit`, with zero actions, steps, and loop tool calls;
- a list whose later signature would exceed `maxRepeatsPerAction` executes no
  batch prefix, even when an earlier mutation makes Core's own epoch-based
  repeat rule permit the decision;
- singleton budget charging remains on the existing path.

Owners: `runtime/recovery/exploration-budget.ts:296-316`,
`runtime/recovery/runtime-exploration.ts:263-275`,
`runtime/llm/evidence-batch/run.ts:148-173`, and
`runtime/recovery/tests/runtime-exploration.test.ts:285-319`.

## Domain-classified refusal

The structured execution result now has an optional domain-neutral `refused`
verdict. Runtime recovery attaches it only after its existing domain-owned
`resultCode` classifier returns a refusal; the generic batch stop rule consumes
that verdict before considering effect/stability. Existing recoverable
`{ok:false}` evidence remains an independent refusal channel.

The runtime proof returns observing evidence shaped as
`{status:"outside_scope"}` with a classified refusal result code. Action 1 is
recorded/refused, the trace records `stoppedBy:"refusal"`, and action 2 is not
executed. The loop test separately pins both the classified flag and
`{ok:false}` channels.

Owners: `runtime/recovery/runtime-exploration.ts:239-254,500-507`,
`runtime/llm/evidence-loop.ts:106-114,575-584`,
`runtime/llm/evidence-batch/{run.ts:85-128,stop.ts:6-21}`, and focused tests at
`runtime/recovery/tests/runtime-exploration.test.ts:321-344` and
`runtime/llm/tests/evidence-loop.test.ts:164-185`.

## Closed input-schema matching

The local batch matcher now implements `uniqueItems` with structural JSON
equality (including object-key-order independence). It also rejects every
schema keyword outside its explicit supported set instead of silently ignoring
an advertised constraint. Malformed `enum`/`oneOf`/`anyOf` containers now fail
closed as part of the same boundary.

Focused contract proof accepts a unique consequence list, rejects duplicate
consequences, and rejects an unsupported constraint. The evidence-loop proof
puts the duplicate declaration in item 2 and verifies the complete decision is
rejected with zero executor calls/tool calls.

Owners: `runtime/llm/evidence-batch/input-schema.ts:8-89`,
`runtime/llm/evidence-batch/tests/contract.test.ts:98-111`, and
`runtime/llm/tests/evidence-loop.test.ts:138-162`.

## Validation

- Focused Core tests: 5 files, 93 tests passed.
  - evidence-batch contract: 6
  - evidence loop: 38
  - runtime exploration: 36
  - runtime permission: 7
  - exploration state record/reduction: 6
- `pnpm --filter fluxiq check` passed.
- `pnpm --filter fluxiq build` passed.
- `git diff --check` passed; only line-ending notices were printed.
- Scope audit: nine Core product/test files changed, all inside the brief's
  owned evidence-batch/evidence-loop/recovery seams, plus this downstream
  report. No generated build output is tracked.

The first focused-test invocation used repository-relative paths after pnpm had
already changed into the package and therefore found no tests; rerunning with
package-relative paths produced the 93-test pass above. This was command-path
correction, not a product failure.

## Remaining boundary

Source remediation is complete, but integration still requires independent
rereview. The same-code live baseline/variant remains intentionally unverified
and must resume only after that rereview; this report makes no claim about
provider list usefulness, saved-Flow validity, deterministic execution, elapsed
time, or call reduction.
