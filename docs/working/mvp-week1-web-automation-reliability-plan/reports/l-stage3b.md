# l-stage3b — bench B, stopped after 34 of 201 runs (Lab owner)

Worker report for `l-stage3` in [finish-week1.md](../briefs/finish-week1.md), as changed by
"Amendment to `l-stage3` — three concurrent workers at the `l-stage2d` pins", row `l-stage3b`,
and by the supervisor's two later messages: the ruling on how criteria are counted, and the
order to stop bench B and report what it has. Written 2026-09-13, local time (UTC-7).

> **This is not the criterion-5 bench.** The supervisor stopped it at 11:18, after 34 of the
> 201 planned runs: the first repeat of rows W01 to W13, and W14's recording-lane run. No
> `report.json` or `report.md` was written, so it produces no rates, no latency and no
> evidence-size distribution, and it cannot be compared with bench A. Every figure below is a
> **single observation** on a machine with faulty RAM, measured while two other Lab instances
> ran (`l-stage3a`'s bench and `l-stage2d`'s bench). **Nothing was rerun:** the stop order
> said to start nothing else.

- **Pins.** This repository `d639415` (`d6394155efb7eecb1815d1b496a283b26b506bae`); Core
  `3cb8976` (`3cb8976fb665c89f4909a9f49eb35be611cea0fa`), built read-only in `F:\fxlab\!FluxIQ`.
  `fluxiq` 0.4.0. All 34 `run.json` files read `d639415/false 3cb8976/false`.
- **Evidence rules.** No declared secret, uploaded file name or content, token or recorded page
  data is printed, hashed or partially quoted here. Every figure is a path, a key, a kind, an id,
  a category, a code or a count. Two proposal-issue strings are given by length only.

## Outcome

**Partial.** Bench B (`bench-mu03oa5q-d6d692ad`) ran from 10:40:51 until the supervisor's stop
order, and was stopped cleanly at 11:18:40, right after the run in flight finished. Of 201
planned runs, 34 completed: **25 passed, 9 failed.**

- **Recording lane:** 14 runs, 13 passed. W10 failed `recording.persistence`.
- **Flow lane:** 20 runs, 12 passed. Eight failed:
  - four "no recording Flow proposal" (W04, W04 `text-variant`, W08, W08 `column-reorder`);
  - two `target_not_found` on rows ruled out of Week 1 (W05 `short-catalog`, W13 `banner-absent`);
  - W10 `recording.persistence`;
  - W13 `gateway.connection`.
- **Every Flow run with a `flow-lane.json` (14 of 14) started at candidate 0**, and
  `stoppedWithoutFailedAttempt` was `null` in all 14.
- **No action carried `evidencePackets`:** 0 of 49 actions, and 0 of 585 bundle files contain
  that key.
- **No leak:** redaction attestation `not-applicable` in 34 of 34, 0 findings. Declared-value
  hits: 0 (figures under "Leak checks").
- **No `recording.persistence` failure involved a discard:** both W10 failures stopped before
  any discard read. No run kept an action discard.
- **Lowest free memory: 4.70 GB** (10:48:30). No sample was under 3 GB, so the driver never waited.
- **Afterwards:** no process of this bench remains. The worktree is `d639415` with porcelain 0,
  and Core is `3cb8976` with porcelain 0. The run directories are kept.

## What changed and why

No tracked file in either repository was edited, and nothing was built or run in
`F:\!FluxIQWebExtension` or `F:\!FluxIQ`. Created or changed:

- **Worktree moved in place:** `F:\fxlab\fxlab-16ff729-b`, `16ff729` to `d639415`, with
  `git checkout --detach`. The directory name still reads `16ff729`.
