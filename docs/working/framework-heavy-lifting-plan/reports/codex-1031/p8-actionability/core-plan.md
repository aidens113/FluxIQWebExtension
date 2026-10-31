# t827 Core actionability propagation plan

Status: read-only discovery complete; no source edit or test/build/typecheck. Waiting for lead interface release and exact implementation ownership. Core source root is `C:/Users/osrs_/FluxStuff/fxwork/t827/!FluxIQ`; `AS/` below means `packages/fluxiq/src/programs/automation-studio/`.

## Decisions

Keep the frozen `AutomationStudioTargetActionabilityRecord` and strict parser. The only browser wire carrier is existing `ClientGatewayActionResult.payload.actionability`. A host lifts a fresh validated copy only after the gateway has accepted/received the raw result. Never enrich the raw result passed to durable ingress, receipt digesting or browser reconciliation.

The fact is an observation of the exact target for this performed call. Preserve it independently of dispatch/confirmation success, failure, actual effect, permission, person-needed facts and recorded-condition readiness. Neither branch grants retry/skip/readiness/success authority. Do not add it to authored node metadata, persisted draft definitions or opaque model evidence.

Use strict own-data extraction for optional metadata: descriptors avoid invoking an `actionability` getter, the public parser rejects malformed/extra/private fields, and a fresh top-level result copy removes only bad optional actionability. Preserve all other actual result descriptors/fields. A malformed optional fact must never erase the call, outputs, status, failure or withholding behavior.

## Verified loss boundaries

| Owner | Current behavior and required change |
| --- | --- |
| `packages/fluxiq/src/runtime/client-gateway-transport.ts` | `dispatch` has distinct durable `outcome.result` and ordinary awaited exits. Lift from the accepted raw payload on both exits into a separate host result. Keep the ordinary failure/cleared-wait normalization and durable receipt handling as they stand. |
| `packages/fluxiq/src/runtime/service.ts` | Adapter/transport results flow to `settleAttempt`, emitted completion and return. Normalize optional top-level actionability before those three consumers, including direct adapters, so invalid/accessor metadata cannot reach persisted command attempts. |
| `packages/fluxiq/src/runtime/attempt-withholding.ts` | `withheldResult` spreads a result and only rewrites existing data-bearing fields. The new closed boolean/cause fact survives if normalized before this function; no withholding source change is needed. Test both payload-withheld and resolved-value-withheld paths. |
| `AS/runtime/io-policy.ts` | Both IO and RuntimeService dispatchers construct explicit node results, separately returning success or `failedDispatchResult`. Carry validated top-level actionability on both exits. A succeeded dispatch followed by failed confirmation must retain the target observation beside the confirmation failure, without copying it into failure/effect claims. Keep opaque `outputs.result` as returned. |
| `AS/nodes/contracts.ts` | `AutomationNodeExecutionResult` currently has no actionability member. Add the optional observation field, independent of its status/failure and cleared wait. This is a performed result contract, not an authored node definition. |
| `AS/runtime/native-node-runtime.ts` | `AutomationStudioNativeExecution.result` uses `AutomationNodeExecutionResult`; normal `execute` returns the implementation result after output/effect validation. Normalize only its optional actionability before returning, retaining all actual outputs/logs/declared ports and native authorization behavior. Do not derive it from definition/node metadata or generated failures. |
| `AS/runtime/executor/node-execution/attempt.ts` | `dispatchAutomationStudioEffects` explicitly merges dispatch outputs, target resolution and failure. Preserve the latest target dispatch's validated observation on both success/failure merges and the `notSentResult`/`outcomeUnknownResult` reconstructions, without changing the stronger act/receipt failures. A subsequent `policy.output.dispatch` with no observation clears the older top-level observation; internal `records.write` effects do not report another target and preserve the last target dispatch's fact. Test this multi-effect distinction so one target's observation is never attributed to a later unobserved target. |
| `AS/runtime/executor/attempt-trace.ts` | `nodeAttemptFromResult` explicitly builds `AutomationStudioNodeAttemptTrace`. Strictly read the optional result observation here on success, failed and waiting attempts; do not drop it merely because a failure is dropped on success. Ignore authored metadata that happens to name actionability. |
| `AS/runtime/executor/contracts.ts` | Add optional actionability to `AutomationStudioNodeAttemptTrace`. Existing `readiness` at lines496+ is a different recorded-condition result and remains unchanged. |
| `AS/model/flow-adaptation.ts` and `AS/runtime/service/summaries/conversions.ts` | `AutomationStudioFlowRunActionAttemptRecord` and `runtimeActionAttemptRecord` explicitly define/rebuild public per-call run history. Add the field to the record and strictly reparse it when converting a stored session trace. Preserve the original attempt's status/settled route and failure. |
| `AS/runtime/llm/evidence-loop.ts` and `.../evidence-loop/trace.ts` | Add optional actionability to the per-call human trace row, and carry actual parsed execution facts at normal/iteration0 row creation. Do not add it to draft definitions, model decision-context history/evidence values or repeat/refusal/retry policy. |
| `AS/runtime/flow-bootstrap/evidence-loop-steps.ts` | `AutomationStudioFlowBootstrapEvidenceStep`, `automationStudioFlowBootstrapEvidenceStep`, `EVIDENCE_STEP_FIELDS`, and `parseEvidenceSteps` all reconstruct/close the row. Add the optional field to every one. Invalid optional actionability drops alone; it must not reject the completed build/diagnostic. |
| `AS/runtime/service/flow-bootstrap-commands/evidence-trace.ts` | `sanitizeEvidenceLoopTrace` explicitly projects stored authoring rows. Strictly retain the observation here as well; otherwise persisted accepted builds silently lose it before step publication. |
| `AS/runtime/llm/evidence-progress/tool-execution-control.ts` | The existing helper returns early without a failure descriptor. Extend it to independently project/remove optional actionability even when failure is absent; preserve failure sanitation. It already runs before the step-log wrapper and the direct dump serializer. Never invoke an actionability getter or mutate producer input. |

