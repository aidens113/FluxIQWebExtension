# Report: lane-t-p3 (t742 trace-intake-parity)

## Outcome
Done (2026-10-20). The parity harness replays a stored trace through Core's own client-gateway intake and compares
every delivery point. All ten realistic sites are covered (nine by saved-Flow replays, photo-social by its round-4
build trace) and every trace matches on everything it recorded, with no intake defect; round 4's live build and trial
traces match on every recorded field, and the delivered values they never recorded are reported as capture gaps. The
start hook's answer lands in the build's trace; stored event JSON is chunked and stored once (0.094 of logical bytes on
real traces), sealed with the content store's protection and removed with the project and by retention.

## Plan

Brief `t742-trace-intake-parity` (plan P3): a harness that replays a stored trace through Core's own client-gateway
intake (no second code path) and compares, at every delivery point, what Core received and derived against the
original; traces from provider-free saved-flow replays on all ten realistic sites (plus live round-4 traces when the
supervisor names them); every divergence classified (capture gap, nondeterminism, intake defect) and fixed at its
source or recorded as an explicit evidence gap. Also: the candidate start hook's answer lands in the build's trace,
and stored event JSON stores repeated content once (92-96% of bytes, ~34 MB per run in P2's measurement).

Trees `fxwork/t742/{!FluxIQ,!FluxIQWebExtension}`, branch `task/t742-trace-intake-parity`. Avoid t741's files (Core
site-reset, plan, script-statements, subflow-candidate submission, llm evidence-loop and loop-budget, project-agents
dispatch and supervisor, project-build brief-ports and reset-calls; domain action-failure, retries, target-packets,
rejection-next) and the live lane trees (t563, t719, t566, t567) and lab-slots. Tests that open a real database
start with `// @fluxiq-test-group real-sql` (t740).

