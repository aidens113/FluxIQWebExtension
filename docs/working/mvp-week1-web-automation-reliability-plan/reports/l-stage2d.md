# l-stage2d — W15, W28, W25 `too-slow`, W17 and W05 `short-catalog`, then the week1 bench once

Worker report for `l-stage2d` in [finish-week1.md](../briefs/finish-week1.md), with its
amendment "Amendment to `l-stage2d` — pins, and two more figures". Written 2026-09-13,
local time (UTC-7). This machine has faulty RAM: every figure is a single observation
unless it says otherwise.

- **Pins.** This repository `d639415` (`d6394155efb7eecb1815d1b496a283b26b506bae`); Core
  `3cb8976` (`3cb8976fb665c89f4909a9f49eb35be611cea0fa`), whose last code commit is
  `20bb3b4`. `fluxiq` 0.4.0.
- **Evidence rules.** No declared secret, uploaded file content or name, token or recorded
  page data is printed, hashed or partially quoted here. Every figure is a path, a key path,
  a kind, an id or a count. The one exception the brief asks for is W28's scroll position,
  given as numbers.

**Status: complete.** Runs 1-5 were measured. Run 6 was stopped at 29 of 67 rows on the
supervisor's amendment.

## Outcome

**Done, as amended: Runs 1-5 are measured, and Run 6 was dropped by the supervisor mid-run.**
Every row below ran at the pins, with `dirty=false` on both repositories. No leak count is
above 0.

| Run | Brief's check | Observed |
| --- | --- | --- |
| 1 | W15 unarmed: first attempt is the first recorded action; the run passes with tab actions succeeding | **3 of 3.** `startCandidateIndex` 0; click → tab ×3 → click, all succeeded |
| 1 | W15 `popup-blocked`: reports `output_not_observed` | **3 of 3.** The first click fails `output_not_observed` / `web.validation.output_not_observed`; the run passes |
| 2 | W28: both frame clicks succeed; any recorded scroll's frame and position | **3 of 3.** Runs 1 and 2 recorded one scroll each, in frame 4 (`/scenarios/iframe-checkout/same-frame`) at `x=0, y=29`, after both clicks; run 3 recorded none |
| 3 | W25 `too-slow`: `web.action.timeout`, not `output_dispatch.timed_out`, and the run passes | **3 of 3** |
| 4 | W17 `upload`: the file name and content each found 0 times, SQLite included | **3 of 3:** name 0, content 0, in files, earlier versions and SQLite cells |
| 5 | W05 `short-catalog`: the failing node and its category | The Flow's first node, the `web.dom.click` on page 1's Next, fails `target_not_found` / `web.target.not_found` at `target_resolution`, in **3 of 3** measured runs. Run 3 hit a startup timeout and was rerun once, alone |
| 6 | The week1 bench, `--repeat 1` | **Stopped at 29 of 67 rows** by the amendment. 24 of the 29 passed, where Stage 2 passed 18 of the same rows. W04's and W08's four Flow rows regressed to `recording.contract` |

**The amendment's figures.**
- **Start and early stop:** all 18 Flow runs with a `flow-lane.json` have
  `startCandidateIndex` 0 and `stoppedWithoutFailedAttempt` null.
- **Item 7d:** no `recording.persistence` failure occurred in any bundle. A bundle could not
  show whether a discard was a runtime confirmation anyway, because that detail stays in
  Core's in-memory audit log.
- **Memory:** the lowest free memory seen was 7.55 GB.

## What changed and why

No tracked file in either repository was edited, and nothing was built or run in
`F:\!FluxIQWebExtension` or `F:\!FluxIQ`. Created or changed:

- **Worktrees moved in place,** each with `git checkout --detach`:
  - `F:\fxlab\!FluxIQ`: `6621d66` to `3cb8976`;
  - `F:\fxlab\fxlab-7263534`, the measured worktree: `69f40c1` to `d639415`. The directory
    name still reads `7263534`.
  - `F:\fxlab\fxlab-7263534-load` was not moved (still `69f40c1`); no run used it.
