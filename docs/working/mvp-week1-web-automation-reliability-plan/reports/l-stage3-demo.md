# l-stage3-demo — step 4, the provider-free demo (Lab owner)

Worker `l-stage3-demo`, 2026-09-13. Brief: `l-stage3` step 4, as changed by "Amendment to
`l-stage3` — three concurrent workers at the `l-stage2d` pins". Worktree
`F:\fxlab\fxlab-16ff729-step4`, moved to `d639415`; Core `F:\fxlab\!FluxIQ` at `3cb8976`, used
read-only. Runs under `F:\fxlab-runs\stage3\demo\`. Scratch files are named `l-stage3-demo-*`
in the session scratchpad. Times without `Z` are local (UTC−7); evidence and Core timestamps
ending in `Z` are UTC.

## Outcome

**Done: both demo commands exit 1. The failure reproduced in a fresh workspace (2 of 2).**

| Attempt | Runs dir | `demo:record` | `demo:run` |
| --- | --- | --- | --- |
| `a1` | `F:\fxlab-runs\stage3\demo\a1` | exit 1, 179.5 s | not started (driver rule at the time) |
| `a2` (the rerun) | `F:\fxlab-runs\stage3\demo\a2` | exit 1, 161.8 s | exit 1, 81.1 s |

- **`demo:record`, both attempts.** The only message is
  `EBUSY: resource busy or locked, rmdir '…\web-extension-demo\.s\<session>\c\a\w'`: the demo
  Core's session cleanup. That error replaces the recording lane's own error. The lane itself
  failed at the same point both times, after `record-stop` and before subflow generation. The
  evidence fits `waitForNewRecording` (10 s deadline) finding no finalized recording.
  - Core persisted one recording per attempt, and neither recording's `index.json` has an
    `endedAt` or `status` key.
  - `workspace.json` never received `latestRecordingId`.
- **`demo:run` (a2)** failed with its real message, the direct consequence:
  `{"status":"failed","message":"Demo workspace does not identify the recording that generated its Subflow"}`
  (`provisioning.ts:227`). Its playback path was never reached.
- **No provider was configured:** 0 of 24 provider variables set, no env file read, no
  `.env.local` in the worktree.
- **`.env.local` question answered:** the demo needs `FLUXIQ_TEST_USERNAME`,
  `FLUXIQ_TEST_PASSWORD` and `FLUXIQ_TEST_PIN`. With `FLUXIQ_TEST_ENV_FILES=none` they must be
  process variables. Any fresh values work for a fresh workspace, but `demo:record` and
  `demo:run` must share them. Details below.
- **Lowest free memory:** 4.83 GB, sampled at 10:48:29, during `a2`'s `demo:record`. Never
  under 3 GB, so no waits. The lowest pre-command reading was 9.13 GB.
- **Pins held throughout:** worktree `d639415`, Core `3cb8976`, pin proof `unpinned=0`. Core
  was checked intact after each attempt.

## What changed and why

- **Tracked files:** none edited in either repository. This report is the only file written in
  `F:\!FluxIQWebExtension`.
- **Worktree `F:\fxlab\fxlab-16ff729-step4`:**
  - the ten generated `apps/extension/build/` files were restored (the amendment's first step);
  - the worktree was moved from `16ff729` to `d639415`;
  - `domain/dist`, `packages/test-contracts/dist` and `apps/scenario-lab/dist` were rebuilt, as
    `l-stage2d` "Setup" did;
  - the demos' own extension build then rewrote the same ten tracked `apps/extension/build/`
    files. They are left modified (cause below).
- **Run directories:** `F:\fxlab-runs\stage3\demo\a1` and `a2`. Each keeps its demo workspace,
  logs, evidence bundle and one leftover Core session directory. Those session directories hold
  junctions into Core and were deliberately not deleted (open question 4).
- **Scratch files:**
  - `l-stage3-demo-setup.ps1` and `l-stage3-demo-setup-status.txt`;
  - `l-stage3-demo-pin-proof.mjs`, a copy of `l-stage2-pin-proof.mjs`, and its log;
  - `l-stage3-demo-driver.ps1` and the status files `l-stage3-demo-a1-status.txt` and
    `l-stage3-demo-a2-status.txt`;
  - `l-stage3-demo-mem.ps1` and `l-stage3-demo-mem.csv`;
  - `l-stage3-demo-keypaths.mjs`;
  - the build logs.

## Commands run and observed results

### Pre-checks

- **Modified tracked files before the move** (`git status --porcelain --untracked-files=no`,
  worktree at `16ff729`), paths only:
  - `apps/extension/build/background/index.js`, `.../background/index.js.map`
  - `apps/extension/build/content/index.js`, `.../content/index.js.map`
  - `apps/extension/build/page-world/index.js`, `.../page-world/index.js.map`
  - `apps/extension/build/popup/index.js`, `.../popup/index.js.map`
  - `apps/extension/build/sidepanel/index.js`, `.../sidepanel/index.js.map`

  All ten are generated output, with no untracked files, so the restore rule applied.
- **Restore:** `git -C F:\fxlab\fxlab-16ff729-step4 checkout -- apps/extension/build/` printed
  `restore exit=0`; porcelain count afterwards `0`.
- **Other processes at 10:37:** `node scripts/lab/run-lab.mjs "bench" "--corpus" "week1"
  "--repeat" "1" "--target" "isolated"`, with runner
  `F:\fxlab\fxlab-7263534\packages\test-runner\dist\cli.js` (`l-stage2d`'s worktree). Not
  touched. See open question 1.
- **Package files, `16ff729..d639415`:** `git diff --stat` over `pnpm-lock.yaml`,
  `package.json`, `pnpm-workspace.yaml` and `**/package.json` printed only
  `apps/extension/package.json | 2 +-` (the `test:content` script). The lockfile is unchanged
  and `node_modules` exists, so **no install**.
- **Demo scripts, `16ff729..d639415`:** `git diff --stat` over
  `scripts/record-demo-workspace.mjs`, `scripts/run-demo-workspace-flow.mjs` and `scripts/lab`
  printed nothing.

### Move

`git -C F:\fxlab\fxlab-16ff729-step4 checkout --detach d639415` printed
`HEAD is now at d639415 Regenerate the extension build and domain test build, and record the root gates and the leftover ranking`,
`move exit=0`. `rev-parse HEAD` gave `d6394155efb7eecb1815d1b496a283b26b506bae`, porcelain `0`.

### Setup

From `l-stage3-demo-setup-status.txt` (`pnpm -C F:\fxlab\fxlab-16ff729-step4 --filter <package> build`):

```
start 2026-09-13T10:38:06 freeKB=12179940
wt HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0
core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain(tracked)=0
build wt @fluxiq-web-extension/domain exit=-2147483645 seconds=1.9
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=2.0
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=3.7
wt dist domain\dist MISSING
wt dist packages\test-contracts\dist newest 2026-09-13T10:38:10 files=36
wt dist apps\scenario-lab\dist newest 2026-09-13T10:38:13 files=166
wt porcelain after=0
```

- **The domain build crashed once; single observation, rerun clean.**
  - The log shows `clean-dist: removed 0 emitted file(s) from dist`, then a V8 fatal crash from
    `node.exe` during `tsc`: `Stacktrace:` with `ptr1`…`ptr6` and `failure_message_object`, and
    no compiler diagnostic.
  - It ended with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` and `Exit status 2147483651` (0x80000003).
  - That is the non-diagnostic crash shape the faulty-RAM rule names.