- **Rebuilt in that worktree:** `domain/dist`, `packages/test-contracts/dist` and
  `apps/scenario-lab/dist`, as `reports/l-stage2d.md` "Setup" did.
  - No install was needed: `node_modules` was present.
  - `git diff --stat 16ff729 d639415 -- pnpm-lock.yaml package.json pnpm-workspace.yaml '**/package.json'`
    printed only `apps/extension/package.json | 2 +-`, the `test:content` script line. No
    dependency changed.
- **Run directory** `F:\fxlab-runs\stage3\b\`, kept. It holds 34 `run-*` bundles and
  `bench\bench-mu03oa5q-d6d692ad\` (`runs.json`, `evaluations\`). The killed next run left
  `.staging-run-mu050v0l-d79766ac\events.ndjson` and a directory `.work\run-mu050v0l-d79766ac`.
- **Scratch files,** all prefixed `l-stage3b-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`:
  - scripts: `l-stage3b-setup.ps1`, `l-stage3b-lab-seq.ps1` (the driver), `l-stage3b-plan-bench.txt`,
    `l-stage3b-watch.mjs` (the leak watcher), `l-stage3b-wait.ps1`, `l-stage3b-bench-analyse.mjs`,
    `l-stage3b-probe.mjs` and `l-stage3b-final-scan.mjs`;
  - outputs: `l-stage3b-setup-status.txt`, `l-stage3b-pin-proof.txt`,
    `l-stage3b-l-stage3b-status.txt`, `l-stage3b-l-stage3b-week1-01.log`,
    `l-stage3b-lab-mem.csv`, `l-stage3b-watch.txt`, `l-stage3b-kill.log`,
    `l-stage3b-analyse-bench-b.txt` and `l-stage3b-probe-bench-b.txt`.
  - `l-stage2c-mem.ps1` and `l-stage2-pin-proof.mjs` were reused unchanged.

## Commands run and observed results

### Pre-checks

- **Worktree clean before the move:** `porcelain=0` at `16ff729`. Core `porcelain=0` at `3cb8976`.
- **Other Labs at launch:** 4 `run-lab.mjs` processes outside this worktree, about two
  instances at two processes each. `l-stage2d` was running `lab bench --corpus week1 --repeat 1`
  in `F:\fxlab\fxlab-7263534`; I did not touch it.
- No `FLUXIQ_*` variable was set in the launching shell.

### Setup

From `l-stage3b-setup-status.txt`:

```
started=2026-09-13T10:38:04.2693549-07:00
before core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0 wt HEAD=16ff729262b4db4b7b2518d76d96667b1703f467 porcelain=0
wt-checkout exit=0
F:\fxlab\fxlab-16ff729-b HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0
F:\fxlab\!FluxIQ HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0
fluxiq version: 0.4.0
core dist contracts newest 2026-09-13T09:51:44 files=36
core dist fluxiq newest 2026-09-13T09:51:52 files=1976
core dist client-gateway-websocket newest 2026-09-13T09:51:54 files=20
core dist start-node.js chooseAutomationStudioStartNode lines=1; command-answer-margin.js 'COMMAND_ANSWER_MARGIN_MS = 3_000' lines=1
build wt @fluxiq-web-extension/domain exit=0 seconds=4.4
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=2.1
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=3.5
wt dist domain\dist newest 2026-09-13T10:38:09 files=274
wt dist packages\test-contracts\dist newest 2026-09-13T10:38:11 files=36
wt dist apps\scenario-lab\dist newest 2026-09-13T10:38:15 files=166
wt porcelain=0
core porcelain=0
finished=2026-09-13T10:38:15.5774594-07:00
```

Core's dist times match `l-stage2d`'s build at 09:51, so Core was not rebuilt underneath the bench.

### The pin proof, before the bench

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs F:\fxlab\fxlab-16ff729-b`
(`l-stage3b-pin-proof.txt`):

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
exit=0
```

### How the bench ran

- **Headed:** the runner launches Chrome with `headless: false` unconditionally
  (`packages/test-runner/src/run-scenario.ts:508` at `d639415`), as `v-bench-honesty` requires.
  This was read in the code, not watched on screen.
- **Driver** `l-stage3b-lab-seq.ps1`: `l-stage2d-lab-seq.ps1` without the workspace keeper, plus
  a memory gate.
  - Before the Lab command it reads `FreePhysicalMemory`. While that is under 3 GB it writes a
    `memory-wait` line and waits 120 s (`node -e "setTimeout(()=>{},120000)"`).
  - It runs `pnpm -C F:\fxlab\fxlab-16ff729-b lab <args> *> <log>` and records
    `exit=$LASTEXITCODE`, never through a pipe.
- **Environment:**
  - `FLUXIQ_TEST_ENV_FILES=none`;
  - `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` set to `l-stage3b`;
  - `FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage3\b`;
  - `FLUXIQ_CORE_ROOT` unset;
  - the auth-gate secret variable set, as in Stage 2, `l-stage2c` and `l-stage2d`.

  The FluxIQ web panel was not started.
- **Plan** `l-stage3b-plan-bench.txt`: `week1|1|bench --corpus week1 --repeat 3 --target isolated|1`.
- **Leak watcher** `l-stage3b-watch.mjs`, every 60 s:
  - reads each settled bundle's attestation `status`, `literalCount` and `findingCount`;
  - counts six declared values as UTF-8 and UTF-16 in every file: auth-gate's password
    constant, `sensitive-input`'s two replaced literals, and W17's upload name, content and
    base64 content;
  - prints counts only, and exits 2 on any count above 0.

  Its log line: `declared values loaded: auth-gate-password, sensitive-input:replace-password, sensitive-input:replace-payment, upload-name, upload-content, upload-content-base64 (not printed)`.
- **Memory:** `l-stage2c-mem.ps1` every 15 s to `l-stage3b-lab-mem.csv`.

### Launch

```
plan=…\l-stage3b-plan-bench.txt worktree=F:\fxlab\fxlab-16ff729-b runsDir=F:\fxlab-runs\stage3\b pid=3776 started=2026-09-13T10:40:28.1552839-07:00
launch name=week1 index=1 start=2026-09-13T10:40:28.3547926-07:00 otherLabsBefore=4 freeGBBefore=9.93 args=bench --corpus week1 --repeat 3 --target isolated
```

The Lab's build phase printed
`{"lab":"paths","instance":"l-stage3b",…,"runsDirectory":"F:\\fxlab-runs\\stage3\\b"}`.
`runs.json` records `startedAt=2026-09-13T17:40:51.953Z` and no `finishedAt`.

### The stop

- **Before killing, every process was confirmed by command line** in the tree under driver 3776:
  - `pnpm.cjs -C F:\fxlab\fxlab-16ff729-b lab bench --corpus week1 --repeat 3 …`;
  - `node scripts/lab/run-lab.mjs "bench" …`;
  - `F:\fxlab\fxlab-16ff729-b\packages\test-runner\dist\cli.js bench …`;
  - `…\apps\scenario-lab\.lab-instances\l-stage3b\dist\server.js`;
  - Core's `next dev --turbopack --hostname 127.0.0.1 --port 54310`, a child of that `cli.js`.
- **The run in flight was allowed to finish.** A 2-second poll waited for
  `run-mu04zfn7-6dd00f14` to appear and for `runs.json` to name it:
  `inflightFinished=True at=2026-09-13T11:18:40.0342650-07:00`. The bench had already created
  the next run's `.staging-run-mu050v0l-d79766ac`, W14 on the Flow lane.
- **Then** `taskkill /PID 3776 /T /F` printed `taskkill exit=0 at=2026-09-13T11:18:40.2552473-07:00`.
  Its `SUCCESS` lines name 8 processes: 8344 (`cli.js`), 6452, 6248, 11564, 9340, 20840, 19184
  and 3776.
- **Nothing of the bench remains.** A scan for any command line matching
  `fxlab-16ff729-b|l-stage3b|fxlab-runs\stage3\b|--port 54310`, or with a parent in the killed
  tree, found only my memory sampler and the leak watcher; both were then stopped. A second scan
  printed `remaining processes of mine=0`. The scenario-lab server, the `next dev` chain and any
  Chrome had exited with their parents.
- **Trees:**
  `wt HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0` and
  `core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0`.
- **Driver status:** no `name=week1 … exit=` result line and no `finished=` line, because the
  driver was killed.

### What completed: 34 of 201 runs

- **Planned:** 67 results (rows, workflows and variants on their lanes) × 3 repeats = 201 runs.
- **Completed:** repeat 1 of every result in rows W01 to W13 (33 runs), and W14 `interstitial`
  on the recording lane (1 run).
- **Not reached:** W14 on the Flow lane, W14 `armed`, rows W15 to W29, and repeats 2 and 3.
- **Time:** 37.8 minutes for 34 runs, about 67 s per run, under shared load.
- From `l-stage3b-analyse-bench-b.txt`:

```
records=34 evaluated=34 skipped=0 passed=25 notPassed=9 bundlesPresent=34
by lane: recording passed ×13; flow passed ×12; flow failed ×8; recording failed ×1
pins (facility/dirty core/dirty): d639415/false 3cb8976/false ×34
```

### Each completed row's verdict per lane (repeat 1)

The Flow-lane columns are from each bundle's `snapshots/flow-lane.json`. "—" means the run has
no `flow-lane.json` because it stopped before a Flow ran.

| Row | Workflow / variant | Recording lane | Flow lane | Candidates | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | `harnessActivations` | Flow actions (status) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | basic-form | passed (`run-mu03oa5x-14fe4921`) | passed (`run-mu03q7zl-5635b444`) | 4 | 0 | null | 0 | type, select, type, click: all succeeded, matched |
| W02 | keyboard-forms | passed (`run-mu03s1ea-61884d80`) | passed (`run-mu03tddl-5b769889`) | 9 | 0 | null | 0 | type, keypress, click, wait, click, check, wait, click, check: all succeeded, matched |
| W03 | keyboard-forms `combobox` | passed (`run-mu03v4sc-fa025ffb`) | passed (`run-mu03wnoo-45be3588`) | 4 | 0 | null | 0 | type, keypress ×3: all succeeded, matched |
| W04 | product-catalog | passed (`run-mu03ylgk-558899dc`) | **failed** (`run-mu03zfud-115007df`) | — | — | — | — | none |
| W04 | `text-variant` | — | **failed** (`run-mu040rht-5c9184f4`) | — | — | — | — | none |
| W05 | product-catalog `paginated-extraction` | passed (`run-mu041w39-3b8dfb83`) | passed (`run-mu042eej-a794a1ae`) | 5 | 0 | null | 0 | click, wait, click, scroll, scroll: all succeeded, matched |
| W05 | `short-catalog`, **ruled out of Week 1** | — | **failed** (`run-mu043yz9-1ebf63c0`) | 4 | 0 | null | 2 | click failed, `target_not_found` |
| W06 | product-catalog `search` | passed (`run-mu045h1d-914540ed`) | passed (`run-mu0465cx-5f216c49`) | 3 | 0 | null | 0 | type, keypress, click: all succeeded, matched |
| W06 | `no-results` | — | passed (`run-mu047k6u-d4463471`) | 3 | 0 | null | 0 | type, keypress, click: all succeeded, matched |
| W07 | product-catalog `in-stock-only` | passed (`run-mu049xaw-32902597`) | passed (`run-mu04aias-938c9993`) | 7 | 0 | null | 0 | click, check, wait, click, wait, click, scroll: all succeeded, matched |
| W08 | data-table | passed (`run-mu04ctui-40deb402`) | **failed** (`run-mu04dssd-0b8d6eba`) | — | — | — | — | none |
| W08 | `column-reorder` | — | **failed** (`run-mu04eyzp-bee8446e`) | — | — | — | — | none |
| W09 | data-table `sort-by-price` | passed (`run-mu04gh33-0cf285ae`) | passed (`run-mu04hi14-bdc001bc`) | 1 | 0 | null | 0 | click succeeded, matched |
| W10 | navigation | **failed** (`run-mu04jb46-7332cc99`) | **failed** (`run-mu04l0xu-7fd1bbfe`) | — | — | — | — | none |
| W10 | `broken-link` (negative) | — | passed (`run-mu04mo17-d4c6a910`) | 2 | 0 | null | 2 | click failed, `unexpected_state`, as expected |
| W11 | infinite-feed | passed (`run-mu04og7e-bee37b50`) | passed (`run-mu04pkh8-fc50aff7`) | 3 | 0 | null | 0 | scroll ×3: all succeeded, matched |
| W11 | `end-early` | — | passed (`run-mu04r0mq-43de6520`) | 3 | 0 | null | 0 | scroll ×3: all succeeded, matched |
| W12 | modal-flows | passed (`run-mu04sfr6-4d6f3045`) | passed (`run-mu04txeh-343a6573`) | 4 | 0 | null | 0 | click, type, select, click: all succeeded, matched |
| W13 | modal-flows `consent-then-click` | passed (`run-mu04vox4-d527d187`) | **failed** (`run-mu04wrsy-f55b3ed0`) | — | — | — | — | none |
| W13 | `banner-absent`, **ruled out of Week 1** | — | **failed** (`run-mu04xvl4-d1eccc6e`) | 2 | 0 | null | 2 | click failed, `target_not_found` |
| W14 | modal-flows `interstitial` | passed (`run-mu04zfn7-6dd00f14`) | not reached | — | — | — | — | — |

- **`startCandidateIndex`:** `0 ×14` over the 14 Flow runs that have `flow-lane.json`.
  `stoppedWithoutFailedAttempt`: `null ×14`.
- **`harnessActivations`:** 0 in 11 succeeded Flows, and 2 in each of the 3 Flows that reported
  a failure (W05 `short-catalog`, W10 `broken-link`, W13 `banner-absent`). Unmeasured in the 6
  Flow-lane runs without `flow-lane.json`.
- **Recorded actions, extension against Core, where the run read them:** equal in every run.
  - 4/4 on W01 (both lanes), W03 (both), W05 Flow and W12 (both);
  - 7/7 on W02 (both); 5/5 on W07 Flow;
  - 3/3 on W05 `short-catalog`, W06 Flow, W06 `no-results`, and W11 on both lanes and `end-early`;
  - 2/2 on W10 `broken-link`, W13 recording, W13 `banner-absent` and W14 recording;
  - 1/1 on W09 (both);
  - **0/0 on the four no-proposal runs.**

### Every failure: category and code

The runner's category is `runs.json` `failureCategory`. The automation failure is
`run.json` `automationFailure`, or the failing action's `failure` in `flow-lane.json`.

| Run | Row, lane | Runner category and cause (quoted from `runs.json`) | Automation failure: category / code | Notes |
| --- | --- | --- | --- | --- |
| `run-mu03zfud-115007df` | W04, Flow | `recording.contract`: `Core produced no recording Flow proposal for the run's recording` | none | recordedActions 0/0, entryCount 3; `failureDetails.proposalCount=0`, 2 issue strings (109 and 279 characters, not quoted) |
| `run-mu040rht-5c9184f4` | W04 `text-variant`, Flow | the same | none | 0/0, entryCount 4; the same `failureDetails` shape |
| `run-mu04dssd-0b8d6eba` | W08, Flow | the same | none | 0/0, entryCount 3; the same shape |
| `run-mu04eyzp-bee8446e` | W08 `column-reorder`, Flow | the same | none | 0/0, entryCount 3; the same shape |
| `run-mu043yz9-1ebf63c0` | W05 `short-catalog`, Flow, **ruled out** | `runtime.behavior`: `The Flow reported an unexpected target_not_found failure` | `target_not_found` / `web.target.not_found`, stage `target_resolution`, retryable | The Flow's first click; `expected=null` |
| `run-mu04xvl4-d1eccc6e` | W13 `banner-absent`, Flow, **ruled out** | `runtime.behavior`: the same text | `target_not_found` / `web.target.not_found`, stage `target_resolution`, retryable | The Flow's first click; `expected=null` |
| `run-mu04jb46-7332cc99` | W10, recording | `recording.persistence`: `Core reported the run's recording finished but its timeline kept growing for 30000 ms, so it was never safe to read` | none | Events: settle, 3 step pairs, step, checkpoint, error. No discard read ran |
| `run-mu04l0xu-7fd1bbfe` | W10, Flow | `recording.persistence`: `Core was still writing the run's recording after 30000 ms, and a Flow built from an unfinished recording silently loses the actions Core has not appended yet` | none | The same event shape; no `flow-lane.json`; no discard read ran |
| `run-mu04wrsy-f55b3ed0` | W13, Flow | `gateway.connection`: `Timed out waiting for extension connection state` | none | The bundle's only event is that error. **A timing-only shape, not rerun** |

