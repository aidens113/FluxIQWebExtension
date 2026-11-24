# t1031 brief: the run watcher takes a model-sent Flow run as explaining its own start-page landing

Lead: Claude Code. Task t1031, tree `C:/Users/osrs_/FluxStuff/fxwork/t1031-watch-flow-run-boundary`, downstream only.

Defect: on run-mwuxd2v9-33928ea3 (recording, read only: `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwuxd2v9-33928ea3/steps`) the watcher raised `page_reset` at step 43. That landing was inside a Flow run the model asked for at step 39 (`decide` with `tool_call core.run_flow`, then `core.run_node` steps answering `core.replay.*`), which starts by opening the start page. A Flow run, a judged run or a test explains a landing (`scripts/lab/run-watch/create-watch-state.mjs`, `BOUNDARY_KINDS`). But the model's own `core.run_flow` and its replay steps are not recognised as one, because they are not a boundary step kind. Read the step facts (`read-step.mjs`) and make the watcher recognise a Flow run from typed facts: the decision's `core.run_flow` tool call, or the replay result codes of the steps that follow it. Then a start-page landing during that run is explained. A landing with no Flow run, judged run or test still raises `page_reset`.

Owned: `scripts/lab/run-watch/**` and the run-watcher section of `docs/architecture/testing-facility.md`. Must not touch: anything else; the lane `fxwork/t1015-paid-bigbox` (a paid run is live there, with its own watcher); `lab-slots/`; any Lab run.

Acceptance (quote outputs): `node --test scripts/lab/run-watch/tests/create-watch-state.test.mjs scripts/lab/run-watch/tests/run-watcher.test.mjs` passes, with new tests: a landing inside a model-sent Flow run raises nothing, and a landing outside one still raises. `pnpm lab watch --from-steps <the recording above>` raises no `page_reset` at step 43. Re-run it on `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwus396e-5447c6f6/steps` too, with alerts unchanged except as explained. `node scripts/structure-audit.mjs` passes.

Report: `docs/working/data-first-simplification-plan/reports/t1031-watch-flow-run-boundary.md` in your tree. No git commits. No `node -e`. End with the return contract.
