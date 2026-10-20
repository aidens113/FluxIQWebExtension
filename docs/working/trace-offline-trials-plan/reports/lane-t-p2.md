# Report: lane-t-p2 (t736 trace-capture)

## Outcome
In progress (lead started 2026-10-20 after U7, lane S, L1 and t733 merged: Core ca23a8ba, downstream 1e851216/628cc737).

## Plan

Brief `t736-trace-capture`: Core captures at the client gateway into the workspace's existing store through the same
intake it uses live, with indexed reads, explicit completeness and secret screening before storage, plus the ingress
that bypasses the gateway (D1: chat, asks, run control, screenshot upload, start hook). The extension puts in-band
anything Core later dereferences, captures page snapshots (DOM serialization plus resource map, U3's recommendation)
at each observation and read in tracing mode (Chrome and Edge first), and the offline queue's flush keeps each entry's
original envelope id and timestamp. The Lab turns tracing on for every live run. Gate: T01-T04, T11, T14 and capture
overhead measured provider-free on four realistic tasks.

Trees `fxwork/t736/{!FluxIQ,!FluxIQWebExtension}`, branch `task/t736-trace-capture`. Not touched: the live lane trees
(t563, t719, t566, t567), lab-slots, and lane t737's files (extension fixture, background start path,
shown-addresses, `scripts/lab/**/summarize-task.mjs`, the reset span in `core.test_subflow`/`core.test_candidate`).

Steps:
1. Discovery (parallel, read-only): P2a Core store, ingress, secret screen, capture policy, session-project binding;
   P2b extension observation/read sites, uploads, outbox flush, Lab launch, a provider-free path for four tasks.
2. Design and interface (lead), then implementation units partitioned by file, Core and extension in parallel.
3. Gate tests and the overhead measurement.

## Worker briefs

### Brief: lane-t-p2a-core-map (worker-high, read-only)
- Core t736. Where traces should be stored and opened, and where bypass ingress is accepted; see the dispatch prompt.
  Report `reports/lane-t-p2a-core-map.md`.

