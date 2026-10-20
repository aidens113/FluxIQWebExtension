# Report: lane-t-p3-r4-ten-sites (t742, downstream test-runner)

## Outcome

Done. All ten realistic sites now have parity evidence. Nothing in this unit is an intake defect.

- **Five new saved-Flow replays** (headed, provider-free, Lab defaults, no `FLUXIQ_DOMAIN_ID`): 620 of 620 delivery points matched. company-website, auction-marketplace, local-classifieds and professional-network passed. job-board (the t567 Flow) failed its verdict: it stored 0 of the 1 expected record, although Core ran the Flow `succeeded`. Parity on job-board still matched 155/155, so the failure is not in intake.
- **Repeat stability** (crossborder and bigbox, two more runs each): parity matched on every run (256/256 and 617/617). Verdicts were stable. Event counts were stable on crossborder. On bigbox they varied by up to 4 events, because the live browser traffic itself varied (details below). Stored size varied by less than 1%.
- **Live round-4 traces** (16 traces in 4 stores):
  - **As recorded**, Core's harness compares nothing: 0 of 6,941 delivery points match. Every event lacks the session reference, which is a capture gap by design. The harness also reports 16 `intake_defect`s on `manifest.artifacts`. These are misclassified: they are a consequence of the same gap (Core `parity-report.ts:137`).
  - **Single-session view.** Each trace's own envelopes name exactly one session, so I added a derived view that gives that one session its reference. It is reported separately from the recorded result. Under this view, 4,274 of 6,941 points match. The other 2,667 are all dispositions, and each differs only in the schema version (v1 to v2) and the delivered digests that v1 lacks. Every field a v1 disposition holds matches.
  - In either view: 0 intake defects and 0 nondeterminism.
- **Social throw (`core.run_node threw non_error`).** The replay shows the last delivery points. Three `web.dom.extract_list` commands were issued under a repair-role lease, and each failed with `web.validation.output_not_observed`. Core received and settled each one, and nothing was left unanswered. The throw itself happened outside gateway intake, so no trace event records it (section 4).

## What changed and why

The runner the brief asked for, in `packages/test-runner/src/trace-parity/`. `checkProjectTraceParity` already took any storage root, but it lacked three things for an older store: project discovery, a way to compare traces that predate session references, and a per-trace tail.

- **New files:**
  - `store-projects.ts`: `listStoreProjects(dir)` returns the `projects/<id>/project.sqlite` directories. It reads only the directory listing; traces are read through Core's store API. A missing `projects/` means no projects; any other failure is thrown.
  - `session-evidence.ts`: `traceSessionEvidence(events)` returns `view`, which is one of:
    - `recorded`: every session-bound event names its session;
    - `single_session`: no event names one, and the outbound envelopes and lifecycle records name exactly one session id (counted, never returned);
    - `not_applicable`: anything else.
  - `single-session-store.ts`: a read-only `ClientGatewayTraceStore` view that adds `session-1` to session-bound events that lack it. Writes are refused. It is used only when the view is `single_session`, and always reported apart from `recorded`.
  - `delivery-tail.ts`: `deliveryTail(events, entries, n)` returns the last n delivery points.
    - Each point carries closed protocol names: action, lease role, statuses, failure code and stage, disposition, error kind, synthesized outcome, episode activity and termination. A value that does not look like a protocol name is replaced by `(withheld)`.
    - Commands appear as ordinals (`c1`, `c2`, ...), never ids. Each point also carries its parity status and the trace's unanswered commands.
  - `replay-with-deadline.ts`: the deadline and closed-failure logic, moved out of `check-project-trace-parity.ts` so both runners share it. Behaviour is unchanged, and the existing 5 tests still pass.
  - `check-store-traces.ts`: `checkStoreTraces({ automationDataDir, tailLength })` returns, per project and trace: the manifest facts, the session evidence, `recorded` parity, `singleSession` parity or null, `olderDispositionSchemaOnly`, and the tail. `olderDispositionSchemaOnly` counts the disposition capture gaps whose only differing fields are `payloadSchema.version` and `payload.value.delivered`.
  - `cli.ts`: `node packages/test-runner/dist/trace-parity/cli.js <automationDataDir> [--tail n] [--out file]`. It writes `checkStoreTraces` together with `inspectProjectTraces`' completeness, counts and stored bytes. The output has no payloads.
