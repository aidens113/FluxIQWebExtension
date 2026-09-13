# l-stage3a — Bench A, stopped early: a partial, single-observation pass

Worker report for `l-stage3` in [finish-week1.md](../briefs/finish-week1.md), as changed by
"Amendment to `l-stage3` — three concurrent workers at the `l-stage2d` pins", row `l-stage3a`,
and by two supervisor messages during the run: a ruling on how to count the exit criteria, and
an order to stop Bench A and report what it has. Written 2026-09-13, local time (UTC-7).

**This is not the criterion-5 bench.** It was stopped on the supervisor's order after 40 of the
201 runs a `--repeat 3` week1 bench plans (67 results × 3). Every run it has is from the first
repeat. It ran alongside `l-stage3b`'s Bench B on a machine with faulty RAM, and nothing was
rerun. **Every figure below is a single observation under shared load.**

- **Pins.** This repository `d639415` (`d6394155efb7eecb1815d1b496a283b26b506bae`); Core
  `3cb8976` (`3cb8976fb665c89f4909a9f49eb35be611cea0fa`), used read-only in `F:\fxlab\!FluxIQ`.
  `fluxiq` 0.4.0. All 39 run bundles record facility `d639415/false` and Core `3cb8976/false`.
- **Evidence rules.** No declared secret, uploaded file name or content, token or recorded page
  data is printed, hashed or partially quoted here. Every figure is a path, a key, a kind, an id
  or a count.

## Outcome

**Partial.** Bench A ran from 10:39:24 to 11:23:09 and was stopped as ordered.

- **Runs completed: 40.** 30 passed, 9 failed, 1 inconclusive. By lane: recording 14 of 16,
  Flow 16 of 24.
- **Rows reached:** W01 to W15 on both lanes and every one of their variants, plus W16 on the
  recording lane. W16's Flow lane and W17 to W29 never ran, and neither did repeats 2 and 3.
- **The failures fall into four groups:**
  - 4 runs: Core returned no Flow proposal for a recording that held 0 actions (W04 and W08 on
    the Flow lane, unarmed and variant);
  - 3 runs: `recording.persistence`, "Core was still writing the run's recording after
    30000 ms", all three W10 navigation runs, consecutively;
  - 2 runs: the two rows ruled out of Week 1, W05 `short-catalog` and W13 `banner-absent`, each
    `target_not_found`;
  - 1 run: W16 on the recording lane was inconclusive, "runner threw before finalizing a
    bundle: unknown".
- **Leak checks: 0.** No declared value was found in any kept file, and no redaction attestation
  had findings.
- **No action carried `evidencePackets`:** the key appears 0 times in any run's
  `evaluation.json`, `run.json` or `flow-lane.json`.
- **Lowest free memory: 5.42 GB.** The 3 GB wait never triggered.
- **Cleanup:** no process of this worker remains. The worktree is still `d639415` with
  porcelain 0, and the run directories are kept.

## What changed and why

No tracked file in either repository was edited. Nothing was built, checked out or cleaned in
`F:\fxlab\!FluxIQ`, `F:\!FluxIQWebExtension` or `F:\!FluxIQ`; the only write in
`F:\!FluxIQWebExtension` is this report. Created or changed:

- **Worktree moved in place:** `F:\fxlab\fxlab-7263534-load`, `69f40c1` to `d639415`, with
  `git checkout --detach`. The directory name still reads `7263534`.
- **Rebuilt there:** `domain/dist`, `packages/test-contracts/dist` and `apps/scenario-lab/dist`.
  The Lab launcher then built its own instance bundles under `.lab-instances/l-stage3a/`, and the
  test-runner, as it does on every Lab command.
