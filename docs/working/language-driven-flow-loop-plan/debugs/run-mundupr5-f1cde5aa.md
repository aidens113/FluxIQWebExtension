# Run debug: `run-mundupr5-f1cde5aa`

## Header

- Run id: `run-mundupr5-f1cde5aa` (t174 run 9)
- Scenario / task: crossborder-marketplace / `crossborder-marketplace-hub-to-cart`
  (`events.ndjson` has no dispatch; the task is the lane report's Runs row 9)
- Instance `t174-slot-1`. Started 2026-09-30 00:44:30.315 UTC; failed 00:45:04.306; finished
  00:45:05.561 (`summary.json`, `events.ndjson` seq 1). Run duration 34,995 ms
  (`evaluation.json`).
- Builds: facility `82a20780` dirty, Core `259a11ba` dirty, extension sha256 `6556c1ff…`
  (`run.json`), the same as runs 8 and 10. No Core web rebuild in this run (no
  `logs/core-web-build.log`; `run.json` `processExits` has no `core-web-build`).
- Memory at launch: about 2.4 GB of commit free; other lanes were running test suites and a Lab
  dry-run (lane report, Runs row 9; not in the bundle).
- Provider calls: 0 (`evaluation.json` `llm.calls: 0`).
- Verdict: failed, category `gateway.connection`, facility failure (`evaluation.json`).
- **Stage reached:** none. This is a facility failure, not a product result.

## What happened

Event 1 (`events.ndjson`, 00:45:04.306Z): the same failure as run 8 (`run-mundl2j0-df8e4a32`),
"Timed out waiting for extension pairing state during pre-approval", `timeoutMs: 15000`,
`waitedMs: 15008`, `connectionState: unreported`, `hasPairingReferenceCode: false`,
`hasSessionId: false`. Core started and bound its client gateway (`logs/core.log`: "Ready in
1677ms", gateway at port 56893, matching `run.json` `ports.gateway`) and logged nothing more. No
build was dispatched (`snapshots/decision-trace.json` `flows: []`).

## Cause

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | The extension never reported a connection state within 15 s of pre-approval. Shown: the timeout and the unreported state. Not shown: why. Run 10 (`run-mune0xh1-2470406a`) paired normally on the same extension and Core builds, so it is not a pairing regression (lane report, Runs row 10). **Inferred:** machine load, with about 2.4 GB of commit free and other lanes' suites and a Lab dry-run running at the time (lane report, Runs row 9). | Facility | None. Reported to the supervisor (lane report, Runs row 9). | Open; the lane report names no owner. |
