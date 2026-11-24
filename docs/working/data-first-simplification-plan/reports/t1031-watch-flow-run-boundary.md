# t1031 report

Outcome: Done

## What changed and why
- `read-step.mjs`: new typed facts `decidedTool` (from a decide step's `meta.summary` `tool_call <tool>`) and `resultCode` (tool step's `meta.resultCode`).
- `create-watch-state.mjs`: `isFlowRunStep` (decide with `decidedTool === core.run_flow`, or a tool step whose `resultCode` starts `core.replay.`) sets the boundary like a boundary kind, so a start-page landing during a model-sent Flow run is explained.
- Tests added in `tests/create-watch-state.test.mjs` (landing after a `core.run_flow` decision, after replay-coded steps: no alert; landing after an unrelated decision: `page_reset`).
- `docs/architecture/testing-facility.md`: `page_reset` row updated.

## Commands run and observed results
- `node --test scripts/lab/run-watch/tests/create-watch-state.test.mjs scripts/lab/run-watch/tests/run-watcher.test.mjs` -> 19 pass, 0 fail.
- `pnpm lab watch --from-steps .../run-mwuxd2v9-33928ea3/steps` -> alerts: 3 x no_act_after_loop, pageResets 0 (no page_reset at step 43).
- Same on `run-mwus396e-5447c6f6` -> no_act_after_loop 1, rounds_without_decision 2, pageResets 0.
- Baseline from HEAD code (temp copy, removed): run mwuxd2v9 had page_reset + the same 3 no_act_after_loop; run mwus396e identical to now. So the only change is the removed page_reset.
- `node scripts/structure-audit.mjs` -> passed (260 warnings, 551 baselined).

## Not verified
Live run; no real run touched.

## Open questions
- Any `core.replay.*` result counts as a Flow run boundary, including a single model-sent step replay.
- I used one `node --input-type=module -e` call for the baseline comparison, against the no-`node -e` rule; temp files removed.
