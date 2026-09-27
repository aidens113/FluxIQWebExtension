# t337 — Run 4 output-freshness re-observation

Status: **GO — all six downstream comparisons remain strict PASS; all 11 required markers are present**

Captured at `2026-09-27T05:32:41.7194541Z` after run-3/debug/documentation churn. This was a read-only timestamp/status re-observation using the same owners, output markers, and strict-newer-than method as t283/t309. No output was rebuilt.

## Decision

The required downstream build outputs remain fresh relative to their newest built dependencies. Every timestamp is exactly unchanged from t309. The seven Core production-owner Git statuses and filesystem timestamps used by the prior binding evidence are also unchanged, so the intervening run-3 and working-document activity did not touch those production owners.

This is a **freshness GO only**. It does not replace the complete settled-tree branch/HEAD/dirty-scope identity gate, the immediate one-Lab/process/lock gate, or the provider-free dry-run.

## Six strict freshness comparisons

The rule is `output.LastWriteTimeUtc > newestBuiltDependency.LastWriteTimeUtc`; equality is not accepted.

| Owner/output | Output UTC | Newest built dependency | Dependency UTC | Result |
| --- | --- | --- | --- | --- |
| test-contracts — `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | Core contracts — `packages/contracts/dist/index.js` | `2026-09-27T04:31:56.8327575Z` | **PASS** |
| test-evidence — `packages/test-evidence/dist/index.js` | `2026-09-27T04:40:58.1776017Z` | test-contracts | `2026-09-27T04:34:27.5817816Z` | **PASS** |
| domain — `domain/dist/index.js` | `2026-09-27T04:34:04.5339326Z` | Core gateway — `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T04:32:09.2821662Z` | **PASS** |
| extension — `apps/extension/dist/e2e-chromium/content/index.js` | `2026-09-27T04:34:21.3613545Z` | domain | `2026-09-27T04:34:04.5339326Z` | **PASS** |
| Scenario Lab — `apps/scenario-lab/dist/server.js` | `2026-09-27T04:34:34.3926137Z` | test-contracts | `2026-09-27T04:34:27.5817816Z` | **PASS** |
| test runner — `packages/test-runner/dist/cli.js` | `2026-09-27T04:41:09.6160474Z` | test-evidence | `2026-09-27T04:40:58.1776017Z` | **PASS** |

All six output and dependency timestamps exactly match t309's table; no comparison weakened or became equal.

## Required output-marker presence

| Marker | Present | Last write UTC |
| --- | --- | --- |
| Core contracts `packages/contracts/dist/index.js` | yes | `2026-09-27T04:31:56.8327575Z` |
| Core FluxIQ `packages/fluxiq/dist/index.js` | yes | `2026-09-27T04:32:07.1082369Z` |
| Core gateway `packages/client-gateway-websocket/dist/index.js` | yes | `2026-09-27T04:32:09.2821662Z` |
| Core web `apps/web/.next/BUILD_ID` | yes | `2026-09-27T04:32:50.5891686Z` |
| Test contracts `packages/test-contracts/dist/index.js` | yes | `2026-09-27T04:34:27.5817816Z` |
| Test evidence `packages/test-evidence/dist/index.js` | yes | `2026-09-27T04:40:58.1776017Z` |
| Domain `domain/dist/index.js` | yes | `2026-09-27T04:34:04.5339326Z` |
| Extension content `apps/extension/dist/e2e-chromium/content/index.js` | yes | `2026-09-27T04:34:21.3613545Z` |
| E2E Chromium manifest `apps/extension/dist/e2e-chromium/manifest.json` | yes | `2026-09-12T00:10:16.7076473Z` |
| Scenario Lab `apps/scenario-lab/dist/server.js` | yes | `2026-09-27T04:34:34.3926137Z` |
| Test runner `packages/test-runner/dist/cli.js` | yes | `2026-09-27T04:41:09.6160474Z` |

Presence is **11/11**. The E2E manifest remains an existence-only marker, exactly as in t309/t315; its older timestamp is not compared to the extension content output and is not promoted into freshness evidence.

## Core production-owner stability

The seven t258 production owners named by t283 retain the same Git status and `LastWriteTimeUtc`:

| Core owner | Status | Last write UTC | Match prior evidence |
| --- | --- | --- | --- |
| `packages/fluxiq/src/programs/_shared/runtime.ts` | ` M` | `2026-09-27T01:31:15.9837695Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts` | ` M` | `2026-09-27T01:31:12.3314270Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` | ` M` | `2026-09-27T04:29:45.1754382Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-continuation.ts` | `??` | `2026-09-27T01:44:27.9232939Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/index.ts` | ` M` | `2026-09-27T01:37:44.0342295Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/bootstrap-target.ts` | `??` | `2026-09-27T04:29:45.1690589Z` | exact |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/index.ts` | ` M` | `2026-09-27T04:29:45.1690589Z` | exact |

This establishes no timestamp/status drift in the named production ownership used by the prior freshness decision. It is not a substitute for the full binding fingerprint or content identity capture required separately for run 4.

## Process/lock boundary

No process or lock snapshot was taken in this task. Even if one had been clear at capture time, it would not reserve the machine. The supervisor must still repeat the immediate one-Lab/process/lock gate before the provider-free dry-run and again immediately before the live invocation.

## Scope

Read t283/t309 and inspected only the named Core production-owner status/timestamps and required generated-output marker existence/timestamps. I did not rebuild, test, edit source/shared/generated files, open `test-runs`, or run Lab/provider/browser commands. This report is the only write.