- **Run directories** under `F:\fxlab-runs\stage2d\`, and kept Core workspaces under
  `F:\fxlab-runs\stage2d\kept\`.
- **Scratch files,** all prefixed `l-stage2d-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`.
  `l-stage2c-keep.mjs`, `l-stage2c-search.mjs`, `l-stage2c-mem.ps1` and
  `l-stage2-pin-proof.mjs` were reused unchanged.

## Commands run and observed results

### Pre-checks

- **No other Lab, run or agent.** Before setup no process command line matched
  `run-lab.mjs`, `test-runner\dist\cli.js`, `next dev`, `fxlab`, `package:lint`, `vitest`,
  `l-stage2` or `playwright`; the only `tsc` matches were two VS Code language-server
  processes. No `FLUXIQ_*` variable was set. No `l-stage2d-*` scratch file and no
  `F:\fxlab-runs\stage2d` existed. `FreeGB 13.61 TotalGB 25.85`.
- **Both worktrees clean before the move:** `git status --porcelain` counted 0 in each.
- **No install.** `git diff --stat 69f40c1 d639415 -- pnpm-lock.yaml package.json pnpm-workspace.yaml '**/package.json'`
  printed nothing. Core's `git diff --stat 6621d66 3cb8976` over its lockfile, root
  `package.json`, workspace file and the four packages' `package.json` printed nothing.
- **Commits since `l-stage2c`'s pins.** `git log --oneline 69f40c1..d639415` lists 8:
  `5bad6c3`, `cfa1bfb`, `af80298` (upload check quotes no file name), `696e8a8`, `f41072e`
  (the extension gets its Flow node's timeout), `b5c5db2` (the runner's start and
  early-stop guard), `f840b75`, `d639415`. `git log --oneline 6621d66..3cb8976` lists
  `604d0d3`, `b54df69` (a command waits its timeout plus a 3,000 ms answer margin),
  `20bb3b4` (a Flow with no Start node begins at its graph's root), `3cb8976`.

### Setup

From `l-stage2d-setup-status.txt`:

```
core-checkout exit=0
wt-checkout exit=0
F:\fxlab\!FluxIQ HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0
F:\fxlab\fxlab-7263534 HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0
build core @fluxiq/contracts exit=0 seconds=1.7
build core fluxiq exit=0 seconds=7.7
build core @fluxiq/client-gateway-websocket exit=0 seconds=1.6
fluxiq version: 0.4.0
core dist contracts newest 2026-09-13T09:51:44 files=36
core dist fluxiq newest 2026-09-13T09:51:52 files=1976
core dist client-gateway-websocket newest 2026-09-13T09:51:54 files=20
core porcelain=0
build wt @fluxiq-web-extension/domain exit=0 seconds=2.8
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=1.5
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=2.4
wt dist domain\dist newest 2026-09-13T09:51:57 files=274
wt dist packages\test-contracts\dist newest 2026-09-13T09:51:58 files=36
wt dist apps\scenario-lab\dist newest 2026-09-13T09:52:01 files=166
wt porcelain=0
```

- **Core** was built one package at a time with `pnpm -C F:\fxlab\!FluxIQ --filter <package> build`,
  as in `l-stage2c`. `@fluxiq/web` was not built.
- **The three shared builds** were `pnpm -C F:\fxlab\fxlab-7263534 --filter <package> build`.
  All exited 0 on the first attempt.
- **Core's build carries both Core fixes.** `dist\...\runtime\executor\start-node.js:28`,
  `graph-run.js:7,135` and `compiled-plan.js:2,20` reference `chooseAutomationStudioStartNode`.
  `dist\client-gateway\service\command-answer-margin.js:20` is
  `COMMAND_ANSWER_MARGIN_MS = 3_000`, used at `commands.js:46`.

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs F:\fxlab\fxlab-7263534` printed
`exit=0`, every probe `pinned=true` into `F:\fxlab\!FluxIQ\packages\...\dist`,
`import(fluxiq/automation-studio) from packages/test-runner: ... exports=385`, and `unpinned=0`.

### How the campaign runs

- **Driver** `l-stage2d-lab-seq.ps1`, `l-stage2c`'s driver with `l-stage2d-` names and one
  addition: it opens a lock file with `CreateNew`, so a second start of the same label is
  refused. That is the double-launch `l-stage2c` saw. It runs a plan file serially as
  `pnpm -C F:\fxlab\fxlab-7263534 lab <args> *> <log>` and writes `exit=$LASTEXITCODE`,
  never through a pipe.
