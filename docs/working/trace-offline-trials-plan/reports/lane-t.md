# Report: lane-t (t729 traces-offline-trials)

## Outcome
In progress. Lead started 2026-10-19.

## Plan

Plan of record: Core `docs/working/trace-offline-trials-plan.md` and its consultant source (tests T01-T24).
Trees: downstream `fxwork/t729/!FluxIQWebExtension`, Core `fxwork/t729/!FluxIQ`, both on
`task/t729-traces-offline-trials`. L1 (t724) not merged into Core `dev` at start (`git log dev --oneline | grep -c
"Merge task t724"` -> 0), so P1 stops at the port: no edit to the executor, `llm/evidence-loop.ts`, or any L1 file.

Units, each partitioned by file, workers in the foreground:

| Unit | Phase | Worker | Owns | Depends on |
| --- | --- | --- | --- | --- |
| U1 build-time baseline | P0a | worker | downstream `packages/test-runner/src/build-time/**` | none |
| U2a gateway inventory | P0b | worker-high | report only (read-only investigation) | none |
| U2b runtime client ports map | P0b | worker-high | report only (read-only investigation) | none |
| U5 offline-trial result contract | P1 | worker | Core `programs/automation-studio/model/offline-trial/**` | none (fully specified by the plan) |
| U3 page-snapshot spike | P0c | worker-high | downstream `apps/extension/e2e/content/tests/snapshot-fidelity/**` | U2a (what the extension sends) |
| U4 trace contract (manifest, envelope, completeness) | P1 | worker-high | Core new trace directory, placed after U2a's capture-boundary decision | U2a |
| U6 environment port + non-browser fixture adapter | P1 | worker-high | Core new environment directory; unit-test fixture adapter in its `tests/` | U2b, U4 |
| U7 wiring the port into executor / evidence loop / trial runner | P1 | - | waits for L1's merge (t724) | L1 |

Wave 1 (parallel): U1, U2a, U2b, U5. Wave 2 (parallel): U3, U4, then U6. U7 is reported as remaining.

Spike placement note: the brief names `packages/test-runner/` or `scripts/lab/`; the spike reuses the extension's own
content harness (`apps/extension/e2e/content/harness.ts`: the real content-script bundle on a Scenario Lab realistic
fixture), so it lives beside it as test infrastructure in a new `tests/snapshot-fidelity/` directory. No other lane
owns that directory.

## Worker briefs

Wave 1, dispatched 2026-10-19 in parallel. Build hygiene common to all: Core's worktree is edited by U5 while U1
compiles downstream, so downstream package scripts gated by `scripts/check/core-build.mjs` may refuse a stale Core
build; downstream workers compile with `tsc` directly against the existing Core `dist` and never rebuild Core; Core
workers typecheck with `--noEmit` and never rebuild Core's `dist` while another worker compiles against it.

### Brief: lane-t-u1-baseline (worker)
- Repository: downstream t729 tree. Task: a Lab script reading per-step run files (`steps/NNNN-*/meta.json`) that reports,
  per run and overall, the share of build wall time in live trials, site resets, exploration and model calls, run over
  the ~25 most recent live runs under `C:/Users/osrs_/FluxStuff/lab-runs/` (read-only). Owns
  `packages/test-runner/src/build-time/**` (+ one barrel line in `src/index.ts` only if the audit needs it). Report
  `reports/lane-t-u1-baseline.md`.

### Brief: lane-t-u2a-gateway-inventory (worker-high)
- Repositories: Core and downstream, read-only. Task: inventory of every client message type Core's client gateway
  accepts and every command it sends, what each carries, everything Core dereferences later, reads/effects bypassing
  the gateway, and a proposed capture boundary plus the trace contract's placement. Owns only its report
  `reports/lane-t-u2a-gateway-inventory.md`.

### Brief: lane-t-u2b-runtime-ports (worker-high)
- Repository: Core, read-only. Task: how the executor, the evidence loop and the trial runners reach the client, the
  clock, randomness and model calls; where they converge; the smallest single environment port and the call sites U7
  switches after L1 (marking L1-owned files); what a non-browser fixture adapter must implement. Owns only its report
  `reports/lane-t-u2b-runtime-ports.md`.