The one negative variant reached, W10 `broken-link` (`run-mu04mo17-d4c6a910`), passed:
- reported `navigation_unexpected` / `web.navigation.unexpected`, stage `confirmation`,
  `retryable=false`, `comparisonStatus=unexpected_state`;
- expected `navigation_unexpected`.

### `recording.persistence` failures: discard kinds and counts

- **Both W10 failures stopped before either discard read.** Their `events.ndjson` holds only
  the probe-phase `runtime.settle`, whose window is absent and discard list empty. So they have
  **no discards of any kind to report**, and none is a runtime confirmation. The failure is
  Core's recording timeline still growing after 30,000 ms, not a discard.
- **No run in the bench kept an action discard.** In 11 runs the first read listed one
  `recording.event_discarded`: with a recording id, `discardedActions=0`, `discardedEvents=1`,
  `sinceFinalizedMs` between 8 and 18. The 11 are:
  - recording lane: W01, W02, W03, W12 and W14;
  - Flow lane: W01, W02, W06 `no-results`, W07, W10 `broken-link` and W13 `banner-absent`.

  All 11 passed their completeness check. The runner's loss summary skips a non-action discard
  with 0 actions (`packages/test-runner/src/flow-lane/recording-discards.ts:136` at `d639415`).
- **The windows excluded what they are designed to exclude:**
  - on the first read of W01, W02 and W03 on both lanes, and of W06's two Flow runs:
    `recording.action_discarded` `noRecording: 2`, the Core probe's two confirmations before
    recording starts. The recording-lane runs of W04 to W08 have no `runtime.settle` discard
    read in their events;
  - on each succeeded Flow's second read: `thisRunsRecording` equal to its action count, the
    Flow's own confirmations after `until`.

