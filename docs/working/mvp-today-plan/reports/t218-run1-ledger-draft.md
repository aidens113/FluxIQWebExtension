# t218 — Run 1 ledger drafts

## Outcome

Copy-ready ledger entries follow for the language-driven loop plan and MVP-today plan. They use
only the completed run debug, t210–t217 outcomes, and the working-document protocol.

Both documents remain **Active**. The run was a valid, finalized measurement, so its documentation
unit is **Accepted** even though the product verdict failed. `Partial` would conflate evidence
quality with product success, and `Blocked` would be false because the diagnosed follow-up was
implemented and another run can proceed. t217 is also **Accepted** because its focused tests, Core
check, and Core build all passed. It improves terminal truthfulness only; it does not upgrade any
MVP criterion.

## Required pre-edit handling

- `docs/working/language-driven-flow-loop-plan.md` is 698 lines and can receive these entries
  directly.
- `docs/working/mvp-today-plan.md` is 977 lines. Per protocol, the supervisor must compact it before
  any shared edit, archive superseded worker-brief detail, leave a pointer, and record the
  compaction. Append the entries below only after that compaction.

## Language-driven loop plan — run 1

```markdown
### 2026-09-26 — First MVP hard-scenario run stopped during exploration
- Agent: supervisor, with t210–t216 analysis
- Changed: `language-driven-flow-loop-plan/debugs/run-muj2kzx1-8f9f8271.md` and t210–t216 reports under `mvp-today-plan/reports/`
- Why: The first provider-backed hard-scenario measurement had to establish whether a language-authored Flow could reach replay, answer checking, judgement, and repair.
- Validation: not independently re-run during documentation; finalized bundle/debug evidence records 26 build calls, 366,210 tokens, estimated USD 0.0573657, and failure at Stage 2 before proposal or runtime.
- Outcome: Accepted
- Follow-up: apply t217's terminal-classification fix, then rerun the same hard scenario serially; this run does not count toward the required two consecutive passes.
```

## Language-driven loop plan — t213/t217 follow-up

```markdown
### 2026-09-26 — Preserve the final unusable build diagnosis at iteration exhaustion
- Agent: supervisor, with t213, t215, and t217
- Changed: Core `runtime/llm/evidence-loop.ts` and tests `loop-budget.test.ts`, `unusable-decision.test.ts`; downstream reports t213, t215, and t217
- Why: Run 1's completion-only final answer failed `bootstrap.cannot_answer_instruction`, but bottom-of-loop exhaustion overwrote that known refusal with generic `iteration_limit`.
- Validation: `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts` -> 57/57 passed; `pnpm check` -> passed; `pnpm build` -> passed in Core.
- Outcome: Accepted
- Follow-up: rerun the hard scenario; confirm a final refused completion surfaces the actionable unusable-decision diagnosis, while generic usable non-completion still reports iteration-limit.
```

## MVP-today plan — run 1

```markdown
### 2026-09-26 — Run 1 produced a valid failure measurement, not an MVP pass
- Agent: supervisor, with t210–t216 analysis
- Changed: completed debug `language-driven-flow-loop-plan/debugs/run-muj2kzx1-8f9f8271.md` and t210–t216 reports
- Why: Measure the four MVP criteria against one real provider-backed hard scenario and one requested replay.
- Validation: not independently re-run during documentation; finalized evidence records 26 build calls, 366,210 tokens, estimated USD 0.0573657, and Stage 2 failure before any proposal, runtime run id, dataset, judgement, repair, persistence, or replay.
- Outcome: Accepted
- Follow-up: retain all four criteria as unproven by this run, land t217's truthful terminal classification, and repeat the same scenario; two consecutive passing runs are still required.
```

## MVP-today plan — t213/t217 follow-up

```markdown
### 2026-09-26 — Final build refusal now survives the iteration backstop
- Agent: supervisor, with t213, t215, and t217
- Changed: Core evidence-loop exhaustion handling and its two focused tests; downstream reports t213, t215, and t217
- Why: Preserve `bootstrap.cannot_answer_instruction` through Flow Bootstrap's stalled callback instead of replacing it with `flow_bootstrap.evidence_iteration_limit` after the last allowed decision.
- Validation: `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts` -> 57/57 passed; Core `pnpm check` and `pnpm build` -> passed.
- Outcome: Accepted
- Follow-up: run the same hard scenario again; t217 changes diagnosis only, so created-from-language, deterministic replay, self-repair, and self-judgement receive no new pass credit until live evidence reaches them.
```

## Current-state guardrails for the supervisor

When rewriting each document's `Current State`, record only these run-1 facts:

- one provider-backed hard-scenario attempt is now measured;
- it reached Stage 2 exploration and emitted no valid proposal;
- all 26 provider calls were build calls; no replay provider-call assertion was exercised;
- the final completion was unusable because the draft could not answer the instruction;
- t217 corrected the reported terminal diagnosis without changing budgets, answerability, or
  convergence behavior;
- runtime execution, exact dataset comparison, judgement, repair, persistence, and deterministic
  replay remain unmeasured in run 1;
- the exit condition remains two consecutive passing live runs.

Do not change either document to `Blocked`, `Complete`, or `Paused`. Do not describe t217 as a
convergence fix or predict that run 2 will author a valid Flow.

## Commands and verification for this report

- Read-only line count: loop plan 698 lines; MVP-today plan 977 lines.
- No build, test, run, browser, provider, Lab, source edit, shared-document edit, or commit was
  performed by t218.
