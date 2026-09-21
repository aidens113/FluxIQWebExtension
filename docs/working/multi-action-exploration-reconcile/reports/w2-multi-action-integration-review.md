# w2 multi-action integration review

## Disposition

**Block integration of downstream `fab7cba` / Core `0dbf62f`.** The default-one
and Lab caller controls are correctly scoped, and the visibility/state/trace
design is substantially sound, but the candidate does not yet satisfy the
required whole-list budget admission or the complete refusal/input contracts.

This was a source-only review of the pinned commits and directly changed
product/tests. I did not run tests, a provider, browser, panel, or live A/B, and
made no product, test, shared-document, or git change.

## Findings

### High — runtime action and repeat budgets are not atomically preflighted

The batch runner preflights only the evidence loop's `maxToolCalls` and its own
epoch-based `answeredRequests` set
(`packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-batch/run.ts:149-167`).
Runtime recovery does not give the loop the run's actual `budget.maxActions`;
it gives it the global ceiling at
`runtime/recovery/runtime-exploration.ts:257-260`. The authoritative ledger is
then consulted separately for each item inside the execution wrapper at
`runtime/recovery/runtime-exploration.ts:223-232`, and the ledger mutates its
action/repeat counters on each admission
(`runtime/recovery/exploration-budget.ts:284-293`).

Consequently, with one action remaining, a two-item list can execute item 1
and only reject item 2. The same partial execution occurs when a later item
exceeds `maxRepeatsPerAction`; Core's batch repeat projection uses mutation
epochs, whereas the recovery ledger counts the action signature independently
of epoch. This violates the required complete-list budget/repeat check before
action 1 (`w2-multi-action-current-map.md:43-49`) and can leave a side effecting
prefix that was never admitted as a complete decision.

The focused atomicity test covers only `maxToolCalls: 1`
(`runtime/llm/tests/evidence-loop.test.ts:98-120`), not recovery-ledger action or
repeat admission. Remediation needs a read-only whole-batch admission/reservation
seam at the wrapped runtime boundary, with regression coverage proving the real
ledger rejects all items before any executor/state mutation.

### Medium — domain-classified refusals can continue within a list

The runtime wrapper classifies a domain `resultCode` and records the refusal in
the exploration ledger at `runtime/recovery/runtime-exploration.ts:239-250`.
The batch stop policy never receives that classification or `resultCode`; it
sees only evidence/effect fields
(`runtime/llm/evidence-batch/run.ts:101-103`) and recognizes refusal solely as
an object whose `ok` property is exactly false
(`runtime/llm/evidence-batch/stop.ts:6-19`). Before the ledger's refusal limit
is reached, a classified refusal whose evidence uses another closed shape—most
importantly an observing action—therefore permits the next listed action.

This is narrower than the current web rejection helper, which presently emits
`{ok:false}`, but it breaks Core's domain-neutral runtime contract and the
explicit requirement that any current domain-classified refusal/result stop
the list (`w2-multi-action-current-map.md:49`). The stop test covers only the
`{ok:false}` representation (`runtime/llm/tests/evidence-loop.test.ts:138-159`).
Carry a domain-neutral refusal verdict from the wrapper/transition into the
batch stop decision and test both refusal channels.

### Medium — local input validation silently weakens offered JSON Schemas

The local batch validator implements selected keywords and otherwise returns
success (`runtime/llm/evidence-batch/input-schema.ts:8-52`). It does not
implement or reject `uniqueItems`. The currently offered downstream
`web.press_control` input explicitly requires `uniqueItems: true` for its
consequence list
(`domain/src/runtime/llm-evidence/harness-options/options.ts:79-86`). A provider
result with duplicated consequences therefore matches the emitted schema only
in the provider's view but is accepted by Core's supposedly exact local
whole-list parser at `runtime/llm/evidence-loop.ts:616-629`.

More generally, an added schema keyword is fail-open unless this hand-written
matcher happens to know it. That conflicts with the strict tool-specific input
contract (`w2-multi-action-current-map.md:45,64`). Either validate against the
same complete schema implementation used to advertise the tool, or explicitly
reject unsupported schema keywords; pin the current `uniqueItems` case in the
batch parser tests.

## Reviewed contracts that appear correct

- Omission resolves to one action, omits the list schema/instruction, and the
  list parser rejects the disabled shape. The downstream CLI accepts only
  explicit `1`/`16` on live-LLM create-flow commands
  (`packages/test-runner/src/commands.ts:228-239`); ordinary panel callers do
  not opt in.
- Each executed item uses a Core-assigned collision-safe call ID and the shared
  singleton transition; provider usage is attached to only the first executed
  item (`runtime/llm/evidence-batch/run.ts:172-205`).
- Permission observation is bound to the exact published evidence window, so
  hidden intermediate action evidence is not independently permission-visible
  (`runtime/llm/evidence-batch/visibility.ts:3-19`,
  `runtime/llm/evidence-loop.ts:419-429`). Each action still crosses the
  permission and state wrappers independently.
- Non-applied mutations and applied mutations without explicit
  `targetsUnchanged:true` stop later actions. The bounded packet retains ordered
  receipts plus only the latest full evidence.
- Persisted diagnostics bound trace/action rows separately, count provider
  decisions by distinct positive iteration, and reject duplicate usage for an
  iteration (`runtime/flow-bootstrap/generation-failure.ts:364-391`).

## Live-only unknowns

This review cannot establish whether DeepSeek emits a useful list, whether the
variant completes two stable actions, whether either arm creates and executes a
valid Flow, or whether the measured variant improves elapsed time/calls. Those
remain exclusively the same-code live A/B acceptance at
`w2-multi-action-current-map.md:86-104`. Even a conjunctive live pass would not
remove the source-level blockers above.