### Brief: lane-t-u5-result-contract (worker)
- Repository: Core t729 tree. Task: the offline-trial result contract (verdict, evidence origins, scope, candidate
  revision, goal contract version, source episodes, supported operations, assertions, closed reason codes, missing
  evidence) as types plus pure functions: validation, live-success eligibility, whole-run-gate eligibility, live-episode
  tally (T19), provenance of derived results (T24). Owns new `packages/fluxiq/src/programs/automation-studio/model/offline-trial/**`
  and one export line in `model/index.ts`. Report `reports/lane-t-u5-result-contract.md`.

(Full brief texts are the dispatch prompts; the lines above are their summaries.)

Wave 2, dispatched 2026-10-19 in parallel after U2a/U2b (decisions D1-D4 below). Hygiene: U4 and U6 edit Core at
the same time, so each is told the other's paths and that type or audit errors there are not its own; U3 runs the
content harness straight through `node scripts/test-content.mjs` (bypassing the Core-build gate, never rebuilding Core).

### Brief: lane-t-u3-snapshot-spike (worker-high)
- Downstream. Task: the page-snapshot spike: capture realistic Scenario Lab pages in the provider-free content
  harness by page capture (CDP MHTML) and by DOM serialization; reload each in a sandboxed headed browser with page
  scripts and network off; run the extension's own page view, list read and target resolution; measure agreement
  with the live result on at least three realistic sites, plus sizes and what did not survive. Owns
  `apps/extension/e2e/content/tests/snapshot-fidelity/**`. Report `reports/lane-t-u3-snapshot-spike.md`.

### Brief: lane-t-u4-trace-contract (worker-high)
- Core. Task: `client-gateway/trace/`: `ClientGatewayTrace*` manifest, event envelope (raw-text inbound payloads),
  completeness evaluator, sink port, in-memory recorder (synchronous sequence, immutable copies, visible failures,
  bounded buffer) and store interface with indexed reads; tests T01, T04, T14 and recorder failure. Owns that
  directory and one export line in `client-gateway/index.ts`. Report `reports/lane-t-u4-trace-contract.md`.

### Brief: lane-t-u6-environment-port (worker-high)
- Core. Task: `AutomationStudioRunEnvironment` (kind, now, delay, random, newRunId, within) in
  `programs/automation-studio/runtime/environment/` with live, virtual-clock and scoped implementations; the
  domain-neutral `ClientGatewayChannelScopeSource` in `client-gateway/service/channel-scope/` read by the gateway's
  session view and command admission; attaching a scoped session; the bridge never records from a scoped session;
  wiring the source in `programs/_shared/runtime.ts`; a non-browser fixture adapter (unit tests only) driving one node
  through the production executor and graph options inside the scope, proving isolation (T20 at unit level). Report
  `reports/lane-t-u6-environment-port.md`.

## Decisions (lead, 2026-10-19, from U2a and U2b)

- D1 Capture boundary (P0 gate): capture inside `ClientGatewayService` through one injected `ClientGatewayTraceSink`:
  raw inbound text at `ClientGatewayInbound.receiveRaw` before `JSON.parse`, then its disposition; connect,
  disconnect and pairing lifecycle; every outbound message at `ClientGatewayTransport.send`/`sendChecked`/
  `sendUnqueued` plus lease refusals; Core-synthesized timeout, close and uncertain outcomes; one gateway-wide delivery
  sequence assigned synchronously on entry. Excluded: WebSocket framing and upgrade (never reach `receiveRaw`),
  `server.activity` (display-only, nothing answers it), token values (a declared credential marker). Inputs that
  bypass the gateway are captured by Core where it accepts them, into the same trace as named streams: paired-client
  HTTP `append-turn`, `answer-ask` and run control; the screenshot PUT as content-addressed, pinned artifact events;
  the candidate start hook's answer. Replay prerequisites (P3/P4): an id source for non-durable command and message
  ids, and a timer source beside `config.now`. Evidence: `reports/lane-t-u2a-gateway-inventory.md` section 5.
- D2 One trace with named streams, gateway-owned contract (answers U2a open question 1): the manifest stays
  domain-neutral; run-level context (task inputs, goal contract version, candidate) is an opaque, schema-named
  `context` object the program supplies. Placement `packages/fluxiq/src/client-gateway/trace/`, `ClientGatewayTrace*`
  names, exported from `client-gateway/index.ts`, never from the browser-entry `contracts.ts` (`runtime/trace/`
  would close an import cycle; "trace" already names executor files).