The native and runtime attempt paths are actual recording consumers, not unused type additions. Storage itself need not acquire a new schema or receipt member: runtime command results are copied by `withheldResult`/`cloneCommandAttempt`, executor traces are formed from validated results, and public run/authoring rebuilders reparse the optional observation on read.

## Proposed exact implementation ownership

All following source paths are proposed for this one Core propagation unit, pending lead release:

- `packages/fluxiq/src/runtime/client-gateway-transport.ts`
- `packages/fluxiq/src/runtime/service.ts`
- `packages/fluxiq/src/runtime/result-control/read-actionability.ts` (new private safe own-data extraction)
- `packages/fluxiq/src/runtime/result-control/actionability.ts` (new private result-copy normalization)
- `packages/fluxiq/src/runtime/result-control/index.ts` (new internal barrel only)
- `AS/nodes/contracts.ts`
- `AS/runtime/io-policy.ts`
- `AS/runtime/native-node-runtime.ts`
- `AS/runtime/executor/contracts.ts`
- `AS/runtime/executor/node-execution/attempt.ts`
- `AS/runtime/executor/attempt-trace.ts`
- `AS/model/flow-adaptation.ts`
- `AS/runtime/service/summaries/conversions.ts`
- `AS/runtime/llm/evidence-loop.ts`
- `AS/runtime/llm/evidence-loop/trace.ts`
- `AS/runtime/flow-bootstrap/evidence-loop-steps.ts`
- `AS/runtime/service/flow-bootstrap-commands/evidence-trace.ts`
- `AS/runtime/llm/evidence-progress/tool-execution-control.ts`

The two private helper functions each own one exported operation: read a validated own-data observation, or copy/normalize only that optional result field. They use the public contracts reader and no server/module dependencies. All cross-directory callers import their internal barrel; no extra root/public export is needed. The new directory holds3 source files; source depth is comfortably below9. Existing evidence-progress contains12 source files/6 tests, and gains no file. No baseline increase is needed. Exact test directory budgets must be checked before adding files; extend the existing tests below by default.

