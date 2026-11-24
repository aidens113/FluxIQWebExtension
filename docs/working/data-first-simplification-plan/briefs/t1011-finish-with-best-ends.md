# A `finish_with_best` decision did not end the build (t1011)

Lead: Claude Code session, 2026-11-24. Tier: worker-heavy.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t1011/!FluxIQ` (Core task branch) and `t1011/!FluxIQWebExtension`.
Read: this brief; Core `docs/architecture/automation-studio/failure-control.md` (loop decisions, t1000); `packages/fluxiq/src/runtime/llm/decision-handlers/model-decision.ts` and `loop-decision/**`; `answer-first/attempt/rounds.ts` and `round.ts`; and the run below.

Evidence: run-mwug2xjw-41f62603 (`local-classifieds-bikes-within-alex-price`, attempt 1, Haiku), steps at `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-24/run-mwug2xjw-41f62603/steps/` (read-only; copy to ignored `test-runs/t1011-evidence/` first; never print page data). At step 0116 the model chose `finish_with_best`. The build did not end: the judge ran three times, then the model went back to checking for a next page it had already seen did not exist. Loop steering fired 11 times in the run.

Rules:
- Failure-control: `finish_with_best` (with `result`) goes to the completion check as any completion does.
- AGENTS.md: a task ends only with its result or its purse; a judged no must lead somewhere new, never back into the same repeat.

Goal: explain exactly what happened after 0116, from the steps, and fix the cause.
1. Did the completion check run on the finished result, and what did it say three times? If it refused, what were the model then told, and why did that send it back to the old paging check rather than to new evidence? If `finish_with_best` was never carried out as a completion, why not?
2. Fix it at the cause, in the owning module. Never a count or cap: no limit on judge calls and no round ending. A judged no on a best result must produce a next step that differs (t1000's steering), and a judged yes ends the task with that result.
3. Tests for the path found, plus the prompt pins if model-facing text changes.

Lane t1008 is fixing round resets and count-based round endings in `answer-first/attempt/{round,rounds,run-attempt}.ts` and the evidence-loop limits. Do not edit those files. If your fix needs them, write the exact change in your report.
Owned: Core `runtime/llm/decision-handlers/**`, `runtime/llm/loop-decision/**`, `answer-first/completion/**`, `runtime/result-verification/**`, their tests, `packages/fluxiq/package.json`, and your brief and report.
Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time: named vitest files through `scripts/vitest-groups.mjs` with their group, `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`; `pnpm --filter fluxiq check`; the structure audit. No provider or paid calls, no git mutations, no `node -e`, no browsers.
Report: `reports/t1011-finish-with-best-ends.md`, leading with the plain-words cause. End with the return contract.