- **Domain rerun, alone,** with `freeKB before rerun=12333344`:
  - printed `domain rerun exit=0 seconds=2.7` and
    `domain\dist newest 2026-09-13T10:39:14 files=273`, porcelain `0`;
  - `l-stage2d` reported `files=274` for its worktree; not investigated.
- **Core, read-only checks before any demo:**
  - `F:\fxlab\!FluxIQ\apps\web\package.json` and `apps\web\node_modules` present (the demo's
    `requirePaths`, `core-process.ts:33-36`);
  - `packages\fluxiq\dist\index.js` present, tracked porcelain `0`;
  - the worktree's `domain\node_modules\fluxiq` junction targets `F:\fxlab\!FluxIQ\packages\fluxiq\`.

### The pin proof, before any demo command

`node --experimental-import-meta-resolve l-stage3-demo-pin-proof.mjs F:\fxlab\fxlab-16ff729-step4`
printed nine probes, each `pinned=true` into `F:\fxlab\!FluxIQ\packages\...\dist` (domain,
extension and test-runner each resolving `fluxiq`, `fluxiq/automation-studio` and, where probed,
`@fluxiq/client-gateway-websocket`; test-contracts resolving `@fluxiq/contracts`), then:

```
import(fluxiq/automation-studio) from packages/test-runner: F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js exports=385
runner Core root (cli.ts:21 default): F:\fxlab\!FluxIQ -> real F:\fxlab\!FluxIQ
unpinned=0
pin-proof exit=0
```

