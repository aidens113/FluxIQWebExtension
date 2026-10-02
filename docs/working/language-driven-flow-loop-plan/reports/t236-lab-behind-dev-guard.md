# t236 report: the `behind-dev` live-run guard

## Outcome

Done. There is now a fifth live-run guard rule, `behind-dev`. It refuses a `--live-llm` run in two cases. The first is when the downstream checkout's HEAD does not contain local `dev`, or the Core it builds against does not contain Core's local `dev`. The second is when git cannot answer that question, for example because there is no local `dev`. It is overridable only by the file `lab-slots/OVERRIDE-behind-dev`.

## What changed and why

- `scripts/lab/live-guards/dev-ancestry.mjs` (new) reads git for one root and never throws.
  - It runs `rev-parse --verify HEAD`, then `rev-parse --verify --quiet refs/heads/dev^{commit}`. When that exits 1 it records the error "has no local dev branch (refs/heads/dev)".
  - It then runs `merge-base --is-ancestor dev HEAD`. Exit 1 means the checkout does not contain `dev`; any other non-zero exit is an error.
  - When the checkout does not contain `dev`, it runs `rev-list --count HEAD..dev`.
  - Any failure, including git missing from the PATH or a directory that is not a checkout, becomes `error`, and the rule refuses with that reason.
- `scripts/lab/live-guards/rules/behind-dev.mjs` (new) holds `checkBehindDev`. It is pure, like the other rules, and returns one refusal that names every side that fails.
  - For each failing side it gives the root, the HEAD as 7 characters, how many `dev` commits are missing and dev's commit, or git's reason when it could not read the side.
  - The remedy is: `git merge dev` in the named roots, then `pnpm --filter fluxiq build` in the Core root, then `pnpm --filter @fluxiq-web-extension/extension build`, or ask the user for `OVERRIDE-behind-dev`.
- `rules/guard-state.mjs`:
  - `GuardState` gains `devAncestry: { repository, core }`.
  - `RULE_NAMES` is now `balance, behind-dev, loop, debug, unchanged`, which means `OVERRIDE-behind-dev` is honoured.
- `evaluate-live-guards.mjs`: the rule runs second, after `balance`.
- Barrels: `rules/index.mjs` and `live-guards/index.mjs` export `checkBehindDev` and `readDevAncestry`, and their comments now say five rules.
- `admit-live-run.mjs` reads the ancestry of `repositoryRoot` and `coreRoot`, in parallel with the ledger and the fingerprint. `coreRoot` is what `run-lab.mjs` already passes: `coreRepositoryRoot(env, repositoryRoot)`, which is `FLUXIQ_CORE_ROOT` if set, otherwise `../!FluxIQ`. For tests, the reader can be swapped through the new `devAncestry` option.
- Tests:
  - New file `tests/behind-dev.test.mjs`, which uses real temporary git repositories and the real `admitLiveRun`. It has 4 tests:
    1. Admitted: a checkout on `dev`, a task branch ahead of `dev`, and a detached Core at `dev`.
    2. Refused: a lane branch behind `dev` by 2 commits. The refusal names the root, the HEAD and "lacks 2". The override file admits the run, and `git merge dev` clears the refusal.
    3. Refused: a detached Core behind Core's `dev`.
    4. Refused: a repository with no `dev` (initialised on `main`). Also checked: a directory that is not a checkout gives an error from the reader.
  - `tests/rules.test.mjs` adds a pure unit test for the rule and puts `behind-dev` into the order test. Its `state()` defaults both sides to level with `dev`.
  - `tests/admit-live-run.test.mjs`: the fixture swaps in a reader that always reports both sides level with `dev`, because its roots are not git repositories.
- `docs/architecture/testing-facility.md`, section "Live-run waste guards":
  - adds a table row for the rule;
  - adds a paragraph with the user's rule, what passes, what a refusal names, and how it differs from the older Core-commit check, which reads `FLUXIQ_LAB_ALLOW_BEHIND_CORE`, whereas this rule has no variable.

## Commands run and observed results

- `node --test "scripts/lab/live-guards/tests/*.test.mjs"` printed `# tests 31`, `# pass 31`, `# fail 0`.
- The new tests fail without the rule. I removed `checkBehindDev` from `RULES` for one run, then restored it; `git diff --stat` matches the pre-test diff. On that run, `node --test tests/behind-dev.test.mjs tests/rules.test.mjs` printed `# pass 5`, `# fail 5`.
  - Failing: behind-dev tests 2, 3 and 4, the rules unit test and the order test.
  - Passing: behind-dev test 1, the admitted case, as expected.
  - After the restore, all 31 tests pass again.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (155 warning(s), 118 baselined).` None of the warnings are in `live-guards`.
- I called `readDevAncestry` on real checkouts. This is read-only git and makes no provider call.
  - This worktree: head `6f020e8`, dev `10233ad`, contains false, lacking 2.
  - `../!FluxIQ` (the shared Core): head `644b76f`, dev `9aa6a1a`, contains false, lacking 2.
  - Both trees are currently behind their `dev`, so a live run from here would now be refused.

## Not verified

- I did not launch `run-lab.mjs` with the rule wired in: no live run and no provider call, as the brief requires. The way a refusal is printed is unchanged, because it goes through the existing `formatRefusals`.
- I did not run the full `pnpm lab:test` or `pnpm check`, only the live-guards tests, as the brief asked.
- I did not test a nested layout with a Core-paired worktree. It uses the same `coreRepositoryRoot` resolution, so it should behave the same.

## Open questions or contradictions found

- The brief says Core is resolved the way the Lab does, through the link at `domain/node_modules/fluxiq`. In fact the Lab uses `coreRepositoryRoot`: `FLUXIQ_CORE_ROOT`, otherwise the sibling `../!FluxIQ`. It does not follow the symlink. I used the Lab's function. As a result, an agent-set `FLUXIQ_CORE_ROOT` could point the check at a different Core than the one the domain links. That is no worse than the rest of the Lab, which loads Core from the same root.
- The comment above `admitLiveRunOrExit` in `scripts/lab/run-lab.mjs` lists the older rules and does not mention `behind-dev`. I left that file alone because it is outside the live-guards folder; it is a one-line follow-up.
- The older Core-commit check in `run-lab.mjs` (`FLUXIQ_LAB_ALLOW_BEHIND_CORE`) overlaps with this rule for a detached Core. It also lets a run past through an environment variable that an agent could set. With this rule in place, that variable no longer gets a live run past a Core behind its `dev`. The supervisor may want to retire the variable.
