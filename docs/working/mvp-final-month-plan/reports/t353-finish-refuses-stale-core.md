# t353 report: task tooling refuses to validate against a Core behind Core's dev

## Outcome
Done. Uncommitted in `fxwork/t353-finish-refuses-stale-core`.

## What changed and why
- `scripts/task/core-currency.mjs` (new): `checkCoreCurrent({ workRoot, coreRepositoryRoot, coreIntegrationBranch })`. It resolves the Core the tree's `domain/package.json` links (and checks that it is a worktree of the named Core repository), then counts the commits from its HEAD to Core's integration branch. If the count is above zero it returns a refusal that names the Core root, its commit, Core's dev commit and the commit count. The fix it names depends on the Core's state: detached shared Core -> `pnpm task sync-core` in that worktree; a `task/*` branch (Core-paired) -> `git -C "<core>" merge dev`; any other branch (main Core) -> bring that checkout up by hand. It returns null when no Core is named or none is beside the tree. It never checks out or merges anything.
- `scripts/task/finish.mjs`: new `coreIntegrationBranch = "dev"` parameter. The check runs after the dirty-tree and pairing checks and before the dry-run return, so `--dry-run` refuses exactly as a real run does, and before any merge or gate. `--skip-checks` does not waive it. The result now carries `coreChecked: { root, head, target } | null`.
- `scripts/task/start.mjs`: after the shared Core move (or after creating the paired Core branch), it confirms the new worktree's Core contains `coreFrom` and throws if it does not. This is a safety net. The existing `planSharedCoreMove` already moves the shared Core to dev before anything is created, so only a defect in the move can trip it.
- `scripts/task/index.mjs`: exports `checkCoreCurrent`.
- `docs/architecture/repository-layout.md`, "Keeping the Shared Core Current": I replaced the sentence saying this check lives only in the Lab with a description of the finish and start checks.
- `scripts/task/tests/finish-core-currency.test.mjs` (new, 6 tests): stale shared Core refused at a real (non-dry) finish, with nothing merged, the branch kept and the Core left where it was; dry run reports the refusal; paired Core branch behind dev refused with the merge command; current shared Core passes and reports `coreChecked`; paired branch that contains dev and is ahead of it passes; no Core beside the tree is not a refusal.

## Commands run and observed results
- Fail-first: restored HEAD's `finish.mjs`, then ran `node --test scripts/task/tests/finish-core-currency.test.mjs` -> `# pass 0 # fail 6`. Tests 1-3 failed for lack of the refusal; 4-6 failed because `coreChecked` did not exist yet. With the change: `# pass 6 # fail 0`.
- `pnpm task:test` -> `# tests 137 # pass 137 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (176 warning(s), 182 baselined).` One advisory warning concerns this area: `scripts/task/: 20 source files is past the 15-file advisory threshold`.
- Read-only call: `checkCoreCurrent({ workRoot: <this worktree>, coreRepositoryRoot: C:/Users/osrs_/FluxStuff/!FluxIQ })` -> shared Core `fxwork/!FluxIQ` at `1b9f15f7`, target `1b9f15f7`, behind 0, no refusal.

## Not verified
- I did not run `pnpm task finish`/`start` against the real repositories, not even with --dry-run. This tree is dirty, so finish refuses earlier on that, and the main checkout does not have this code yet.
- The start safety net has no test. A full start needs pnpm install and build.

## Open questions or contradictions found
- `scripts/task/` now holds 20 files (advisory threshold 15). A later split into `scripts/task/core/` might be worth doing.
- `docs/architecture/repository-layout.md` around line 513 still says `pnpm task finish` runs `pnpm check`. It actually runs the structure audit unless `--full-check` is passed. I left that paragraph alone because it is outside this brief's section.