### Exit criteria, as far as this partial bench reaches

Counted as the supervisor ruled. Every figure is repeat 1 only, so **no workflow can show
"3 of 3".**

| Criterion | What this bench measured | Judged on |
| --- | --- | --- |
| 1. Actions reliable: unarmed W01-W19, 3 of 3, per lane | Recording lane: 14 unarmed workflows (W01-W14) ran once; **13 of 14 passed**, W10 failed. Flow lane: 13 (W01-W13) ran once; **9 of 13 passed**, W04, W08, W10 and W13 failed. W15-W19 not reached. | Not judgeable: no workflow reached repeats 2 or 3 |
| 2. Evidence useful | Redaction attestation `not-applicable` ×34, `literalCount=0` ×34, 0 findings. W18 and W19, the rows that supply a secret, were not reached, so the attestation never scanned for a literal. `evidencePackets` on 0 of 49 actions. No evidence-size figures: `report.json` was never written. | Not judgeable |
| 3. Deterministic fallback: W20-W23 recover, W26 by context | Not reached | Not judgeable |
| 4. Failures classified: W14, W19, W27 negative variants, at least 90% | **Objective's set: 0 runs, none reached.** Every negative variant reached: 1 run, W10 `broken-link`, **1 of 1** reported `navigation_unexpected` as expected. **No misses.** W24 `unannounced` not reached. | Not judgeable: the Objective's set is empty |
| 5. Bench repeatable | **This is not the criterion-5 bench.** Stopped at 34 of 201; no `report.json`, `report.md`, rates or latency. Timings came from shared load with two other Lab instances. Lowest free memory 4.70 GB. | Not judgeable |
| 6. Blockers ranked | Failure causes, by count: no Flow proposal ×4 (W04, W04 `text-variant`, W08, W08 `column-reorder`); `recording.persistence` ×2 (W10, both lanes); `target_not_found` on ruled-out rows ×2; `gateway.connection` ×1 (W13 Flow) | Input only |

