# t529 detached candidate-owned subflow execution

Status: Implemented and owning checks complete; source/tests frozen for supervisor dev integration and independent verification.
Date: 2026-10-13
Worker: codex-replay
Task: `task/t529-candidate-subflow-execution`, paired `fxwork/t529`.
Initial bases: Core `3709a355`, downstream `14a93251`.

## Implemented scope

The next owning ID was verified as t529. The normal `createWorktree` helper created both task branches, performed offline installs and verified the sibling Core package link. No whole-workspace build wrapper, environment/secret copy or live lane was used. The needed public contracts prerequisite restored 149 files from the shared cache.

Creation's detached runner now installs a clone-bound in-memory graph source for its exact normalized candidate. It retains each child's declared interface and ownership. The owner creates its trusted invocation holder and delegates each child to the normal canonical executor with that invoked graph's own declared failure-route budget. Every helper load and child dispatch checks current candidate identity/cancellation. There is no accepted-store or caller-source fallback. A caller invocation holder is refused because its override map/runner could substitute foreign graphs. Returned candidate graph definitions are used only to attribute actually invoked child evidence, never to claim all alternatives ran. Nested attempt counts include the child frames.

Child evidence uses the existing run-detail frame-attempt identity projection. Repeated local attempt IDs become unique within the trial, and retries fold only within the same invocation. Root attempt shape remains compatible. Only candidate-owned invoked sibling declarations join the trial's graph lookup. Child effects/failures and way-out references reach feedback; successful lasting child acts reach the reset ledger once. The Call Subflow container is not counted as another lasting act or read of the results it forwards.

Judge summaries retain the ordinary node/row denied-key screens and saved trace withholding. They include invoked child definitions/observations. No raw child values are copied around their existing screen. Recursive learned pace attribution uses each invoked graph's own symbolic Subflow/node keys, with the largest learned pace for repeated calls of the same helper. Identical local node keys in different helpers remain separate.

The runner still selects one entry route from fresh host state. It does not execute every alternative, change route validation, broaden held re-author support, modify the t525 judge, or promote topology early.

## Reproductions and tests

Fail-first production-equivalent detached call, with no injected graph loader, failed instead of reaching the helper. The corrected fixture executes two nested helpers, gives each call distinct inputs, and passes their actual returned values to a real Core native-executor consumer. A separate for-each fixture calls the same nested helper for each row and consumes that row's returned value. Assertions use consumer inputs because normal saved traces intentionally withhold the outputs; withholding was not weakened to satisfy a test.

Separate fail-first child evidence tests found zero reported child lasting acts and only root call steps. Both now retain each child invocation/act exactly once. A third fail-first test showed forwarded Call Subflow extraction metadata counted as a second read; authoritative containers are now excluded and the child's read remains.

Final source review found that a child inherited the selected entry's authored-route budget. A valid helper-local failed alternative was blocked at zero whenever the entry declared none. Supervisor authorized a fail-first regression; it reproduced the failure. The fix uses the existing invocation/normal canonical executor seams and derives a budget for exactly the graph invoked, never the sum of unselected alternatives. The same helper's local alternative can run on each distinct call; an alternative that itself fails and an unrelated required root failure remain failures. No executor or additional contract/consumer expansion was needed.

Additional coverage: missing/cyclic targets, stale identity/cancellation during a child call, required child failure propagation, foreign-source isolation, foreign invocation refusal, cloned interfaces/definitions, unowned/stale helper decline, root compatibility, declared child input/result isolation, distinct invocation IDs, inherited denied-key screens, owned graph lookup, and per-helper pace attribution. Accepted parent state remains unchanged. Existing detached execution permission/freshness/partial-run and selected-route safety tests also pass.

These are generic deterministic fixtures through the actual detached adapter and ordinary `runAutomationStudioCandidateTrial` path, with scripted native callbacks/judge ports. They are not a browser, importer SDK/public AutomationStudioService or paid model qualification. The unit does not demonstrate correct automatic decomposition or alternate-route coverage.

## Owned paths

Core paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `flow-bootstrap/verification/detached-execution.ts`, `index.ts`, new `candidate-graphs.ts`.
- Adjacent `verification/tests/{candidate-owned-subflows,candidate-graphs,helper-failed-route}.test.ts` and typed generic `subflow-fixture.ts`.
- `service/candidate-trial/{run,summary,landed-acts,executed-steps,learned-paces,index}.ts`.
- New focused `service/candidate-trial/frame-evidence.ts`.
- Adjacent `candidate-trial/tests/{nested-evidence,called-trial,frame-attribution}.test.ts`.

The recursive evidence/executed-steps and learned-paces expansions were explicitly approved by the supervisor. No other contract/consumer/source partition was changed. No downstream production source changed; this own report is the downstream artifact.

## Observed validation

- Initial loader/evidence positive and negative selection: 10/10.
- Compatibility and owning selection: 42/42 after preserving root attempt shape.
- Final affected selection: 54/54, including 37 existing detached safety cases.
- Core source/test typecheck: passed, exit 0, including repeat after the invoked-graph budget correction.
- Core structure audit: passed, native exit 0, 344 warnings / 1156 baseline. One added packed fixture line was unpacked without baseline growth. The preliminary filtered PowerShell pipeline produced misleading shell status despite the audit's pass text; explicit native exit capture confirmed success.
- Scoped diff check: passed.
- Combined ten-file selection before the final graph-local budget correction: 85/85.
- Final eleven-file selection after that correction: 88/88. Structure audit repeated with native exit 0 and scoped diff check passed again. Fresh dev integration/repeat is supervisor-owned and still required before acceptance.

Exact combined command from paired Core:

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/detached-execution.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/candidate-owned-subflows.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/candidate-graphs.test.ts src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/helper-failed-route.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/run.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/executed-steps.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/landed-acts.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/nested-evidence.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/called-trial.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/frame-attribution.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/learned-paces.test.ts
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t529-check.tsbuildinfo
node scripts/structure-audit.mjs
git diff --check
```

No whole suites, provider/browser runs, panel management, profiles/runtime-state edits, commits, merges or pushes. No public fluxiq library rebuild performed by worker. Rooted validation, applicable entry-case qualification and whole-topology held re-author remain separate units.
