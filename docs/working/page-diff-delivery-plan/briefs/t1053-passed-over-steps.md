# Brief t1053: a step the saved Flow passed over never becomes an evidence gap

**Goal.** Fix the product defect behind scripted run `run-mwwwf7pb-c646fefb` (company-website-apprentices). The
cause and the quoted step evidence are in `docs/working/page-diff-delivery-plan/reports/scripted-round-diagnosis.md`,
"2.". Read that section first.
- **What happened.**
  - Attempt 2 ran attempt 1's saved Flow. Its cover-dismissal steps (cookie banner, close, "no thanks") were passed
    over because their targets were already gone. Core's own rule allows that (`replay-stands.ts:23-26`), and the
    judge said yes.
  - Core's run trail (`runtime/result-verification/run-trail/of/attempts.ts:96-109`) still handed those
    passed-over steps, with empty outputs, to the web judge-evidence projector. The projector marked them
    `web_judge.evidence_unrecognized` (domain `judge-evidence/project.ts:105-107`).
  - `verdict/result-verdict.ts:46-50` holds any yes as unsure while gaps stand. The gaps stayed in the attempt's
    trail, so no completion could ever be accepted. The attempt could end only on its budget, which breaks
    AGENTS.md "A task ends only with its final result or with its budget gone".
  - This hits any saved Flow with an optional detour that a later attempt passes over.

**Do, at the cause, generally.**
- A step passed over by routing (route skipped, its target absent, no outputs) is Core's own record of a routing
  decision, not page evidence.
  - Core never hands it to the host projector.
  - Core reports it to the judge in its own plain words: the step, that it was passed over, and why (its target was
    not there).
  - It raises no evidence gap.
  - This follows t1043's rule for Core's own witness placeholder (`judge-evidence/summary.ts`). The judge still
    sees the whole run (AGENTS.md: the judge sees the run's whole trail), so do not drop the step.
- A step that ran, failed or produced outputs goes to the projector exactly as now.
- Change nothing in the domain projector unless Core's change cannot avoid it, and say why if so.
- Model-facing words stay generic.

**Proof.**
- Provider-free tests that fail before the fix:
  - a trail with passed-over cover steps yields `missing: []`, and the judge's yes stands;
  - a passed-over step is named to the judge in Core's words;
  - a step that ran and produced no recognizable evidence still raises its gap.
- At the attempt level, if the existing harness allows: attempt 2 runs a saved Flow whose detours are passed over
  and ends achieved.
- Then build Core's libraries in your Core worktree and run the scripted task: `FLUXIQ_LAB_INSTANCE=t1053-lab node
  C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1053-apprentices -- pnpm lab attempt
  company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4`.
  Run it in your downstream worktree, headed; the watcher runs by itself. All 4 attempts must give the right answer,
  and attempts 2 to 4 must run the saved Flow with continuation held.

**Owned paths (Core-paired task).** Core `packages/fluxiq/src/runtime/result-verification/run-trail/**`,
`runtime/result-verification/judge-evidence/**`, and the tests beside them. Downstream: only the report, unless
the projector truly must change (`domain/src/runtime/llm-evidence/judge-evidence/**`).
**Must not touch.** `result-verification/{result-evidence,flow-less,asked-words,cited-yes}/**`,
`answer-first/result-feed/**`, `runtime/llm/**`, `flow-authoring/**`, `answer-first/tests/**` deadline tests
(other tasks), and the test-runner (t1052). No git, no paid runs, no `node -e`.

**Checks (heavy gate).**
- `pnpm --filter fluxiq check`.
- Vitest groups (parallel, real-sql) over `src/runtime/result-verification src/framework/automation-service/service/answer-first`.
- Core audit.
- Downstream `node domain/scripts/test-domain.mjs llm-evidence` if the domain changed; model-text.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1053.md`, ending with the return contract.
