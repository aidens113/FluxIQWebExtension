# t311 — Immediate pre-dry-run machine gate

Status: **Complete — GO as a snapshot**

Snapshot: `2026-09-27T05:08:08.4174678Z` (`2026-09-26 22:08:08.4174678 -07:00`).

## Decision

The immediate machine gate is clear for the supervisor's provider-free dry run:

- matching Lab/test-runner/Scenario-Lab processes: **0**;
- repository Lab build lock: **absent**;
- required Core/downstream output markers present: **11/11**;
- missing output markers: **0**.

This is a read-only point-in-time observation, not a process reservation. The supervisor remains responsible for invoking and validating the dry run. Repeat the process/lock predicate if material time passes or any build/Lab activity occurs before invocation.

## Process and lock state

The process scan matched internally against the approved sanitized pattern for:

- `scripts/lab`;
- the built test-runner CLI;
- `fluxiq-lab`;
- the built Scenario Lab server.

No process matched. No command lines, environment values, credentials, or secrets were recorded.

`F:\!FluxIQWebExtension\.lab-locks\build.lock` does not exist.

## Required output presence

All timestamps are UTC and are recorded only as identity/presence evidence.

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

The manifest is an existence-only marker; the generated content bundle is the extension build marker. t289 established strict downstream freshness, and the later t290/t293/t304 changes were test-only. t298 then established final Core root-test/check closure. t311 performed no new freshness assertion beyond verifying these required markers remain present.

## Boundary confirmation

No dry-run, live, browser, provider, Lab, build, test, check, or generated-output command was run. No source, shared document, run artifact, pending debug, process, lock, credential, commit, or push state was changed. This report is the only write.