### What the demo needs in a worktree (the open `.env.local` question)

Read at `d639415`:
- **Three credentials are required.** `resolveDemoWorkspaceConfiguration` requires
  `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD` and `FLUXIQ_TEST_PIN`
  (`packages/test-runner/src/demo-workspace/configuration.ts:50-52`).
  - Both scripts load them through `loadTestEnvironment` (`scripts/record-demo-workspace.mjs:7-8`,
    `scripts/run-demo-workspace-flow.mjs:7-8`).
  - With `FLUXIQ_TEST_ENV_FILES=none` no file is read (`target-config.ts:170-175`). So in a
    worktree without `.env.local` they must be process variables, or the demo throws
    `FLUXIQ_TEST_USERNAME is required and must be a single line`.
- **Fresh values work for a fresh workspace, but both commands must share them.** The demo Core
  creates its identity from the configured values on first use and afterwards authenticates with
  them (`core-process.ts:111-143`). `pnpm demo:setup-local` writes such values into `.env.local`
  (`scripts/setup-demo-local-env.mjs:21-23,47-49`); it was not run.
- **Everything else has a default:**
  - web origin `http://127.0.0.1:3300` and gateway `ws://127.0.0.1:4877/client`
    (`configuration.ts:37-38`), fixed ports;
  - workspace `<FLUXIQ_TEST_RUNS_DIR>/web-extension-demo` (`:29-30`);
  - Core root `<root>/../!FluxIQ` (`:35`), here `F:\fxlab\!FluxIQ`;
  - **headless `true`** unless `FLUXIQ_DEMO_HEADLESS` is set (`:60`). The brief names no headed
    requirement for the demo, so the default was kept.
- **No provider on the baseline lanes:**
  - `recordDemoWorkspace` and `runDemoWorkspaceFlow` (`workspace-lanes.ts:34-123`) call no LLM
    code;
  - a case-insensitive grep of `provisioning.ts` for `llm|provider|deepseek|model` found nothing;
  - the Core process and both browsers get `withoutProviderSecrets(process.env)`
    (`environment.ts:23-25,59`; `browser-session.ts:54,63`);
  - subflow generation is the panel's "Generate deterministic Subflow" dialog
    (`provisioning.ts:184-190`).
- **`EXTENSION_TEST_BUILD_LABEL`** is read only by `apps/extension/scripts/test-extension.mjs:23`,
  so it does not redirect the demo's extension build. It was set anyway, per the binding rules.

### How the demo runs

