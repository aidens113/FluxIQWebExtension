# Report: s2-runtime (S2 Core do-while repeat: execution)

## Outcome

Done for the brief's four tasks. One contradiction stands: C5 does not reach importer (domain) nodes. See Open questions.

## What changed and why

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq/src/programs/automation-studio`. `R` = `runtime`, `N` = `nodes`.

- `R/io-policy.ts`: a new `dispatchedRoute(payload)` returns `payload.route` when it is a non-empty string other than `success` or `failed`, and `success` otherwise. Both dispatchers (`dispatchPolicyOutput` and `createRuntimePolicyEffectDispatcher`) use it on their success return only. The outputs are unchanged. A failed dispatch still returns `failed`.
- `R/executor/node-execution.ts`: `dispatchAutomationStudioEffects` takes a new parameter, `branchRoutes: ReadonlySet<string>`, built by a new `declaredBranchRoutes(definition)` from the outputs whose `role === "branch"`. A dispatched success `route` replaces the node's route only when it is in that set. An undeclared id, or the id of a data port, is ignored. Both call sites pass `declaredBranchRoutes(definition)`, where `definition` is the `getAutomationNodeDefinition(node.definitionId)` lookup the function already made. The code uses no web terms.
- `R/executor/graph-run.ts`: `FOR_EACH_DEFINITION_ID` became `LOOP_DEFINITION_IDS`, a set of `builtin.control.for-each` and `builtin.control.repeat`. `withIterationAllowance` checks membership in that set. I updated the comments to match.
- `R/executor/state-routing/progress-guard.ts`: the same set replaces the single id in `automationStudioRunProgressMark`, and the doc comment now names Repeat.
- `N/control-flow/repeat.ts`: not changed. No test showed a defect.

Tests:
- `R/tests/io-policy.test.ts`: a new describe block, "a route an output answers in its result payload", with 4 tests. They cover a route lifted on IO success and on runtime success, a failed dispatch that stays failed on both paths, and empty, non-string, `success`, `failed` and null routes being ignored.
- `R/executor/tests/node-execution.test.ts`: `vi.mock` of `../../../nodes/index.ts` adds the definition `test.paged-output`, with outputs `success`, `failed`, `ended` (branch) and `rows` (data), and passes every other id to the real registry. The new describe block, "a route a successful dispatch answers", has 4 tests:
  - `ended` is kept and the run follows the `ended` edge to `exit`;
  - an undeclared id is ignored;
  - `rows` (a data port) is ignored;
  - the real `builtin.policy.action` ignores `ended`.
- `R/executor/tests/graph-run.test.ts`: Repeat with `most: 300` and a two-node body completes past the default 250 steps (903 attempts, 300 `body` and 1 `done`). Test file count stays at 25.
- `R/executor/state-routing/tests/progress-guard.test.ts`: Repeat `body` passes count toward the progress mark and `done` does not.
- `N/control-flow/tests/repeat.test.ts` (new): 8 tests covering:
  - ports, roles and parameters;
  - passes 1..most on `body`, then `done` with `{pass: most}`, the state cleared and a message;
  - the kept state shape `{items: [], index}`;
  - continuing from a kept count;
  - restarting from 1 after `done`;
  - a default of 50 passes;
  - `most` clamped to 1..500 (0, -7, 2.9 and 900 tested);
  - no `iteration` fails with a valid failure record.

## Commands run and observed results

All run from `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq`.

1. Fail-first run, before any source change: `npx vitest run <io-policy, node-execution, graph-run, progress-guard, repeat tests>`.
   - Result: 4 test files failed, 4 tests failed and 55 passed. The failures were the two io-policy lift tests, the graph-run Repeat test (`expected 'failed' to be 'succeeded'`) and the progress-guard Repeat test (`expected 2 to be 4`).
   - node-execution did not run at first because a `vi.mock` hoisting error stopped it. After I fixed that with `vi.hoisted`, the "is kept" test failed before the change (1 failed, 43 passed).
   - `repeat.test.ts` passed from the start. It describes the lead's code, which is correct.
2. After the changes: `npx vitest run` on io-policy, node-execution, graph-run, state-routing-run, optional-failed-route, progress-guard and `N/control-flow/tests/`.
   - Result: 1 test failed, in my own test. It expected the End node's route to be `success`, but End routes `end`. I fixed the expectation, not the code.
   - Rerun: `Test Files 8 passed (8)`, `Tests 135 passed (135)`.

## Not verified

- No typecheck was run. The brief forbids fluxiq:check and builds, and vitest does not typecheck. The mock definition in `node-execution.test.ts` and the `payload: { route }` values in the io-policy tests have not been checked by `tsc`.
- I did not run the structure audit. The lead runs it.
- No live run, browser, Lab or provider call.

## Open questions or contradictions found

1. **C5 does not reach importer nodes, and the web next-page node is one.** `node-execution.ts` finds a definition only through `getAutomationNodeDefinition`, which looks up builtins only (`N/registry.ts:53`).
   - The downstream web output nodes are importer definitions (`domain/src/output-nodes/definitions.ts`, `kind: "importer"`). They run on the `nativeNodeExecutor` path, and their definitions live only in the native runtime (`R/native-node-runtime.ts` `getDefinition`). The executor cannot see them.
   - As a result, a dispatched `route: "ended"` from such a node is ignored today, and the node routes `success`. A builtin node that declares a branch works.
   - Closing the gap needs one of two changes, in files I do not own:
     - (a) an executor option to look up native definitions, set in `R/runtime/service.ts` (`nativeNodeRuntime.getDefinition`) and declared in `R/executor/contracts.ts`;
     - (b) the native execution result carrying the definition's branch output ids.
   - `dispatchAutomationStudioEffects` already takes `branchRoutes` as a parameter. Under either fix, the native call site would pass `declaredBranchRoutes(<native definition>)` instead of the builtin lookup.
2. C3 says `done` carries `{ pass: most }`, and `repeat.ts` emits `{ pass: begun }`. The two are equal whenever the loop reaches its bound. They differ only if `most` was lowered while a kept count was above it. I left this alone because no test exposed it as a defect.