Design (lead):
- Parity is trace against trace. The harness reads the original trace through the store API, builds a fresh
  ClientGatewayService whose own tap records the replay into a memory store, re-issues each recorded outbound command
  through the normal `executeAction` at its recorded position, and feeds each recorded inbound text through
  `receiveRaw`. The replay's capture is then compared event by event with the original: same inputs by construction,
  and the derived side (dispositions, the result handed to each caller, events emitted to listeners, outbound
  messages, Core-synthesized outcomes) must match. For outbound messages to be comparable byte for byte, the gateway
  takes an id source and a clock that the replay feeds from the recording (U2a's prerequisite). For derived values to
  be comparable, the capture records a digest of what was delivered to the caller with each disposition.
- Divergence classes: `capture_gap` (the trace lacks something the replay needs), `nondeterminism` (timing, ids,
  concurrency, declared and normalized only when the field is proven transport-only), `intake_defect` (same input,
  different derivation). Each is fixed at its source or recorded as an explicit evidence gap.

| Unit | Worker | Owns |
| --- | --- | --- |
| A store dedupe | worker-high | Core `AS/storage/project/gateway-trace/**` |
| B start hook in the build's trace | worker | Core `AS/runtime/service/{candidate-trial,subflow-trial}/{run,port}.ts` + tests |
| C1 parity harness (Core) | worker-high | Core `client-gateway/service/{config,commands,transport,types}.ts`, `client-gateway/service/trace-tap/**`, new `client-gateway/trace-replay/**` |
| D0 saved Flows for ten sites | worker (read-only, copies into this tree) | downstream ignored `test-runs/persistent-isolated/t742-*` |
| D1 ten-site replays and parity runs | after A, C1, D0 | downstream test-runner |

## Worker briefs
(the dispatch prompts; summaries in the table above)

## Decisions

- D21 (from D1's store divergences): the trace payload screen exempts a leaf that is exactly a lower-case hex SHA-256
  (64 hex characters) from the card-number screen: a random digest trips the Luhn backstop about 0.22% of the time, and
  a page-artifact digest was redacted as a card number. Narrow on purpose: the LLM evidence screen is unchanged (a
  card number glued to letters must still not reach a model). The screening sink keeps every field of the event it
  redacts (copy of the input with payload and redactions replaced), so the session reference survives.
- D22 (D1's reorders): parity compares each causal chain -- an inbound input's disposition and delivered digest, a
  command's outbound and its answers -- not the global interleaving of dispositions. Live intake handles one socket's
  frames concurrently (U2a section 4.2), so the order in which concurrently handled inputs finish is nondeterministic by
  design; the order of the inputs themselves stays checked.
- D23 (C1's noted gap): when a trace first claims a session the tap records the session's public view (client type,
  capabilities, metadata; never a token), so a replay attaches the session with the capabilities it had (reconcile
  eligibility, activity), instead of the manifest's null capabilities becoming a capture gap.
- D24: P2's double-instance defect is fixed on dev (`installation.ts` last-wins, commit 2558f7bd); D1's
  `FLUXIQ_DOMAIN_ID` was unnecessary. The final runs use the Lab's default settings.

## Progress log

### 2026-10-20 - Wave 1, verified by the lead
- A store dedupe (Core): `storage/project/gateway-trace/{chunk-migration,chunk-bounds,split-content-defined,prepare-body,
  pack-chunk,unpack-chunk,write-chunks,read-bodies,delete-chunk-uses,types}.ts` (new), `store.ts`, `index.ts`; tests
  split-content-defined, store-chunks, store-legacy-rows, store-chunk-measure (+ synthetic-views), store-persistence.
  Events of 16 KiB or more are cut into content-defined chunks (gear hash; 1/4/64 KiB min/aim/max), each SHA-256
  addressed, stored once per project, deflated when smaller; small events inline. Migration
  `0031_client_gateway_trace_event_chunks` (0030 untouched; 0030 rows still read, tested). A chunk-uses table frees
  exactly the chunks no other trace uses when a trace is deleted. Measured on a 220-event synthetic trace shaped like
  P2's: 76,626,447 -> 3,445,010 bytes (ratio 0.045; per-event deflate alone would be 0.14); ~18 ms/event write, ~3.2
  ms/event bulk read. Chunk bytes sit outside the content store's sweep and protection (encryption would need adding).
  Report `reports/lane-t-p3-a-store-dedupe.md`.
- B start hook (Core): `service/candidate-trial/{run,port}.ts`, `service/subflow-trial/{run,port}.ts`; the runners open
  the trial episode after the affordability check and the start, so an unprepared start hook's answer lands in the
  build's trace; a trial refused before it runs no longer opens an empty trial episode. 3 new tests failed before the
  fix. Report `reports/lane-t-p3-b-start-hook.md`.
- C1 parity harness (Core): gateway id and timer sources (defaults unchanged), the session reference on tap events,
  delivered digests on dispositions (`trace-tap/{delivered-digest,delivery-collector}.ts`, disposition schema v2), and
  `client-gateway/trace-replay/**` (fresh gateway, recorded ids and clock, re-issued commands, inbound fed through
  `receiveRaw` in order, comparison at every delivery point, classes capture_gap / nondeterminism / intake_defect).
  Synthetic session replays to matched; a mutated input gives `intake_defect`, a removed event `capture_gap`. Report
  `reports/lane-t-p3-c1-parity-harness.md`.
- D0 saved Flows (downstream, ignored copies): five workspaces copied from idle trees (t565, t342) into
  `test-runs/persistent-isolated/t742-*`: crossborder-marketplace, bigbox-retail, everything-store, social-network-feed,
  job-board. Passing Flows for auction-marketplace, company-website, local-classifieds and professional-network exist
  only in the lane trees t566/t567 (forbidden); photo-social has never had a passing build. Report
  `reports/lane-t-p3-d0-saved-flows.md`.
- Lead's checks (Core, A+B+C1 together): `pnpm exec vitest run src/client-gateway src/runtime/tests/client-gateway-transport.test.ts
  $A/client-gateway $A/runtime/environment $A/runtime/gateway-trace $A/storage/project/gateway-trace
  $A/runtime/service/candidate-trial $A/runtime/service/subflow-trial $A/runtime/service/tests $A/runtime/service/project-build`
  -> `Test Files 128 passed (128)  Tests 829 passed | 1 skipped (830)`; `tsc --noEmit` -> `0`; audit -> `passed (427
  warning(s), 1152 baselined)` (1 lowerable entry, the known `service.ts` one).

### 2026-10-20 - D1 replays and parity on real traces (worker-high)
- Changed (downstream): new `packages/test-runner/src/trace-parity/` (types, parity-reason, summarize-parity,
  check-project-trace-parity, index; tests), wired into `saved-flow-replay/stored-traces.ts` so every replay receipt
  carries a `parity` result. Report `reports/lane-t-p3-d1-parity-runs.md`.
- Five headed provider-free replays (with `FLUXIQ_DOMAIN_ID`, see D24): crossborder passed, parity matched 127/127;
  bigbox passed, 307/307; everything-store passed, 284/295 (10 capture_gap, 1 nondeterminism); social-feed passed,
  221/222 (1 nondeterminism); job-board exit 1, verdict failed (its Flow from a failed build stores the wrong rows; not
  intake), parity 115/115. Overall 1,054 of 1,066 delivery points matched; no intake defect. Not vacuous: changing one
  recorded status gave one `intake_defect`; removing one event gave two `capture_gap`s.
- Causes: (1) the screening sink rebuilt a redacted event without `session` (10 store gaps); (2) a page-artifact
  digest was redacted as a card number (the same 10 points); (3) two state updates handled concurrently live finished
  in the other order under sequential feeding (store seq 184, social seq 8). Decisions D21-D23 above.

## Progress log (fixes)

### 2026-10-20 - F1 screening, F2 chains and session view, lead wiring and pins, verified by the lead
- F1 (Core): `gateway-trace/screening-sink.ts` forwards `{ ...input, payload, redactions }` (a copy of the named input),
  so `session`, `referencedDigests` and any later field survive a redaction; `gateway-trace/payload-screen.ts` skips only
  the card screen for a leaf that is exactly 64 lower-case hex (every credential check still runs); `evidence-screen.ts`
  unchanged. 2 new tests failed before the fix. Report `reports/lane-t-p3-f1-screening.md`.
- F2 (Core): `trace-replay/comparison/causal-chains.ts` (new) and `parity-report.ts`: order is checked per chain (inputs
  in received order; an input and its disposition; one command's messages, answers and outcomes; the rest among
  themselves); `trace-tap/{session-view,lifecycle-events}.ts` (new): a `session.claimed` lifecycle event with the
  session's public view (client type, name, version, capabilities, metadata; never a token, pairing code or
  trusted-client id) the first time a trace claims a session; the replay attaches the session with it
  (`walk/stand-in-hello.ts`, `walk/recorded-sessions.ts`). Report `reports/lane-t-p3-f2-chains-and-sessions.md`.
- Lead: wired `sessionViewOf` into the tap in `client-gateway/service.ts:87` (outside F2's brief); made the claim event
  compared rather than `outside` (`parity-report.ts`: a match proves the replay set the session up as the original had
  it; a replay-only claim on an older trace is still skipped as an extra) and reworded the declared difference;
  updated two pins (`replay-claimed-session.test.ts` first entry `matched`; `replay-parity.test.ts` matched count 13).
  A worker-low repinned six tests for the leading claim event (sequences +1, the claim added to kind lists; report
  `reports/lane-t-p3-repin-claim.md`). Check: `pnpm exec vitest run src/client-gateway
  src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/client-gateway
  src/programs/automation-studio/runtime/environment` -> `Test Files 58 passed (58)  Tests 380 passed (380)`; `tsc
  --noEmit` -> `0`; audit -> `passed (427 warning(s), 1152 baselined)`.

### 2026-10-20 - D2 final parity on real traces, Lab default settings (worker)
- Core and extension rebuilt; five headed provider-free replays WITHOUT `FLUXIQ_DOMAIN_ID`: crossborder
  `replay-mvgvqldo-be73a6e8` passed, bigbox `replay-mvgvvskk-671e4dd7` passed, everything-store
  `replay-mvgvy8tz-68a1202f` passed, social-feed `replay-mvgw4hff-a1ac24ef` passed, job-board `replay-mvgw8tcl-6bfaad77`
  exit 1, verdict failed (its Flow from a failed build stores the wrong rows; parity 117/117). Parity: 1,069 of 1,069
  delivery points matched, 0 divergences (D1 had 12). Every trace complete; 0 secret hits; 0 model calls; the store
  redacted 0 events (5 false positives in D1). Stored bytes: 64.7 MB logical event JSON -> 6.1 MB stored (0.094 overall,
  0.078-0.117 per trace; 0.046 for the bytes these replays actually added). Report `reports/lane-t-p3-d2-final-parity.md`.
- Lead's spot check of the five receipts: each one trace, completeness `complete` (128, 312, 285, 227, 117 events),
  parity `matched`, `calls=0`, secret hits 0.

### 2026-10-20 - G store measure through Core's API (worker), verified by the lead
- D2's size read-back ran raw SQL against Core's private trace tables from the Lab (silent breakage on a schema change;
  storage belongs to Core). Core gained `measureTrace(traceId)` and `measureTraceChunks(traceIds)` on the project trace
  store (`gateway-trace/{measure,chunk-set-measure,measure-rows}.ts` + `tests/store-measure.test.ts`); the Lab's
  trace-inspection calls them and its SQL is deleted (same output fields). Report `reports/lane-t-p3-g-measure-trace.md`.
- Lead's final checks: Core `vitest run` over client-gateway, the transport test, AS client-gateway, environment,
  gateway-trace, storage gateway-trace, candidate-trial, subflow-trial, service/tests, project-build -> `Test Files 132
  passed (132)  Tests 846 passed | 1 skipped (847)`; fluxiq `tsc --noEmit` -> `0`; Core audit -> `passed (428
  warning(s), 1152 baselined)` (the known lowerable `service.ts` entry); downstream `core-build.mjs` -> current;
  `grep -rn "client_gateway_trace" packages/test-runner/src | wc -l` -> `0`; test-runner `tsc` -> `0`; `node --test
  dist/trace-inspection/tests/*.test.js dist/trace-parity/tests/*.test.js dist/saved-flow-replay/tests/*.test.js` ->
  `# tests 63 # pass 63 # fail 0`; downstream audit -> `passed (215 warning(s), 618 baselined).`
- UNIT READY (Core): `packages/fluxiq/src/client-gateway/service.ts`, `packages/fluxiq/src/client-gateway/service/{config,types,transport,commands,inbound,lifecycle}.ts`,
  `packages/fluxiq/src/client-gateway/service/command-ledger/dispatch.ts`, `packages/fluxiq/src/client-gateway/service/trace-tap/**`,
  `packages/fluxiq/src/client-gateway/service/tests/id-and-timer-sources.test.ts`, `packages/fluxiq/src/client-gateway/trace/{types,recorder}.ts`,
  `packages/fluxiq/src/client-gateway/trace-replay/**`, `packages/fluxiq/src/client-gateway/index.ts`, `packages/fluxiq/src/client-gateway/tests/trace-tap.test.ts`,
  `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/**`, `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/{screening-sink,payload-screen}.ts`
  and `tests/screening-sink.test.ts`, `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/wiring/trial.ts`,
  `packages/fluxiq/src/programs/automation-studio/runtime/service/{candidate-trial,subflow-trial}/{run,port}.ts`,
  `packages/fluxiq/src/programs/automation-studio/runtime/service/tests/trial-episodes.test.ts`. Downstream:
  `packages/test-runner/src/trace-parity/**`, `packages/test-runner/src/trace-inspection/**`, `packages/test-runner/src/saved-flow-replay/{stored-traces.ts,tests/replay-tracing.test.ts}`,
  and `docs/working/trace-offline-trials-plan/reports/lane-t-p3*.md`.

### 2026-10-20 - Supervisor decisions; wave 3 (E chunk protection, C copies), verified by the lead
- Decisions received: (1) copy passing workspaces read-only -- t567 now, t566 once its round-4 social run ended (since
  confirmed: t566 idle, its traced run run-mvgw3ve5-294881b5, rr4-slot-3, ended with `core.run_node threw non_error`);
  (2) build and trial parity from round 4's traced live runs: office run-mvgvyaip-d856e135 (t563, rr4-slot-1), job
  run-mvgw1854-5d10955b (t719, rr4-slot-2), photo run-mvgw7320-de416190 (t567, rr4-slot-4), social as above; photo-social's
  site parity comes from the photo build trace; (3) chunk bytes under the content store's encryption and lifecycle now;
  (4) repeat stability: at least two sites replayed twice. t743 in parallel (avoid its files).
- Correction from the data: the passing auction Flow is in t566 (bf-slot-3) with local-classifieds and
  professional-network; t567 (bf-slot-4) holds job-board (a passing Flow, unlike the t342 one D1 used) and
  company-website.
- C copies (worker): `test-runs/persistent-isolated/t742-{job-board,company-website}` from t567 bf-slot-4 (they predate
  trace capture: no traces; replays will write them); the old t342 job-board copy renamed `t742-job-board-t342-weak`;
  round-4 stores in `test-runs/round4/<run>/` (office 4 traces, job 2, photo 1). Every copy hash-identical to its
  source (incl. -wal/-shm); sources idle (0 processes, nothing written in 10 min). Copies include the workspaces'
  credentials and browser profiles: ignored `test-runs/`, never committed, never read. Report `reports/lane-t-p3-c-copies.md`.
- E chunk protection (worker-high, Core `storage/project/`): chunks deflated then sealed with the content store's own
  protection provider (`gateway-trace/{chunk-protection-migration (0032),chunk-media-type,seal-chunk,open-chunk,
  protect-chunks,sweep-unused-chunks}.ts`; `write-chunks`, `read-bodies`, `prepare-body`, `types`, `store`, `index`;
  `retention-store.ts` (the sweep also frees chunks no trace uses); tests `store-protection`, `store-chunk-lifecycle`).
  With a protection, small events also go to sealed chunks and artifacts are stored protected; old unsealed chunks are
  sealed when a protected store opens or reuses them (a migration has no key). With sealing switched off on purpose,
  4 of 5 protection tests failed. Its checks: `vitest run src/programs/automation-studio/storage` -> 80 files passed, 2
  skipped; 531 tests passed, 4 skipped; `tsc` -> 0; audit passed. Report `reports/lane-t-p3-e-chunk-protection.md`.
- Gaps E found, assigned to the next unit: production does not yet pass the host's protection to the trace store
  (`runtime/gateway-trace/wiring/project-store.ts`), so nothing is sealed live; and in the object-store layout
  `deleteProject` never removes `projects/<id>/`, so `project.sqlite` (traces, chunks) and content objects outlive the
  project (`files-removal.ts`, `service.ts`; an existing defect).
- Recorded, not changed: chunk addresses are SHA-256 of the plaintext (needed for dedupe), so a holder of the database
  can tell equal chunks apart and confirm a guessed chunk. Content-store objects are addressed the same way today, so
  traces are no weaker than the content they sit beside; a keyed address (HMAC) for the whole content store is a
  separate design decision for the supervisor.

### 2026-10-20 - E2 protection wiring and project deletion; C2 t566 copies; R4 ten sites and live traces
- E2 (worker-high, Core): the trace store is built with the service's content protection, read again at each open
  (the framework binds it after the service is built; a pool no service adopted throws rather than store unsealed):
  `runtime/gateway-trace/wiring/{service-pools,project-store,host,types}.ts` + `tests/host-protection.test.ts`
  (`gateway-tap-episodes.test.ts`: `adopt` takes a third argument); deleting a project in the object-store layout now
  removes `projects/<id>/` after the index transaction commits (`runtime/service/projects/files-removal.ts` +
  `tests/delete-project-object-store.test.ts`; `service.ts` two in-place edits). Each fix's test failed before it.
  Report `reports/lane-t-p3-e2-wiring-and-deletion.md`. Lead decision D25 on its open question: with no protection
  configured the trace store behaves exactly as the content store does (no refusal), per "the same protection and
  lifecycle as the content store".
- Lead's check (E + E2): `pnpm exec vitest run $A/storage $A/runtime/gateway-trace $A/runtime/service/projects
  $A/api/handlers/tests/caches.test.ts src/client-gateway` -> 3 failures in storage tests outside the trace code
  (adaptation-store, graph-store, recording-stream) under the combined ~100-file run; rerun alone -> `Test Files 3
  passed (3)  Tests 54 passed (54)` (load timeouts, not a regression; E's own 80-file storage run passed); `tsc
  --noEmit` -> `0`; audit -> `passed (428 warning(s), 1152 baselined)`.
- C2 (worker): t566 idle (0 processes, newest file 22 min old); copied hash-identical into `test-runs/`:
  auction-marketplace, local-classifieds, professional-network workspaces (bf-slot-3; no traces, they predate capture)
  and the social run's store (rr4-slot-3, project a846814f-..., 9 traces, 2,002 events, 89 artifacts). Report
  `reports/lane-t-p3-c2-copies-t566.md`.
- R4 (worker-high): Core and extension rebuilt; replays (Lab defaults, headed, provider-free): job-board (t567's passing
  Flow) exit 1, verdict failed with 0 of 1 records (the Flow; parity 155/155), company-website, auction-marketplace,
  local-classifieds, professional-network exit 0 passed; crossborder and bigbox twice more each, exit 0 passed. All
  matched: 1,493 of 1,493 delivery points; repeat runs stable in parity and verdict (event counts and sizes as
  reported, bigbox with one extra snapshot and artifact in one run). Round-4 live traces (office 4, job 2, photo 1,
  social 9 = 16): as recorded the harness matches 0 of 6,941 delivery points because these traces predate the session
  reference; with a single-session labelling R4 added downstream, 4,274 match and the other 2,667 differ only by the
  v1 disposition schema (no delivered digest); no intake defect. Core's `parity-report.ts:137` labels 16
  artifact-manifest mismatches `intake_defect` that come from the missing session reference. Social: the
  `core.run_node threw non_error` happened after intake (the last extract_list results failed `output_not_observed`
  under a repair lease and Core settled each); the episode closed `completed` (the build caught it), so the trace
  cannot show the throw. Report `reports/lane-t-p3-r4-ten-sites.md`.
- Next (dispatched): `lane-t-p3-h-legacy-traces` -- Core's harness classifies traces captured before the session
  reference and delivered digests itself (declared legacy single-session attach; v1 dispositions compared on what they
  carry, the missing digest a capture gap, never an intake defect), the downstream workaround removed, and the 16 live
  traces re-run.

### 2026-10-20 - H legacy traces classified by Core (worker-high), verified by the lead
- Core `client-gateway/trace-replay/`: new `session-references/{bound-kinds,evaluation,attached,index}.ts` and
  `comparison/older-disposition*.ts`, edits to `types`, `replay-trace`, `index`, `walk/walk.ts`,
  `comparison/{index,normalizations,parity-report}.ts`; tests `evaluation.test.ts`, `replay-legacy-trace.test.ts`. A trace
  whose events name no session is replayed as one session only when five checks hold (no session reference anywhere;
  outbound and lifecycle name one session id; at most one client id; no later connect; nothing after disconnect), as a
  declared normalization; otherwise it is refused and each unreferenced event is a capture gap naming the failed check.
  A v1 disposition is compared on what it carries; its missing delivered value is a capture gap per delivery point (one
  note per trace would let thousands of points read matched with nothing derived compared). The artifact-list mismatch
  is a capture gap whenever a recorded artifact event could not be fed; a claim record and an outcome of a command the
  replay could not re-send are capture gaps too. New required report field `sessionReferences` (only Core's writer
  builds the report). Each of the five changes reverted in turn made a new test fail.
- Downstream: `trace-parity/session-evidence.ts` and `single-session-store.ts` deleted; the runner calls Core's harness
  unchanged (CLI, output layout and receipt summary unchanged). Report `reports/lane-t-p3-h-legacy-traces.md`.
- Re-run over copies (14 runs, all exit 0): round 4's 16 live traces -> 4,274 of 6,941 delivery points matched, 2,667
  capture gaps (`payload.value.delivered`, v1 dispositions; every field they carry matched), 0 intake defects, 0
  nondeterminism; the replay stores -> 18 traces 3,333 of 3,333 matched; one D1-era everything-store trace
  (`trace.d9d46b`, 15:23Z) refused as mixed: its 5 action results and 5 dispositions lack the session reference because
  the screening sink dropped it from redacted events before F1 fixed it (D1's 10 gaps); later traces of the same Flow
  are complete.
- Lead's final checks: Core `vitest run` over client-gateway, the transport test, AS client-gateway, environment,
  gateway-trace, storage gateway-trace, service/projects, candidate-trial, subflow-trial, service/tests -> `Test Files
  120 passed (120)  Tests 786 passed | 1 skipped (787)`; fluxiq `tsc --noEmit` -> `0`; Core audit -> `passed (428
  warning(s), 1152 baselined)`; downstream `core-build.mjs` -> current; test-runner `tsc` -> `0`; `node --test
  dist/trace-inspection/tests/*.test.js dist/trace-parity/tests/*.test.js dist/saved-flow-replay/tests/*.test.js` ->
  `# tests 70 # pass 70 # fail 0`; no `single-session` / `session-evidence` file left; `grep -rn "client_gateway_trace"
  packages/test-runner/src` -> 0 lines; downstream audit -> `passed (215 warning(s), 618 baselined).`
- UNIT READY (Core): `packages/fluxiq/src/client-gateway/trace-replay/**`;
  `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/**` (protection, lifecycle, migrations
  0031-0032, measure); `packages/fluxiq/src/programs/automation-studio/storage/project/retention-store.ts`;
  `packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/wiring/**`;
  `packages/fluxiq/src/programs/automation-studio/runtime/service/projects/{files-removal.ts,tests/delete-project-object-store.test.ts}`;
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` (in-place edits). Downstream:
  `packages/test-runner/src/trace-parity/**` (incl. the two deletions), `packages/test-runner/src/trace-inspection/**`,
  and `docs/working/trace-offline-trials-plan/reports/lane-t-p3*.md`. Earlier UNIT READY lists in this report still
  apply.

## Gate (plan P3: "the original run matches at every delivery point")

Met. Every site's trace replays through Core's own intake and matches at every delivery point it recorded; no intake
defect anywhere. Fixed at source on the way: the screening sink dropped the session reference; digests were redacted
as card numbers; order is checked per causal chain; the session view is recorded and compared; legacy traces are
classified by Core. Not vacuous: a changed recorded status gives an `intake_defect`, a removed event `capture_gap`s.

| Site | Trace source | Verdict | Parity |
| --- | --- | --- | --- |
| crossborder-marketplace | saved-Flow replay x3 (D2, R4 twice) | passed x3 | matched every run |
| bigbox-retail | saved-Flow replay x3 (D2, R4 twice) | passed x3 | matched every run (one run had one extra snapshot and artifact) |
| everything-store | saved-Flow replay (D2) | passed | matched (a D1-era trace refused as mixed, explained) |
| social-network-feed | saved-Flow replay (D2); round-4 build (9 traces) | passed / build failed | matched; live: legacy capture gaps only |
| job-board | saved-Flow replays (t567 Flow, t342 Flow); round-4 build (2 traces) | failed (the Flows' rows) | matched (155/155, 117/117); live: legacy gaps only |
| company-website | saved-Flow replay (R4) | passed | matched |
| auction-marketplace | saved-Flow replay (R4) | passed | matched |
| local-classifieds | saved-Flow replay (R4) | passed | matched |
| professional-network | saved-Flow replay (R4) | passed | matched |
| photo-social | round-4 build trace (no passing Flow exists) | build failed | legacy: every recorded field matched, delivered values capture gaps |

Totals: saved-Flow replay traces 3,333 of 3,333 delivery points matched (H re-run; D2 1,069/1,069, R4 1,493/1,493);
round 4's 16 live traces (office 4, job 2, photo 1, social 9) 4,274 of 6,941 matched, the other 2,667 capture gaps
because those traces predate the delivered digest, 0 intake defects. Repeat stability: crossborder and bigbox replayed
three times each, parity and verdict stable.

## Not verified

- Full suites (the twice-a-day rule); no paid or live run by this lane (round 4's live traces came from the
  supervisor's runs).
- Chromium only.
- Real legacy traces with a reconnect or a second session (the refusal rules are tested on synthetic traces only).
- Sealing with the framework's real key resolver in a live run (tests use a test provider).
- A combined ~100-file storage run hit 3 load timeouts in tests outside the trace code; they pass alone.

## Open questions or contradictions found

1. Chunk and content-store object addresses are SHA-256 of the plaintext (needed for dedupe), so a holder of the
   database can tell equal content apart and confirm a guessed chunk; this is true of the whole content store today. A
   keyed address (HMAC) would close it for both: a design decision for the supervisor.
2. With no protection configured the trace store writes unsealed, exactly as the content store does (D25).
3. `pnpm structure:baseline` can lower `service.ts` file-lines, owned by the supervisor.
4. Social round-4 throw: it happened after intake and was caught inside the build, so its trace cannot show it; the
   last delivery points are three failed `extract_list` results (`output_not_observed`) under a repair lease, each
   settled.
5. The Core plan's P3 gate is met for recorded fields; parity of what Core delivers is comparable only on traces
   captured from this unit on (round 4's predate the delivered digest).
