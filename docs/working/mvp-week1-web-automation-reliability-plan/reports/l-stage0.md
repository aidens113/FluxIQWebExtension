# l-stage0 — prove the Lab runs from a worktree

Worker report for the `l-stage0` brief in
[finish-week1.md](../briefs/finish-week1.md). Written 2026-09-13 (local time,
UTC-7). Times below are local unless marked `Z`.

## Outcome

**Done. The path is proven by a single run, but the run did not load a frozen
Core.**

A detached worktree at `F:\fxlab-147fdb4` (commit `147fdb4`) installed offline
and built from empty. It ran `basic-form --target isolated` to a pass with exit
0 in 101.4 s wall. The artifacts went to `F:\fxlab-runs\stage0`, outside every
worktree. The manifest records the facility as `dirty: false`, but Core as
`dirty: true`. Core was clean when I checked it at about 23:57. Another worker's
edit to Core's `client-gateway/bridge.ts` landed between that check and the
manifest. See "Open questions" item 1.

This is one observation on a machine with faulty RAM.

## What changed and why

No tracked file was changed in either repository. Created:

- Worktree `F:\fxlab-147fdb4`, detached at
  `147fdb458015bd8a63c5f4e9099d3d8774353d63`. It is kept for Stage 1, with its
  per-instance build output under `.lab-instances/l-stage0/`.
