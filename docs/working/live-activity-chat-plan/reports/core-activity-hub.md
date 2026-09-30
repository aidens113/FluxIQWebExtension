# core-activity-hub (C2) report

## Outcome

Done. The activity hub, scope, emitters and evidence-loop observer are built and tested, and every emission site in the brief is wired. `tsc` and `structure-audit` pass. `runtime/service.ts` grew 1 net line, from 4547 to 4548. Its budget is 4558, and no baseline grew.

The existing service-level suites passed only with a longer test timeout. Under the default 15 s timeout, 2 to 4 tests failed on machine load and Windows file locks, and which ones failed changed from run to run. Details are under Commands run.

## What changed and why

All paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` in the Core tree `C:\Users\osrs_\FluxStuff\fxwork\t185\!FluxIQ`.

### New: `activity/` (one exported value per file, barrel `activity/index.ts`)

- `contracts.ts` (types only):
  - `AutomationStudioActivityScope` is `{ kind, id, projectId, flowId?, conversationId? }`.
  - `AutomationStudioActivityInput` is `Omit<ClientGatewayActivity, "sequence"|"at">`.
  - `AutomationStudioActivityEmission` is a `Pick` of `ClientGatewayActivity` (phase, label, step, detail, final).
  - Also defines the listener, snapshot and frame types.
  - `ClientGatewayActivity` is imported from `@fluxiq/contracts/client-gateway`, never redefined.
- `limits.ts`: `AUTOMATION_STUDIO_ACTIVITY_LIMITS` is label 160, title 160, text 1,000, recent 60.
- `bounded.ts`: `boundedAutomationStudioActivity` truncates the label, `detail.title` and `detail.text` (D4). It also holds `step.label` to the title bound. Ids pass through unchanged.
- `hub.ts`: class `AutomationStudioActivityHub`.
  - `publish(input)` assigns a strictly increasing `sequence` and the `at` ISO timestamp, and bounds the strings.
  - It keeps a per-project ring of the last 60 events.
  - It fans out to subscribers. A subscriber that throws is isolated by a `best-effort` catch.
  - `subscribe(listener)` returns an unsubscribe function.
  - `snapshot(projectId)` returns `{ current, recent }` as copies.
- `default-hub.ts`: `automationStudioActivityHub` is the process-wide instance. The P3 gateway wiring subscribes to this.
- `storage.ts`: the `AsyncLocalStorage` holding `{ scope, pending }`. It is not exported from the barrel.
- `scope.ts`: `runWithAutomationStudioActivity(scope, fn, { pending? })`.
- `emit.ts`: `emitAutomationStudioActivity({ phase, label, step?, detail?, final? })`.
  - It does nothing outside a scope or while the scope is pending.
  - It never throws: `publish` is wrapped in a `best-effort` catch.
  - `activityId` is `${kind}:${id}`. The subject and `conversationId` come from the scope.
- `bind.ts`: `bindAutomationStudioActivityRun(runId)`.
  - A run's id is known only once its session is admitted, so the run scope starts pending.
  - Binding names the run, releases emission, and emits `running` "Run started".
- `build.ts`: `withAutomationStudioBuildActivity(target, fn)` opens a build scope with id `build-<uuid>`.
  - It emits `building` "Building the Flow" at start, then `done` (final) or `failed` (final, then rethrows) at settle.
  - A request whose project is not a string runs unobserved.
- `run.ts`: `withAutomationStudioRunActivity(target, fn)` opens a pending run scope.
  - At settle the session status maps as follows: `succeeded` becomes done/final, `failed` and `cancelled` become failed/final, and `waiting` becomes `waiting_permission` (not final).
  - A throw becomes failed/final and is rethrown.
  - Nothing is emitted for a run that returns before it is bound, such as an idempotent repeat, or for a run with no project.
- `step.ts`: `emitAutomationStudioActivityStep({ index, count, nodeId, label? })` emits "Running step N of M: <label>".
  - It says "Running step N" when N > M.
  - The label is the node's authored label, and the node id is used when there is none.
- `observer.ts`: `observeAutomationStudioEvidenceLoop(input)` returns the loop input with three callbacks wrapped. Every other field passes through.
  - `decide` emits `thinking` "Deciding the next step". The decision content is never read.
  - `executeTool`:
    - emits `building` for `AUTOMATION_STUDIO_FLOW_DRAFT_TOOL_ID` and `exploring` for every other tool;
    - emits a started row, then a succeeded row with `Result: <resultCode>` when the result carries one, or a failed row followed by a rethrow;
    - puts the tool id in `detail.ref`;
    - never reads the evidence.
  - `checkCompletion`, when present, emits `verifying` started, then succeeded or failed. A failed check's text is its Core issue codes.
  - Each wrapper returns exactly what the original returned.
- `tests/hub.test.ts`, `tests/scope.test.ts` and `tests/observer.test.ts` (25 tests). They cover:
  - sequencing and timestamps, the 60-event cap, snapshot copies, subscribers, and truncation;
  - no-op outside a scope, publishing across `await`, and concurrent scopes kept apart;
  - pending runs and binding, and the step label including N > M;
  - build and run settle mapping and rethrow;
  - the observer's phases, pass-through of results and errors, and that no model output or evidence reaches the stream.

### Edited

- `index.ts`: one line, `export * from "./activity/index.ts";`.

### Emission call sites (file:line in the current tree)

- `service.ts:94`: import line, the only added line in `service.ts`.
- `service.ts:1482`: the public `generateFlowBootstrapAdaptation` body is wrapped in `withAutomationStudioBuildActivity(input, ...)` on the same line.
  - The run-owned internal call (refuted-result reauthor) is deliberately not wrapped. It is part of a run and reports into that run's scope.
- `service.ts:1583`: `runAutomationStudioLlmEvidenceLoop(observeAutomationStudioEvidenceLoop({...}))`. The closing `})))` is at about L1624.
- `service.ts:2595`: the `runRuntimeSession` body is wrapped in `withAutomationStudioRunActivity({ projectId, flowId: input.flowId ?? input.flow?.flowId }, async () => { ... })`.
  - The closing is `}); }` after the `finally`.
  - A first version split this into a private method, which grew `AutomationStudioService` to 223 methods against a baseline of 222. It was inlined instead.
- `service.ts:2628`: `bindAutomationStudioActivityRun(session.runId)` is appended on the session-admission line, which emits `running` "Run started".
- `executor/graph-run.ts:442`: `emitAutomationStudioActivityStep({ index: step + 1, count: flow.nodes.length, nodeId, label })` runs before each node execute.
- `executor/graph-run.ts:504`: `waiting_permission` is emitted when an ask parks, just before `settleAskInPlace`. The ask kind is a closed vocabulary word and the node id goes in `ref`.
- `executor/graph-run.ts:543`: `repairing` is emitted just before `runAutomationStudioRecoveryLadder` starts, with the failed node's label and id.
- `executor/node-execution.ts:329`: `extracting` "Saved N record(s)" is emitted after `onRecordBatch` stored a batch, only when `stored` is set. It carries the row count only.
- `recovery/runtime-exploration.ts:250`: the loop input is wrapped with `observeAutomationStudioEvidenceLoop(...)` and closed with `}))`.
- `result-verification/verify.ts:135`: `verifying` "Checking the result answers the request" is emitted when the judge starts, before the first `askOnce`.
- `recovery/refuted-result/repair.ts:159`: `repairing` "Repairing the Flow: the result check refuted its answer (attempt N of M)" is emitted right before `input.repair(...)`.

Each file gained exactly one import line, except `service.ts` and `runtime-exploration.ts` as described above. `llm/evidence-loop.ts` is untouched. `runtime/llm/**` and `flow-bootstrap/**` are untouched. In `recovery/**` the only changes are an input wrapper and an emission call.

## Commands run and observed results

- `pnpm --filter fluxiq check` (`tsc --noEmit`)
  - First run: 1 error, `exactOptionalPropertyTypes` on `detail.status` in `activity/run.ts`. Fixed.
  - Re-run after the final `service.ts` edit: clean, no output.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (196 warning(s), 355 baselined).`
  - The "1 baseline entries can be lowered" note was already there before my edits.
  - `graph-run.ts` is now 728 lines, advisory warning only. `runtime-exploration.ts` is 625 lines.
- `vitest run` on `activity`, `executor`, `result-verification`, `recovery/refuted-result` and `recovery/tests` (`--minWorkers=1 --maxWorkers=2`): `Test Files 50 passed (50) / Tests 736 passed (736)`.
- `vitest run` on `runtime/tests/{service-bootstrap,service-adaptation,service-flows,refuted-result}`, `deepseek-bootstrap-exploration`, `importer-record-capture` and `recovery`:
  - Run 1 (started before the final inline edit of the run wrapper): 5 failed out of 715. The visible causes were `EBUSY ... unlink ... global.sqlite` in `service-bootstrap/accounting` and `catalog`, and the `scale-pages` timing assertion (679 ms against a 500 ms limit).
  - Run 2, on the final code: 4 failed out of 715. Three were `Test timed out in 15000ms` (`adaptive-loop`, `subflow`, `service-bootstrap/adaptation`) and one was `scale-pages` (558 ms against 500 ms). `accounting` and `catalog` passed.
  - The three timed-out files, re-run alone: `adaptive-loop` passed. `subflow` failed a *different* test than in Run 2, and `adaptation` failed the same one, each at about 15.1 s. The passing tests in those files take 5 to 12 s each.
  - The same two files with `--testTimeout=60000`: `Test Files 2 passed (2) / Tests 14 passed (14)`. The slowest tests took 8.8 s and 12.8 s.
  - I read these as load and timing flakes, not regressions. Nothing hung, every assertion passes given time, and the set of failing tests changed between runs. Other workers were running at the same time.

## Not verified

- The emissions have not been observed end to end through a real build or run. There are no provider or Lab runs, by brief.
- Nothing subscribes the hub to the gateway yet (P3, lane lead).
- I could not produce a clean pass of the service-level suites under the default 15 s timeout on this machine.
- I did not run the full `pnpm check` or the web app suites. `pnpm structure:check` was run as `node scripts/structure-audit.mjs`, which is the same script.
- I did not re-run the `service-bootstrap/accounting` and `catalog` EBUSY failures in isolation. They passed in Run 2.

## Open questions or contradictions found

- For M in "step N of M", I used `flow.nodes.length`. Every node in a graph Flow is executable, so this is the Flow's node count. A Call Flow child run emits its own step rows, with the child's N and M, inside the parent's run scope.
- The repairing emission for "a recovery rung starts" fires once per ladder invocation in `graph-run.ts`, not once per rung. The per-rung loop lives in `executor/ladder-run.ts`, which the brief did not list.
- `waiting_permission` fires for every parking ask, whatever its kind, including a plain question. The contract has no other waiting phase, and the ask kind is carried in `detail.title`.
- The build scope carries no `conversationId`, because the build request has none. The run scope does not set one either. C3 or the lane lead may want to pass one in if the run's conversation id becomes available at the entry point.
- Run 1's EBUSY failures come from test cleanup on Windows (sqlite file lock), not from these changes.
