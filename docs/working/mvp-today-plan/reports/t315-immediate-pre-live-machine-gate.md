# t315 — Immediate pre-live one-Lab machine gate

Status: **Complete — GO as a point-in-time machine snapshot**

Snapshot: `2026-09-27T05:12:04.9580243Z`.

## Decision

The immediate one-Lab machine predicate is clear for the supervisor's live invocation:

- matching Lab/test-runner/Scenario-Lab processes: **0**;
- repository Lab build lock: **absent**;
- required Core/downstream output markers present: **11/11**;
- missing output markers: **0**.

This is a read-only snapshot, not a reservation. It does not authorize this worker to start the live run, and the predicate should be repeated if material time passes or another build/Lab action occurs before the supervisor invokes it.

## Process and lock state

The process scan matched internally against the same sanitized categories as t311:

- `scripts/lab`;
- the built test-runner CLI;
- `fluxiq-lab`;
- the built Scenario Lab server.

No matching process remained after excluding the PowerShell process performing this check. No command line, environment value, credential, or secret was printed or recorded.

`F:\!FluxIQWebExtension\.lab-locks\build.lock` does not exist.

## Required output presence

The same 11 identity markers from t311 remain present. Timestamps are UTC and are presence evidence only; this gate did not rebuild or independently re-prove freshness.

| Output marker | Present | Last write UTC |
| --- | --- | --- |
| Core contracts `packages/contracts/dist/index.js` | yes | `2026-09-27T04:31:56.8327575Z` |
| Core FluxIQ `packages/fluxiq/dist/index.js` | yes | `2026-09-27T04:32:07.1082369Z` |
| Core gateway `packages/client-gateway-websocket/dist/index.js` | yes | `2026-09-27T04:32:09.2821662Z` |
| Core web `apps/web/.next/BUILD_ID` | yes | `2026-09-27T04:32:50.5891686Z` |
| Test contracts `packages/test-contracts/dist/index.js` | yes | `2026-09-27T04:34:27.5817816Z` |
| Test evidence `packages/test-evidence/dist/index.js` | yes | `2026-09-27T04:40:58.1776017Z` |
| Domain `domain/dist/index.js` | yes | `2026-09-27T04:34:04.5339326Z` |
| Extension bundle `apps/extension/dist/e2e-chromium/content/index.js` | yes | `2026-09-27T04:34:21.3613545Z` |
| Extension manifest `apps/extension/dist/e2e-chromium/manifest.json` | yes | `2026-09-12T00:10:16.7076473Z` |
| Scenario Lab `apps/scenario-lab/dist/server.js` | yes | `2026-09-27T04:34:34.3926137Z` |
| Test runner `packages/test-runner/dist/cli.js` | yes | `2026-09-27T04:41:09.6160474Z` |

The manifest remains an existence-only marker; the generated content bundle is the extension build marker.

## Boundary confirmation

No dry-run, live, browser, provider, Lab, build, test, check, or generated-output command was run. No source, shared document, run artifact, process, lock, credential, commit, or push state was changed. This report is the only write.
