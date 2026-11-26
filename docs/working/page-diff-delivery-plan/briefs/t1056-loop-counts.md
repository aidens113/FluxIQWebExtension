# Brief t1056: no count ends an evidence loop; the deprecated step-count chain goes

**Goal.** Finish what t1049 started (report: `docs/working/page-diff-delivery-plan/reports/t1049.md`, "Decisions for
you" 1 and 2).
- The user's rule (AGENTS.md, "No arbitrary limit ends or resets a run"): no count of calls, steps, iterations or
  steps without progress ends a round. A repeat is handled by loop detection and the model's own loop decision.
  Only the result, the purse (the dollar budget) or a person's Stop ends a task.
- t1049 removed `maxStepsWithoutProgress`. These counts still end evidence loops that run without `loopSignal`
  (recovery, candidate and subflow builds, the project supervisor):
  - looks in a row (`MAX_LOOKS_IN_A_ROW` 8, `runtime/llm/decision-handlers/searching.ts`);
  - refused repeats in a row (`MAX_REFUSED_REPEATS_IN_A_ROW` 3);
  - refusals of one kind in a row (`refusal-run.ts`);
  - unusable decisions in a row (`maxInARow`, default 12);
  - unreadable replies in a row;
  - `maxIterations` and `maxToolCalls`;
  - the build purse's call allowance `maxCallsPerRun` (it ended t1049's `service-bootstrap/tests/unfinished-build.test.ts` with "stopped at its limit of 12 model calls"). A purse is dollars, never a count of calls.
- t1049 also left inert, `@deprecated` and read by nothing: `unusableDecisions.maxConsecutive`,
  `maxConsecutiveUnusableDecisions` (`loop-limits/flow-bootstrap-evidence-loop.ts`, `round.ts`,
  `unusable-decisions.ts`, `candidate-generation.ts`, `run.ts`, `brief-ports.ts`, `service.ts`) and
  `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS`.

**Do.**
- Remove every one of those endings, and delete the deprecated chain outright, with its config fields, defaults
  and tests' references (about 85 files, many under `flow-authoring/bootstrap/**`). Never raise a number or
  replace one with another.
- Where a run of looks, refusals or unusable replies now goes on, keep and sharpen the steering instead:
  - the model is told plainly what it keeps doing and why it is not working;
  - the existing loop decision follows (continue, change, ask, finish).
- Unreadable or unusable replies are asked again on the same model with the note, and each costs from the purse.
  A loop that cannot get a usable reply ends when the purse does.
- Tests whose providers cost nothing must give each call a cost, so the purse ends them. Never add a count to
  stop a test.
- Keep result codes truthful, and delete codes nothing produces any more.
- Model-facing words stay generic (never teach to the test).

**Proof.**
- Provider-free tests that fail before the change:
  - a loop that looks, is refused or gets unusable replies far past each old bound runs on, steered, until the
    result or the purse ends it;
  - the same through the real harness, ending `exhaustion.bound: "budget"`.
- Update every test that pinned an old ending, and list them.

**Owned paths (Core).** `packages/fluxiq/src/runtime/llm/**` (not `decision-context/**`), `runtime/loop-limits/**`,
`runtime/flow-authoring/**`, `runtime/project-agents/**`, `framework/**` tests that pin these counts, Core
`docs/architecture/` lines on them.
**Must not touch.** `runtime/adaptation/recovery/**` (the recovery brief runs beside this one), `result-verification/**`,
`answer-first/result-feed/**`. No git, no paid runs, no `node -e`.

**Checks (heavy gate).**
- `pnpm --filter fluxiq check`.
- Vitest groups (parallel, real-sql) over `src/runtime/llm src/runtime/loop-limits src/runtime/flow-authoring src/runtime/project-agents src/framework/automation-service`.
- Core audit.
- Downstream model-text.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1056.md`, ending with the return contract.
