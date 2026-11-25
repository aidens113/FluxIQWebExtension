# Brief t1040: the Lab refuses every test run on a tree that lacks `dev`

**Goal.** The user (2026-11-25, emphatic): "merge all test runs before doing more tests ... MERGE TO DEV AND
MERGE TEST LANES AFTER ANY SERIOUS UPDATES". Today only live (paid) runs are refused on a checkout or Core
that lacks local `dev` (`scripts/lab/live-guards/rules/behind-dev.mjs`, read by `admit-live-run.mjs`). A
scripted-model or provider-free run on a stale lane still starts, and that is how a lane tested code without
an update `dev` already had. Make the same `behind-dev` check refuse **every Lab entry that runs the product
in a browser or a test harness** (`lab attempt` with or without `--scripted-model`, provider-free runs,
`lab run`, demo-workspace, ui:e2e and any other Lab launch entry you find), for both this checkout and the
Core it builds against. Read-only Lab commands (`inspect`, `compare`, `auth`, `clone-cache`, `flow-chart`,
`stop`, `watch`) stay exempt.

**Keep.** The rule's existing behaviour: docs-only gaps do not refuse (`docsOnly`), git errors refuse, the
user-only override file still overrides, and the refusal names the exact `git merge dev` remedy. One rule, one
place: reuse `readDevAncestry` and the `behind-dev` rule, never a second copy of the check. Refusing early
(before any build or browser starts) and printing one JSON refusal line like the live guards do.

**Find first.** Where `run-lab.mjs` decides that a run is live and calls the live guards, and every other
launch entry that starts a run. Read `scripts/lab/live-guards/{admit-live-run,dev-ancestry}.mjs`,
`rules/behind-dev.mjs`, `rules/guard-state.mjs` and their tests.

**Owned paths.** `scripts/lab/**` (including tests in its `tests/` folders);
`docs/architecture/testing-facility.md` (the "Live-run waste guards" section: say the behind-dev rule now
guards every run).

**Must not touch.** `packages/test-runner/src/attempt-lane/scripted-model/**`, `domain/`, `apps/`,
FluxIQ Core, `AGENTS.md`. No git commands. No Lab run that opens a browser and no paid run; the
refusal path is proven by tests and by a real refusal (below), which starts nothing.

**Rules.** `AGENTS.md` code structure (one exported thing per file, barrels, tests in `tests/`). No `node -e`.

**Acceptance (run them, quote the output in your report).**
- Tests: a scripted attempt and a provider-free run on a tree lacking `dev` are refused before any build;
  the same on a tree containing `dev` are admitted; read-only commands are never checked; a docs-only gap is
  admitted; the override file admits. Run the `scripts/lab` tests you changed or added.
- A real check against real git: a small script under `test-runs/t1040/` that calls the new guard entry
  with this worktree's real roots (it contains `dev`, so it must admit) and with the read-only `t1015` tree
  `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox` (it also contains `dev`, so it must admit). Quote both.
  Do not start a Lab run.
- `node scripts/structure-audit.mjs` passes.

**Report.** `docs/working/data-first-simplification-plan/reports/t1040.md`, ending with the return contract.
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t1040-lab-guard-every-run` (work only there).