- **Environment on every Lab command:** `FLUXIQ_TEST_ENV_FILES=none`; `FLUXIQ_LAB_INSTANCE`
  and `EXTENSION_TEST_BUILD_LABEL` equal to the label; `FLUXIQ_TEST_RUNS_DIR` under
  `F:\fxlab-runs\stage2d\`. The auth-gate secret variable is set only for the bench, as in
  Stage 2 and `l-stage2c`.
- **One instance at a time.** Every status line records `otherLabsBefore`, the count of
  `run-lab.mjs` processes outside the worktree. The FluxIQ web panel was not started.
- **Bundle reader** `l-stage2d-analyse.mjs`, `l-stage2c`'s reader plus `startCandidateIndex`
  and `stoppedWithoutFailedAttempt` from `snapshots/flow-lane.json`. It counts every declared
  value (auth-gate's password, `sensitive-input`'s two replaced literals, W17's upload name,
  content and base64 content) in every bundle file, and prints counts only.
- **Kept workspaces** use `l-stage2c`'s hard-link keeper unchanged; its method and self-test
  are in `l-stage2c.md`. Kept workspaces are searched with `l-stage2c-search.mjs`: every file
  byte for byte, and every SQLite database cell by cell in each mode that opens.
- **Memory:** `l-stage2c-mem.ps1` every 15 s to `l-stage2d-lab-mem.csv`.

### Run 1 — W15 `multi-tab`, Flow lane, unarmed ×3 and `popup-blocked` ×3

Plan `l-stage2d-plan-1.txt`, label `l-stage2d-a`, runs dir `F:\fxlab-runs\stage2d\a`, no
secret, workspace not kept.

```
name=w15 index=1 seconds=69.7 exit=0 otherLabsBefore=0 freeGBBefore=13.54 args=run multi-tab --flow --target isolated
name=w15 index=2 seconds=66.4 exit=0 otherLabsBefore=0 freeGBBefore=13.44
name=w15 index=3 seconds=68.8 exit=0 otherLabsBefore=0 freeGBBefore=13.47
name=w15-popup-blocked index=1 seconds=66.8 exit=0 otherLabsBefore=0 freeGBBefore=13.58 args=run multi-tab --flow --variant popup-blocked --target isolated
name=w15-popup-blocked index=2 seconds=65.7 exit=0 otherLabsBefore=0 freeGBBefore=13.54
name=w15-popup-blocked index=3 seconds=68.6 exit=0 otherLabsBefore=0 freeGBBefore=13.52
```

Every `run.json`: facility `d639415…` `dirty=false`, Core `3cb8976…` `dirty=false`,
`redactionState=not_applicable`. Attestation `not-applicable`, `literalCount 0`. Every bundle:
18 files, 0 declared-value hits.

| Row, run | runId | Exit, verdict | candidateCount | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | Attempts in Core's order: status, `comparisonStatus` | Reported / expected failure | recordedActions | entryCount | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| unarmed 1 | run-mu023nye-7ecc83ab | 0, passed | 5 | **0** | null | `web.dom.click` succeeded matched; `web.browser.tab` succeeded matched ×3; `web.dom.click` succeeded matched | none / none | 5/5 | 25 | 0 |
| unarmed 2 | run-mu0255k5-3732d289 | 0, passed | 5 | **0** | null | the same | none / none | 5/5 | 25 | 0 |
| unarmed 3 | run-mu026lbm-5cf3a77b | 0, passed | 5 | **0** | null | the same | none / none | 5/5 | 25 | 0 |
| `popup-blocked` 1 | run-mu02821o-fbd5b092 | 0, passed | 5 | **0** | null | `web.dom.click` **failed**, `missing_expected_state`; nothing after it | `output_not_observed` / `web.validation.output_not_observed`; expected `output_not_observed` | 5/5 | 25 | 0 |
| `popup-blocked` 2 | run-mu029hml-7e9956d4 | 0, passed | 5 | **0** | null | the same | the same | 5/5 | 25 | 0 |
| `popup-blocked` 3 | run-mu02awe1-e68098d8 | 0, passed | 5 | **0** | null | the same | the same | 5/5 | 25 | 0 |

- **The order of attempts, 6 of 6.** The first attempt is the recording's first action, a
  `web.dom.click`, with `startCandidateIndex` 0.
  - Unarmed: click → tab → tab → tab → click, all `succeeded`, all `matched`.
  - `popup-blocked`: the first click is attempted and fails, and nothing after it runs.
- **Unarmed: 3 of 3 pass, with every tab action succeeding.**
  - `flow-lane.json`: `status=succeeded`, `failure=null`, `harnessActivations=0`,
    `extractionExpectation="not_applicable"`.
  - `evaluation.json`: `verdict=passed oracleVerdict=passed reportedVerdict=passed`.
- **`popup-blocked`: 3 of 3 report `output_not_observed`.**
  - The click's failure record:
    `{"category":"output_not_observed","code":"web.validation.output_not_observed","retryable":true,"stage":"verification",…}`.
    Its `expected` and `actual` fields quote the fixture's URL, so they are not reproduced.
  - `run.json` `automationFailure={"category":"output_not_observed","code":"web.validation.output_not_observed"}`.
  - `evaluation.json`: `verdict=passed oracleVerdict=passed reportedVerdict=failed`,
    `expected={"category":"output_not_observed"}`.
  - `flow-lane.json`: `status=failed`, `harnessActivations=2`,
    `extractionExpectation="not_expected"`.
- **Recording and discards, all six:** `recordedActions={"extension":5,"core":5}`,
  `recordedEvents={"web.element.clicked":2,"web.tab.state_changed":4}`, `entryCount` 25,
  `extensionConnectionAfterStop="connected"`.
  - First read: `recordingDiscards=[]`, and the window excluded nothing.
  - Second read: `discardsAfterFirstRead=0`, `snapshotFetches=1`. Unarmed runs' second window
    excluded `recording.action_discarded` `thisRunsRecording: 5`: the Flow's own five
    confirmations after `until`, which `g-discard-window` leaves out by design.
    `popup-blocked`'s excluded 0.
- **Against `l-stage2c`:** W15 was 0 of 6 there, and 7 of 7 runs started at the tab close.
  Here it is 6 of 6, and every run started at candidate 0. The fix that explains it is
  Core's `20bb3b4`, which starts a Flow with no Start node at its graph's root.
  `popup-blocked`'s `output_not_observed` follows from the Flow now reaching the blocked
  click first, as `i-w15-w28-flow-order` predicted.
- Not the faulty-RAM shape: every run went full length and exited 0.

### Run 2 — W28 `iframe-checkout`, Flow lane, ×3, Core's workspace kept

Same plan, label and runs dir. Kept under `F:\fxlab-runs\stage2d\kept\<runId>`.

```
name=w28 index=1 seconds=66.7 exit=0 otherLabsBefore=0 freeGBBefore=13.45 args=run iframe-checkout --flow --target isolated keep=True keeperExited=True keeperExit=0
name=w28 index=2 seconds=64.5 exit=0 otherLabsBefore=0 freeGBBefore=13.41 keep=True keeperExited=True keeperExit=0
name=w28 index=3 seconds=61.7 exit=0 otherLabsBefore=0 freeGBBefore=13.44 keep=True keeperExited=True keeperExit=0
```

Every `run.json`: facility `d639415…` `dirty=false`, Core `3cb8976…` `dirty=false`,
`redactionState=not_applicable`. Every bundle: 17 files, 0 declared-value hits.

| Run | runId | Exit, verdict | candidateCount | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | Attempts: status, `comparisonStatus` | recordedActions | entryCount | Recorded events | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mu02cdso-4aabe05e | 0, passed | 3 | **0** | null | `web.dom.click` succeeded matched; `web.dom.click` succeeded matched; `web.dom.scroll` succeeded matched | 3/3 | 10 | `web.dom.mutated` 1, `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 | 0 |
| 2 | run-mu02du3y-2effd299 | 0, passed | 3 | **0** | null | the same | 3/3 | 10 | `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 | 0 |
| 3 | run-mu02f8sd-c93ba623 | 0, passed | **2** | **0** | null | `web.dom.click` succeeded matched; `web.dom.click` succeeded matched | 2/2 | **7** | `web.element.clicked` 2, `web.tab.state_changed` 1 | 0 |

- **Both frame clicks succeed: 3 of 3.** `flow-lane.json` `status=succeeded`, `failure=null`,
  `harnessActivations=0`; `evaluation.json` `verdict=passed oracleVerdict=passed reportedVerdict=passed`.
- **No run recorded two scrolls.** Runs 1 and 2 recorded one scroll each; run 3 recorded
  none. So `l-stage2c` run 2's second scroll did not recur here: a single observation there,
  and 0 of 3 here.
- **Discards:** first read `recordingDiscards=[]`; second read `discardsAfterFirstRead=0`.
  The second window excluded the Flow's own confirmations after `until`
  (`recording.action_discarded` `thisRunsRecording` 3, 3 and 2).

**The recorded actions, from the kept recording** (`l-stage2d-scroll.mjs`, which reads
Core's recording event chunks under
`.fluxiq\artifacts\automation-studio\projects\<project>\objects\sha256\` and the recording's
`index.json`; it prints ids, kinds, frame fields and scroll coordinates only).

| Run | Entry | Kind (`actionType`, `inputId`) | `browserFrameId` | `browserFrameUrlPath` | `visualTarget.frameId` | Scroll `x`, `y` | ms after the first click |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `entry.3` | `web.dom.click`, `web.user.element_clicked` | 4 | `/scenarios/iframe-checkout/same-frame` | `screen` | — | 0 |
| 1 | `entry.5` | `web.dom.click`, `web.user.element_clicked` | 5 | `/scenarios/iframe-checkout/cross-frame` | `screen` | — | 876 |
| 1 | `entry.7` | **`web.dom.scroll`**, `web.user.page_scrolled` | **4** | `/scenarios/iframe-checkout/same-frame` | none | **0, 29** | 1,413 |
| 2 | `entry.3` | `web.dom.click` | 4 | `/scenarios/iframe-checkout/same-frame` | `screen` | — | 0 |
| 2 | `entry.5` | `web.dom.click` | 5 | `/scenarios/iframe-checkout/cross-frame` | `screen` | — | 867 |
| 2 | `entry.7` | **`web.dom.scroll`**, `web.user.page_scrolled` | **4** | `/scenarios/iframe-checkout/same-frame` | none | **0, 29** | 1,199 |
| 3 | `entry.3` | `web.dom.click` | 4 | `/scenarios/iframe-checkout/same-frame` | `screen` | — | 0 |
| 3 | `entry.5` | `web.dom.click` | 5 | `/scenarios/iframe-checkout/cross-frame` | `screen` | — | 421 |

- **Counts:** scroll actions 1, 1 and 0; each recorded scroll is in frame 4, the same-origin
  frame whose click came first, at `x=0, y=29`. The index holds 10, 10 and 7 entries, with 3,
  3 and 2 actions.
- **When:** each scroll was recorded after both clicks: 537 ms (run 1) and 332 ms (run 2)
  after the cross-frame click. The scroll parameters are `x`, `y`, `browserFrameId` and
  `browserFrameUrlPath`.
- **Inference, not measured:** a 29-pixel scroll of the same-origin frame that is recorded
  after the next click fits `i-w15-w28-flow-order`'s account of the recorder's 400 ms
  debounced `scroll` listener catching a frame scrolled into view for its click. Nothing
  here shows what moved the frame.
- **The kept workspaces:** each keeper wrote `reason=core-stopped-final-sweep` with
  `copies=0 reparse=0`. Final-sweep files 32, 32 and 27. The paths absent at the final sweep
  are only `-wal`, `-shm` and `-journal` files, which Core deletes at close. Run 1 has
  `linkErrors=1` with `lastErrorCode=ENOENT` and `vanished=1`: a file disappeared between
  the sweep's listing and its link. Every recording chunk and index read above was kept.
- **Against `l-stage2c`:** 2 of 3 there, with run 2 starting at its trailing scroll. Here 3
  of 3, every run starting at candidate 0. Explained by Core's `20bb3b4`. The extra scroll
  itself did not recur, so no fix is shown by this run.

### Run 3 — W25 `delayed-ui` `too-slow`, Flow lane, ×3

Same plan, label and runs dir; workspace not kept.

```
name=w25-too-slow index=1 seconds=71.3 exit=0 otherLabsBefore=0 freeGBBefore=13.50 args=run delayed-ui --flow --variant too-slow --target isolated
name=w25-too-slow index=2 seconds=64.2 exit=0 otherLabsBefore=0 freeGBBefore=13.40
name=w25-too-slow index=3 seconds=66.6 exit=0 otherLabsBefore=0 freeGBBefore=13.57
```

| Run | runId | Exit, verdict | candidateCount | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | Attempts: status, `comparisonStatus` | Reported / expected failure | recordedActions | entryCount | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mu02gkbf-f6f29849 | 0, **passed** | 3 | 0 | null | `web.dom.click` succeeded matched; **`web.dom.wait_for_selector` failed**, `timeout` | `timeout` / **`web.action.timeout`**; expected `timeout` / `web.action.timeout` | 2/2 | 8 | 0 |
| 2 | run-mu02i2zp-e3078883 | 0, **passed** | 3 | 0 | null | the same | the same | 2/2 | 8 | 0 |
| 3 | run-mu02jgi6-908234be | 0, **passed** | 3 | 0 | null | the same | the same | 2/2 | 8 | 0 |

- **The failure reports `web.action.timeout`, not `output_dispatch.timed_out`, and the run
  passes: 3 of 3.**
  - The wait's failure record:
    `{"category":"timeout","code":"web.action.timeout","retryable":true,"stage":"execution",…}`.
    Its `expected` and `actual` fields name the fixture's selector, so they are not reproduced.
  - `run.json` `automationFailure={"category":"timeout","code":"web.action.timeout"}`.
  - `evaluation.json`: `verdict=passed oracleVerdict=passed reportedVerdict=failed`,
    `reported` and `expected` both `{"category":"timeout","code":"web.action.timeout"}`.
  - `flow-lane.json`: `status=failed`, `harnessActivations=2`; the second click was not
    attempted.
- Every `run.json`: facility `d639415…` and Core `3cb8976…`, both `dirty=false`,
  `redactionState=not_applicable`. Every bundle: 18 files, 0 declared-value hits.
- **Recording:** `recordedActions={"extension":2,"core":2}`, `entryCount` 8. First read
  `recordingDiscards=[]`; second read `discardsAfterFirstRead=0`, with the Flow's one
  confirmation after `until` excluded.
- **Against `l-stage2c`:** there the code was `output_dispatch.timed_out`, Core's dispatch
  deadline, 3 of 3. The fixes that explain the change are `f41072e`, which sends the
  extension its Flow node's timeout, and Core's `b54df69`, which waits that timeout plus
  3,000 ms for the extension's answer.

### Run 4 — W17 `file-transfer` `upload`, Flow lane, ×3, Core's workspace kept

```
name=w17 index=1 seconds=60.7 exit=0 otherLabsBefore=0 freeGBBefore=13.91 args=run file-transfer --flow --workflow upload --target isolated keep=True keeperExited=True keeperExit=0
name=w17 index=2 seconds=60.3 exit=0 otherLabsBefore=0 freeGBBefore=13.92 keep=True keeperExited=True keeperExit=0
name=w17 index=3 seconds=59.4 exit=0 otherLabsBefore=0 freeGBBefore=13.90 keep=True keeperExited=True keeperExit=0
finished=2026-09-13T10:13:00
```

| Run | runId | Exit, verdict | candidateCount | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | Attempts: status, `comparisonStatus` | recordedActions | entryCount | discardsAfterFirstRead | Keeper |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mu02kwj1-8104b227 | 0, passed | 2 | 0 | null | `web.dom.upload` succeeded matched; `web.dom.click` succeeded matched | 2/2 | 10 | 0 | final sweep, 30 files, `copies=0 linkErrors=0` |
| 2 | run-mu02m85c-5fe53fd1 | 0, passed | 2 | 0 | null | the same | 2/2 | 10 | 0 | final sweep, 30 files, `copies=0 linkErrors=0` |
| 3 | run-mu02njdn-a5df3a0f | 0, passed | 2 | 0 | null | the same | 2/2 | 10 | 0 | final sweep, 30 files, `copies=0 linkErrors=0` |

- `evaluation.json` `verdict=passed oracleVerdict=passed reportedVerdict=passed workflow=upload`.
  Every bundle: 17 files, 0 declared-value hits, including the upload's name, content and
  base64 content.
- **The kept workspace search** (`l-stage2c-search.mjs <root> <worktree> upload file-transfer`)
  over `fluxiq-root` and `versions`. Needles: the manifest's `UPLOAD_NAME`; the content from
  the worktree's built `deterministicUploadBytes(UPLOAD_NAME)`, as text, JSON-escaped and
  base64; the content's first line; and the control `/scenarios/file-transfer/`.

| runId | Files scanned (root, versions) | SQLite databases, by mode | **Name: files, SQLite cells** | **Content (every form): files, cells** | Content first line: files, cells | Control: files, cells (root) |
| --- | --- | --- | --- | --- | --- | --- |
| run-mu02kwj1-8104b227 | 33, 25 | 3 of 3 alone; `global.sqlite` with its kept `-wal`: `ERR_SQLITE_ERROR` | **0, 0; 0, 0** | **0, 0; 0, 0** | 0, 0; 0, 0 | 13, 6 |
| run-mu02m85c-5fe53fd1 | 35, 21 | 3 of 3 alone; `runtime\sqlite\global.sqlite` and `global.sqlite` with `-wal` read | **0, 0; 0, 0** | **0, 0; 0, 0** | 0, 0; 0, 0 | 13, 6 |
| run-mu02njdn-a5df3a0f | 34, 26 | 3 of 3 alone; `project.sqlite` with its kept `-wal`: `ERR_SQLITE_ERROR`; `global.sqlite` with `-wal` read | **0, 0; 0, 0** | **0, 0; 0, 0** | 0, 0; 0, 0 | 14, 6 |

- **The uploaded file's name and its content are each found 0 times, SQLite included, in 3 of
  3.** `sqliteDatabasesUnreadable=0` and `reparsePointsSkipped=0` in every root. The databases
  read are `.fluxiq\global.sqlite` (4 tables, 215 cells),
  `…\projects\<project>\project.sqlite` (75 tables, 3,044 cells) and
  `…\projects\<project>\runtime\sqlite\global.sqlite` (3 tables, 55 cells).
- The failed `-wal` modes are `l-stage2c`'s known shape: a kept link to a log Core had
  checkpointed and deleted at close. Each database opened alone.
- **Each workspace still holds the upload's saved command attempt:** two
  `.fluxiq\artifacts\runtime\command-attempts\attempt.<id>\attempt.json` per run, 30,553 and
  30,965 bytes. `l-stage2c` found the name at
  `$.attempt.result.payload.result.validation.expected` and `.actual` of the upload's attempt.
  Here those files hold it 0 times.
- **Against `l-stage2c`:** the name was found twice per run in that attempt, 3 of 3. The fix
  that explains it is `af80298`, whose upload check and refusals quote no file name.
- **Leak rule:** no leak count is above 0, so the stop rule does not apply.

### Run 5 — W05 `product-catalog` `short-catalog`, Flow lane, ×3

Plan `l-stage2d-plan-2.txt`, label `l-stage2d-b`, runs dir `F:\fxlab-runs\stage2d\b`. The corpus
row is `row("W05", "product-catalog", "paginated-extraction", ["short-catalog"])`
(`bench/corpus/week1.ts:34`), so the command names the workflow:
`run product-catalog --flow --workflow paginated-extraction --variant short-catalog --target isolated`.

```
name=w05-short-catalog index=1 seconds=59.7 exit=1 otherLabsBefore=0 freeGBBefore=13.98
name=w05-short-catalog index=2 seconds=64.9 exit=1 otherLabsBefore=0 freeGBBefore=13.92
name=w05-short-catalog index=3 seconds=81.2 exit=1 otherLabsBefore=0 freeGBBefore=13.89
finished=2026-09-13T10:16:52
```

**Run 3 failed before any Flow, and was rerun once, alone.** Its bundle
(`run-mu02s20h-2aa23cd7`, 11 files) has one error,
`Timed out waiting for http://127.0.0.1:<port>` (`process.startup`), `flowCreated=false`,
`oracleVerdict=null`, and no `logs\` directory. That is a startup failure with no assertion
diff, so it was treated as the environmental shape. The rerun used plan `l-stage2d-plan-2r.txt`,
label `l-stage2d-c`, runs dir `F:\fxlab-runs\stage2d\c`, with the workspace kept:
`name=w05-short-catalog-rerun index=1 seconds=57.3 exit=1 otherLabsBefore=0 freeGBBefore=13.96 keeperExit=0`.
The startup failure did not recur.

| Run | runId | Exit, verdict | candidateCount | `startCandidateIndex` | `stoppedWithoutFailedAttempt` | Attempts | Failing node's failure | recordedActions ext/Core | entryCount | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mu02pdt9-12b08666 | 1, failed | **5** | 0 | null | `web.dom.click` failed, `target_not_found`; nothing after it | `target_not_found` / `web.target.not_found`, stage `target_resolution`, retryable | **3/4** | 12 | 0 |
| 2 | run-mu02qoaq-a46890d3 | 1, failed | 4 | 0 | null | the same | the same | 3/3 | 11 | 0 |
| 3 | run-mu02s20h-2aa23cd7 | 1, failed | — | — | — | none: `process.startup` before the Flow | — | — | — | — |
| rerun | run-mu02vd6b-046b01e6 | 1, failed | 4 | 0 | null | `web.dom.click` failed, `target_not_found`; nothing after it | `target_not_found` / `web.target.not_found`, stage `target_resolution`, retryable | 3/3 | 11 | 0 |

**For the supervisor's ruling: the failing node is the Flow's first node, the `web.dom.click`
recorded on page 1's Next control, and its category is `target_not_found`
(`web.target.not_found`), in 3 of 3 measured runs** (runs 1, 2 and the rerun).
- `flow-lane.json`: `status=failed`, `startCandidateIndex=0`, one attempt,
  `web.dom.click` `failed` with `comparisonStatus` `target_not_found`, `harnessActivations=2`,
  `extractionCount=0`, `extractionExpectation="not_applicable"`. The failure record's `expected`
  and `actual` fields name the fixture's target, so they are not reproduced.
- `run.json` `automationFailure={"category":"target_not_found","code":"web.target.not_found"}`.
- `evaluation.json`: `verdict=failed oracleVerdict=passed reportedVerdict=failed`,
  `expected=null`, failed invariant `runner-verdict: expected="passed" actual="failed: runtime.behavior"`.
- Error event: `The Flow reported an unexpected target_not_found failure` (`runtime.behavior`).
- This is `i-w05-short-catalog`'s prediction, observed: the oracle holds on the untouched page,
  the variant expects no failure, and the runner fails the run.

**The Flow and its recording, from the rerun's kept workspace** (`l-stage2d-flowsrc.mjs` and
`l-stage2d-scroll.mjs`; ids, kinds and coordinates only):
- **Recorded actions** (index: 11 entries, 3 actions): `entry.4` `web.dom.click`
  (`web.user.element_clicked`, frame 0); `entry.7` `web.dom.click` (frame 0); `entry.9`
  `web.dom.scroll` (`web.user.page_scrolled`, frame 0, `x=0, y=680`).
- **The approved Flow's graph source,** in order: `web.dom.click` (`recorded.candidate.entry.4`),
  `web.dom.wait_for_selector` (`recorded.candidate.entry.6`), `web.dom.click` (`entry.7`),
  `web.dom.scroll` (`entry.9`). So a wait precedes the second click, none precedes the first,
  and the recording ends with a page scroll after the last click.
- **Why the category is `target_not_found`, not `timeout`:** no wait precedes the first click,
  which was `i-w05-short-catalog`'s open condition.
- **Run 1 differs, and is a single observation:** 5 candidates, 12 entries, and
  `recordedActions={"extension":3,"core":4}`. Core held one action more than the extension
  counted. No workspace was kept for run 1, so which action it was is not known. The runner
  fails a run only when Core holds fewer, so this passed its completeness check. Its failing
  node and category are the same as the others.
- Every `run.json`: facility `d639415…` and Core `3cb8976…`, both `dirty=false`. Every bundle:
  0 declared-value hits.

### Run 6 — the week1 bench: started, then stopped on the supervisor's amendment

The supervisor's mid-run amendment dropped Run 6, because Lab Stage 3's two `--repeat 3`
benches now run concurrently in other worktrees. By then the bench had been running for 21
minutes.
- **Command:** plan `l-stage2d-plan-3.txt`, label `l-stage2d-d`, runs dir
  `F:\fxlab-runs\stage2d\d`, `bench --corpus week1 --repeat 1 --target isolated`, with the
  auth-gate secret supplied.
- **How it was stopped:** pid 18188 was confirmed as `pnpm … lab bench` in
  `fxlab-7263534`, then `taskkill /PID 18188 /T /F` ran (exit 0). The chain was pnpm's node
  18188 → `cmd.exe` 11404 → the Lab's node 5220.
- **The driver's line:** `name=week1 index=1 seconds=1,321.3 exit=1 otherLabsBefore=0 freeGBBefore=13.97`,
  then `finished=2026-09-13T10:41:24`. Its lock was released.
- **After the stop:**
  - 0 processes named `l-stage2d-d`, and 0 `run-lab.mjs` in `fxlab-7263534`. The 4
    `run-lab.mjs` processes still alive belong to other worktrees.
  - The worktree is still `d639415`, `porcelain=0`.
  - The W12 Flow row was in flight. It left `.work` and `.staging-run-mu03n3gz-0f0fc0f3` in
    the ignored runs dir.

**This is not the brief's Run 6**, and is not compared row by row as the brief asked. What
the 29 completed rows (`bench-mu02x0gp-05d55614`, W01 recording to W12 recording) show, each
a single observation, from `l-stage2d-bench.mjs`:

- **24 of 29 passed:** recording lane 12 of 12, Flow lane 12 of 17. Stage 2's bench passed 18
  of these same 29 rows.
- **Changed from Stage 2, failed to passed (10):**
  - W02 Flow, W03 Flow;
  - W05 recording, W05 unarmed Flow;
  - W07 recording, W07 Flow;
  - W09 Flow;
  - W11 unarmed Flow, W11 `end-early` Flow;
  - W12 recording.
- **Changed from Stage 2, passed to failed (4), a regression:** W04 unarmed Flow, W04
  `text-variant` Flow, W08 unarmed Flow and W08 `column-reorder` Flow.
  - Each fails as `recording.contract`:
    `Core produced no recording Flow proposal for the run's recording`.
  - Each has `recordedActions={"extension":0,"core":0}` and `entryCount` 3.
  - `l-stage2c`'s partial bench (`69f40c1`) failed W04's two Flow rows the same way.
  - Not investigated.
