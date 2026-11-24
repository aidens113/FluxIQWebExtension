# Every Lab run runs with a cheap watcher that alerts on repeating or no progress (t1010)

Lead: Claude Code session, 2026-11-24. Tier: worker.
Workspace: `C:/Users/osrs_/FluxStuff/fxwork/t1010-lab-run-watcher` (downstream; the shared Core is read-only).
Read: this brief; AGENTS.md "Every ongoing live run is overseen, and stopped early only when really needed" (just added); `docs/architecture/testing-facility.md` on `lab attempt` (~line 2150) and on step logs ("every run step logged as files"); `scripts/lab/run-lab.mjs`; and one real run's step folders, `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-24/run-mwufisf0-5535f5f5/steps/` (read-only, never print page data).

The user, 2026-11-24: "FROM NOW ON EVERY LAB RUN IS MONITORED IN THAT WAY. NOT SO INTENSELY THAT IT WASTES CLAUDE TOKENS BUT JUST ENOUGH TO CATCH REPEATING/NO PROGRESS". Agents must not poll logs. A cheap mechanical watcher does the watching, and the agent waits on its alert.

Build:
1. A run watcher, a Node module plus CLI in its owning place under `scripts/lab/`. Given a run's `steps/` folder, it reads each new step's `meta.json` (and, for a tool step, `call.json`) as it appears, by fs watch or a slow interval, using no model. It keeps rolling counts per attempt:
   - consecutive decisions with no act. An act is any `core.run_node`/`core.run_flow` the model sent that ran a press, type, select, navigate, scroll, keypress, upload or other changing node; Core's own `initial.*` calls and inspect/read results do not count;
   - repeated identical calls (same tool and input);
   - `loop` and `loop_decision` steps, and whether the calls after a `change_approach` or `finish_with_best` changed in kind or ended the build;
   - steps since the last new evidence (a new page location, new rows, a changed page fingerprint where the step records one).
2. Alerts: append one JSON line to `<run evidence>/watch-alerts.ndjson` (and print one short line) only when a pattern holds, for example: no act for N decisions after a loop decision fired; the same call repeated K times; a finish decision not ending the build; the page sent back to the start mid-attempt (a navigate to the start URL after the first). Put the thresholds in one documented config. They are detection thresholds that only alert and never stop anything. Each alert says the pattern, the step range, counts and spend so far (from `meta.json` costUsd). Write a `watch-status.json` heartbeat no more often than every 30 s.
3. Wiring: `lab attempt` and `lab run` start the watcher beside every run, live or provider-free, and print where the alert file is, so the launching agent can wait on it with Claude Code's Monitor tool and an until-condition (for example `until grep -q . watch-alerts.ndjson`). Document that use in `testing-facility.md`, beside the oversight rule.
4. Prove it on the recorded run: a replay mode (`--from-steps <dir>`) runs over finished step folders. On run-mwufisf0 it must alert on no act after loop decisions and on the page reset to start. On a recorded run that progressed, look in `lab-runs/2026-11-20/` and pick one with SUCCESS or PARTIAL and many acts; it must stay quiet or nearly so. Report both.
5. Also fix the Lab's default live model: `scripts/lab/provider/defaults.mjs` and test-contracts `llm-models/registry.ts` `DEFAULT_LLM_MODEL` still say `claude-sonnet-5-5`. The user's rule is Haiku for build and judge (AGENTS.md "No model ladder"). Make Haiku the default and update their tests.

Tests in the owners' `tests/` folders: detection on synthetic step folders for each pattern, quiet on progress, and the CLI parsing. Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`: the touched packages' tests and checks, and `node scripts/structure-audit.mjs`.

Rules: no provider or paid calls, no browsers, no git mutations, no `node -e`. Never launch a live run. Never print recorded page data, only counts, codes, tool ids and step numbers.
Owned: `scripts/lab/**` (the watcher and the provider defaults), `packages/test-contracts/src/llm-models/**`, `packages/test-runner/src/attempt-lane/live/**` if `lab attempt` wiring lives there, their tests, `docs/architecture/testing-facility.md`, and your brief and report.
Must not touch: Core, `domain/**`, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.
Report: `docs/working/data-first-simplification-plan/reports/t1010-lab-run-watcher.md`. End with the return contract.
