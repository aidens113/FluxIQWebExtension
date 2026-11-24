# t1019 report: run watcher reads real resets, catches rounds that never reach the model

## Outcome
Done.

## What changed and why
- `read-step.mjs`: `held` navigates no longer count as navigations (only name the start URL). A step's `location` now falls back to the URL in `page.txt` (`URL ~?q=..   (~ = base)` expanded) when `result.json` has none.
- `create-watch-state.mjs`: `page_reset` is read from where the page is after a tool step: landing on the start URL again after having left it, after the first landing, with no Flow/judge/test boundary. A boundary explains one landing. New pattern `rounds_without_decision`: `initial.*` opening calls with no `decide` between; alerts at the threshold and each multiple; a `decide` resets it.
- `config.mjs`: `roundsWithoutDecision: 2`.
- `tests/create-watch-state.test.mjs`: page_reset test rewritten to use real location; added held-navigate-page-elsewhere test (nothing), and the opening/opening, opening/decision/opening tests.
- `docs/architecture/testing-facility.md` ("The run watcher"): table rows and recorded-proof sentences updated.

## Commands run and observed results
- `node --test scripts/lab/run-watch/tests/create-watch-state.test.mjs scripts/lab/run-watch/tests/run-watcher.test.mjs` -> tests 18, pass 18, fail 0.
- `pnpm lab watch --from-steps .../run-mwus396e-5447c6f6/steps` -> alerts 3: `no_act_after_loop` (steps 68-83), `rounds_without_decision` (steps 91 and 93, 2 then 4 openings); `pageResets: 0`.
- `pnpm lab watch --from-steps .../run-mwufisf0-5535f5f5/steps` -> alerts 9 (no_act_after_loop 3, repeated_call 5, no_act 1); `pageResets: 0`. Every `result.json` location in that run is the start page (`.../bigbox-retail/`, 80 of 80), so the six earlier resets were navigations to the start URL while the page never left; none is a real reset (agrees with t1008).
- `node scripts/structure-audit.mjs` -> `passed (259 warning(s), 551 baselined)` (after splitting one packed line it flagged).

## Not verified
- A live run; only the two recordings and synthetic events.
- Files were rewritten through Python on Windows, so line endings in the four edited scripts are CRLF (git warns it will normalise to LF); check `git diff` is not noisy.

## Open questions or contradictions found
- A boundary is cleared only by the next landing on the start URL, so an unexplained reset long after a judged run that never returned to the start page is read as explained once.