- **Edited files:**
  - `types.ts`: new `TraceReplay`, `TraceSessionEvidence`, `DeliveryTailRow`, `DeliveryTail`, `StoreTraceCheck` and `StoreTracesCheck`.
  - `index.ts`: barrel.
  - `check-project-trace-parity.ts`: uses the shared deadline helper and `TraceReplay`.
  - `parity-reason.ts`: keeps F2's new reorder reason. Before this change, `delivered in another order than recorded within its causal chain (<chain kind>)` would have been withheld as unknown text. The chain kind is one of Core's four fixed names (`parity-report.ts:214-219`).
- **Tests:**
  - `tests/check-store-traces.test.ts`, 5 tests on Core's real SQLite store:
    - session-stripped trace: recorded all `capture_gap`, view `matched` at every point;
    - v1 dispositions as well: the only divergences are capture gaps, counted by `olderDispositionSchemaOnly`;
    - current trace: recorded only;
    - two named sessions: the view is not applied;
    - project listing.
  - `tests/delivery-tail.test.ts`, 2 tests: ordinals, names, synthesized outcome, unanswered command, withheld value, parity join; no marker text.
  - `tests/parity-reason.test.ts`: 2 new reasons.
  - **Mutation check:** with the view disabled in the built JS, 2 of the 5 store tests failed.
- **Run output (ignored, this tree):**
  - `test-runs/t742r4-logs/` holds the replay logs, `run-all.sh`, `exits.txt` and `store-checks/<run>.json`.
  - `test-runs/t742r4-stores/<run>/automation-studio`: working copies of the four round-4 stores, hash-identical before they were opened, so that Core's migrations (0031/0032) touched the copies and not C's copies.

No Core source was edited: Core's `git status` showed 73 entries before and after.

## Commands run and observed results

1. Core build, in the Core tree: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
   - contracts and websocket: `reuse`;
   - `fluxiq:build ... "build" ... inputs changed: packages/fluxiq ... "ms":167911`, `Done`.
2. `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t742\!FluxIQ is current with its source.`
3. `pnpm --filter @fluxiq-web-extension/extension build` -> `chrome: verified 22 files`, `firefox: verified 22 files`, `e2e-chromium: verified 22 files`.
4. Replays: `sh test-runs/t742r4-logs/run-all.sh`, serial, with `FLUXIQ_DOMAIN_ID` unset (`env | grep -c FLUXIQ_DOMAIN_ID` -> 0) and no `--live-llm`.
   - Each line ran `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs replay <scenario> --workspace t742-<scenario> --flow <id> --project <id> --instruction-task <task>`, with the ids from the copy reports and D2.
   - `exits.txt`: `jobboard exit=1 secs=456`, `company exit=0 secs=196`, `auction exit=0 secs=115`, `classifieds exit=0 secs=80`, `professional exit=0 secs=61`, `crossborder-r2 exit=0 secs=99`, `bigbox-r2 exit=0 secs=91`, `crossborder-r3 exit=0 secs=160`, `bigbox-r3 exit=0 secs=147`.
   - The first run included the Lab's one-time topology and web build.
5. Receipts: read by a scratch script that printed only verdicts, counts, sizes and parity groups.
6. Round-4 stores: `node packages/test-runner/dist/trace-parity/cli.js test-runs/t742r4-stores/<run>/automation-studio --tail 40 --out test-runs/t742r4-logs/store-checks/<run>.json`
   - office exit 0 (31 s), job exit 0 (17 s), photo exit 0 (36 s), social exit 0 (153 s).
   - A re-run on the job store gave identical figures.
7. `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` -> exit 0.
8. `node --test dist/trace-inspection/tests/*.test.js dist/trace-parity/tests/*.test.js dist/saved-flow-replay/tests/*.test.js dist/saved-flow-replay/provider/tests/*.test.js` -> `# tests 77 # pass 77 # fail 0`.
9. `node scripts/structure-audit.mjs` -> `structure-audit: passed (215 warning(s), 618 baselined).`
   - The first run failed 3 rules on my files, all fixed:
     - `as-never` in a test (now a typed value);
     - `failure-as-empty` in the tail's JSON parse (now only `SyntaxError` means "no names");
     - `naming`: 3 `check-` files, so the CLI became `cli.ts`.

### 1. Per-site table (all ten sites)

