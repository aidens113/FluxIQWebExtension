# Report: lane-t-p2-m-overhead (capture chain proof and overhead, provider-free)

## Outcome

Partial. The tooling is done and passes its checks, and all 36 replays passed their judging. The capture chain has a
Core defect: in the Lab's default configuration, tracing on stores one closed, empty trace per run (0 events,
0 artifacts). The cause is found (below) but not fixed here, because Core is out of scope. With one environment
variable that avoids the defect (`FLUXIQ_DOMAIN_ID=web-automation`, a run setting, not a code change), the chain works
from end to end on all four tasks:

- every traced run is `complete` by `evaluateClientGatewayTraceCompleteness`, with 0 issues;
- 128-309 events and 11-73 artifacts per run;
- no secret in any stored event or artifact;
- the judged outcome is the same off and on.

Overhead with tracing really capturing: run time +11.5% overall (+6.6% to +18.2% per task, about 80-360 ms per
traced command). Stored bytes: 161-835 KB per traced command. The events, not the page snapshots, take most of
that space.

## What changed and why

- `packages/test-runner/src/commands.ts`, `cli.ts`: `lab replay ... --no-tracing` sets `tracing: false`. It is passed
  to `replaySavedFlow` and then to `startTopology`, which sets `FLUXIQ_CLIENT_GATEWAY_TRACE=0`. Without the flag,
  tracing is on (D11). Tests are in `src/tests/commands.test.ts` (two new tests). A separate test file would have
  pushed `src/tests/` past its 49-file baseline.
