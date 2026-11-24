# t1019 brief: the run watcher reads real resets and catches rounds that never reach the model

Lead: Claude Code. Task t1019, tree `C:/Users/osrs_/FluxStuff/fxwork/t1019-watch-round-restarts` (branch `task/t1019-watch-round-restarts`). Downstream only.

Goal: two defects in the Lab run watcher (`scripts/lab/run-watch/`, t1010), found on the paid bigbox run run-mwus396e-5447c6f6 (2026-11-24):
1. **False `page_reset`.** `read-step.mjs` (~line 62) takes a step's start-URL navigation from Core's opening call's `held` list. `held` is the draft's acts given as context: they do not run. On the recording, steps 90-94 raised five `page_reset` alerts while every page stayed at `.../bigbox-retail/search?q=paper%20towels&page=3`. A reset must be read from where the page actually is after the step (the step's `result.json` `location`, else the URL in `page.txt`): the page landing on the start URL again, after the first time, with no Flow run, judged run or test to explain it. A navigate inside `held` is never a navigation.
2. **No alert for rounds that never reach the model.** In the same run every new round's first decision was refused inside Core before sending (`decide throw ... flow_bootstrap.request_refused_evidence_denied_key` in Core's log), so steps 90-94 were only Core opening calls (`callId` `initial.*`) with no `decide` step between them, at zero cost, forever. Add a pattern (name it `rounds_without_decision`): Core opening calls (`initial.*`) starting again with no model decision since the previous opening, at a threshold in `config.mjs` (2 openings in a row; again at each multiple). Its sentence says no model decision ran since the last round opened.

Owned paths: `scripts/lab/run-watch/**`, `docs/architecture/testing-facility.md` (only the "The run watcher" section, ~line 4144: table row and the recorded-proof sentences).
Must not touch: anything else; `lab-slots/`; any Lab run; the evidence folders below (read only).

Read: `scripts/lab/run-watch/read-step.mjs`, `create-watch-state.mjs`, `config.mjs`, their tests; the testing-facility section above.

Recordings (read only):
- `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwus396e-5447c6f6/steps`
- `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-24/run-mwufisf0-5535f5f5/steps` (t1010 reported six resets on it; t1008 found its page was never navigated, so check each against the real location and say what you find).

Acceptance (run each, quote the output in your report):
- `node --test scripts/lab/run-watch/tests/create-watch-state.test.mjs scripts/lab/run-watch/tests/run-watcher.test.mjs` passes, with new tests: an opening call whose `held` has a navigate to the start URL while the page stays elsewhere raises nothing; a page really landing on the start URL again raises `page_reset`; two openings with no decision between raise `rounds_without_decision`; an opening, a decision, an opening raises nothing.
- `pnpm lab watch --from-steps <each recording>`: on run-mwus396e no `page_reset`, and `rounds_without_decision` from step 91; on run-mwufisf0 the alerts with the resets accounted for.
- `node scripts/structure-audit.mjs` passes.

Report: `docs/working/data-first-simplification-plan/reports/t1019-watch-round-restarts.md` in your tree. No git. No `node -e`. End with the return contract.
