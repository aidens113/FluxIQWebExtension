# Loop decisions: asking the person is a last resort again; an unreadable judge loop is caught (t1000)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t1000/!FluxIQ` (Core task branch) and `t1000/!FluxIQWebExtension`.
Read: this brief; AGENTS.md (downstream), "An agent repeating itself is caught and steered" and "No model ladder"; t994's report `docs/working/data-first-simplification-plan/reports/t994-sweep-fix-core.md` (Open Questions 2 and 4, and the `endings/person` row); Core `packages/fluxiq/src/runtime/llm/loop-decision/**` (offered.ts, ask.ts, read.ts), `runtime/llm/repeat-guard/loop-detection/**`, `answer-first/loop-signal/**`, and `runtime/result-verification/unreadable-asks/**`.

The user's rules:
- 2026-11-19, on a detected loop: the model is told what it repeated and decides. Watching live runs, the user then said "it seems to be asking the user too quickly for input", and "model should always give a solid effort, and ONLY stop and ask user for feedback if its legit impossible to complete a task under the guidelines given by user". So `ask_person` is offered only once the loop persists after the model has changed approach at least once, and it needs a stated reason naming what is impossible (t969).
- 2026-11-20: the model ladder is removed, so nothing climbs.
- 2026-11-03: loop detection covers every agent role.

Defect 1, a regression. t983 (002650596) removed the ladder and with it the whole gate, so `ask_person` is offered at the first catch. t994 W1 then re-pinned `endings/person` to expect that. Restore the rule, with the ladder part dropped: the first catches offer continue, change_approach and finish_with_best; `ask_person` joins only after a change_approach was chosen and the loop persists; an `ask_person` without a reason naming what is impossible is refused. Put the `endings/person` test back to the rule, citing this brief and the user's words.

Defect 2. An unreadable judge reply is asked again at once and indefinitely; one t994 fixture made 2,399 calls in 90 s. In a paid run that spends the purse on a stuck judge. Find the root, no cap and no wait. Each re-ask must state what was unreadable (the parse failure) so the next reply can change. A repeat of the same unreadable reply is a loop for the judge role, so it goes through the same detection and steering as every role. The judge stays on the same model (user, 2026-11-20). Design it within these rules, and report what the judge's loop decision may choose.

Steps: find each cause and the commit that introduced it; fix it in the owning modules, one export per file; write tests (first catch offers no ask_person; ask_person after change_approach; reasonless ask refused; a judge repeating one unreadable reply is caught and steered; a judge whose re-ask parses settles normally). Bump `fluxiq` patch over dev's.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- touched files and their neighbours' tests through `scripts/vitest-groups.mjs` with their group, named files only, `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`;
- `pnpm --filter fluxiq check`;
- Core structure audit.
No full suites, no git mutations, no `node -e`, no provider or paid calls. Model guidance never mirrors a realistic scenario. Low free memory is not a reason to wait.

Owned: Core `packages/fluxiq/src/runtime/llm/{loop-decision,repeat-guard,decision-handlers}/**`, `answer-first/loop-signal/**`, `runtime/result-verification/**`, their tests and `packages/fluxiq/package.json`; your brief and report.
Must not touch: other Core paths (report them), other worktrees, the shared `fxwork/!FluxIQ`, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.
Report: `reports/t1000-loop-decisions.md`. End with the return contract.