| site | source | receipt / trace | exit | verdict | events | parity | completeness | secret scan | stored / logical (ratio) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace | D2 + 2 repeats | replay-mvgvqldo-be73a6e8, replay-mvgzx1z6-9eadc8ea, replay-mvh018ot-0947dbf5 | 0,0,0 | passed x3 | 128,128,128 | 128/128 x3 | complete | 3 checked, 0 hits | 568,930 / 572,294 / 574,297 (0.110-0.111) |
| bigbox-retail | D2 + 2 repeats | replay-mvgvvskk-671e4dd7, replay-mvgzz42l-29114e49, replay-mvh05c5g-2219d1c5 | 0,0,0 | passed x3 | 312,309,308 | 312/312, 309/309, 308/308 | complete | 0 hits | 1,279,173 / 1,275,106 / 1,277,154 (0.078-0.079) |
| everything-store | D2 | replay-mvgvy8tz-68a1202f | 0 | passed | 285 | 285/285 | complete | 0 hits | 2,961,158 / 30,009,685 (0.099) |
| social-network-feed | D2 | replay-mvgw4hff-a1ac24ef | 0 | passed | 227 | 227/227 | complete | 0 hits | 836,022 / 9,081,991 (0.092) |
| job-board (t567 Flow) | new | replay-mvgzfrcl-7263e9ce | 1 | failed (dataset: 0 of 1 expected records; final state did not hold) | 155 | 155/155 | complete | 0 hits | 532,585 / 3,425,225 (0.155) |
| job-board (t342 weak Flow) | D2 | replay-mvgw8tcl-6bfaad77 | 1 | failed (wrong rows) | 117 | 117/117 | complete | 0 hits | 461,825 / 3,956,743 (0.117) |
| company-website | new | replay-mvgznjkt-6f33b85b | 0 | passed | 155 | 155/155 | complete | 0 hits | 681,395 / 7,726,451 (0.088) |
| auction-marketplace | new | replay-mvgzrxyk-1d9e09f2 | 0 | passed | 170 | 170/170 | complete | 0 hits | 453,146 / 2,835,978 (0.160) |
| local-classifieds | new | replay-mvgztzgf-0d05cb99 | 0 | passed | 55 | 55/55 | complete | 0 hits | 264,664 / 1,313,563 (0.201) |
| professional-network | new | replay-mvgzvric-93b5e604 | 0 | passed | 85 | 85/85 | complete | 0 hits | 330,656 / 2,071,542 (0.160) |
| photo-social | round-4 photo build trace (run-mvgw7320-de416190, trace.9d22eb, exploration, terminated `failed`: `AutomationStudioFlowBootstrapGenerationError`) | n/a (no saved Flow) | n/a | n/a | 1,693 | recorded 0/1,693; single-session view 1,028/1,693, the other 665 v1 dispositions only | complete | not run (no secrets list) | 79,012,134 / 79,012,134 (1.0, legacy 0030 layout) |

Notes on the table:

- **Every new receipt** shows `coreProviderCallCount 0` and no model providers enabled; secret scans checked 3 secrets with 0 event hits and 0 artifact hits; 0 redacted events; `parityFailure` null; `tracesSkipped` 0. The repeats skipped the earlier traces as designed: 2 and 3.
- **Fresh projects.** The four new sites and job-board were fresh projects (`exclusiveChunks == chunks`), so their ratios are honest single-trace figures.
- **Run and parity times:**
  - runMs: job 29,263; company 65,890; auction 25,322; classifieds 24,141; professional 15,799.
  - Parity: 1,212 / 4,470 / 982 / 576 / 550 ms.

### 2. Repeat stability (step 3)

**crossborder (D2, r2, r3).** What stayed the same:

- verdict passed, 12 actions, run `succeeded`;
- 128 events with identical counts by kind (lifecycle 1, outbound 25, artifact 22, inbound 40, disposition 40) and by message type;
- parity 128/128.

What varied:

- logical bytes: 5,186,814 / 5,186,824 / 5,185,949;
- stored bytes: 568,930 / 572,294 / 574,297, and chunks 404 / 401 / 404 (chunk boundaries);
- artifact bytes: 460,735 / 460,735 / 460,774;
- run time: 27.5 / 26.8 / 36.6 s; parity time: 1,345 / 1,194 / 3,829 ms.

**bigbox (D2, r2, r3).** What stayed the same: verdict passed, 23 actions, and parity matched every time.

What varied:

- Events: 312 / 309 / 308. Outbound 47 / 46 / 46; artifacts 30 / 30 / 29.
- Diffing each trace's command sequence (action, status) against the others: D2 issued one extra `web.dom.capture_snapshot` (command 33 of 47), which adds 3 events (command, result, disposition). r3 uploaded one page artifact fewer (29 vs 30). D1's earlier trace (307 events) has r3's 46-command sequence.
- Stored bytes: 1,279,173 / 1,275,106 / 1,277,154 (ratio 0.078-0.079).