- **Unchanged failed:** W05 `short-catalog`, as in Run 5: `target_not_found` /
  `web.target.not_found`, `startCandidateIndex` 0.
- **The fixes behind the gains are not attributed row by row.** One piece of evidence:
  `l-stage2c`'s partial bench failed W01-W03 Flow with a wrong first action ("did not produce
  a web.dom.select action", "… web.dom.type …"). Here all three start at candidate 0 and pass,
  which is consistent with Core's `20bb3b4`. That is an inference.
- **`recordedActions`:** extension equals Core in all 24 rows that report it. The field is
  absent in 5 recording-lane rows (W04-W08), which publish no recording read.
- **`discardsAfterFirstRead`:** 0 in all 24 rows that report it; absent in the same 5.
- **Leaks:** no attestation finding, and 0 declared-value hits in all 29 bundles.

### The amendment's figures

**`startCandidateIndex` and `stoppedWithoutFailedAttempt`, from `snapshots/flow-lane.json`, for
every Flow-lane run in Runs 1-5:**

| Row | Runs with `flow-lane.json` | `startCandidateIndex` | `stoppedWithoutFailedAttempt` |
| --- | --- | --- | --- |
| W15 unarmed | run-mu023nye-7ecc83ab, run-mu0255k5-3732d289, run-mu026lbm-5cf3a77b | 0, 0, 0 | null, null, null |
| W15 `popup-blocked` | run-mu02821o-fbd5b092, run-mu029hml-7e9956d4, run-mu02awe1-e68098d8 | 0, 0, 0 | null, null, null |
| W28 | run-mu02cdso-4aabe05e, run-mu02du3y-2effd299, run-mu02f8sd-c93ba623 | 0, 0, 0 | null, null, null |
| W25 `too-slow` | run-mu02gkbf-f6f29849, run-mu02i2zp-e3078883, run-mu02jgi6-908234be | 0, 0, 0 | null, null, null |
| W17 `upload` | run-mu02kwj1-8104b227, run-mu02m85c-5fe53fd1, run-mu02njdn-a5df3a0f | 0, 0, 0 | null, null, null |
| W05 `short-catalog` | run-mu02pdt9-12b08666, run-mu02qoaq-a46890d3, run-mu02vd6b-046b01e6 (rerun) | 0, 0, 0 | null, null, null |

