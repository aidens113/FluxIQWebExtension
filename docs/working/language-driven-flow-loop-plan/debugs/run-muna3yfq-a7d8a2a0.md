# Run debug: `run-muna3yfq-a7d8a2a0`

## Header

- Run id: `run-muna3yfq-a7d8a2a0` (t174 run 3)
- Scenario / variant / task: everything-store / none / `everything-store-kettle-to-cart`
- Build: Core `task/t174-live-lane` with Fix 1, t177 applied, and the progress trace enabled (`FLUXIQ_BUILD_PROGRESS_TRACE=1`). Instance: default. 2026-09-29, about 23:03 UTC.
- Provider calls, tokens, cost: 0 calls, cost 0.
- Verdict as reported: failed, category `unknown`, facility failure at `scenario.execute`. Duration 236,947 ms.
- **Stage reached:** none. This is a facility failure, not a product result.

## What happened

Event 1: `page.goto: Page crashed`, while navigating to `chrome-extension://.../sidepanel/index.html` and waiting for `load`. Chromium's renderer crashed while opening the extension side panel, before any build was dispatched. Core's log has only its startup lines; the scenario lab and Core both exited with code 1 when the run was torn down.

## Cause

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | Renderer crash under memory pressure (inferred). Measured about 25 minutes later, before run 4: 4.3 GB of RAM free of 12.2 GB, and 3.4 GB of commit free. The machine has a record of native crashes (lane summary round 1). | Facility (machine) | None in the product. The scenario was re-run as run 4. | - |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| Setup | Free RAM and commit at the moment of the crash | The Lab records no memory state on a browser crash. From now on, free RAM and commit are recorded before each run (supervisor rule). |