**What it means.** Parity is stable: each trace replays to matched. The live traffic itself varies slightly from run to run, with one optional snapshot and one optional artifact upload. That is browser timing, not intake, and the harness reproduces whatever the trace holds.

### 3. Round-4 live traces (step 4), 16 traces

All 16 traces have trace schema 1, capture boundary 1 and `capabilities: null`. Each was claimed complete and is `complete` by Core's evaluator with 0 issues; none has losses; every command was answered. "Recorded" is parity as recorded; "view" is the single-session view.

| store (lane) | trace | activity / termination | events | recorded matched | view matched | v1-only dispositions | intake defect (recorded / view) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| office run-mvgvyaip (t563) | trace.772fdd | exploration / completed | 1,206 (6 control) | 0/1,200 | 728/1,200 | 472 | 1 / 0 |
| | trace.faef40, .535e84, .ba1086 | test x3 / completed | 184, 161, 208 | 0 | 116, 100, 130 | 68, 61, 78 | 1 each / 0 |
| job run-mvgw1854 (t719) | trace.5ef4fa | exploration / completed | 1,330 (2 control) | 0/1,328 | 813/1,328 | 515 | 1 / 0 |
| | trace.53d442 | test / completed | 181 | 0 | 111/181 | 70 | 1 / 0 |
| photo run-mvgw7320 (t567) | trace.9d22eb | exploration / failed | 1,693 | 0 | 1,028/1,693 | 665 | 1 / 0 |
| social run-mvgw3ve5 (t566) | trace.5c07f1 | exploration / completed | 892 (16 control) | 0/876 | 540/876 | 336 | 1 / 0 |
| | 8 test traces (7480fe, a4d596, b414b6, e855db, f53b35, b2b598, 92d5dd, 3e3534) | test / completed | 126, 115, 332, 118, 89, 117, 124, 89 | 0 | 80, 73, 215, 75, 56, 74, 79, 56 | 46, 42, 117, 43, 33, 43, 45, 33 | 1 each / 0 |
| **total** | 16 | | 6,965 (24 control, `outside`) | **0 / 6,941** | **4,274 / 6,941** | **2,667** (= every view divergence) | **16 / 0** |

**What the harness can compare on these traces:**

- **As recorded: nothing.** The walk feeds no event that names no session. All 6,941 points are `capture_gap` "the event does not say which session it belongs to" (Core `client-gateway/trace-replay/walk/walk.ts:350`).
- **Under the single-session view, which the traces' own evidence supports** (`namedSessions` 1 in every trace; no lifecycle connects):
  - Every outbound message, inbound message, artifact and command matches: 4,274 points, byte-equal after session-id translation.
  - Every disposition differs only in `payloadSchema.version` (1 vs 2) and `payload.value.delivered` (absent in v1), so their `disposition` and `error` fields match.
- **Where the gaps come from.** Both kinds of gap exist because these traces were captured before C1 (session references, delivered digests) and F2 (`session.claimed`). Neither is a real divergence.
- **Storage.** These stores keep the legacy 0030 layout (inline rows and object rows; stored = logical, 695,866,510 bytes for 16 traces). Social alone is 556,334,087 bytes; its exploration trace is 228,802,027 bytes, of which 227,619,566 are 169 object events. Opening the stores applied 0031/0032, which do not rewrite old rows. So none of the chunk-store savings applies to traces captured before P3-A.

### 4. The social throw (`core.run_node threw non_error`)

The last delivery points of trace.5c07f1 (exploration), under the single-session view:

| seq | t | kind | type | cmd | parity | names |
| --- | --- | --- | --- | --- | --- | --- |
| 882 | +1482.4 s | outbound | server.execute_action | c151 | matched | action `web.dom.extract_list`, leaseRole `repair` |
| 883 | +1488.4 s | inbound | client.action_result | c151 | matched | `failed`, `web.validation.output_not_observed`, stage `verification` |
| 884 | +1488.4 s | disposition | | c151 | diverged (v1 only) | `settled` |
| 885-889 | +1488.6 to +1495.5 s | c152: same as c151 (a state update `accepted` in between) | | c152 | matched / v1 only | `failed`, `output_not_observed`; `settled` |
| 890 | +1496.5 s | outbound | server.execute_action | c153 | matched | `web.dom.extract_list`, `repair` |
| 891 | +1503.0 s | inbound | client.action_result | c153 | matched | `failed`, `web.validation.output_not_observed`, `verification` |
| 892 | +1503.0 s | disposition | | c153 | diverged (v1 only) | `settled`, error none |

**What the trace shows:**

