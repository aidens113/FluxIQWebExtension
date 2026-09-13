# l-stage2c — W18, W19 and W25 three times each, then the week1 bench once

Worker report for `l-stage2c` in the twenty-seventh dispatch of
[finish-week1.md](../briefs/finish-week1.md). Written 2026-09-13, local time
(UTC-7) unless marked `Z`. This machine has faulty RAM: every figure is a single
observation unless it says otherwise.

- **Pins.** This repository `69f40c1` (`69f40c120732ed2ed9b85fd21412cdb7769c886a`);
  Core `6621d66` (`6621d6646b206ce5f06099098a27766794195479`), `fluxiq` 0.4.0.
- **Evidence rules.** No declared secret, uploaded file content or name, token or
  recorded page data is printed, hashed or partially quoted here. Every figure is a
  path, a key path, a kind or a count.

**Status: in progress.** Run 1 is complete. Sections below are written as each run
finishes.

## Outcome

Written at the end.

## What changed and why

No tracked file in either repository was edited. Created:

- **Worktrees moved in place,** each with `git checkout --detach`:
  - `F:\fxlab\!FluxIQ`: `5845f5d` to `6621d66`;
  - `F:\fxlab\fxlab-7263534`, the measured worktree: `6c22e22` to `69f40c1`;
  - `F:\fxlab\fxlab-7263534-load`: `6c22e22` to `69f40c1`. It is moved but not built,
    and no run used it: this brief runs one instance at a time.

  The directory names still read `7263534`.
- **Run directories** under `F:\fxlab-runs\stage2c\`, and kept Core workspaces under
  `F:\fxlab-runs\stage2c\kept\`.
- **Scratch files,** all prefixed `l-stage2c-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`.

## Commands run and observed results

### Pre-checks

- `git rev-parse 69f40c1` and `git -C F:\!FluxIQ rev-parse 6621d66` returned the
  full ids above.
- **No install.** `git diff --stat 6c22e22 69f40c1 -- pnpm-lock.yaml '**/package.json' package.json pnpm-workspace.yaml`
  printed nothing. Core's `git diff --stat 5845f5d 6621d66` over its lockfile, root
  `package.json`, workspace file and the four packages' `package.json` printed
  nothing. Its `diff --stat` over `packages/{contracts,client-gateway-websocket}/src`
  and `apps/web` printed nothing too: both new Core commits are in `packages/fluxiq`.
- **Commits since Stage 2's pin.** `git log --oneline 6c22e22..69f40c1` lists 19;
  `git log --oneline 5845f5d..6621d66` lists `240c73e`, `949fbb4` and `6621d66`.
- **Before setup:** no process command line matched `run-lab.mjs`,
  `test-runner\dist\cli.js`, `next dev`, `fxlab`, `package:lint`, `vitest` or `tsc`.
  No `FLUXIQ_*` variable was set. `FreeGB 15.51 TotalGB 25.85`. Neither Stage 2
  worktree had a `.lab-locks` entry.

### Setup

From `l-stage2c-setup-status.txt`:

```
core-checkout exit=0
wt-checkout exit=0
load-checkout exit=0
F:\fxlab\!FluxIQ HEAD=6621d6646b206ce5f06099098a27766794195479 porcelain=0
F:\fxlab\fxlab-7263534 HEAD=69f40c120732ed2ed9b85fd21412cdb7769c886a porcelain=0
F:\fxlab\fxlab-7263534-load HEAD=69f40c120732ed2ed9b85fd21412cdb7769c886a porcelain=0
build core @fluxiq/contracts exit=0 seconds=1.6
build core fluxiq exit=0 seconds=6.9
build core @fluxiq/client-gateway-websocket exit=0 seconds=1.5
fluxiq version: 0.4.0
core dist newest contracts 2026-09-13T07:28:27
core dist newest fluxiq 2026-09-13T07:28:34
core dist newest client-gateway-websocket 2026-09-13T07:28:36
core porcelain=0
build wt @fluxiq-web-extension/domain exit=0 seconds=2.7
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=1.4
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=2.3
wt dist newest domain\dist 2026-09-13T07:28:38 files=274
wt dist newest packages\test-contracts\dist 2026-09-13T07:28:40 files=36
wt dist newest apps\scenario-lab\dist 2026-09-13T07:28:42 files=166
wt porcelain=0
```

- **Core** was built with `pnpm -C F:\fxlab\!FluxIQ --filter <package> build`, one
  package at a time: `@fluxiq/contracts`, `fluxiq`, `@fluxiq/client-gateway-websocket`.
  Each is `tsc -b tsconfig.build.json --clean && tsc -b …`. `@fluxiq/web` was not
  built, as in Stages 1 and 2. The first build did not fail, so no rerun was needed.
- **The three shared builds** were `pnpm -C F:\fxlab\fxlab-7263534 --filter <package> build`
  for `@fluxiq-web-extension/domain`, `@fluxiq-web-extension/test-contracts` and
  `@fluxiq-web-extension/scenario-lab`, in that order. **All three exited 0.**

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs F:\fxlab\fxlab-7263534`
(Stage 1's script, unchanged) printed `exit=0`:

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
import(fluxiq/automation-studio) from packages/test-runner: F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js exports=384
runner Core root (cli.ts:21 default): F:\fxlab\!FluxIQ -> real F:\fxlab\!FluxIQ
unpinned=0
```

The worktree's junctions point into Core's worktree, for example
`domain\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]` and
`packages\test-contracts\node_modules\@fluxiq\contracts -> F:\fxlab\!FluxIQ\packages\contracts\ [Junction]`.

### How the campaign runs

- **Driver** `l-stage2c-lab-seq.ps1`, derived from Stage 2's. It runs a plan file
  serially as `pnpm -C F:\fxlab\fxlab-7263534 lab <args> *> <log>`, and writes
  `exit=$LASTEXITCODE` to `l-stage2c-<label>-status.txt`, never through a pipe.
- **Environment on every Lab command:**
  - `FLUXIQ_TEST_ENV_FILES=none`;
  - `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` equal to the label;
  - `FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage2c\<a|a1r|b|…>`.

  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` is set from the worktree's
  `auth-gate/constants.ts` only for auth-gate runs and the bench, and removed after
  each run. It is supplied on both lanes, as in Stage 2; each attestation below
  reports `literalCount` 1.
- **One instance at a time.** Each status line records `otherLabsBefore`, the count
  of `run-lab.mjs` processes outside the worktree; it read 0 on every run so far.
  The FluxIQ web panel was not started.