- **Driver** `l-stage3-demo-driver.ps1 -RunsDir <dir> -Tag <tag>`: one process for both
  commands, refused on a second start by a `CreateNew` lock file. It:
  - removes every provider variable `environment.ts:13-18` lists, and every optional
    `FLUXIQ_DEMO_*`/`FLUXIQ_*` override;
  - sets `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_RUNS_DIR=<dir>` and
    `EXTENSION_TEST_BUILD_LABEL=l-stage3-demo`;
  - generates the three credentials in its own memory, in the shape `setup-demo-local-env.mjs`
    uses. They are never printed, logged or written by the driver, and are removed from its
    environment at the end;
  - reads free memory before each command, waiting in 120 s steps while under 3 GB;
  - runs `pnpm -C F:\fxlab\fxlab-16ff729-step4 <demo:record|demo:run> *> <log>` and records
    `exit=$LASTEXITCODE`, never through a pipe.
  - **For `a1`**, it did not start `demo:run` after a failed `demo:record`. **For `a2`**, it was
    changed to run `demo:run` regardless, so its own exit is observed. After each command it also
    logs `workspace.json`'s key names and the count of leftover session directories.
- **Memory** `l-stage3-demo-mem.ps1` sampled free memory every 15 s (46 samples, 10:40:27 to
  10:51:45).
- **The FluxIQ web panel was not started.** Each demo command starts its own self-managed Core
  (`next dev` in the session workspace, `core-process.ts:82-94`) and stops it in its `finally`,
  as a Lab run does.
- **`otherLabs`** in the status lines counts processes, not instances: each Lab has a `cmd.exe`
  wrapper, a `run-lab.mjs` node and a runner `cli.js`.

### Attempt `a1` — `F:\fxlab-runs\stage3\demo\a1`

`l-stage3-demo-a1-status.txt`:

```
2026-09-13T10:40:37 tag=a1 runsDir=F:\fxlab-runs\stage3\demo\a1 envNames=EXTENSION_TEST_BUILD_LABEL,FLUXIQ_TEST_ENV_FILES,FLUXIQ_TEST_PASSWORD,FLUXIQ_TEST_PIN,FLUXIQ_TEST_RUNS_DIR,FLUXIQ_TEST_USERNAME providerVarsSet=0
wt HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0 envLocal=False
core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain(tracked)=0
listenersOn3300or4877=0
2026-09-13T10:40:38 before demo:record freeKB=9129844
2026-09-13T10:40:38 start demo:record otherLabs=8 log=F:\fxlab-runs\stage3\demo\a1\l-stage3-demo-a1-demo-record.log
2026-09-13T10:43:38 end demo:record exit=1 seconds=179.5 freeKBafter=9654260
demo:record failed; demo:run not started
wt porcelain after=10
core porcelain(tracked) after=0
```

- **Build chain passed.** `demo:record` runs `node scripts/record-demo-workspace.mjs` only
  after `&&`, and it ran.
  - The extension build printed its ten bundle sizes. The `node.exe :` / `NativeCommandError`
    block before them is PowerShell wrapping an empty stderr line.
  - The `test-runner...` build printed `domain build: clean-dist: removed 273 emitted file(s) from dist`
    and `packages/test-runner build: Done`.
- **The command's only message** (log lines 61-62):
  `{"status":"failed","message":"EBUSY: resource busy or locked, rmdir 'F:\\fxlab-runs\\stage3\\demo\\a1\\web-extension-demo\\.s\\916ff5549d31\\c\\a\\w'"}`,
  then `ELIFECYCLE  Command failed with exit code 1.`
- **Evidence bundle** `web-extension-demo\evidence\demo-record-2026-09-13T17-41-58-733Z-b250dd`:
  - `summary.json`: `"verdict": "failed"`, `eventCount` 131, `screenshotCount` 100,
    `startedAt` 17:41:58.733Z, `finishedAt` 17:43:24.678Z.
  - `review/timeline.json`: the last two events are sequence 130, `record-stop` `step.start`,
    at 17:43:12.145Z, and sequence 131, `record-stop` `step.complete`, at 17:43:13.810Z.
    `record-start` and `submit-form` precede them.
  - The bundle was finalized 10.9 s after `record-stop` completed. The next call in the lane is
    `waitForNewRecording` (`workspace-lanes.ts:61`), a 10 s deadline polling `listRecordings`
    every 100 ms (`control-waits.ts:28-42`).
- **Core's log** `logs\run-2026-09-13T17-41-02-244Z-06616b71-core.log`:
  - 14 `POST /api/programs/automation-studio/list-recordings 200`, the last two taking 1178 ms
    and 1203 ms;
  - then `[exit] code=1 signal=null` when the supervisor stopped it;
  - no request to `review-recording-flow-proposal`, so subflow generation never started.
