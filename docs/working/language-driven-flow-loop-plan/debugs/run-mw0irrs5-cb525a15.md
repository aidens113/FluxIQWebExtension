# Debug: run-mw0irrs5-cb525a15

## Result

A rerun of `run-mw0hzrhs-344f6976` on a persistent workspace, to keep the saved Flow. The build passed again and the Flow's own run failed the same way, which made the cause readable.

## Evidence

- Scenario and task: `everything-store`, `everything-store-kettle-to-cart`, Claude Sonnet 5.5
- Cost: $1.0767, 19 provider calls
- The failed attempt's record in the project database: message "The host state capture could not be read.", node `web.output.browser-navigate`, attempt 1, 0 ms.
- The screenshot at the failure: the active tab is `about:blank`.
- Zero-call replay of the same saved Flow, `replay-mw0ixy4s-03ed6875`: passed. The dataset was exact and the Flow and graph hashes were unchanged. Replay opens the site before running, so its first capture has a page to read.

## Cause

The run starts from a blank tab, where no content script can run, so the capture before the first step fails. `fd9386baf` (t842, already on `dev`) made a failed capture fatal, through `engine/automation/host-state/capture.ts`. Before it, Core caught every capture error, including the host's way of declining a node. Failing closed is right for a step that acts on a page, but a navigation does not read the page it leaves.

So this is a `dev` defect from t842, not from t845's moves. Any Flow started from a new tab fails on its first step. The last Claude run that got past this point predates t842.

## Fix

`domain/src/runtime/host-runtime.ts`: before a navigation, a capture that fails is declined with the new reason `page_left_by_navigation`, added to Core's `AutomationStudioHostStateCapture`. A capture after the navigation, and captures around every other step, still fault.

`domain/src/runtime/tests/host-runtime.test.ts` covers both sides: 57 tests passed.

## Next action

Rerun live on the fix.