- **Bundle reader** `l-stage2c-analyse.mjs`. For every run it prints `run.json`,
  `evaluation.json`, `snapshots/flow-lane.json`, `snapshots/redaction-attestation.json`
  and the `runtime.settle` and `error` events. It also counts the declared values in
  every bundle file:
  - auth-gate's password;
  - `sensitive-input`'s two replaced literals;
  - W17's upload name, content and base64 content.
- **Memory:** `l-stage2c-mem.ps1` every 15 s to `l-stage2c-lab-mem.csv`.

### How Core's workspace was kept, with no change to the runner

`i-secret-in-workspace` kept a workspace by editing `coordinator.ts`, which made
every run `dirty=true`. This brief forbids a tracked edit, so the workspace is kept
from outside the runner instead.

- **`l-stage2c-keep.mjs`** starts before a `keep=1` run and stops after it. It
  hard-links every file of `<runsDir>\.work\<runId>\fluxiq-root` into
  `F:\fxlab-runs\stage2c\kept\<runId>\fluxiq-root`, without following reparse points.
  - A hard link names the same file on the same volume. A file Core changes in place
    is kept as changed, and the runner's removal of the run directory leaves the kept
    name standing.
  - While Core runs it sweeps every 1000 ms. A path whose file identity changed (a
    rename over it) is relinked, and the earlier link moves to `<runId>\versions\`.
- **When the final copy is taken.** The runner stops Core (`run-scenario.ts:435`),
  copies the process logs into `<runsDir>\.staging-<runId>\logs` (`:440`,
  `copyProcessLogs`, the only writer of `logs/`), and removes the run directory only
  after `finalize` (`:506`). The keeper polls for that `logs\*.log` every 50 ms, takes
  one final sweep, and leaves the run alone.
- **Self-test** (`l-stage2c-selftest.mjs`, a synthetic run holding no declared value):
  - a file changed in place was kept as changed;
  - a file renamed over was kept at its newest version, with the earlier one under
    `versions`;
  - a file deleted during the run was kept;
  - a file written only just before the marker was kept;
  - `linkErrors=0`, `keptByMethod={"link":…}`.
- **What the kept runs show.** Every W18 keeper wrote `reason=core-stopped-final-sweep`,
  with `copies=0 linkErrors=0 reparse=0`. Final-sweep file counts are 43 on the Flow
  lane and 32 on the recording lane. They equal the attestation's workspace
  `scannedFiles` in every run below.

### How a kept workspace is searched

`l-stage2c-search.mjs <root> <worktree> auth auth-gate <tmp>`, run under
`node --experimental-sqlite`.

- **Every file, byte for byte.** It counts the value as UTF-8 and UTF-16LE, and
  JSON-escaped where that differs. For W17 it also counts base64 content. JSON files
  report key paths.
- **Every SQLite database, cell by cell,** on a copy. Every table in `sqlite_schema`
  is read with `SELECT *` and `setReadBigInts(true)`.
- **A control needle,** `/scenarios/auth-gate/`, is counted the same way. It shows
  the search reaches the files and SQLite cells where a page-derived value sits.
- **Self-test:** the control was found in every planted file and in 3 SQLite cells,
  including a row with an integer past 2^53. The declared value was found 0 times.

**A finding about kept `-wal` files, and the fix.** The first search opened each
database together with its kept `-wal`.
- One `project.sqlite` and one `global.sqlite` would not open (`ERR_SQLITE_ERROR`),
  and one `objects` table would not read.
- `l-stage2c-sqlite-probe.mjs` copied each three ways. Alone, all three opened with
  `integrity_check` `["ok"]` and every table read (583, 583 and 31 rows). With the
  kept `-wal`, each gave `database disk image is malformed`.
- The keeper's manifest lists those `-wal` files as not present at the final sweep:
  Core had checkpointed and deleted them at close. The kept link held the deleted
  log, and the database alone is the state Core left.
- The search now reads each database once per mode that exists: alone, with its
  `-wal`, with its `-journal`. A database is unreadable only if no mode opens. The
  raw byte count still covers every `-wal`, `-shm` and `-journal` byte.

### Run 1 — `auth-gate` primary (W18), both lanes, ×3, workspace kept

Plan `l-stage2c-plan-1.txt`, label `l-stage2c-a`, runs dir `F:\fxlab-runs\stage2c\a`.
Two runs crashed in the faulty-RAM shape and were rerun once, alone
(`l-stage2c-plan-1r.txt`, label `l-stage2c-a1r`, runs dir `F:\fxlab-runs\stage2c\a1r`).

**Status lines**, shortened:

```
name=w18-flow index=1 seconds=66.2 exit=0 otherLabsBefore=0 freeGBBefore=15.63 secretSupplied=True keep=True keeperExit=0
name=w18-flow index=2 seconds=69.0 exit=0 otherLabsBefore=0 freeGBBefore=15.58 secretSupplied=True keep=True keeperExit=0
name=w18-flow index=3 seconds=4.9 exit=1 otherLabsBefore=0 freeGBBefore=15.55 secretSupplied=True keep=True keeperExit=0
name=w18-rec index=1 seconds=16.0 exit=-1073741819 otherLabsBefore=0 freeGBBefore=15.53 secretSupplied=True keep=True keeperExit=0
name=w18-rec index=2 seconds=56.6 exit=0 otherLabsBefore=0 freeGBBefore=15.55 secretSupplied=True keep=True keeperExit=0
name=w18-rec index=3 seconds=55.7 exit=0 otherLabsBefore=0 freeGBBefore=15.54 secretSupplied=True keep=True keeperExit=0
name=w18-flow-rerun index=1 seconds=64.6 exit=0 otherLabsBefore=0 freeGBBefore=15.56 secretSupplied=True keep=True keeperExit=0
name=w18-rec-rerun index=1 seconds=55.4 exit=0 otherLabsBefore=0 freeGBBefore=15.54 secretSupplied=True keep=True keeperExit=0
```

**The two crashes are the faulty-RAM shape, not runs.**
- **`w18-flow` 3** died in the Lab's build phase, before any run:
  `@fluxiq-web-extension/extension build` (`tsc -p tsconfig.json --noEmit && …`)
  printed `ELIFECYCLE Command failed with exit code 3221225477`. The Lab then
  printed `{"status":"failed","category":"environment.missing","message":"pnpm --filter @fluxiq-web-extension/extension test:e2e:build exited with 3221225477"}`.
- **`w18-rec` 1** died after the build, right after the `{"lab":"paths",…}` line,
  with `ELIFECYCLE Command failed with exit code 3221225477`. It wrote no bundle and
  no run directory; its keeper found no run (`keeper stopped runs=0`).
- **Both reruns, alone, exited 0.** The six measured runs are Flow runs 1, 2 and
  rerun, and recording runs 2, 3 and rerun.

**The six measured runs.** Every `run.json` records facility `69f40c1…` `dirty=false`
and Core `F:\fxlab\!FluxIQ` `6621d66…` `dirty=false`, with `redactionState=verified`.

| Lane, run | runId | Verdict | candidateCount | Flow actions | Attestation (status, literalCount, findingCount, workspace scannedFiles) | recordedActions ext/Core | entryCount | discardsAfterFirstRead | Bundle declared-value hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flow 1 | run-mtzx45ar-164370cb | passed | 3 | `web.dom.type:succeeded`, `web.dom.type:succeeded`, `web.dom.click:succeeded` | passed, 1, 0, 43 | 3/3 | 24 | 0 | 0 of 19 files |
| Flow 2 | run-mtzx5ky9-731bfc8f | passed | 3 | the same | passed, 1, 0, 43 | 3/3 | 24 | 0 | 0 of 19 |
| Flow rerun | run-mtzxbkxn-f3d27ced | passed | 3 | the same | passed, 1, 0, 43 | 3/3 | 24 | 0 | 0 of 19 |
| Recording 2 | run-mtzx7kfj-2553c557 | passed | — | — (probe: `web.browser.navigate`, `web.dom.type`) | passed, 1, 0, 32 | 3/3 | 24 | 0 | 0 of 18 |
| Recording 3 | run-mtzx8syh-e61c19b0 | passed | — | the same probe | passed, 1, 0, 32 | 3/3 | 24 | 0 | 0 of 18 |
| Recording rerun | run-mtzxczj2-042ed78b | passed | — | the same probe | passed, 1, 0, 32 | 3/3 | 24 | 0 | 0 of 18 |

- **The attestation**, quoted from Flow 1:
  `{"status":"passed","literalCount":1,"scopes":[{"name":"bundle","scannedFiles":4,"scannedBytes":15495,"skippedBinaryFiles":5},{"name":"workspace","scannedFiles":43,"scannedBytes":1983339,"skippedBinaryFiles":0}],"findingCount":0,"advisories":[]}`.
  In all six runs `findings=[]`, so there is **no `unscanned-store` finding**, and
  workspace `skippedBinaryFiles` is 0. Stage 2 skipped 2 or 3 binary files here.
- **Every Flow run:** `status=succeeded`, `extractionCount=0`,
  `extractionExpectation="not_applicable"`, `harnessActivations=0`. Each action
  carries `comparisonStatus: "matched"`. Stage 2's `The Flow produced 0 extraction result(s), expected 1`
  is gone.
- **The dispatch event** names the secret by id only:
  `{"variantId":null,"declaredSecrets":["auth-gate-password"],…}`.
- **Discard windows.**
  - First read: `from` set, action `thisRunsRecording 0 / noRecording 2 / anotherRecording 0`,
    events all 0, `recordingDiscards=[]`.
  - Second read, Flow lane: action `3/2/0`, `discardsAfterFirstRead=0`,
    `snapshotFetches=1`.
  - Second read, recording lane: action `0/2/0`, `discardsAfterFirstRead=0`.
- **`runtime.settle`,** every run:
  `recordedEvents={"web.page.navigated":1,"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.dom.mutated":2,"web.tab.state_changed":1}`,
  `extensionConnectionAfterStop="connected"`.

**The password node reports `web.dom.type:succeeded`, in 3 of 3 Flow runs.**
`l-stage2c-password-node.mjs` reads the kept workspace. It prints ids, kinds,
statuses, and for each command parameter only its type, whether it equals the
declared value, and whether it is a withheld marker.
- **Flow 1: the node that asks for the secret is the recorded password control.** A
  runtime event chunk holds `$.events[0].parameters.text.$state.path`, the binding to
  `web.secret.password`. Its holder is `$.type="action" $.actionType="web.dom.type"`,
  `$.parameters.element.id="password"`,
  `$.parameters.element.attributes.type="password"`,
  `$.metadata.inputId="web.user.text_entered"` and `$.id="entry.7"`.
- **In each of the three Flow runs,** Core's `runtime/command-attempts` holds three
  attempts, each `status=succeeded kind=execute_action`: one `web.dom.click` and two
  `web.dom.type`.
  - In exactly one `web.dom.type` attempt the `text` parameter is a withheld marker
    (`withheldMarker=true`, `equalsDeclared=false`, `holdsDeclared=false`). That is
    the password node, and it `succeeded`.
  - The other `web.dom.type` attempt's `text` is not withheld; that is the username.
  - Password attempts: `attempt.943565f7-…` (Flow 1), `attempt.eba4d2c5-…` (Flow 2),
    `attempt.4242acc5-…` (Flow rerun).
  - Stage 2's `i-secret-in-workspace` found the resolved value at
    `$.attempt.command.parameters.text`; at this pin that key holds the withheld
    marker.

**A search of each kept workspace, SQLite included, finds the declared value 0 times.**
`l-stage2c-search.mjs … auth auth-gate`, over `fluxiq-root` (the final workspace) and
`versions` (earlier versions of renamed files):

| runId | Final-sweep files | Files scanned (root, versions) | SQLite databases read, by mode | Declared value: files, UTF-8, UTF-16LE, SQLite cells | Control: files, SQLite cells |
| --- | --- | --- | --- | --- | --- |
| run-mtzx45ar-164370cb (Flow 1) | 43 | 46, 23 | 3 of 3 alone; `project.sqlite` with its kept `-wal`: malformed | 0, 0, 0, 0 (root); 0, 0, 0, 0 (versions) | 25, 9 |
| run-mtzx5ky9-731bfc8f (Flow 2) | 43 | 45, 28 | 3 of 3 alone; `project.sqlite` with `-wal` read except table `objects` | 0, 0, 0, 0; 0, 0, 0, 0 | 25, 9 |
| run-mtzxbkxn-f3d27ced (Flow rerun) | 43 | 45, 14 | 3 of 3 alone; `global.sqlite` with `-wal`: malformed | 0, 0, 0, 0; 0, 0, 0, 0 | 25, 9 |
| run-mtzx7kfj-2553c557 (Recording 2) | 32 | 36, 27 | 2 of 2 alone; `project.sqlite` with `-wal` read; `global.sqlite` with `-wal`: malformed | 0, 0, 0, 0; 0, 0, 0, 0 | 21, 4 |
| run-mtzx8syh-e61c19b0 (Recording 3) | 32 | 37, 23 | 2 of 2 alone, 2 with `-wal`, `global.sqlite` with `-journal` (0 tables) | 0, 0, 0, 0; 0, 0, 0, 0 | 21, 4 |
| run-mtzxczj2-042ed78b (Recording rerun) | 32 | 36, 21 | 2 of 2 alone; `project.sqlite` with `-wal` read; `global.sqlite` with `-wal`: malformed | 0, 0, 0, 0; 0, 0, 0, 0 | 21, 4 |

- **The databases read** are `.fluxiq\global.sqlite`,
  `.fluxiq\artifacts\automation-studio\projects\<project>\project.sqlite` (73 or 75
  tables, 2896–3410 cells alone), and on the Flow lane
  `…\projects\<project>\runtime\sqlite\global.sqlite` (3 tables, 55 cells).
- `sqliteDatabasesUnreadable=0` in every workspace. `reparsePointsSkipped=0`.
- `i-secret-in-workspace`'s Flow-lane run held the value in 13 JSON objects and 4
  SQLite rows at `5845f5d`; these hold it in none.

**Run 1 result: no leak count is above 0, so the stop rule does not apply.** W18 passed
3 of 3 on each lane.

### Run 2 — `auth-gate` `expired` (W19), both lanes, ×3

Plan `l-stage2c-plan-2.txt`, label `l-stage2c-b`, runs dir `F:\fxlab-runs\stage2c\b`,
auth-gate secret supplied, workspace not kept.

```
name=w19-flow index=1 seconds=74.2 exit=0 otherLabsBefore=0 freeGBBefore=15.56 args=run auth-gate --flow --variant expired --target isolated
name=w19-flow index=2 seconds=71.2 exit=0 otherLabsBefore=0 freeGBBefore=15.55
name=w19-flow index=3 seconds=73.5 exit=0 otherLabsBefore=0 freeGBBefore=15.53
name=w19-rec index=1 seconds=16.8 exit=1 otherLabsBefore=0 freeGBBefore=15.52 args=run auth-gate --variant expired --target isolated
name=w19-rec index=2 seconds=16.6 exit=1 otherLabsBefore=0 freeGBBefore=15.49
name=w19-rec index=3 seconds=17.1 exit=1 otherLabsBefore=0 freeGBBefore=15.51
```

**The recording lane cannot run a variant at this pin, by design.** Each of the three
recording-lane commands built, printed its `{"lab":"paths",…}` line, then:
`{"status":"failed","category":"unknown","message":"--variant requires --flow: a variant is armed only before a Flow run"}`.
- The rule is `packages/test-runner/src/commands.ts:42`:
  `if (variant.variantId && !flowLane) throw new Error("--variant requires --flow: …")`.
- The week1 corpus agrees: W19 is `variantOnly("W19", "auth-gate", null, ["expired"])`
  (`bench/corpus/week1.ts:48`), and "the Flow lane [is] the only lane that arms one".
- It is not the faulty-RAM shape: the same message, from the command parser, in 3 of 3.
  No bundle was written, so nothing was rerun. W19's recording lane is the unarmed
  auth-gate recording, which run 1 measured 3 of 3.

**The Flow lane, 3 of 3 as the manifest expects.** The manifest's `expired` variant
(`auth-gate/manifest.ts:66-84`) expects `web.dom.type` succeeded, `web.dom.click`
failed, and `failure: { category: "auth_required" }`.

| Run | runId | Runner verdict | candidateCount | Flow actions, with `comparisonStatus` | Reported / expected failure | Attestation | recordedActions | discardsAfterFirstRead | Bundle hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzxfnhb-fd678874 | passed | 3 | `web.dom.type:succeeded` matched, `web.dom.type:succeeded` matched, `web.dom.click:failed` **blocked** | `auth_required` / `web.auth.required`; expected `auth_required` | passed, literalCount 1, findingCount 0 | 3/3 | 0 | 0 of 19 |
| 2 | run-mtzxh8cc-c3246fd3 | passed | 3 | the same | the same | passed, 1, 0 | 3/3 | 0 | 0 of 19 |
| 3 | run-mtzxircc-174413d1 | passed | 3 | the same | the same | passed, 1, 0 | 3/3 | 0 | 0 of 19 |

- Every `run.json`: facility `69f40c1…` `dirty=false`, Core `6621d66…` `dirty=false`,
  `redactionState=verified`, `automationFailure={"category":"auth_required","code":"web.auth.required"}`.
- Every `evaluation.json`:
  `verdict=passed oracleVerdict=passed reportedVerdict=failed lane=flow variant=expired flowCreated=true`.
- `flow-lane.json`: `status=failed`, `extractionCount=0`, `harnessActivations=2`. The
  click's failure, the same in all three:
  `{"category":"auth_required","code":"web.auth.required","retryable":false,"stage":"confirmation","expected":"the page URL is /scenarios/auth-gate/account","actual":"the page is not at the URL the Flow claimed; the document is a sign-in gate, so the session has probably expired"}`.
- **`comparisonStatus` `blocked` is published now.** Each action in `flow-lane.json`
  carries `comparisonStatus`; the click's is `blocked` in 3 of 3. Stage 2 found
  `comparisonStatus` in 0 of 3 bundles.
- Attestation workspace `scannedFiles=43`, `skippedBinaryFiles=0`, `findings=[]`, so no
  `unscanned-store`. Stage 2 failed all three runs on `security.redaction` with 13
  findings.
- Discard windows: first read action `0/2/0`; second read action `3/2/0`,
  `discardsAfterFirstRead=0`, `snapshotFetches=1`. No `excluded: null`.

**Run 2 result:** W19 `expired` passed 3 of 3 on the Flow lane with `auth_required`. The
recording lane refuses `--variant` without `--flow`.

### Run 3 — `delayed-ui` (W25), Flow lane, unarmed ×3 and `too-slow` ×3

Plan `l-stage2c-plan-3.txt`, label `l-stage2c-c`, runs dir `F:\fxlab-runs\stage2c\c`, no
secret.

```
name=w25 index=1 seconds=64.7 exit=0 otherLabsBefore=0 freeGBBefore=15.55 args=run delayed-ui --flow --target isolated
name=w25 index=2 seconds=62.4 exit=0 otherLabsBefore=0 freeGBBefore=15.54
name=w25 index=3 seconds=60.1 exit=0 otherLabsBefore=0 freeGBBefore=15.52
name=w25-too-slow index=1 seconds=66.3 exit=1 otherLabsBefore=0 freeGBBefore=15.52 args=run delayed-ui --flow --variant too-slow --target isolated
name=w25-too-slow index=2 seconds=66.2 exit=1 otherLabsBefore=0 freeGBBefore=15.52
name=w25-too-slow index=3 seconds=64.8 exit=1 otherLabsBefore=0 freeGBBefore=15.52
```

Every `run.json`: facility `69f40c1…` `dirty=false`, Core `6621d66…` `dirty=false`,
`redactionState=not_applicable`. The attestation reads `status "not-applicable"`,
`literalCount 0`: `delayed-ui` declares no secret. Every bundle has 0 declared-value
hits (18 or 19 files).

| Row, run | runId | Exit, verdict | candidateCount | Flow actions: status, `comparisonStatus` | Reported failure | recordedActions | entryCount | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W25 1 | run-mtzxm4uj-8cbecf0d | 0, passed | **3** | `web.dom.click` succeeded matched; `web.dom.wait_for_selector` succeeded matched; `web.dom.click` succeeded matched | none | 2/2 | 8 | 0 |
| W25 2 | run-mtzxnix3-7f9922ff | 0, passed | 3 | the same | none | 2/2 | 8 | 0 |
| W25 3 | run-mtzxov12-38eac4fb | 0, passed | 3 | the same | none | 2/2 | 8 | 0 |
| too-slow 1 | run-mtzxq5v4-064e7668 | 1, failed | 3 | `web.dom.click` succeeded matched; **`web.dom.wait_for_selector` failed**, `timeout` | `{"category":"timeout","code":"output_dispatch.timed_out","retryable":true}` | 2/2 | 8 | 0 |
| too-slow 2 | run-mtzxrkqt-9301043c | 1, failed | 3 | the same | the same | 2/2 | 8 | 0 |
| too-slow 3 | run-mtzxszv3-4f0f23db | 1, failed | 3 | the same | the same | 2/2 | 8 | 0 |

**W25 unarmed: 3 of 3 as the brief expects.**
- `candidateCount` 3, and click, wait, click are all `succeeded`.
- `flow-lane.json` `status=succeeded`, `harnessActivations=0`.
- `evaluation.json` `verdict=passed oracleVerdict=passed reportedVerdict=passed`.
- Stage 2 had `candidateCount` 2 and no wait node in 3 of 3.

**W25 `too-slow`: 3 of 3 as the brief words its check, but the runner fails each run on
the failure code.**
- **As the brief words it:** the reported category is `timeout` and the wait is
  `failed`, in 3 of 3. Stage 2 reported `target_not_found` on the second click.
- **Why the runner fails it:** `evaluation.json`
  `reported={"category":"timeout","code":"output_dispatch.timed_out"} expected={"category":"timeout","code":"web.action.timeout"}`,
  `failed invariant runner-verdict: expected="passed" actual="failed: runtime.behavior"`.
  The error event:
  `#13 error: The Flow reported failure code output_dispatch.timed_out, expected web.action.timeout`.