- **`workspace.json`** was last written at 17:42:53.930Z (keys: `schemaVersion`, `origin`,
  `username`, `projectId`, `flowId`, `subflowId`, `graphFlowId`, `routerId`, `projectName`,
  `flowName`, `updatedAt`). There is no `latestRecordingId`, so the final save
  (`workspace-lanes.ts:63-64`) was never reached.
- **Persisted recording** `recordings\client.extension-9f6ed733-8f04-449f-b5b9-124943fcb0f1.1789321387077`,
  10 files. Its `index.json` key paths (`l-stage3-demo-keypaths.mjs`, names only):
  - top level: `schemaVersion`, `projectId`, `recordingId`;
  - `summary.{startedAt,eventCount,actionCount,stateSnapshotCount,proposalCount,updatedAt}`;
  - `timeline.{timelineRef,firstEntryId,lastEntryId}`;
  - 29 `entries`, 5 `actions` and 8 `states.web.snapshot`.

  **No `endedAt` and no `status` key anywhere.** `completedAt` appears only on individual action
  entries.

### Attempt `a2`, the rerun — `F:\fxlab-runs\stage3\demo\a2`

`l-stage3-demo-a2-status.txt`:

```
2026-09-13T10:46:10 tag=a2 runsDir=F:\fxlab-runs\stage3\demo\a2 envNames=EXTENSION_TEST_BUILD_LABEL,FLUXIQ_TEST_ENV_FILES,FLUXIQ_TEST_PASSWORD,FLUXIQ_TEST_PIN,FLUXIQ_TEST_RUNS_DIR,FLUXIQ_TEST_USERNAME providerVarsSet=0
wt HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=10 envLocal=False
core HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain(tracked)=0
listenersOn3300or4877=0
2026-09-13T10:46:11 before demo:record freeKB=13769908
2026-09-13T10:46:11 start demo:record otherLabs=6 log=F:\fxlab-runs\stage3\demo\a2\l-stage3-demo-a2-demo-record.log
2026-09-13T10:48:53 end demo:record exit=1 seconds=161.8 freeKBafter=15310812
after demo:record workspace.json keys=schemaVersion,origin,username,projectId,flowId,subflowId,graphFlowId,routerId,projectName,flowName,updatedAt hasLatestRecordingId=False hasLatestRuntimeRunId=False
after demo:record leftover session dirs=1
demo:record exited non-zero; demo:run still runs so its own exit is observed
2026-09-13T10:48:53 before demo:run freeKB=15308092
2026-09-13T10:48:53 start demo:run otherLabs=6 log=F:\fxlab-runs\stage3\demo\a2\l-stage3-demo-a2-demo-run.log
2026-09-13T10:50:14 end demo:run exit=1 seconds=81.1 freeKBafter=12371516
after demo:run workspace.json keys=schemaVersion,origin,username,projectId,flowId,subflowId,graphFlowId,routerId,projectName,flowName,updatedAt hasLatestRecordingId=False hasLatestRuntimeRunId=False
after demo:run leftover session dirs=1
wt porcelain after=10
core porcelain(tracked) after=0
```

`porcelain=10` at the start is the ten `apps/extension/build/` files `a1`'s build rewrote.

- **`demo:record` log tail:**
  `{"status":"failed","message":"EBUSY: resource busy or locked, rmdir 'F:\\fxlab-runs\\stage3\\demo\\a2\\web-extension-demo\\.s\\d1d5d748e63b\\c\\a\\w'"}`,
  then `ELIFECYCLE  Command failed with exit code 1.`
- **`demo:run` log tail:**
  `{"status":"failed","message":"Demo workspace does not identify the recording that generated its Subflow"}`,
  then `ELIFECYCLE  Command failed with exit code 1.` Its session cleanup did not fail.
