# Paid round 2026-11-24 (P7): running log

Supervisor: paid-round sub-supervisor. Every run: `FLUXIQ_LLM_RUN_COST_CEILING_USD=5 pnpm lab attempt <scenario> --task <id> --authoring-mode answer-first --live-llm --llm-model claude-haiku-5-5 --llm-max-cost-usd 5` (four attempts), lanes paid-a..d, slots 1-4.

Why `--llm-model claude-haiku-5-5` is passed: the Lab's own live default is still `claude-sonnet-5-5` (`scripts/lab/provider/defaults.mjs`, test-contracts `DEFAULT_LLM_MODEL`); a dry run without it reported Sonnet as Core's default model. Naming Haiku keeps U1 and the brief.

Pre-launch: guards (`admitLiveRun`) admitted all four lanes with no refusals; dry run on paid-a with Haiku: `status: ready`, `coreDefaultModel: claude-haiku-5-5`, purse $5 accepted, 0 provider calls.

## Runs (task, verdict, calls per attempt, dollars, running total)

- 08:36 bigbox-retail-new-store-cheapest-towels (paid-d, run-mwufisf0-5535f5f5): STOPPED on the lead's order in attempt 1, not judged; looks only after ~step 20, loop detection x3, change_approach x2 with no act. Calls: attempt 1 = 83 (1 interp, 82 decisions), attempts 2-4 not run. $0.1196 settled, booked $0.13 (one in-flight decision at its own request maximum, under $0.01). Running total $0.13. Not relaunched (lead diagnosing offline).
- 08:36 lanes a, b, c: queued runs stopped before their ledger start (waiting on the exclusive Core build lease); $0. To relaunch on own-Core trees.
- 08:39-08:47 relaunches: paid-a, paid-b, paid-c on own-Core trees (t1006, t1007, t1009, downstream 48a277eec / Core 5dfde039c); paid-d took task 5 on the shared Core.
- 08:48 ROUND HALTED by the lead (user: every run doing the same look loop; fix before more spend). The lead killed all four process trees.
  - local-classifieds-bikes-within-alex-price (paid-d, run-mwug2xjw-41f62603): killed in attempt 1, 71 calls (1 interp, 3 judge, 67 decisions, one in flight); 41 looks vs 8 landed acts (7 navigate, 1 click) and 4 rejected acts; loop steering x11, including a finish_with_best that did not end the build. $0.6309 settled, booked $0.64. Running total $0.77.
  - auction-marketplace-lens-hood-seller-shop (paid-a, run-mwug3pjo-64d4d0e2): killed ~5 min into attempt 1, 23 calls (1 interp, 22 decisions, one in flight); 12 looks vs 3 acts; one change_approach. $0.0243 settled, booked $0.03. Running total $0.80.
  - company-website-apprentices (paid-b, run-mwug6pz3-064c0b18) and job-board-halvard-careers-roles (paid-c, run-mwugbs39-fb761372): killed while their Core started, before typing; 0 calls, $0.
- Round total: $0.7748 settled (step logs), **$0.80 booked** with the three in-flight decisions at their own request maximum. No balance error, no STOP-balance, no spend anomaly (no run above $3; no attempt 2-4 ran). Tasks 6-10 were never launched.