- **Where each code comes from.**
  - The manifest's variant expects
    `failure: { category: "timeout", code: "web.action.timeout" }`
    (`apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:49-51`), and its test pins
    that code (`delayed-ui/tests/scenario.test.ts:27`).
  - `web.action.timeout` is the domain's action timeout
    (`domain/src/runtime/failure/codes.ts:46,131`).
  - The code reported is Core's own dispatch deadline:
    `programs/automation-studio/runtime/io-policy.ts:142`,
    `if (status === "timed_out") return coreFailure("timeout", "output_dispatch.timed_out", true)`,
    read in `F:\fxlab\!FluxIQ` at `6621d66`.
  - So in each run Core timed out the dispatch before the extension reported its own
    action timeout. Inference from the codes; the timings were not measured.
- `flow-lane.json` `status=failed`, `harnessActivations=2`; the wait's failure is
  `{"category":"timeout","code":"output_dispatch.timed_out","retryable":true}`, and the
  second click was never attempted.
- Not the faulty-RAM shape: full-length runs, a concrete assertion diff, identical in 3 of 3.

**Recording and discards, all six runs:** `recordedActions={"extension":2,"core":2}`,
`recordedEvents={"web.element.clicked":2,"web.dom.mutated":1,"web.tab.state_changed":1}`,
`entryCount` 8, `extensionConnectionAfterStop="connected"`.
- First read: all 0. `delayed-ui` has no CSS `type` step, so the Core probe does not run.
- Second read: action `2/0/0` (unarmed) or `1/0/0` (`too-slow`).
- `discardsAfterFirstRead=0`.