- `saved-flow-replay/replay-saved-flow.ts`: the receipt now also has:
  - `tracing`;
  - `timings`: `totalMs`, `topologyMs`, `browserMs`, `runMs`, `teardownMs`, `traceInspectionMs`;
  - for each run attempt, `nodeId`, `attemptIndex` and `durationMs`;
  - `traces`: the stored traces, read after Core stops (filtered to traces started at or after the replay's start),
    with secret-source counts.

  The extension's gateway token is read twice: after pairing and again before the browser closes. It is held in
  memory only, so the secret search can look for it. A failed read is counted in the receipt
  (`sessionTokenReadFailures`), not dropped.
- New `saved-flow-replay/extension-session-token.ts`: reads `fluxiq.session.token` through the extension service
  worker.
- New `saved-flow-replay/stored-traces.ts`: `inspectReplayTraces`. It reads `<storage>/artifacts/automation-studio`.
  If the store cannot be read, it returns a named failure instead of throwing.
- New `trace-inspection/`, a barrel with one export per file:
  - `inspectProjectTraces` reads through Core's own `AutomationStudioProjectDatabasePool` and
    `AutomationStudioProjectGatewayTraceStore` (`listManifests`, `readEventRange`, `listArtifacts`, `readArtifact`).
  - `summarizeTrace` judges completeness with Core's evaluator. It also counts events by kind, stream and message
    type, event bytes inline vs content object, artifacts held, the `metadata.trace` references (by role, media type
    and unavailable), credential redactions on hello/pairing_submit/session_ready, and command round trips.
  - `traceArtifactDedupe` counts artifact bytes across traces, with each digest counted once.
  - `holdsAnySecret` searches UTF-8 and UTF-16LE.
  - `tracePayloadValue` names unparsable text instead of reading it as empty.

  Tests: `trace-inspection/tests/{summarize-trace,inspect-project-traces}.test.ts`, which write real traces through
  Core's recorder into the memory store and the real SQLite store, and `saved-flow-replay/tests/replay-tracing.test.ts`.

## Tasks and Flows (provider-free, headed)

The main checkout and `lab-runs` hold no saved Core workspace: `lab-runs` keeps evidence only, and the 10-18 passes'
workspaces are in lane trees. So I copied four idle workspaces, last written 10-16/10-17, from the non-lane worktree
`fxwork/t565` into this tree's `test-runs/persistent-isolated/t736m-*`. The Flow and project ids come from
`lab-runs` `creation-context.json` of passed builds:

| task (scenario) | Flow | build run |
| --- | --- | --- |
| crossborder-marketplace-hub-to-cart | flow.77711719-8dac-4117-9c25-19402953e140 | run-mvan7ww9-93e9ab0f |
| bigbox-retail-pickup-cart | flow.8b6d3c62-ebf5-4df0-92f4-4146aaef4f88 | run-mvbyc30x-e827a493 |
| everything-store-plus-earbuds-under-50 | flow.a7a87ef8-89d5-40ef-a0be-6ac831b6c966 | run-mv9qt9lt-d092c61f |
| social-network-feed-confirm-requests | flow.5c557bc2-aeb7-4845-a12f-c02de6e1e212 | run-mvanqgrc-513be545 |

For each task I ran a warm-up (off), then off, on, off, on, in two sweeps:

- S1: the Lab default.
- D: the same with `FLUXIQ_DOMAIN_ID=web-automation`.

That is 36 replays; every one exited 0 with verdict `passed`, a succeeded run, 0 model calls, the same attempt
count off and on, and the same dataset digests.

## Core defect: the run's gateway never records (root cause)

**Symptom (S1, every traced run):** the trace is `execution`, `completed`, claims `complete`, and has 0 events and
0 artifacts. Example: replay-mvgkxfj6-80ab68e8, trace trace.d10436ae-23a4-42fb-b397-92031c802957 for run
558bb4d9-..., open 11:08:13.5-11:08:37.9Z.

**Evidence:** the Core log of every traced S1 run (copied during the run) has
`Client gateway tracing is already installed in this process; this runtime records no traces.`. No off run has it,
and neither does the D probe replay-mvgmzafm-b41a7a61.

**Cause:**

1. Core `apps/web/src/lib/fluxiq.ts:171-179` `createFluxIQWebInstance` builds one `FluxIQ`. When that has no active
   domain and exactly one domain is registered (the Lab's case), it builds a second one and discards the first
   without closing it.
2. The first instance's `createGlobalProgramRuntime` (`programs/_shared/runtime.ts:79`) calls
   `createAutomationStudioGatewayTraceHost` (`gateway-trace/wiring/host.ts`). That installs the process-wide episodes
   E1 and gives E1's capture source to the first instance's gateway.
3. The second, live instance hits the "already installed" guard and gets `OFF`, so its gateway has no `trace`
   source.
4. The live service's run and trial ports still find E1 through the static `AutomationStudioGatewayTraceInstallation`.
   So they open and close traces through instance 1's pool, while the live gateway records into nothing.

Also, nothing ever calls the trace host's `uninstall`: neither `FluxIQ.close()` nor `_shared/runtime.ts` does. So
`reloadFluxIQWebInstance` (the setup route's migrate/rollback) would hit the same guard.

**Confirmed:** setting `FLUXIQ_DOMAIN_ID` makes the first instance the live one, and capture works.

**Fix belongs in Core** (not done here). Choose the domain before creating the instance, or uninstall and close the
discarded instance. Uninstall also belongs in `FluxIQ.close()`. Tests T02/T03 pass only in process, so a web-host
test is the missing gate.

## Overhead (sweep D, tracing actually capturing; mean of 2 pairs)

| task | runMs off | runMs on | delta | % | attempt-sum % | traced cmds | overhead/cmd |
| --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder | 37,002 | 40,762 | +3,760 | +10.2% | +15.8% | 25 | 150 ms |
| bigbox | 46,205 | 50,040 | +3,836 | +8.3% | +5.4% | 46 | 83 ms |
| store | 82,664 | 97,740 | +15,076 | +18.2% | +8.2% | 42 | 359 ms |
| social | 73,340 | 78,181 | +4,842 | +6.6% | +25.2% | 59 | 82 ms |
| all (8 pairs) | 478,420 | 533,445 | +55,025 | +11.5% | +11.2% | | |

Wall time `totalMs` across D was +18.4%, but it includes Core start and teardown, which vary between 16 and 90 s.

The control sweep S1, where tracing was on but stored nothing, shows the noise: run +0.4% overall (per pair -7.1% to
+13.0%), attempts -0.8%. The D overhead is therefore real, about 11 percentage points above noise. The per-pair
spread is wide (+4.1% to +26.3%); store pair 2 alone was +26%.

Per step (Core attempt durations, matched by node and attempt):

- the steps that cost most are `web.dom.check` (+0.2-0.5 s over 2-3 checks, +59-75%) and `web.browser.navigate`
  (+0.3-1.1 s);
- social-feed clicks cost +7.2-7.8 s over 6 clicks (+38-41%);
- extract_list and next_page cost +9-12%.

`capture_snapshot` takes 0.8-1.1 s on average from command to answer with tracing on. With tracing off it cannot be
timed by trace, so the per-step attempt durations are the off/on comparison.

In S1, crossborder's off runs were about 10 s shorter than in D (26-27 s vs 36-38 s) with equal attempt sums. The
difference is outside the attempts and unexplained (not verified).

## Bytes (sweep D, traced runs; the two pairs agree to within 0.1%)

| task | events | event bytes (inline / object) | artifacts held (bytes) | refs primary / resource | stored per traced cmd |
| --- | --- | --- | --- | --- | --- |
| crossborder | 128-129 | 5.16 MB (4.89 MB / 0.28 MB, 1 object) | 22-23 (461-501 KB) | 25 / 126 | 226 KB |
| bigbox | 307-309 | 16.16 MB (5.47 / 10.68 MB, 31 objects) | 29-31 (1.10-1.20 MB) | 46 / 138 | 376 KB |
| store | 297 | 33.70 MB (0.61 / 33.09 MB, 38 objects) | 73 (1.38 MB) | 42 / 388 | 835 KB |
| social | 224 | 9.04 MB (6.92 / 2.13 MB, 7 objects) | 11 (472 KB) | 59 / 0 | 161 KB |

- **Events by kind** (crossborder, bigbox, store, social):
  - outbound: 25, 46, 42, 59;
  - inbound: 40-41, 116, 91, 77, each with an equal number of dispositions;
  - artifact (stream `artifact`, the extension's uploads): 22-23, 29-31, 73, 11.
- **Message types:** `server.execute_action`, `client.action_result` (2 per command), `client.state_update` and
  `client.recording_event`. Every command was answered (25/25, 46/46, 42/42, 59/59).
- **Uploads by the extension:** one artifact event per stored artifact (11-73 per run). The upload is content
  addressed, so each digest is stored once per trace. The results reference far more artifacts than are stored:
  - store: 430 references declaring 3.60 MB, against 73 stored (1.38 MB);
  - crossborder: 151 references declaring 1.07 MB, against 22-23 stored.

  Media types are `text/html` (primary) and `image/svg+xml` (resources). `unavailable` was 0 on every run, and no
  payload was unparsable.
- **Dedupe across traces** is per inspection, and each inspection holds one trace, so references equal distinct
  there. The within-trace dedupe above is the measured saving.
- **Finding:** event JSON (raw action results and state updates) is 92-96% of stored bytes. A store run writes
  33.7 MB, 38 events of about 870 KB each in the content store. Page-snapshot artifacts are only 33 KB per command
  after dedupe.

## Completeness and secrets

- **Completeness:** all 8 D traces are `complete`, with 0 issues. Store's traces have 5 `secret` redactions each,
  from the screening sink (5 redaction-limited scopes). All S1 traces are `complete` with 0 events, which is vacuous.
- **Secret search, in process, via the store API:** every manifest, event and artifact byte was searched for the
  Lab's controller token, the Core authorization password and the extension's gateway token, as UTF-8 and UTF-16LE.
  The gateway token was read in every run, with 0 read failures. Result: 0 event hits and 0 artifact hits on all 36
  replays; D searched 128-309 events and 11-73 artifacts per run. No value was printed.
- **Hello/session_ready redaction:** not observable on this route. Pairing happens before the run's episode opens,
  so no run trace held `client.hello`, `client.pairing_submit` or `server.session_ready` (0 events each). The
  redaction is covered only by lane G's gateway tests.

## Commands run and observed results

- `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at ...\t736\!FluxIQ is current with its source.`
- `pnpm --filter @fluxiq-web-extension/extension build` -> `extension build: e2e-chromium: verified 22 files` (chrome
  and firefox also verified).
- Each replay ran as `FLUXIQ_TEST_ENV_FILES=none [FLUXIQ_DOMAIN_ID=web-automation] node scripts/lab/run-lab.mjs replay <scenario> --workspace t736m-<x> --flow <id> --project <id> --instruction-task <task> [--no-tracing]`.
  `pnpm lab` is that script. `.env.local` holds a provider key, so env files were off, and the replay refuses
  otherwise. No `--live-llm` was used, so nothing was admitted or recorded in `lab-slots`.
  - 36 of 36 exit 0. Receipts are in this tree's `test-runs/replays/`; the drivers' `runs.tsv` and `runs-d.tsv` are
    in `test-runs/t736m-logs/`.
  - S1 receipts: crossborder replay-mvgkvwii/-mvgkxfj6/-mvgkytlv/-mvgl06ec, bigbox replay-mvgl3hq7/-mvgl5ebq/-mvgl7al5/-mvgl9fci,
    store replay-mvgliyf9/-mvglnfbq/-mvglqcyb/-mvglth1m, social replay-mvglxz01/-mvgm19hp/-mvgm4upx/-mvgm8d41.
  - D receipts: crossborder replay-mvgn1f63/-mvgn40nw/-mvgn7bur/-mvgnc6v8, bigbox replay-mvgnghkq/-mvgnihab/-mvgnki7i/-mvgnmite,
    store replay-mvgnouev/-mvgnrwmj/-mvgnv1pu/-mvgny3p4, social replay-mvgo1wua/-mvgo5if0/-mvgoa1fo/-mvgoghri.
  - Probe: replay-mvgmzafm-b41a7a61.
- `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` -> exit 0.
- `node --test` on the trace-inspection, replay-tracing, replay-saved-flow, commands, environment and
  coordinator-existing tests -> `# tests 76 # pass 76 # fail 0`.
- `node --test` on `dist/saved-flow-replay/tests/*.test.js`, `dist/saved-flow-replay/provider/tests/*.test.js` and
  `dist/trace-inspection/tests/*.test.js` -> `# tests 57 # pass 57 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (214 warning(s), 618 baselined).`

## Not verified

- The overhead with the Lab's default configuration once the Core defect is fixed. D's numbers stand in for it, but
  they come from a domain-pinned web host.
- The source of crossborder's roughly 10 s off-run difference between the sweeps.
- Off-mode per-command round trips: there is no trace with tracing off, so the comparison uses Core attempt
  durations.
- Credential redaction of hello/session_ready inside a run trace: none occurred.
- Cross-run artifact dedupe in one store: each inspection was limited to its replay's trace.
- The in-page capture cost by itself: the content harness was not run.
- Firefox.

## Open questions or contradictions found

- The Core defect above blocks the plan gate in the Lab's default configuration. Should the Lab also set
  `FLUXIQ_DOMAIN_ID` until Core is fixed? That would be a one-line change in `environment.ts`, which this brief did
  not own.
- Event payloads dominate storage: 33.7 MB per store run, mostly raw action results with page views. That may need a
  policy (deduplicated page-view bodies, or compression) before tracing is on for every live run.
- The brief's "pairing token the Lab issued": the Lab never holds the gateway bearer token. I searched for the token
  Core issued the extension, read from extension storage. The pairing reference code was not captured.
