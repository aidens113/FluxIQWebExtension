# Supervised paid round on the ten scoreboard tasks (P7, 2026-11-24)

Lead: Claude Code session. Role: sub-supervisor (Opus), watching every paid run live. This is paid work: the user approved this round with a $50 absolute ceiling (U8).
Read:
- this brief;
- the Current State of `docs/working/data-first-simplification-plan.md` (U1-U8, and the "Paid round plan" bullet);
- AGENTS.md downstream, "Automated Testing Facility Boundary" (Claude only, the $5 purse, ten scenarios, four attempts, the continuation proof, no PIN, one judged run);
- `docs/architecture/testing-facility.md`, "A real attempt from the chat: `lab attempt`" (~line 2150) and "Live-run waste guards" (~line 4043).

Tasks (`packages/test-runner/src/attempt-lane/scoreboard/fixed-tasks.ts`), in this order, easiest first:
auction-marketplace-lens-hood-seller-shop, company-website-apprentices, job-board-halvard-careers-roles, bigbox-retail-new-store-cheapest-towels, local-classifieds-bikes-within-alex-price, everything-store-plus-earbuds-under-50, crossborder-marketplace-free-hubs-under-ten, professional-network-netherlands-data-engineers, photo-social-august-over-1300, social-network-feed-delete-stranger-requests.

Lanes: four lane trees `C:/Users/osrs_/FluxStuff/fxwork/t1001-paid-lane-a`, `t1002-paid-lane-b`, `t1003-paid-lane-c` and `t1004-paid-lane-d` (lane labels `paid-a` to `paid-d`, lab slots 1-4; they share the Core `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`, which is read-only to you), all at downstream dev af360c487 / Core 5dfde039c. One lane runs one task at a time, with `FLUXIQ_LAB_INSTANCE=<lane label>`, and owns lab slot N for its whole round. The shared Core is synced and built; never rebuild it from a lane. The Lab rebuilds each instance's extension into `.lab-instances/` before every run.

Each run, from the lane's downstream tree:
`FLUXIQ_LLM_RUN_COST_CEILING_USD=5 pnpm lab attempt <scenario> --task <id> --authoring-mode answer-first --live-llm --llm-max-cost-usd 5`
- The default is `--attempts 4`. Haiku is the default model for build and judge; do not pass another.
- Run it in the background and watch it: the step logs, the chat, the spend ledger `C:/Users/osrs_/FluxStuff/lab-slots/spend-ledger.jsonl`.

Money rules (hard):
- Before each launch, add the billed dollars of every finished run this round, plus $5 for each run in flight, plus $5 for the new one. Launch only if that is at most $50.
- Count a call reported `reported=false` (no usage) at its request's maximum possible cost, not $0.
- At the first balance error (`STOP-balance` or a provider balance refusal), stop launching, let in-flight runs end, and report.
- Never create or edit `lab-slots/OVERRIDE-*`, never run another model, and never raise a purse.

After every run:
- write its debug at `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` in that lane's tree (the Lab's `debug` guard requires it). Record per attempt: verdict, path, Flow, model calls, cost, time, and the continuation proof for attempts 2-4;
- review the chat UI: every step posted, with its reasoning.

A failure is a product defect, never the machine. Trace it to the failing step and its cause, and say so in the debug; do not fix code in this round. Never rerun a failed task on unchanged source.

Report as you go:
- after each run, append a short line to ``C:/Users/osrs_/FluxStuff/fxwork/t1001-paid-lane-a/docs/working/data-first-simplification-plan/reports/paid-round-1124.md``: task, verdict, calls per attempt, dollars, running total;
- message the lead after every finished task and at once on any balance error or a spend anomaly (a run's spend above $3, or calls on attempts 2-4).

No git mutations; the lead commits the debugs and the report. No `node -e`. Low free memory is not a reason to wait.
End with the return contract: per task, its verdict, the calls per attempt, the dollars and the cause of any failure; the round total; what was not run and why.
