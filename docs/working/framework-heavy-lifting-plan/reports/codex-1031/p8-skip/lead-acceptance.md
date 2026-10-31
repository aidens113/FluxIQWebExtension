# t825 lead acceptance

Core private tree: C:/Users/osrs_/FluxStuff/fxwork/t825/!FluxIQ. Root owns package patch0.17.1 and authored/memory docs; worker owns bounded skip/routing code. No full suites, model/API/browser/panel calls in this unit. Daily full-suite allowance exhausted.

## Reproduction and current behavior

Worker red graph run used a parser-accepted target_not_found/target_resolution/effect:ambiguous record. Original2tests passed, new2failed: each commit invoked1, onward invoked1, effect checks0; optional target_absent and nonoptional forward-state routing erased the failure. Root inspected the category-only admission and post-dispatch routing ordering. These are real graph regressions, not parser/import failures.

Worker green named checks301/301 across28files; these are reported claims. Independent root acceptance below is separate and overlapping, not an added unique count.

## Independent named tests

From Core packages/fluxiq:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts src/programs/automation-studio/runtime/executor/defensive/target-evidence/tests/unacted.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/could-not-run.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/decision.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/routed-attempt.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/typed-skip.test.ts src/programs/automation-studio/runtime/executor/step-loop/tests/state-route.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/absent-step.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done-effect.test.ts src/programs/automation-studio/runtime/executor/target-reacquire/tests/stale-failure.test.ts src/programs/automation-studio/runtime/executor/tests/safe-state-routing-run.test.ts src/programs/automation-studio/runtime/llm/harness/tests/context-packet.test.ts src/programs/automation-studio/runtime/result-verification/tests/result-summary.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/feedback.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/landed-acts.test.ts src/programs/automation-studio/runtime/service/summaries/tests/skipped.test.ts --maxWorkers=2 --minWorkers=1
```

Observed18files200/200passed,57.66s. Covers changed helpers/routing, actual graph paths, raw conditional values, nonfatal skips, strict positive witnesses, On Retry suppression, landed/not_landed/unknown and nested child safety, stale-target proof, trace/feedback/landed/result/context projections. Source frozen during this run.

`pnpm.cmd --filter fluxiq check` ->exit2: child trace fixture has nonexistent flowId; metadata fixture array unnecessarily permits undefined under exact optional typing. No production type errors reported. Assigned source owner corrections without assertions/casts.

`node scripts/structure-audit.mjs` ->exit1,3issues: cross-directory explicit-risk leaf import; target-evidence index/subject at10segments above9limit. Owner to use risk barrel and move shared guard up to executor/target-evidence, no baseline increase. Checks finished before releasing edits.

## Memory compaction

Private Core FHL moved4settled blocks verbatim to archive/2026-10-31-accepted-client-effect.md; exact archive bytes checked, Current State retains accepted outcomes. A first raw separator probe found CRLF and wrote nothing; corrected delimiter-aware extraction preserved all4blocks. Final `python -` ->4sourceblocks preserved verbatim, archive bytes verified,794document lines. `node scripts/structure-audit.mjs --rule working-docs --update` ->passed,1144baseline unchanged. Main Core Current State mirrors active scope; private compacted ledger integrates with the code.

## Pending

Owner structural/fixture corrections, final independent types/audit/affected tests, filtered Core SDK build, downstream type compatibility, paired integration/push. No live browser proof is claimed for t825.

## Final Core narrow acceptance

Owner corrected risk import through defensive barrel; target-evidence and owning tests moved up to executor/target-evidence (9segments). Child trace fixture removes unsupported flowId; metadata fixture now NonNullable with no cast. No semantic change or baseline adjustment.

From Core packages/fluxiq:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/executor/tests/safe-state-routing-run.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done-effect.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done.test.ts src/programs/automation-studio/runtime/executor/target-evidence/tests/unacted.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/typed-skip.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/could-not-run.test.ts src/programs/automation-studio/runtime/executor/step-loop/tests/state-route.test.ts --maxWorkers=2 --minWorkers=1
```

Observed8files58/58pass,36.05s after corrections. Final `pnpm.cmd --filter fluxiq check` ->exit0,56.248s. `node scripts/structure-audit.mjs` ->passed,1144baselined unchanged.

To independently verify all worker-named acceptance without rerunning already-observed files, ran remaining10 compatibility files:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/announcement.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/progress-guard.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/safe-routing.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/skipped-values.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/guarded-group-run.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/optional-failed-route.test.ts src/programs/automation-studio/runtime/executor/tests/state-routing-run.test.ts src/programs/automation-studio/runtime/route-state/signatures/tests/signatures.test.ts --maxWorkers=2 --minWorkers=1
```

Observed10files101/101pass,16.10s. Combined with initial18files200 gives301unique tests across28files; final8/58 is an overlapping correction rerun, not added to unique count. Actual parser-valid optional/nonoptional graph cases now invoke act1/onward0/effectCheck1, no routing observation and terminal run.outcome_uncertain. Genuine unacted optional skip remains nonfatal/notDone; positive landed/not_landed, strict witness, On Retry, child uncertainty and existing projection compatibility pass.

Source frozen; filtered three-library Core build underway. Downstream compatibility and integration remain pending. No browser/API/full suite.

## Compiled and browser compatibility

Filtered Core3library build exit0 (fluxiq70.247s; contracts/gateway reused). Core source checkpoint52eea41d backed up on origin/task/t825-runtime-skipped-effect. `pnpm.cmd --filter @fluxiq-web-extension/domain check` ->exit0,28.453s. Downstream `node scripts/structure-audit.mjs` ->passed,615baseline unchanged. Domain-only package build exit0,15.142s,789JSmodules.

`pnpm.cmd --filter @fluxiq-web-extension/extension test:content action-effect/tests/client-floor.spec.ts --workers=1` ->1passed,58.4s startup+run (test2.3s), Chromium134.0.6998.35 headless UTC, allowed job-board fixture. Existing real Save lost-ack test verifies1dispatch,0unsave/alternative, exact saved delta and same filled target with terminal uncertainty under new Core0.17.1. This is browser compatibility evidence; the newly fixed ambiguous-target optional/general-route cases are proven in canonical graph unit tests, not separately in browser. No background/panel/Firefox/model authoring/judging/whole-build proof claimed.

HTML saved and index checked present at MAIN ignored test-runs/2026-10-31-t825-browser-report. No full suite, paid model API or panel management. All source frozen; paired integration pending. Next signal discovery is read-only: first CC8 transient contract/parser/tool-result propagation with host-side production from existing parsed facts; first CC8 host-side production keeps browser wire unchanged; CC10 follows serially because producer paths overlap and needs an explicit mixed-version design.