- **All 18 Flow runs above:** `startCandidateIndex` 0, and `stoppedWithoutFailedAttempt` null.
  W05 run 3 (`run-mu02s20h-2aa23cd7`) wrote no `flow-lane.json`: it failed at startup
  before any Flow.
- **The stopped bench's 17 Flow rows:** `startCandidateIndex` 0 in 13 and null in 4.
  `stoppedWithoutFailedAttempt` is null in all 17.
  - The null starts are W04's and W08's Flow rows above: no proposal, no Flow, no attempt.
  - The 13 are W01, W02, W03, W05 unarmed and `short-catalog`, W06 unarmed and `no-results`,
    W07, W09, W10 unarmed and `broken-link`, and W11 unarmed and `end-early`.

**`recording.persistence` failures, and whether their discards are runtime confirmations
(`i-leftover-sizing` item 7d).**
- **None occurred.** There is no `recording.persistence` error in the 20 bundles of Runs 1-5
  or in the stopped bench's 29. Every first and second discard read published
  `recordingDiscards=[]`. So there are no discards whose kinds could be reported.
- **The question is unanswered for a full week1 bench,** because Run 6 was dropped.
- **Even when one occurs, a bundle cannot show whether a discard was a runtime confirmation.**
  - The runner's `RecordingDiscard` carries only `type`, `entryId`, `recordingId`,
    `discardedActions`, `discardedEvents` and `sinceFinalizedMs`
    (`packages/test-runner/src/flow-lane/recording-discards.ts:13-20`, at `d639415`).
  - Core puts `eventType`, `inputId` and `executable` in the audit entry's metadata
    (`programs/automation-studio/client-gateway/bridge.ts:515-530`, at `3cb8976`). But the
    audit log lives only in memory: `ClientGatewayAuditLog.entries`
    (`client-gateway/service/audit-log.ts`), served through `snapshot()`.
  - `logs/core.log` holds 0 mentions of `discard`, `audit`, `runtimeConfirmation` or
    `recording_event` (checked in `run-mu023nye-7ecc83ab` and `run-mu02pdt9-12b08666`).
  - A kept workspace does not help either.

