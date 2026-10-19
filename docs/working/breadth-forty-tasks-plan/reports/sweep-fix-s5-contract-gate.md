# Sweep fix S5: always-run contract tests in Core's `pnpm task finish`

Worker report. Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t723/!FluxIQ`, branch `task/t723-sweep-1019-fixes`. Nothing committed.

## Outcome

Done. Core's `pnpm task finish` now runs a named list of contract tests with vitest after it integrates `dev` and before `pnpm check`. If any of them fails, the merge is refused. The list holds three files to start.

## What changed and why

New directory `scripts/task/contract/`. The structure audit required it, because three `contract-` prefixed files had to become a directory:
- `list.mjs`: `CONTRACT_TESTS`, the config. Each entry is one line: `{ package, file, guards }`. The three files are system-prompt.test.ts, extraction-vocabulary.test.ts and issue-feedback.test.ts, all in `packages/fluxiq`.
- `run-tests.mjs`: `runContractTests(packageRoot, files)`.
  - Runs a single `pnpm exec vitest run <files> --reporter=default --reporter=json --outputFile.json=<tmp>` in the package directory. Readable output goes to stderr.
  - Reads vitest's JSON report to find out which files failed.
  - It fails closed. If no report is written (ENOENT), or vitest exits non-zero while every file passed, every file counts as failed.
- `gate.mjs`: `contractGate({ repositoryRoot, branch, dryRun, note, run, tests })`.
  - Groups the entries by package and runs each group once.
  - On failure it throws a message that names each failing file and what it guards, and gives the exact command to reproduce it.
  - The message says how to re-pin on purpose: update the expected text or budget in that test file in this task, commit it beside the change, and finish again.
  - It also says `--skip-checks` does not waive the gate, and that the checkout is left on the task branch.
- `index.mjs`: the barrel.

Changed files:
- `scripts/task/finish.mjs`: new injectable seam `contractTests = runContractTests`, next to the existing `check` and `note`.
  - On a real finish, the gate runs after the integration merge and before `pnpm check`. It always runs, even with `--skip-checks`.
  - `--dry-run` returns `contracts: { ran: false, commands, files, reason: "--dry-run" }` and runs nothing.
  - The result object now has a `contracts` field.
- `scripts/task/index.mjs`: re-exports `CONTRACT_TESTS`, `contractGate` and `runContractTests` from `./contract/index.mjs`.
- `scripts/task/tests/finish.test.mjs` (new): five node:test tests using throwaway git repositories and the `check` and `contractTests` seams:
  - The list names the three files.
  - Passing run: one call per package, the merge lands on dev, and `contracts.passed` is set.
  - Failing run: refused; the message names only the failing file and includes "re-pin it deliberately" and the vitest command; dev is untouched; HEAD stays on the task branch; `pnpm check` is never called.
  - `--skip-checks` still refuses on a contract failure.
  - Dry-run reports the exact command and files and runs nothing.
  - These tests sit in `scripts/task/tests/` because their subject is `finish.mjs`, and that glob is already part of `pnpm check`.
- `AGENTS.md` (Core), Branches And Worktrees, task-branch bullet: one sentence saying finish always runs the tests in `scripts/task/contract/list.mjs` and refuses on failure, even with `--skip-checks`.

**Decision: `--skip-checks` does not waive the gate.** That flag exists for a known, unrelated `pnpm check` failure. A contract failure is always the task's own, and the fix is to re-pin or correct the change. If it could be waived, the bypass that caused 5a652d4a and aa04a943 would still be open. The supervisor can reverse this if wanted.

## Commands run and observed results

- `node --test "scripts/task/tests/*.test.mjs"` (Core worktree) -> `# tests 32 # pass 32 # fail 0`. That is the existing task-script tests plus the 5 new ones.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (405 warning(s), 1152 baselined)`, exit 0.
  - The first run failed on my files: `[naming]` for the contract- prefix, `[failure-as-empty]` on a `.catch(() => null)`, and then `[imports]` for deep imports. All three were fixed.
  - It also prints "1 baseline entries can be lowered". That is not from my files. Other workers' deletions in apps/web are the likely cause.
- The real gate, run with a node one-liner calling `contractGate` with `runContractTests` against this worktree:
  - It refused and named all three files. Wall time: 54.7 s.
  - A direct `pnpm exec vitest run <the three files>` in `packages/fluxiq` agreed: `Test Files 3 failed (3)`, `Tests 6 failed | 51 passed (57)`, 35.5 s. This tree carries other workers' uncommitted `packages/fluxiq/src` edits.
- Runner pass path: `runContractTests(packages/fluxiq, ["tests/vitest-config.test.ts"])` -> `{"failed":[]}` (6 passed, 5.3 s).
- `pnpm task finish t723 --dry-run` -> refused before the dry-run report: "dev is checked out in C:/Users/osrs_/FluxStuff/!FluxIQ, not in ...fxwork/t723/!FluxIQ, so this checkout cannot merge into it." This existing refusal comes before any dry-run output, so a dry run from this worktree is not possible. The dry-run report is covered by the unit test.

## Not verified

- A real end-to-end `pnpm task finish` merge with the gate. It was not run: commits and merges are forbidden by the brief.
- The dry-run JSON from the real CLI. The worktree layout blocks it, as described above.
- Why the three contract tests fail in this worktree. That is outside this brief, and other workers own `packages/fluxiq/src`.

## Open questions or contradictions found

- The three contract tests currently fail in the t723 worktree, presumably because of in-flight prompt edits by the other S-fix workers. With this gate in place, t723 cannot finish until they are re-pinned or fixed. That is the intended effect, but the supervisor should know before attempting the finish.
- The gate adds about 35-55 s to every Core finish, mostly vitest collecting files. It is still far below `pnpm check`.
