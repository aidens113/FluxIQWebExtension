# t905 graph-entry input use

## Current state

Implemented the lead-approved unit A in codex-t905-execution-seal-implementation-brief.md. Only new engine/automation/input-use/**, graph execution options, graph-run, typed boundary and their named adjacent tests changed. Existing owner/store, service/t911 seams, node dispatch, replay/admission, secrets, public package exports, versions and baselines are unchanged.

Final worker gate passed: 46/46 affected tests, 20.25 s (entry 20, boundary 6, strict capture 16, opaque session 2, late cleanup 2); Core check 69.991 s; unchanged structure audit passed 546 warnings / 914 baselined; exit 0. Exact job/log below. Source remains frozen for independent lead review and acceptance, which this worker does not claim. Existing graph-run 25 and call-subflow 11 passed on the unchanged ordinary engine paths in the prior 80-case gate; those two files were not rerun after the isolated cleanup helper change.

The causal tests require a real graph's consumed dictionary, isolation from caller mutation during authority work and producer freshness after execution. Their initial red and all intermediate failures are retained below. The API carries graph_entry_inputs only; every later node-use/whole-execution claim remains uncovered.

Initial red: `heavy-slot.mjs run t905-input-use-red -- "cd packages/fluxiq && node node_modules/vitest/vitest.mjs run src/engine/automation/tests/input-use.test.ts --maxWorkers 1 --minWorkers 1"` -> 3/3 failed, 26.09 s, exit 1. The real graph succeeded, but no authority capture/check/close or seal occurred, and the authority-side mutation never ran. Log `%TEMP%/fluxiq-t905-input-use-red.log`. Reader ended; owned implementation now resumes.

Implementation is written and frozen for its first combined narrow gate. The graph prepares an authenticated isolated lease copy, then its actual working-values initializer consumes that copy. Full child defaults/bindings/call inputs are privately retained before projection and checked against the child's actual entry. Opaque ports are concrete private-slot capabilities; each session owns its trace associations, and each child attempt receives a new controller and bounded signal. Initial unknown cannot upgrade. Ambient secrets, unsupported JSON and seeded resumes remain unknown; no service producer adapter is implemented.

Cancellation boundary agreed with lead: preparation abort uses the actual operation signal/reason and existing graph fault conversion. Once the graph has produced a trace, optional final freshness cancellation invalidates the seal while preserving that trace, including a cancelled trace and already completed act evidence. It does not manufacture another task ending or claim rollback. Both phases and explicit session closure have causal tests; no passing endpoint is claimed until their output is inspected.

First combined gate `t905-input-use-green-gate` -> 75 passed / 1 failed (76 total), 68.00 s, exit 1. Existing graph-run 25 and call-subflow 11 passed; the new resume fixture returned failed rather than succeeded. Typecheck/audit did not run after the test failure. Log `%TEMP%/fluxiq-t905-input-use-green-gate.log`.

Lead review independently identified a real exposed-controller defect: session.port.enter could return a frame whose initialize/complete accepted an arbitrary trace without a graph run. The accepted repair is a methodless opaque handle with controller access confined to internal engine integration and instance-owned records, plus a direct API attack regression. A second accepted regression strips foreign inputUse from childOverrides, which must not bypass a missing parent fork. These defects are not an accepted proof seam; the next red gate reproduces them before repair.

Selected red `t905-input-use-capability-red` -> 3 failed / 21 skipped, 21.63 s, exit 1; `%TEMP%/fluxiq-t905-input-use-capability-red.log`. The direct public API sequence actually returned sealed for a fake trace; childOverrides actually delivered the foreign port without a parent fork. The no-inputUse baseline reproduced the resume failure: `Node echo completed without an outgoing edge before the Flow visited every node`. The seed skipped Start but omitted its prior attempt, so Start appeared unvisited. Correct the fixture by retaining that already-executed Start attempt and compare the same valid seeded run with/without evidence; do not change engine navigation or accept the failed fixture.

Repair is written: exposed handles have no own keys/prototype/methods; only internal engine integration resolves their private session-owned controllers. Port/frame constructors are type-only exports from the local barrel, and session/handle APIs expose no trace writer. The direct attack regression remains. Child overrides copy only their declared currentSubflowId field, so a foreign inputUse cannot bypass the real fork. No-proof paths avoid new optional-await boundaries at root entry, child invocation and final observation; mutation-order tests verify actual ordinary input consumption. Resume now includes its prior Start attempt and compares the complete deterministic trace with/without inputUse. Source refrozen for the corrected gate.

Corrected gate `t905-input-use-corrected-gate` -> 80/80 passed, 64.30 s; Core check passed, 78.655 s; audit then failed two owned statement-packing lines (boundary test callback 64; capture cycle fixture 40), exit 1. Log `%TEMP%/fluxiq-t905-input-use-corrected-gate.log`. Both test-only formatting issues are expanded without baseline changes. Lead approved a final late-result cleanup regression: a malformed result/disposal callback arriving after cancellation must not leave an unhandled promise rejection, alter the settled graph or replace its original cancellation reason. The next focused red covers a throwing late status getter and a throwing close method; valid late leases already have exactly-once-close coverage.

Late cleanup red `t905-input-use-late-cleanup-red` -> 1 failed / 1 passed, 17.71 s, exit 1; `%TEMP%/fluxiq-t905-input-use-late-cleanup-red.log`. A throwing late status getter produced an observed unhandled rejection after the graph had returned. Throwing close was already contained. The operation now guards its discard callback, invalidates/records unavailable evidence through a closed internal notification, and consumes rejection of the detached handler chain itself. Cleanup never replaces a settled result or its original cancellation. The final affected group/type/audit gate is next; existing no-inputUse graph/call-subflow source has not changed since its 36 passing cases.

## Resulting contract and limits

The new local input-use contracts are runtime-safe; engine code imports only input-owner types and receives trusted authority through an explicitly constructed session. The methodless frozen handle has no constructor/prototype path to control methods. Engine integration alone unwraps its controller; per-session private trace associations do not accept a public claimed seal. The entry's actual working-values initializer takes the authenticated, exact-matching private lease copy. Completed observations carry only `graph_entry_inputs`, opaque reference and frame location, or a closed unknown code.

Private raw child data survives the public item projection through an isolated handoff and is compared against the dictionary the child really receives before overlay. Ambient secret overlay precedence is unchanged and active contexts call no normal authority. Missing/unknown/failed authority, unsupported exact JSON, foreign handoffs, stale producers and seeded state cannot upgrade into a seal. Child attempts have independent controllers/signals; no parent or override capability substitutes for a missing fork.

Final freshness cancellation invalidates evidence without replacing a graph trace already produced. The actual signal stays aborted with its exact reason, and previously completed act outputs/effects remain available. Preparation cancellation follows existing graph fault conversion. Leases/captures close in finally; late malformed results and failing disposal remain unavailable evidence rather than unhandled errors. No owner write rollback is claimed.

This unit authenticates graph-entry inputs only. It does not cover mutable per-node variable/output/wired/refresh values, seeded continuation state, instructions/result contracts, executable equality, host effects, secret continuity, durable child occurrence identity or whole execution. No service producer adapter is wired, and no replay/judge exemption or task termination changes. Unit B awaits t911's authority seam; node-use coverage is a later serial unit.

## Final validation and handoff

Working directory: paired Core `C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQ`. Final command:

```text
node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t905-input-use-final-gate -- "cd packages/fluxiq && node node_modules/vitest/vitest.mjs run src/engine/automation/input-use/tests/capture.test.ts src/engine/automation/input-use/tests/session.test.ts src/engine/automation/input-use/tests/cleanup.test.ts src/engine/automation/tests/input-use.test.ts src/engine/automation/composite/tests/boundary.test.ts --maxWorkers 1 --minWorkers 1 && cd ../.. && pnpm.cmd --filter fluxiq check && node scripts/structure-audit.mjs"
```

Observed: 46/46 tests passed, 20.25 s; Core check passed, 69.991 s; audit passed 546 warnings / 914 baselined; exit 0, session 93740. Log `%TEMP%/fluxiq-t905-input-use-final-gate.log`. No baseline changed. The earlier six-file gate's 80/80 included 36 existing ordinary graph/call-subflow regressions, with its separate audit failure recorded above; do not relabel that earlier endpoint as fully passed.

Changed Core paths: new `engine/automation/input-use/**` (18 source/contract/barrel files and three adjacent test files); existing `engine/automation/{graph-run.ts,contracts/graph-execution-options.ts,composite/boundary.ts}`; new `engine/automation/tests/input-use.test.ts` and `engine/automation/composite/tests/boundary.test.ts`. The only downstream change is this own report. Source/dist remain frozen; no worker git mutation, build, browser/provider/full-suite run, service wiring or owner/store edit occurred. The lead owns independent acceptance, authored architecture updates and committing/integration.

## Return contract

Outcome: Done (approved engine/frame unit A only).
Changed: Core engine/automation/input-use/**, graph-run.ts, contracts/graph-execution-options.ts, composite/boundary.ts and the two named adjacent test files; this own report.
Validation: Final coordinated five-file gate -> 46/46 passed, 20.25 s; Core check -> passed, 69.991 s; unchanged structure audit -> passed, 546 warnings / 914 baselined; exit 0. Exact command/log and failed endpoints retained above.
Not verified: Independent lead acceptance, real service/producer wiring, durable child occurrence identity, node-use coverage, secret continuity, executable/result-contract composition, effect witness or replay admission; no browser/provider/build/full-suite verification.
Report: docs/working/mvp-launch-plan/reports/codex-t905-execution-seal.md
Notes: Source frozen for lead review/commit; no public trace writer or judge exemption. Coverage is graph_entry_inputs only. Service wiring waits for t911.

No git, browser, provider, full suite, generated output or shared-document edit is authorized or performed.

## Independent lead acceptance

Final frozen source independently passed all seven relevant files:82/82,63.92s, including graph-run25, call-subflow11 and the46 input-use/capture/boundary/cleanup cases. `pnpm.cmd --filter fluxiq check` reused the matching validated stamp870ms; unchanged full structure audit passed546 warnings/914 baselined,exit0. Exact coordinated job lead-t905-input-use; log TEMP/fluxiq-lead-t905-input-use.log. No baseline changes. Core checkpoint efd762ebb includes source, tests, authored runtime-ownership documentation and the lead ledger. Local only: enclosing t905 replay/browser acceptance remains incomplete. Next unit C is design-only; service producer wiring remains behind t911 integration.