### Memory under concurrent load

- **Lowest free memory seen:** **7.55 GB**, at 10:41:43 (`l-stage2d-lab-mem.csv`, 181 samples
  from 09:56:34 to 10:41:43). That was the last sample, taken just after the bench stopped
  while other workers' Labs ran. The machine-wide Chrome and Node working set peaked at
  8.20 GB at the same time.
- **Before my own runs:** the lowest `freeGBBefore` in my 20 status lines was 13.40 GB
  (`w25-too-slow` run 2).
- No timing-only failure occurred in Runs 1-5. The one startup failure (W05 run 3) was rerun
  once, alone, and did not recur.

## Not verified

- **Run 6 was not completed.** It was stopped at 29 of 67 rows on the supervisor's amendment,
  so these were not done:
  - the row-by-row comparison with Stage 2's 37 of 67 and with `l-stage2c` runs 1-4;
  - naming the fix behind each change;
  - full-bench `recordedActions` and `discardsAfterFirstRead`;
  - item 7d on a full bench.
- **Single observations.** Every figure is a single observation except where three runs
  agree. In particular:
  - W05 run 1's `recordedActions` 3/4 and its 5 candidates;
  - W28's scroll timings;
  - the attribution of W05 run 3 to the environment, which rests on one rerun;
  - every row of the stopped bench.
