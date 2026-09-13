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