- D3 Environment port: the plan's premise "already go through one interface" is false above the domain (four
  domain-supplied ports: effect dispatcher, native node runtime, host runtime, evidence binding); every command meets
  only at the gateway's command channel. So the port is `AutomationStudioRunEnvironment` (clock, delay, random, run
  ids, `within`) plus a gateway channel scope read ambiently, the way the host lease already is: inside a scope the
  gateway sees and admits only that scope's sessions (a trace matcher in P4, a scripted fixture in tests); outside,
  scoped sessions are invisible and unreachable. Live is today's fallbacks. Evidence:
  `reports/lane-t-u2b-runtime-ports.md` sections 2 and 4.
- D4 P1 stops before consumer threading. Not now: `graph-options.ts`, the trial ports built in Automation Studio's
  `runtime/service.ts` (lane S is editing it), `candidate-trial/*`, and the L1 files `subflow-trial/run.ts`,
  `trial-gate.ts`, `brief-ports.ts`. These are U7, listed under "Remaining wiring".

## Progress log
(dated entries: what changed, check command and observed output; `UNIT READY: <files>` closes a commit-sized unit)

### 2026-10-19 - U1 build-time baseline (P0a), verified by the lead
- Changed (downstream): `packages/test-runner/src/build-time/` (types, interval-set, category-rules, classify-step,
  read-step-timings, measure-build-time, find-recent-runs, aggregate-build-times, render-build-time-table, cli, index;
  tests interval-set, measure-build-time, find-recent-runs). Worker report `reports/lane-t-u1-baseline.md`.
- Result over the 25 newest runs with steps (219.8 build minutes, 129 trials), time-weighted: live trials 49.8%, site
  resets 0.6% (lower bound: Core's in-trial resets emit no span, so they count as trial), model calls 24.3%,
  exploration 22.3%, other/idle 3.0%. Run-weighted: 35.6 / 0.9 / 30.8 / 28.3 / 4.3. Model (judge) time inside trials:
  6.7% of trial time. Social build run-mvfq957o-40103539: 25.05 build min, 20.50 in 7 `core.test_subflow` trials,
  longest 336.8 s -- matches the supervisor's figure.
- Lead's checks: `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` -> `tsc exit 0`;
  `node --test packages/test-runner/dist/build-time/tests/*.test.js` -> `# tests 8 # pass 8 # fail 0`;
  `node packages/test-runner/dist/build-time/cli.js --limit 25` -> overall table `trial 109.4 49.8% 35.6%` ...
  `other 6.6 3.0% 4.3%`, unknown kinds none; downstream `node scripts/structure-audit.mjs` ->
  `structure-audit: passed (213 warning(s), 638 baselined).`
- Follow-up for the plan: Core should emit a reset span inside `core.test_subflow` / `core.test_candidate` so the reset
  share inside trials can be measured (resets stay live even when trials go offline).
- UNIT READY: downstream `packages/test-runner/src/build-time/**`, `docs/working/trace-offline-trials-plan/reports/lane-t-u1-baseline.md`

### 2026-10-19 - U5 trial evidence result contract (P1), verified by the lead
- Changed (Core): new `packages/fluxiq/src/programs/automation-studio/model/offline-trial/` (vocabulary, types,
  validate-trial-evidence-result, live-success-eligibility, whole-run-gate-eligibility, live-episode-tally,
  derived-provenance, index; 5 tests + builder) and one export line in `model/index.ts`. Type
  `AutomationStudioTrialEvidenceResult`: verdict, evidenceOrigins, scope (`supplied_state|segment|full_recorded_path|
  full_live_run`), candidateRevision + candidateDigest (the trial gate's pair), goalContractVersion, sourceEpisodeIds,
  liveEpisodeId, supported, assertionsChecked, closed reasonCodes, missingEvidence, provenance (`original|derived`).
  Live success only for an original, live-only, full_live_run pass with its episode; whole-run gate additionally binds
  revision, digest and goal contract (an offline pass never satisfies it); tally deduplicates by live episode (T19);
  export/ingest always derived (T24). Lead reviewed the eligibility, tally and provenance code: correct.
- Lead's checks (Core t729): `pnpm exec vitest run src/programs/automation-studio/model/offline-trial` ->
  `Test Files 5 passed (5)  Tests 47 passed (47)`; `pnpm --filter fluxiq check` -> `check exit 0`; `node
  scripts/structure-audit.mjs` -> `structure-audit: passed (407 warning(s), 1152 baselined).`
- UNIT READY: Core `packages/fluxiq/src/programs/automation-studio/model/offline-trial/**`,
  `packages/fluxiq/src/programs/automation-studio/model/index.ts`; downstream `reports/lane-t-u5-result-contract.md`

## Not verified

## Open questions or contradictions found
