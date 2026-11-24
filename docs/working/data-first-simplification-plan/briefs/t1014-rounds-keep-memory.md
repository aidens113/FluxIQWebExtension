# A fresh round keeps what the model learned; unreadable decider replies go to loop detection (t1014)

Lead: Claude Code session, 2026-11-24. Tier: worker-heavy.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t1014/!FluxIQ` (Core task branch) and `t1014/!FluxIQWebExtension`.
Read:
- this brief;
- AGENTS.md downstream: "No arbitrary limit ends or resets a run", "Fix an obvious shared problem before running more", "An agent repeating itself is caught and steered";
- Core `docs/architecture/automation-studio/failure-control.md` ("No count ends a loop with a `loopSignal`", t1008, and the t1000 and t1011 paragraphs);
- t1008's report `docs/working/data-first-simplification-plan/reports/t1008-look-loop.md`, "Open items";
- Core `answer-first/attempt/{rounds.ts,round.ts,round-note.ts,run-attempt.ts}`, `runtime/llm/unusable-decision.ts`, `runtime/llm/repeat-guard/loop-detection/**`.

The user, 2026-11-24, after every paid run lost its progress every ~10 decisions: "THERE SHOULDNT BE ANY ARBITRARY FUCKING CALL LIMIT THAT RANDOMLY JUST RESETS EVERYTHING". t1008 removed the count-based round endings. Two ways to empty a run's memory remain:
1. Loop detection's last rung (the t962 design, `rounds.ts` "steered onto a different way") starts a fresh round whose evidence window is empty. The model then loses what it read, described and found, and repeats it.
2. Unreadable decider replies in a row still end a round, on a count.

Lead's decisions:
1. A new round may reframe the conversation, but it starts with everything the run learned:
   - the evidence the model gathered (pages and locations reached, elements described, finds, reads and their rows, acts and their outcomes);
   - what it tried and what came back;
   - the loop's findings and the model's decisions, and the judge's defects (already carried, t1011/t1008).

   It is carried in a compact form the model can act on, never raw page dumps, within the context window: the oldest raw evidence is summarised, never dropped silently. The steer still names the repeat and asks for a different way, and the page is never navigated away.
2. Unreadable decider replies go through loop detection exactly as the judge's do (t1000):
   - each re-ask names the schema part that failed;
   - two replies failing the same way in a row are a loop finding for the decider role, steered and decided;
   - no count ends the round.

Steps: find every path that empties or replaces the evidence window between rounds; implement carry-forward in the owning modules, one export per file. Write tests:
- a fresh round after the last rung holds the prior round's evidence summary and tried list;
- the page is not navigated;
- a repeated unreadable decider reply is a loop finding, not a round end;
- no count ends a round.

Update the prompt pins if wording changes (owners regenerate them). Bump `fluxiq` patch over dev's.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- named vitest files through `scripts/vitest-groups.mjs` with their group, `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`, covering answer-first `attempt/tests`, `tests/endings`, `runtime/llm/repeat-guard`, `runtime/llm/tests` for unusable decisions, and the prompt pin owners;
- `pnpm --filter fluxiq check`;
- the structure audit.
No full suites, no git mutations, no `node -e`, no provider or paid calls, no Lab runs.

Owned: Core `answer-first/attempt/**`, `runtime/llm/unusable-decision.ts`, `runtime/llm/repeat-guard/**`, `runtime/llm/evidence-loop/**`, their tests, `packages/fluxiq/package.json`, the failure-control doc, and your brief and report.
Must not touch: `answer-first/result/**` and `result-feed/**` (lane t1013), other worktrees, the shared Core.
Report: `reports/t1014-rounds-keep-memory.md`, leading with what emptied memory and how it is now carried. End with the return contract.
