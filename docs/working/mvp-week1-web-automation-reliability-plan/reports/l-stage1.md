# l-stage1 — Lab Stage 1 against a pinned Core

Worker report for the `l-stage1` brief in
[finish-week1.md](../briefs/finish-week1.md), dispatched with this repository at
`<R>` = `16ff729` and FluxIQ Core at `<C>` = `267a2ca`. Written 2026-09-13.
Times are local (UTC-7) unless marked `Z`. This machine has faulty RAM. Every
figure below is a single observation unless it says otherwise.

## Outcome

**Done. Every briefed run executed against a Core pinned at `267a2ca`, and the
pin held on every run. The product failed most of what was run.**

- **The pin held.** Every one of the 44 run manifests records the facility at
  `16ff729…` with `dirty: false`, and Core at `F:\fxlab\!FluxIQ`, commit
  `267a2ca…`, `dirty: false`. Meanwhile the live `F:\!FluxIQ` moved to `6f172b9`
  and has 15 modified files, so the pin was needed.
- **Step 4b fails its pass condition.** 10 of 24 runs had exactly 4 candidates
  (9 of the original 24, plus the rerun of run 12, whose build crashed). The
  other 14 lost recorded actions:
  - in 9, Core's recording held 5–6 entries instead of 10–13, and the Flow had
    2 candidates;
  - in 5, Core's recording held **0** entries.

  Every loss is now loud rather than silent. Each run exits 1 with
  `action.dispatch` or `recording.contract`. The failures track load:
  - while instance B ran alongside A (runs 3–17), 1 of 15 passed;
  - with A as my only Lab instance (runs 1, 2, 18–24 and the rerun of 12), 9 of
    10 passed.
- **W18 `auth-gate --flow`: 0 of 3.**
  - Run 1: Core persisted a recording with 0 entries.
  - Runs 2 and 3: a Flow was built with a `#password` type node, and it failed
    `target_not_found`.
  - The declared value appears in no bundle file.
  - The oracle verdict was `passed` in all 3.
- **`reconnect`: 3 of 3 passed.**
- **W24: 0 of 3.** Each run's Flow reported no failure, where `output_not_observed`
  was expected.
- **W25: 0 of 3.** Two failed `recording.contract`; one reported `target_not_found`
  where `timeout` was expected.
- **Smoke gate 5.0 is not met.** The bench passed 4 of 4 runs. The compare
  against the baseline exited 1, `"outcome":"regressed"`, on navigate latency.
  It ran concurrently with instance A.
- **Step 4 (the extension e2e fixture): exit 0, 8 of 8 passed**, MV3 worker
  restart included.

## What changed and why

No tracked file in either repository was edited. I created:

- **Core worktree `F:\fxlab\!FluxIQ`**, detached at `267a2ca`. I installed it
  offline and built `@fluxiq/contracts`, `fluxiq` and
  `@fluxiq/client-gateway-websocket`, but not `@fluxiq/web`.
- **Three worktrees of this repository at `16ff729`**, where the brief named one
  (`fxlab-<R7>`) plus step 4's own. The extra one is a deviation, for the reason
  given:
  - `F:\fxlab\fxlab-16ff729`: instance A (`FLUXIQ_LAB_INSTANCE=l-stage1-a`).
  - `F:\fxlab\fxlab-16ff729-b`: instance B (`l-stage1-b`). **Deviation.**
    `domain/scripts/clean-dist.mjs:21,37-43` deletes every emitted `.js` under
    `domain/dist` before re-emitting, and every `pnpm lab run` performs that
    build (`scripts/lab/run-lab.mjs:61`). Two instances in one worktree would
    therefore delete modules under a sibling's running process. A later build
    log shows the scale: `clean-dist: removed 255 emitted file(s)`.
  - `F:\fxlab\fxlab-16ff729-step4`: step 4, as the brief says. Its tracked
    `apps/extension/build/` is now rewritten (10 files), which is expected
    (`i-lab-campaign` Part 2 item 7).
