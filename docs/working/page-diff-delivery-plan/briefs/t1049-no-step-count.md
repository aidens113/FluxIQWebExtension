# Brief t1049: no count of steps without progress ends anything; W3's two leftovers

**Goal.** The user's rule (AGENTS.md, "No arbitrary limit ends or resets a run", 2026-11-24): "THERE SHOULDNT BE
ANY ARBITRARY FUCKING CALL LIMIT THAT RANDOMLY JUST RESETS EVERYTHING".
- No count of calls, steps, iterations or steps without progress ends an attempt's round, an exploration or a
  recovery.
- Loop detection and the model's own loop decision handle a repeat: it is told what it repeated and picks
  continue, change, ask or finish (`runtime/llm/evidence-progress/stall-redirect.ts` and the loop check).
- Only the result, the purse or a person's Stop ends a task.

`maxStepsWithoutProgress` still exists. Find every use with
`grep -rn "StepsWithoutProgress\|stepsWithoutProgress" packages/fluxiq/src`. The main places:
- `runtime/llm/loop-configuration.ts`, `evidence-loop.ts`, `evidence-loop/**`, `decision-handlers/**`,
  `evidence-progress/**`, `tool-failure.ts`, `unusable-decision.ts`, `draft-amendment-feedback/feedback.ts`;
- `loop-limits/evidence-loop.ts`;
- `adaptation/recovery/{exploration-budget,progress-guard,runtime-exploration}.ts`;
- `agents/progress/no-progress.ts`.

**Do.**
- Remove the setting and every ending that it or a no-progress tally drives. Do not raise it, and do not
  replace it with another number.
- Where a stall now steers instead, keep the steering:
  - the model is told plainly what it repeated or what has not changed;
  - the existing loop decision follows.
- An ending that only the count produced becomes the purse's to make.
- Keep every result code and its words truthful. Delete codes that nothing can produce any more.
- W3 leftovers, in `runtime/flow-authoring/draft/amendment/`:
  - `route.ts`: a `repeat` whose `over` names a step not in the draft is refused by name. It never quietly uses
    the step before it.
  - Drop the parsing of `settings` on an amendment, since no edit offers it.

**Proof.**
- A provider-free test: a loop that makes no progress for many more steps than the old default keeps running,
  steered, until the purse or the result ends it.
- The same for a recovery exploration.
- Update the tests that pinned the old ending to the new truth, and say which.
- Downstream `domain/src/runtime/llm-evidence/node-run/frozen-execution/tests/core-loop.test.ts` names the setting.
  Update it.

**Owned paths (Core-paired task).** Core: the files above and the tests beside them,
`runtime/flow-authoring/draft/amendment/{route.ts,edits/schema.ts}` and the tests beside them, and the Core
`docs/architecture/` lines that describe the step count. Downstream: that one domain test.
**Must not touch.** `answer-first/result-feed/**`, `runtime/llm/decision-context/**`, `result-verification/**`,
`flow-authoring/bootstrap/**`, `answer-first/tests/{second-attempt-proof,later-attempt}*`.
These are other tasks' files. No git, no paid or Lab runs, no `node -e`.

**Checks (heavy gate).**
- `pnpm --filter fluxiq check`.
- Vitest groups (parallel, real-sql) over `src/runtime/llm src/runtime/adaptation src/runtime/agents src/runtime/loop-limits src/runtime/flow-authoring/draft src/framework/automation-service/service/answer-first`.
- Core audit; Core libraries build.
- Downstream `node domain/scripts/test-domain.mjs llm-evidence`; domain check; model-text.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1049.md`, ending with the return contract.
