# Run debug: `run-munhpy2m-036e9572`

## Header

- Run id: `run-munhpy2m-036e9572` (t174 run 11), the first run on the Fix 2 builds.
- Scenario / task: crossborder-marketplace / `crossborder-marketplace-hub-to-cart`, launched
  by the lane's slot-1 launcher (headed Chromium 134, `run.json` `environment`).
- Instance `t174-slot-1`. Started 2026-09-30 02:32:46.284 UTC. Failed 02:35:56.713 (`events.ndjson` seq 1).
  Finished 02:35:58.024 (`summary.json`). Duration 191,161 ms (`evaluation.json`).
- Builds: facility `b1a82a21` dirty and Core `9d3cdf9b` dirty. The dirty parts are the lane's uncommitted Fix 2:
  `draft-shown.ts`, the service.ts blank line, the server-process source maps and their tests.
  Extension sha256 `4cb3a5bd…` from `apps/extension/.lab-instances/t174-slot-1/dist/e2e-chromium` (`run.json`).
  Core web rebuilt for this run: `logs/core-web-build.log`, `processExits.core-web-build: 0`.
- Machine at launch: 2,676 MB of RAM free, 15,338 MB of commit free (checked before launch). Build
  slot b1 was held by another lane while the run went: the owner line at 02:40 was
  `t187 bench | C.test p2 | pnpm test | 02:35:51Z`, and the one before it is not recorded. CPU
  load read 100% at 02:40:36Z, four minutes after the failure. What held the CPU during the run
  itself was not measured.
- Provider calls: 0 (`evaluation.json` `llm.calls: 0`).
- Verdict: failed, `gateway.connection`, facility failure `scenario.execute` / `unclassified`.
- **Stage reached:** none. This is a facility failure, not a product result.

## What happened

- Core started and bound its client gateway: `logs/core.log` "Ready in 2.3s", with the gateway at
  `ws://127.0.0.1:53526/client`, matching `run.json` `ports.gateway`. It logged nothing else. No build
  trace line appeared, so no build was dispatched (`snapshots/decision-trace.json` `flows: []`).
- The scenario server was ready at port 53524 (`logs/scenario-lab.log`).
- Event 1 (`events.ndjson`, 02:35:56.713Z): "Timed out waiting for extension pairing state during
  pre-approval", with `timeoutMs: 15000`, `waitedMs: 15009` and `lastStatus.connectionState: unreported`.
  It had no reference code, no session, and a null queue.
- `unreported` with every field null means `lastStatus` was never set
  (`packages/test-runner/src/run-lifecycle/pair-extension.ts`, `safeStatus`). The **first**
  `fluxiq.connect` runtime message (`run-scenario.ts:684`) did not answer within the 15 s
  deadline: the extension's service worker never acknowledged the connect at all. That is not a
  refused or failed pairing.
- About 175 s passed between the run's start (02:32:46) and the start of the 15 s pairing wait
  (about 02:35:41). The bundle does not say where they went: the Lab's own stdout was filtered
  by the launcher and not kept. Launcher changed for run 12 so the full Lab log is kept.

## Cause

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| 1 | The extension's first `fluxiq.connect` got no answer within 15 s. This is the third time on this task (runs 8, 9, 11); run 10 paired on the same kind of build. Shown: no acknowledgement at all, and a 175 s run-up before the wait. Not shown: why. **Inferred:** CPU starvation of the service worker. The CPU read 100% four minutes later, with other lanes' `pnpm test` in a build slot, and runs 8 and 9 had the same failure with other lanes' suites running. Not excluded: the t182 connection changes (`apps/extension/src/background/connection.ts`), merged downstream in `b1a82a21`, since this is the first run on them. | Facility, possibly the extension | None yet. Run 12 keeps the full Lab log, so the 175 s run-up and the connect can be timed. | Open (t174). |