- **Run artifacts** under `F:\fxlab-runs\stage1\a` and `F:\fxlab-runs\stage1\b`.
- **Scratch files** in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`,
  all prefixed `l-stage1-`:
  - the driver `l-stage1-lab-seq.ps1`, the plans `l-stage1-plan-a.txt` and
    `-plan-b.txt`, and the analyser `l-stage1-analyse.mjs`;
  - `l-stage1-pin-proof.mjs` and its three logs;
  - every run's launcher log (`l-stage1-l-stage1-<a|b>-<name>-NN.log`, UTF-16LE),
    the status files, the analysis outputs, and the memory samples in
    `l-stage1-lab-mem.csv`.

## Commands run and observed results

### Pre-checks

- `git rev-parse` returned `16ff729262b4db4b7b2518d76d96667b1703f467` for this
  repository and `267a2ca0b6419b0a97903f63c5d4bcdc14664009` for Core.
- Core `git status --porcelain` was empty.
- No `run-lab.mjs`, `test-runner\dist\cli.js`, `next dev` or Playwright process
  was running.
- Free memory: `FreeGB 15.30 TotalGB 25.85`.
- No `FLUXIQ_*` variable was set in the shell.

### Setup

- `git -C F:\!FluxIQ worktree add --detach F:\fxlab\!FluxIQ 267a2ca` printed
  `exit=0`. The same for `F:\fxlab\fxlab-16ff729` at `16ff729` printed `exit=0`.
  Both worktrees' `git status --porcelain` output was empty.
- `pnpm -C F:\fxlab\!FluxIQ install --frozen-lockfile --offline` printed
  `core-install exit=0 seconds=12.1467537`, `Lockfile is up to date`, `Packages: +301`
  and `reused 301, downloaded 0`.
- `pnpm -C F:\fxlab\fxlab-16ff729 install --frozen-lockfile --offline` printed
  `ext-install exit=0 seconds=2.6590392`. The `-b` install printed
  `exit=0 seconds=1.7462144`, and the `-step4` install `exit=0 seconds=1.2613972`.
- Core builds, each with `pnpm -C F:\fxlab\!FluxIQ --filter <pkg> build`:
  ```
  build @fluxiq/contracts exit=0 seconds=1.8074623
  build fluxiq exit=0 seconds=7.2845662
  build @fluxiq/client-gateway-websocket exit=0 seconds=1.4963876
  ```
- Next in the Core worktree resolves to
  `F:\fxlab\!FluxIQ\node_modules\.pnpm\next@15.5.23_…\node_modules\next\`.
- Junctions in `F:\fxlab\fxlab-16ff729`, quoted:
  ```
  F:\fxlab\fxlab-16ff729\domain\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-16ff729\domain\node_modules\@fluxiq\client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\ [Junction]
  F:\fxlab\fxlab-16ff729\apps\extension\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-16ff729\apps\extension\node_modules\@fluxiq\client-gateway-websocket -> F:\fxlab\!FluxIQ\packages\client-gateway-websocket\ [Junction]
  F:\fxlab\fxlab-16ff729\packages\test-runner\node_modules\fluxiq -> F:\fxlab\!FluxIQ\packages\fluxiq\ [Junction]
  F:\fxlab\fxlab-16ff729\packages\test-contracts\node_modules\@fluxiq\contracts -> F:\fxlab\!FluxIQ\packages\contracts\ [Junction]
  ```
  The step 4 worktree's junctions point the same way.

### The pin proof, before any run

`node --experimental-import-meta-resolve l-stage1-pin-proof.mjs <worktree>`
resolves each specifier with `import.meta.resolve` from the package's own
`package.json`, then takes `realpathSync`. For `F:\fxlab\fxlab-16ff729` it
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
import(fluxiq/automation-studio) from packages/test-runner: F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\index.js exports=384
runner Core root (cli.ts:21 default): F:\fxlab\!FluxIQ -> real F:\fxlab\!FluxIQ
unpinned=0
```

The identical output, `exit=0` and `unpinned=0`, was printed for
`F:\fxlab\fxlab-16ff729-b` and `F:\fxlab\fxlab-16ff729-step4`.

Three things confirmed the pin at run time:

- Every launcher printed a Core root of `F:\fxlab\!FluxIQ`:
  `{"lab":"core-build","state":"quiet","root":"F:\\fxlab\\!FluxIQ","files":2012,…}`.
- The Next processes ran as
  `F:\fxlab\!FluxIQ\apps\web\node_modules\.bin\next.cmd dev --turbopack …`.
- Every manifest recorded `"path": "F:\\fxlab\\!FluxIQ"`,
  `"commit": "267a2ca0b6419b0a97903f63c5d4bcdc14664009"`, `"dirty": false`.

No launcher log contains `changed-during-run`.

### How exits were captured, and the status lines I lost

- **The design.** Each run ran as
  `pnpm -C <worktree> lab <args> *> <log>` inside `l-stage1-lab-seq.ps1`. The
  driver then appended `exit=$LASTEXITCODE` to a status file, with no pipe.
- **The fault, which was mine.** At 00:20 I armed a `tail -F` watch on both
  status files. Git's `tail.exe` holds a handle that blocks PowerShell's
  `Add-Content`. From then on every status write failed, and the driver log
  reads, 15 times in B's driver log:
  `Add-Content : The process cannot access the file '…l-stage1-l-stage1-b-status.txt' because it is being used by another process.`
  `TaskStop` left `tail.exe` (pid 5580) alive until I stopped it at about 00:43.
