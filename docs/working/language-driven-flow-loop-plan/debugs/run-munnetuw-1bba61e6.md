# Run debug — `run-munnetuw-1bba61e6` (lane D run 1)

Lane t195 (live lane D), slot-4, instance `t195-slot-4`. Read from the bundle at
`test-runs/instances/t195-slot-4/run-munnetuw-1bba61e6` and the launcher's full log
(`t195-lab-social-network-feed-confirm-requests-051055.log`, scratchpad, not tracked).

## Header

- Run id: `run-munnetuw-1bba61e6`
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests`
- Command: `live-run-d.sh social-network-feed social-network-feed-confirm-requests` = `node scripts/lab/run-lab.mjs run social-network-feed --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-confirm-requests --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 48 --llm-max-cost-usd 0.25`, headed, `FLUXIQ_LAB_INSTANCE=t195-slot-4`
- Trees: downstream `defcbe2d` (clean), Core `f0dbbd6` (clean) -- current dev, before t174's fixes were applied
- Date, provider, model: 2026-09-30 05:12:05Z to 05:15:28Z; DeepSeek `deepseek-flash`, profile `production`
- Provider calls, tokens, cost: 0 (`evaluation.json` `llm.calls: 0`)
- Verdict as reported: failed, `failureCategory: unknown`, `facilityFailure {stage: scenario.execute, reason: unclassified}`
- **Stage reached: none.** The Lab failed before the build: `page.goto: Page crashed` opening `chrome-extension://…/sidepanel/index.html` (`events.ndjson` seq 1, 05:15:27.075Z).

## Stage 1 — the instruction and the expected chain

Written before reading the run (scratchpad `t195-stage1-confirm-requests.md`), carried into the run-2 debug.

## Stages 2 to 6

Not reached: no build, no Flow, no replay, no answer, no judgement. 0 provider calls.

UI review: NO EVIDENCE -- `screenshotCount: 0`, `screenshotSuppressed: capture-unavailable`. The page crashed before any UI existed.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The Lab's network guard `evaluate`s a canary `fetch()` into the extension's service worker before its global scope exists, which crashes the extension renderer; the side panel then loads into the dead process: `Page crashed`. Same signature as t174 runs 3 and 5. | downstream `packages/test-runner/src/network-guard.ts` `proveWorker` (line 123 on dev) | t174 Fix 3, commit `5903a1e7` on `task/t174-live-lane`, **not on dev**. Applied to this tree as a working-tree patch (`git diff dev...task/t174-live-lane`, code paths only), with t174's Core commits (`befca2f`, `50eb684`) likewise | **owned by t174** |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| header | The Lab command line | `run.json` (known, t174) |
| UI | No screenshot of a pre-build failure | the Lab's capture is `capture-unavailable` without t174-w9's UI review capture (uncommitted in t174) |