- **Why W28 and W05 record a trailing page scroll** (frame 4 `y=29`, frame 0 `y=680`) was not
  measured. The debounced scroll listener is an inference from `i-w15-w28-flow-order`.
- **Which extra action Core held in W05 run 1:** no workspace was kept for that run.
- **The W17 search** reads live SQLite cells and every file byte. It does not reconstruct
  freed pages or superseded WAL frames (`i-leftover-sizing` item 2). A kept `-wal` could not
  be read together with its database in two of the three workspaces; each database opened
  alone.
- **The W04 and W08 regression** was not investigated.
- **Scope of the runs:** Chromium e2e build only; no Firefox run. `F:\fxlab\fxlab-7263534-load`
  was left at `69f40c1`, as the amendment requires.

## Open questions or contradictions found

1. **W04 and W08 Flow rows regressed since Stage 2.**
   - The failure is `recording.contract` ("Core produced no recording Flow proposal"), with 0
     recorded actions on both sides and 3 entries.
   - It appears in 4 rows of the stopped bench, and in W04's rows of `l-stage2c`'s partial
     bench.
   - Both scenarios' recording-lane rows pass, but publish no recording read.
   - It needs an investigation before Lab Stage 3's benches are read.
2. **W05 run 1: Core held one action more than the extension counted** (3 against 4). The
   runner's completeness check fails a run only when Core holds fewer, so this passed
   silently.
3. **Trailing scrolls become Flow nodes.** A page scroll recorded after the last click becomes
   the Flow's last node: W28 runs 1 and 2, W05's rerun, and W07 in the stopped bench. The
   nodes succeed, so no verdict changes. They are still actions the script never performed,
   which is `i-w15-w28-flow-order` Fix 4's conditional case. This run supplies its frames and
   positions.
4. **Item 7d cannot be decided from Lab evidence as the runner stands.** A discard's input id
   and confirmation flag stay in Core's memory-only audit log. Deciding it needs the runner to
   publish `metadata.inputId` and `eventType` kinds from the snapshot's audit entries.
5. **The brief's binding rules and this brief conflict.** "No `pnpm build` and no `pnpm lab`
   command in this dispatch" conflicts with this Lab-owner brief. I followed the Lab-owner
   brief and ran no `pnpm build`.
6. **The brief's W05 command needs a workflow.** It names only the variant; the corpus row
   needs `--workflow paginated-extraction`.