- **Status lines exist** for step 4b runs 1, 2 and 19–24, for the run 12 rerun,
  for the compare rerun and for step 4.
- **Every other exit is recovered from that run's redirected launcher log.**
  - Exit 1: the log's last line is ` ELIFECYCLE  Command failed with exit code 1.`
  - Exit 0: the log has no `ELIFECYCLE` line, and its result line has
    `"verdict":"passed"` (a bench's has `"status":"passed"`). `cli.ts:52,58` return
    0 only for those.
- **The compare's exit** is the one value the log cannot carry, because it was
  called with `node`, not `pnpm`. So I reran the compare, which is read-only,
  with its exit captured by redirect.

### A: step 4b, `basic-form --flow` ×24

Command, one at a time:
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=l-stage1-a EXTENSION_TEST_BUILD_LABEL=l-stage1-a FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage1\a pnpm -C F:\fxlab\fxlab-16ff729 lab run basic-form --flow --target isolated`.
The runs went from 00:17:59 to 00:49:14. Instance B overlapped from 00:20:13 to
00:40:20, which covers runs 3–17.

Every bundle is `F:\fxlab-runs\stage1\a\<runId>`, and every manifest has facility
`16ff729…` `dirty=false` and Core `267a2ca…` `dirty=false`.

Column sources, as the brief names them:

- **Exit:** `s` means the status line; `l` means recovered from the log.
- **`candidateCount`** and **`proposalIssues`:** from `snapshots/flow-lane.json`.
  When a run produced no proposal, the snapshot is absent and the issues come
  from the run's error event.
- **`runtime.settle`:** that event's `recordings[0]`, as
  `entryCount / entriesAppendedAfterStop / finalizationWaitMs`.
- **`flow-lane.json` recording:** that file's
  `entriesAppendedAfterStop / finalizationWaitMs`. The two sources disagree; see
  open question 3.

| Run | Exit | runId | candidateCount | proposalIssues | runtime.settle | flow-lane.json recording | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 s | run-mtzhfmkz-d780a9db | 4 | Compacted 7 … preserved. | 13 / 0 / 1480 | 0 / 1209 | — |
| 2 | 0 s | run-mtzhh54g-19c49673 | 4 | Compacted 7 | 13 / 3 / 1501 | 0 / 892 | — |
| 3 | 1 l | run-mtzhijv8-41c92075 | none | no entries (below) | 0 / 0 / 1131 | absent | recording.contract |
| 4 | 1 l | run-mtzhk2zd-6a6b4624 | 2 | Compacted 3 | 5 / 3 / 2491 | 0 / 951 | action.dispatch |
| 5 | 0 l | run-mtzhlx2i-69c99dbe | 4 | Compacted 6 | 10 / 5 / 3402 | 0 / 955 | — |
| 6 | 1 l | run-mtzhnxmn-e70630f3 | 2 | Compacted 3 | 5 / 3 / 2412 | 0 / 935 | action.dispatch |
| 7 | 1 l | run-mtzhpzzk-5225453b | 2 | Compacted 3 | 6 / 3 / 2814 | 0 / 1803 | action.dispatch |
| 8 | 1 l | run-mtzhs4u8-561a3d81 | 2 | Compacted 3 | 5 / 3 / 3910 | 0 / 914 | action.dispatch |
| 9 | 1 l | run-mtzhu3wa-7ea3dd08 | 2 | Compacted 3 | 5 / 0 / 2771 | 0 / 1210 | action.dispatch |
| 10 | 1 l | run-mtzhw8hi-e5a9b548 | 2 | Compacted 3 | 5 / 3 / 4460 | 0 / 974 | action.dispatch |
| 11 | 1 l | run-mtzhy8c8-bc5c6e09 | 2 | Compacted 3 | 5 / 4 / 5549 | 0 / 1229 | action.dispatch |
| 12 | 1 l | none (build crash) | — | — | — | — | `tsc` 3221225477 |
| 12 rerun | 0 s | run-mtziml8n-74699693 | 4 | Compacted 7 | 13 / 6 / 1513 | 0 / 957 | — |
| 13 | 1 l | run-mtzi0rs9-c4990e0f | none | no entries | 0 / 0 / 1159 | absent | recording.contract |
| 14 | 1 l | run-mtzi2r3o-f06f8430 | none | no entries | 0 / 0 / 1069 | absent | recording.contract |
| 15 | 1 l | run-mtzi4b7d-da7e77a5 | none | no entries | 0 / 0 / 1004 | absent | recording.contract |
| 16 | 1 l | run-mtzi5zsn-7e0ae6e1 | none | no entries | 0 / 0 / 1052 | absent | recording.contract |
| 17 | 1 l | run-mtzi7pfv-c87eec03 | 2 | Compacted 3 | 5 / 0 / 2464 | 0 / 1054 | action.dispatch |
| 18 | 1 l | run-mtzi9cdf-e6be5fa4 | 2 | Compacted 3 | 5 / 3 / 2629 | 0 / 992 | action.dispatch |
| 19 | 0 s | run-mtzib0ox-b5a45a2a | 4 | Compacted 6 | 10 / 4 / 2057 | 0 / 915 | — |
| 20 | 0 s | run-mtzicidq-1339582b | 4 | Compacted 6 | 10 / 3 / 2496 | 0 / 953 | — |
| 21 | 0 s | run-mtzidyey-177a9b32 | 4 | Compacted 6 | 10 / 4 / 3029 | 0 / 938 | — |
| 22 | 0 s | run-mtzifeba-c96a149b | 4 | Compacted 7 | 13 / 8 / 2146 | 0 / 918 | — |
| 23 | 0 s | run-mtzigxuf-1a15f89f | 4 | Compacted 7 | 13 / 0 / 1524 | 0 / 939 | — |
| 24 | 0 s | run-mtziib7h-4957bd49 | 4 | Compacted 6 | 10 / 4 / 2318 | 0 / 965 | — |

**How the table's shorthand expands:**

- "Compacted N" is the whole issue text
  `Compacted N high-frequency state entries before mapper proposal generation. Raw recording data was preserved.`
- Every 4-candidate run's `flow-lane.json` actions are
  `web.dom.type:succeeded, web.dom.select:succeeded, web.dom.type:succeeded, web.dom.click:succeeded`.
- Every 2-candidate run's error event reads, quoted from run 4:
  `The Flow did not produce a web.dom.select action with outcome succeeded; it produced web.dom.type:succeeded, web.dom.click:succeeded`
  (`"failureCategory":"action.dispatch"`).
- The "no entries" issues, quoted from run 3:
  `"No mapper-visible entries remained after compacting high-frequency state. The recording contains no entries.","Mapper web-recording-actions emitted no valid action candidates for recording client.extension-30cf38b5-c7eb-4135-aec2-52af4d390556.1789284075545. It saw 0 entries (no entries), matched 0, emitted 0 raw candidates, and accepted 0 valid candidates."`

**Run 12's log, quoted:**

```
domain build: clean-dist: removed 255 emitted file(s) from dist
domain build: Failed
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fluxiq-web-extension/domain@0.1.0 build: `node scripts/clean-dist.mjs && tsc -p tsconfig.json && node scripts/rewrite-dist-specifiers.mjs`
Exit status 3221225477
{"status":"failed","category":"environment.missing","message":"pnpm --filter @fluxiq-web-extension/test-runner... build exited with 3221225477"}
 ELIFECYCLE  Command failed with exit code 1.
```

That is a faulty-RAM shape. I reran it once, alone. No other Lab process was
running (`labs running before: 0`):
`name=step4b-rerun12 index=1 start=2026-09-13T00:51:24… end=2026-09-13T00:52:29… seconds=65.4 exit=0`.

**Judged against the step 4b pass condition:**

1. **`exit=0`:** 10 of 24, counting the rerun in place of run 12.
2. **`candidateCount` exactly 4:** 10 of 24. Five runs have no proposal at all,
   and nine have 2.
3. **No `proposalIssues` entry contains `has not been finalized`:** true for all
   24. No quoted issue contains it.
4. **No `recording.persistence` failure with "still being written":** none
   occurred.
5. **Distribution:**
   - `runtime.settle`'s `entriesAppendedAfterStop` over the 19 runs that
     persisted entries: 0 (4 runs), 3 (9), 4 (4), 5, 6 and 8 (one each).
     Its `finalizationWaitMs` ranged from 1480 to 5549. The five 0-entry runs
     read 0 and 1004–1159.
   - `flow-lane.json`'s `entriesAppendedAfterStop` is 0 in all 19 runs that have
     the file, and its `finalizationWaitMs` ranged from 892 to 1803.

**By load:**

- Runs 3–17 overlapped instance B, and 1 of 15 passed (run 5).
- Runs 1, 2, 18–24 and the rerun of 12 ran with A as my only Lab instance, and
  9 of 10 passed. Run 18 (00:41:04–00:42:23) failed with 2 candidates while alone.
  During run 18 the Chrome plus Node working set peaked at 3.56 GB, which fits
  one instance. Other workers' processes in the main trees are not excluded.
- Every failing run lost entries **before** Core finished the recording. A
  2-candidate run's Core recording has 5–6 entries, where passing runs have
  10–13. `entriesAppendedAfterStop` is in the same range as for passing runs.
- Two failures coincide across instances:
  - A's run 3 and B's W18 run 1 both persisted 0 entries;
  - both bundles finished at 07:21:26Z;
  - their recording ids end `…1789284075545` and `…1789284076805`, 1.3 s apart.
- The two Core processes were separate:
  - A's run 3 had `Local: http://127.0.0.1:58975` and shared runtime
    `web.mtzhj0qx.fxanv66kr7` at `ws://127.0.0.1:58976/client`;
  - B's run had `Local: http://127.0.0.1:58979` and shared runtime
    `web.mtzhj4k0.ejlqd4q1q6` at `ws://127.0.0.1:58980/client`.

### B: W18, `reconnect`, W24, W25, then smoke gate 5.0

B's environment was the same as A's with label `l-stage1-b` and
`FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\stage1\b`, worktree `F:\fxlab\fxlab-16ff729-b`.
For W18 only, `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` was set, from the fixture
constant at `apps/scenario-lab/src/scenarios/auth-gate/constants.ts:13`. The
driver read it by regex and removed it after each run. Its value is not
reproduced here.

Every bundle is `F:\fxlab-runs\stage1\b\<runId>`, and every manifest has facility
`16ff729…` `dirty=false` and Core `267a2ca…` `dirty=false`. Every exit in this
section was recovered from the log.

**W18: `lab run auth-gate --flow --target isolated` ×3.**

- **Run 1: exit 1, `run-mtzhikvr-07c3f403`.**
  - Error event: `Core produced no recording Flow proposal for the run's recording`,
    `"failureCategory":"recording.contract"`, and
    `"It saw 0 entries (no entries), matched 0, emitted 0 raw candidates"`.
  - The `runtime.settle` event reads
    `"recordedEvents":{"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.tab.state_changed":1},"recordings":[{…"entryCount":0,"entriesAppendedAfterStop":0,"finalizationWaitMs":1210}]`.
    **The extension counted five events and Core persisted none.**
  - No Flow was built, so there is no password node.
  - Evaluation: `oracleVerdict=passed reportedVerdict=passed lane=recording flowCreated=null`.
- **Run 2: exit 1, `run-mtzhk4a3-3dba04fe`.**
  - The dispatch event carries `"declaredSecrets":["auth-gate-password"]`.
  - `flow-lane.json` has `"flowId": "flow.2ff164f8-dae6-4d50-96aa-d370d24d69f1"`
    and `"candidateCount": 2`. Its first and only action ran:
    `"actionType": "web.dom.type", "status": "failed"`, with
    `"category": "target_not_found"`,
    `"expected": "an element matching selector #password, visual target 421,158 (refused main scoring -0.17), element fingerprint"`
    and `"actual": "nothing matched; 0 control(s) of the same family are on the page"`.
  - Error event: `The Flow reported an unexpected target_not_found failure`,
    `runtime.behavior`.
  - `runtime.settle`: `"entryCount":12,"entriesAppendedAfterStop":7,"finalizationWaitMs":5596`.
  - Evaluation: `oracleVerdict=passed reportedVerdict=failed automationFailureReported={"category":"ambiguous_or_unknown"}`.
- **Run 3: exit 1, `run-mtzhlxiu-4b7622fa`.**
  - The same shape as run 2: `candidateCount=2`, and the same `#password`
    `target_not_found`.
  - `runtime.settle`: `12 / 7 / 5171`. Oracle `passed`.
- **The password node's presence.**
  - *Runs 2 and 3:* the Flow contains a `web.dom.type` node targeting
    `#password`, and the lane ran it. That means the one-to-one secret pairing
    did not reject the Flow. A rejection would fail `fixture.invalid` before the
    Flow runs (`declared-secrets.ts:155`).
  - *Run 1:* absent, because there was no Flow.
  - *Inference, not observed:* with 2 candidates and the password type executed
    first, the username type node is most likely missing.
- **Absence of the declared value.**
  - `l-stage1-analyse.mjs` counts occurrences of the constant, printing counts
    only. It found:
    - run 1: `named files hits=[]; snapshots/ files=0 hits=[]; whole bundle files=18 hits=[]`;
    - runs 2 and 3: `named files hits=[]; snapshots/ files=1 hits=[]; whole bundle files=19 hits=[]`.
  - "Named files" are `run.json`, `evaluation.json` and `events.ndjson`.
  - The 72 scratch logs and status files produced `files=72 totalHits=0`.

**`reconnect`: `lab run reconnect --target isolated` ×3.** All three exited 0 with
`verdict=passed` and `oracleVerdict=passed`:

| Run | runId | runtime.settle entryCount / entriesAppendedAfterStop / finalizationWaitMs |
| --- | --- | --- |
| 1 | run-mtzhnxcn-78afa6d3 | 3 / 0 / 1696 |
| 2 | run-mtzhp98g-fc1d7b95 | 5 / 3 / 4701 |
| 3 | run-mtzhqp0y-3fcc45b2 | 3 / 1 / 3601 |

**W24: `lab run intermediate-state --flow --variant unannounced --target isolated` ×3.**
All exited 1. Each run's Flow `status=succeeded`, and the error event reads
`The Flow reported no structured failure, expected output_not_observed`
(`runtime.behavior`). `automationFailureExpected={"category":"output_not_observed"}`
and `automationFailureReported=null`.

| Run | runId | candidateCount | runtime.settle entryCount |
| --- | --- | --- | --- |
| 1 | run-mtzhs5q8-9c0d5da1 | 2 | 6 |
| 2 | run-mtzhu41z-76f6a4fc | 3 | 8 |
| 3 | run-mtzhweg9-d6e4dbbd | 2 | 6 |

**W25: `lab run delayed-ui --flow --variant too-slow --target isolated` ×3.** The
command is my reading; see open question 2. All exited 1. Expected:
`{"category":"timeout","code":"web.action.timeout"}`.

- **Run 1: `run-mtzhyfd7-b2183105`.** `recording.contract`:
  `It saw 1 entries (observation: 1), matched 0, emitted 0 raw candidates`.
- **Run 2: `run-mtzi00es-c9f0e565`.** `recording.contract` with 0 entries.
- **Run 3: `run-mtzi1vgu-d40300bd`.** `candidateCount=1`, and the Flow failed
  with `"category":"target_not_found"`,
  `"expected":"an element matching selector [data-testid=\"late-action\"], visual target 303,146 (refused div[data-testid=\"late-content\"] scoring -0.44), element fingerprint"`
  and `"actual":"nothing matched; 1 control(s) of the same family are on the page; best scored -0.29"`.
  Error event: `The Flow reported failure category target_not_found, expected timeout`.

**Smoke gate 5.0: `lab bench --corpus smoke --repeat 2 --target isolated`.** Exit
0, recovered from the log. It ran 07:37:20Z–07:40:17Z, concurrently with A's
runs 15–17. The result line:

```
{"status":"passed","benchId":"bench-mtzi455e-b25f1435","directory":"F:\\fxlab-runs\\stage1\\b\\bench\\bench-mtzi455e-b25f1435",…,"results":2,"runs":4,"passed":4,"skipped":0,"notExecuted":2,"actionsExecuted":4}
```

`report.md` says: `4 runs evaluated: 4 passed, 0 did not.` and
`executed nothing at all in 2 of those 4`. The W28 runs executed 0 actions.

The four runs' manifests, quoted from my check:
```
run-mtzi455h-b711dfcf verdict=passed facility=16ff729262b4db4b7b2518d76d96667b1703f467 dirty=False core=267a2ca0b6419b0a97903f63c5d4bcdc14664009 dirty=False corePath=F:\fxlab\!FluxIQ
run-mtzi64iy-844650cc verdict=passed … dirty=False … dirty=False corePath=F:\fxlab\!FluxIQ
run-mtzi51xm-d0e1e340 verdict=passed … dirty=False … dirty=False corePath=F:\fxlab\!FluxIQ
run-mtzi76jy-05ddf5d4 verdict=passed … dirty=False … dirty=False corePath=F:\fxlab\!FluxIQ
```

The compare was
`node F:\fxlab\fxlab-16ff729-b\packages\test-runner\dist\cli.js compare F:\!FluxIQWebExtension\test-runs\bench\bench-mtxoim0b-8ca4952c F:\fxlab-runs\stage1\b\bench\bench-mtzi455e-b25f1435`,
run with no `FLUXIQ_LAB_INSTANCE`. Its rerun at 00:43:36 printed
`compare-rerun … exit=1`:

```
{"baselineReportId":"bench-mtxoim0b-8ca4952c","candidateReportId":"bench-mtzi455e-b25f1435","outcome":"regressed","advisory":["run-duration-p95"],"metrics":[{"metric":"rate:initialExecutionSuccess","baseline":1,"candidate":0.5,"tolerance":0.5,"outcome":"equivalent"},{"metric":"rate:deterministicReplaySuccess","baseline":1,"candidate":0.5,"tolerance":0.5,"outcome":"equivalent"},{"metric":"rate:falseFailure","baseline":0,"candidate":0,"tolerance":1,"outcome":"equivalent"},{"metric":"rate:harnessActivation","baseline":0,"candidate":0,"tolerance":0.5,"outcome":"equivalent"},{"metric":"action-latency-p95:web.browser.navigate","baseline":1684,"candidate":2609,"tolerance":421,"outcome":"regressed"},{"metric":"action-latency-p95:web.dom.type","baseline":1432,"candidate":1444,"tolerance":358,"outcome":"equivalent"},{"metric":"run-duration-p95","baseline":57213,"candidate":49209,"tolerance":14303.25,"outcome":"equivalent"}]}
```

The first compare, inside the driver, printed the identical JSON. Its exit was
lost to the lock.

### Step 4: the extension e2e fixture, in its own worktree

Run alone after A finished:
`EXTENSION_TEST_BUILD_LABEL=l-stage1-step4 pnpm -C F:\fxlab\fxlab-16ff729-step4 --filter @fluxiq-web-extension/extension test:e2e`.
Its status line:
`step4-e2e start=2026-09-13T00:49:52.7308167-07:00 end=2026-09-13T00:50:01.4750537-07:00 seconds=8.744237 exit=0`.

```
Running 8 tests using 6 workers
  ok 3 e2e\network-policy.spec.ts:4:1 › allows only extension/local documents and loopback HTTP or WebSocket (15ms)
  ok 6 e2e\network-policy.spec.ts:10:1 › rejects malformed, external, secure, file, and lookalike destinations (18ms)
  ok 4 e2e\network-policy.spec.ts:16:1 › aborts and records a real browser request to an unexpected destination (1.4s)
  ok 5 e2e\resilience-and-isolation.spec.ts:4:1 › restarts the MV3 worker and answers a production readiness message (2.0s)
  ok 2 e2e\install-and-content.spec.ts:4:1 › loads the current MV3 artifact and its extension page (2.0s)
  ok 7 e2e\install-and-content.spec.ts:17:1 › injects the content script into a loopback scenario page (2.1s)
  ok 1 e2e\action.spec.ts:4:1 › executes actions through the real content-script message path (2.1s)
  ok 8 e2e\resilience-and-isolation.spec.ts:12:1 › uses a fresh profile and removes it after shutdown (2.6s)
  8 passed (3.9s)
```

Step 4 writes no `run.json`. Its commits are the worktree's
`HEAD=16ff729262b4db4b7b2518d76d96667b1703f467` and the pin proof above.

### Memory

I ran `i-lab-campaign` Part 3's sampling loop every 15 s, collecting 142
samples from 00:15:02 to 00:50:27. Columns in the file are free physical GB
and the summed Chrome plus Node working set in GB.

- **Lowest free memory: 8.71 GB, at 00:30:21**, during the A+B window. The same
  sample holds the highest working set, 7.71 GB.
- Per window:
  ```
  pre-run baseline 00:15:02-00:17:58 samples=12 minFreeGB=13.89 maxChromeNodeWsGB=2.88
  A alone 00:17:59-00:20:12 samples=9 minFreeGB=11.72 maxChromeNodeWsGB=3.78
  A+B 00:20:13-00:40:20 samples=80 minFreeGB=8.71 maxChromeNodeWsGB=7.71
  A alone 00:40:21-00:49:14 samples=36 minFreeGB=11.4 maxChromeNodeWsGB=4.58
  step4 00:49:52-00:50:27 samples=3 minFreeGB=15.47 maxChromeNodeWsGB=0.2
  ```
- The baseline's 2.88 GB at 00:16:48 came before any Lab of mine started, so
  other workers' `node` processes are in these sums.
- Free memory never approached the 4 GB floor.

### After the runs

- **Worktrees.** `F:\fxlab\fxlab-16ff729` and `F:\fxlab\fxlab-16ff729-b` have
  empty `git status --porcelain` output. `F:\fxlab\fxlab-16ff729-step4` shows
  ` M apps/extension/build/{background,content,page-world,popup,sidepanel}/index.js{,.map}`,
  10 files.
- **The pinned Core.** `F:\fxlab\!FluxIQ` is `HEAD=267a2ca…` with an empty
  status.
- **The live Core** is `6f172b9398c3197905618bb072e1df82fe204a32`, with 15
  modified files, including
  `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` and
  `runtime/service.ts`. The main extension tree is at `d124b04`.
- **Run working directories.** `F:\fxlab-runs\stage1\a\.work` has 0 entries.
  `F:\fxlab-runs\stage1\b\.work` still holds
  `run-mtzhikvr-07c3f403\core-workspace`, with one child. A
  `Get-ChildItem -Recurse -Attributes ReparsePoint` over `F:\fxlab-runs\stage1`
  listed nothing.
- **Processes.** No process command line contains `fxlab`.

## Not verified

- **Why recorded entries never reach Core.** I did not investigate. The
  candidates the evidence leaves open:
  - machine load;
  - interference between concurrent instances, given the two 0-entry runs
    persisted 1.3 s apart;
  - Core `267a2ca`'s new discard of recording messages that arrive after Stop.
    I did not read that change.

  Core's gateway audit log, which would show discarded messages, is not read by
  the runner. Each isolated workspace was removed after its run.
- **Whether step 4b passes with one instance at scale.** 9 of 10 runs alone is
  not a 24-run measurement, and run 18 failed alone.
- **The exact exit of 30 runs** (step 4b 3–18, and all 12 of B's scenario runs
  plus the bench). Each is inferred from the redirected launcher log as described
  above, not from a status line. The compare's exit is observed on its rerun only.
- **What a Lab run must show to close each item:**
  - step 4b: 24 of 24 with `candidateCount` 4, at a commit with the dropped-entry
    cause fixed;
  - W18: `exit=0`, Flow `status=succeeded`, a `#password` type node that
    succeeds, and zero value hits;
  - W24 and W25: a reported category equal to the expected one;
  - 5.0: compare `equivalent`, run with no other instance, as Part 3's rule for
    latency comparisons requires.
- **Not run:**
  - `sensitive-input` ×3 and the week1 discovery bench 5.1, which Part 3 lists
    for Stage 1 but this brief does not;
  - Firefox;
  - `pnpm lab inspect`.
- **Not opened:** `report.html`, `review/` and the screenshots.
- **The memory peak between samples**, which a 15 s interval does not capture.
- **Cleanup.** The three extension worktrees each hold six junctions into
  `F:\fxlab\!FluxIQ\packages`. Removing them needs `i-lab-campaign` Part 2 item
  8's non-recursive junction delete first. I removed nothing, and did not touch
  `F:\fxlab-147fdb4`.

## Open questions or contradictions found

1. **The brief's worktree count cannot run two instances safely.** Two instances
   in one worktree race the domain build's `clean-dist` (see "What changed").
   Stage 2 and 3 briefs should give each instance its own worktree.
2. **W25's command is my reading.** `i-lab-campaign` names W25 only as a row
   (Part 3 Stage 1 B; criterion 4's "Bench also … W25 … `timeout`"). I derived
   `delayed-ui --flow --variant too-slow` from `bench/corpus/week1.ts:50`
   (`row("W25", "delayed-ui", null, ["too-slow"])`), by analogy with W24's
   `--flow --variant` form.
3. **Two sources disagree on the same recording.**
   - `snapshots/flow-lane.json` → `recording` reports `entriesAppendedAfterStop: 0`
     and `finalizationWaitMs` of 0.9–1.8 s on every run.
   - The same run's `runtime.settle` event reports the same `recordingId` with
     `entriesAppendedAfterStop` up to 8 and waits of up to 5.5 s. For W18 run 2,
     for example, the two read `0 / 972` and `7 / 5596`.
   - The live plan's item 5 names `runtime.settle`, so I report both. Which wait
     each file measures should be settled before they are quoted as proof.
4. **Step 4b's criteria 3 and 4 no longer detect the failure.** They look for
   "has not been finalized" and a "still being written" persistence failure.
   Neither appears, yet entries are lost before finalization. What catches the
   loss now is the B1 contract (`action.dispatch` / `recording.contract`, exit
   1). That is B1 working: the silent success is gone.
5. **Smoke gate 5.0 is placed in a concurrent instance.** Part 3's Stage 1 B puts
   it there, but Part 3's own rule is "1 (alone) … for anything whose latency is
   compared". The only regressed metric is navigate latency p95, 2609 against
   1684 ms. This gate result does not settle the question either way.
6. **`evaluation.lane` reads `recording` for every failed `--flow` run** here: W18,
   W24 and W25, all 9. That holds even where a Flow was built and ran, with
   `flow-lane.json` present and the Flow `status=succeeded` for W24. The passing
   step 4b runs read `lane=flow`. If the bench groups by this field, failed
   Flow-lane runs are misfiled.
7. **`processExits` is `{"scenario-lab":1,"fluxiq-web":1}` on passing runs** here,
   as in `l-stage0` item 2.
8. **A process lesson.** Git for Windows' `tail -F` on a file that PowerShell
   `Add-Content` appends to blocks the writer. `TaskStop` on the watch leaves
   `tail.exe` running. This was observed once, and it cost 30 status lines.