- Run directory `F:\fxlab-runs\stage0\run-mtzgp21f-57ba88e6`.
- Scratch files, not in either repository, all under
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`:
  - `l-stage0-lab-mem.csv`: memory samples;
  - `l-stage0-lab-run.log`: the full launcher output;
  - `l-stage0-lab-run-status.txt`: exit status and wall time;
  - `l-stage0-install.log`, `l-stage0-worktree-add.log`;
  - `l-stage0-maintree-status-before.txt`, `l-stage0-maintree-status-after.txt`.

## Commands run and observed results

### Pre-checks

- Main tree `git rev-parse HEAD` returned `147fdb458015bd8a63c5f4e9099d3d8774353d63`.
  `git worktree list` showed only `F:/!FluxIQWebExtension  147fdb4 [dev]`.
- `F:\fxlab-147fdb4` and `F:\fxlab-runs` did not exist.
- Core `git -C F:\!FluxIQ rev-parse HEAD` returned
  `5d495eb06bea8ba024463394b98a4f77b61de08a`. `git status --porcelain` was
  empty, checked twice: at about 23:56, and again at about 23:57 with the
  main-tree snapshot.
- Free memory: `FreeGB: 15.46 TotalGB: 25.85`.
- No process command line matched `run-lab.mjs`, `test-runner\dist\cli.js`,
  `next dev` or `turbopack`, so no other Lab was running.

### Worktree and install

- `git worktree add --detach "F:\fxlab-147fdb4" 147fdb4` printed `exit=0` and
  `HEAD is now at 147fdb4 Split the background connection by responsibility: 764 lines to 344`.
  The worktree's `git status --porcelain` was empty.
- `pnpm -C "F:\fxlab-147fdb4" install --frozen-lockfile --offline` printed
  `exit=0 seconds=1.1244831`, `Lockfile is up to date, resolution step is skipped`,
  `Progress: resolved 12, reused 12, downloaded 0, added 12, done`, `Done in 769ms`.
- The worktree's junctions into Core, quoted:
  ```
  F:\fxlab-147fdb4\domain\node_modules\fluxiq -> F:\!FluxIQ\packages\fluxiq\
  F:\fxlab-147fdb4\domain\node_modules\@fluxiq\client-gateway-websocket -> F:\!FluxIQ\packages\client-gateway-websocket\
  F:\fxlab-147fdb4\apps\extension\node_modules\fluxiq -> F:\!FluxIQ\packages\fluxiq\
  F:\fxlab-147fdb4\apps\extension\node_modules\@fluxiq\client-gateway-websocket -> F:\!FluxIQ\packages\client-gateway-websocket\
  F:\fxlab-147fdb4\packages\test-runner\node_modules\fluxiq -> F:\!FluxIQ\packages\fluxiq\
  F:\fxlab-147fdb4\packages\test-contracts\node_modules\@fluxiq\contracts -> F:\!FluxIQ\packages\contracts\
  ```
  The worktree's `git status --porcelain` was still empty after install.

### The Lab run

The label was `FLUXIQ_LAB_INSTANCE=l-stage0`, matching
`EXTENSION_TEST_BUILD_LABEL=l-stage0`. The command, in one PowerShell process:

```
$env:FLUXIQ_TEST_ENV_FILES='none'; $env:FLUXIQ_LAB_INSTANCE='l-stage0'; $env:EXTENSION_TEST_BUILD_LABEL='l-stage0'; $env:FLUXIQ_TEST_RUNS_DIR='F:\fxlab-runs\stage0'
pnpm -C "F:\fxlab-147fdb4" lab run basic-form --target isolated *> l-stage0-lab-run.log
```

The exit status was captured through `$LASTEXITCODE` after a file redirect, with
no pipe.

**Exit status and wall time**, from `l-stage0-lab-run-status.txt`:

```
start=2026-09-12T23:57:18.1736258-07:00 end=2026-09-12T23:58:59.5919099-07:00 seconds=101.4182841 exit=0
```

The build phase took about 19 s: from launch at 23:57:18 to the runner's
`startedAt` of `06:57:37.029Z`. The runner itself reports `"durationMs": 80410`.

**Launcher lines from the log**, quoted:

```
node.exe : {"lab":"core-build","state":"quiet","root":"F:\\!FluxIQ","files":2144,"newest":"2026-09-13T01:43:12.021Z","waitedMs":160}
{"lab":"paths","instance":"l-stage0","extensionPath":"F:\\fxlab-147fdb4\\apps\\extension\\.lab-instances\\l-stage0\\dist\\e2e-chromium","scenarioEntrypoint":"F:\\fxlab-147fdb4\\apps\\scenario-lab\\.lab-instances\\l-stage0\\dist\\server.js","hostModule":"F:\\fxlab-147fdb4\\domain\\.lab-instances\\l-stage0\\host\\web-panel-host.mjs","runsDirectory":"F:\\fxlab-runs\\stage0"}
{"runId":"run-mtzgp21f-57ba88e6","verdict":"passed","path":"F:\\fxlab-runs\\stage0\\run-mtzgp21f-57ba88e6", ...}
```

The build ran from empty in the documented order: scenario-lab `build`,
extension `test:e2e:build`, domain `host:build`, then `test-runner...` `build`.
It printed `domain build: clean-dist: removed 0 emitted file(s) from dist`, and
the `test-runner` build printed `Done`. A grep of the log for `core-build` finds
only the `quiet` line. There is **no `changed-during-run` line**.

**Bundle path:** `F:\fxlab-runs\stage0\run-mtzgp21f-57ba88e6`. It contains
`artifact-index.json`, `bundle.complete.json`, `evaluation.json`,
`events.ndjson`, `evidence-policy.json`, `report.html`, `run.json`,
`summary.json`, `logs/core.log`, `logs/scenario-lab.log`,
`review/contact-sheet.html`, `review/timeline.json`, and five screenshots.
`bundle.complete.json` is
`{"schemaVersion": "0.1", "artifactIndexSha256": "b97290b802166371cc504f5c72cd3be31f891777491d23e8dcd097df4b8b48b7"}`.

**`evaluation.json`**, quoted in full:

```json
{
  "schemaVersion": "0.1",
  "runId": "run-mtzgp21f-57ba88e6",
  "verdict": "passed",
  "invariants": [
    { "id": "runner-verdict", "passed": true, "expected": "passed", "actual": "passed", "evidenceSequences": [17] }
  ],
  "metrics": { "steps": 5 },
  "scenarioId": "basic-form",
  "workflowId": null,
  "variantId": null,
  "repeatIndex": 0,
  "lane": "recording",
  "flowCreated": null,
  "oracleVerdict": "passed",
  "reportedVerdict": "passed",
  "automationFailureReported": null,
  "automationFailureExpected": null,
  "harnessActivations": 0,
  "durationMs": 80410,
  "actions": [
    { "actionType": "web.browser.navigate", "durationMs": 1695 },
    { "actionType": "web.dom.type", "durationMs": 1418 }
  ],
  "evidence": { "sanitizedPacketBytes": [], "rawSnapshotBytes": [], "truncationCount": 0 },
  "llm": { "mode": "disabled", "profileId": null, "calls": 0 },
  "harnessRecovery": null,
  "adaptationCost": null,
  "adaptationValidation": null,
  "adaptationPersistence": null,
  "adaptationReuse": null
}
```

The file was reformatted to one invariant and one action per line. The values
are unchanged.

**Manifest (`run.json`)**, quoted:

```json
  "status": "passed",
  "startedAt": "2026-09-13T06:57:37.029Z",
  "finishedAt": "2026-09-13T06:58:57.439Z",
  "repositories": {
    "facility": {
      "path": "F:\\fxlab-147fdb4",
      "commit": "147fdb458015bd8a63c5f4e9099d3d8774353d63",
      "dirty": false
    },
    "core": {
      "path": "F:\\!FluxIQ",
      "commit": "5d495eb06bea8ba024463394b98a4f77b61de08a",
      "dirty": true
    }
  },