- **Run directory, kept:** `F:\fxlab-runs\stage3\a\`.
  - It holds 39 run bundles and the bench directory `bench\bench-mu03mupg-4bc91fe5\`
    (`runs.json` and 40 evaluation files; no `report.md` or `report.json`).
  - Also two staging directories and one `.work` entry. The forced stop left these; see "After
    the stop".
- **Scratch files,** all prefixed `l-stage3a-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`:
  - `l-stage3a-setup.ps1`, from `l-stage2d-setup.ps1` with Core's checkout and build removed;
  - `l-stage3a-lab-seq.ps1`, from `l-stage2d-lab-seq.ps1` with the workspace keeper removed and a
    memory gate added: before the Lab command, while free memory is under 3 GB, it waits 120 s
    with `node -e "setTimeout(()=>{},120000)"` and writes a `wait` line;
  - `l-stage3a-watch.mjs`, `l-stage3a-monitor.mjs` and `l-stage3a-wait.ps1`, which report
    progress and leaks as counts only;
  - `l-stage3a-stop.ps1`, the stop;
  - `l-stage3a-bench.mjs` and `l-stage3a-extract.mjs`, the readers, whose output is in
    `l-stage3a-bench-output.txt` and `l-stage3a-extract.txt`;
  - the logs and status files `l-stage3a-*.txt`, `l-stage3a-*.log` and
    `l-stage3a-lab-mem.csv`;
  - `l-stage2c-mem.ps1` and `l-stage2-pin-proof.mjs`, reused unchanged.

## Commands run and observed results

### Pre-checks

- **Free memory** before anything: `12456824` KB.
- **The worktree before the move:** `HEAD 69f40c120732ed2ed9b85fd21412cdb7769c886a`, detached,
  `git status --short` printed nothing, `node_modules` present.
- **No install needed.** `git diff --stat 69f40c1 d639415 -- pnpm-lock.yaml package.json pnpm-workspace.yaml '**/package.json'`
  printed nothing.
- **No FLUXIQ variable was set** in the shell: `Get-ChildItem Env:` matched no `^FLUXIQ`,
  `HEADLESS` or `CI` name.
- **The Lab launcher does not build Core.** `git show d639415:scripts/lab/run-lab.mjs` builds only
  this worktree's scenario-lab, the extension's `test:e2e:build`, the domain host and
  `test-runner...`. For Core it only waits until Core's build output has gone quiet.
- **Another Lab was already running before setup.** It was `l-stage2d`'s week1 bench
  (`--repeat 1`, `F:\fxlab\fxlab-7263534\packages\test-runner\dist\cli.js`). I did not touch it,
  and it was gone about two minutes after Bench A started.

### Setup

From `l-stage3a-setup-status.txt`:

```
started=2026-09-13T10:38:02.5227423-07:00 freeGB=12.27
before core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa core porcelain=0 wt HEAD=69f40c120732ed2ed9b85fd21412cdb7769c886a wt porcelain=0
wt-checkout exit=0
F:\fxlab\fxlab-7263534-load HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0
node_modules present=True
build wt @fluxiq-web-extension/domain exit=0 seconds=3.6 freeGBAfter=11.77
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=2.6 freeGBAfter=11.36
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=3.8 freeGBAfter=11.28
wt dist domain\dist newest 2026-09-13T10:38:06 files=274
wt dist packages\test-contracts\dist newest 2026-09-13T10:38:09 files=36
wt dist apps\scenario-lab\dist newest 2026-09-13T10:38:13 files=166
wt porcelain=0
core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0
fluxiq version: 0.4.0
core dist contracts newest 2026-09-13T09:51:44 files=36
core dist fluxiq newest 2026-09-13T09:51:52 files=1976
core dist client-gateway-websocket newest 2026-09-13T09:51:54 files=20
finished=2026-09-13T10:38:13.4822227-07:00
```

Core's three `dist` directories show the same newest times and file counts that `l-stage2d`
recorded after its build, so nobody rebuilt Core between the two.

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs F:\fxlab\fxlab-7263534-load`
printed `exit=0`:

```
domain :: fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\index.js pinned=true
domain :: fluxiq/automation-studio -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js pinned=true
domain :: @fluxiq/client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\dist\index.js pinned=true
apps/extension :: fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\index.js pinned=true
apps/extension :: fluxiq/automation-studio -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js pinned=true
apps/extension :: @fluxiq/client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\dist\index.js pinned=true
packages/test-runner :: fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\index.js pinned=true
packages/test-runner :: fluxiq/automation-studio -> F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js pinned=true
packages/test-contracts :: @fluxiq/contracts -> F:\fxlab\!FluxIQ\packages\contracts\dist\index.js pinned=true
import(fluxiq/automation-studio) from packages/test-runner: F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js exports=385
runner Core root (cli.ts:21 default): F:\fxlab\!FluxIQ -> real F:\fxlab\!FluxIQ
unpinned=0
```