**Ruled out of Week 1:**
- W05 `short-catalog` ran and failed: `target_not_found` / `web.target.not_found` at the first click.
- W13 `banner-absent` ran and failed the same way.
- W24 `unannounced` was not reached.

### Against Stage 2's bench, for the 34 results reached

This is not a repeatability comparison. The pins differ: `l-stage2` ran at `6c22e22` and Core
`5845f5d`, alone, `--repeat 1`, its verdicts quoted from `reports/l-stage2.md` "The week1 bench
result". The load differs too, and both sides are single observations.

- **Failed there, passed here (12):**
  - recording lane: W05, W07, W12, W14;
  - Flow lane: W02, W03, W05, W07, W09, W11, W11 `end-early`, W12.
- **Passed there, failed here (7):**
  - recording lane: W10;
  - Flow lane: W04, W04 `text-variant`, W08, W08 `column-reorder`, W10, W13.
- **Failed in both (2):**
  - W05 `short-catalog`: `page-status` there, `target_not_found` here;
  - W13 `banner-absent`: `target_not_found` in both.

### Leak checks

- **Watcher:** it scanned bundles until it was stopped at the kill. Its last progress line
  reported `bundlesWithLeak=0`.
- **Bench reader** (`l-stage3b-analyse-bench-b.txt`), with all six declared values:
  `declared-value search over bundle files: bundles=34 files=585 hits=0`.