- 153 commands, 0 unanswered, no synthesized outcome (no timeout, no close), no loss.
- The 8 trial (child) episodes all closed `completed`, the last at +1320 s. No 9th child episode was opened.
- The trace closed at +1503.8 s, 0.8 s after Core settled c153's failed result, with termination `completed`.

**What follows from that:**

- The throw happened after intake had handed c153's result to its caller. It was in work that sends nothing over the gateway: a repair brief's `run_node`, by the lease role.
- The episode's work caught the throw, because the episode closed `completed`. Core decides the termination by whether the episode's work threw (`runtime/gateway-trace/episodes.ts:90-111`, `COMPLETED` at `:22`). So the trace cannot show the throw: what was thrown, or where. `non_error` means the thrown value was neither `instanceof Error` nor carried a string `code` (`runtime/llm/step-log/summary.ts:28`).
- Because v1 dispositions hold no delivered digest, this trace also cannot prove what result object the caller received. A current (v2) trace would.

Not fixed, per the brief.

### 5. Every divergence, classified (step 5)

1. **6,941 `capture_gap`: "the event does not say which session it belongs to"** (all 16 round-4 traces, as recorded).
   - Class: capture gap, correctly classified (Core `trace-replay/walk/walk.ts:350`).
   - Evidence: `referenced 0` on every trace.
   - Cause: the tap gained session references in C1, after round 4 was captured.
2. **16 `intake_defect` on `manifest.artifacts`: "the replay took 0 artifacts where the recording took N"** (one per round-4 trace, as recorded).
   - Class: **misclassified by the harness.** These are capture-gap consequences.
   - Evidence: `walk.ts:159-160` (`feedArtifact` returns through `replaySession`, which records the session gap). `parity-report.ts:133-146` then looks for a gap reason containing the word "artifact" (`:137`). The session gap's reason does not contain it, so the class falls to `intake_defect` (`:143`). Under the single-session view all 16 disappear: the replay takes the same artifacts.
   - Fix belongs in Core: `artifacts()` should treat any artifact event gap as the cause. Not edited.
3. **2,667 `capture_gap`: "recorded under another payload schema than the replay records"** (dispositions, single-session view).
   - Fields are exactly `payloadSchema.version` and `payload.value.delivered`.
   - Class: capture gap, correctly classified (`trace-replay/comparison/divergence-class.ts:16`).
   - Cause: disposition schema v1 (before C1's delivered digests; v2 at `service/trace-tap/schemas.ts:9`). The v1 fields match.
4. **None** in the 14 new saved-Flow replays (1,493 of 1,493 points).
5. **No nondeterminism and no intake defect in any trace,** except the 16 misclassified in item 2.

## Not verified

- Headed mode: the Lab's default is headed and I passed no headless flag, but I did not watch a window.
- **Why the t567 job-board Flow stores 0 records.** The copy reports call it the passing Flow. Core ran it `succeeded` in 17 actions, and the extraction reported 0 observed of 1 expected record. I did not investigate further. Possible causes: site state, a task or oracle revision after 10-17, or a Flow from a different variant.
- The cause of bigbox's extra snapshot and artifact (timing is inferred, not proven).
- The social step log, and the round-4 run folders in the lane trees: not read, because they are forbidden. The link between "repair brief" and `core.run_node` is an inference from the lease role and timing.
- Secret scans on the round-4 stores: no secrets list was available, because the copied credentials must not be read.
- The single-session view on a trace with several sessions or a mid-trace reconnect: it refuses those by design. None of the 16 traces needed it.
- Firefox, and harness paths these traces never exercise: reconnects, pairing approval, reconcile questions, timeouts.

## Open questions or contradictions found

1. **Core `parity-report.ts:137`** classifies a manifest-artifact mismatch caused by a session (or any non-"artifact"-worded) gap as `intake_defect`. It needs a one-line Core fix: treat a gap on any artifact event as the cause. Until then, older traces report 1 false intake defect each.
2. **The job-board "passing" t567 Flow fails its verdict on replay** (0 of 1 records; final state not held), while parity matched. This contradicts `lane-t-p3-c-copies.md`'s "passing Flow". Before the Flow is used as a positive case, someone should check which variant and task revision it passed.
3. **Exploration traces end `completed` when a tool throw is caught inside the episode** (social). A reader of the trace cannot tell that the run ended on a throw. If that matters, the episode boundary would need the build's own outcome, not only whether its work threw (`episodes.ts:111`).
4. **The single-session view is a derived input.** It is kept apart from `recorded`, and it is used only when the trace itself names exactly one session. The supervisor decides whether to cite its figures as evidence or only as diagnosis.
