# t824 lead acceptance

Core source root: `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQ`. Downstream sibling uses this private Core. Full suites exhausted for2026-10-31; no full checks, paid calls or panel management authorized/run.

## Core acceptance

`pnpm.cmd --filter fluxiq check` initially found4 typed integration errors (instructed digest, async effect check and2 option-Pick uses). Corrected without casts or weakening contracts; final command exit0,64.657s.

`node scripts/structure-audit.mjs` ->Core exit0,1144 baselined; downstream exit0,615 baselined. Initial Core3 test violations and downstream5 structural violations plus introduced extraction cycle were corrected. No budget/baseline increase.

From Core `packages/fluxiq`:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/read-resolved.test.ts src/programs/automation-studio/nodes/action-effect/tests/resolve.test.ts src/programs/automation-studio/nodes/tests/action-effect-definition.test.ts src/programs/automation-studio/runtime/action-permissions/plan/tests/projection.test.ts src/programs/automation-studio/runtime/action-permissions/tests/action-effect-declaration.test.ts src/programs/automation-studio/runtime/action-permissions/tests/client-floor.test.ts src/programs/automation-studio/runtime/action-permissions/tests/consequences.test.ts src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/continuation.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/retries.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/reopen.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/repeated-act.test.ts src/programs/automation-studio/runtime/executor/target-reacquire/tests/lineage.test.ts src/programs/automation-studio/runtime/executor/tests/graph-run.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions-witness-notes.test.ts src/programs/automation-studio/runtime/recovery/annotation/tests/step-evidence-resolution.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/interruption-learning.test.ts src/programs/automation-studio/runtime/tests/authored-call-subflow/tests/call-subflow.test.ts src/programs/automation-studio/runtime/tests/composite-executor.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1
```

Observed26 files,276 tests passed,64.02s. Covers canonical contract/SDK, native and policy floors, logical loop/invocation isolation, prep/in-flight timeouts, retry/effect proofs, actual Call Flow/Subflow uncertain-child stops, required-mode latch contract and adjacent graph tests. Separate11-file permission/projection/bootstrap/recovery/interruption command in permission.md was independently rerun:230 tests passed,35.94s. These suites overlap; counts are not unique totals.

Worker nested reproduction reached3 commit dispatches in Call Flow,1 in Subflow, then a failed alternative in both. Final real canonical tests prove1 dispatch,0 alternatives/parent checks and outer run.outcome_uncertain. Landed/not-landed/unacted proofs retain correct progress. Required latch test is typed contract collaboration, not live gateway receipt proof.

## Pending

Filtered three-library build, downstream type/test/artifact checks and real Chromium content proof. Main promotion remains held for a later permitted full sweep.

## Downstream first acceptance and fix loop

Filtered three Core libraries built exit0 (contracts/gateway reused; fluxiq77.517s). Browser esbuild probe of compiled public action-effect entry passed:15 inputs,5368bytes, no executor/native import. Domain check exit0; domain-only build exit0 (789 emitted JS modules).

`$env:DOMAIN_TEST_BUILD_LABEL='t824-lead-effect'; pnpm.cmd --filter @fluxiq-web-extension/domain test actions/action-effect/tests client/interrupted-action/tests output-nodes/tests/definitions output-nodes/tests/native-runtime runtime/tests/lasting-act-statement runtime/llm-evidence/node-run/retries/tests runtime/llm-evidence/node-run/tests/unwritten-consequences runtime/llm-evidence/plan-resolution/tests/plan-step-permission` ->145 tests,139 passed,6 failed,42.791s. All6 are existing uncertain-outcome regressions: ordinary type/navigation/check retry expectations now stopped by generic state mutation classification. These reached actual Core retry handoff. Existing assertions retained; coordinated typed trusted repeatSafe promise now being implemented.

`pnpm.cmd --filter @fluxiq-web-extension/extension check` ->exit1: new public pure entry was not registered in Core browserBundles.entries. Lead added exact action-effect/index.ts registration, no baseline change. Check rerun waits for final SDK. Chromium not launched yet.

## Explicit repeat-safety follow-up

Core and web sources frozen. Optional trusted repeatSafe:true is independent of state; commit, known/model lasting classes and explicit destructive/external/approval/mutate raises veto it. Web promises only inspected absolute setters type/check/nav/clear/select; true/unresolved newTab raises navigation to commit with its actual native false default. Upload stays cautious. Six original assertions unchanged.

From Core packages/fluxiq:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/nodes/action-effect/tests/repeat-safety.test.ts src/programs/automation-studio/nodes/tests/action-effect-definition.test.ts src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/continuation.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/node-execution/tests/action-effect-frames.test.ts src/programs/automation-studio/runtime/executor/outside-graph/tests/action-effect.test.ts src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts --maxWorkers=2 --minWorkers=1
```

Observed9files93tests passed,42.25s. Core and downstream full structure audits passed (1144/615 baselines unchanged). Typecheck found2 fixture inference errors: map inferred required metadata. Lead explicitly annotated AutomationStudioFlowNode[] (no cast); owning test6/6 passed. Final `pnpm.cmd --filter fluxiq check` exit0,16.611s. Follow-up Core commit3d790f7e; filtered SDK rebuild underway. Final downstream tests/browser proof still pending.
