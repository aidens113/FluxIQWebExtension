# FluxIQ web extension: rules for Cline

You are working in the FluxIQ web extension repository, paired with FluxIQ Core in
the sibling checkout `C:\Users\osrs_\FluxStuff\!FluxIQ`. Before any work:

1. Read `AGENTS.md` in this repository. It is binding: repository boundaries,
   engineering structure, generated data, validation, branches and worktrees,
   committing and pushing, and the testing-facility rules.
2. Read the global rules `F:\!AgentBrain\global\CLAUDE.global.md` and the lesson
   indexes `F:\!AgentBrain\lessons\global\INDEX.md` and
   `F:\!AgentBrain\lessons\fluxiq\INDEX.md`. Open a lesson file only when it
   applies to the task at hand.
3. Read `docs/working/README.md`, then the `## Current State` of
   `docs/working/mvp-final-month-plan.md` (stop at the first `---` after it).
   Its "Standing user rules" list and "Next order" are where to start. The
   briefs under `## Worker Briefs` in the same document describe each queued
   unit of work.
4. Before editing Core, tell the user the task crosses into FluxIQ Core and
   follow Core's own `AGENTS.md` there.

How to work in Cline:

- `AGENTS.md` describes a supervisor that dispatches worker and lead
  subagents. Cline has none: do that work yourself, one unit of work at a
  time, on its own task branch (`pnpm task start <slug> --worktree --core`,
  then `pnpm task finish <id>` in this repository and again in Core).
- Record findings, decisions and validation (the exact command and what it
  printed) in the working document as they happen, not at the end.
- Validate each change narrowly: the tests beside the changed files, each
  touched package's typecheck, and the structure audit. Full suites at most
  twice a day.
- Paid live Lab runs spend the user's real money: run them only while the
  user is present to approve the command, one attempt per launch, and debug
  every run fully before another.
- Report in plain English: what happened, what it means, what is next.
