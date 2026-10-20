# Report: lane-t-p2-w1-episode-wiring (t736, Core worktree `fxwork/t736/!FluxIQ`)

## Outcome

Done. With `FLUXIQ_CLIENT_GATEWAY_TRACE` on, the host builds and installs the trace episodes, hands the client gateway
its `trace` source, and records the candidate start hook. Builds, normal runs and both kinds of trial each open their
own episode (D9). Each build uses its episode id as its build id. With tracing off, nothing is built or passed, and the
wrappers run exactly the code that ran before. Typecheck, the brief's tests and the structure audit all pass.
Nothing is committed.

## What changed and why

AS = `packages/fluxiq/src/programs/automation-studio`.

- **`AS/runtime/gateway-trace/episodes.ts`** (additive; existing API and tests unchanged):
  - The async-context frame is now `{ open, parent, pending }`.
  - New `runPending(work)` and `bindPending(episode)`. A run is named only once its session is admitted (`service.ts`
    ~:2478), so the run opens a pending frame and names it at bind. Until it is named, the frame records into the
    parent episode.
  - The manifest `context` is now screened with `screenAutomationStudioGatewayTracePayload` before it is stored (D15).
    Before this change the context reached the store raw.
  - `bindPending` returns void. A version that returned `undefined` from its `catch` tripped the `failure-as-empty`
    rule.
- **New `AS/runtime/gateway-trace/wiring/`** (13 files, with its own barrel). It is deliberately not re-exported from
  `gateway-trace/index.ts`. That barrel is read by the HTTP handlers and the parking port (lane w2). Re-exporting
  wiring through it gave a 357-module import cycle and `browser-imports` failures. The parent barrel is now exactly as
  lane R left it.
  - `host.ts`: `createAutomationStudioGatewayTraceHost({ enabled, pool, options? })` → `{ episodes, source,
    startHook, uninstall }`.
    - Off: returns a frozen object that does nothing.
    - On:
      - builds `AutomationStudioGatewayTraceEpisodes` with `gatewayStreams = Object.values(CLIENT_GATEWAY_TRACE_TAP_STREAMS)`;
      - records contract versions `client-gateway.protocol` (`CLIENT_GATEWAY_PROTOCOL_VERSION`),
        `client-gateway.trace-schema` and `client-gateway.trace-capture-boundary`;
      - flushes every 256 events or every 1 s;
      - installs the episodes through `AutomationStudioGatewayTraceInstallation.install`, whose API is unchanged.
    - If episodes are already installed in the process (a second runtime), it logs once and traces nothing.
    - Without a pool (no project storage), traces are kept in memory.
  - `service-pools.ts`: `AutomationStudioGatewayTraceServicePools.adopt(owner, pool)` / `.of(owner)`, held in a
    WeakMap. The service's pool is private and `service.ts` is frozen, so the service hands its pool over inside the one
    expression that creates it. This gives traces the service's own pool, and a project never gets a second
    connection.
  - `project-store.ts`: `AutomationStudioGatewayTraceProjectStore implements ClientGatewayTraceStore`.
    - Each operation opens `AutomationStudioProjectGatewayTraceStore` over the pool, runs, and closes again. The
      episodes pick a store synchronously, but the SQLite store opens asynchronously and holds a lease.
    - It imports from `storage/project/gateway-trace/index.ts`, not the storage barrel, which would close a cycle.
  - `start-hook.ts`: wraps `prepareCandidateStart`. Each call records a `control.start_hook_answer` event into the
    calling episode:
    - the request identity: project, Flow, candidate, revision, digest, startLocation, and the lease by
      resourceKey/epoch/sessionId/holder;
    - then either the answer, or only the error's kind on failure.
    - The token never reaches it.
  - `build-activity.ts`: `withAutomationStudioGatewayTraceBuildActivity(target, sources, fn)`.
    - Wraps `withAutomationStudioBuildActivity`.
    - When tracing is installed, it mints `build.<uuid>` and opens an `exploration` episode with context
      `{ kind, buildId, flowId, authoringMode, mode, evidenceGuided, startLocation, instructions, conversation }`.
  - `build-id.ts`: `automationStudioGatewayTraceBuildId()` returns the ambient episode id when that episode is an
    exploration with a `build.` id. Otherwise it returns a fresh `build.<uuid>`, so a repair build inside a run gets a
    fresh id.
  - `run-activity.ts` / `run-bind.ts`:
    - `withAutomationStudioGatewayTraceRunActivity(target, fn, options)` has the same signature as
      `withAutomationStudioRunActivity` and enters the pending frame.
    - `bindAutomationStudioGatewayTraceRun(session, { inputs, conversations })` calls
      `bindAutomationStudioActivityRun`, then names the frame as an `execution` episode under the run id. Its context is
      the run's input plus the turn.
  - `trial.ts`: `withAutomationStudioGatewayTraceTrial(trial, work)`.
    - Mints `newRunId?.() ?? (environment ?? live).newRunId(prefix)` and opens a `test` episode under that id.
    - Hands `work` a minter that answers that id.
    - With nothing installed, it hands `work` `undefined` and mints nothing.
  - `conversation-turn.ts`: reads the ambient chat thread (`conversations/context`) and pages through the stored thread
    to the last turn the person wrote.
  - `stored-instructions.ts`: the Flow's stored instructions (id, title, body, scope, status, requirement), or
    `{ read: false, failure: <kind> }`.
  - `context-schemas.ts`, `types.ts`, `index.ts`.