- **Final scan** (`l-stage3b-final-scan.mjs`, after the stop), over every file under
  `F:\fxlab-runs\stage3\b\` (the bench directory, `.staging-run-mu050v0l-d79766ac` and `.work`
  included) and every `l-stage3b-*` scratch file:
  ```
  declared values loaded (6): auth-gate-password, sensitive-input:replace-password, sensitive-input:replace-payment, upload-name, upload-content, upload-content-base64 (not printed)
  stage3b-run-artifacts: files=625 totalHits=0
  scratch-l-stage3b: files=25 totalHits=0
  ```
  An earlier inline version loaded only four of the six values, so its result was discarded and
  is not quoted. The report file itself was scanned last; see the next line.
- **This report,** scanned just before this line was filled in with the result:
  `declared values loaded (6): …` then `report: files=1 totalHits=0`.
- **The stop rule did not apply:** no count was above 0.

### Memory

- **Samples:** 154, every 15 s, from 10:40:28 to 11:18:54 (`l-stage3b-lab-mem.csv`).
- **Lowest free memory: 4.70 GB, at 10:48:30.** That was during W03 `combobox` on the Flow lane,
  which passed. The Chrome plus Node working set in that sample was 11.42 GB, across all three
  Lab instances.
- **Thresholds:** `below3GB=0`, `below6GB=5`, and `memory-wait lines=0`, so the driver never waited.
- **During the failed runs:** the lowest free memory within each run was 7.06 GB (W04 Flow),
  9.48 (W04 `text-variant`), 6.76 (W08 Flow), 6.10 (W08 `column-reorder`), 6.71 (W10 recording),
  8.01 (W10 Flow), 8.78 (W13 Flow), 8.86 (W05 `short-catalog`) and 8.63 (W13 `banner-absent`).

## Not verified

- **No rerun of any failure.** The stop order said to start nothing else, so every failure above
  is one observation under three-instance load:
  - W13 Flow `gateway.connection` has the timing-only shape the rules say to rerun alone;
  - the two W10 `recording.persistence` failures rest on a 30,000 ms bound;
  - the four no-proposal failures are also unrepeated.

  A rerun would need each of `navigation`, `navigation --flow`,
  `modal-flows --flow --workflow consent-then-click`, `product-catalog --flow` and
  `data-table --flow`, once, alone, with more than 6 GB free.
- **Not reached:** 167 of 201 runs. That is rows W15-W29, the W14 Flow runs, and repeats 2 and 3.
  So nothing here bears on W18's secret, W19, W20-W23, W26, W27, W29, or any "3 of 3".
- **No bench report.** The kill came before `report.json` and `report.md`, so there are no rates,
  no action latency, no run-duration distribution and no evidence sizes. The per-row figures are
  read from the bundles and `runs.json`.
- **Why W04 and W08 now fail as "no proposal".** Their recordings hold 0 actions with 3 or 4
  entries, where Stage 2's bench passed them at older pins. I did not trace which commit changed
  that. The two issue strings were not read, by the evidence rule.
- **Whether killing mid-start left Core state.** `.work\run-mu050v0l-d79766ac` is kept as found;
  I did not open it beyond the final scan.
- **Headed windows** were established from `run-scenario.ts:508`, not watched.

## Open questions or contradictions found

1. **W04 and W08 on the Flow lane,** each unarmed workflow and its variant, failed
   `recording.contract` "Core produced no recording Flow proposal". Those are extraction rows
   whose recording held 0 actions. They passed in Stage 2's bench at `6c22e22`/`5845f5d`.
   - **Inference, not measured:** a guard added since then refuses a recording that proposes no
     Flow, where the earlier lane let it pass.
   - Either way, these rows cannot pass the Flow lane as recorded, and they will fail every
     repeat of the final bench.
2. **W10 `navigation` failed `recording.persistence` on both lanes,** one after the other at
   11:05-11:07, with 6.71 and 8.01 GB free. Core's recording timeline was still growing 30 s
   after it reported the recording finished. It passed both lanes in Stage 2's bench alone. A
   single observation under load, and worth one run alone at the new pins before it is ranked.
3. **`recordingDiscards` lists event-only discards in 11 of 34 runs:** 0 actions, 1 event, a few
   milliseconds after finalization. They do not fail a run. A reader of `runtime.settle` could
   mistake them for losses, so a published `lostActions` count beside the list would make the
   difference visible.
4. **`l-stage2d` ran a week1 bench** (`--repeat 1`, instance `l-stage2d-d`) in
   `F:\fxlab\fxlab-7263534` concurrently with this one, although its amendment said to skip it.
   So bench B shared the machine with two other Lab benches, `l-stage3a`'s and `l-stage2d`'s,
   not with bench A alone.
5. **A kept Stage 2 file still holds W17's upload name.** While self-testing the bench reader
   against Stage 2's bench, I found `upload-name: 2` (count only) in
   `F:\fxlab-runs\stage2b\d\run-mtzrjmsu-1e0816ba\snapshots\flow-lane.json`. That bundle
   predates `af80298`. l-stage2's artifact search counted three values and did not include the
   upload name, so this was not seen then. The supervisor may want it purged.
