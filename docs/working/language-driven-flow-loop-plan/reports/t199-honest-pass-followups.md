# t199 report: the honest-pass follow-ups in the Lab scripts

## Outcome

Mostly done. Items 1, 2, 4 and 5 are done. Item 3 needed no code change: `scripts/lab/live-campaign/runner.mjs` has no pass streak (its only counter is `neverStarted`), so I added a runner test that proves a stop reaches the rows, the totals, the log line and the Markdown as its own verdict. The verdict logic from f2f80024 and `scripts/lab/live-guards/` were not touched.

## What changed and why

- `scripts/lab/live-campaign/row/summarize-task.mjs`: a row's `verdict` is now `stopped_for_permission` when either signal is present. The first is the Lab's printed `permissionStop` (`{ verdict: "stopped_for_permission", consequence, control }`, which `cli.ts` prints as part of `RunScenarioResult`). The second is the evaluation's failed `stopped-for-permission` invariant. The stop wins even over an evaluation or printed result that says `passed`. A row that stopped also has:
  - `succeeded: false` for both kinds of task;
  - a new `permissionStop` field, `{ consequence, control }` or `null` (both members are `null` when only the invariant recorded the stop);
  - a `runnerMessage` of the form "stopped for permission to X (control Y); no Flow was built, so this is not a pass".

  The helpers are private to the file, so no new module was added.
- `scripts/lab/live-campaign/summary/totals.mjs`: a new `stoppedForPermission` count. It is separate from `passed` and from `failed` (which is still failed plus inconclusive).
- `scripts/lab/live-campaign/summary/markdown.mjs`: the headline now reads "(F failed, S stopped for permission and built no Flow, N produced no result)". An older summary with no count shows 0.
- `packages/test-runner/src/flow-lane/creation/lane.ts`: three comments reworded. The `CreatedFlowLanePermissionStop` doc said "because it is the pass". The `CreatedFlowLaneIncomplete.failure` doc said "which is the pass". The ask-first comment said "no passing ending but the stop above". Each now says the stop is right behaviour, not a lane fault, and is `stopped_for_permission`, not a pass.
- `packages/test-runner/src/bench/evaluate-run.ts`: `FlowRunInput.result` takes an optional `permissionStop`, and `evaluateFlowRun` passes `{ consequence, control }` on to `evaluateObservedRun`. A bench row therefore carries the same failed `stopped-for-permission` invariant as a single `lab run`. The live bench path (`run-bench.ts`, `evaluateFlowRun(observed)` with the full `RunScenarioResult`) passes it with no change.
- Tests:
  - `row/tests/summarize-task.test.mjs`: one new test covering the printed signal, the invariant signal, a claimed pass, a repair task, a passed invariant with the same id, and a run with no result.
  - `summary/tests/totals.test.mjs` and `summary/tests/markdown.test.mjs`: new files, because `summary/` had no `tests/` folder.
  - `tests/runner.test.mjs`: a new campaign test with one pass and two stops. The existing totals pin gained `stoppedForPermission: 0`.
  - `bench/tests/evaluate-run.test.ts`: a new test. A stop with a runner verdict of `passed` evaluates to `failed`, `honestRunVerdict` gives `stopped_for_permission`, and the invariant is present. A run with no stop still passes.

## Commands run and observed results

- `node --test scripts/lab/live-campaign/row/tests/summarize-task.test.mjs scripts/lab/live-campaign/summary/tests/totals.test.mjs scripts/lab/live-campaign/summary/tests/markdown.test.mjs scripts/lab/live-campaign/tests/runner.test.mjs`: `# tests 14`, `# pass 14`, `# fail 0`.
- The same four test files against the HEAD versions of the three `.mjs` sources, which I restored afterwards: `# pass 8`, `# fail 6`. All the new tests and the updated totals pin failed. This shows the tests detect the old behaviour.
- `bash .../build-slots/heavy.sh "t199 build" pnpm --filter @fluxiq-web-extension/test-runner build`: built. Then `node --test dist/bench/tests/evaluate-run.test.js dist/run-evaluation/permission-stop/tests/permission-stop.test.js dist/lane-rules/tests/built-flow.test.js`: `# tests 23`, `# pass 23`, `# fail 0`. The first run failed 1, because my fixture had `reportedVerdict` set with `flowCreated: false`, which the contract rejects. I fixed the fixture and rebuilt.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t199 check" pnpm check`: exit 0.
  - Script tests: `# tests 513`, `# pass 512`, `# fail 0`, `# skipped 1`.
  - `structure-audit: passed (128 warning(s), 120 baselined).`
  - Every `pnpm -r check` step printed `Done`, including `packages/test-runner check`.

## Not verified

- No live or Lab run.
- The full test-runner `node --test dist` suite was not run. Only the three files above were.
- The bench's reconstruct path (`run-bench.ts` `reconstructBenchEvaluation`) was not changed; see below.

## Open questions or contradictions found

- Item 3 assumed a pass streak in `runner.mjs`. There is none. The only pass streak is `passStreak` in `run-evaluation/permission-stop/pass-streak.ts`, which f2f80024 already fixed.
- `run-bench.ts` `reconstructBenchEvaluation`, which rebuilds an evaluation from a finalized bundle on resume, rebuilds `result` from the stored evaluation and does not carry `permissionStop`. A resumed stop still reads `failed`, because the stored verdict is `failed`, so it is never a pass. However, the rebuilt evaluation loses the `stopped-for-permission` invariant, so its honest verdict reads `failed` rather than `stopped_for_permission`. `run-bench.ts` was outside this brief. A fix could carry the stored invariant, or a `permissionStop`, through.
- `lane.ts` is 433 lines, up from 430. It was already past the 400-line advisory threshold, and the audit only warns about it.