```

Also from `run.json`:

```json
  "extension": { "version": "0.1.0", "sha256": "e6ac8e2dc3c84b8f36e7e3bd9233af10d19c543edbd8adf7120863903b18fa9d", "path": "apps/extension/.lab-instances/l-stage0/dist/e2e-chromium" },
  "environment": { "browserName": "chromium", "browserVersion": "Chrome/134.0.6998.35", ... },
  "processExits": { "scenario-lab": 1, "fluxiq-web": 1 },
  "redactionState": "verified",
  "verdict": "passed",
  "fluxiqExecution": { "targetMode": "isolated" },
  "automationFailure": null,
```

The steps `enter-name` (type), `choose-plan` (select), `enter-notes` (type),
`submit` (click) and `submitted` (checkpoint) all have `"outcome": "succeeded"`.

`summary.json` shows `"eventCount": 17`, `"screenshotCount": 5` and
`"duplicateScreenshotCount": 5`.

The end of `logs/core.log`:

```
[stdout]  ✓ Ready in 18.3s
...
[stdout] [FluxIQ] Client gateway WebSocket bound to shared runtime web.mtzgqdd6.abgtn4dmhgr at ws://127.0.0.1:56749/client
...
[stdout]  POST /api/programs/automation-studio/execute-client-action 200 in 1691ms
[stdout]  POST /api/programs/automation-studio/execute-client-action 200 in 1414ms
...
[exit] code=1 signal=null
```

### Memory

The Part 3 loop sampled every 15 s. Columns are timestamp, free physical memory
in GB, and the summed Chrome plus Node working set in GB. The full file:

```
2026-09-12T23:56:20,15.44,0.00
2026-09-12T23:56:35,15.46,0.00
2026-09-12T23:56:50,15.42,0.00
2026-09-12T23:57:05,15.44,0.00
2026-09-12T23:57:21,15.02,0.48
2026-09-12T23:57:36,15.11,0.37
2026-09-12T23:57:51,15.00,0.26
2026-09-12T23:58:06,14.99,0.42
2026-09-12T23:58:21,14.87,0.52
2026-09-12T23:58:36,13.10,2.08
2026-09-12T23:58:51,12.26,3.49
2026-09-12T23:59:06,15.21,0.00
2026-09-12T23:59:21,15.29,0.00
```

- **Lowest free memory: 12.26 GB**, at 23:58:51.
- **Highest Chrome plus Node working set: 3.49 GB**, in the same sample.
- The pre-run baseline was 15.42–15.46 GB free with a 0.00 GB working set, so
  free memory dropped by about 3.2 GB at the sampled peak.
- Only two samples fall in the heavy phase: the Next dev server and the headed
  browser, from about 23:58:21 to 23:58:57. The true peak between samples was
  not captured.

### The main tree and Core after the run

- **Worktree.** `git -C F:\fxlab-147fdb4 status --porcelain` was empty after the
  run. That matches the manifest's facility `dirty: false`.
- **Main tree.** Its status hash changed from
  `D43F7DF7AE33CE37A346AD82ECFF87D77540C570AD62EB1D2F70FC8DB4ED5A7A` to
  `FA95AF1B23E1C046D38369127D668DCA3F2973F427096D40310CBE71B58FD87C`. The whole
  difference is five newly modified tracked source files:
  ```
  =>  M apps/extension/src/content/action-runtime/tests/validation-outcome.test.ts
  =>  M apps/extension/src/content/action-runtime/validation-outcome.ts
  =>  M apps/scenario-lab/src/scenarios/storefront-checkout/manifest.ts
  =>  M apps/scenario-lab/src/scenarios/storefront-checkout/tests/scenario.test.ts
  =>  M docs/architecture/testing-facility.md
  ```
  These are parallel workers' source edits. The launcher and runner write only
  under the worktree root and `FLUXIQ_TEST_RUNS_DIR`. They build no
  `docs/architecture` page and no source file.
- **Core.** After the run:
  ```
  git -C F:\!FluxIQ diff --stat
   .../automation-studio/client-gateway/bridge.ts     |  83 ++++++++++++---
   .../client-gateway/tests/bridge.test.ts            | 118 +++++++++++++++++++++
   2 files changed, 186 insertions(+), 15 deletions(-)
  ```
  File times: `bridge.ts` `2026-09-13T00:00:34.6855601-07:00`, `bridge.test.ts`
  `2026-09-12T23:59:41.4286167-07:00`, and Core's built
  `dist\programs\automation-studio\client-gateway\bridge.js`
  `2026-09-12T18:43:07.0984000-07:00`.
- **Run working directory.** `F:\fxlab-runs\stage0\.work` was empty after the
  run. The reparse-point scan found no junctions left under it.

## Not verified

- **Which Core source the run compiled.**
  - Core was clean at about 23:57. The manifest, written at run start
    (06:57:37Z, 23:57:37 local) or at finish, says `dirty: true`.
  - Both dirty files have been rewritten since, the last write at 00:00:34, so
    the bytes of `bridge.ts` that Next's Turbopack compiled cannot be recovered.
  - Core's built `bridge.js` (18:43) did not change, and the build watcher saw
    no change. A Core source edit reaches the Lab only through the source
    junction for Next's `transpilePackages`. That path comes from
    `i-lab-campaign` Part 2 item 4, citing `coordinator.ts:270-276`; I did not
    re-read that code.
  - The run passed, and a gateway failure did not occur, so no rerun was
    needed under the brief.
- **Memory peak between samples.** With a 15 s interval and a heavy phase of
  about 40 s, the true peak is unknown. The Chrome plus Node sum would also count
  other workers' `node` processes and the user's own `chrome`, though the
  baseline just before the run was 0.00 GB.
- **Repeatability.** This is one run on a machine with faulty RAM. The 101 s wall
  time and 3.49 GB peak are single observations. Part 3 estimated "about
  10 min" and "2.5–4.5 GB, unmeasured".
- **Not run:**
  - `pnpm lab inspect` against the bundle;
  - `report.html`, `review/`, `events.ndjson` and the screenshots, which I did
    not read;
  - the Flow lane (this run's lane is `recording`);
  - any Core build.
- **Removing the worktree safely.** The worktree holds the six Core junctions
  listed above. Its removal needs Part 2 item 8's non-recursive junction delete
  first. I did not remove it, as the brief says to keep it.

## Open questions or contradictions found

1. **"Freeze Core" must cover Core source edits, not only Core builds.**
   - Part 3's rule is "No Core build while any instance is running", and the
     brief allowed a parallel Core worker to edit `client-gateway/bridge.ts`.
   - The launcher's guard watches Core's build output only. It reported
     `"state":"quiet"` and no `changed-during-run`, yet the manifest recorded
     Core `dirty: true`.
   - Per Part 2 item 4, the Next server compiles Core source live. A Stage 1–3
     proof run therefore needs no Core source edits in flight, as well as no
     builds. Otherwise its manifest cannot show `dirty: false` and the Core it
     loaded is unknown.
   - **This Stage 0 run proves the worktree path, not a pinned-Core
     measurement.**
2. **Both child processes exited 1 on a passing run.**
   - `run.json` shows `"processExits": { "scenario-lab": 1, "fluxiq-web": 1 }`,
     and `core.log` ends `[exit] code=1 signal=null`.
   - This is most likely the Windows teardown kill, but I did not investigate
     it.
   - If the bench or failure classification ever reads `processExits`, a
     passing run already carries 1s.
3. **A passing `recording`-lane run reports empty evidence size arrays:**
   `"sanitizedPacketBytes": [], "rawSnapshotBytes": []`. This is relevant to
   `g-bench-coverage`, which measures evidence size, and to criterion 2's Lab
   proof.
4. **`summary.json` counts all five screenshots as duplicates:**
   `"screenshotCount": 5, "duplicateScreenshotCount": 5`. I did not open them
   to see whether they are genuinely identical.
5. **Measured cost is well under the estimate.** Part 3 estimated about 10 min
   for Stage 0 A with a fresh build; the measured wall time is 101 s, of which
   about 19 s is the build. These are single observations, but they suggest the
   Stage 1–2 wall times in Part 3 are conservative.