- **Evidence:** `demo-record-2026-09-13T17-47-20-650Z-c63b32` `verdict=failed`,
  started 17:47:20.650Z, finished 17:48:50.053Z, `events=133`. `demo:run` failed in
  `requireDemoFlow` before opening a browser, so it wrote no evidence bundle.
- **Core logs:**
  - `run-2026-09-13T17-46-39-664Z-f354758a-core.log` (record): 158 lines, 15 `list-recordings`,
    last `[exit] code=1 signal=null`. Its route counts match `a1`'s in shape, and again there is
    no `review-recording-flow-proposal`.
  - `run-2026-09-13T17-49-23-742Z-e5f2916b-core.log` (run): 31 lines, 0 `list-recordings`.
- **Persisted recording** `client.extension-8888e848-72cd-42ba-a1fa-c1cf64073050.1789321714448`:
  the same key paths as `a1`, with 21 `entries`, 4 `actions` and 5 snapshots. **No `endedAt` and
  no `status` key.**

### After each attempt

- **Processes and ports:** no process referenced `F:\fxlab-runs\stage3\demo`,
  `record-demo-workspace`, `run-demo-workspace` or `--port 3300`, and nothing listened on 3300 or
  4877 (both checks returned `0`).
- **Core intact, checked after `a1` and again after `a2`:**
  - `packages\contracts\dist` 36 files, `packages\fluxiq\dist` 1976, and
    `packages\client-gateway-websocket\dist` 20 (the counts `l-stage2d` recorded);
  - `apps\web\node_modules` present, and `.bin\next.cmd` present (checked after `a1`);
  - tracked porcelain `0`, `git ls-files --deleted` count `0`, HEAD `3cb8976`.
