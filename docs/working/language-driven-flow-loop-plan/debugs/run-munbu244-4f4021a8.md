# Run debug: `run-munbu244-4f4021a8`

## Header

- Run id: `run-munbu244-4f4021a8` (t174 run 5)
- Scenario / task: bigbox-retail / `bigbox-retail-pickup-cart`
- Instance `t174-slot-1`. Started 2026-09-29 23:44:39 UTC; failed 23:53:58.
- Memory at launch: 3,543 MB of RAM free, 2,794 MB of commit free. Another lane held slot-2.
- Provider calls: 0.
- Verdict: failed, category `unknown`, facility failure.
- **Stage reached:** none. This is a facility failure, not a product result.

## What happened

Event 1: `page.goto: Page crashed` on `chrome-extension://.../sidepanel/index.html`, the same failure as run 3 (`run-muna3yfq-a7d8a2a0`). Core's log has only its startup lines. No build was dispatched.

## Cause

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | The Chromium renderer crashed on its first load of the extension control page, with commit memory low and other lanes' browsers running (18 Chrome processes seen at 23:55). Run 4 loaded the same page cleanly in between. | Facility | The Lab opens the control page again in a fresh tab, once, after a renderer crash: `packages/test-runner/src/run-scenario/extension-control-page.ts`, called from `run-scenario.ts` `extensionControlPage`. Tests: `run-scenario/tests/extension-control-page.test.ts`, 3/3 (a crash then a load, a double crash, a non-crash error). The supervisor has since stopped the other lanes' Lab runs. | t174 |