### How the bench ran

- **Command,** through `l-stage3a-lab-seq.ps1`:
  `pnpm -C F:\fxlab\fxlab-7263534-load lab bench --corpus week1 --repeat 3 --target isolated *> l-stage3a-l-stage3a-week1-01.log`,
  then `exit=$LASTEXITCODE` to `l-stage3a-l-stage3a-status.txt`, never through a pipe.
- **Environment:**
  - `FLUXIQ_TEST_ENV_FILES=none`;
  - `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` both `l-stage3a`;
  - `FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage3\a`;
  - `FLUXIQ_CORE_ROOT` removed;
  - the auth-gate secret variable, read by regex from the worktree's `auth-gate/constants.ts`,
    set for the bench and removed after it, as in Stage 2 and `l-stage2d`.
- **Headed:** Chromium launches headed by default, and no headless variable was set. The Chrome
  processes in the tree ran Playwright's `chromium-1161` with a `--user-data-dir` under
  `F:\fxlab-runs\stage3\a\.work\`.
- **Launch:** the driver process was `17360`. Its status line:
  `begin name=week1 index=1 start=2026-09-13T10:39:24.1603946-07:00 freeGBBefore=13.90 memoryWaits=0 otherLabsBefore=3`.
  - `otherLabsBefore` counts processes, not instances. Its `3` was one other instance,
    `l-stage2d`'s bench: a `cmd.exe` wrapper, `run-lab.mjs` and `cli.js`.
- **Concurrent Labs:** about two minutes in, the only other instance was `l-stage3b`'s Bench B,
  `F:\fxlab\fxlab-16ff729-b\packages\test-runner\dist\cli.js bench --corpus week1 --repeat 3 --target isolated`.
- **Core stayed quiet at launch.** The Lab log has one `core-build` line, which begins
  `{"lab":"core-build","state":"quiet","root":"F:\\fxlab\\!FluxIQ","files":2032,…`. No build-lock
  wait line appears.
- **Bench id:** `bench-mu03mupg-4bc91fe5`.

### The stop

The supervisor ordered a stop at about 11:21.

- **The run in flight finished first.** `l-stage3a-stop-output.txt`:
  `stop requested at=2026-09-13T11:21:16 evaluatedAtStart=38` and
  `in-flight wait ended at=2026-09-13T11:22:06 evaluated=39 finishedInFlight=True`.
- **First kill attempt, a defect of mine.** The stop script took the driver's first child as the
  tree root, and that was `conhost.exe` (19632). `taskkill` ended only that process, and the
  bench kept running.
- **Second kill, confirmed by command line.**
  - The driver's tree was listed again: 23 processes.
  - The root was confirmed as `pid=18332`,
    `node.exe … pnpm.cjs -C F:\fxlab\fxlab-7263534-load lab bench …`, with this worktree's runner
    `cli.js` in the tree and no process naming another worktree (`foreign=0`).
  - The tree held the `cmd.exe` and pnpm chain, `run-lab.mjs` (18396), the runner (18472), the
    scenario server, `next dev` on port 55010 from `F:\fxlab\!FluxIQ\apps\web`, and ten Chrome
    processes.
  - `taskkill /T /F /PID 18332` printed `exit=0`, with 23 `SUCCESS` lines.
- **Driver status after the kill:**
  `name=week1 index=1 start=2026-09-13T10:39:24.1603946-07:00 end=2026-09-13T11:23:09.4139035-07:00 seconds=2,625.3 exit=1 otherLabsBefore=3 freeGBBefore=13.90 memoryWaits=0 args=bench --corpus week1 --repeat 3 --target isolated secretSupplied=True`,
  then `finished=2026-09-13T11:23:09.4236458-07:00`.
- **Afterwards:**
  - the progress monitor was stopped with TaskStop, and the memory sampler through its stop file
    (`sampler alive=False`);
  - the final check printed `processes of this worker: 0`,
    `worktree HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0` and
    `core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0`;
  - three runner or Lab processes were still on the machine. None were this worker's, and I did
    not inspect them.

### After the stop: what the forced stop left

- **`F:\fxlab-runs\stage3\a\.staging-run-mu055907-4900154d`**, 6 files. This is the partial
  output of the inconclusive W16 recording run. It holds 11 events: `runtime.settle` ×3,
  `step.start` ×3, `step.complete` ×3, `gateway.action` ×1 and `final` ×1, with no `error` event.
  Its redaction attestation reads `status=not-applicable findings=0 literals=0`.
- **`.staging-run-mu0562ch-3762ab0e`**, 3 files with 7 events, and
  **`.work\run-mu0562ch-3762ab0e`**, 3,357 files in `browser-profile`, `core-workspace`,
  `fluxiq-root` and `logs`. This is the run the kill interrupted. It is not in `runs.json`; by
  corpus order it would be W16 on the Flow lane, but that is not verified. The runner normally
  deletes a run's `.work` entry. This one survived only because the kill was forced.

### Results, run by run

Quoted from `l-stage3a-extract.txt`, which reads `runs.json`, each bundle's `evaluation.json`,
`run.json`, `snapshots/flow-lane.json` and `events.ndjson`. Column notes:
- "Failure" is the run's failure category, then the reported `category/code`.
- "Start idx" is `startCandidateIndex`; "Harness" is `harnessActivations`.
- Every run with a Flow shows the same value in `flow-lane.json` as in `evaluation.json`.
- `stoppedWithoutFailedAttempt` is `null` on every Flow-lane run.

| # | Row, workflow, variant | Lane | runId | Verdict | Failure | Start idx | Harness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W01 primary | recording | run-mu03mupk-084675fc | passed | — | — | 0 |
| 2 | W01 primary | flow | run-mu03o3zh-40e746c0 | passed | — | 0 | 0 |
| 3 | W02 primary | recording | run-mu03qr4y-0deb575a | passed | — | — | 0 |
| 4 | W02 primary | flow | run-mu03s15n-1d40b8ff | passed | — | 0 | 0 |
| 5 | W03 combobox | recording | run-mu03tz7n-90617378 | passed | — | — | 0 |
| 6 | W03 combobox | flow | run-mu03uwhk-54acb954 | passed | — | 0 | 0 |
| 7 | W04 primary | recording | run-mu03wxqr-bb0bec03 | passed | — | — | 0 |
| 8 | W04 primary | flow | run-mu03xl5g-06af570e | failed | `recording.contract`: "Core produced no recording Flow proposal for the run's recording"; nothing reported | null (no Flow) | 0 |
| 9 | W04 primary `text-variant` | flow | run-mu03yl3r-fe17c6cd | failed | the same | null (no Flow) | 0 |
| 10 | W05 paginated-extraction | recording | run-mu0408z6-928b231a | passed | — | — | 0 |
| 11 | W05 paginated-extraction | flow | run-mu040uds-880ab11d | passed | — | 0 | 0 |
| 12 | W05 paginated-extraction `short-catalog` (ruled out of Week 1) | flow | run-mu042ex9-0fe6f9cd | failed | `runtime.behavior`: "The Flow reported an unexpected target_not_found failure"; `target_not_found/web.target.not_found`; click `failed` | 0 | 2 |
| 13 | W06 search | recording | run-mu043vgr-35cb4bf2 | passed | — | — | 0 |
| 14 | W06 search | flow | run-mu044f6y-f5e87594 | passed | — | 0 | 0 |
| 15 | W06 search `no-results` | flow | run-mu0465kk-21874ed5 | passed | — | 0 | 0 |
| 16 | W07 in-stock-only | recording | run-mu047kq5-3a849488 | passed | — | — | 0 |
| 17 | W07 in-stock-only | flow | run-mu048ch4-1f9205fc | passed | — | 0 | 0 |
| 18 | W08 primary | recording | run-mu04akps-750234c8 | passed | — | — | 0 |
| 19 | W08 primary | flow | run-mu04bctx-3f45e430 | failed | `recording.contract`: no recording Flow proposal; nothing reported | null (no Flow) | 0 |
| 20 | W08 primary `column-reorder` | flow | run-mu04cfeu-2b9b7a46 | failed | the same | null (no Flow) | 0 |
| 21 | W09 sort-by-price | recording | run-mu04du1q-aa916e7c | passed | — | — | 0 |
| 22 | W09 sort-by-price | flow | run-mu04eywv-9b06b05f | passed | — | 0 | 0 |
| 23 | W10 primary | recording | run-mu04gu5b-fd288c74 | failed | `recording.persistence`: "Core was still writing the run's recording after 30000 ms, and a Flow built from an unfinished recording silently loses the actions Core has not appended yet" | — | 0 |
| 24 | W10 primary | flow | run-mu04iq4d-3f2253f8 | failed | the same; `flowCreated: false` | null (no Flow) | 0 |
| 25 | W10 primary `broken-link` | flow | run-mu04kecn-362d60d4 | failed | the same; expected `navigation_unexpected/web.navigation.unexpected`, nothing reported | null (no Flow) | 0 |
| 26 | W11 primary | recording | run-mu04m0op-e6aa8b55 | passed | — | — | 0 |
| 27 | W11 primary | flow | run-mu04n6qk-c64729ff | passed | — | 0 | 0 |
| 28 | W11 primary `end-early` | flow | run-mu04okfm-9c3fa15d | passed | — | 0 | 0 |
| 29 | W12 primary | recording | run-mu04q2rp-0c7d8f97 | passed | — | — | 0 |
| 30 | W12 primary | flow | run-mu04r3de-a5f76331 | passed | — | 0 | 0 |
| 31 | W13 consent-then-click | recording | run-mu04sja1-180fd696 | passed | — | — | 0 |
| 32 | W13 consent-then-click | flow | run-mu04twlv-0a2775ac | passed | — | 0 | 0 |
| 33 | W13 consent-then-click `banner-absent` (ruled out of Week 1) | flow | run-mu04vdt9-c49e7a02 | failed | `runtime.behavior`: unexpected `target_not_found`; `target_not_found/web.target.not_found`; click `failed` | 0 | 2 |
| 34 | W14 interstitial | recording | run-mu04x0hf-92fb1469 | passed | — | — | 0 |
| 35 | W14 interstitial | flow | run-mu04y70h-b3e909e0 | passed | — | 0 | 0 |
| 36 | W14 interstitial `armed` | flow | run-mu04zo0d-f9c7b364 | passed | reported `user_intervention_required/web.intervention.required`; expected category `user_intervention_required` | 0 | 2 |
| 37 | W15 primary | recording | run-mu051e9m-5d9eea04 | passed | — | — | 0 |
| 38 | W15 primary | flow | run-mu052kpo-7d6104a8 | passed | — | 0 | 0 |
| 39 | W15 primary `popup-blocked` | flow | run-mu053v85-170e9fb9 | passed | reported `output_not_observed/web.validation.output_not_observed`; expected category `output_not_observed` | 0 | 2 |
| 40 | W16 primary | recording | bench-mu03mupg-4bc91fe5-r0-39 | inconclusive | `unknown`: `runner-verdict: "runner threw before finalizing a bundle: unknown"`; no bundle | — | 0 |

**Headline counts, from `l-stage3a-bench-output.txt`:**
`=== totals {"runs":40,"passed":30,"byLane":{"recording":{"runs":16,"passed":14},"flow":{"runs":24,"passed":16}},"facility":{"d639415/false":39,"undefined":1},"core":{"3cb8976/false":39,"undefined":1}}`.
The `undefined` is the bundle-less W16 run. The bench wrote no `report.md`, so it produced no
rates table; none is computed here.

**Other figures, quoted:**
- `Flow-lane startCandidateIndex distribution: {"0":18,"null":6}; stoppedWithoutFailedAttempt set: []`.
  The 6 nulls are the six Flow-lane runs that never got a Flow: W04 ×2, W08 ×2 and W10 ×2.
- `harnessActivations by lane:value -> runs: {"recording:0":16,"flow:0":20,"flow:2":4}`. The 4
  runs with 2 are exactly the four Flow runs in which Core reported a structured failure: rows 12,
  33, 36 and 39. No provider was configured.
- `evidencePackets across evaluation.json, run.json and flow-lane.json of every run: keys=0 nonEmpty=0`.
  Flow-lane actions carry only `actionType`, `status`, `comparisonStatus` and
  `targetResolution`, over 62 actions.
- `recordedActions extension!=core: []; discardsAfterFirstRead non-zero: []`.

### Failure detail, by group

- **No recording Flow proposal** (rows 8, 9, 19, 20):
  - each error event carries `failureDetails` of shape `{issues:array(2),proposalCount:number}`,
    with `proposalCount = 0` and two string issues (not printed);
  - each run's first settle read shows `recordedActions(ext/core)=0/0`, `recordings entryCount [3]`,
    `firstReadDiscards=[]` and `discardsAfterFirstRead=0`.
  - Both the extension and Core recorded no action entries, and nothing was discarded. The two
    rows are extraction workflows; for comparison, W05's Flow run (row 11) recorded `3/3`.
  - In Stage 2's bench (`l-stage2.md`), W04 on the Flow lane passed.
  - Whether this is load or a change since then is not established.
- **`recording.persistence`** (rows 23-25; the amendment asks for discard kinds and counts):
  - each error event's detail keys are `failureCategory+capture` only;
  - there is no `recordingDiscards` field, and no settle read of the recordings ran before the
    failure (`firstReadDiscards: null`).
  - So these failures carry **0 discards of any kind, and 0 runtime confirmations**. Their cause
    is Core not finishing its recording writes within 30,000 ms, not a discard.
  - The three were consecutive: all of W10.
- **Ruled-out rows** (12, 33): each Flow was created and started at candidate 0, and its click
  failed `target_not_found/web.target.not_found`. The error's detail keys are
  `failureCategory+flowReportedFailure+capture`.
- **W16 recording, inconclusive** (row 40): no bundle was finalized. Its staging directory has
  events up to `final` and no `error` event. The evaluation's only failed invariant is
  `runner-verdict`.

### The exit criteria, as the supervisor ruled — none can be judged from this bench

- **Criterion 1, actions reliable** (unarmed W01-W19, 3 of 3, per lane). No row has more than one
  run, so no row is 3 of 3.
  - Recording lane: `workflows=16 at3of3=0 runs passed=14/16`. W10 failed (`recording.persistence`)
    and W16 was inconclusive; W17-W19 never ran.
  - Flow lane: `workflows=15 at3of3=0 runs passed=12/15`. W04 and W08 failed (no proposal) and
    W10 failed (`recording.persistence`); W16-W19 never ran.
  - Variants, outside criterion 1: passed are W06 `no-results`, W11 `end-early`, W14 `armed` and
    W15 `popup-blocked`. Failed are W04 `text-variant`, W08 `column-reorder`, W10 `broken-link`,
    W05 `short-catalog` and W13 `banner-absent`.
- **Criterion 2, evidence useful:**
  - 0 attestations with findings;
  - 0 declared-value hits in 725 kept files, which include the bench directory's 41, and 0 in
    the 3,357 files of the interrupted run's `.work` entry;
  - no `evidencePackets` anywhere;
  - the packet budget and truncation were not produced, because no bench report was written.
- **Criterion 3, deterministic fallback:** W20-W23 and W26 never ran.
- **Criterion 4, failures classified:**
  - Objective set (W14, W19, W27 negative variants): `hits=1/1 rate=1.000`, W14 `armed` only;
    W19 and W27 never ran.
  - Every negative variant reached: `hits=2/3 rate=0.667`. The one miss was
    `W10/broken-link#0 expected=navigation_unexpected reported=none verdict=failed`: the run
    failed `recording.persistence` before any Flow existed. W24 `unannounced` never ran.
- **Ruled out of Week 1, still run:** W05 `short-catalog` failed, W13 `banner-absent` failed,
  and W24 `unannounced` was not reached.
- **Criterion 5, bench repeatable: this is not the criterion-5 bench.** The figures below were
  measured under shared load, with Bench B running throughout. They are nearest-rank percentiles
  computed here from `evaluation.json` `durationMs`, not a bench report:
  - `run duration all: n=40 p50=63784 p95=91908`; `recording: n=16 p50=46356 p95=85092`;
    `flow: n=24 p50=69576 p95=103106`;
  - `action latency web.dom.click: n=25 p50=1334 p95=1358`;
    `web.dom.type: n=10 p50=1035 p95=1531`;
    `web.browser.navigate: n=3 p50=1691 p95=1813`;
    `web.dom.wait_for_selector: n=7 p50=1019 p95=1044`;
    `web.dom.scroll: n=9 p50=1035 p95=1053`;
    `web.dom.keypress: n=6 p50=1023 p95=1057`;
    `web.dom.check: n=3 p50=1023 p95=1031`;
    `web.dom.select: n=2 p50=1014 p95=1022`;
    `web.browser.tab: n=3 p50=5 p95=16`.
  - **Pace:** 40 runs in 2,625 s, about 66 s a run, so the full 201 would take about 3.7 hours at
    this load.
- **Criterion 6, blockers ranked:** not in this worker's scope.

### Memory

- **Sampler** (`l-stage3a-lab-mem.csv`): 184 samples every 15 s, from 10:38:00 to 11:23:58.
- **Lowest free memory: 5.42 GB,** first at 10:43:16. The sample at 10:48:47 read the same. The
  highest Chrome plus Node working set, summed over every process on the machine including
  Bench B's, was 11.32 GB at 10:48:47.
- `below3GB=0 below6GB=6`. The driver wrote no `wait` line (`memoryWaits=0`).
- **Spot readings before Lab work:** `12456824` KB, `12611320` KB before setup, and `14679120` KB
  before launch. The driver read 13.90 GB at launch; the lowest spot reading, about two minutes
  in, was `6737396` KB.

### Leak checks

- **During the run,** `l-stage3a-monitor.mjs` counted every declared value every 180 s:
  auth-gate's password, `sensitive-input`'s two replaced literals, and W17's upload name, content
  and base64 content, as UTF-8 and UTF-16. It also counted every attestation with findings. It
  never reported a non-zero count.
- **Final passes:**
  - kept files outside `.work`:
    `bundles=39 {"evaluated":39,"passed":30,"failed":9,"other":0} keptFiles=725 valueHitFiles=0 attestationFindingBundles=0`;
  - the leftover `.work` entry: `keptFiles=3357 valueHitFiles=0 attestationFindingBundles=0`;
  - the bench reader: `attestations with findings: []`, `bundles holding a declared value: []`,
    `bench directory files=41 holding a declared value: []`;
  - this report and every `l-stage3a-*` scratch file (`l-stage3a-selfcheck.mjs`):
    `values=6 files=37 totalHits=0 hitFiles=[]`.

## Not verified

- **Everything after run 40:** W16 on the Flow lane, W17-W29, and repeats 2 and 3. No criterion
  is judged, and this bench cannot be compared with Bench B.
- **Nothing was rerun.** The rule says to rerun a uniform or timing-only failure once, alone, with
  more than 6 GB free, but the supervisor ordered that nothing else be started. These are
  therefore single observations under two-bench load:
  - the four no-proposal failures;
  - the three consecutive `recording.persistence` timeouts;
  - W16's inconclusive run.
- **Why Core returned no proposal:** the two issue strings, Core's logs for those runs and the
  screenshots were not opened. So it is not established whether an extraction recording with 0
  action entries is now refused by design, or whether load caused it.
- **Why every Flow that reported a failure shows `harnessActivations: 2`** with no provider
  configured.
- **Whether Core's build output changed during the run.** The launcher checks this only after the
  runner exits, and the forced kill ended the launcher first. The launch-time guard read `quiet`.
- **Which scenario the interrupted run was.** Its events carry no `scenarioId` on the first event.
- **Headed windows were not watched.** "Headed" rests on the default and the absence of a
  headless variable.
- **The three runner or Lab processes** still on the machine after the stop were not identified.

## Open questions or contradictions found

1. **`l-stage2d`'s worktree was running a week1 bench (`--repeat 1`) when this worker started,**
   although the second amendment to `l-stage2d` says to skip it. It added load to Bench A's first
   minutes.
2. **W04 and W08 on the Flow lane got no proposal from a recording with 0 actions.** Stage 2's
   bench passed W04 on the Flow lane. This needs a quiet rerun before it is ranked.
3. **`harnessActivations: 2` accompanies every structured Flow failure,** including the two
   variants that passed (W14 `armed`, W15 `popup-blocked`). Criterion 5's harness-activation rate
   is meant to be 0 with no provider, so the counter's meaning should be checked before the
   final bench pair.
4. **The forced stop left `.work\run-mu0562ch-3762ab0e`** (a browser profile and a Core
   workspace, 3,357 files, 0 declared-value hits) and two `.staging-run-*` directories. They were
   kept as ordered; the supervisor may delete them.
5. **A defect in my own stop script:** its first kill hit `conhost.exe` rather than the pnpm root.
   The second, command-line-confirmed kill stopped the tree. It is recorded in case the script is
   reused.
