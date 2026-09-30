# Run debug: `run-mundl2j0-df8e4a32`

## Header

- Run id: `run-mundl2j0-df8e4a32` (t174 run 8)
- Scenario / task: crossborder-marketplace / `crossborder-marketplace-hub-to-cart`
  (`events.ndjson` has no dispatch; the task is the lane report's Runs row 8)
- Instance `t174-slot-1`. Started 2026-09-30 00:37:00.314 UTC; failed 00:40:47.636; finished
  00:40:50.546 (`summary.json`, `events.ndjson` seq 1).
- Builds: facility `82a20780` dirty, Core `259a11ba` dirty, extension sha256 `6556c1ff…`
  (`run.json`). Core's web app was rebuilt in this run (`logs/core-web-build.log`: "Compiled
  successfully in 68s", `[exit] code=0`).
- Memory at launch: NO EVIDENCE (not in the bundle, and the lane report gives no figure for this
  run).
- Provider calls: 0 (`evaluation.json` `llm.calls: 0`).
- Verdict: failed, category `gateway.connection`, facility failure (`evaluation.json`).
- **Stage reached:** none. This is a facility failure, not a product result.

## What happened

Event 1 (`events.ndjson`, 00:40:47.636Z): "Timed out waiting for extension pairing state during
pre-approval", `pairingStage: pre-approval`, `timeoutMs: 15000`, `waitedMs: 15009`, last status
`connectionState: unreported`, `hasPairingReferenceCode: false`, `hasSessionId: false`,
`queueSize: null`, `msSinceLastMessage: null`. Core started and bound its client gateway
(`logs/core.log`: "Ready in 2.8s", gateway bound at port 56829, which matches `run.json`
`ports.gateway`); it has no further lines, so the extension never reported to it. No build was
dispatched and no Flow exists (`snapshots/decision-trace.json` `flows: []`).

## Cause

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | The extension never reported a connection state within 15 s of pre-approval, so pairing timed out before any build. Shown: the timeout and the unreported state. Not shown: why the extension was silent. Run 10 (`run-mune0xh1-2470406a`) paired normally with the same extension sha256 and Core commit, so the report concludes this was not a pairing regression; **inferred**, from run 9's conditions (about 2.4 GB of commit free, other lanes running suites and a Lab dry-run, per the report's Runs row 9), machine load is the likely cause. | Facility | None. | Open; the lane report names no owner (reported to the supervisor with run 9). |
