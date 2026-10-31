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

## Final downstream and browser acceptance

Updated three-library build exit0 (fluxiq78.648s). Compiled pure browser probe15inputs6282bytes; no executor/native runtime dependency. Domain check exit0 (27.074s), package build exit0 (18.802s). Same named test command above, original assertions intact ->149/149passed,63.171s.

`pnpm.cmd --filter @fluxiq-web-extension/extension check` ->exit0,71.906s; browser entry coverage now enforced. `pnpm.cmd --filter @fluxiq-web-extension/extension build` ->exit0,24.390s,22files verified per Chrome/Firefox/e2e target. Existing Firefox add-on ID placeholder remains; no Firefox browser run.

`pnpm.cmd --filter @fluxiq-web-extension/extension test:content action-effect/tests/client-floor.spec.ts --workers=1` ->1passed,1.2m startup+run (test2.5s), Chromium134.0.6998.35 full binary, headless UTC, allowed job-board isolated fixture. Actual canonical native public SDK graph saves d1 once; exact baseline-plus-d1 persists, same heart remains filled/present, traffic has1save/0unsave, graph has1attempt and no alternative, terminal run.outcome_uncertain after generic lost acknowledgement. Separate first-save refusal preflight proves no mutation and is not claimed as automatic retry proof.

This is a real content action regression using the native Core SDK; background transport, installed extension/panel, model authoring, judging, whole Flow completion and Firefox runtime were not exercised. No paid calls, full suite or panel server. HTML evidence preserved MAIN ignored test-runs/2026-10-31-t824-browser-report/index.html, checked present.

Parent dev merged into both tasks: documentation only, no integrated source conflict. Staged whitespace review removed one blank EOF from control-words helper, no semantic change or test assertion change. Domain/extension final type refresh and structure merge gates follow before closing. Core source checkpoints3d790f7e and Down3e3318cd; task backups retained. Main still needs a later permitted full sweep.

## Integration completed

Post-parent-merge narrow checks passed: Core typecheck reused its valid stamp; domain check exit0 (20.466s), extension check exit0 (37.834s). No runtime tests repeated for documentation-only parent changes and a blank EOF removal.

`pnpm.cmd task finish t824 'Enforce trusted action effects and safe state retries'` in downstream ->structure gate passed, merged02f215f3, task worktree removed. Then detached private Core and ran `pnpm.cmd task finish t824 'Enforce trusted action effects and safe state retries' --skip-checks` in Main Core ->mandatory3files70contracts passed, merged78cb70d8. The default whole check was explicitly skipped under the daily cap after narrow acceptance; no hooks bypassed.

`git push origin dev` observed Core0ae7ebfd..78cb70d8, then downstreamb2ee519e..02f215f3. Remote task backups retained in both repositories. Main unchanged; no full suite or paid model calls. User's unrelated .clinerules/fluxiq.md remains unstaged.

Main checkout filtered refresh completed: Core3libraries exit0 (fluxiq79.095s), domain package build exit0 (16.978s), extension package build exit0 (20.826s),22files each Chrome/Firefox/e2e. No panel start/reload of user's browser. Private detached Core remains for normal age-based task pruning.
