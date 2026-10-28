# b2-trace-ids report

Outcome: Done.

## 2026-10-27 What changed
- candidate-trial/contracts.ts, subflow-trial/types.ts: optional `traceId` on both records.
- candidate-trial/run.ts, subflow-trial/run.ts: inside the traced work, read `AutomationStudioGatewayTraceInstallation.current()?.current()?.traceId` and add it to the outcome's record (not the result). Early returns before the episode opens (unaffordable, start failed) carry none.
- Offline: the same read happens, so an offline trial with tracing installed records its derived trace's id; the offline runner (other worker) bypasses port records, not touched. Not separately tested.
- New tests: candidate-trial/tests/trace-id.test.ts, subflow-trial/tests/trace-id.test.ts (with tracing: traceId "trace-1", manifest activity test, episodeId = trialRunId; without: no property).

## Commands
- Tests first: both new files failed (`record.traceId` undefined), 2 failed / 2 passed.
- `pnpm test .../candidate-trial .../subflow-trial` (one combined run): `Test Files 38 passed (38)`, `Tests 253 passed (253)`.
- `pnpm exec tsc --noEmit -p .` OOMs at default heap; with NODE_OPTIONS=--max-old-space-size=8192 only errors are in service/offline-trial/tests/{subflow-harness.ts,subflow-run.test.ts} (other worker's unfinished files).

UNIT READY: candidate-trial/{run.ts,contracts.ts,tests/trace-id.test.ts}, subflow-trial/{run.ts,types.ts,tests/trace-id.test.ts}