### Run 4 — W15 unarmed and `popup-blocked`, W17, W28, Flow lane, ×3 each

Plan `l-stage2c-plan-4.txt`, label `l-stage2c-d`, runs dir `F:\fxlab-runs\stage2c\d`, no
secret. W17's workspace kept.

```
name=w15 index=1 seconds=65.1 exit=1 otherLabsBefore=0 freeGBBefore=15.49 args=run multi-tab --flow --target isolated
name=w15 index=2 seconds=71.2 exit=1 otherLabsBefore=0 freeGBBefore=15.43
name=w15 index=3 seconds=69.5 exit=1 otherLabsBefore=0 freeGBBefore=15.45
name=w15-popup-blocked index=1 seconds=68.2 exit=1 otherLabsBefore=0 freeGBBefore=15.47 args=run multi-tab --flow --variant popup-blocked --target isolated
name=w15-popup-blocked index=2 seconds=72.8 exit=1 otherLabsBefore=0 freeGBBefore=15.41
name=w15-popup-blocked index=3 seconds=72.9 exit=1 otherLabsBefore=0 freeGBBefore=13.94
name=w17 index=1 seconds=60.3 exit=0 otherLabsBefore=0 freeGBBefore=13.70 args=run file-transfer --flow --workflow upload --target isolated keep=True keeperExit=0
name=w17 index=2 seconds=67.7 exit=0 otherLabsBefore=0 freeGBBefore=13.72 keep=True keeperExit=0
name=w17 index=3 seconds=62.8 exit=0 otherLabsBefore=0 freeGBBefore=12.53 keep=True keeperExit=0
name=w28 index=1 seconds=64.0 exit=0 otherLabsBefore=0 freeGBBefore=12.90 args=run iframe-checkout --flow --target isolated
name=w28 index=2 seconds=58.8 exit=1 otherLabsBefore=0 freeGBBefore=12.65
name=w28 index=3 seconds=64.0 exit=0 otherLabsBefore=0 freeGBBefore=14.09
```