### Brief: lane-t-p2b-extension-lab-map (worker-high, read-only)
- Downstream t736 (+ Core's websocket client for the outbox). Where observations and reads are produced and sent, the
  upload path, the outbox flush, the Lab's live-run launch, and a provider-free route for four realistic tasks.
  Report `reports/lane-t-p2b-extension-lab-map.md`.

### Wave A (dispatched 2026-10-20, parallel; file-disjoint)
- `lane-t-p2-g-gateway-tap` (worker-high, Core `client-gateway/service/**`, `client-gateway/service.ts`, the websocket
  host's receive-failure write): the capture tap. Report `reports/lane-t-p2-g-gateway-tap.md`.
- `lane-t-p2-s-store` (worker-high, Core `AS/storage/project/gateway-trace/**`): the persisted store. Report
  `reports/lane-t-p2-s-store.md`.
- `lane-t-p2-r-episodes` (worker-high, Core `AS/runtime/gateway-trace/**`): episodes, screening sink, registry, flag.
  Report `reports/lane-t-p2-r-episodes.md`.
- `lane-t-p2-e1-page-capture` (worker-high, downstream `content/trace-capture/**`, `content/message-handler.ts`, a
  harness spec): the production DOM serializer. Report `reports/lane-t-p2-e1-page-capture.md`.
- `lane-t-p2-lo-lab-outbox` (worker, downstream `test-runner` environment/coordinator; Core websocket client
  transport/connection): tracing on in the Lab; the flush keeps envelopes. Report `reports/lane-t-p2-lo-lab-outbox.md`.

## Decisions (lead, 2026-10-20, from P2a and P2b)

- D8 Routing by async context, not by session project (a session's `projectId` moves; one project's episodes can
  overlap). The program opens an episode and holds its recorder in an AsyncLocalStorage frame; the gateway reads it
  through `ClientGatewayTraceCaptureSource.current()` (lead wrote `client-gateway/trace/capture-source.ts`), as it reads
  the host lease. Outbound records into `current()`, claims the session (session and client id) and maps command id to
  sink; inbound results and reconcile answers route by command id, other inbound and lifecycle to the claimants.
  Nested episodes (a trial inside a build): the innermost frame records; the parent gets control markers. Cross-trace
  order is `observedAt` only (per-trace sequences, D5).
- D9 Episode ids: a run's `runId`; a trial's run id; a build's `build.<uuid>`, minted when its episode opens and used as
  the build id at `service.ts:1568`, so one id names the build (P2a open question 1). Trial episodes open in the trial
  *ports* (`candidate-trial/port.ts`, `subflow-trial/port.ts`), not `run.ts`, which t737 is editing.
- D10 Store: Automation Studio's per-project SQLite pool (`storage/project/gateway-trace/`, migration 0027), events
  inline below 256 KiB else in the project content store; artifacts in the content store with an owner reference
  (pinned; the legacy object store's recording prune would delete them).
- D11 Switch: `FLUXIQ_CLIENT_GATEWAY_TRACE` read once in `programs/_shared/runtime.ts`; unset means no capture source
  and zero work. The Lab sets it on for every Core it starts (`buildFluxIQEnvironment`, after the inherited
  environment), with a topology option to turn it off for the overhead measurement.
- D12 Tracing reaches the client per command, not as session policy: Core stamps `metadata.trace = { artifacts: true }`
  on every action command it traces; a client that cannot capture ignores it. Wire types written by the lead in
  `packages/contracts/src/client-gateway.ts` (`CLIENT_GATEWAY_TRACE_METADATA_KEY`, `ClientGatewayTraceRequest`,
  `ClientGatewayTraceArtifactReference` {sha256, mediaType, byteLength, role primary|resource, source?},
  `ClientGatewayTraceResultMetadata` {artifacts, unavailable}, `CLIENT_GATEWAY_TRACE_ARTIFACT_PATH`); Core rebuilt so
  downstream compiles against them.
- D13 Trace artifacts get their own route, `PUT /api/client-gateway/trace-artifacts/<sha256>` (bearer, bound to the
  gateway session, text/html, text/css, images, fonts, 20 MB), handed to the gateway's trace intake and stored in the
  content store, pinned to each trace claiming that session. Not state-assets: it is image-only, project- and
  recording-bound, and writes to the prunable legacy store. The screenshot PUT is still captured (D1), as an artifact
  event at `writeProjectObjectAsset`, with its digest checked before the write (existing defect, P2a).
- D14 The result's `metadata.trace` references ride in the raw text the trace records; Core strips `metadata.trace` from
  an inbound action result before settle and the event emit, so no run, recording (`bridge.ts:727`), attempt or model
  sees it. The extension keeps the capture off `BrowserActionResult` (it travels raw into recording evidence) and
  attaches the reference in the background after mapping.
- D15 Secret screening before storage is a program-side screening sink (the gateway cannot import the program):
  string leaves screened with `screenAutomationStudioLlmEvidence(leaf, [])` and card numbers; a hit stores the event as
  JSON with markers and `redactions: secret` (raw text not kept). Credentials (hello token, session_ready token, pairing
  code) are redacted by the gateway tap itself (D7). Page snapshots withhold sensitive values in the page, by the
  same rule the action results use.
- D16 The flush keeps each queued envelope's id, timestamp and correlation id; the session id stays the current
  socket's (Core mints one per socket).
- D17 Overhead measured provider-free with `pnpm lab replay` of saved Flows on four realistic tasks, tracing off vs on
  (time per command, bytes), plus the content harness for in-page capture time.

## Progress log

### 2026-10-20 - Shared interfaces (lead)
- Core: `packages/contracts/src/client-gateway.ts` trace wire types (D12); `client-gateway/trace/capture-source.ts`
  (`ClientGatewayTraceCaptureSource`) + barrel line. Downstream: `apps/extension/src/shared/trace-page-capture.ts`
  (message `fluxiq.tracePageCapture`, response {document {html, source}, resources [{source, mediaType, base64}],
  unavailable}).
- Check: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> `build
  exit 0`; downstream `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at ... is current with
  its source.`

### 2026-10-20 - Wave A, verified by the lead
- G gateway tap (Core): new `client-gateway/service/trace-tap/` (tap, action-stamp, credential-fields,
  credential-redaction, result-metadata-strip, schemas, streams, types, barrel, tests); `client-gateway/service/{types,
  transport,inbound,lifecycle,commands,pairing-flow,access,index}.ts`, `command-ledger/dispatch.ts`,
  `client-gateway/service.ts` (`receiveTraceArtifact`, `CLIENT_GATEWAY_TRACE_TAP_STREAMS`); tests `client-gateway/tests/
  trace-tap.test.ts`, `trace-tap-replay.test.ts`, `trace-tap-support.ts`. T01 and T04 at gateway level; 4 mutation
  checks failed new tests. Report `reports/lane-t-p2-g-gateway-tap.md` (routing choices: an unmapped result and
  messages outside an episode go to the session's claimants; two traces claiming one session both record unsolicited
  inbound; the strip runs even with tracing off -- all accepted).
- Lead fix in G's tap (D18): text that fails to parse is no longer stored raw (a malformed hello could carry a pairing
  token no screen recognises); it is recorded as `{ unparsed: { byteLength, sha256 } }` with a whole-message `secret`
  redaction, and its disposition names the error's kind only (V8's parse messages quote the input). Test updated to
  pin it and to assert the held-back value appears nowhere in the trace. Check: `pnpm exec vitest run
  src/client-gateway/tests/trace-tap.test.ts src/client-gateway/service/trace-tap` -> `Test Files 3 passed (3)
  Tests 20 passed (20)`.
- S store (Core): new `AS/storage/project/gateway-trace/` (migration `0030_client_gateway_traces` -- 0027-0029 were
  taken -- store, index; tests behaviour (the memory store's suite run against both stores), persistence (reopen),
  completeness (T11, T14)); one line in `storage/project/index.ts`. Report `reports/lane-t-p2-s-store.md`.
- R episodes (Core): new `AS/runtime/gateway-trace/` (episodes, open-episode, registry, screening-sink, payload-screen,
  flushing-sink, termination, control-event, control-vocabulary, environment, from-environment, types, index; tests
  episodes, screening-sink, from-environment); one line in `AS/runtime/index.ts`. 3 deliberate breaks -> 13 failures.
  Report `reports/lane-t-p2-r-episodes.md`. Lead added `installation.ts` (the process-wide installed episodes, set once
  by the host, read by the service, trial ports and handlers; static like the host-lease and channel scopes so the
  frozen `service.ts` gains no member) + `tests/installation.test.ts` (2/2).
- E1 page capture (downstream): new `apps/extension/src/content/trace-capture/` (capture-page, serialize-document,
  element-markup-state, read-stylesheet, same-origin-address, fetch-resource-bytes, carry-resources, bytes-to-base64,
  capture-bounds, types, index; 6 unit test files), `content/message-handler.ts`, harness spec
  `e2e/content/tests/trace-capture/tests/trace-capture.spec.ts`. Offline reload agreed exactly with live on job-board
  (page view 299/299, read 180/180 cells, targets 17/17) and everything-store (927/927, 560/560, 20/20); no request,
  no page script, no seeded sensitive value; 32 KB (6.8 KB gzip) and 91 KB (12 KB gzip) documents; the store's 11
  images as original bytes total 3.3 KB (vs ~72 KB as canvas PNG). Lead aligned the shared message comment with E1's
  reading (resources keyed by the absolute address the browser requests; frame documents serialized, not fetched).
  Gap: CSS `url()` resources (fonts, backgrounds) are neither carried nor counted as unavailable (assigned to E2).
  Report `reports/lane-t-p2-e1-page-capture.md`.
- L+O (downstream Lab, Core websocket client): `buildFluxIQEnvironment` sets `FLUXIQ_CLIENT_GATEWAY_TRACE=1` after the
  inherited environment unless `tracing: false`; the coordinator threads `tracing` (default true); the queue flush
  passes each queued envelope's id, timestamp and correlation id (`transport.ts`, `connection/connection.ts`). The two
  new D16 tests failed before the fix. Report `reports/lane-t-p2-lo-lab-outbox.md`.
- Lead's checks: Core `pnpm exec vitest run src/client-gateway src/runtime/tests/client-gateway-transport.test.ts
  $A/client-gateway $A/runtime/environment $A/runtime/gateway-trace $A/storage/project/gateway-trace` -> `Test Files 49
  passed (49)  Tests 366 passed (366)`; `pnpm exec tsc --noEmit` (fluxiq) -> `exit 0`; websocket client `tsc --noEmit`
  -> `exit 0` and `vitest run` -> `Tests 182 passed (182)`; Core audit -> `structure-audit: passed (420 warning(s),
  1152 baselined).` Downstream: `node scripts/test-content.mjs -- --headed --workers=1 trace-capture` -> `2 passed
  (3.9m)`; `node apps/extension/scripts/test-extension.mjs src/content/trace-capture/tests` -> `# tests 28 # pass 28 #
  fail 0`; test-runner `tsc -p tsconfig.json` -> `0`, `node --test dist/tests/environment.test.js
  dist/tests/coordinator-existing.test.js` -> `# tests 22 # pass 22 # fail 0`; downstream audit -> `structure-audit:
  passed (212 warning(s), 618 baselined).`
- UNIT READY (Core): `packages/contracts/src/client-gateway.ts`, `packages/fluxiq/src/client-gateway/trace/{capture-source.ts,index.ts}`,
  `packages/fluxiq/src/client-gateway/service/trace-tap/**`, `packages/fluxiq/src/client-gateway/service/{types,transport,inbound,lifecycle,commands,pairing-flow,access,index}.ts`,
  `packages/fluxiq/src/client-gateway/service/command-ledger/dispatch.ts`, `packages/fluxiq/src/client-gateway/service.ts`,
  `packages/fluxiq/src/client-gateway/tests/trace-tap*.ts`, `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/**`,
  `packages/fluxiq/src/programs/automation-studio/storage/project/index.ts`, `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/**`,
  `packages/fluxiq/src/programs/automation-studio/runtime/index.ts`, `packages/client-gateway-websocket/src/{transport.ts,connection/connection.ts}`
  and their tests. Downstream: `apps/extension/src/shared/trace-page-capture.ts`, `apps/extension/src/content/trace-capture/**`,
  `apps/extension/src/content/message-handler.ts`, `apps/extension/e2e/content/tests/trace-capture/**`,
  `packages/test-runner/src/{environment,coordinator}.ts`, `packages/test-runner/src/tests/{environment,coordinator-existing}.test.ts`,
  and `docs/working/trace-offline-trials-plan/reports/lane-t-p2*.md`. (Inert in production until wave B wires it.)

### Wave B (dispatched 2026-10-20, parallel; file-disjoint)
- `lane-t-p2-w1-episode-wiring` (worker-high, Core): `_shared/runtime.ts`, `service.ts` (in place), the trial ports,
  `gateway-trace/**` additions; T02, T03. Report `reports/lane-t-p2-w1-episode-wiring.md`.
- `lane-t-p2-w2-ingress` (worker-high, Core): run-control/run/bootstrap handlers, ask answers, the screenshot PUT, the
  trace-artifact route; T11. Report `reports/lane-t-p2-w2-ingress.md`.
- `lane-t-p2-e2-background-capture` (worker-high, downstream): capture, upload, reference in the background; CSS
  `url()` resources counted. Report `reports/lane-t-p2-e2-background-capture.md`.

### 2026-10-20 - Wave B, verified by the lead
- W1 episode wiring (Core): `programs/_shared/runtime.ts` (tracing on: episodes over the service's own pool,
  installed, `trace` source passed to the gateway, start hook decorated; off: nothing built or passed);
  `AS/runtime/service.ts` in place only (4318 -> 4316 lines: wrappers swapped in at the build entry, build id, run
  bind, pool adoption; one import collapsed); `candidate-trial/port.ts`, `subflow-trial/port.ts` (trial episodes,
  activity test, run id minted at the port); `gateway-trace/episodes.ts` (additive `runPending`/`bindPending`, screened
  context); new `gateway-trace/wiring/**` (kept out of the parent barrel: re-exporting it closed a 357-module cycle);
  tests pending-episodes, episode-wiring, gateway-tap-episodes, `service/tests/trial-episodes.test.ts`. T02 printed:
  untraced 10.8 ms, traced 47.6 ms for 12 commands, 36 events, 32,436 bytes. Lead read the build wrapper: off, it is
  exactly the old activity scope plus the work. Known limit: an unprepared start hook runs inside `run.ts` (t737's
  file), so it lands in the trial's trace rather than the build's. Report `reports/lane-t-p2-w1-episode-wiring.md`.
- W2 ingress (Core): run control into the targeted episode (`api/handlers/{runtime-execution,run-control,llm-generation}.ts`),
  ask answers (`parking/conversation-port.ts`, importing `gateway-trace/installation.ts` directly to avoid a cycle),
  the screenshot PUT (digest checked before the write -- existing defect fixed -- then handed to the trace intake; the
  state-assets route passes the session id), the new route `apps/web/src/app/api/client-gateway/trace-artifacts/[sha256]/route.ts`
  (bearer, session-bound, media allowlist, 20 MB, digest). Tests incl. T11 end to end. Report
  `reports/lane-t-p2-w2-ingress.md`.
- E2 background capture (downstream): new `background/trace-capture/**`; `connection/server-command-channel.ts` (the
  trace request read off the raw server message before the command runs; result and fact-check answers get
  `metadata.trace` after mapping, never `BrowserActionResult`; a throwing capture still answers the command, counted
  unavailable); `connection/core-api.ts` (the trace-artifact PUT); `connection.ts` (2 lines); `content/trace-capture/carry-resources.ts`
  (CSS `url()` counted). Core trace constants imported as types only (a value import would bundle Core's gateway
  service). Remaining gap: the top document's own `<style>` `url()`s are not yet counted (capture-page.ts must pass the
  HTML). Report `reports/lane-t-p2-e2-background-capture.md`.
- Lead's checks: Core rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket
  build` -> `build exit 0`); apps/web `vitest run` on the two routes -> `Test Files 3 passed (3)  Tests 17 passed (17)`,
  `tsc --noEmit` -> `0`; Core `vitest run` over client-gateway, AS client-gateway, environment, gateway-trace,
  storage gateway-trace, candidate-trial, subflow-trial, project-build, service/tests, api, parking and the transport
  test -> `Test Files 146 passed (146)  Tests 958 passed | 1 skipped (959)`; fluxiq `tsc --noEmit` -> `0`; Core audit ->
  `passed (420 warning(s), 1152 baselined)` with "1 baseline entries can be lowered" (`service.ts` file-lines 4318 ->
  4316; left for the supervisor's `pnpm structure:baseline`). Downstream: extension `tsc -p tsconfig.json` and
  `tsconfig.test.json` -> `0`/`0`; `node scripts/test-extension.mjs src/background/trace-capture/tests
  src/background/connection/tests src/content/trace-capture/tests src/background/tests` -> `# tests 410 # pass 410 #
  fail 0`; audit -> `passed (214 warning(s), 618 baselined).`
- UNIT READY (Core): `packages/fluxiq/src/programs/_shared/runtime.ts`, `.../automation-studio/runtime/service.ts`,
  `.../runtime/service/candidate-trial/port.ts`, `.../runtime/service/subflow-trial/port.ts`, `.../runtime/gateway-trace/**`
  (incl. `wiring/**`, `installation.ts`), `.../runtime/service/tests/trial-episodes.test.ts`, `.../api/handlers/{runtime-execution,run-control,llm-generation}.ts`,
  `.../api/handlers/tests/trace/**`, `.../runtime/parking/conversation-port.ts`, `.../runtime/parking/tests/conversation-port-trace.test.ts`,
  `.../runtime/service/object-documents.ts`, `.../runtime/service/tests/object-documents-trace.test.ts`,
  `apps/web/src/app/api/client-gateway/trace-artifacts/**`, `apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/{route.ts,tests/route-trace.test.ts}`.
  Downstream: `apps/extension/src/background/trace-capture/**`, `apps/extension/src/background/connection/{server-command-channel,core-api}.ts`
  and their tests, `apps/extension/src/background/connection.ts`, `apps/extension/src/content/trace-capture/carry-resources.ts`
  and its test, the wave-B reports.

## Not verified

## Open questions or contradictions found
