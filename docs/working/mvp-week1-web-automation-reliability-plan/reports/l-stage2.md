# l-stage2 — the Stage 1 fixes, measured under load (Lab owner)

Worker report for `l-stage2` in [finish-week1.md](../briefs/finish-week1.md),
as amended at the seventeenth dispatch. `<R>` = `7263534`
(`726353419511d7615b4acb149cac4483e13ddf04`), `<C>` = Core `187f40d`
(`187f40df314696eadfb5784ef11c27fc95c82bbc`). Written 2026-09-13, local time
(UTC-7) unless marked `Z`. This machine has faulty RAM: every figure is a single
observation unless it says otherwise.

**Status: stopped at a blocker at 02:34, diagnosed at 02:45.** The worktrees are
kept for the resume. The discarded messages are named in
[Blocker diagnosis](#blocker-diagnosis). They are the extension's runtime
confirmations of Core-dispatched actions, sent while no recording is open:
2 from the runner's probe before recording, and 4 from the Flow lane's nodes after
finalization. This rests on a single instrumented run.

## Outcome

**Blocked. The pin held on every run, but every Lab run at `7263534` with Core
`187f40d` fails the runner's discard check before a Flow is built. None of the
brief's measured observations can be produced at this pin.**

- **The pin held.**
  - Before any run, the pin proof printed `exit=0` and `unpinned=0` for both
    worktrees.
  - All 12 manifests record facility `726353419511…` `dirty=false` and Core
    `F:\fxlab\!FluxIQ` `187f40df314696…` `dirty=false`.
- **12 of 12 runs exited 1 with one failure.** The failure was
  `recording.persistence`,
  `Core discarded recorded actions that arrived after their recording was finalized (2 with no recording id)`.
  The runs:
  - step 4b, `basic-form --flow`: 6 on the measured instance, runs 1–4 under load
    and runs 5–6 with no other Lab;
  - 5 on the load instance;
  - 1 `sensitive-input` recording-lane run, alone.
- **The recordings were complete.** Every run: `recordedActions` extension equal
  to Core (4 / 4, or 3 / 3), `extensionConnectionAfterStop` `connected`, and the
  second discard read added 0. Step 4b's `runtime.settle` `entryCount` was 15 in
  9 runs and 16 in 2.
- **Core's code says the discards preceded the recording, rather than followed
  its finalization.** This is an inference from the code: the entries carry no
  `recordingId` and no `sinceFinalizedMs`, which Core writes only when no
  recording was open or remembered for that client (`client-gateway/bridge.ts:481,488-490`).
  The runner counts them by session (`flow-lane/recording-discards.ts`).
- **A single observation from `sensitive-input`:** the leak attestation
  `"status":"passed","literalCount":2,…"findingCount":0`, and 0 declared-value hits
  in 13 bundle files. The run still failed the discard check.
- **Stopped** after step 4b run 6, seconds into run 7. W18, W25, W10, W27, W24,
  the smoke gate 5.0, the week1 bench, and `sensitive-input` runs 2–3 were not
  run. W19 `expired` is pending `w19-d1b`.
- **Lowest free memory: 9.88 GB**, at 02:25:22, under two instances. The load loop
  never paused.

## What changed and why

No tracked file in either repository was edited. Created:

- **Core worktree `F:\fxlab\!FluxIQ`**, moved from `267a2ca` to `187f40d` with
  `git checkout --detach 187f40d` (`HEAD is now at 187f40d Keep a recorded entry's source event id and source on its metadata`).
  Its `git status --porcelain` was empty before and after.
- **Two repository worktrees at `7263534`**, recreated rather than moved:
  - `F:\fxlab\fxlab-7263534`: the measured instance (`FLUXIQ_LAB_INSTANCE=l-stage2-a`);
  - `F:\fxlab\fxlab-7263534-load`: the load instance (`l-stage2-load`).
  - Stage 1's `F:\fxlab\fxlab-16ff729`, `-b` and `-step4` are left in place,
    untouched. They hold junctions into `F:\fxlab\!FluxIQ\packages`, so their
    removal needs `i-lab-campaign` Part 2 item 8's non-recursive junction delete.
    `git -C F:\!FluxIQWebExtension worktree list` also still lists `F:/fxlab-147fdb4`.
- **Run artifacts** under `F:\fxlab-runs\stage2\`.
- **Scratch files**, all prefixed `l-stage2-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`.

## Commands run and observed results

### Pre-checks

- `git rev-parse 7263534` returned `726353419511d7615b4acb149cac4483e13ddf04`;
  `git -C F:\!FluxIQ rev-parse 187f40d` returned
  `187f40df314696eadfb5784ef11c27fc95c82bbc`. The main tree is at `4c8f30c`;
  the pin is `7263534`, as dispatched.
- `F:\fxlab\!FluxIQ` was at `267a2ca…` with an empty `git status --porcelain`.
- No process command line matched `run-lab.mjs`, `test-runner\dist\cli.js`,
  `next dev` or `fxlab`. No `FLUXIQ_*` variable was set.
- Free memory: `FreeGB 15.70 TotalGB 25.85`.
- `git diff --stat 267a2ca 187f40d` over Core's `pnpm-lock.yaml` and the three
  packages' `package.json` printed nothing. This repository's lockfile is
  unchanged `16ff729..7263534`; only `apps/extension/package.json`'s
  `test:content` script changed.

### Setup

From `l-stage2-setup-status.txt` and `l-stage2-ext-install-status.txt`:

```
core-checkout exit=0
ext-worktree-add exit=0
load-worktree-add exit=0
core-install exit=0 seconds=1.0488341
build @fluxiq/contracts exit=0 seconds=1.8438981
build fluxiq exit=0 seconds=7.0206789
build @fluxiq/client-gateway-websocket exit=0 seconds=1.6043273
install fxlab-7263534 exit=0 seconds=1.7583165
install fxlab-7263534-load exit=0 seconds=1.3087489
```

- Core install: `Lockfile is up to date, resolution step is skipped`,
  `Already up to date`. Each build is `tsc -b tsconfig.build.json --clean && tsc -b …`.
  `@fluxiq/web` was not built, as in Stage 1.
- Newest `dist` file per package: contracts `2026-09-13T02:18:52`, fluxiq
  `02:18:59`, client-gateway-websocket `02:19:00`.
- Core after the build: `HEAD=187f40df…`, `core porcelain lines: 0`.
- Both repository worktrees: `HEAD=726353419511d7615b4acb149cac4483e13ddf04`,
  empty `git status --porcelain` after install. Junctions, identical in shape
  for `-load`:
  ```
  F:\fxlab\fxlab-7263534\domain\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-7263534\domain\node_modules\@fluxiq\client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\ [Junction]
  F:\fxlab\fxlab-7263534\apps\extension\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-7263534\apps\extension\node_modules\@fluxiq\client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\ [Junction]
  F:\fxlab\fxlab-7263534\packages\test-runner\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-7263534\packages\test-contracts\node_modules\@fluxiq\contracts -> F:\fxlab\!FluxIQ\packages\contracts\ [Junction]
  ```

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs <worktree>`
(Stage 1's script, copied unchanged) printed `exit=0` for
`F:\fxlab\fxlab-7263534`:

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

`F:\fxlab\fxlab-7263534-load` printed the identical lines, `exit=0`, `unpinned=0`.

### How the campaign runs

- **Drivers**, in the scratch directory:
  - `l-stage2-lab-seq.ps1` runs a plan file serially:
    `pnpm -C <worktree> lab <args> *> <log>`, then `exit=$LASTEXITCODE` to
    `l-stage2-<label>-status.txt`. Each status write is retried up to 50 times,
    after Stage 1 lost 30 status lines to a locked file. Each line also records
    `otherLabsBefore`, the number of `run-lab.mjs` processes outside the
    driver's own worktree, and `freeGBBefore`.
  - `l-stage2-load-loop.ps1` loops `lab run basic-form --flow --target isolated`
    in `F:\fxlab\fxlab-7263534-load` until a stop file exists. Before each run,
    and every 15 s while paused, it checks free memory, and pauses below 4 GB
    (Part 3's floor), writing `pause start=` and `pause end=` lines. A run
    already started is never interrupted.
- **Environment**, on every Lab command: `FLUXIQ_TEST_ENV_FILES=none`,
  `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` equal to the label, and
  `FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage2\<a|load|c|bench>`.
  - `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` is set only for W18 and the week1
    bench, read by regex from the worktree's `auth-gate/constants.ts`, and removed
    after each run.
  - Declared secrets are resolved only on the Flow lane
    (`run-scenario.ts:70`, `options.flow ? resolveDeclaredSecrets(...) : []`).
    `sensitive-input` therefore runs as `i-lab-campaign` criterion 2 names it,
    `lab run sensitive-input --target isolated`, with no secret variable. Its
    attestation scans the scenario's own literals (`run-scenario.ts:77,432-435`)
    and writes `snapshots/redaction-attestation.json`.
- **Plans:**
  - `l-stage2-plan-a.txt`, under load: `step4b` ×24, `w18` ×3 (secret),
    `w25` (`delayed-ui --flow`) ×3, `w25-too-slow` ×3.
  - `l-stage2-plan-c.txt`, alone: `navigation --flow --variant broken-link` ×3,
    `failure-surfaces --flow --variant blocked-url` ×3, `sensitive-input` ×3,
    `intermediate-state --flow` ×3, smoke bench `--repeat 2` ×1, then compare
    against `F:\!FluxIQWebExtension\test-runs\bench\bench-mtxoim0b-8ca4952c`
    (read only).
  - The week1 bench `--repeat 1`, alone, last. Chromium launches headed by
    default (`docs/architecture/testing-facility.md:813`).
  - W19 `expired` is not in any plan (seventeenth dispatch).
- **Where each step 4b figure comes from, at `7263534`:**
  - `candidateCount`: `snapshots/flow-lane.json`.
  - Entry count, action-count check, first discard read, connection state: the
    first `runtime.settle` event's `recordings[].entryCount`,
    `recordedActions.{extension,core}`, `recordingDiscards` and
    `extensionConnectionAfterStop` (`run-scenario.ts:312`). The check fails a
    run as `recording.persistence` when Core holds fewer actions
    (`run-expectations/recording-completeness.ts`).
  - Second discard read: a later `runtime.settle` event with `recordingDiscards`
    and `discardsAfterFirstRead` (`run-scenario.ts:405-414`).
- **Memory:** Part 3's loop every 15 s to `l-stage2-lab-mem.csv`, from 02:20:51.

### Campaign

#### Launch

- The load loop started at 02:23:26. Its first build ended with the `{"lab":"paths","instance":"l-stage2-load",…}` line at 02:23:43.
- Instance A (`l-stage2-plan-a.txt`) started at 02:24:22.

#### Step 4b and the load loop: every run failed the same way, before the Flow was built

**All 11 completed runs, 6 on A and 5 on the load instance, exited 1 with the same
failure.** Every manifest records facility `726353419511d7615b4acb149cac4483e13ddf04`
`dirty=false` (its own worktree) and Core `F:\fxlab\!FluxIQ`
`187f40df314696eadfb5784ef11c27fc95c82bbc` `dirty=false`. Every exit comes from a
status line and matches the log's `ELIFECYCLE … exit code 1`.

A, `lab run basic-form --flow --target isolated`, bundles under `F:\fxlab-runs\stage2\a\`:

| Run | runId | otherLabsBefore | Exit | candidateCount | settle entryCount | recordedActions ext / core | 1st discard read | 2nd read, after first | extensionConnectionAfterStop | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzly7pd-91c47847 | 2 | 1 | none (no `flow-lane.json`) | 15 | 4 / 4 | 2 `action_discarded` | 0 | connected | recording.persistence |
| 2 | run-mtzlzn4u-c8a44a6e | 2 | 1 | none | 15 | 4 / 4 | 2 | 0 | connected | recording.persistence |
| 3 | run-mtzm16ok-2f8b26e9 | 2 | 1 | none | 16 | 4 / 4 | 2 | 0 | connected | recording.persistence |
| 4 | run-mtzm2q0i-ef7f2159 | 2 | 1 | none | 15 | 4 / 4 | 2 | 0 | connected | recording.persistence |
| 5 | run-mtzm4aeq-c3771963 | **0** | 1 | none | 15 | 4 / 4 | 2 | 0 | connected | recording.persistence |
| 6 | run-mtzm5ikw-6d720201 | **0** | 1 | none | 15 | 4 / 4 | 2 | 0 | connected | recording.persistence |
| 7 | none | 0 | not captured | — | — | — | — | — | — | driver stopped in the build phase |

Load instance, the same command, bundles under `F:\fxlab-runs\stage2\load\`:

| Loop run | runId | Exit | settle entryCount | ext / core | discards | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzlwyd7-127f2d14 | 1 | 15 | 4 / 4 | 2, +0 | recording.persistence |
| 2 | run-mtzly2k5-e65d517d | 1 | 15 | 4 / 4 | 2, +0 | recording.persistence |
| 3 | run-mtzlzk8d-0726df0e | 1 | 15 | 4 / 4 | 2, +0 | recording.persistence |
| 4 | run-mtzm1647-00733bcc | 1 | 16 | 4 / 4 | 2, +0 | recording.persistence |
| 5 | run-mtzm2qpt-b6bed5a9 | 1 | 15 | 4 / 4 | 2, +0 | recording.persistence |

**What every run shows, quoted from A's run 6 (`run-mtzm5ikw-6d720201`, no load)
`events.ndjson`:**

```
#16 runtime.settle recordingCount=1 recordedActions={"extension":4,"core":4} recordingDiscards=[{"type":"recording.action_discarded","entryId":"610910ad-2caf-4d1e-9901-b3b99a6f198d","discardedActions":1,"discardedEvents":1},{"type":"recording.action_discarded","entryId":"84b7ef94-92c2-4cec-83f1-e4b551ab57b9","discardedActions":2,"discardedEvents":2}] extensionConnectionAfterStop="connected" recordings=[{"recordingId":"client.extension-3bdbf8e0-….1789291850778","entryCount":15,"entriesAppendedAfterFirstPoll":10,"finalizationWaitMs":3329}] recordedEvents={"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.dom.mutated":2,"web.element.changed":1,"web.keyboard.pressed":1,"web.tab.state_changed":1}
#17 error: Core discarded recorded actions that arrived after their recording was finalized (2 with no recording id) :: {"failureCategory":"recording.persistence",…}
#18 runtime.settle recordingDiscards=[…the same two entry ids…] discardsAfterFirstRead=0
```

- `evaluation.json`: `verdict=failed`, `lane=flow`, `flowCreated=false`,
  `oracleVerdict=null`, and `failed invariant runner-verdict: expected="passed" actual="failed: recording.persistence"`.
- No run has `snapshots/flow-lane.json`, because the failure is thrown at
  `run-scenario.ts:313`, before `options.flow` at `:315`.
- `run.json`: `redactionState=not_applicable`,
  `processExits={"scenario-lab":1,"fluxiq-web":1}`.
- The same eleven fields hold in every run, with fresh entry ids each time. The
  two discards always carry running counts 1 and 2, with no `recordingId` and no
  `sinceFinalizedMs`.

**Rerun alone.** This is a uniform failure, so it was rerun with no load, per the
faulty-RAM rule:
- I wrote the load stop file at 02:28:01. The loop had already begun run 5
  (02:27:54), and wrote `finished=2026-09-13T02:29:09`.
- A's runs 5 (02:29:09–02:30:06) and 6 (02:30:06–02:31:00) each began with
  `otherLabsBefore=0`, and failed identically.
- It is not a RAM shape: no timeout, no native crash, no error inside a
  dependency, and the same concrete values in 11 of 11 runs.

**Stopped at run 7.** Every further run would fail at the same check before any
figure the brief asks for exists. So I stopped A's driver (`taskkill /T /F /PID 4676`, `exit=0`) at
02:31:01, seconds into run 7, whose log is 0 bytes. After the stop:
- no process command line matched `fxlab`, `run-lab.mjs`, `test-runner\dist\cli.js` or `next dev`;
- neither worktree has a `.lab-locks` entry;
- `F:\fxlab-runs\stage2\{a,load}\.work` have 0 entries;
- a non-following walk of `F:\fxlab-runs\stage2` found `reparsePoints=0`;
- both worktrees are at `7263534` and Core at `187f40d`, each with 0 porcelain lines.

#### What the discards are: Core's code, read at `187f40d` in `F:\fxlab\!FluxIQ`

- **Where Core audits a discard.** `client-gateway/bridge.ts` calls
  `noteDiscardedClientMessage` when a client's recording entry or event arrives
  and `this.activeRecordings` has no recording for that client (`:222-223`,
  `:380-381`). It also calls it for a snapshot (`:560`), a state update
  (`:599`), and a message that lost the race to finalization (`:543-547`).
- **How the recording id is filled.** It is `discarded.recordingId ?? closed.recordingId`
  (`:488`), where `closed` is the last recording remembered for that client
  (`:481`). `sinceFinalizedMs` is set only when that remembered recording was
  finalized (`:490`).
- **Inference, not observed.** An entry with neither field means the message
  named no recording, and Core remembered none closed for that client. The
  message therefore reached Core before any recording of that client had opened
  or closed. That is not "after their recording was finalized", as the runner's
  message says.
  - The runner counts such an entry as this run's loss whenever its `sessionId`
    is the run's paired session (`flow-lane/recording-discards.ts`, `discardOf`).
  - Core holds all 4 of the extension's actions in every run, so the two
    discarded executable messages are not among the recorded workflow's actions.
- **Not identified.** Core's audit metadata carries `eventType` and `inputId`
  (`bridge.ts:501-502`), but the runner keeps only `type`, `entryId`,
  `recordingId`, the counts and `sinceFinalizedMs`. Each run's isolated Core
  and its in-memory audit log are gone. The candidates, none verified:
  - the Core action round-trip probe, which dispatches `web.browser.navigate`
    and `web.dom.type` before the recording starts
    (`run-scenario.ts:261`; events #1 and #3 in every bundle);
  - a start-ordering change in this pin: Core `73a81e9`, or the extension's
    `f-recording-start-send` / `f-recording-start-guard`. At Stage 1's pin the
    runner did not read Core's audit log (`l-stage1.md` "Not verified"). The
    plan's Current State lists these changes as landing after that pin. I did
    not read Stage 1's Core `267a2ca` bridge, and did not bisect.
- **Circumstantial, not proof.** The only executable traffic this run sends
  before starting the recording is the runner's Core round-trip probe
  (`run-scenario.ts:261`). That is two actions, events #1 `web.browser.navigate`
  and #3 `web.dom.type`, in all 12 bundles. The two discarded executable messages
  have running counts 1 and 2 in all 12.
- **`core.log` holds no audit line.** A case-insensitive grep of
  `run-mtzm5ikw-6d720201\logs\core.log` for
  `discard|audit|client\.start_recording|recording\.(start|project)` found no
  matches.

#### Step 3, one run: `sensitive-input` alone, to see whether the recording lane is blocked too

Plan `l-stage2-plan-c1.txt`, label `l-stage2-c`, runs dir `F:\fxlab-runs\stage2\c`,
worktree `F:\fxlab\fxlab-7263534`. `labs before: 0`. Status line:

```
name=sensitive-input index=1 start=2026-09-13T02:32:52.6232382-07:00 end=2026-09-13T02:33:45.4690390-07:00 seconds=52.8 exit=1 otherLabsBefore=0 freeGBBefore=15.79 args=run sensitive-input --target isolated secretSupplied=False
```

- **Bundle** `F:\fxlab-runs\stage2\c\run-mtzm92md-460da9c5`. `run.json`: facility
  `726353419511d7615b4acb149cac4483e13ddf04` `dirty=false`; Core `F:\fxlab\!FluxIQ`
  `187f40df314696eadfb5784ef11c27fc95c82bbc` `dirty=false`; `verdict=failed`,
  `redactionState=verified`.
- **`evaluation.json`:**
  - `verdict=failed oracleVerdict=passed reportedVerdict=passed lane=recording`;
  - `failed invariant runner-verdict: expected="passed" actual="failed: recording.persistence"`;
  - `actions=["web.browser.navigate","web.dom.type"]`.
- **`events.ndjson`:**
  ```
  #1 runtime.dispatch {"actionType":"web.browser.navigate","url":"http://127.0.0.1:53048/scenarios/sensitive-input/",…}
  #3 runtime.dispatch {"actionType":"web.dom.type","target":"[data-testid=\"password\"]",…}
  #14 runtime.settle recordingCount=1 recordedActions={"extension":3,"core":3} recordingDiscards=[{"type":"recording.action_discarded","entryId":"ef98e093-…","discardedActions":1,"discardedEvents":1},{"type":"recording.action_discarded","entryId":"1b630e7e-…","discardedActions":2,"discardedEvents":2}] extensionConnectionAfterStop="connected" recordings=[{…"entryCount":10,"entriesAppendedAfterFirstPoll":6,"finalizationWaitMs":2285}] recordedEvents={"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.tab.state_changed":1}
  #15 error: Core discarded recorded actions that arrived after their recording was finalized (2 with no recording id) :: {"failureCategory":"recording.persistence",…}
  #16 runtime.settle recordingDiscards=[…the same two…] discardsAfterFirstRead=0
  ```
- **The leak attestation passed.** `snapshots/redaction-attestation.json`, quoted:
  `{"status":"passed","literalCount":2,"scopes":[{"name":"bundle","scannedFiles":3,"scannedBytes":10006,"skippedBinaryFiles":0},{"name":"workspace","scannedFiles":17,"scannedBytes":196715,"skippedBinaryFiles":2}],"findingCount":0,"advisories":[]}`.
- **No declared value appears in any bundle file.** `l-stage2-analyse.mjs` counted
  three values: auth-gate's password constant and `sensitive-input`'s two
  replaced literals (`replace-password`, `replace-payment`). It printed
  `declared-value search: bundle files=13 hits=[]`.
- **A single observation.** The recording lane fails the same discard check, so
  every run the brief lists would stop there. Its redaction figures hold for 1
  run, not the 3 the brief asks for.

#### Not run, and why

Every run below would fail `run-scenario.ts:313` before producing the figure the
brief asks for, as all 12 runs above did:

- step 4b runs 7–24;
- B: W18 `auth-gate --flow` ×3, W25 `delayed-ui --flow` ×3 and `--variant too-slow` ×3;
- step 3: W10 `broken-link` ×3, W27 `blocked-url` ×3, `sensitive-input` runs 2–3,
  W24 `intermediate-state --flow` ×3, the smoke gate 5.0 bench and compare;
- step 4: the week1 bench `--repeat 1` and its Flow-lane row checks;
- W19 `expired` ×3: pending `w19-d1b` (seventeenth dispatch), and blocked by the
  same check.

#### Memory

Part 3's loop, every 15 s, 55 samples from 02:20:51 to 02:34:24
(`l-stage2-lab-mem.csv`). Columns are free physical GB and the summed Chrome plus
Node working set in GB.

- **Lowest free memory: 9.88 GB at 02:25:22**, during A plus load. The highest
  working set, 6.49 GB, is in the same sample.
- Per window:
  ```
  pre-run 02:20:51-02:23:25 samples=11 minFreeGB=15.48 maxChromeNodeWsGB=0.59
  load alone 02:23:26-02:24:21 samples=3 minFreeGB=13.06 maxChromeNodeWsGB=2.9
  A+load 02:24:22-02:29:09 samples=20 minFreeGB=9.88 maxChromeNodeWsGB=6.49
  A alone 02:29:10-02:31:01 samples=7 minFreeGB=12.7 maxChromeNodeWsGB=3.11
  idle 02:31:02-02:32:51 samples=7 minFreeGB=15.61 maxChromeNodeWsGB=0.04
  sensitive-input alone 02:32:52-02:33:45 samples=4 minFreeGB=13.17 maxChromeNodeWsGB=2.96
  after 02:33:46-23:59:59 samples=3 minFreeGB=15.79 maxChromeNodeWsGB=0.04
  ```
- `below 4 GB samples: 0`. The load loop wrote 0 `pause` lines, so it never
  paused.
- The pre-run 0.59 GB includes other workers' `node` processes.

### After the runs

- No process command line matches `fxlab`, `run-lab.mjs`, `test-runner\dist\cli.js`
  or `next dev`.
- `F:\fxlab-runs\stage2\{a,load,c}\.work` have 0 entries each. A non-following
  walk of `F:\fxlab-runs\stage2` found `reparsePoints=0`. No `.lab-locks` entry
  remains.
- `F:\fxlab\fxlab-7263534` and `F:\fxlab\fxlab-7263534-load` are at `7263534`, and
  `F:\fxlab\!FluxIQ` is at `187f40d`, each with `porcelain=0`. All three are kept
  for the resume.
- **Declared values in my own files.** The same three values were counted over
  every `l-stage2-*` scratch file and this report, as UTF-8 and UTF-16:
  `files=50 totalHits=0`.
- The memory sampler stopped through its stop file. The status monitor was
  stopped with `TaskStop`.

## Not verified

- **What the two discarded messages are.** The runner does not keep Core's
  `eventType` or `inputId`, and each isolated Core's in-memory audit log is gone.
  The probe explanation rests on matching counts (2 and 2) in 12 of 12 runs.
- **Which change introduced the failure.** I did not bisect, and did not read
  Core `267a2ca`'s bridge or Stage 1's bundles for pre-start audit entries.
- **None of the brief's measured observations exists:**
  - step 4b's `candidateCount` and its 24-run pass condition;
  - W18's start page and username type;
  - W25's wait node and `timeout`;
  - W10 and W27 `navigation_unexpected`;
  - W24 unarmed;
  - `sensitive-input` ×3;
  - smoke gate 5.0;
  - the week1 bench, and its per-lane rates and wait-node rows;
  - W19 `expired`.
- **What a Lab run must show once this is fixed:** the whole brief, rerun at the
  fix commit, beginning with the pin proof again. A run must also show no
  `action_discarded` entry with no recording id in `runtime.settle`.
- **Not opened:** `report.html`, `review/`, the screenshots; `pnpm lab inspect`
  was not run; Firefox was not exercised.
- **The memory peak between 15 s samples.**
- **Faulty RAM.** The 11 step 4b and load failures are one uniform shape, which
  was rerun alone (runs 5 and 6) and reproduced. The `sensitive-input` run is a
  single observation.

## Open questions or contradictions found

1. **Every isolated Lab run at this pin fails the discard check, and the design
   decision is the supervisor's.** At least one of these is wrong:
   - **the runner:** `discardOf` counts every session-scoped entry with no
     recording id, including one Core audited with no recording ever open for
     that client (`bridge.ts:481,488-490`);
   - **the traffic:** the probe, or the extension, sends a recording message while
     no recording is open;
   - **Core:** it audits such a message as a recording discard at all.

   The runner's message, "arrived after their recording was finalized", does not
   describe these entries, which carry no `sinceFinalizedMs`.
2. **The bundle cannot name a discarded message.** `RecordingDiscard` drops
   Core's `eventType` and `inputId` (`bridge.ts:501-502`). Both are identifiers,
   not page data, and keeping them would have made this diagnosable from the
   bundle.
3. **The no-loss entry count is not one number at this pin.** `runtime.settle`
   `entryCount` was 15 in 9 of the 11 basic-form runs, and 16 in A's run 3 and the
   load's run 4. Those two overlapped (02:26:41–02:27:54). Every run had 4 of 4
   actions. The brief's "one `runtime.settle` entry count across all runs" would
   fail on 15 against 16 even with the discard check fixed, unless evidence
   entries are excluded from that criterion.
4. **Deviation from the brief: step 4b was stopped at 7 of 24, and nothing
   after it ran.** The reason is above. The supervisor may prefer a full
   campaign of failures; it would add no figure, since the check throws before
   any.
5. **`otherLabsBefore` counts processes, not instances.** It read 2 while one
   load instance ran, because both its `pnpm` and `node` command lines contain
   `run-lab.mjs`.
6. **The attestation's bundle scope scanned 3 files, but the finished bundle
   holds 13.** It runs on the staging directory before the manifest, evaluation
   and similar files are written (`run-scenario.ts:426-435`, before `:453`).
   Whether those later files need scanning I did not investigate.
7. **Stage 1's worktrees are not removed** (`F:\fxlab\fxlab-16ff729`, `-b`,
   `-step4`). `F:\fxlab-147fdb4` also remains. Removing any of them needs Part 2
   item 8's junction-safe delete.

## Blocker diagnosis

Added at the coordinator's amendment and its addendum: one instrumented run, alone,
to find which messages Core discarded, and when. **This is a single run, so every
figure below is a single observation.** Times are Core's and the runner's clocks on
this machine, in `Z`; local time is `Z` minus 7 h.

### How the run was made

- **A temporary edit in `F:\fxlab\fxlab-7263534\packages\test-runner\src\run-scenario.ts`
  only.** It was applied by `l-stage2-diag-patch.mjs`, whose output was
  `patches=14 all matched once; mode=apply; eol="\r\n"`. The saved diff is
  `l-stage2-diag.diff` (18540 bytes), with `git diff --stat` reading
  `1 file changed, 43 insertions(+), 15 deletions(-)`. It:
  - logged, for the paired session, every `recording.action_discarded` and
    `recording.event_discarded` audit entry exactly as Core wrote it (`id`,
    `timestamp`, `type`, `message`, `sessionId`, full `metadata`). It did so at
    three reads: when the extension reported recording, at the first read after
    Stop, and at the second read in `finally`, after the Flow lane. It also logged
    the session's other audit entries as id, type, timestamp and allow-listed
    scalar metadata;
  - logged runner marks for: probe start, each probe action's return, probe end,
    Record pressed and answered, recording observed, Stop, the Flow lane call, the
    Flow page prepared, and Flow evidence published;
  - read Core's recording through `listRecordings` and `get-recording`, keeping its
    timestamp fields and each timeline entry's id, type, timestamp, `sourceId`,
    `outputId`, `eventId` and `inputId`, with no payload;
  - **skipped the first read's `throw`**, and left the completeness check untouched;
  - **deviation:** it also skipped the second read's verdict override
    (`run-scenario.ts:410`, behind an unset `L2_APPLY_SECOND_DISCARD`). That read
    does not throw; it rewrites the verdict. Skipping it lets the exit show the Flow
    lane. The override would have fired; see answer 5.
- `pnpm -C F:\fxlab\fxlab-7263534\packages\test-runner exec tsc -p tsconfig.json --noEmit`
  printed `tsc noEmit exit=0`.
- **The run:**
  `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=l-stage2-diag EXTENSION_TEST_BUILD_LABEL=l-stage2-diag FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage2\diag pnpm -C F:\fxlab\fxlab-7263534 lab run basic-form --flow --target isolated *> l-stage2-l-stage2-diag-run-01.log`.
  Status line:
  ```
  name=diag index=1 start=2026-09-13T02:44:34.1370146-07:00 end=2026-09-13T02:45:37.6019936-07:00 seconds=63.5 exit=0 otherLabsBefore=0 freeGBBefore=16.06 args=run basic-form --flow --target isolated
  ```
  The log shows `{"lab":"core-build","state":"quiet","root":"F:\\fxlab\\!FluxIQ",…}`
  and `packages/test-runner build: Done`.
- **Bundle `F:\fxlab-runs\stage2\diag\run-mtzmo3xz-b1e483c3`.**
  - `run.json`: facility `726353419511…` **`dirty=true`**, because of the
    instrumentation, so this run is not a Stage 2 measurement. Core
    `F:\fxlab\!FluxIQ` `187f40df314696…` `dirty=false`.
  - Result with the discard check skipped: `verdict=passed`, and
    `evaluation.json` `oracleVerdict=passed lane=flow flowCreated=true`.
  - `flow-lane.json`: `candidateCount=4`, `status=succeeded`,
    `actions=["web.dom.type:succeeded","web.dom.select:succeeded","web.dom.type:succeeded","web.dom.click:succeeded"]`.
  - `runtime.settle`: `recordedActions={"extension":4,"core":4}`, `entryCount` 15,
    `extensionConnectionAfterStop="connected"`.
  - `declared-value search: bundle files=20 hits=[]`.
- **The revert:**
  - `git -C F:\fxlab\fxlab-7263534 checkout -- packages/test-runner/src/run-scenario.ts`
    printed `checkout exit=0`;
  - `pnpm -C F:\fxlab\fxlab-7263534 --filter @fluxiq-web-extension/test-runner build`
    printed `rebuild exit=0`;
  - `git -C F:\fxlab\fxlab-7263534 status --short` printed nothing
    (`status lines=0`);
  - `hash=5945b61e4b5cffb80b7003ad6caa9f58d7ef4c95 head-blob=5945b61e4b5cffb80b7003ad6caa9f58d7ef4c95`;
  - `dist has l2Diag: 0`, `labs running: 0`, Core `187f40d porcelain=0`.

### Timeline, from `snapshots/l-stage2-diagnosis.json`

| Time (Z), 2026-09-13 | Source | Observation |
| --- | --- | --- |
| 09:45:10.795 | Core audit | `session.connected` |
| 09:45:11.489 | Core audit | `session.paired`, session `2ab6abf1-f7db-4b59-a11f-3fca9792812c` |
| 09:45:11.496 | runner | probe started |
| 09:45:11.913 | Core audit | `command.dispatched` `web.browser.navigate` (commandId `3a9f11cd-…`) |
| 09:45:13.186 | runner | the probe's navigate result returned |
| **09:45:13.188** | Core audit | **discard 1** |
| 09:45:13.598 | Core audit | `command.dispatched` `web.dom.type` (commandId `aaaa7502-…`) |
| 09:45:14.617 | runner | the probe's type result returned |
| **09:45:14.619** | Core audit | **discard 2** |
| 09:45:14.658 | runner | probe finished |
| 09:45:15.014 | runner | `selectProject` requested |
| 09:45:15.339 | runner | **Record pressed**: `fluxiq.startRecording` sent |
| **09:45:15.344** | Core | **recording `startedAt` `1789292715344`** (`listRecordings` and `get-recording` agree; so does the id's suffix) |
| 09:45:15.673 | runner | start answered |
| 09:45:16.110 | runner | the extension reports `recording` |
| 09:45:16.451 | runner | audit read: `auditLogLength` 7, discards 1 and 2 only |
| 09:45:16.886 / 17.045 / 17.410 / 17.577 | Core timeline | the 4 recorded actions: `entry.3` type, `entry.4` select, `entry.8` type, `entry.9` click |
| 09:45:17.328 | runner | Stop requested |
| **09:45:17.333** | Core | **recording `endedAt` `1789292717333`**; the runner's `finalized` has `entryCount 15, waitedMs 2501` |
| 09:45:20.878 | runner | first discard read: `auditLogLength` 7, discards 1 and 2 only |
| 09:45:22.068 | runner | Flow lane called |
| 09:45:26.408–26.421 | runner | Flow page prepared (reset, start page loaded, facts checked) |
| **09:45:29.664** | Flow run | **action 1 `web.dom.type` started**, `durationMs` 1022; Core `command.dispatched` at 29.668 |
| **09:45:30.686** | Core audit | **discard 3** |
| 09:45:30.687 | Flow run | action 2 `web.dom.select` started, 1017 ms; dispatched 30.688 |
| **09:45:31.704** | Core audit | **discard 4** |
| 09:45:31.704 | Flow run | action 3 `web.dom.type` started, 1022 ms; dispatched 31.705 |
| **09:45:32.726** | Core audit | **discard 5** |
| 09:45:32.726 | Flow run | action 4 `web.dom.click` started, 1329 ms; dispatched 32.727 |
| **09:45:34.054** | Core audit | **discard 6** |
| **09:45:34.811** | runner | **Flow evidence published**: run `8f1748ec-9465-4698-bc8f-cba0ed138a35`, `status succeeded` |
| 09:45:34.878 | Core audit | `session.disconnected` |
| 09:45:35.319 | runner | second discard read: `auditLogLength` 16, discards 1–6 |

The Flow run's `evidence.run` carries no start or end timestamp of its own; its
fields are only `runId` and `status`. The Flow run's start and end above are its
first action's `startedAt` and its evidence publication.

### The six discard entries, as Core wrote them

Every entry has `type` `recording.action_discarded`, `sessionId`
`2ab6abf1-f7db-4b59-a11f-3fca9792812c`, and metadata `source "automation-studio"`,
`clientId extension-0d45b7e2-3810-432f-8f79-f2811fd69a59`,
`clientName "FluxIQ Browser Extension"`, `domainId "web-automation"`,
`executable true`.

| # | id | timestamp | `eventType` (label) | `inputId` | `recordingId` | `discardedEvents` / `discardedActions` | `sinceFinalizedMs` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | c49eef99-e6d0-48ec-87db-dfe4829690c0 | 1789292713188 | `web.page.navigated` | `web.user.navigation_requested` | — | 1 / 1 | — |
| 2 | 03a1192b-9c9e-41dd-b1d3-125a8cafd417 | 1789292714619 | `web.element.input_changed` | `web.user.text_entered` | — | 2 / 2 | — |
| 3 | 92aa1aa0-aae8-434e-a6e5-d46b8e2c12c2 | 1789292730686 | `web.element.input_changed` | `web.user.text_entered` | `client.extension-0d45b7e2-….1789292715344` | 1 / 1 | 11165 |
| 4 | 605b1791-16ad-4ac7-b28f-866af94a3e39 | 1789292731704 | `web.element.changed` | `web.user.option_selected` | the same | 2 / 2 | 12183 |
| 5 | daba2469-9a12-4c07-bd74-2339a91c0573 | 1789292732726 | `web.element.input_changed` | `web.user.text_entered` | the same | 3 / 3 | 13205 |
| 6 | f9cf5d57-7994-4bda-8152-0b65192b5b00 | 1789292734054 | `web.element.clicked` | `web.user.element_clicked` | the same | 4 / 4 | 14533 |

- Entries 3–6 also carry `projectId 3f8fa8ce-93bf-431d-af60-ed2d3adb31ce`.
- `message`, quoted:
  - entries 1–2: `Discarded an executable action (web.page.navigated) that arrived while this client had no recording open.`
    (entry 2 names `web.element.input_changed`);
  - entry 3: `Discarded an executable action (web.element.input_changed) that arrived 11165 ms after recording client.extension-0d45b7e2-3810-432f-8f79-f2811fd69a59.1789292715344 was finalized. The client believes it was recorded; the recording does not contain it.`
    Entries 4–6 have the same form, with their own label and milliseconds.
- `discardsAllSessions` equals `discards` at every read. No other session
  discarded anything.

### Answers

1. **Before recording, during it, or after finalization?**
   - **Discards 1 and 2: before the recording started.** They landed at 13.188 and
     14.619. Record was pressed at 15.339, and Core's `startedAt` is 15.344. Both
     fall inside the probe (11.496–14.658).
   - **During the recording (15.344–17.333): none.** The reads at 16.451 and
     20.878 hold only discards 1 and 2, and no later entry is timestamped in that
     window.
   - **Discards 3–6: after finalization,** 11165–14533 ms after it by Core's own
     `sinceFinalizedMs`, all during the Flow run.
2. **Which extension message was each?**
   - **Each is a `client.recording_event`.** Core labels a discard with
     `event.eventType` only on that path (`client-gateway/bridge.ts:380-387`). A
     `client.recording_entry` is labelled with the entry's type (`:216-221`), a
     snapshot `client.<kind>_snapshot` (`:560`), and a state update
     `client.state_update` (`:599`).
   - **Each was judged executable from its input id.** The event carries no
     `executable` field, so Core decided from the input (`:483`), and the message
     reads "an executable action".
   - Type, label and inputId per entry are in the table above: navigate is
     `web.page.navigated` / `web.user.navigation_requested`; type is
     `web.element.input_changed` / `web.user.text_entered`; select is
     `web.element.changed` / `web.user.option_selected`; click is
     `web.element.clicked` / `web.user.element_clicked`.
3. **From the runner's Core action probe, or from something else?**
   - **Discards 1–2 are the probe's two actions. Discards 3–6 are the Flow lane's
     four nodes. Nothing else appears.**
   - **Timing.** Each discard follows a `command.dispatched` for the matching
     action, at the moment that action finished:
     - the probe's navigate returned to the runner at 13.186, and discard 1
       landed at 13.188; its type returned at 14.617, and discard 2 at 14.619;
     - each Flow action's `startedAt + durationMs` equals its discard:
       29.664+1.022=30.686; 30.687+1.017=31.704; 31.704+1.022=32.726;
       32.726+1.329=34.055, against 34.054.
   - **Matching input ids.** Action type maps to input id exactly as
     `runtimeConfirmationForActionResult` maps it
     (`apps/extension/src/background/connection/runtime-status.ts:100-104`:
     navigate → `navigationRequested`, click → `elementClicked`, type →
     `textEntered`, select → `optionSelected`). The ids are defined at
     `domain/src/io/input-model.ts:10,12`.
   - **The sender, by reading code.**
     - `server-command-channel.ts` `sendActionResult` (`:184-196`) sends
       `client.action_result`, then calls `sendRuntimeConfirmation`
       (`:211-238`). That sends `client.recording_event` for every succeeded
       action with a confirmation mapping, with
       `metadata: { domainId, inputId, runtimeConfirmation: true }` (`:228-237`).
     - It checks only `result.status` and the mapping, never whether a recording
       is active. The recorder's own path returns unless recording
       (`recorded-event-intake.ts:164`).
     - The comment at `:209-210` reads: "A succeeded runtime action is also
       something the recording must contain: it is replayed as the recorded
       event a user would have produced."
4. **Did any entry after finalization carry the finished recording's id?** Yes.
   All four, entries 3–6, carry `recordingId`
   `client.extension-0d45b7e2-3810-432f-8f79-f2811fd69a59.1789292715344`, which is
   the recording this run finalized at 17.333. Core fills it as
   `discarded.recordingId ?? closed.recordingId` (`bridge.ts:488`), so the audit
   cannot show whether the extension's own message named it, or whether Core
   supplied the remembered id.
5. **Does executing a Core-dispatched action make the extension send a
   `client.recording_event` while it is not recording?** **Yes, for 6 of 6
   succeeded Core-dispatched actions in this run:** 2 probe actions before
   recording, and 4 Flow nodes after it. Core audited each as
   `recording.action_discarded`.
   - Under the unpatched runner this fails every run twice:
     - the first read's two probe discards fail it before the Flow lane, which is
       all 12 Stage 2 runs;
     - on a run that reached the Flow lane, the second read fails it again. This
       run logged `verdictBeforeSecondRead: "passed"` and
       `secondDiscardFailureSkipped: "Core discarded recorded actions that arrived after their recording was finalized (2 with no recording id, 4 for client.extension-0d45b7e2-3810-432f-8f79-f2811fd69a59.1789292715344)"`.
   - **Inference:** the 12 Stage 2 bundles hold the same first-read shape
     (counts 1 and 2, no recording id, two probe actions). They are the same two
     messages.

### Where the fix could go (the evidence, not a recommendation)

- **Extension:** `apps/extension/src/background/connection/server-command-channel.ts:211-238`
  sends the runtime confirmation whether or not a recording is active.
- **Core:** `client-gateway/bridge.ts:380-387,479-509` audits an unrecorded
  runtime confirmation as a lost user action, and its message says so.
- **Runner:** `packages/test-runner/src/flow-lane/recording-discards.ts` counts
  every such entry in the run's session as a lost recorded action.
- **What the recording held:** all 4 of its actions came from the scripted user
  steps (`eventId` `web.3.…`, `web.5.…`, `web.7.…`, `web.8.…`), and none from a
  runtime confirmation. No Core-dispatched action ran while recording, so this
  run cannot show whether a confirmation sent during a recording is wanted.

### Not verified (diagnosis)

- **A single run.** Nothing here was repeated.
- **The extension's outgoing frames were not captured.** The sender is
  identified from code, from the matching input ids, and from timing to within
  2 ms, not from an observed `runtimeConfirmation: true` flag. Core's audit
  metadata does not carry that flag.
- **Whether the extension's confirmation carried a recording id** (answer 4).
- **Entry timestamps after `endedAt`, not investigated.** Core's timeline has
  `entry.8` (17.410), `entry.9` (17.577), `entry.13` (18.200) and `entry.14`
  (18.531), all after `endedAt` 17.333, and the recording still holds all 4
  actions. I did not look into what `endedAt` and an entry's `timestamp` each
  measure.

## Second attempt

Redispatch per the twenty-first dispatch's amendment and the twenty-second
dispatch. `<R2>` = `6c22e22` (`6c22e220b42efa7c31af8eaeebad420a37010bcb`); Core
`5845f5d` (`5845f5d45c68bc6bc08f0f65003a136fca2656a8`), `fluxiq` 0.4.0. Written as
the campaign runs, 2026-09-13, local time (UTC-7) unless marked `Z`. Every figure is
a single observation unless it says otherwise.

**Status: finished at 05:21.** Every briefed run was executed; the results are in
[Second attempt: outcome](#second-attempt-outcome).

### Setup

- **Commits between the two pins.** `git log --oneline 7263534..6c22e22` lists 18
  commits, including `9c198d2` (the discard window), `6c22e22` (its published
  evidence), `32b4324` (the linked-click claim) and `17c5bae` (the stored-payload
  tests). `git log --oneline 187f40d..5845f5d` lists only
  `5845f5d Release this session's behaviour changes as fluxiq 0.4.0`.
- **No install.** `git diff --stat 7263534 6c22e22 -- pnpm-lock.yaml '**/package.json' pnpm-workspace.yaml`
  printed nothing. Core's `git diff --stat 187f40d 5845f5d` over the lockfile and the
  three packages' `package.json` printed only `packages/fluxiq/package.json | 2 +-`.
  Its `diff --stat` over `packages/{fluxiq,contracts,client-gateway-websocket}/src`
  and `apps/web` printed nothing.
- **Core** `F:\fxlab\!FluxIQ`:
  ```
  core-checkout exit=0
  build @fluxiq/contracts exit=0 seconds=1.6394377
  build fluxiq exit=0 seconds=6.8153995
  build @fluxiq/client-gateway-websocket exit=0 seconds=1.4886274
  HEAD is now at 5845f5d Release this session's behaviour changes as fluxiq 0.4.0
  core HEAD=5845f5d45c68bc6bc08f0f65003a136fca2656a8 porcelain=0
  fluxiq version: 0.4.0
  ```
  The newest `dist` files are from `03:21:47` (contracts), `03:21:54` (fluxiq) and
  `03:21:55` (client-gateway-websocket).
- **Both repository worktrees moved in place** with `git checkout --detach 6c22e22`,
  keeping their directory names:
  - `F:\fxlab\fxlab-7263534`, the measured instance, label `l-stage2b-a`;
  - `F:\fxlab\fxlab-7263534-load`, the load instance, label `l-stage2b-load`.

  **The directory names still say `7263534`; the commit is `6c22e22`.** Each
  printed `HEAD is now at 6c22e22 Publish each discard read's window and what it excluded`,
  `porcelain=0`, `locks=0`, and junctions such as
  `domain\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]`.
- **What the runner publishes at `6c22e22`, read with `git show`.**
  - Both discard reads' `runtime.settle` events carry `recordingDiscardWindow`
    (`run-scenario.ts:319,417`).
  - Its type is
    `{ from: number | null; until?: number; excluded: Record<"recording.action_discarded" | "recording.event_discarded", Record<"thisRunsRecording" | "noRecording" | "anotherRecording", number>> | null }`
    (`flow-lane/recording-discards.ts`).
  - `from` is taken at `run-scenario.ts:279`, and `until` from
    `flowDispatchStarting` (`:336`).
  - A failure now reads
    `Core discarded recorded actions inside this run's recording window (…)`.
- **Drivers** (`l-stage2-lab-seq.ps1`, `l-stage2-load-loop.ps1`) now take
  `-CampaignStopFile l-stage2b-campaign.stop`:
  - after a failed run whose `events.ndjson` holds an `error` event matching
    `Core discarded recorded actions`, the driver writes the file and stops;
  - both drivers check the file before each run.

  This carries out "if a windowed check still fails a run, stop".
- **Plans:**
  - `l-stage2b-plan-a.txt`, under load: `step4b` ×24, `w18` ×3 (secret),
    `w19-expired` (`auth-gate --flow --variant expired`) ×3 (secret), `w25` ×3,
    `w25-too-slow` ×3;
  - `l-stage2b-plan-c.txt`, alone: unchanged from the first attempt;
  - `l-stage2b-plan-d.txt`, alone: `bench --corpus week1 --repeat 1 --target isolated`,
    with the auth-gate secret.
- **Memory:** Part 3's loop to `l-stage2b-lab-mem.csv`, from before setup.

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage2-pin-proof.mjs <worktree>` printed
`exit=0` for `F:\fxlab\fxlab-7263534` at `HEAD=6c22e220b42efa7c31af8eaeebad420a37010bcb`:

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

`F:\fxlab\fxlab-7263534-load`, at the same HEAD, printed the identical lines:
`exit=0`, `unpinned=0`.

### Campaign

#### Launch

- The load loop started at 03:24:17. Its first build printed
  `domain build: clean-dist: removed 264 emitted file(s) from dist`,
  `packages/test-runner build: Done` and the `{"lab":"paths","instance":"l-stage2b-load",…}`
  line, seen at 03:24:33.
- Instance A (`l-stage2b-plan-a.txt`) started at 03:24:47.

#### Step 4b, `basic-form --flow --target isolated`, under load: runs 1–8 (in progress)

- **Manifests.** Every manifest records facility
  `6c22e220b42efa7c31af8eaeebad420a37010bcb` `dirty=false`, path
  `F:\fxlab\fxlab-7263534`, and Core `F:\fxlab\!FluxIQ`
  `5845f5d45c68bc6bc08f0f65003a136fca2656a8` `dirty=false`.
- **Exits** come from each status line, and match the log.
- **Bundles** are under `F:\fxlab-runs\stage2b\a\`.

**Run 1's two windows, verbatim** (`events.ndjson` #16 and #20):

```
first read:  recordingDiscards=[] recordingDiscardWindow={"from":1789295134250,"excluded":{"recording.action_discarded":{"thisRunsRecording":0,"noRecording":2,"anotherRecording":0},"recording.event_discarded":{"thisRunsRecording":0,"noRecording":0,"anotherRecording":0}}}
second read: recordingDiscards=[] recordingDiscardWindow={"from":1789295134250,"until":1789295148889,"excluded":{"recording.action_discarded":{"thisRunsRecording":4,"noRecording":2,"anotherRecording":0},"recording.event_discarded":{"thisRunsRecording":0,"noRecording":0,"anotherRecording":0}}} discardsAfterFirstRead=0
```

**How the table abbreviates a window.** `excluded` is written as action `a/b/c`
and event `d/e/f`. Each triple is `thisRunsRecording` / `noRecording` /
`anotherRecording`. The analyser (`l-stage2-analyse.mjs`, output
`l-stage2b-a-analysis-2.txt`) printed every run's two objects in full.

| Run | runId | Exit | candidateCount | Flow actions | recordedActions ext / core | settle entryCount | 1st read: discards; window | 2nd read: discards, added; window | Connection after Stop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzo3wv6-7f114fbf | 0 | 4 | type, select, type, click: all `succeeded` | 4 / 4 | 15 | 0; from 1789295134250, action 0/2/0, event 0/0/0 | 0, +0; from 1789295134250, until 1789295148889, action 4/2/0, event 0/0/0 | connected |
| 2 | run-mtzo5hh2-7770136a | 0 | 4 | the same | 4 / 4 | 15 | 0; from 1789295211540, action 0/2/0, event 0/0/0 | 0, +0; until 1789295231463, action 4/2/0, event 0/0/0 | connected |
| 3 | run-mtzo7afh-2016b646 | 0 | 4 | the same | 4 / 4 | 15 | 0; from 1789295299957, action 0/2/0, event 0/0/0 | 0, +0; until 1789295318787, action 4/2/0, event 0/0/0 | connected |
| 4 | run-mtzo94hz-dd00b276 | 0 | 4 | the same | 4 / 4 | 15 | 0; from 1789295384321, action 0/2/0, event 0/0/0 | 0, +0; until 1789295405671, action 4/2/0, event 0/0/0 | connected |
| 5 | run-mtzoaycy-9728915e | 0 | 4 | the same | 4 / 4 | 15 | 0; from 1789295470552, action 0/2/0, event 0/0/0 | 0, +0; until 1789295490219, action 4/2/0, event 0/0/0 | connected |
| 6 | run-mtzocs76-0c6138b4 | 0 | 4 | the same | 4 / 4 | 15 | 0; from 1789295557464, action 0/2/0, event 0/0/0 | 0, +0; until 1789295577096, action 4/2/0, event 0/0/0 | connected |
| 7 | run-mtzoem7x-18845fa5 | 0 | 4 | the same | 4 / 4 | 16 | 0; from 1789295647846, action 0/2/0, event 0/0/0 | 0, +0; until 1789295668445, action 4/2/0, event 0/0/0 | connected |
| 8 | run-mtzogm8a-a7346b53 | **1** | — (`flowCreated=false`) | none | — | — | no read (topology never started) | no read | — |

- **Runs 1–7 pass every step 4b criterion.** Each has `verdict=passed` and
  `evaluation.json` `oracleVerdict=passed lane=flow flowCreated=true`. The
  second window's `from` equals the first read's in every run. The excluded
  counts are exactly what `g-discard-window-evidence` expects:
  - first read: `from` set, no `until`, 2 action discards naming no recording;
  - second read: `until` set, 4 naming this run's recording and 2 naming none,
    `discardsAfterFirstRead` 0.
- **Run 8 failed at startup, not at the discard check.**
  - `events.ndjson` #1:
    `error: Timed out waiting for http://127.0.0.1:55337 :: {"failureCategory":"process.startup",…}`.
  - `evaluation.json`: `failed invariant runner-verdict: expected="passed" actual="failed: process.startup"`,
    `flowCreated=false`.
  - `run.json`: `processExits={}`. No `flow-lane.json` and no `runtime.settle`
    event exist.
  - Its status line reads `otherLabsBefore=0`, but the load loop's run 8 had
    started in the same second (03:34:41), so the count missed it.
  - The campaign stop file was not written.
  - The bundle has no `logs/` directory. Its files are `artifact-index.json`,
    `bundle.complete.json`, `evaluation.json`, `events.ndjson` (374 bytes),
    `evidence-policy.json`, `report.html`, `run.json`, `summary.json`,
    `review/contact-sheet.html`, `review/timeline.json` and
    `snapshots/redaction-attestation.json`. So neither child process's log was
    copied, and which process owned port 55337 is not recorded.
  - `run.json` has `startedAt` 10:35:00.221Z and `finishedAt` 10:36:03.233Z. The
    launcher printed a `core-build` `quiet` line and its `paths` line before the
    run.
  - Memory samples over the run read 15.15 GB free at 03:34:49, falling to
    12.36 GB at 03:35:49, with Chrome plus Node at 0.76–3.75 GB.
  - **A single observation.** It is a startup timeout with no assertion diff, so
    it is rerun once, alone, after plan A (below).
- **Entry counts, reported rather than compared:** 15 in 6 runs, 16 in run 7.

#### The load instance: loop runs 1–8

All runs `basic-form --flow --target isolated`, under `F:\fxlab-runs\stage2b\load\`.
Every manifest records facility `6c22e22…` `dirty=false`, path
`F:\fxlab\fxlab-7263534-load`, and Core `5845f5d…` `dirty=false`. All 8 exited 0
with `verdict=passed`, `candidateCount` 4, recordedActions 4 / 4, entryCount 15,
and connection `connected`. Every first window excludes action 0/2/0 and event
0/0/0, and every second window action 4/2/0 and event 0/0/0, with
`discardsAfterFirstRead=0`.

| Loop run | runId | First `from` | Second `until` | Discards inside the window (both reads) |
| --- | --- | --- | --- | --- |
| 1 | run-mtzo36wk-5f7595cd | 1789295102318 | 1789295121968 | none |
| 2 | run-mtzo4wcl-d6fb4882 | 1789295184840 | 1789295211669 | **1:** `{"type":"recording.event_discarded","entryId":"90ac7c6d-260c-4f7d-a0b4-cfb60a37047f","recordingId":"client.extension-faaff681-ff29-4732-b086-8d3ac1a71e41.1789295184842","discardedActions":0,"discardedEvents":1,"sinceFinalizedMs":11}` |
| 3 | run-mtzo6tu9-617d5498 | 1789295278222 | 1789295302297 | none |
| 4 | run-mtzo8q5t-f50628e7 | 1789295364381 | 1789295397086 | **1:** `recording.event_discarded`, entryId `a0106c4d-f943-4413-94f9-b50addaa8f21`, this run's recording, `discardedActions` 0, `discardedEvents` 1, `sinceFinalizedMs` 9 |
| 5 | run-mtzoar6g-41d1ddcd | 1789295458017 | 1789295483495 | **1:** `recording.event_discarded`, entryId `1e2469ec-c571-474d-b65e-9aaa0d10ce64`, this run's recording, 0 / 1, `sinceFinalizedMs` 12 |
| 6 | run-mtzocmo7-5fb344a6 | 1789295554127 | 1789295575644 | none |
| 7 | run-mtzoel19-c90cf920 | 1789295647923 | 1789295668251 | none |
| 8 | run-mtzogmcs-70297d29 | 1789295732875 | 1789295747788 | none |

**Three of eight load runs held one evidence discard inside the window.** Each
is a `recording.event_discarded` naming the run's own recording, 9–12 ms after
finalization, with `discardedActions` 0.
- The check passed each run. It fails only a discarded action
  (`recording-discards.ts`, `lostActions`).
- If one occurs on instance A, it breaks step 4b's "zero windowed discards".
  None of A's 7 passing runs holds one.

#### Step 4b runs 9–14, and load runs 9–14

Output from `l-stage2b-a-analysis-3.txt` and `l-stage2b-load-analysis-3.txt`.
Manifests are unchanged: facility `6c22e22…` `dirty=false`, Core `5845f5d…`
`dirty=false`. `from` and `until` are epoch ms. `excluded` is written as action,
then event, each as `thisRunsRecording/noRecording/anotherRecording`.

| Instance, run | runId | Exit, verdict | candidateCount | ext / core | entryCount | 1st read: discards; from; excluded | 2nd read: discards, added; until; excluded | Connection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A 9 | run-mtzoig3q-5f0c5ac7 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789295821019; action 0/2/0, event 0/0/0 | 0, +0; 1789295837109; action 4/2/0, event 0/0/0 | connected |
| A 10 | run-mtzok6bb-36855b2d | 0, passed | 4 | 4 / 4 | 15 | 0; 1789295905786; 0/2/0, 0/0/0 | 0, +0; 1789295925109; 4/2/0, 0/0/0 | connected |
| A 11 | run-mtzom3uz-88f6cdb3 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789295992747; 0/2/0, 0/0/0 | 0, +0; 1789296016091; 4/2/0, 0/0/0 | connected |
| A 12 | run-mtzoo127-2d38bac0 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296083905; 0/2/0, 0/0/0 | 0, +0; 1789296105161; 4/2/0, 0/0/0 | connected |
| A 13 | run-mtzopz1z-c3f4498b | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296175420; 0/2/0, 0/0/0 | 0, +0; 1789296197116; 4/2/0, 0/0/0 | connected |
| A 14 | run-mtzorwze-04c73626 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296267271; 0/2/0, 0/0/0 | 0, +0; 1789296290074; 4/2/0, 0/0/0 | connected |
| load 9 | run-mtzoi9f9-fe4ef2e6 | 0, passed | 4 | 4 / 4 | 16 | 0; 1789295814010; 0/2/0, 0/0/0 | 0, +0; 1789295834866; 4/2/0, 0/0/0 | connected |
| load 10 | run-mtzok4rn-e5dca896 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789295903205; 0/2/0, 0/0/0 | 0, +0; 1789295922855; 4/2/0, 0/0/0 | connected |
| load 11 | run-mtzom0wq-0c283625 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789295989002; 0/2/0, 0/0/0 | 0, +0; 1789296012841; 4/2/0, 0/0/0 | connected |
| load 12 | run-mtzonyy6-92ea136c | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296082347; 0/2/0, 0/0/0 | 0, +0; 1789296103936; 4/2/0, 0/0/0 | connected |
| load 13 | run-mtzopx9l-2fa03536 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296174007; 0/2/0, 0/0/0 | 0, +0; 1789296196470; 4/2/0, 0/0/0 | connected |
| load 14 | run-mtzorwnk-21c04cd1 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296267276; 0/2/0, 0/0/0 | 0, +0; 1789296289908; 4/2/0, 0/0/0 | connected |

Every one of these 12 runs has all four Flow actions `succeeded`. None holds a
discard inside the window. Across load runs 1–14, only the three evidence
discards listed above were kept.

#### Step 4b runs 15–20, and load runs 15–20

Output from `l-stage2b-a-analysis-4.txt` and `l-stage2b-load-analysis-4.txt`. The
manifests, and the notation, are as above.

| Instance, run | runId | Exit, verdict | candidateCount | ext / core | entryCount | 1st read: discards; from; excluded | 2nd read: discards, added; until; excluded | Connection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A 15 | run-mtzotwa3-cccead1b | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296365009; 0/2/0, 0/0/0 | 0, +0; 1789296385956; 4/2/0, 0/0/0 | connected |
| A 16 | run-mtzovz2m-8352dc57 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296453062; 0/2/0, 0/0/0 | 0, +0; 1789296473187; 4/2/0, 0/0/0 | connected |
| A 17 | run-mtzoxvh5-a7fdb136 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296545085; 0/2/0, 0/0/0 | 0, +0; 1789296568074; 4/2/0, 0/0/0 | connected |
| A 18 | run-mtzozweh-f7189114 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296637123; 0/2/0, 0/0/0 | 0, +0; 1789296662630; 4/2/0, 0/0/0 | connected |
| A 19 | run-mtzp1xbd-cf9cf4b0 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296735433; 0/2/0, 0/0/0 | 0, +0; 1789296753879; 4/2/0, 0/0/0 | connected |
| A 20 | run-mtzp3uzw-3ff31bdc | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296825011; 0/2/0, 0/0/0 | 0, +0; 1789296849860; 4/2/0, 0/0/0 | connected |
| load 15 | run-mtzotw0z-0bea1fb4 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296364912; 0/2/0, 0/0/0 | 0, +0; 1789296385928; 4/2/0, 0/0/0 | connected |
| load 16 | run-mtzovz0v-167d429d | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296453052; 0/2/0, 0/0/0 | 0, +0; 1789296473195; 4/2/0, 0/0/0 | connected |
| load 17 | run-mtzoxvf9-60048070 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296545026; 0/2/0, 0/0/0 | 0, +0; 1789296568099; 4/2/0, 0/0/0 | connected |
| load 18 | run-mtzozwgc-551d67df | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296636945; 0/2/0, 0/0/0 | 0, +0; 1789296662742; 4/2/0, 0/0/0 | connected |
| load 19 | run-mtzp1x86-565dcf49 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296733207; 0/2/0, 0/0/0 | 0, +0; 1789296752716; 4/2/0, 0/0/0 | connected |
| load 20 | run-mtzp3tzw-581b666f | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296823689; 0/2/0, 0/0/0 | 0, +0; 1789296848868; 4/2/0, 0/0/0 | connected |

None of these 12 runs holds a discard inside the window.

**The two instances ran in lockstep; a timing observation, not investigated.** A
and load runs began and ended within seconds of each other throughout. Runs 15–18
ended at the identical status-line time on both instances, for example
`03:48:05.8102884`. This is also why `otherLabsBefore` reads 0 on some runs: at the
moment of sampling, the other instance was between runs.

#### Step 4b runs 21–24, and load runs 21–26

Output from `l-stage2b-a-analysis-5.txt` and `l-stage2b-load-analysis-5.txt`. The
manifests, and the notation, are as above.

| Instance, run | runId | Exit, verdict | candidateCount | ext / core | entryCount | 1st read: discards; from; excluded | 2nd read: discards, added; until; excluded | Connection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A 21 | run-mtzp5xgj-850fd333 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296919243; 0/2/0, 0/0/0 | 0, +0; 1789296937358; 4/2/0, 0/0/0 | connected |
| A 22 | run-mtzp7s5q-e008c560 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297006277; 0/2/0, 0/0/0 | 0, +0; 1789297029088; 4/2/0, 0/0/0 | connected |
| A 23 | run-mtzp9qw1-f52139be | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297093449; 0/2/0, 0/0/0 | 0, +0; 1789297115473; 4/2/0, 0/0/0 | connected |
| A 24 | run-mtzpbmjm-3c4166e1 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297190550; 0/2/0, 0/0/0 | 0, +0; 1789297211343; 4/2/0, 0/0/0 | connected |
| load 21 | run-mtzp5vsc-69176991 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789296917408; 0/2/0, 0/0/0 | 0, +0; 1789296936132; 4/2/0, 0/0/0 | connected |
| load 22 | run-mtzp7rd6-bebf247e | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297004017; 0/2/0, 0/0/0 | 0, +0; 1789297028572; 4/2/0, 0/0/0 | connected |
| load 23 | run-mtzp9qe2-263b865f | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297093705; 0/2/0, 0/0/0 | 0, +0; 1789297115613; 4/2/0, 0/0/0 | connected |
| load 24 | run-mtzpbmt1-e94db66b | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297189491; 0/2/0, 0/0/0 | 0, +0; 1789297211300; 4/2/0, 0/0/0 | connected |
| load 25 | run-mtzpdon1-d5b86369 | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297285418; 0/2/0, 0/0/0 | 0, +0; 1789297307306; 4/2/0, 0/0/0 | connected |
| load 26 | run-mtzpfpwo-adcd99fc | 0, passed | 4 | 4 / 4 | 15 | 0; 1789297379957; 0/2/0, 0/0/0 | 0, +0; 1789297397696; 4/2/0, 0/0/0 | connected |

#### Step 4b result, judged per run: 23 of 24 under two-instance load

- **Runs 1–7 and 9–24 pass every criterion:**
  - `exit=0` and `candidateCount` 4;
  - all four Flow actions `succeeded`;
  - `recordedActions` extension equal to Core, 4 / 4;
  - zero discards inside the window at both reads, with `discardsAfterFirstRead` 0;
  - `extensionConnectionAfterStop` `connected`.
- **Every one of the 23 shows the probe and Flow-lane confirmations excluded by
  the window.** The first read excludes 2 action discards naming no recording.
  The second excludes those 2, plus 4 naming this run's recording.
- **Entry counts, reported rather than compared:** 15 in 22 runs, 16 in run 7.
- **Run 8 failed `process.startup`** (`Timed out waiting for http://127.0.0.1:55337`)
  before any recording. It is rerun alone after plan A.
- **The load instance: 26 of 26 exited 0** in the same window (loop runs 1–26),
  each with `candidateCount` 4 and 4 / 4 actions. Three held one evidence discard
  inside the window, and the check correctly did not fail them.

#### B, under load: W18 `auth-gate --flow` runs 1–2

- **Command:** `lab run auth-gate --flow --target isolated`, with
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` set from the worktree's constant
  (`secretSupplied=True`).
- **Manifests:** both record facility `6c22e22…` `dirty=false` and Core
  `5845f5d…` `dirty=false`.

| Run | runId | Exit | candidateCount | Flow status and actions | extractionCount | recordedActions | entryCount | 1st read: discards; window | 2nd read: discards, added; window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-mtzpdomm-f361e5bd | 1 | 3 | `succeeded`: `web.dom.type:succeeded`, `web.dom.type:succeeded`, `web.dom.click:succeeded` | 0 | 3 / 3 | 24 | 1 (below); from 1789297285325, action 0/2/0, event 0/0/0 | the same 1, +0; until 1789297311552, action **3**/2/0, event 0/0/0 |
| 2 | run-mtzpfsg3-0ffab8dc | 1 | 3 | the same | 0 | 3 / 3 | 24 | 0; from 1789297380017, 0/2/0, 0/0/0 | 0, +0; until 1789297400875, 3/2/0, 0/0/0 |

Quoted, and identical in both runs except where noted:

- **The dispatch event:** `runtime.dispatch {"variantId":null,"declaredSecrets":["auth-gate-password"],…}`.
- **`evaluation.json`:**
  - `verdict=failed oracleVerdict=passed reportedVerdict=passed lane=flow flowCreated=true`;
  - `failed invariant runner-verdict: expected="passed" actual="failed: runtime.behavior"`.
- **The first error:**
  `#20 error: The Flow produced 0 extraction result(s), expected 1 :: {"failureCategory":"runtime.behavior",…}`.
- **The `runtime.settle` recorded events:**
  `recordedEvents={"web.page.navigated":1,"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.dom.mutated":2,"web.tab.state_changed":1}`,
  and `extensionConnectionAfterStop="connected"`.
- **Run 1's in-window discard:** a `recording.event_discarded` naming this run's
  recording, `discardedActions` 0, `discardedEvents` 1, `sinceFinalizedMs` 10.
  The check did not fail on it.
- **The recording steps**, from `events.ndjson` `step.start` / `step.complete`:
  `type`, `type`, `click`, `waitForState`, `extract`, `checkpoint`. The Flow has
  3 candidates: two types and a click, with no extract node.
- **The leak attestation failed in both runs.** This is a security finding.
  - `snapshots/redaction-attestation.json`, quoted from run 1:
    `{"status":"failed","literalCount":1,"scopes":[{"name":"bundle","scannedFiles":4,"scannedBytes":16255,"skippedBinaryFiles":6},{"name":"workspace","scannedFiles":37,"scannedBytes":412039,"skippedBinaryFiles":3}],"findingCount":13,"advisories":[]}`.
  - The second error:
    `#22 error: Redaction attestation found 13 file(s) holding a declared literal or left unread :: {"failureCategory":"security.redaction",…}`.
  - `run.json` `redactionState=failed`.
  - All 13 findings in each run are `"scope":"workspace"` with
    `"categories":["secret-literal"]`. Each path has the form
    `.fluxiq/artifacts/automation-studio/projects/<projectId>/objects/sha256/<2>/<2>/<hash>.json`,
    for example
    `.fluxiq/artifacts/automation-studio/projects/df618e07-49e7-49a6-938c-31d6264b23b3/objects/sha256/13/b1/13b1a8693cb74ab0273c6075988a7a110ba8c1d7b3b72b4015b7b0c0c76dd586.json`.
    - **The declared auth-gate password reached 13 of Core's persisted
      content-addressed objects in the isolated workspace, in both runs.**
    - The workspace was deleted after each run, so which object kinds hold it was
      not inspected.
  - The bundle itself holds no declared value: `l-stage2-analyse.mjs` printed
    `declared-value search: bundle files=20 hits=[]` for each run.
- **Judged against the brief's W18 checks:**
  - "the run passes": **no, in 2 of 2.** The causes are the missing extraction
    and the attestation.
  - "the username type is present": the Flow has two `web.dom.type` nodes, both
    `succeeded`. `flow-lane.json`'s `targetResolution` carries only
    `candidateCount` and `status`, so which control each node targets is **not
    observed**.
  - "the Flow starts on `/scenarios/auth-gate/`": **not observed** in these
    files. The screenshots were not opened.

**W18 run 3: `run-mtzphovv-921e9e00`, exit 1, the same shape.**
- Manifest: facility `6c22e22…` `dirty=false`, Core `5845f5d…` `dirty=false`.
- `candidateCount=3`; Flow `status=succeeded` with
  `["web.dom.type:succeeded","web.dom.type:succeeded","web.dom.click:succeeded"]`;
  `extractionCount=0`.
- recordedActions 3 / 3; entryCount 24.
- One in-window `recording.event_discarded` naming this run's recording,
  `discardedActions` 0, `sinceFinalizedMs` 9.
- Windows: first `from` 1789297466345, action 0/2/0, event 0/0/0; second `until`
  1789297494900, action 3/2/0, event 0/0/0, `discardsAfterFirstRead=0`.
- `#20 error: The Flow produced 0 extraction result(s), expected 1` (`runtime.behavior`).
- `#22 error: Redaction attestation found 13 file(s) holding a declared literal or left unread`
  (`security.redaction`), with `"workspace","scannedFiles":37,"scannedBytes":412760`.
- `declared-value search: bundle files=20 hits=[]`.

**W18 result: 0 of 3 pass.**
- Every run's Flow built 3 candidates and ran them all to `succeeded`, with the
  oracle `passed`.
- Every run failed on the missing extraction (`runtime.behavior`), and its leak
  attestation failed with 13 workspace findings.
- The discard check did not fail any W18 run.

#### B, under load: W19 `auth-gate --flow --variant expired` runs 1–2

- **Command:** `lab run auth-gate --flow --variant expired --target isolated`,
  with the auth-gate secret supplied.
- **Manifests:** facility `6c22e22…` `dirty=false`, Core `5845f5d…` `dirty=false`.

| Run | runId | Exit | candidateCount | Flow actions | Runner failure category (`failed invariant runner-verdict`) |
| --- | --- | --- | --- | --- | --- |
| 1 | run-mtzpjpwv-2faafe75 | 1 | 3 | `web.dom.type:succeeded`, `web.dom.type:succeeded`, **`web.dom.click:failed`** | `failed: gateway.connection` |
| 2 | run-mtzplsg0-94c582a3 | 1 | 3 | the same | `failed: security.redaction` |

Quoted, and the same in both runs:

- **`flow-lane.json`:** `status=failed`, `extractionCount=0`, `harnessActivations=2`.
  The click's failure:
  `{"category":"auth_required","code":"web.auth.required","retryable":false,"stage":"confirmation","expected":"the page URL is /scenarios/auth-gate/account","actual":"the page is not at the URL the Flow claimed; the document is a sign-in gate, so the session has probably expired"}`.
- **`evaluation.json`:**
  `oracleVerdict=passed reportedVerdict=failed lane=flow variant=expired flowCreated=true automationFailureReported={"category":"auth_required","code":"web.auth.required"} automationFailureExpected={"category":"auth_required"}`.
- **`run.json`:** `automationFailure={"category":"auth_required","code":"web.auth.required"}`,
  `redactionState=failed`.
- **The dispatch event:** `{"variantId":"expired","declaredSecrets":["auth-gate-password"],…}`.
- **`runtime.settle`:** recordedActions 3 / 3, entryCount 24,
  `extensionConnectionAfterStop="connected"`.
- **The leak attestation failed:** `#… error: Redaction attestation found 13 file(s) holding a declared literal or left unread`
  (`security.redaction`), with all findings `workspace` / `secret-literal`.
- **The bundles hold no declared value:** `declared-value search: bundle files=19 hits=[]`.

**Run 1's second discard read could not read Core's audit log.** Quoted from
`events.ndjson`:

```
#18 runtime.settle recordingDiscards=[] recordingDiscardWindow={"from":1789297559278,"excluded":{"recording.action_discarded":{"thisRunsRecording":0,"noRecording":2,"anotherRecording":0},"recording.event_discarded":{"thisRunsRecording":0,"noRecording":0,"anotherRecording":0}}}
#22 runtime.settle (second read) recordingDiscards=[] recordingDiscardWindow={"from":1789297559278,"until":1789297583625,"excluded":null} discardsAfterFirstRead=0
#23 error: Core's gateway snapshot carried no audit log, so a recorded action it discarded cannot be ruled out :: {"failureCategory":"gateway.connection","recordingDiscards":[],…}
```

- **This is the check's fail-closed branch** (`recording-discards.ts`,
  `if (!read) … "gateway.connection"`). It is not a probe or Flow-lane
  confirmation counted as a loss. No discard entry exists to report, since
  `excluded` is `null`.
- **So it is outside the stop condition, and the campaign continued.** The
  driver's stop test matches only `Core discarded recorded actions`.
- **Run 2's second read did read the log:** `until` 1789297680609, action
  3/2/0, event 0/0/0, `discardsAfterFirstRead=0`. Its first read: `from`
  1789297660640, action 0/2/0, event 0/0/0.
- **A single observation.**

**W19 run 3: `run-mtzpnukz-5f01eb09`, exit 1, the same shape as run 2.**
- Manifest: facility `6c22e22…` `dirty=false`, Core `5845f5d…` `dirty=false`.
- The click `failed` with
  `{"category":"auth_required","code":"web.auth.required","retryable":false,"stage":"confirmation",…}`,
  and the runner's invariant reads `actual="failed: security.redaction"`.
- One in-window `recording.event_discarded` naming this run's recording,
  `discardedActions` 0, `sinceFinalizedMs` 10.
- Windows: first `from` 1789297748008, action 0/2/0, event 0/0/0; second `until`
  1789297774268, action 3/2/0, event 0/0/0, `discardsAfterFirstRead=0`.
- `redaction-attestation.json` `"status":"failed" … "findingCount":13`.
- `declared-value search: bundle files=19 hits=[]`.

**W19 `expired` result: 0 of 3 exit 0.** Against the brief's checks:
- **the click attempt `failed`: yes, 3 of 3;**
- **`auth_required` / `web.auth.required`: yes, 3 of 3**, in `flow-lane.json`,
  `evaluation.json` `automationFailureReported` and `run.json` `automationFailure`;
- **`comparisonStatus` `blocked`: not observed, 0 of 3.** A search of every file
  in the three bundles for `comparisonStatus` found `files with comparisonStatus: 0`
  in each;
- **no extract attempt: yes, 3 of 3.** `extractionCount=0`, and 0
  `web.dom.extract` actions in `flow-lane.json`.
- **What fails the runs:**
  - the leak attestation, 3 of 3;
  - in run 1 also the unreadable audit log.

  The run event sequence confirms it. Run 2 has
  `#20 runtime.settle The generated Flow ran and met the workflow's expectations`,
  `#21 final Scenario completed`, then
  `#23 error Redaction attestation found 13 file(s) …`.

#### B, under load: W25 `delayed-ui --flow` ×3 and `--variant too-slow` ×3

Every manifest records facility `6c22e22…` `dirty=false` and Core `5845f5d…`
`dirty=false`. Every run has `redactionState=not_applicable` and
`declared-value search: bundle files=19 hits=[]`.

| Row, run | runId | Exit | candidateCount | Flow actions | Reported / expected failure | Runner error |
| --- | --- | --- | --- | --- | --- | --- |
| W25 1 | run-mtzppvb9-d7744875 | 1 | 2 | `web.dom.click:succeeded`, `web.dom.click:succeeded` | none / none | `The Flow did not produce a web.dom.wait_for_selector action with outcome succeeded; it produced web.dom.click:succeeded, web.dom.click:succeeded` (`action.dispatch`) |
| W25 2 | run-mtzprgfq-4d8ae34e | 1 | 2 | the same | none / none | the same |
| W25 3 | run-mtzpta5e-42510b80 | 1 | 2 | the same | none / none | the same |
| too-slow 1 | run-mtzpuzyu-3654405a | 1 | 2 | `web.dom.click:succeeded`, **`web.dom.click:failed`** | `target_not_found` / `web.target.not_found`, against expected `timeout` / `web.action.timeout` | `The Flow reported failure category target_not_found, expected timeout` (`runtime.behavior`) |
| too-slow 2 | run-mtzpwt5c-cf2cec47 | 1 | 2 | the same | the same | the same |
| too-slow 3 | run-mtzpynh6-84b37574 | 1 | 2 | the same | the same | the same |

- **The recording, in every W25 run:** `runtime.settle` has
  `recordedActions={"extension":2,"core":2}`,
  `recordedEvents={"web.element.clicked":2,"web.dom.mutated":1,"web.tab.state_changed":1}`
  and entryCount 8, with `proposalIssues` `Compacted 3 high-frequency state entries…`.
- **The too-slow click's failure,** quoted from run 1:
  `{"category":"target_not_found","code":"web.target.not_found","retryable":true,"stage":"target_resolution","expected":"an element matching selector [data-testid=\"late-action\"], visual target 303,146 (refused div[data-testid=\"late-content\"] scoring -0.44), element fingerprint","actual":"nothing matched; 1 control(s) of the same family are on the page; best scored -0.29",…}`.
- **Windows.** No first read excluded anything: action 0/0/0, event 0/0/0.
  - `delayed-ui`'s recording script has no `type` step, so the runner's Core probe
    does not run (`proveCoreActionRoundTrip` returns when no `type` step has a CSS
    target). The bundles begin at the recording, with the first `runtime.settle`
    at `#10`.
  - The second read excluded action 2/0/0 in each W25 run and 1/0/0 in each
    too-slow run, matching the Flow's succeeded actions. Every run has
    `discardsAfterFirstRead=0` and 0 in-window discards.
  - The `from` / `until` pairs, in run order:
    - W25: 1789297839053 / 1789297855857, 1789297919413 / 1789297942374,
      1789298001439 / 1789298021026;
    - too-slow: 1789298088996 / 1789298107249, 1789298167163 / 1789298191399,
      1789298250084 / 1789298275278.
- **Judged against option 2's Lab proof:**
  - `delayed-ui --flow` should show `click`, `wait_for_selector`, `click`. **0 of
    3:** no wait node was proposed. The proposal has 2 candidates, both clicks,
    although the recording holds one `web.dom.mutated` event.
  - `--variant too-slow` should show `timeout` / `web.action.timeout`. **0 of 3:**
    each reported `target_not_found`, the same result Stage 1's run 3 gave.

#### The load instance after run 26

Loop runs 27–37 all exited 0 with `verdict=passed`, facility `6c22e22…`
`dirty=false`, Core `5845f5d…` `dirty=false`, `candidateCount` 4, 4 / 4 actions and
connection `connected`. Every first window excludes action 0/2/0 and event 0/0/0.
Every second window excludes action 4/2/0 and event 0/0/0, with
`discardsAfterFirstRead=0`.

| Loop run | runId | entryCount | First `from` | Second `until` | Discards inside the window |
| --- | --- | --- | --- | --- | --- |
| 27 | run-mtzphn90-c4e7c499 | 15 | 1789297465556 | 1789297491558 | none |
| 28 | run-mtzpjnsa-0d2c035f | 15 | 1789297554817 | 1789297575728 | none |
| 29 | run-mtzplg4w-fb4c1790 | 15 | 1789297639406 | 1789297668023 | 1 `recording.event_discarded`, this run's recording, `discardedActions` 0, `sinceFinalizedMs` 8 |
| 30 | run-mtzpnfdh-f2523007 | 15 | 1789297728045 | 1789297759694 | 1 `recording.event_discarded`, this run's recording, 0 actions, `sinceFinalizedMs` 14 |
| 31 | run-mtzppeph-757e82cc | 15 | 1789297821435 | 1789297845499 | none |
| 32 | run-mtzpr8my-e121b51e | 15 | 1789297906381 | 1789297939501 | 1 `recording.event_discarded`, this run's recording, 0 actions, `sinceFinalizedMs` 9 |
| 33 | run-mtzpt9k2-db1c030b | 15 | 1789298004330 | 1789298024371 | none |
| 34 | run-mtzpv2jx-a39af850 | 16 | 1789298093813 | 1789298112294 | none |
| 35 | run-mtzpwyvo-b7528b62 | 15 | 1789298179812 | 1789298201776 | none |
| 36 | run-mtzpyw43-6749e137 | 15 | 1789298269983 | 1789298287062 | none |
| 37 | run-mtzq0nlc-4fd1c429 | 15 | 1789298340979 | 1789298356408 | none |

- **I stopped the load after plan A** by writing `l-stage2b-load.stop` at
  04:18:52. The loop finished run 37 and wrote `finished=2026-09-13T04:19:27`.
- **Load total: 37 of 37 exited 0.**
  - 6 held one in-window evidence discard: loop runs 2, 4, 5, 29, 30 and 32, each
    `sinceFinalizedMs` 8–14, and never failing the run.
  - entryCount was 16 in loop runs 9 and 34, and 15 in the rest.
- **No pause was needed.** The load status file has 0 `pause` lines.

#### Plan A result, under two-instance load (03:24:47–04:18:04)

- **Step 4b: 23 of 24.** Run 8 hit `process.startup`; it is rerun alone.
- **W18: 0 of 3.** In every run all 3 Flow candidates succeeded, but the missing
  extraction failed the run, and the leak attestation found the password in 13
  Core workspace objects.
- **W19 `expired`: 0 of 3 exit 0.** The expected outcome held 3 of 3: the click
  failed with `auth_required` / `web.auth.required`, and there was no extract.
  But `comparisonStatus` appears nowhere in the bundles. Every run failed
  `security.redaction`, and run 1 also failed on the audit log it could not read.
- **W25 unarmed: 0 of 3.** No wait node was proposed.
- **W25 `too-slow`: 0 of 3.** Each reported `target_not_found` where `timeout` was
  expected.
- **No run was failed by a probe or Flow-lane confirmation.** The campaign stop
  file was never written.

#### Alone: step 4b run 8, rerun

- **Setup:** label `l-stage2b-c`, runs dir `F:\fxlab-runs\stage2b\c`, worktree
  `F:\fxlab\fxlab-7263534`. The chained driver log records `labs before: 0`.
- **Status line:**
  `name=step4b-rerun8 index=1 … seconds=68.2 exit=0 otherLabsBefore=0 freeGBBefore=15.72`.
- **Result: `run-mtzq2pea-6aced971`, exit 0, `verdict=passed`.**
  - Manifest: facility `6c22e22…` `dirty=false`, Core `5845f5d…` `dirty=false`.
  - `candidateCount=4`; `["web.dom.type:succeeded","web.dom.select:succeeded","web.dom.type:succeeded","web.dom.click:succeeded"]`.
  - recordedActions 4 / 4; entryCount 15; `connected`.
  - Windows: first `from` 1789298437233, action 0/2/0, event 0/0/0, 0 discards;
    second `until` 1789298451777, action 4/2/0, event 0/0/0, 0 discards,
    `discardsAfterFirstRead=0`.
- **Run 8's `process.startup` timeout did not reproduce alone.** This is a single
  observation. Step 4b under load still stands at 23 of 24.

#### Alone: W10 `navigation --flow --variant broken-link` ×3, and W27 `failure-surfaces --flow --variant blocked-url` run 1

Every manifest records facility `6c22e22…` `dirty=false` and Core `5845f5d…`
`dirty=false`. Every run has `otherLabsBefore=0`, `redactionState=not_applicable`
and no declared-value hit.

| Row, run | runId | Exit, verdict | candidateCount | Flow actions | Click failure: category / code / stage / actual | ext / core | entryCount | Windows (`from` / `until`; all excluded counts) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W10 1 | run-mtzq46fg-844a05d2 | 0, passed | 1 | `web.dom.click:failed` | `navigation_unexpected` / `web.navigation.unexpected` / `confirmation` / `the server answered HTTP 404 for /scenarios/navigation/link-retired` | 1 / 1 | 24 | 1789298501818 / 1789298515555; all 0 |
| W10 2 | run-mtzq5gsw-3651bac6 | 0, passed | **2** | `web.dom.click:failed` | the same | 2 / 2 | 26 | 1789298562464 / 1789298579749; all 0 |
| W10 3 | run-mtzq6u1y-d46f1015 | 0, passed | 1 | `web.dom.click:failed` | the same | 1 / 1 | 24 | 1789298624414 / 1789298643301; all 0 |
| W27 1 | run-mtzq87ir-41cca849 | 0, passed | 1 | `web.dom.click:failed` | `navigation_unexpected` / `web.navigation.unexpected` / `confirmation` / `the server answered HTTP 403 for /scenarios/failure-surfaces/blocked` | 1 / 1 | 5 | 1789298691040 / 1789298702375; all 0 |

- **`evaluation.json`,** quoted from W10 run 1:
  `verdict=passed oracleVerdict=passed reportedVerdict=failed lane=flow variant=broken-link flowCreated=true automationFailureReported={"category":"navigation_unexpected","code":"web.navigation.unexpected"} automationFailureExpected={"category":"navigation_unexpected","code":"web.navigation.unexpected"}`.
  W27's has `variant=blocked-url` and the same pair.
- **Every run's discards:** 0 at both reads, `discardsAfterFirstRead=0`, and both
  windows exclude nothing.
  - These scenarios have no `type` recording step, so there is no probe.
  - A failed action sends no runtime confirmation
    (`server-command-channel.ts:212`, `if (result.status !== "succeeded") return;`).
- **W10 run 2 proposed 2 candidates,** where runs 1 and 3 proposed 1. It recorded
  2 / 2 actions and 26 entries. Only the first click ran, and it failed as
  expected.

#### Alone: W27 runs 2–3, `sensitive-input` ×3, W24 `intermediate-state --flow` runs 1–2

Every manifest records facility `6c22e22…` `dirty=false` and Core `5845f5d…`
`dirty=false`, and every run has `otherLabsBefore=0` and exit 0.

| Row, run | runId | Verdict | Lane, candidateCount | Actions | ext / core | entryCount | Windows (`from` / `until`; excluded action, event) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W27 2 | run-mtzq9h9g-065a41b9 | passed | flow, 1 | `web.dom.click:failed`, `navigation_unexpected` / `web.navigation.unexpected` / `confirmation` / `the server answered HTTP 403 for /scenarios/failure-surfaces/blocked` | 1 / 1 | 5 | 1789298749388 / 1789298761246; all 0 |
| W27 3 | run-mtzqaqp4-adcde216 | passed | flow, 1 | the same | 1 / 1 | 5 | 1789298807496 / 1789298819045; all 0 |
| sensitive-input 1 | run-mtzqbzjb-568d6280 | passed | recording, — | `evaluation.json` actions `web.browser.navigate`, `web.dom.type` (the probe) | 3 / 3 | 10 | 1789298870858 / **no `until`**; 1st 0/2/0, 0/0/0; 2nd 0/2/0, 0/0/0 |
| sensitive-input 2 | run-mtzqd3ss-ad3c6812 | passed | recording, — | the same | 3 / 3 | 10 | 1789298924723 / no `until`; the same |
| sensitive-input 3 | run-mtzqe8ui-93f57d25 | passed | recording, — | the same | 3 / 3 | 10 | 1789298975923 / no `until`; the same |
| W24 1 | run-mtzqfcen-4959e698 | passed | flow, 3 | `web.dom.type:succeeded`, `web.dom.type:succeeded`, `web.dom.click:succeeded` | 3 / 3 | 13 | 1789299026108 / 1789299038607; 1st 0/2/0, 0/0/0; 2nd 3/2/0, 0/0/0 |
| W24 2 | run-mtzqgpyt-916e41cf | passed | flow, 3 | the same | 3 / 3 | 13 | 1789299091472 / 1789299104581; 1st 0/2/0, 0/0/0; 2nd 3/2/0, 0/0/0 |

Every run above holds 0 discards inside its window at both reads, and
`discardsAfterFirstRead=0`.

**W10 and W27 result: 3 of 3 each.** `navigation_unexpected` /
`web.navigation.unexpected` was reported as expected, with the click `failed`.
The 404 came from `/scenarios/navigation/link-retired`, the 403 from
`/scenarios/failure-surfaces/blocked`.

**`sensitive-input` result: 3 of 3.**
- **The leak attestation passed in each run.** Run 1's
  `snapshots/redaction-attestation.json`, quoted:
  `{"status":"passed","literalCount":2,"scopes":[{"name":"bundle","scannedFiles":3,"scannedBytes":9934,"skippedBinaryFiles":0},{"name":"workspace","scannedFiles":17,"scannedBytes":196934,"skippedBinaryFiles":2}],"findingCount":0,"advisories":[]}`.
  Runs 2 and 3 have the same shape, with `scannedBytes` 9859 / 196946 and
  9849 / 196698, and `findingCount` 0.
- `run.json` `redactionState=verified`; `evaluation.json`
  `verdict=passed oracleVerdict=passed lane=recording`.
- **No declared value appears in any bundle file.** `l-stage2-analyse.mjs` counted
  auth-gate's constant and `sensitive-input`'s two replaced literals, and printed
  `declared-value search: bundle files=13 hits=[]` for each run.
- **The windows.** On this recording lane no Flow is dispatched, so the second
  read has no `until`. That is the open-ended window
  `recording-discards.ts` describes. Both reads excluded the probe's 2
  confirmations.

**W24 unarmed: 3 of 3.**
- Runs 1–2, above, and run 3, `run-mtzqi4sy-1f1b37fb`: each exit 0,
  `verdict=passed`,
  `evaluation.json` `oracleVerdict=passed reportedVerdict=passed lane=flow flowCreated=true`,
  Flow `status=succeeded`.
- Run 3's manifest records facility `6c22e22…` `dirty=false` and Core `5845f5d…`
  `dirty=false`. It has `candidateCount=3`,
  `["web.dom.type:succeeded","web.dom.type:succeeded","web.dom.click:succeeded"]`,
  3 / 3 and entryCount 13.
- Run 3's windows: first `from` 1789299156639, action 0/2/0, event 0/0/0; second
  `until` 1789299168133, action 3/2/0, event 0/0/0. It had 0 discards and
  `discardsAfterFirstRead=0`.

#### Alone: smoke gate 5.0, once

- **Bench:** `lab bench --corpus smoke --repeat 2 --target isolated`. Status line:
  `name=smoke50 index=1 … seconds=158.9 exit=0 otherLabsBefore=0 freeGBBefore=15.70`.
  Result line:
  ```
  {"status":"passed","benchId":"bench-mtzqjhxs-81f730f9","directory":"F:\\fxlab-runs\\stage2b\\c\\bench\\bench-mtzqjhxs-81f730f9",…,"results":2,"runs":4,"passed":4,"skipped":0,"notExecuted":2,"actionsExecuted":4}
  ```
- **Compare:**
  `node F:\fxlab\fxlab-7263534\packages\test-runner\dist\cli.js compare F:\!FluxIQWebExtension\test-runs\bench\bench-mtxoim0b-8ca4952c F:\fxlab-runs\stage2b\c\bench\bench-mtzqjhxs-81f730f9`,
  with no `FLUXIQ_LAB_INSTANCE`. Its status line:
  `name=compare-smoke50 index=1 … seconds=1.1 exit=0`. Output:
  ```
  {"baselineReportId":"bench-mtxoim0b-8ca4952c","candidateReportId":"bench-mtzqjhxs-81f730f9","outcome":"equivalent","advisory":["run-duration-p95"],"metrics":[{"metric":"rate:recording:initialExecutionSuccess","baseline":1,"candidate":0.5,"tolerance":0.5,"outcome":"equivalent"},{"metric":"rate:recording:deterministicReplaySuccess","baseline":1,"candidate":0.5,"tolerance":0.5,"outcome":"equivalent"},{"metric":"rate:recording:falseFailure","baseline":0,"candidate":0,"tolerance":1,"outcome":"equivalent"},{"metric":"rate:recording:harnessActivation","baseline":0,"candidate":0,"tolerance":0.5,"outcome":"equivalent"},{"metric":"action-latency-p95:web.browser.navigate","baseline":1684,"candidate":1660,"tolerance":421,"outcome":"equivalent"},{"metric":"action-latency-p95:web.dom.type","baseline":1432,"candidate":1419,"tolerance":358,"outcome":"equivalent"},{"metric":"run-duration-p95","baseline":57213,"candidate":39366,"tolerance":14303.25,"outcome":"improved"}]}
  ```
- **Smoke gate 5.0 is met: `"outcome":"equivalent"`, exit 0.** It ran alone, as
  Part 3's latency rule requires. This is a single observation.
  - Navigate p95 is 1660 against 1684; in Stage 1, run under load, it was
    `regressed` at 2609.
  - The success rates of 0.5 match Stage 1's candidate: the W28 runs execute 0
    actions.
- **`report.md`,** quoted:
  - `4 runs evaluated: 4 passed, 0 did not. 0 results skipped (0 runs); a skipped run is never counted as a pass.`
  - `FluxIQ executed **4 actions** across 4 evaluated runs, and **executed nothing at all in 2 of those 4**.`
  - Rates, recording lane: `initialExecutionSuccess | workflows | 1 | 2 | 1 | 2 | 0.500`,
    `deterministicReplaySuccess | runs | 1 | 2 | 1 | 2 | 0.500`,
    `falseFailure | runs | 0 | 2 | 0 | 1 | 0.000`,
    `harnessActivation | runs | 0 | 4 | 2 | 2 | 0.000`.
- **The bench's four runs,** each under `F:\fxlab-runs\stage2b\c\`, all
  `verdict=passed`, facility `6c22e22…` `dirty=False`, Core `5845f5d…`
  `dirty=False`, path `F:\fxlab\!FluxIQ`:

  | Row, repeat | runId | Actions FluxIQ executed | First window | Second window |
  | --- | --- | --- | --- | --- |
  | W01 0 | run-mtzqjhxv-33caf357 | 2 | from 1789299218171, action 0/2/0, event 0/0/0 | the same (no `until`), `discardsAfterFirstRead` 0 |
  | W01 1 | run-mtzqkwtw-261fbf98 | 2 | from 1789299289175, action 0/2/0, event 0/0/0 | the same, 0 |
  | W28 0 | run-mtzqk73a-e8313bc7 | 0 | from 1789299250173, all 0 | the same, 0 |
  | W28 1 | run-mtzqls2z-e061735a | 0 | from 1789299326574, all 0 | the same, 0 |

  Each read holds 0 discards.

**Plan C result, alone (04:19:53–04:35:37):**
- step 4b run 8 rerun: 1 of 1;
- W10 `broken-link`: 3 of 3;
- W27 `blocked-url`: 3 of 3;
- `sensitive-input`: 3 of 3, attestation passed, 0 value hits;
- W24 unarmed: 3 of 3;
- smoke gate 5.0: `equivalent`.

No discard in any window, and no discard-check failure.

#### Alone: the week1 bench `--repeat 1` (in progress)

- **Command:** `lab bench --corpus week1 --repeat 1 --target isolated`, headed by
  default, with the auth-gate secret supplied. Label `l-stage2b-d`, runs dir
  `F:\fxlab-runs\stage2b\d`, started 04:36:04 with `labs before: 0`.
- **Discard failures:** a 30-second scan of every `events.ndjson` under
  `F:\fxlab-runs\stage2b\d` for an `error` event matching
  `Core discarded recorded actions` has found none so far.
- **Interim, the first 20 run manifests,** listed in start order. Every one
  records facility `6c22e22…` `dirty=False` and Core `5845f5d…` `dirty=False`.
  Bundles are under `F:\fxlab-runs\stage2b\d\`. The failure is the runner's
  failed invariant and the error summary; `reported` is
  `evaluation.json` `automationFailureReported`.

  | Started (Z) | runId | Scenario / variant / lane | Verdict | Failure |
  | --- | --- | --- | --- | --- |
  | 11:36:21 | run-mtzqnj6s-310ebec0 | basic-form / — / recording | passed | — |
  | 11:36:53 | run-mtzqo7cg-bcf064f5 | basic-form / — / flow | passed | — |
  | 11:37:43 | run-mtzqpa2t-e7ce47b4 | keyboard-forms / — / recording | passed | — |
  | 11:38:23 | run-mtzqq4oa-287f35af | keyboard-forms / — / flow | failed | `runtime.behavior`: `The Flow reported an unexpected output_not_observed failure`; reported `{"category":"output_not_observed","code":"output_confirmation.not_received"}` |
  | 11:39:23 | run-mtzqrf3t-fa893ed0 | keyboard-forms / — / recording | passed | — |
  | 11:40:03 | run-mtzqs9za-252209c8 | keyboard-forms / — / flow | failed | `runtime.behavior`: `The generated Flow ran, but the fixture's expected final state did not hold afterwards` |
  | 11:40:55 | run-mtzqtebw-63ec0907 | product-catalog / — / recording | passed | — |
  | 11:41:13 | run-mtzqts1z-3d425b18 | product-catalog / — / flow | passed | — |
  | 11:41:33 | run-mtzqu7wl-6240a487 | product-catalog / text-variant / flow | passed | — |
  | 11:41:57 | run-mtzqupxd-4ec51d67 | product-catalog / — / recording | failed | `runtime.behavior`: `Scenario fact failed: page-status` |
  | 11:42:20 | run-mtzqv7la-ffe52e7e | product-catalog / — / flow | failed | `runtime.behavior`: `Scenario fact failed: page-status` |
  | 11:42:41 | run-mtzqvo2d-47b20207 | product-catalog / short-catalog / flow | failed | `runtime.behavior`: `Scenario fact failed: page-status` |
  | 11:43:04 | run-mtzqw5ww-eb8ba031 | product-catalog / — / recording | passed | — |
  | 11:43:26 | run-mtzqwmlz-d34b5d1a | product-catalog / — / flow | passed | — |
  | 11:43:45 | run-mtzqx1n6-4bbbc368 | product-catalog / no-results / flow | passed | — |
  | 11:44:09 | run-mtzqxjr4-86223960 | product-catalog / — / recording | failed | `process.startup`: `Timed out waiting for http://127.0.0.1:60234` |
  | 11:45:10 | run-mtzqyv91-b613aa37 | product-catalog / — / flow | failed | `runtime.behavior`: `Scenario fact failed: page-status` |
  | 11:45:32 | run-mtzqzc7j-07657e86 | data-table / — / recording | passed | — |
  | 11:45:53 | run-mtzqzs6u-48c57af2 | data-table / — / flow | passed | — |
  | 11:46:12 | run-mtzr070c-dfb91621 | data-table / column-reorder / flow | passed | — |

  The bench's `report.md` names each row; these rows are matched to corpus rows
  once it is written. At 04:56:01 there were 33 run manifests: 20 passed and 13
  failed.

- **Interim, run manifests 21–48,** listed the same way. Every one records
  facility `6c22e22…` `dirty=False` and Core `5845f5d…` `dirty=False`.

  | Started (Z) | runId | Scenario / variant / lane | Verdict | Failure |
  | --- | --- | --- | --- | --- |
  | 11:46:34 | run-mtzr0nsv-482a2714 | data-table / — / recording | passed | — |
  | 11:47:06 | run-mtzr1cse-d5d359d4 | data-table / — / flow | failed | `runtime.behavior`: `The Flow produced 0 extraction result(s), expected 1` |
  | 11:47:52 | run-mtzr2c7v-cada89fc | navigation / — / recording | passed | — |
  | 11:48:31 | run-mtzr3602-91dbe43b | navigation / — / flow | passed | — |
  | 11:49:26 | run-mtzr4ce4-0ccbec2c | navigation / broken-link / flow | passed | reported = expected `{"category":"navigation_unexpected","code":"web.navigation.unexpected"}` |
  | 11:50:19 | run-mtzr5h85-206a41c8 | infinite-feed / — / recording | passed | — |
  | 11:50:55 | run-mtzr68uy-08cc6cc3 | infinite-feed / — / flow | failed | `action.dispatch`: `The Flow did not produce a web.dom.extract action with outcome succeeded; it produced web.dom.scroll:succeeded, web.dom.…` |
  | 11:51:42 | run-mtzr79eu-9f142b6d | infinite-feed / end-early / flow | failed | the same |
  | 11:52:30 | run-mtzr8a7j-90f8f616 | modal-flows / — / recording | failed | `action.dispatch`: `Core action did not succeed: failed: Action rejected: the element has a zero-size box`; reported `{"category":"blocked_by_capability_or_policy","code":"web.action.rejected"}` |
  | 11:53:00 | run-mtzr8xrc-01422ff9 | modal-flows / — / flow | failed | the same error |
  | 11:53:28 | run-mtzr9jmr-3433c24c | modal-flows / — / recording | passed | — |
  | 11:54:04 | run-mtzrab17-b9319755 | modal-flows / — / flow | passed | — |
  | 11:54:51 | run-mtzrbbbw-8baa698d | modal-flows / banner-absent / flow | failed | `runtime.behavior`: `The Flow reported an unexpected target_not_found failure` |
  | 11:55:39 | run-mtzrccia-805da2c1 | modal-flows / — / recording | failed | `recording.contract`: `Recorded events do not match the scenario's expected recording events` |
  | 11:56:11 | run-mtzrd12l-1ca54273 | modal-flows / — / flow | failed | the same |
  | 11:56:44 | run-mtzrdq9o-26fafdef | modal-flows / armed / flow | failed | the same; expected `{"category":"user_intervention_required"}` |
  | 11:57:16 | run-mtzreesn-ec5e8254 | multi-tab / — / recording | passed | — |
  | 11:57:57 | run-mtzrfb2j-3b702818 | multi-tab / — / flow | failed | `runtime.behavior`: `The Flow reported an unexpected target_not_found failure` |
  | 11:58:51 | run-mtzrgg5i-70dd6d6a | multi-tab / popup-blocked / flow | failed | `action.dispatch`: `The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.click:failed`; reported `{"category":"output_not_observed","code":"web.validation.output_not_observed"}`, expected `{"category":"output_not_observed"}` |
  | 11:59:43 | run-mtzrhkxp-a81bcf8d | file-transfer / — / recording | passed | — |
  | 12:00:15 | run-mtzri9ep-b3f3d974 | file-transfer / — / flow | failed | `unknown`: `fetch failed` |
  | 12:00:42 | run-mtzriudt-dfe95188 | file-transfer / — / recording | passed | — |
  | 12:01:19 | run-mtzrjmsu-1e0816ba | file-transfer / — / flow | failed | `runtime.behavior`: `The Flow reported an unexpected output_not_observed failure` |
  | 12:02:08 | run-mtzrkocp-cb7b7f50 | auth-gate / — / **recording** | failed | **`security.redaction`: `Redaction attestation found 6 file(s) holding a declared literal or left unread`** |
  | 12:02:47 | run-mtzrlise-bbd68894 | auth-gate / — / flow | failed | `runtime.behavior`: `The Flow produced 0 extraction result(s), expected 1`, then `Redaction attestation found 13 file(s) …` |
  | 12:03:45 | run-mtzrmrfg-d4fe136c | auth-gate / expired / flow | failed | `security.redaction`: `Redaction attestation found 13 file(s) …`; reported `{"category":"auth_required","code":"web.auth.required"}` |
  | 12:04:44 | run-mtzro144-34a68fc0 | identity-drift / selector-only / flow | passed | — |

  - **The auth-gate recording-lane run also failed the leak attestation, with 6
    files.** On the recording lane the runner supplies no declared secret
    (`run-scenario.ts:70`), so the literal reached Core's workspace from the
    recorded session itself. A single observation.
  - The file-transfer Flow run's `unknown` / `fetch failed` is also a single
    observation. It was not rerun, since the bench runs each row once.
  - At 05:15:12 there were 59 run manifests: 31 passed and 28 failed.

#### The week1 bench result

- **Status line:**
  `name=week1 index=1 … seconds=2,685.3 exit=1 otherLabsBefore=0 freeGBBefore=15.73 args=bench --corpus week1 --repeat 1 --target isolated secretSupplied=True`.
- **Result line**, quoted with the cause list shortened:
  `{"status":"failed","benchId":"bench-mtzqnj6o-f355f75e","directory":"F:\\fxlab-runs\\stage2b\\d\\bench\\bench-mtzqnj6o-f355f75e",…,"results":67,"runs":67,"passed":37,"skipped":0,"notExecuted":31,"actionsExecuted":74,"failureCauses":["4 runs — runtime.behavior: Scenario fact failed: page-status",…]}`.
- **Manifests:** all 67 run manifests read
  `67 x 6c22e22/False 5845f5d/False F:\fxlab\!FluxIQ`.
- **Discards:** no run's `recordingDiscardWindow` kept a discard or had
  `excluded: null`, and no `error` event matched `Core discarded recorded actions`.
- **Wait nodes:** no run, on either lane, has a `web.dom.wait_for_selector` action.

**`report.md` headline,** quoted: `67 runs evaluated: 37 passed, 30 did not. 0 results skipped (0 runs); a skipped run is never counted as a pass.`
`FluxIQ executed **74 actions** across 67 evaluated runs, and **executed nothing at all in 31 of those 67**.`
`By lane: recording lane, 12 actions across 23 runs, nothing executed in 17; flow lane, 62 actions across 44 runs, nothing executed in 14.`

**Headline rates per lane,** quoted from `report.md` "Rates". The columns are
Count / Total / Not executed / Workflows / Rate.

| Lane | Metric | Count / Total / Not executed / Workflows | Rate |
| --- | --- | --- | --- |
| recording | flowCreationSuccess | 0 / 0 / 0 / 0 | n/a |
| recording | initialExecutionSuccess | 4 / 23 / 17 / 23 | 0.174 |
| recording | deterministicReplaySuccess | 0 / 0 / 0 / 0 | n/a |
| recording | fuzzyRecovery | 0 / 0 / 0 / 0 | n/a |
| recording | falseFailure | 0 / 4 / 0 / 4 | 0.000 |
| recording | falseSuccess | 0 / 0 / 0 / 0 | n/a |
| recording | failureClassificationAccuracy | 0 / 0 / 0 / 0 | n/a |
| recording | harnessActivation | 0 / 23 / 17 / 23 | 0.000 |
| flow | flowCreationSuccess | 30 / 44 / 14 / 44 | 0.682 |
| flow | initialExecutionSuccess | 9 / 33 / 13 / 33 | 0.273 |
| flow | deterministicReplaySuccess | 0 / 0 / 0 / 0 | n/a |
| flow | fuzzyRecovery | 4 / 10 / 4 / 10 | 0.400 |
| flow | falseFailure | 0 / 14 / 0 / 14 | 0.000 |
| flow | falseSuccess | 1 / 6 / 0 / 6 | 0.167 |
| flow | failureClassificationAccuracy | 8 / 11 / 1 / 11 | 0.727 |
| flow | harnessActivation | 14 / 44 / 14 / 44 | 0.318 |

**Distributions,** quoted:
- `Action latency web.dom.click (ms) | 31 | 1320 | 1349`;
- `web.dom.type (ms) | 24 | 1027 | 1415`;
- `web.browser.navigate (ms) | 7 | 1651 | 1716`;
- `Run duration (ms) | 67 | 39314 | 58566`;
- `Sanitized packet bytes | 0 | n/a | n/a`, and `Truncation count, all lanes: 0`.

**The failure causes,** quoted from `report.md` "Why the failed runs failed":
- 4, `runtime.behavior`, `Scenario fact failed: page-status` (W05 ×3, W07 flow);
- 3, `runtime.behavior`, `The Flow reported an unexpected target_not_found failure` (W13 banner-absent, W15 flow, W28 flow);
- 3, `recording.contract`, `Recorded events do not match the scenario's expected recording events` (W14 ×3);
- 2, `runtime.behavior`, unexpected `output_not_observed` (W02 flow, W17 flow);
- 2, `runtime.behavior`, `The generated Flow ran, but the fixture's expected final state did not hold afterwards` (W03 flow, W29);
- 2, `action.dispatch`, no `web.dom.extract` after three scrolls (W11 ×2);
- 2, `action.dispatch`, `Core action did not succeed: failed: Action rejected: the element has a zero-size box` (W12 ×2);
- 2, `action.dispatch`, `The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.click:failed` (W15 popup-blocked, W26 no-context);
- 1, `process.startup`, `Timed out waiting for http://127.0.0.1:60234` (W07 recording);
- 1, `runtime.behavior`, `The Flow produced 0 extraction result(s), expected 1` (W09 flow);
- 1, `unknown`, `fetch failed` (W16 flow);
- 1, `security.redaction`, 6 files (W18 recording);
- 1, `runtime.behavior`, 13 files (W18 flow);
- 1, `security.redaction`, 13 files (W19);
- 1, `runtime.behavior`, `The Flow reported no structured failure, expected output_not_observed` (W24 unannounced, ruled out of Week 1);
- 1, `action.dispatch`, no `web.dom.wait_for_selector` (W25 flow);
- 1, `runtime.behavior`, `target_not_found, expected timeout` (W25 too-slow);
- 1, `gateway.connection`, `Timed out waiting for client gateway on 127.0.0.1:62331` (W26 flow).

**The rows `w25-wait-mapper` must leave unchanged,** from each bundle's
`snapshots/flow-lane.json`. Windows are `from` / `until`, with excluded action
counts as `thisRunsRecording/noRecording/anotherRecording`; event exclusions are 0
throughout.

| Row | runId | Verdict | Flow actions | Failure | Windows |
| --- | --- | --- | --- | --- | --- |
| W20 `selector-only` | run-mtzro144-34a68fc0 | passed | `web.dom.type:succeeded, web.dom.click:succeeded` | — | 1789301111906 / 1789301127490; 1st 0/2/0, 2nd 2/2/0 |
| W21 `text-only` | run-mtzrp3rp-35906da1 | passed | `web.dom.type:succeeded, web.dom.click:succeeded` | — | 1789301162210 / 1789301176453; 0/2/0, 2/2/0 |
| W22 `moved` | run-mtzrq5p4-fbd040f5 | passed | `web.dom.type:succeeded, web.dom.click:succeeded` | — | 1789301215053 / 1789301229642; 0/2/0, 2/2/0 |
| W23 `wrapped-aria` | run-mtzrramn-10ecf71f | passed | `web.dom.type:succeeded, web.dom.click:succeeded` | — | 1789301262258 / 1789301275285; 0/2/0, 2/2/0 |
| W29 `save-and-exit` | run-mtzs7mxg-bafc0417 | failed | `web.dom.type:succeeded, web.dom.click:failed` | `runtime.behavior`: `The generated Flow ran, but the fixture's expected final state did not hold afterwards` | 1789302025114 / 1789302041404; 0/2/0, 1/2/0 |
| W26 unarmed | run-mtzryqqc-5c714a1a | failed | none (no `flow-lane.json`) | `gateway.connection`: `Timed out waiting for client gateway on 127.0.0.1:62331` | none (no discard read) |
| W26 `no-context` | run-mtzs0ea1-16b84fc9 | failed | `web.dom.click:failed` | `action.dispatch`: `The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.click:failed` | 1789301684619 / 1789301702678; all 0 |
| W14 interstitial unarmed | run-mtzrd12l-1ca54273 | failed | none (no `flow-lane.json`) | `recording.contract`: `Recorded events do not match the scenario's expected recording events` | none |
| W14 interstitial `armed` | run-mtzrdq9o-26fafdef | failed | none (no `flow-lane.json`) | the same | none |
| W28 `iframe-checkout` | run-mtzs6oyw-7a39cea8 | failed | `web.dom.click:failed` | `runtime.behavior`: `The Flow reported an unexpected target_not_found failure` | 1789301977470 / 1789301992765; all 0 |

- **No `web.dom.wait_for_selector` action appears in any of these rows,** nor in
  any of the 67 bench runs.
- **W14 and W26 unarmed never reached a Flow,** so they show no wait node only
  because they have no Flow at all:
  - W14's recording lane (`run-mtzrccia-805da2c1`) failed `recording.contract`
    too;
  - W26 unarmed failed at the gateway.
- **Whether each row "keeps its verdict"** needs an earlier week1 bench; see the
  comparison below.

#### Comparison with an earlier week1 bench: none found

- **The search:** every `report.md` under `F:\!FluxIQWebExtension\test-runs` and
  `F:\fxlab-runs`, other than this bench's own, whose header table names corpus
  `week1`.
- **It printed nothing.** So "these rows keep their verdicts" cannot be judged
  against a preceding bench.
- **This bench's verdicts above become the baseline** for that check.
  - **Not verified:** whether a week1 bench exists anywhere else.

#### Memory, second attempt

- **Samples:** 477, every 15 s from 03:22:01 to 05:21:26 (`l-stage2b-lab-mem.csv`).
- **Lowest free memory: 8.82 GB, at 03:50:52,** under plan A with two instances.
  The same sample holds the highest Chrome plus Node working set, 7.73 GB.
- **Per window:**
  ```
  setup 03:20:00-03:24:16 samples=9 minFreeGB=15.95 maxChromeNodeWsGB=0
  load alone 03:24:17-03:24:46 samples=2 minFreeGB=15.17 maxChromeNodeWsGB=0.75
  A+load (plan A) 03:24:47-04:18:04 samples=213 minFreeGB=8.82 maxChromeNodeWsGB=7.73
  load finishing 04:18:05-04:19:27 samples=5 minFreeGB=12.34 maxChromeNodeWsGB=3.67
  alone: rerun + plan C 04:19:53-04:35:37 samples=63 minFreeGB=12.23 maxChromeNodeWsGB=3.86
  alone: week1 bench 04:36:04-05:20:50 samples=178 minFreeGB=11.88 maxChromeNodeWsGB=3.8
  after 05:20:51-23:59:59 samples=3 minFreeGB=15.66 maxChromeNodeWsGB=0
  ```
- `below 4 GB samples: 0`, and `load pause lines: 0`, so the load instance never
  paused.
- The sampler stopped through its stop file.

#### After the campaign

- **Processes:** `lab/next/fxlab processes: 0`.
- **Run directories:** `F:\fxlab-runs\stage2b\{a,load,c,d}\.work` have 0 entries
  each, and `reparsePoints under stage2b=0`.
- **Worktrees:** `F:\fxlab\fxlab-7263534` and `F:\fxlab\fxlab-7263534-load` are at
  `6c22e220b42efa7c31af8eaeebad420a37010bcb`; `F:\fxlab\!FluxIQ` is at
  `5845f5d45c68bc6bc08f0f65003a136fca2656a8`. Each has `porcelain=0` and
  `locks=0`, and all three are kept.
- **Stops:** `campaign stop file exists: False`, so no run was failed by a
  windowed discard. `status fallback files: 0`, so every status line was
  written.
- **The main trees moved during the campaign;** I touched neither. The repository
  is at `78d65a3` and Core at `240c73e`.
- **Declared values in files.** Three values were counted, as UTF-8 and UTF-16:
  auth-gate's password constant and `sensitive-input`'s two replaced literals.
  - Over every `l-stage2*` scratch file and this report:
    `scratch+report: files=197 totalHits=0`.
  - Over every file under `F:\fxlab-runs\stage2b`:
    `stage2b run artifacts: files=2875 totalHits=0`.
  - The leak findings above are in Core's isolated workspaces, which are deleted
    after each run, not in any kept file.

### Second attempt: outcome

**The discard window works: no run was failed by a probe or Flow-lane confirmation.**
- **The pin held.** The pin proof printed `unpinned=0` on both worktrees before
  any run. All 157 run manifests (plan A 36, load 37, plan C 17 including the
  smoke bench's 4, week1 bench 67) record facility `6c22e22…` `dirty=false` and
  Core `5845f5d…` `dirty=false`.
- **What the window excluded.**
  - Every `basic-form --flow` run that reached the discard reads, 23 on A, 1
    rerun and 37 on load, excluded exactly 2 action discards naming no recording
    at the first read. At the second it excluded 4 naming the run's recording
    plus those 2, with `discardsAfterFirstRead` 0.
  - No run's check counted a confirmation.
- **The one discard-check failure** was the fail-closed branch for an unreadable
  audit log, at W19 run 1's second read (`excluded: null`). A single observation.

**Per step, as judged by the brief:**

| Step | Runs | Result |
| --- | --- | --- |
| Pin proof | 2 worktrees | `unpinned=0` ×2 |
| A, step 4b under load | 24 | **23 of 24.** Run 8 failed `process.startup` before recording; its rerun alone passed (single observation) |
| Load instance | 37 | 37 of 37 exit 0 |
| B, W18 `auth-gate --flow` | 3 | **0 of 3.** 3 of 3 Flows succeeded, but the missing extraction failed each (`expected 1`), and the leak attestation found the password in 13 Core workspace objects |
| B, W19 `expired` | 3 | **0 of 3 exit 0.** Click `failed` 3/3; `auth_required` / `web.auth.required` 3/3; no extract 3/3; `comparisonStatus` found in 0 of 3 bundles. Leak attestation failed 3/3 |
| B, W25 unarmed | 3 | **0 of 3.** No `wait_for_selector` proposed |
| B, W25 `too-slow` | 3 | **0 of 3.** `target_not_found` where `timeout` was expected |
| Alone, W10 `broken-link` | 3 | 3 of 3, `navigation_unexpected` / `web.navigation.unexpected`, click `failed` |
| Alone, W27 `blocked-url` | 3 | 3 of 3, the same |
| Alone, `sensitive-input` | 3 | 3 of 3. Attestation `passed`, `findingCount` 0; 0 declared-value hits |
| Alone, W24 unarmed | 3 | 3 of 3 |
| Alone, smoke gate 5.0 | 1 bench, 4 runs, 1 compare | `"outcome":"equivalent"`, compare exit 0 |
| Alone, week1 bench `--repeat 1` | 67 | exit 1; 37 passed. Recording `initialExecutionSuccess` 0.174. Flow `flowCreationSuccess` 0.682, `initialExecutionSuccess` 0.273, `fuzzyRecovery` 0.400, `falseSuccess` 0.167, `failureClassificationAccuracy` 0.727, `harnessActivation` 0.318. No wait node in any row |

**Lowest free memory:** 8.82 GB.

### Not verified (second attempt)

- **Which Core objects hold the auth-gate password.** Each isolated workspace was
  deleted after its run; only the attestation's paths and categories remain. The
  6-file recording-lane case (bench W18) is a single observation.
- **Two of W18's checks:** "the username type is present" and "the Flow starts on
  `/scenarios/auth-gate/`". `flow-lane.json` records no target for each action,
  and the screenshots were not opened.
- **W19's `comparisonStatus`.** It is absent from every bundle file, and I did not
  investigate where it should be published.
- **Why a live `delayed-ui` recording yields no wait node,** 0 of 3 plus the
  bench's run. The proposal has 2 candidates, although 1 `web.dom.mutated` event
  was recorded. Core's mapper inputs were not captured.
- **Failures seen once and not investigated:**
  - step 4b run 8's and the bench W07 recording run's `process.startup` timeouts;
  - W26 flow's `Timed out waiting for client gateway`;
  - W16 flow's `fetch failed`;
  - W19 run 1's unreadable audit log.
- **"Keep their verdicts":** no earlier week1 bench was found to compare against.
- **Not run or not opened:** Firefox; `pnpm lab inspect`; `report.html`,
  `review/` and the screenshots.
- **The memory peak between 15 s samples,** and why the two instances ran in
  lockstep.

### Open questions or contradictions (second attempt)

1. **The declared secret reaches Core's persisted workspace.** It was in 13
   content-addressed objects on every Flow-lane auth-gate run (W18 ×3, W19 ×3,
   bench W18 and W19), and in 6 on the bench's recording-lane W18 run. Criterion
   2's leak check therefore fails on auth-gate, although it passes 3 of 3 on
   `sensitive-input`.
2. **W18's Flow-lane expectation cannot be met as built.** The recording has an
   `extract` step, but no extract node is proposed. So the Flow lane always ends
   with `The Flow produced 0 extraction result(s), expected 1`, and the bench's
   W09 flow row fails the same way.
3. **`comparisonStatus` `blocked` is not published anywhere a Lab run records.**
   The brief's W19 check needs a named source.
4. **`w25-wait-mapper`'s rule does not fire on live recordings.** The unarmed row
   failed 0 of 3, plus the bench row, and `too-slow` still reports
   `target_not_found`.
5. **The discard check's fail-closed branch can fail a run** whose Flow met its
   expectation, when one gateway snapshot read fails (W19 run 1).
6. **Evidence discards inside the window** occurred in 6 of 37 load runs, W18 run
   1 and W19 run 3. They never fail a run. The brief's step 4b criterion "zero
   windowed discards" would count them; A's 23 passing runs had none.
7. **The worktree directory names read `7263534` but hold `6c22e22`,** because the
   brief said to move them. Stage 1's worktrees and `F:\fxlab-147fdb4` also remain,
   and removing them needs the junction-safe delete.
