# i-stage3-load-failures — W10's `recording.persistence`, W13's `gateway.connection`, and W16's `inconclusive`, in the stopped benches (read-only)

Worker `i-stage3-load-failures`, 2026-09-13.
- **Brief:** "i-stage3-load-failures" in `briefs/finish-week1.md`, plus the supervisor's addition. The addition asked for bench A's W10 bundles, W16's inconclusive run, and `l-stage2d`'s W10 bundles as the load comparison.
- **Evidence read:** bundles under `F:\fxlab-runs\stage3\b\`, `F:\fxlab-runs\stage3\a\` and `F:\fxlab-runs\stage2d\d\`.
- **Code read with `git show`:**
  - this repository at the Lab pin `d639415`;
  - Core at its pin `3cb8976`;
  - the HEAD working tree only for the lines named in the fix.
- **Evidence rules:** every figure is a key, kind, id, count or time. Scripts printed a string value only when it had the shape of an id, code or time, or was a known runner message. Every other string printed as its length. Core's log was reduced to method, route, status and milliseconds, or to a word skeleton.
- **Times:** ending in `Z` are UTC; "local" is UTC-7.

## Outcome

**Done.** Every figure rests on single observations under shared load, on a machine with faulty RAM. Nothing was rerun.

1. **W10 (5 failures: bench A ×3, bench B ×2): a load artifact.** A 30,000 ms bound is shorter than Core's measured time to store W10's recording while two benches run.
   - All five stopped inside the runner's first "wait for Core to finish the recording", before any completeness check, discard read or Flow.
   - All five ran between 18:03:04Z and 18:07:35Z, while both benches were on W10 at the same time.
   - W10's recording is the largest among the rows reached, 24 to 26 entries. It is the slowest row to finalize even without a second bench: 10.8 to 15.4 s in `l-stage2d`, where every other row took 8.0 s or less.
   - With two benches running, Core's time per stored entry roughly doubled (median 634 ms alone, 1,001 ms in A, 1,420 ms in B). At those rates W10 needs 26 to 37 s, straddling the bound.
   - B's `broken-link` run, the one W10 run that passed, finalized at 25,789 ms. It started after bench A had left W10.
   - **Smallest fix:** `packages/test-runner/src/flow-lane/finalized-recording.ts:71`, `DEFAULT_TIMEOUT_MS`, from `30_000` to `90_000`.
   - **Two small runner defects hid the cause:**
     - the wait's own counts never reach the bundle (`run-scenario.ts:377`);
     - one message says "timeline kept growing" where the evidence fits a finalize that landed on the last poll.
2. **W13 Flow (B): not classifiable from the evidence; it has the timing-only shape and leans load.**
   - It was raised in the runner's first pairing poll: `run-scenario.ts:514`, with the 15,000 ms bound at `:603`. Within 15 s, the extension never reported a pairing code or a connected session.
   - Core's log stops before `approve-pairing`.
   - There is no extension log, and the poll throws without the last status it read.
   - **Fix:** publish that status first, then decide on the bound. No bound change without a measurement.
3. **W16 recording lane (A), inconclusive: an artifact of bench A's stop procedure.** It is not load, a bound or a product defect.
   - The run itself finished: a `final` event, 1/1 actions, 0 discards, and a 5,035 ms finalize.
   - Then the runner's provenance read `git rev-parse HEAD` failed. That was about 33 s after the stop script's first `taskkill` terminated `conhost.exe`, the console host of the whole Lab tree.
4. **Stage 4:** run the two benches one after the other, or land the 90 s bound, and the details fix, before running them together.

## What changed and why

- **Tracked files:** none edited. This report is the only file written in the repository. Nothing was written under `F:\fxlab-runs`, and nothing under `F:\fxlab-runs\probe` or `F:\fxlab\` was opened.
- **Scratch files,** in the session scratchpad, all named `islf-*`:
  - `islf-runs.mjs`: rows, lanes and verdicts from both benches' `runs.json`;
  - `islf-bundle.mjs`: the safe key and value summariser for a bundle;
  - `islf-latency.mjs`: finalize-wait figures, per-run times and `list-recordings` latency for every bundle in a directory;
  - `islf-logskel.mjs`: a word skeleton of Core's log;
  - outputs: `islf-runs-out.txt`, `islf-bundle-b.txt`, `islf-bundle-a.txt`, `islf-bundle-w16.txt` and `islf-latency-out.txt`.
- **Another worker's scratch, read only to time W16 against the stop:**
  - `l-stage3a-stop-output.txt`, filtered to its kill and time lines;
  - `l-stage3a-taskkill.log`, one line;
  - three file modification times.

## Commands run and observed results

### 1. W10: the five failures side by side

**Where they were raised.** The first two quoted messages exist only in `awaitFinalizedRecording`, at `finalized-recording.ts:137` and `:138` (same at HEAD). Its bound is `DEFAULT_TIMEOUT_MS = 30_000` (`:71`), with a 200 ms interval. Both lanes reach it first through `assertCoreRoundTrip` (`run-scenario.ts:593` at `d639415`), with no wait options. None of the five bundles has either of the two events that follow that wait:
- the `gateway.action` event (`:313`);
- the `runtime.settle` "Core persisted the completed recording" event (`:314`).

So none reached:
- the completeness read (`:312`);
- the first discard read (`:309`);
- the Flow lane: `flowCreated=false` on the Flow rows.

| Bench, lane | Run | Message (runner text) | Last step → error | `list-recordings` calls (in the wait: total − 2), median / max ms |
| --- | --- | --- | --- | --- |
| A, recording | `run-mu04gu5b-fd288c74` | "Core was still writing the run's recording after 30000 ms, …" | 18:03:49.425Z → 18:04:21.290Z, **31,865 ms** | 23 (21), 841 / 5,699 |
| A, Flow | `run-mu04iq4d-3f2253f8` | the same | 18:05:08.039Z → 18:05:40.236Z, **32,197 ms** | 28 (26), 800 / 2,575 |
| A, Flow `broken-link` | `run-mu04kecn-362d60d4` | the same | 18:06:30.763Z → 18:07:02.230Z, **31,467 ms** | 32 (30), 620 / 2,598 |
| B, recording | `run-mu04jb46-7332cc99` | "Core reported the run's recording finished but its timeline kept growing for 30000 ms, so it was never safe to read" | 18:05:39.721Z → 18:06:12.483Z, **32,762 ms** | 32 (30), 610 / 2,694 |
| B, Flow | `run-mu04l0xu-7fd1bbfe` | "Core was still writing the run's recording after 30000 ms, …" | 18:06:56.329Z → 18:07:27.497Z, **31,168 ms** | 28 (26), 791 / 3,917 |

"Total − 2" rests on B's recording run. Its log has the baseline read (line 28), one read before the wait (line 32), and 30 polls (lines 33-62). The other four are assumed to have the same shape.

**Common to all five:**
- **Details.** The `error` event's detail keys are `failureCategory` and `capture` only. None of the wait's details reached the bundle: `recordingId`, `recordingSeen`, `endedAt`, `entryCount`, `entriesAppendedWhileWaiting`, `waitedMs`, `polls` and `timeoutMs` (defect D1 below). **The five recordings' entry and poll counts are therefore unknown.**
- **Steps.** Four steps succeeded: `full-navigation`, `second-page`, `history-page` and `navigation-final`, in 0 to 140 ms each. `actions` is empty in `run.json`. The Core probe was skipped with reason `no-css-type-step`.
- **Timings from Stop to finalize to deadline.** The bundle does not stamp Stop.
  - Last step to error minus 30,000 ms leaves 1,168 to 2,762 ms. That covers the step-to-Stop gap, Stop, one gateway snapshot, one `list-recordings`, and the final poll plus sleep. So the wait began within about 1.2 to 2.8 s of the last step.
  - The deadline was wait start + 30,000 ms.
  - Finalize was not observed within the bound in four runs.
  - In B's recording run, the branch taken at `finalized-recording.ts:135-139` means the last read carried `endedAt`. The loop returns on the second consecutive finished read at the same count (`:102-116`), and Core refuses appends after finalize (`service.ts:1016`, per `i-demo-recording-finalize`). So `endedAt` most likely appeared only on the poll past the deadline. That places finalize about 30 s after the wait began. **This is an inference; D1's details would settle it.**
- **`recordedActions`, extension against Core: never measured in any of the five.** The extension count is read before Stop (`run-scenario.ts:294`). It is published only in the settle event at `:314`, which none reached.
- **Discards:** no discard read ran, so there are 0 discards of any kind. That agrees with both stage reports.

**A against B:** the same failure point, timings within 1.6 s of each other, and the same missing details. The messages differ only in B's recording run, as above.

**Overlap:** A's W10 runs span 18:03:04Z-18:07:04Z and B's span 18:04:59Z-18:07:35Z. B's `broken-link` started at 18:07:36Z, after A had moved on to W11, and passed.

### 2. The load comparison: `l-stage2d`'s W10, and every finalize wait published

**W10 runs that passed.** From each bundle's settle event `details.recordings[0]` and `recordedActions`:

| Directory, lane | Run | Entries | Appended after first poll | `finalizationWaitMs` | Last step → settle | Actions ext/Core | `list-recordings` median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `stage2d\d`, recording | `run-mu03fmfv-41855643` | 24 | 22 | **10,804** | 12,460 | 1/1 | 396 |
| `stage2d\d`, Flow | `run-mu03ghkn-920fa194` | 26 | 25 | **12,771** | 23,654 | 2/2 | 381 (max 9,631) |
| `stage2d\d`, Flow `broken-link` | `run-mu03hzhu-7bf12601` | 26 | 24 | **15,428** | 16,868 | 2/2 | 395 |
| `stage3\b`, Flow `broken-link` | `run-mu04mo17-d4c6a910` | 26 | 24 | **25,789** | 27,627 | 2/2 | 543 |

**Every bundle.** Nearest-rank percentiles; "per entry" is `finalizationWaitMs` ÷ entries appended after the first poll.

| | `stage2d\d`: 29 bundles, 17:19:39Z-17:39:55Z | `stage3\a`: 39 bundles, 17:39:45Z-18:22:02Z | `stage3\b`: 34 bundles, 17:40:51Z-18:18:37Z |
| --- | --- | --- | --- |
| `finalizationWaitMs` (n, p50, p90, max) | 24; 4,942; 10,804; 15,428 | 31; 8,494; 19,765; 28,241 | 26; 10,534; 23,005; 27,180 |
| ms per entry (p50, p90, max) | 634; 1,090; 2,170 | 1,001; 2,172; 7,151 (W08 `column-reorder`, 3 entries) | 1,420; 1,866; 2,670 |
| last step → settle (p50, p90, max) | 6,470; 12,460; 23,654 | 10,399; 23,986; 30,853 | 12,125; 26,248; 29,586 |
| per-run median `list-recordings` ms (p50, max) | 385; 458 | 466; 939 | 499; 837 |
| run start → first event (p50, p90, max) | 24,175; 26,392; 29,231 | 33,781; 44,029; 50,983 | 35,926; 43,346; 48,526 |
| passing finalize waits above 20 s | 0 | 3: W01 Flow 28,241, W07 Flow 26,662, W08 `column-reorder` 21,453 | 4: W01 recording 27,180, W10 `broken-link` 25,789, W07 Flow 23,005, W12 recording 22,727 |
| `recording.persistence` timeouts | 0 | 3, all W10 | 2, all W10 |

What these show:
- **Even alone, Core stored almost all of W10's entries after Stop:** 22-25 of 24-26 were appended after the wait's first poll. Core's storage trails the recording by nearly the whole recording, as `i-demo-recording-finalize` found for the demo.
- **W10 is the slowest row alone.** In `l-stage2d` only W02 (21 entries) and W10 (24-26) reached 20 entries, and W02 finalized in 6.7-8.0 s. W15 (25-26 entries) was measured only under load, in A: 18,606, 5,426 and 12,169 ms.
- **Memory was not the pressure.** Free memory within the failed W10 runs was 6.71 and 8.01 GB (`l-stage3b`). Bench A's lowest was 5.42 GB, at 10:43 local (`l-stage3a`).
- **Concurrency by bundle time at 18:03-18:08Z: benches A and B.**
  - `l-stage2d`'s last bundle finished 17:39:55.85Z.
  - The demo ran 17:43-17:49Z (`i-demo-recording-finalize`).

### 3. W10's verdict: a load artifact, not a defect in the recording

- **The bound and Core's latency.** W10's recording has 26 entries. At the per-entry medians under two benches (1,001 and 1,420 ms), Core needs about 26-37 s; at the p90s (1,866-2,172 ms), about 49-56 s. The 30,000 ms bound sits inside that range. That explains W10 failing while both benches loaded Core (5 of 5) and passing when they did not (`l-stage2d` 3 of 3, and B's `broken-link` after A left).
- **No sign of a lost action.** Every W10 run that passed had equal extension and Core action counts (1/1, 2/2, 2/2, 2/2) and no action discard. None of the five failures got far enough to show a loss or rule one out.
- **The underlying cost is Core's per-entry storage.** Each append rewrites indexes (`i-demo-recording-finalize`). That is a Core performance item, not a correctness defect, and Week 1 does not need it fixed once the bound is right.

**Two small runner defects in observability, found on the way:**
- **D1.** `run-scenario.ts:377` (pin and HEAD) adds `failureDetails` to the `error` event only for `recording.contract`. The finalize wait builds its details at `finalized-recording.ts:121-131`, and they are dropped. That contradicts that file's own comment (`:29-30`) that "the counts travel into the failure and the run bundle". It is why the five failures carry no entry count, poll count or `endedAt`.
- **D2.** `finalized-recording.ts:135-139` says "its timeline kept growing" whenever the last read had `endedAt`. That includes a first `endedAt` on the read past the deadline, which is a bound hit, not growth. B's recording run most likely reads that way (see section 1).

### 4. The smallest fix for W10, and its value

- **File and bound:** `packages/test-runner/src/flow-lane/finalized-recording.ts`, `DEFAULT_TIMEOUT_MS` (line 71, the same at HEAD), from `30_000` to **`90_000`**.
- **Why 90 s:**
  - It gives W10's 26 entries 3.4 s each. That is about 1.3× the worst per-entry rate measured on a multi-entry recording under two benches (2,670 ms, B), and 2.4-3.5× the median rates.
  - A healthy run gains nothing, because the wait returns on Core's `endedAt`.
  - It still fails, so an unfinished recording is never handed on.
- **Effect on the Flow lane's own wait:** `run-flow-lane.ts:104` uses the same default, but it waits on an already finalized recording: 885 to 2,056 ms observed in the passing Flow runs. It is unaffected in practice.
- **The completeness check has no clock bound of its own.** `run-expectations/recording-completeness.ts` makes one `get-recording` per recording with the caller's HTTP bounds, and only after the wait. It was not reached in the five runs.
- **Land D1 with it:** publish `details` for `recording.persistence` at `run-scenario.ts:377`.
  - Check first that every `recording.persistence` detail is counts and ids only: `finalized-recording.ts:121-131`, `recording-completeness.ts:53`, and `recording-discards.ts:124`, whose details were not read in full.
  - D2 is optional: say "Core finalized the recording only at the bound" when there was a single finished read.
- **Tests:** `flow-lane/tests/finalized-recording.test.ts`, the injected-clock test named in `i-demo-recording-finalize`, which was not opened here.
  - A recording that finalizes at 60 s returns.
  - One that never finalizes fails at 90 s with its details.
  - A row asserts the `error` event carries those details.
  - Mutation proof as the rules require.
- **A better shape, not the smallest:** a progress bound that fails after N s with no new entry and no `endedAt`, under an absolute cap. Rows W16-W29 were not measured here and may hold longer recordings.

### 5. W13: `gateway.connection` on the Flow lane, bench B

- **The bundle:** `run-mu04wrsy-f55b3ed0`, `modal-flows` `consent-then-click`.
  - Started 18:15:27.684Z; its only event, the `error`, came at 18:16:14.937Z, **47,253 ms** in.
  - `steps` and `actions` empty; `flowCreated=false`; `harnessActivations=0`.
  - Lowest free memory in the run: 8.78 GB (`l-stage3b`).
- **Where it was raised.** "Timed out waiting for extension connection state" is thrown only by `pollStatus` (`run-scenario.ts:603`, bound `15_000`, unnamed; the same at HEAD). Its callers:
  - pairing, first poll (`:514`) and second poll (`:517`);
  - tab activation (`:566`);
  - recording start (`:277`), which rethrows as `recording.persistence` and so is not this one.
- **It was the first pairing poll (`:514`).** Core's route log for this run holds, in order:
  - `GET /` 200 in 5,498 ms;
  - `GET /api/client-gateway/snapshot` 401 in 6,288 ms;
  - `POST /api/auth/login` 200 in 3,750 ms;
  - `POST …/create-project` 200 in 2,465 ms;
  - `POST /api/client-gateway/automation-studio-context` 200 in 958 ms, the runner's project select (`http-control.ts:102`);
  - `[exit]`, with **no `approve-pairing`**.

  Two runs that passed call `approve-pairing` right after `automation-studio-context`: W13's Flow run in A (`run-mu04twlv-0a2775ac`) and every other bundle read. The runner calls `approvePairing` (`:515`) only after the first poll returns a reference code, and activates the tab only after the second poll. So within 15 s of `fluxiq.connect`, the extension never reported `pairing` with a reference code, nor `connected` with a session.
- **What must happen inside those 15 s** (code at the pins):
  1. The extension's `GatewaySession.connect()` runs `beforeConnect`, builds the client and awaits `client.connect()` (`gateway-session.ts`, about lines 115-150).
  2. Core's WebSocket client `connect()` awaits the socket opening, with no timeout of its own, then sends `client.hello` (`client-gateway-websocket/src/transport.ts:39-54`).
  3. Core's `handleHello` awaits `this.facade.ready()` (`fluxiq/src/client-gateway/service/lifecycle.ts:72`), then sends `server.pairing_required` with the reference code (`:77`).
  4. The extension stores the code on that message (`gateway-session.ts`, about line 268).
  5. If the socket fails, the extension retries after 1, 2, 4 and 8 s (`shared/constants.ts:5-6`, `gateway-session.ts:301-307`). At most about four attempts fit in 15 s.
- **Log lines around it:** none that locate the stall.
  - Core's log has no gateway, `hello` or pairing line of its own. The words "client gateway" and "pairing" in it belong to route-compile lines. Besides compile lines and routes, the gateway appears only once, as "Client gateway WebSocket bound to shared runtime", at Core start (line 15), in both the failing and passing runs.
  - The bundle has no extension log.
  - The failure screenshot is of the scenario page (`run-scenario.ts:378`), not the extension, so it was not opened.
  - `pollStatus` throws without the status it last read.

  **Which of steps 1 to 4 stalled cannot be observed.**
- **Load context:**
  - Bench A's W14 recording run started at 18:15:38.9Z and brought up its own Core during B's pairing window. Taken as the last 15 s before the error, that window is about 18:15:59.9Z to 18:16:14.9Z.
  - Under two benches, the whole phase from run start to first event, which includes pairing, stretched from p50 24.2 s and max 29.2 s alone to p50 33.8-35.9 s and max 48.5-51.0 s. W13's 47.3 s sits at the top of that range.
  - This failure occurred once in 73 bundles across A and B, and 0 times in 29 in `l-stage2d`.
- **Classification: not provable either way.** It has the timing-only shape the rules say to rerun alone. It leans load, because it failed before the scenario was touched (steps 0) and nothing in the path is W13-specific.
- **Smallest fix: diagnostics first; no bound change without a measurement.**
  1. When `pollStatus` times out, publish the last status it read, as enums and booleans only: `connectionState`, whether a reference code was present (never the code), whether a `sessionId` was present, `queueSize`, and ms since `lastMessageAt`.
     - It can go into `failureDetails`, widening D1 to `gateway.connection`, or into a snapshot like `snapshots/recording-start.json` (`run-scenario.ts:278-280`).
     - Name the bound, for example `EXTENSION_STATUS_WAIT_MS`.
  2. If a provisional widening is wanted before Stage 4, widen the two pairing polls only, from 15,000 to 30,000 ms. **The justification is indirect:** start-up p90 grew about 1.7× under load (26.4 s to 43-44 s). Pairing itself was never measured.

### 6. W16: `inconclusive` on the recording lane, bench A

- **Where the verdict came from.**
  - `run-bench.ts:162` catches any throw out of the runner. `evaluateFailedAttempt` (`evaluate-run.ts:111-119`) then records `inconclusive`, with the category from `classifyRunnerFailure`, which is `unknown` for a plain error.
  - The bench record (`runs.json`, `runs[39]`) has `problems.0 = runner: Command failed: git -c safe.directory=F:/fxlab/fxlab-7263534-load rev-parse HEAD`. Its `failureCause` is 80 characters, the length of that message without the `runner: ` prefix.
- **That command is the run manifest's provenance read.** `revision()` (`run-manifest/create-run-manifest.ts:120-125`) runs `git rev-parse HEAD` and then `git status --porcelain`. It is called from `createRunManifest` at `run-scenario.ts:466`, after the run's `finally` block. A throw there leaves the output in `.staging-run-*` with no `run.json`, `summary.json` or `bundle.complete.json`.
- **The run itself had finished.** `.staging-run-mu055907-4900154d`, scenario `file-transfer`:
  - events from 18:22:30.507Z to 18:22:40.522Z;
  - steps `click-download-report`, `wait-report-download` and `wait-download-recorded`;
  - settle event: `recordedActions` 1/1, `entryCount` 6, `finalizationWaitMs` 5,035, 0 discards;
  - `final` at 18:22:39.914Z;
  - the second discard read at 18:22:40.522Z (`discardsAfterFirstRead=0`, `snapshotFetches=1`);
  - Core's route log ends with `get-recording`, a snapshot and `[exit]`;
  - no `error` event, and redaction attestation `not-applicable` with 0 findings.
- **The stop procedure.**
  - `l-stage3a-stop-output.txt` reads `stop requested at=…11:21:16.33` and `in-flight wait ended at=…11:22:06.95 evaluated=39`.
  - Its tree listing names `pid=19632 parent=17360 name=conhost.exe` and `labRoot=19632 conhost.exe`.
  - `l-stage3a-taskkill.log`, last modified 11:22:07.72 local (18:22:07.72Z), reads SUCCESS for PID 19632, child of 17360.
  - The previous run (W15 `popup-blocked`) finished at 18:22:02.494Z. So W16 started about 5 s before that kill, and its `git` call came about 33 s after it.
- **Classification: an artifact of the stop**, not load, a bound or a defect. The mechanism is **an inference, not reproduced**: a console program (`git`) was started by a runner whose console host had been killed. The next attempt (`.staging-run-mu0562ch-3762ab0e`) ran until the second kill at 11:23:09.39 local.
- **Fix:** none for Week 1; discount the run. Optional hardening: read git provenance once at run start, so a late environment failure cannot discard a finished run.

### 7. Should Stage 4's benches run together?

**Recommendation: one after the other, unless the 90 s bound and D1 land first.**
- **Latency under two benches** (sections 2 and 5):
  - finalize time: p50 1.7-2.1× and p90 1.8-2.1×;
  - time per stored entry: p50 1.6-2.2×;
  - start-up: p50 1.4-1.5×.
- **Crossings:** 5 of 62 finalize waits crossed 30 s, all W10, and 7 passing waits were above 20 s. Alone: none above 20 s. A 3-of-3 criterion counts every such failure.
- **Throughput.** Alone: 29 runs in 1,216 s, 41.9 s a run, about 1.4 runs a minute. Together: A ran 39 runs in 2,537 s and B 34 in 2,265 s (65.1 and 66.6 s a run), about 1.7 runs a minute combined. That is about 20% more, with different row mixes and the demo running for part of the time.
- **Criterion 5** compares A with B through the Metrics tolerances. Run together, each bench's latency depends on what the other is doing at that moment, for example W10 against W09 or against W10.

## Not verified

- **No rerun** of any failure. Every figure is a single observation on faulty RAM.
- **The five W10 failures:** entry counts, poll counts, `waitedMs` and `endedAt` are not in the bundles (D1). Whether Core ever finalized those recordings is unknown: each run's Core was stopped at run end. `recordedActions` was never read.
- **The late-finalize reading of B's recording run** is an inference from the message branch.
- **W13:**
  - the extension's connection state, whether the socket opened, whether `hello` reached Core, and how long `facade.ready()` took;
  - pairing latency itself, in any run: the start-to-first-event figure also includes Core start, login, browser launch, tab activation and the probe;
  - the failure screenshot was not opened.
- **W16:** the `git` exit code and stderr, and the console-host mechanism.
- **Whether 90 s is enough for rows W16-W29:** their entry counts were not measured here. `l-probe-late-rows`'s bundles under `F:\fxlab-runs\probe` were not read, by rule.
- **`l-stage2d`'s concurrency** during 17:19-17:40Z beyond its bundle times.
- **Memory samples:** the CSVs were not read; the memory figures are quoted from `l-stage3a` and `l-stage3b`.
- **The test file** `flow-lane/tests/finalized-recording.test.ts` was not opened.
- **Code versions:**
  - HEAD was checked only at `finalized-recording.ts:71`, `run-scenario.ts:377`, `:466` and `:603`.
  - `git diff --stat d639415` for `finalized-recording.ts`, `run-flow-lane.ts` and `recording-completeness.ts` printed nothing.
- **No declared-value scan of this report was run.** No declared value was loaded or printed.
- **What a Lab run must show after the fixes:**
  - **W10:** on both lanes and `broken-link`, with a second bench running, it passes; the settle event records `finalizationWaitMs` (expect about 25-60 s under load) and equal `recordedActions`.
  - **A forced timeout** publishes the wait's details on its `error` event.
  - **W13:** the Flow row, rerun alone with more than 6 GB free, passes. With diagnostics, any repeat publishes the extension's last status.

## Open questions or contradictions found

1. **Throughput.** The Stage 4 section says "concurrent Lab instances do not raise throughput on this machine". These bundles show about 20% more runs a minute with two benches, from a single pair with different row mixes.
2. **Which benches overlapped.** `l-stage3b`'s open question 4 says bench B shared the machine with `l-stage2d`'s bench. By bundle time, `l-stage2d`'s last run finished at 17:39:55.85Z, before B's first run started at 17:40:51.96Z; its bench overlapped only A's first run. Its processes may still have been exiting when B launched; not checked.
3. **W10's action counts differ by lane.** In `l-stage2d`, W10's recording lane recorded 1/1 actions and 24 entries. Its Flow lane and `broken-link` recorded 2/2 and 26 from the same unarmed script, and B's `broken-link` also recorded 2/2 and 26. Not investigated.
4. **A comment contradicts the code.** `finalized-recording.ts:29-30` says the counts reach the run bundle; `run-scenario.ts:377` drops them (D1).
5. **Other rows may cross the bound.** Any recording of roughly 20 or more entries is at risk under concurrent load at the 30 s bound. W15 (25-26 entries) finalized at 18,606 ms in A. Rows W16-W29 are unmeasured here.
