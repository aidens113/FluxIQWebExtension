# t1010 report: Lab run watcher and Haiku default

## Outcome
Partial. The watcher, wiring, tests, docs and the Haiku default are done and their checks pass. Two edited test-runner tests (`live-llm-plan.test.ts`, `live-llm-run.test.ts`) could not be run, because `pnpm --filter @fluxiq-web-extension/test-runner build` fails in this worktree on missing `@fluxiq-web-extension/browser-host` modules in files I did not touch.

## What changed and why
- New `scripts/lab/run-watch/` (barrel `index.mjs`, one export per file): `config.mjs` (all thresholds, documented, alert-only), `read-step.mjs` (reads `meta.json`, and `call.json`/`result.json`/`page.txt` for tool steps; page text is hashed, never kept), `is-act-node.mjs`, `create-watch-state.mjs` (rolling counts and the patterns), `create-run-watcher.mjs` (polls one `steps/`, appends `watch-alerts.ndjson`, mirrors alerts, prints one `[watch]` line, writes `watch-status.json` at most every 30 s), `find-new-runs.mjs` (finds the launch's run folder in `lab-runs/` by pid, or instance), `start-lab-watcher.mjs`, `replay-steps.mjs`, `parse-watch-arguments.mjs`, `run-watch-command.mjs`, `lab-runs-root.mjs`.
- Patterns: `no_act_after_loop`, `no_act`, `repeated_call`, `finish_not_ending`, `approach_unchanged`, `page_reset`, `no_new_evidence`. Each alert carries pattern, step range, counts, billed spend so far (sum of `costUsd`) and a sentence. Nothing stops or resets a run.
- Design decisions found by replaying real runs: a start-URL navigation that follows a Flow run, judge, test, escalate or repair step is expected and is not a `page_reset`; an applied `amend_draft`, a Flow run, a judged run and an act count as progress for `no_new_evidence`; Core's opening call holds its navigation inside `input.held`, so the start URL is read from there.
- `scripts/lab/run-lab.mjs`: `watch` subcommand (replay `--from-steps`, follow `--steps`); `attempt` and `run` start the watcher beside the runner (live or provider-free), print the per-launch alert file up front (`test-runs/lab-watch/<instance>-<pid>/watch-alerts.ndjson`), and read what is left when the run ends. `run()` gained an `onSpawn` hook to pass the child's pid.
- `docs/architecture/testing-facility.md`: new "The run watcher" section (patterns, files, Monitor-with-until-condition use, replay) before "Stopping one Lab run"; default model text now Haiku.
- Haiku default: `scripts/lab/provider/defaults.mjs`, test-contracts `llm-models/registry.ts` (`DEFAULT_LLM_MODEL`, and Haiku first in the Anthropic list, which `defaultLlmModelForProvider` reads). Tests updated: test-contracts `llm-provider-defaults.test.mjs`, lab `arguments`, `command-line`, `lab-run-command`, `admit-live-run`, `live-launch` tests, test-runner `live-llm-plan` and `live-llm-run` tests. An explicit Sonnet selection is still tested in `live-launch.test.mjs`.

## Commands run and observed results
- `node --test scripts/lab/run-watch/tests/*.test.mjs` -> 16 pass, 0 fail (synthetic detection for each pattern, quiet on progress, folders on disk, heartbeat interval, launch discovery, CLI parsing).
- `heavy-slot run ... node --test "scripts/lab/**/tests/*.test.mjs"` -> 260 tests, 259 pass, 0 fail, 1 skipped. (First run had 3 failures in refusal-screening tests from a stale `packages/test-contracts/dist`; after `pnpm --filter @fluxiq-web-extension/test-contracts test` rebuilt it they pass.)
- `heavy-slot run ... pnpm --filter @fluxiq-web-extension/test-contracts test` -> 184 tests, 184 pass.
- `node scripts/structure-audit.mjs` -> `passed (259 warning(s), 551 baselined)` (after fixing failure-as-empty and statement-packing findings in my files).
- Replay `lab watch --from-steps` on `lab-runs/2026-11-24/run-mwufisf0-5535f5f5/steps` (178 steps, stuck): 15 alerts: page_reset 6 (steps 24, 45, 62, 84, 118, 168), no_act_after_loop 3 (first at step 31, 8 decisions after the loop at step 15), repeated_call 5 (`web.describe_element`, `web.find_on_page`), no_act 1 (step 87). It alerts on both patterns the brief named.
- Replay on `lab-runs/2026-11-20/run-mwowwwd0-ea0caab9/steps` (verdict passed, 393 steps, 84 Core calls): 2 alerts: one `no_act_after_loop` (8 decisions after the loop at step 94, spend $0.06) and one `page_reset` at step 336 (the model's own navigate to the start URL after a judge). Nearly quiet, not silent. Before I added the judge/flow/escalate boundary and progress rules the same run raised 16 alerts.

## Not verified
- test-runner: `pnpm --filter @fluxiq-web-extension/test-runner build` fails with TS2307 on `@fluxiq-web-extension/browser-host(/reaper)` (`fluxnode-host-proof/*`, `run-scenario/window-capture/find-browser-process.ts`), so `live-llm-plan.test.ts` and `live-llm-run.test.ts` edits (one-line default-model literals) were not executed. The workspace package likely needs building (`--skip-workspace-build` worktree).
- The live wiring in `run-lab.mjs` (watcher started beside a real `attempt`/`run`, pid or instance matching `entry.json`) is covered by unit tests on synthetic folders only; no live or provider-free run was launched, as briefed. `entry.pid` being the spawned runner's pid is assumed from `entry.json` of a recorded run.
- No Monitor use was exercised.
- Thresholds are first guesses tuned on two recorded runs.

## Open questions or contradictions found
- `entry.json` of a still-running run shows `"verdict": "running"` for several 2026-11-20 runs; I chose `run-mwowwwd0` (verdict passed) as the progressed run.
- Old runs contain `escalate` steps (the removed model ladder); the watcher treats them as a boundary only.
- Other docs and tests still name `claude-sonnet-5-5` as an explicit model (campaign docs elsewhere, scripted-model tests); I left those where they are explicit selections.
