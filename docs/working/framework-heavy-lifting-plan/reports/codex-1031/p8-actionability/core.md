# t827 Core propagation, recording and raw-control privacy

Status: implementation and tests frozen for lead independent verification/SDK rebuild. Current12 owning files pass240 tests after one test-fixture correction and a final required-command reconstruction regression. No production source changed after the first source freeze.

## Implemented behavior

- Both gateway transport exits lift a validated copy of existing `payload.actionability` only after ordinary/durable acceptance. Raw wire results and their receipt digest remain unchanged; no gateway top-level contract or receipt field changed.
- New private `runtime/result-control/` helpers classify optional metadata as absent, valid, rejected with a closed reason, or unreadable with a closed reflection reason. They never invoke an actionability getter; normalization copies actual result descriptors and removes malformed/unreadable optional metadata alone. RuntimeService applies this before saved attempts/events and native execution before returning its validated result.
- IO and runtime policy dispatch preserve target observation on both success and failure, including successful dispatch followed by failed confirmation. The confirmation keeps its own failure without inferred unacted/transient facts. Opaque actual outputs remain unchanged.
- Executor effect merging replaces the target observation for each actual `policy.output.dispatch`, including absence; internal `records.write` preserves the last target dispatch's fact. Stronger unknown/not-sent reconstructions keep that current observation while preserving their actual receipt/effect failure. `nodeAttemptFromResult` strictly reads the field independently of status, and stored-session conversion reparses it into the public per-call action-attempt record.
- Per-call authoring trace rows carry the actual parsed observation, independent of opaque model evidence/draft definitions. The row type, live loop, stored sanitizer, published step type/builder, exact key allowlist and published-step parser all carry it; malformed stored optional observation drops alone.
- Raw tool control sanitation handles actionability independently when failure is absent, before the existing step-log wrapper and direct JSON dump. Existing failure sanitation remains intact. Private geometry/text/source data cannot enter the new control serialization; producer inputs and actual call/effect/person/evidence remain unchanged.
- No retry, permission, act-floor, success/effect, skip or recorded-readiness policy changed. A real graph test keeps `actionability:true` beside a failed recorded readiness check; authored metadata supplies no fact.

## Exact changed paths

All Core paths relative to `C:/Users/osrs_/FluxStuff/fxwork/t827/!FluxIQ`:

1. `packages/fluxiq/src/runtime/client-gateway-transport.ts`
2. `packages/fluxiq/src/runtime/service.ts`
3. `packages/fluxiq/src/runtime/result-control/read-actionability.ts` (new)
4. `packages/fluxiq/src/runtime/result-control/actionability.ts` (new)
5. `packages/fluxiq/src/runtime/result-control/index.ts` (new internal barrel)
6. `packages/fluxiq/src/programs/automation-studio/nodes/contracts.ts`
7. `packages/fluxiq/src/programs/automation-studio/model/flow-adaptation.ts`
8. `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts`
9. `packages/fluxiq/src/programs/automation-studio/runtime/native-node-runtime.ts`
10. `packages/fluxiq/src/programs/automation-studio/runtime/executor/contracts.ts`
11. `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution/attempt.ts`
12. `packages/fluxiq/src/programs/automation-studio/runtime/executor/attempt-trace.ts`
13. `packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/conversions.ts`
14. `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/evidence-trace.ts`
15. `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`
16. `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/trace.ts`
17. `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts`
18. `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tool-execution-control.ts`

Tests changed are exactly the12 paths in the command below; the private helper test is new, the other11 extend existing owners. Downstream change is only this task-owned `core.md` report. No Phase1/public/wire/receipt/config/version/shared-memory path was edited.

## Observed validation

From private Core:

```text
pnpm.cmd --filter fluxiq exec vitest run src/runtime/result-control/tests/actionability.test.ts src/runtime/tests/client-gateway-transport.test.ts src/runtime/tests/service.test.ts src/runtime/tests/attempt-withholding.test.ts src/programs/automation-studio/runtime/tests/io-policy.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts src/programs/automation-studio/runtime/executor/tests/attempt-trace.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/trace.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts src/programs/automation-studio/runtime/llm/evidence-progress/tests/decision-dump.test.ts --maxWorkers=2 --minWorkers=1
```

First run exit1: 11 files passed/1 failed;238 tests passed/1 failed,42.55s. Sole failure was the new durable fixture before sending its command: the existing legacy pairing helper created no socket, and durable `sendChecked` correctly refuses `durable_command.socket_unavailable`. The fixture's fixed claim/commit times also needed coherent live receipt times. No production fix was needed. The test-only correction supplies a no-op socket, uses current timestamps and additionally checks receipt.resultDigest equals the original raw wire-result digest.

```text
pnpm.cmd --filter fluxiq exec vitest run src/runtime/tests/client-gateway-transport.test.ts --maxWorkers=2 --minWorkers=1
```

Rerun exit0: 1 file/12 tests passed,2.81s. After the lead confirmed no source-wide checks/builds were active, one test-only addition in the already-owned node-execution test pins the required-command unknown/not-sent reconstructions through a real graph with the executor command-run collaborator. It asserts current observation/outputs retained, stronger ambiguous versus unacted failure retained, no transient inference, no consumption and no repeat. Production source remained unchanged.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts --maxWorkers=2 --minWorkers=1
```

Final narrow rerun exit0: 1 file/47 tests passed,25.42s. Together the current12 owning files pass240 tests: node-execution47, stored-authoring-trace29, native29, RuntimeService18, gateway transport12, published evidence steps31, IO policy25, raw dump8, attempt-trace28, withholding6, live loop trace5, private helpers2. Production source has not changed since the first source freeze.

Behavioral coverage includes actual ordinary and durable ledger completion/receipt digest; direct adapter event/persisted attempt normalization with real file-store withholding; native outputs/logs; actual IO/runtime confirmation failure; real executor graph/public run record; failed recorded readiness beside positive target observation; multiple target dispatches and internal record writes; actual tool execution to authoring trace with unchanged model evidence; stored sanitizer-builder-parser round trip; raw wrapper/direct dump with and without failure; invalid/private/getter/reflective metadata; original objects and actual facts preserved.

## Remaining checks

Lead owns independent named-test verification, package types, structure audit, SDK rebuild and downstream generated/public/browser checks. This lane ran no SDK/build/typecheck/source-wide audit/generated Down tests/API/provider/browser/panel/git/agents, secret or user-data operation. Full sweeps remain unused by this task. Actual browser production and mixed-version reload remain separate lanes.

All requested owned propagation/reconstruction cases now have focused behavioral coverage, including required-command unknown/not-sent outcomes. No extra source ownership was needed.

Outcome: Done
Changed: The18 accepted Core source paths and12 owning test files listed above; task-owned `core.md` only downstream.
Validation: Named12-file command ->238passed/1fixturefailure; corrected transport file ->12passed; final node-execution file ->47passed. Current total240tests across12files passed.
Not verified: Lead independent types/audit/SDK build, downstream generated/public/browser compatibility, actual browser behavior; no whole suites or live provider calls.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/core.md`
Notes: Final sources/tests frozen. Raw durable digest, actual outputs/effect/person/failure, withholding and opaque evidence preserved. No retry/readiness/permission/receipt/wire/public Phase1 changes.