- **`programs/_shared/runtime.ts`**:
  - `createAutomationStudioGatewayTraceHost({ enabled: automationStudioClientGatewayTraceEnabled(process.env), pool:
    () => AutomationStudioGatewayTraceServicePools.of(automationStudio) })`.
  - `prepareCandidateStart = gatewayTrace.startHook(...)`.
  - `...(gatewayTrace.source ? { trace: gatewayTrace.source } : {})` on `ClientGatewayService`.
- **`AS/runtime/service.ts`**, in place only. It went from 4318 to 4316 lines, with no new methods and no packed
  statements:
  - line 97: removed `bindAutomationStudioActivityRun`, `withAutomationStudioBuildActivity` and
    `withAutomationStudioRunActivity`. Each was used only at the sites below.
  - :112: joined the 4-line `recording-flow-proposal` import onto one line and added one import line from
    `./gateway-trace/wiring/index.ts`.
  - :438: `this.runtimeProjectDatabasePool = AutomationStudioGatewayTraceServicePools.adopt(this, new AutomationStudioProjectDatabasePool({...}))`.
  - :1492: `withAutomationStudioGatewayTraceBuildActivity(input, { instructions: () => this.getFlowInstructionSet({...}), conversations: this.conversations }, () => ...)`.
  - :1566: `buildId = automationStudioGatewayTraceBuildId()`.
  - :2450: `withAutomationStudioGatewayTraceRunActivity(...)`.
  - :2478: `await bindAutomationStudioGatewayTraceRun(session, { inputs: input.inputs, conversations: this.conversations });`.
- **`candidate-trial/port.ts`, `subflow-trial/port.ts`**:
  - A trial that actually runs goes through `withAutomationStudioGatewayTraceTrial`, with context `candidate_trial`
    (candidateId, revision, digest, start) or `subflow_trial` (buildId, briefId, subflowKey, revision, digest, start).
  - The runner gets `newRunId === undefined ? ports : { ...ports, newRunId }`.
  - A re-judgement, an identity mismatch or another build's request opens no episode.
  - `run.ts` was not touched.
- **Tests** (all new; no existing test edited):
  - `gateway-trace/tests/pending-episodes.test.ts` (4 tests): pending frames, and screening of the context.
  - `gateway-trace/wiring/tests/episode-wiring.test.ts` (9 tests):
    - the build id equals the episode id;
    - the build context holds the instructions and turn 3 (the last person turn), read across pages;
    - unreadable instructions are recorded as unread;
    - with nothing installed, nothing is read and a fresh id is minted;
    - a repair build inside a run gets a fresh id;
    - run naming, and run off;
    - start hook recording, with no leak of the failure message;
    - host off: nothing built, installed or passed, and the hook is returned unchanged;
    - host on: installed once, and a second host traces nothing.
  - `gateway-trace/wiring/tests/gateway-tap-episodes.test.ts`, T02 and T03:
    - Uses the fixture-client pattern with the production executor, graph options, RuntimeService and gateway
      transport.
    - SQLite goes through the host over a temp pool with the service's 1 s idle grace.
  - `service/tests/trial-episodes.test.ts` (5 tests):
    - A candidate trial nested in a build:
      - the trial runs as `trial.1`, its own trace (test);
      - the build trace holds `start_hook_answer`, `child_episode_opened` (naming trace-2/trial.1) and
        `child_episode_closed`;
      - the trial trace has no hook event.
    - A re-judgement opens no episode.
    - With tracing off, the ports are unchanged.
    - Two concurrent subflow trials each get their own trace, and the build gets 2+2 markers.
    - This test sits in `service/tests/` because adding it to `candidate-trial/tests/` took that directory to 26
      files, past the 25-file limit. Its subjects are both ports.