Every `run.json` in this plan: facility `69f40c1…` `dirty=false`, Core `6621d66…`
`dirty=false`, `redactionState=not_applicable`. Attestation `not-applicable`,
`literalCount 0`. Every bundle: 0 declared-value hits (17–19 files, including W17's
upload name, content and base64 content). Every run: `discardsAfterFirstRead=0`,
`recordedActions` extension equal to Core, `extensionConnectionAfterStop="connected"`.

#### W15 `multi-tab`: the tab actions do not succeed, 6 of 6

| Row, run | runId | Exit, verdict | candidateCount | Flow actions: status, `comparisonStatus` | Reported / expected failure | recordedActions | entryCount |
| --- | --- | --- | --- | --- | --- | --- | --- |
| unarmed 1 | run-mtzxuy31-ba766e08 | 1, failed | 5 | `web.browser.tab` failed, `timeout` | `timeout` / `output_dispatch.timed_out`; expected none | 5/5 | 25 |
| unarmed 2 | run-mtzxwcb1-2ad0760c | 1, failed | 5 | the same | the same | 5/5 | 25 |
| unarmed 3 | run-mtzxxve8-148c0e5e | 1, failed | 5 | the same | the same | 5/5 | 25 |
| `popup-blocked` 1 | run-mtzxzcuz-69ae231e | 1, failed | 5 | the same | `timeout` / `output_dispatch.timed_out`; expected `output_not_observed` | 5/5 | 25 |
| `popup-blocked` 2 | run-mtzy0usq-cdb7ab26 | 1, failed | 5 | the same | the same | 5/5 | 25 |
| `popup-blocked` 3 | run-mtzy2gki-a48692c8 | 1, failed | 5 | the same | the same | 5/5 | 25 |

