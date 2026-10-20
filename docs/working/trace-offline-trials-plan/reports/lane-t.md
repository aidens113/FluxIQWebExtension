# Report: lane-t (t729 traces-offline-trials)

## Outcome
Partial (2026-10-19): P0 done (baseline, inventory and capture-boundary decision, snapshot spike) and P1 done up to
the stop point (trace contract, result contract, environment port with gateway channel scope, non-browser and
trace-fed fixtures). Consumer wiring (U7) waits for L1 (t724), not merged into Core `dev`; listed under
"Remaining wiring".

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
- (Supervisor committed U1 and U5 on t729: downstream 132a0ebb, Core 4d9a6b4c.)

### 2026-10-19 - U2a gateway inventory and U2b runtime ports map (P0b), read by the lead
- Read-only reports `reports/lane-t-u2a-gateway-inventory.md` (inbound/outbound message tables, deferred reads,
  bypasses, capture boundary, placement) and `reports/lane-t-u2b-runtime-ports.md` (four domain ports, convergence at
  the gateway command channel, clocks/ids/model injection, the port proposal, call sites #1-#18 with L1 marks). The
  lead read both in full; decisions D1-D4 above rest on them. P0 gate (inventory complete, capture boundary written
  down as a decision) is met by D1 + U2a section 5.
- Findings that change the plan, for the supervisor: (1) not everything arrives through the gateway: the chat
  instruction and on-screen context (`append-turn`), ask answers, stop/pause/resume, the screenshot PUT and the Lab's
  candidate start hook reach Core over HTTP; (2) replay needs an id source (non-durable command and message ids are
  `randomUUID`) and a timer source beside `config.now`; (3) one socket's frames are processed concurrently, so
  offline intake must reproduce that or serialize and declare it; (4) the extension's offline queue re-mints envelope
  id and timestamp on flush, which Core reads downstream -- lane G's queue fix should send the original envelope;
  (5) `server.capture_snapshot` has no correlation id (builds use the in-band `web.dom.capture_snapshot` action); (6)
  the plan's "already go through one interface" is false above the domain (D3).
- UNIT READY: downstream `reports/lane-t-u2a-gateway-inventory.md`, `reports/lane-t-u2b-runtime-ports.md`, this report

### 2026-10-19 - U4 trace contract (P1), verified by the lead
- Changed (Core): new `packages/fluxiq/src/client-gateway/trace/` (versions, vocabulary, completeness-vocabulary,
  types, clone-json, artifact-digest, evaluate-completeness, derived-origin, recorder, memory-store, index; 6 tests +
  builders) and one export line in `client-gateway/index.ts`. Manifest, event envelope (raw-text inbound payloads,
  deep-frozen JSON copies), completeness evaluator, `ClientGatewayTraceSink` + in-memory `ClientGatewayTraceRecorder`
  (synchronous contiguous sequence, immutable copies, visible failure, bounded buffer declaring losses),
  `ClientGatewayTraceStore` + memory store with indexed reads. Worker also proved tests can fail (broke the evaluator's
  loss handling and the recorder's byte copy; 3 and 1 tests failed; restored). Its Partial was only the audit blocked
  by U6's then-unfinished test file, since fixed.
- Lead decisions on its questions: D5 sequence numbering is per trace (contiguous from 1, shared by that trace's
  streams); P2 runs one recorder per traced episode and routes each gateway event to its trace. D6 redactions are
  fidelity limitations, a separate list, not completeness issues. D7 credential-bearing messages (`client.hello`,
  `server.session_ready`) are recorded in P2 as structured JSON with the token replaced by a declared credential
  redaction; their raw text is never stored; the lifecycle scope is a declared fidelity limitation and an offline
  intake stubs trusted-client resolution and replays the captured verdict (answers U2a open question 6).
- UNIT READY (with U6, one Core unit since both were validated together): see U6 entry.

### 2026-10-19 - U6 environment port, gateway channel scope, non-browser fixture adapter (P1), verified by the lead
- Changed (Core): new `client-gateway/service/channel-scope/` (source, visibility, admission, codes, refusal,
  refused-error; tests); `client-gateway/service/{types,views,commands,lifecycle,sessions,index}.ts`,
  `client-gateway/service.ts` (facade `attachScopedSession`, `isScopedSession`); `client-gateway/tests/channel-scope.test.ts`;
  `programs/automation-studio/client-gateway/bridge.ts` (never records from a scoped session) + `tests/bridge-scoped-session.test.ts`;
  new `programs/automation-studio/runtime/environment/` (environment, live, virtual-clock, scoped, channel-scope
  AsyncLocalStorage source; tests environment, fixture-run, fixture-client support); `programs/_shared/runtime.ts`
  (wires `channelScope` beside `hostLease`; no scope is entered yet, so live behaviour is unchanged).
- Lead review of the production diff: visibility is strict scope-id equality (live callers see only unscoped
  sessions); admission refuses a cross-scope target unsent before the lease stamp (action: classified failure result;
  durable and capture_snapshot: thrown, nothing claimed); scoped sessions are ready without pairing, never stored as
  trusted, get a minted client id, emit no `session.ready`; the bridge never appends recordings or entries from them.
  Fixture-run tests: result through the gateway's intake, live session never reached, cross-scope refusal (T20 unit
  level), invisibility outside the scope, occurrence matching, virtual-clock backoff without wall waiting.
- Lead's checks (Core t729, U4 + U6 together): `pnpm exec vitest run src/client-gateway
  src/programs/automation-studio/runtime/environment src/programs/automation-studio/client-gateway
  src/runtime/tests/client-gateway-transport.test.ts` -> `Test Files 37 passed (37)  Tests 263 passed (263)`;
  `pnpm exec tsc --noEmit` (uncached) -> `tsc exit 0`; `node scripts/structure-audit.mjs` ->
  `structure-audit: passed (407 warning(s), 1152 baselined).`
- For the supervisor: the gateway facade gained two methods (`attachScopedSession`, `isScopedSession`), an internal
  Core API change with no wire change; refusal codes `channel_scope.outside_scope` / `channel_scope.scoped_session`
  live in the kernel, not `@fluxiq/contracts`. `bridge.ts` is now 793 lines (limit 800): split it before it grows.
  Events from scoped sessions still reach global event-bus listeners (U2b #8): decide in P4 (the domain's
  GatewayInputHub needs confirmation events for the executor's output confirmations).
- UNIT READY: Core `packages/fluxiq/src/client-gateway/trace/**`, `packages/fluxiq/src/client-gateway/index.ts`,
  `packages/fluxiq/src/client-gateway/service/channel-scope/**`, `packages/fluxiq/src/client-gateway/service/{types,views,commands,lifecycle,sessions,index}.ts`,
  `packages/fluxiq/src/client-gateway/service.ts`, `packages/fluxiq/src/client-gateway/tests/channel-scope.test.ts`,
  `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`,
  `packages/fluxiq/src/programs/automation-studio/client-gateway/tests/bridge-scoped-session.test.ts`,
  `packages/fluxiq/src/programs/automation-studio/runtime/environment/**`, `packages/fluxiq/src/programs/_shared/runtime.ts`;
  downstream `reports/lane-t-u4-trace-contract.md`, `reports/lane-t-u6-environment-port.md`

### 2026-10-19 - U3 page-snapshot spike (P0c), verified by the lead with a fresh headed rerun
- Changed (downstream): new `apps/extension/e2e/content/tests/snapshot-fidelity/tests/` (snapshot-fidelity.spec.ts,
  list-pages, measure-page, compare-measurements, serialize-document, unpack-mhtml, offline-capture, arm-capture,
  element-path, page-census). Worker report `reports/lane-t-u3-snapshot-spike.md` (counts, sizes, tag and attribute
  names only). The supervisor's `probe.spec.ts` packing note: that file no longer exists (the worker removed it).
- Lead's rerun, started 20:17, after the 19:50 memory recovery: `node scripts/test-content.mjs -- --headed
  --workers=1 snapshot-fidelity` (apps/extension) -> `4 passed (11.3m)`, exit 0. All 8 offline loads:
  `leakedRequests 0`, `pageScriptsParsed 0`, canaries `null`, `contentScriptReady true`. `git status --short` -> only
  the spike directory and reports untracked (captures in the ignored `e2e/test-results/`).
- Result (rerun agrees with the worker's table): DOM serialization served at the original URL matched live on all
  four sites (job-board, photo-social, social-network-feed, everything-store): page view 299/1331/1855/927 elements
  all matched, read cells 180/180, 1161/1161, 1836/1836, 560/560, targets 17/17, 15/15, 16/16, 20/20. MHTML: read
  cells 180/180, 1127/1161, 1788/1836, 548/560; targets 17/17, 14/15, 16/16, 17/20 (absolute URL rewriting, lost
  form state and images; natively loaded MHTML blocks the content script's callbacks). Document size 6.7-18.1 KB gzip
  (DOM), up to 78.5 KB with carried images. Field differences on both methods: viewport visibility (likely scroll
  position), fixed-element geometry, script-attached listeners.
- Recommendation for P2/P5: capture by in-page DOM serialization plus a resource map, stored once per resource; the
  offline evaluator restores scroll, holds navigations (204), injects the content script in an isolated world, and
  declares gaps for rows a read loads by scrolling or load-more, listener-detected controls, fixed geometry, closed
  shadow roots, canvas and cross-origin frames.
- For the supervisor: possible product defect, live `web.dom.extract_list` on photo-social did not answer within 4
  minutes in 2 of about 6 runs (`timeoutMs: 30000`); worth a brief for the owner of `content/extraction`.
- UNIT READY: downstream `apps/extension/e2e/content/tests/snapshot-fidelity/**`, `reports/lane-t-u3-snapshot-spike.md`

### 2026-10-19 - U8 trace-fed fixture (P1), verified by the lead
- Changed (Core): new test files `programs/automation-studio/runtime/environment/tests/{trace-fed-run.test.ts,
  trace-fed-client.ts, recording-socket.ts}`. A recording run records the scripted fixture's exchange with the trace
  recorder (a stand-in for P2's gateway capture); an offline run answers from the store's indexed reads by action type
  + canonical parameters + occurrence, replacing only the command-id substring, through `gateway.receiveRaw` (the real
  decoder; spied). Same outcome; no other client reached; changed parameters get an evidence-gap failure and never the
  recorded success (T07 groundwork); occurrence matching (T08 groundwork); past the recorded occurrences ->
  `missing_transition`. With U4 and U6 this meets the P1 gate: a non-browser client expresses its runtime inputs
  through the trace contract and the environment port with no web field (the web-vocabulary audit rule also passes).
- Lead's checks: `pnpm exec vitest run src/programs/automation-studio/runtime/environment` -> `Test Files 3 passed
  (3)  Tests 17 passed (17)`; `pnpm exec tsc --noEmit` -> `tsc exit 0`; `node scripts/structure-audit.mjs` ->
  `structure-audit: passed (407 warning(s), 1152 baselined).`
- UNIT READY: Core `packages/fluxiq/src/programs/automation-studio/runtime/environment/tests/{trace-fed-run.test.ts,trace-fed-client.ts,recording-socket.ts}`
  (inside the U6 directory already listed); downstream `reports/lane-t-u8-trace-fed-fixture.md`

### 2026-10-19 - Stop point: L1 not merged
- `git -C C:/Users/osrs_/FluxStuff/!FluxIQ log dev --oneline | grep -c "Merge task t724"` -> `0` at 20:5x. Per the
  brief, P1 stops before consumer wiring; outcome Partial with the remaining wiring below.

## Remaining wiring (U7, after the supervisor merges dev with t724 into t729 and resumes the lane)

Call-site numbers from `reports/lane-t-u2b-runtime-ports.md` section 4 (lines will move after L1 merges).

| # | Site | Owner conflict | Change |
| --- | --- | --- | --- |
| 10 | `AS/service/runtime-session/graph-options.ts` | none | `environment` input sets `options.now/delay/random` |
| 11 | `AS/runtime/service.ts` trial environment (~1585) and normal run (~2501) | lane S edits this file | pass the live environment |
| 12-13 | `AS/service/candidate-trial/contracts.ts`, `run.ts` | none | `environment` port field; `now`/run id from it; wrap `execute` in `within` |
| 14 | `AS/service/subflow-trial/types.ts` | none | as 12 |
| 15 | `AS/service/subflow-trial/run.ts` | L1 | as 13 |
| 16 | `AS/flow-bootstrap/candidate/trial-gate.ts` | L1 | skip `prepareStart` and `reset.beforeTrial` when `environment.kind !== "live"` (Decision 6) |
| 17 | `AS/service/project-build/brief-ports.ts`, `whole-trials.ts` | L1 (brief-ports) | hand trials the phase's environment |
| 18 | `AS/flow-bootstrap/candidate/authoring-loop.ts`, `candidate/contracts.ts` | L1 | choose offline per trial in test/repair phases only: P6, not P1 |
| - | `client-gateway/service/inbound.ts` event emit (#8) | none | scoped sessions' events to global listeners: decide in P4 |
| - | `executor/region-execution.ts` raw `setTimeout` | none | take `options.delay` if P4's virtual clock needs it |
| - | gateway id source and timer source (U2a 5.1) | none | P3/P4 prerequisite for replay through the same path |

Evidence loop: no P1 change (exploration stays live, Decision 2); an offline-eligible repair call such as
`llm/node-tools/rerun-check.ts:130` runs inside `environment.within` in P5/P6. The executor itself needs no change:
it already reads `now/delay/random` from its options.

## Not verified

- No live or paid run (none allowed); the spike is provider-free on Scenario Lab pages, Chromium only, with a CDP
  isolated world rather than a real extension isolated world; Edge, Firefox and the other six realistic scenarios
  were not run.
- The reset share of build time is a lower bound: Core's in-trial resets emit no span (U1).
- A durable command that succeeds on a scoped session is untested (only its refusal); events from scoped sessions
  still reach global event-bus listeners.
- Nothing is wired to consumers yet: no production path enters a channel scope, so live behaviour is unchanged.

## Open questions or contradictions found

1. The plan's P1 premise ("the executor, the evidence loop and the trial runner already go through one environment
   interface") is false above the domain; D3 records the corrected design. The Core plan's P1 text should say so.
2. The capture boundary needs Core-side capture outside the gateway too (HTTP chat, asks, control, screenshot PUT,
   candidate start hook): the plan's Decision 4 says capture "at the client gateway"; D1 extends it.
3. Gateway facade gained `attachScopedSession` and `isScopedSession` (internal Core API, no wire change); the
   supervisor may want it recorded as a contract change in Core's client-gateway architecture doc.
4. `programs/automation-studio/client-gateway/bridge.ts` is at 793 of 800 lines.
5. Lane G: the extension's offline queue should send the original envelope (id, timestamp) rather than re-minting it.