## Commands run and observed results

From `packages/fluxiq`, unless noted.

- `pnpm exec tsc --noEmit` → no output; `tsc exit 0`. This was the last run, after all edits.
- `pnpm exec vitest run src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/service/subflow-trial src/programs/automation-studio/runtime/environment src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/service/tests/trial-episodes.test.ts`
  - `exit 0`, `Test Files 66 passed (66)`, `Tests 411 passed (411)`.
  - The brief's five paths, without the extra file, gave `Test Files 67 passed (67)` / `Tests 411 passed (411)`
    before the trial test moved out of `candidate-trial/tests/`.
- T02 printed line, final run, warm, under the parallel suite:
  `T02 overhead (warm; the traced time includes opening, flushing and closing the trace in SQLite): 12 commands;
  untraced 10.8 ms, traced 47.6 ms (3.07 ms per command); 36 events stored, 32436 bytes (2703 per command; 5043 bytes
  sent)`.
  - Two isolated runs gave untraced 13.3 ms / traced 74.6 ms and untraced 5.1 ms / traced 23.9 ms.
  - The ms-per-command figure includes the fixed per-trace cost (store open, manifest writes, final flush) and is
    noisy.
  - With the pool's idle grace at 0, a traced run cost about 150-190 ms, because the project database reopened and
    re-checked migrations on every store operation. The service's pool keeps the 1 s grace.
- From the repository root, `node scripts/structure-audit.mjs` → `exit 0`, `structure-audit: passed (420 warning(s),
  1152 baselined)`, and `1 baseline entries can be lowered` (`service.ts` file-lines 4316 < 4318).
  - I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is not mine.
  - An earlier audit run showed 290 import-cycle and 101 browser-imports failures. All of them ran through
    `parking/conversation-port.ts` → `gateway-trace/index.ts`, which is w2's file, with my wiring then re-exported
    from that barrel. Moving the wiring into `wiring/` cleared them, and the last run has none.

## Not verified

- No live run and no Lab run. Core's build and dist were not run, as the brief requires.
- I did not test `createGlobalProgramRuntime` with tracing on end to end. The host function it calls is unit-tested, and
  `tsc` checks the wiring.
- I did not execute the `service.ts` build, run and bind sites through the service. The wrappers are tested directly.
  The project-build and flow-bootstrap suites in the command above pass with tracing off. No test exercises
  `AutomationStudioService` with episodes installed.
- The start hook stays in the build's trace only when the trial gate prepared the start (`prepareStart`, the
  production path since t475/t578). A trial whose gate did not prepare one runs the hook inside `run.ts`, which is now
  inside the trial's episode. Fixing that needs `run.ts` (t737).
- The overhead was measured in-process with a scripted client only. D17's `pnpm lab replay` measurement was not run.

## Open questions or contradictions found

- The brief says "no new lines" for `service.ts`. Adding the import line was offset by joining a 4-line import, so the
  file is 2 lines shorter. The baseline can be lowered by the supervisor.
- `gateway-trace/index.ts` (lane R's parent barrel) does not re-export `wiring/`. Consumers import
  `gateway-trace/wiring/index.ts`. Lane w2 should keep importing the light parent barrel, or its import graph pulls
  storage and activity in again.
- A second `createGlobalProgramRuntime` in a process with tracing on traces nothing for that runtime, and says so on
  stderr. Episodes are installed process-wide (the static installation) and route each trace to a service's pool.