- **The Flow's first node, `web.browser.tab`, times out at Core's dispatch deadline,
  and nothing after it runs.**
  - `flow-lane.json`: `status=failed`, `harnessActivations=2`, and one action,
    `web.browser.tab` with `{"category":"timeout","code":"output_dispatch.timed_out","retryable":true}`.
  - `run.json` `automationFailure={"category":"timeout","code":"output_dispatch.timed_out"}`.
- **Errors.**
  - Unarmed: `#23 error: The Flow reported an unexpected timeout failure`
    (`runtime.behavior`).
  - `popup-blocked`: `#23 error: The Flow reported failure category timeout, expected output_not_observed`.
- **The recording is complete.** `recordedActions={"extension":5,"core":5}`,
  `recordedEvents={"web.element.clicked":2,"web.tab.state_changed":4}`, `entryCount`
  25. Both discard reads excluded nothing (all 0).
- **Neither log names the action.** `logs/core.log` (2928 bytes) and
  `logs/scenario-lab.log` hold no line matching `web.browser.tab`, `timed_out` or
  `tab.(switch|close|select)`. `events.ndjson` does not name it either.
- **Against the brief:** "the tab actions succeed": **0 of 3.** "`popup-blocked` still
  reports `output_not_observed`": **0 of 3**; it reports `timeout`.
- **Compared with Stage 2's bench:** W15 unarmed flow failed `target_not_found`, and
  `popup-blocked` failed with `web.dom.click:failed` and `output_not_observed`. At this
  pin the Flow records a tab step (`857513e`, `1316533`), and that step times out
  before any click.
- **Faulty RAM: rerun once, alone, and the timeout did not reproduce, but the tab action
  failed again.**
  - Plan `l-stage2c-plan-4r.txt`, label `l-stage2c-d4r`, runs dir
    `F:\fxlab-runs\stage2c\d4r`:
    `name=w15-rerun index=1 seconds=68.9 exit=1 otherLabsBefore=0 freeGBBefore=13.93`,
    bundle `run-mtzye7ll-de4dba98`.
  - The first node, `web.browser.tab`, failed as
    `{"category":"blocked_by_capability_or_policy","code":"web.action.rejected","retryable":false,"stage":"execution","expected":"a tab to close","actual":"no tab named and none open"}`,
    with `comparisonStatus` `blocked`. Nothing after it ran.
  - `#23 error: The Flow reported an unexpected blocked_by_capability_or_policy failure`.
    `recordedActions` 5/5, `entryCount` 26, `candidateCount` 5.
  - **So the Flow's first node is a tab close naming no tab.** In 6 of 7 runs Core's
    dispatch deadline expired on it. In the one rerun the extension answered and
    rejected it, because no tab was open to close. The rejected form is a single
    observation.
  - Why the proposal puts a close with no tab first was not investigated.
- **A launch anomaly, with no second instance.** My one command started the driver
  twice, at 08:12:46 and 08:13:37. The second start could not open the log the first
  held (`The process cannot access the file … because it is being used by another process`),
  ran nothing (`seconds=0.1 exit=`), and wrote its own `finished=` line. The first
  start's run had `otherLabsBefore=0`. The bench launch afterwards refused to start
  while any `run-lab.mjs` or driver process existed.

#### W17 `file-transfer` `upload`: upload then click, 3 of 3

| Run | runId | Exit, verdict | candidateCount | Flow actions: status, `comparisonStatus` | recordedActions | entryCount | Keeper |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzy3za6-7177301b | 0, passed | 2 | `web.dom.upload` succeeded matched; `web.dom.click` succeeded matched | 2/2 | 10 | final sweep, 30 files, `linkErrors=0` |
| 2 | run-mtzy5d3l-cee50b3c | 0, passed | 2 | the same | 2/2 | 10 | final sweep, 30 files, `linkErrors=0` |
| 3 | run-mtzy6re3-74dc8001 | 0, passed | 2 | the same | 2/2 | 10 | final sweep, 30 files, `linkErrors=0` |

- **`web.dom.upload` succeeds, then `web.dom.click` succeeds, with no `web.dom.type`,**
  in 3 of 3. `evaluation.json`
  `verdict=passed oracleVerdict=passed reportedVerdict=passed workflow=upload`, and
  `actions=["web.dom.upload:","web.dom.click:"]`.
- `recordedEvents={"web.form.submitted":1,"web.element.clicked":1,"web.dom.mutated":2,"web.element.changed":1,"web.tab.state_changed":1}`.
  Second discard read: action `2/0/0`.
- **The kept workspace search** (`l-stage2c-search.mjs … upload file-transfer`).
  Needles:
  - the manifest's `UPLOAD_NAME`;
  - the content from the worktree's built `deterministicUploadBytes(UPLOAD_NAME)`, as
    text, JSON-escaped and base64;
  - the content's first line on its own.

