# Run debug — `run-munoaqcn-b90a601c`

t194 lane C, run 2. Same task and Stage 1 as `run-munnhi5q-4867dabe.md`.

## Header

- Scenario / task: `everything-store` / `everything-store-plus-earbuds-under-50`; `live-run-c.sh`, slot-3, `FLUXIQ_LAB_KEEP_RUN_STATE=1`.
- 2026-09-30 05:36:07 to 05:37:29 UTC, 82 s. Provider calls: 0.
- Verdict: `failed`, `unknown`; facility failure `finalized-bundle` / `scenario.execute` / `unclassified`.
- **Stage reached: none** (before the build).

## What happened

`events.ndjson` sequence 1, 05:37:18: `page.goto: Page crashed` navigating to `chrome-extension://.../sidepanel/index.html`. This is the extension-start crash of t174's runs 3 and 5: the Lab's network guard evaluated a canary `fetch()` into the extension service worker before its global scope existed (`packages/test-runner/src/network-guard.ts`), which killed the extension renderer.

## Causes

| # | Cause | File | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The network guard's canary ran before the worker's scope existed | downstream `packages/test-runner/src/network-guard.ts` (`proveWorker`) | t174 Fix 3, applied here as F0 | t174 |

Stages 1-6 and the UI review: not reached (no build, no Flow). Runs 3 and 4 started cleanly on F0.
