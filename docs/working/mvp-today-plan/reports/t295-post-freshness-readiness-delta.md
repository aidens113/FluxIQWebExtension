# t295 — Post-freshness readiness delta

Status: **Complete read-only snapshot**

Snapshot: `2026-09-27T04:49:18.5712101Z` (`2026-09-26 21:49:18.5712101 -07:00`).

## Decision

**Downstream freshness: GO. Current one-Lab state: GO as a snapshot. Overall run-3 readiness:
NO-GO while the final Core root test rerun and provider-free dry-run remain pending.**

T289's recovered outputs remain strictly newer than every tracked source and built dependency in
t263's comparison. No Lab/test-runner/Scenario-Lab process matched the sanitized one-Lab pattern,
and `.lab-locks/build.lock` was absent. These are read-only observations, not a reservation or live
authorization.

T290 has repaired the stale permission test and reports its five-file matrix passing 81/81. The
separate deadline fixture identified by t291 still requires its deterministic test-only
reconciliation and review, followed by the complete Core root `pnpm test`. Until that root command
passes on the final test tree, the Core gate that exposed both failures remains open.

## Current downstream freshness

All timestamps are UTC. Each result uses strict `output > newest tracked input or built dependency`
semantics from t263.

| Owner | Output | Output timestamp | Newest current input/dependency | Newest timestamp | Result |
| --- | --- | --- | --- | --- | --- |
| test-contracts | `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | Core `packages/contracts/dist/index.js` | `2026-09-27T04:31:56.8327575Z` | **PASS** |
| test-evidence | `packages/test-evidence/dist/index.js` | `2026-09-27T04:40:58.1776017Z` | `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | **PASS** |
| domain | `domain/dist/index.js` | `2026-09-27T04:34:04.5339326Z` | Core `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T04:32:09.2821662Z` | **PASS** |
| extension | `apps/extension/dist/e2e-chromium/content/index.js` | `2026-09-27T04:34:21.3613545Z` | `domain/dist/index.js` | `2026-09-27T04:34:04.5339326Z` | **PASS** |
| Scenario Lab | `apps/scenario-lab/dist/server.js` | `2026-09-27T04:34:34.3926137Z` | `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | **PASS** |
| test runner | `packages/test-runner/dist/cli.js` | `2026-09-27T04:41:09.6160474Z` | `packages/test-evidence/dist/index.js` | `2026-09-27T04:40:58.1776017Z` | **PASS** |

The E2E Chromium manifest exists at
`apps/extension/dist/e2e-chromium/manifest.json` with timestamp
`2026-09-12T00:10:16.7076473Z`. As required, it is existence-only; the generated content bundle is
the freshness marker.

The timestamps are unchanged from t289 because this task ran no build. Re-evaluating the complete
tracked-input sets confirms that no later downstream production input invalidated them.

## Current one-Lab snapshot

- Matching Lab/build/test-runner/Scenario-Lab processes: **0**.
- `.lab-locks/build.lock`: **absent**.
- Result: **GO as of the snapshot only**.

The process scan retained only process name/id for matches and found none; no command lines or
secrets were recorded. Repeat this gate immediately before the dry-run and immediately before the
live invocation.

## Exact remaining serial gates

1. Land and review the t291 deterministic, fixture-only deadline reconciliation. It must inject the
   typed timeout after endpoint entry, preserve the same grant, and pass its four-file focused
   matrix. No production change is expected.
2. Run final Core root `pnpm test` with the repository's declared memory setting on the final test
   tree. Record exit status, totals, skipped count, duration, and confirmation that both formerly
   failing files pass. Per t282, this root command subsumes the previously missing t270 focused
   files.
3. If either repair changes production source rather than tests only, repeat Core check/build,
   output freshness, the downstream dependency closure, and these six comparisons. Test-only
   changes do not invalidate the current production outputs.
4. Capture the final Core/downstream tree identity after test editing stops. Prior identity
   timestamps predate the t290/t293 test reconciliation.
5. Repeat the one-Lab process/lock gate and run the unchanged provider-free `--dry-run`. Require
   exit zero, `status:"ready"`, `providerCallCount:0`, `lane:"created-flow"`,
   `target:"isolated"`, and the expected scenario/workflow/task/oracle/replay facts.
6. Create and populate the no-hindsight pending run-3 debug before any provider call, repeat the
   one-Lab gate, load credentials process-only, and use the unchanged default 26-call live command
   with only `--dry-run` removed.

A passing run 3 starts the consecutive-pass streak at one; a second independent pass is still
required.

## Scope

This task read t280/t289 and current blocker reports, inspected only current process/lock state and
exact tracked input/output timestamps, and wrote this report. It ran no test, check, build,
freshness-generating, dry-run, live, provider, browser, or Lab command and changed no source,
shared document, generated output, or run artifact.
