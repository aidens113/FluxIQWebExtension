# Brief t1050: the two deadline tests run on a fake clock

**Goal.** Two Core tests measure a deadline against the wall clock, so they fail when the machine is loaded:
- `framework/automation-service/service/answer-first/tests/second-attempt-proof.test.ts` (t1032's deadline test);
- `answer-first/tests/later-attempt.test.ts`, "a run's own deadline" (400 ms), which failed once in a sweep.

Make each test drive time itself, so it passes or fails on behaviour, never on scheduling. Use a fake clock:
Vitest's fake timers, or the clock seam the attempt code already takes.

**Rules.**
- Never fix this by raising a deadline or a timeout (user rule: never cap the symptom).
- Keep each test's assertion of what happens when the deadline passes, and of what happens before it.
- If the production code reads the wall clock directly with no seam, add a clock parameter to that one module. The
  default is the real clock, there is no behaviour change, and a test goes beside the module.
- `answer-first/tests/later-attempts.ts` is the shared helper; change it only as far as the clock needs.

**Proof.**
- Each test passes 20 times in a row under `--repeat` or a loop, with another heavy test run going at the same time
  if one is running.
- Each still fails if the deadline handling is removed: show it by a temporary local edit you revert, and say so.

**Owned paths (Core, `--core` task).** The two tests, `answer-first/tests/later-attempts.ts`, and the one attempt
module that reads the clock, if a seam is needed.
**Must not touch.** Every other file, especially `answer-first/result-feed/**`, `runtime/llm/**`,
`flow-authoring/**` and `result-verification/**` (other tasks). No git, no paid or Lab runs, no `node -e`.

**Checks.**
- `pnpm --filter fluxiq check`.
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first`.
- Core audit.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1050.md`, ending with the return contract.