- **Leftover session directories:** `a1\web-extension-demo\.s\916ff5549d31` and
  `a2\web-extension-demo\.s\d1d5d748e63b`.
  - A walk of `a1`'s, without following reparse points, found 208 directories, 3486 files and
    **17 junctions into `F:\fxlab\!FluxIQ`**. Examples:
    `c\a\w\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\` and
    `c\a\w\node_modules\next -> F:\fxlab\!FluxIQ\node_modules\.pnpm\next@15.5.23_…`.
  - `a2`'s was not walked.
- **Worktree `apps/extension/build/`:** the demos' extension build rewrote the ten paths listed
  under "Pre-checks".
  - The five `.js` files differ only in line endings: git warns "LF will be replaced by CRLF",
    and `git diff --stat` lists no change for them.
  - The five `.js.map` files differ by one line each.
  - Cause, counted on `background/index.js.map`: this worktree has `core.autocrlf=true`, so
    sources are checked out with CRLF and embedded that way. The rebuilt map has 12234 escaped
    CRLF and 0 bare LF; the committed map has 1468 escaped CRLF and 10766 bare LF.
  - Neither map contains `fxlab-16ff729-step4` or `!FluxIQWebExtension`.
  - The files were left modified, and would mark a later Lab run in this worktree `dirty: true`.

### Free memory

- **Readings before commands (KB):**
  - 12660916 at the pre-check;
  - 12179940 at setup;
  - 12333344 before the domain rerun;
  - 9129844 before `a1` `demo:record`;
  - 13769908 before `a2` `demo:record`;
  - 15308092 before `a2` `demo:run`.
- **The sampler's lowest reading was 4.83 GB at 10:48:29.** Every sample under 6 GB:
  - `10:43:13 freeGB=5.94` and `10:43:28 freeGB=5.63` (`a1`, around `record-stop`'s completion
    at 17:43:13.810Z);
  - `10:48:29 freeGB=4.83` and `10:48:44 freeGB=5.83` (`a2`, before its lane failed at
    17:48:50.053Z).
- Chrome plus node working set was 10.3–11.2 GB in those samples, including the other workers'
  benches.
- **Never under 3 GB, so no waits.** The rerun started at 13.77 GB, but free memory did not stay
  above 6 GB throughout: it dipped to 4.83 GB in the same window as `a1`'s dip.

## Not verified

- **The recording lane's own error message.** It was hidden both times by the cleanup `EBUSY`.
  That the lane failed in `waitForNewRecording` is an inference from timing, evidence and state;
  the message was not observed.
- **Where Core records that a recording has ended**, and what `listRecordings` reports for these
  two recordings. Only the recordings' `index.json` files were inspected; SQLite
  (`global.sqlite`) was not read. So "not finalized" is not proven.
- **Whether the demo passes without concurrent load.** Both attempts ran beside other Lab
  instances (`otherLabs=8` and `6` processes), and Core answered `list-recordings` in about
  1.2 s. A single quiet run was not possible under this dispatch.
- **Whether the failure predates `d639415`/`3cb8976`.** No demo run at an older pin was made.
- **`demo:run`'s playback path** (panel run, action attempts). It was never reached.
- **Headed mode:** both attempts ran headless, the demo default.
- **`a2`'s leftover session directory** was not walked for junctions; `a1`'s was.
- **No leak or redaction check** ran: the baseline demo lanes call none, and the brief asks for
  none.
- **No Lab (`pnpm lab`) command** was run; the brief's step 4 is the demo only.

## Open questions or contradictions found

1. **`l-stage2d` was running a bench.** At 10:37 a `bench --corpus week1 --repeat 1` was running
   from `F:\fxlab\fxlab-7263534`, although "Amendment to `l-stage2d`", second amendment, says to
   skip Run 6, the bench. Observed only; not touched.
2. **The demo's session cleanup hides the lane's real failure, every time here.** Read at
   `d639415`, not changed (no tracked file is owned):
   - `withPersistentDemoCore` removes the session in a `finally` with
     `rm(sessionDirectory, { recursive: true, force: true })` and no `maxRetries`
     (`core-process.ts:100-107`). An error there replaces the lane's own error.
   - On Windows the Core child is started under a shell (`core-process.ts:87`). Cleanup runs
     `taskkill /pid <shell> /T /F`, then waits up to 2 s for that shell to exit
     (`process-supervisor.ts:97-111`). It does not wait for the tree's file handles to be
     released before the `rm`.
   - Elsewhere the runner retries a removal: `secret-leak-attestation.ts:102` uses
     `maxRetries: 5, retryDelay: 100`.
   - `i-lab-campaign` Part 2, item 8, found persisting `web-extension-demo/.s/*/c/packages`
     junction directories in the main tree's `test-runs`, which suggests earlier demo cleanups
     failed the same way. Not re-verified.
   - A fix belongs to `test-runner` (`demo-workspace/core-process.ts`): keep the lane's error,
     and retry or wait before the removal. Until then no `demo:record` failure on Windows reports
     its cause.
3. **The demo recording is not finalized for the lane (2 of 2).**
   - Both persisted recordings lack any end marker in `index.json`.
   - `waitForNewRecording` allows 10 s (`control-waits.ts:29`), and Core took about 1.2 s per
     `list-recordings` under the concurrent benches.
   - Two readings remain open: a slow finalize that a longer wait would catch, or a recording
     stop that never reaches Core's finalize.
   - The recording-start changes settled this session (`f-recording-start-send`,
     `f-recording-start-guard`, `g-core-start-order`) touch this path, but no link was
     established.
   - This blocks the Phase 1.6b demo check (`i-lab-campaign` criterion 6: "both exit 0,
     provider-free").
4. **Leftover session directories hold junctions into the pinned Core.** A recursive delete that
   follows reparse points (Windows PowerShell 5.1 `Remove-Item -Recurse` is one) would delete
   files in `F:\fxlab\!FluxIQ`. `a1\web-extension-demo\.s\916ff5549d31` has 17 such junctions;
   `a2\web-extension-demo\.s\d1d5d748e63b` has the same shape, not walked. Remove each junction
   non-recursively first, as `i-lab-campaign` Part 2, item 8, describes.
5. **A demo in a worktree dirties the tracked `apps/extension/build/`** through CRLF checkout
   (`core.autocrlf=true`). The bytes differ from the commit only by line endings in the embedded
   sources, but `git status` and any run manifest will call the tree dirty.
