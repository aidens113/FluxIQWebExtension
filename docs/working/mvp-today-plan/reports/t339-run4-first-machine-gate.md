# t339 — Run-4 first one-Lab machine gate

Status: **GO as a point-in-time read-only machine snapshot**

Snapshot window: `2026-09-27T05:34:35.3676104Z` through `2026-09-27T05:34:49.1268844Z`.

## Decision

- Matching Lab, test-runner, Scenario-Lab, or browser-campaign processes: **0**.
- Concurrent live campaign detected: **no**.
- `F:\!FluxIQWebExtension\.lab-locks\build.lock`: **absent**.
- Required output markers: **11/11 present**, **0 missing**.

Result: the first immediate run-4 one-Lab predicate is **GO at this timestamp**. This is a snapshot, not a process reservation or authorization to launch. Repeat the gate if material time passes or any Lab/build/live action occurs before the supervisor starts the authorized invocation.

## Sanitized process and lock check

The process scan matched internally against these categories without printing command lines:

- repository Lab launcher;
- built test-runner CLI;
- `fluxiq-lab`;
- built Scenario Lab server;
- Chromium/Chrome/Edge/Firefox campaign processes whose internal command metadata identifies FluxIQ, Scenario Lab, Playwright, a run root, or the E2E extension.

After excluding the PowerShell process performing the check, no matching process remained. Therefore no concurrent live campaign was visible. No command line, environment value, credential, profile path, or secret was recorded.

The repository build lock was absent.

## Required output presence

The same 11 markers defined by the prior immediate gate were checked for file presence only. No generated-output content was opened.

| Output marker | Present |
| --- | --- |
| Core contracts `packages/contracts/dist/index.js` | yes |
| Core FluxIQ `packages/fluxiq/dist/index.js` | yes |
| Core gateway `packages/client-gateway-websocket/dist/index.js` | yes |
| Core web `apps/web/.next/BUILD_ID` | yes |
| Test contracts `packages/test-contracts/dist/index.js` | yes |
| Test evidence `packages/test-evidence/dist/index.js` | yes |
| Domain `domain/dist/index.js` | yes |
| Extension bundle `apps/extension/dist/e2e-chromium/content/index.js` | yes |
| Extension manifest `apps/extension/dist/e2e-chromium/manifest.json` | yes |
| Scenario Lab `apps/scenario-lab/dist/server.js` | yes |
| Test runner `packages/test-runner/dist/cli.js` | yes |

An independent presence-only check reproduced **11/11 present** at `2026-09-27T05:34:35.3676104Z`.

## Boundary confirmation

No process was started, stopped, signaled, or modified. No dry-run, live, browser, provider, Lab, build, test, or check command was run. No shared document, source, generated output, lock, run artifact, staging area, commit, or push state was changed. This report is t339's only write.