| runId | Files scanned (root, versions) | SQLite databases, by mode | Content: files, cells | Content first line: files, cells | **Name: files, occurrences, cells** | Control: files, cells |
| --- | --- | --- | --- | --- | --- | --- |
| run-mtzy3za6-7177301b | 32, 12 | 3 of 3 alone; `global.sqlite` with its kept `-wal`: table `automation.state` unreadable | 0, 0 | 0, 0 | **1, 2 (UTF-8), 0** | 14, 6 |
| run-mtzy5d3l-cee50b3c | 34, 20 | 3 of 3 alone; `project.sqlite` with `-wal` read; `global.sqlite` with `-wal`: malformed | 0, 0 | 0, 0 | **1, 2, 0** | 13, 6 |
| run-mtzy6re3-74dc8001 | 34, 20 | 3 of 3 alone; `project.sqlite` and `global.sqlite` with `-wal`: malformed | 0, 0 | 0, 0 | **1, 2, 0** | 14, 6 |

- **The supplied file's content: 0 times, 3 of 3,** in any form, in any file, SQLite
  cell or earlier version.
- **The supplied file's name: found, 2 times per run, in one file each.**
  - The file is Core's saved command attempt for the upload:
    `.fluxiq\artifacts\runtime\command-attempts\attempt.<id>\attempt.json`, 30541 bytes.
    The attempts are `attempt.50b8dd36-…`, `attempt.3511c51d-…` and `attempt.a5b2bcd2-…`.
  - Key paths: `$.attempt.result.payload.result.validation.expected` and
    `$.attempt.result.payload.result.validation.actual`.
  - In all three runs that attempt's `command.actionType` is `web.dom.upload`,
    `status=succeeded`, `validation.status=passed`. In run 1 its command parameter keys
    are `selector,upload,element,visualTarget,browserFrameId,target`. Each run's other
    attempt is `web.dom.click` (30965 bytes), whose validation holds no name.
  - So the name is written by the upload's output confirmation, comparing the file the
    control holds, not by the recording, and not in any SQLite cell.
- **Against the brief:** content 0 in 3 of 3; **name 0 in 0 of 3**.

#### W28 `iframe-checkout`: both frame clicks succeed in 2 of 3

| Run | runId | Exit, verdict | candidateCount | Flow actions: status, `comparisonStatus` | Reported failure | recordedActions | recordedEvents |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzy83q6-5a9b03ae | 0, passed | 3 | `web.dom.click` succeeded matched; `web.dom.click` succeeded matched; `web.dom.scroll` succeeded matched | none | 3/3 | `web.dom.mutated` 1, `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |
| 2 | run-mtzy9h6r-08713546 | 1, failed | **4** | `web.dom.scroll` succeeded matched, and nothing else | `ambiguous_or_unknown` | **4/4** | `web.scroll.changed` **2**, `web.dom.mutated` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |
| 3 | run-mtzyaqil-a6e2979d | 0, passed | 3 | the same as run 1 | none | 3/3 | `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |

- **Runs 1 and 3:** `evaluation.json` `verdict=passed oracleVerdict=passed reportedVerdict=passed`,
  `harnessActivations=0`.
- **The start-page load.** Every Flow run loads the scenario's start page in
  `prepareFlowPage` (`run-scenario.ts:338-351`, `openScenarioStart`) before the Flow is
  dispatched. A failed load would fail the run before dispatch. No bundle event names
  the load, so "after the start-page load" rests on that code path and on the Flow
  having run.
- **Run 2 is a real failure, not the faulty-RAM shape.** It recorded one scroll more:
  4 actions against 3, and 2 `web.scroll.changed` against 1.
  - Its Flow has 4 candidates, ran one `web.dom.scroll` to `succeeded`, then stopped
    with `flow-lane.json` `status=failed`, `failure=null`, `harnessActivations=1`, and
    `run.json` `automationFailure={"category":"ambiguous_or_unknown"}`.
  - The runner's error:
    `#11 error: The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.scroll:succeeded`
    (`action.dispatch`).
  - Why the node after the scroll did not run was not investigated. A single observation.
- **Against the brief:** "both frame clicks succeed after the start-page load": **2 of 3.**

### Duplicate Run 4 section, withdrawn by one of two agents running this brief

A second agent ran this brief at the same time as this one after the supervisor's
restart. Both wrote a Run 4 section; the one above stands. What follows was this
agent's, kept only for the facts the one above lacks.

**The interruption.** The supervisor's session restarted while this plan ran, and my
session was stopped mid-plan. The sequencer (PowerShell PID 22316, started 07:57:48)
kept running.
- On resuming at 08:04:57 I confirmed it and its W17 keeper (node PID 8500) were
  alive, launched nothing, and waited.
- The plan wrote `finished=2026-09-13T08:11:09`, and PID 22316 had exited when checked.
- No run overlapped another: every status line reads `otherLabsBefore=0`.

```
name=w15 index=1 seconds=65.1 exit=1 otherLabsBefore=0 freeGBBefore=15.49 args=run multi-tab --flow --target isolated
name=w15 index=2 seconds=71.2 exit=1 otherLabsBefore=0 freeGBBefore=15.43
name=w15 index=3 seconds=69.5 exit=1 otherLabsBefore=0 freeGBBefore=15.45
name=w15-popup-blocked index=1 seconds=68.2 exit=1 otherLabsBefore=0 freeGBBefore=15.47 args=run multi-tab --flow --variant popup-blocked --target isolated
name=w15-popup-blocked index=2 seconds=72.8 exit=1 otherLabsBefore=0 freeGBBefore=15.41
name=w15-popup-blocked index=3 seconds=72.9 exit=1 otherLabsBefore=0 freeGBBefore=13.94
name=w17 index=1 seconds=60.3 exit=0 otherLabsBefore=0 freeGBBefore=13.70 args=run file-transfer --flow --workflow upload --target isolated keep=True keeperExit=0
name=w17 index=2 seconds=67.7 exit=0 otherLabsBefore=0 freeGBBefore=13.72 keep=True keeperExit=0
name=w17 index=3 seconds=62.8 exit=0 otherLabsBefore=0 freeGBBefore=12.53 keep=True keeperExit=0
name=w28 index=1 seconds=64.0 exit=0 otherLabsBefore=0 freeGBBefore=12.90 args=run iframe-checkout --flow --target isolated
name=w28 index=2 seconds=58.8 exit=1 otherLabsBefore=0 freeGBBefore=12.65
name=w28 index=3 seconds=64.0 exit=0 otherLabsBefore=0 freeGBBefore=14.09
```

Every `run.json` in this plan records facility `69f40c1…` `dirty=false` and Core
`6621d66…` `dirty=false`, with `redactionState=not_applicable`: none of these scenarios
declares a secret. Every bundle has 0 declared-value hits, including W17's upload name,
content and base64 content.

#### W15 (`multi-tab`)

<!-- l-stage2c: W15 is written after its reruns. -->

#### W17 (`file-transfer`, workflow `upload`): 3 of 3, workspace kept