Must not touch: Phase1 `packages/contracts/src/actionability/**`, its tests/public exports, Core `src/io/index.ts`, `runtime/contracts.ts`, AS/index/pure public entry, `llm/evidence-loop/tool-execution.ts`, `llm/evidence-loop-decision.ts` and Phase1 reader tests; package JSON/versions/config, wire/client-gateway schemas/receipt/reconciliation/outbox owners, downstream/browser paths, retry/permission/act-floor/state-readiness policy, model guidance, shared Current/Ledger, or other workers' reports. `runtime/attempt-withholding.ts` is inspected but does not presently need a source edit.

## Named acceptance tests

Run only these named owning files with `pnpm.cmd --filter fluxiq exec vitest run <paths> --maxWorkers=2 --minWorkers=1` after implementation, grouped by the changed seam rather than a whole suite:

- `src/runtime/tests/client-gateway-transport.test.ts`: ordinary and completed durable host lifting; unchanged raw payload/result for old ingress/digest; absent/malformed/accessor controls preserve status/failure/payload and do not invoke the getter. The durable test must exercise the actual completed branch; old closed wire acceptance/reload remains coordinated with the downstream compatibility lane.
- `src/runtime/tests/service.test.ts` and `src/runtime/tests/attempt-withholding.test.ts`: direct adapter normalization before saved attempts/events; exact fact survives payload/value withholding without revealing withheld data or mutating the adapter result.
- `src/programs/automation-studio/runtime/tests/io-policy.test.ts`: IO/runtime success, failed dispatch, successful dispatch then failed confirmation, legacy/malformed/getter controls; dispatch through executor into the public run record; actionability coexists with failed readiness and never changes it.
- `src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts`: native result observation survives, absent stays absent, malformed/accessor drops alone with actual outputs/logs unchanged and metadata never supplies a fact.
- `src/programs/automation-studio/runtime/executor/tests/attempt-trace.test.ts` and `.../executor/tests/node-execution.test.ts`: strict attempt retention, actual effect merges, stronger unknown/not-sent failure preserved, and no inference from node metadata or target usability.
- `src/programs/automation-studio/runtime/llm/evidence-loop/tests/trace.test.ts`: real parsed execution to per-call trace, with actual effect/person/failure/accounting/evidence intact; no insertion into opaque model evidence.
- `src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts` and `.../service/flow-bootstrap-commands/tests/evidence-trace.test.ts`: complete typed row round trip through stored sanitizer, step builder, closed key list and published-step parser; malformed optional observation drops alone and leaves every other row field.
- `src/programs/automation-studio/runtime/llm/evidence-progress/tests/decision-dump.test.ts`: valid/invalid/getter actionability with and without failure, raw private geometry/text/source markers absent from control serialization, original result untouched, actual call/effect/person/evidence retained, direct dump and progress/step-log wrapper covered, opaque non-tool result unchanged.

Existing test sources for runtime service/withholding, native, executor effect merging and authoring round-trip tests require normal bounded implementation reads after release; they were identified by exact filename/import ownership and were not expanded during this discovery. No additional discovery is necessary before the ownership decision.

## Validation and limitations

Source inspection only, within the lead-expanded approximately22-file budget. The lead separately owns Phase1 reader verification, compiled dependencies, SDK/browser builds/types/audits and full acceptance. No worker tests/builds/types/git/API/browser/panel/agents/secret/user-data actions were run. No runtime behavior is claimed verified by this plan.

Outcome: Done (discovery/plan only)
Changed: Task-owned `p8-actionability/core-plan.md` only.
Validation: Read-only scoped source inspection; commands/tests not run as directed.
Not verified: All implementation, runtime propagation, durable compatibility/reload, privacy and readiness separation acceptance tests.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/core-plan.md`
Notes: Await lead interface release and exact ownership. No source edits. Public/durable wire contracts remain frozen.