| Run | runId | Verdict | candidateCount | Flow actions, `comparisonStatus` | recordedActions | entryCount | discardsAfterFirstRead |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzy3za6-7177301b | passed | 2 | `web.dom.upload:succeeded` matched, `web.dom.click:succeeded` matched | 2/2 | 10 | 0 |
| 2 | run-mtzy5d3l-cee50b3c | passed | 2 | the same | 2/2 | 10 | 0 |
| 3 | run-mtzy6re3-74dc8001 | passed | 2 | the same | 2/2 | 10 | 0 |

- **`web.dom.upload` succeeds, then `web.dom.click` succeeds, with no `web.dom.type`,
  in 3 of 3.** `evaluation.json` `actions=["web.dom.upload","web.dom.click"]`,
  `verdict=passed oracleVerdict=passed reportedVerdict=passed workflow=upload`.
- Dispatch event `{"variantId":null,"declaredSecrets":[],…}`.
- `recordedEvents={"web.form.submitted":1,"web.element.clicked":1,"web.dom.mutated":2,"web.element.changed":1,"web.tab.state_changed":1}`.
- Discard windows: first read all 0; second read action `2/0/0`.
- Stage 2's W17 Flow row failed `output_not_observed`.

**Core's workspace, kept and searched.** Keeper manifests: `reason=core-stopped-final-sweep`,
30 files at the final sweep, `copies=0 linkErrors=0 reparse=0`. The search is
`l-stage2c-search.mjs … upload file-transfer`. Its needles are:
- the manifest's `UPLOAD_NAME`;
- the file content from `deterministicUploadBytes(UPLOAD_NAME)` (the runner's own
  function, imported from the worktree's built `trusted-input/upload-file.js`), as
  text, JSON-escaped and base64;
- the content's first line;
- the control `/scenarios/file-transfer/`.

| runId | Files scanned (root, versions) | SQLite databases read alone | Upload content (every form): files, SQLite cells | Content first line | **Upload name**: files, occurrences, SQLite cells | Control: files, cells |
| --- | --- | --- | --- | --- | --- | --- |
| run-mtzy3za6-7177301b | 32, 12 | 3 of 3 | 0, 0 | 0 | **1 file, 2 (UTF-8), 0 cells** | 14, 6 |
| run-mtzy5d3l-cee50b3c | 34, 20 | 3 of 3 | 0, 0 | 0 | **1 file, 2, 0 cells** | 13, 6 |
| run-mtzy6re3-74dc8001 | 34, 20 | 3 of 3 | 0, 0 | 0 | **1 file, 2, 0 cells** | 14, 6 |

- **The supplied file's content: 0 times in 3 of 3,** in every file, every earlier
  version and every SQLite cell.
- **The supplied file's name: not 0.** It sits in exactly one file per run, twice. In
  `versions` and in every SQLite cell it appears 0 times.
  - The file is the upload's runtime command attempt:
    `.fluxiq\artifacts\runtime\command-attempts\attempt.50b8dd36-…\attempt.json` (run 1),
    `attempt.3511c51d-…` (run 2), `attempt.a5b2bcd2-…` (run 3).
  - Each is `status=succeeded`, `command.kind=execute_action`,
    `actionType=web.dom.upload`.
  - The key paths are `$.attempt.result.payload.result.validation.expected` and
    `$.attempt.result.payload.result.validation.actual`. Both are 20-character strings,
    beside `validation.status="passed"`. This is the upload's output confirmation: the
    expected and observed file name of the control.
  - `$.attempt.command.parameters` has keys
    `selector, upload, element, visualTarget, browserFrameId, target`. Its `upload` is
    86 characters with the single key `files`, and holds neither the content nor the
    name.
- **So the name reaches Core's persisted workspace through the extension's
  confirmation result, not through the command's parameters.** `b274fb4` pins that a
  chosen file records no name, and that holds for the recording (0 hits in every
  recording object and SQLite cell). The action result's validation is a separate
  route. The supervisor decides whether a file name is sensitive here.

#### W28 (`iframe-checkout`): 2 of 3

| Run | runId | Exit, verdict | candidateCount | Flow actions, `comparisonStatus` | Reported failure | recordedActions | entryCount | Recorded events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzy83q6-5a9b03ae | 0, passed | 3 | `web.dom.click:succeeded` matched, `web.dom.click:succeeded` matched, `web.dom.scroll:succeeded` matched | none | 3/3 | 10 | `web.dom.mutated` 1, `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |
| 2 | run-mtzy9h6r-08713546 | 1, failed | **4** | `web.dom.scroll:succeeded` matched, then nothing | `{"category":"ambiguous_or_unknown"}` | 4/4 | 12 | **`web.scroll.changed` 2**, `web.dom.mutated` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |
| 3 | run-mtzyaqil-a6e2979d | 0, passed | 3 | the same as run 1 | none | 3/3 | 9 | `web.scroll.changed` 1, `web.element.clicked` 2, `web.tab.state_changed` 1 |

- **Both frame clicks succeed in runs 1 and 3.** The recording script clicks
  `frame:Same-origin checkout/testid:same-frame-action`, then
  `frame:Cross-origin checkout/testid:cross-frame-action`
  (`iframe-checkout/scenario.ts:17-18`).
  - The Flow's two `web.dom.click` nodes both `succeeded`, followed by a
    `web.dom.scroll` that also succeeded.
  - `evaluation.json` `verdict=passed oracleVerdict=passed`.
  - Stage 2's W28 Flow row failed `target_not_found`.
- **Run 2 recorded a second scroll, and its Flow began with it.**
  - Its recording held 2 `web.scroll.changed` events and 4 actions, so the proposal
    had 4 candidates.
  - The Flow ran `web.dom.scroll` (`succeeded`), then stopped: `flow-lane.json`
    `status=failed`, `failure=null`, `harnessActivations=1`, with no action record
    after the scroll.
  - The runner's error:
    `#11 error: The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.scroll:succeeded`
    (`action.dispatch`), reported `{"category":"ambiguous_or_unknown"}`.
  - `logs/core.log` (3086 bytes) holds no line matching
    `ambiguous|timed_out|web.browser.tab|failed`.
  - **A single observation, and not rerun.** It is a partial failure with a real
    difference: a different recording, 12 entries against 9–10. That is not the
    faulty-RAM shape.
- **"After the start-page load."** The bundle has no separate event for it. The runner
  loads the scenario's start page before every Flow run in `prepareFlowPage`
  (`run-scenario.ts:338-350`: arm, then `openScenarioStart`, then the armed facts). No
  run failed that step, which would have ended the run before the Flow.

<!-- l-stage2c: later runs are appended below as they finish. -->
