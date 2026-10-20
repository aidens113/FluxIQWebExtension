# Lane H, brief H6: Core owns the shared task rules (t727, audit finding 5)

## Outcome

Done. The validation caveat: in the real EXT tree, 4 `core-build` tests fail right now, and for a while every
task/worktree test failed at module load. Both come from `scripts/build-cache/`, which the other worker is
rewriting at the same time (at one point `scripts/build-cache/index.mjs` imported a deleted `build-order.mjs`). On an
overlay that holds my scripts, HEAD's build-cache and this tree's Core, all 136 task and worktree tests pass.

## What changed and why

### Core (`fxwork/t727/!FluxIQ/scripts/task/`)

- `task-id.mjs`: `allocateTaskId` takes a new option, `pairedRepositories: [{ repositoryRoot, integrationBranch? }]`.
  It scans every listed repository the same way (open branches, merges on the integration branch, `refs/fluxiq/task-ids/*`,
  `Task:` trailers) and takes the highest number. A refusal for a requested id names the repository that holds it
  (`... in <root>`). This is what the EXT allocator used to do in its own `nextTaskId`. Core's stricter canonical
  check of `--id` stays in place and now covers both repositories. Core's own start passes no paired repositories, so
  Core's `pnpm task` behaves as before. The header comment no longer says "keep the two in step"; it says downstream
  imports this module.
- New `git-answered-no.mjs` holds `gitAnsweredNo`, moved from the EXT git runner. It is a separate file to keep one
  export per file.
- New `path-inside.mjs` holds `pathInside`, moved from EXT `path-identity.mjs`. It is now defined through `samePath`
  (it walks up the ancestors), so the identity rule exists in one place. It also gets right a child named `..x`, which
  the EXT `path.relative` version wrongly put outside.
- `git-command.mjs`, `path-identity.mjs`, `record-task-id.mjs`, `task-id-ref-prefix.mjs`: logic unchanged; only the
  comments now say downstream imports them.
- `branch-name.mjs`: logic unchanged. The comment and refusal message now also say the slug becomes a directory
  name downstream. The message keeps the text "not a usable task slug" that tests match on.
- `index.mjs`: also exports `gitAnsweredNo` and `pathInside`.
- Tests, in `tests/` beside each subject:
  - `task-id.test.mjs` gains 7 repository tests: merged and open ids, an empty repository, paired-clears-Core (the
    t122 case), paired when Core is behind, each repository's own integration branch, a Core-only ref plus a refusal
    that names the root, and an abandoned ref.
  - `record-task-id.test.mjs` gains 2 paired tests.
  - New: `git-answered-no.test.mjs`, `path-identity.test.mjs`, `path-inside.test.mjs`.

### EXT (`fxwork/t727/!FluxIQWebExtension/scripts/`)

- Deleted copies: `task/task-id.mjs`, `task/task-id-ref-prefix.mjs`, `task/record-task-id.mjs`, `task/branch-name.mjs`,
  `worktree/git-command.mjs`, `worktree/path-identity.mjs`.
- Deleted the tests of those copies: `task/tests/task-id.test.mjs`, `task/tests/branch-name.test.mjs`,
  `task/tests/record-task-id.test.mjs`, `worktree/tests/path-identity.test.mjs`. Their cases now live in Core's tests
  (above), or in the new EXT tests below where the subject is EXT's `start`.
- Importers now load Core through `importCoreScript` (a top-level `const { x } = await importCoreScript("scripts/task/<m>.mjs")`):
  - `task/start.mjs` (`taskBranchName`, `recordTaskId`, `allocateTaskId`). `nextTaskId(root, { coreRepositoryRoot })`
    becomes `allocateTaskId({ ..., pairedRepositories: core ? [Core] : [] })`, so the allocation itself is unchanged.
  - `task/list.mjs` and `task/locate.mjs` (`parseTaskBranch`).
  - `worktree/apply-move`, `checkout-repository`, `core-sibling`, `create`, `disposable-root`, `env-local`, `remove`,
    `shared-core-move`, `side-state`.
- `worktree/index.mjs` still exports `runGit`, `gitAnsweredNo`, `samePath` and `pathInside`, now loaded from Core.
  Its callers outside my scope still need them: `lab/pair/*`, `lab/live-guards/dev-ancestry`,
  `lab/core/commit/read-core-commit`, and the `scripts/task/*` files that already imported `runGit`/`samePath` from
  this barrel.
- `task/index.mjs` no longer exports `parseTaskBranch`, `taskBranchName`, `recordTaskId`, `nextTaskId` or
  `TASK_ID_REF_PREFIX`. Nothing in the repository imported them from there (checked by grep).
- New tests:
  - `task/tests/start.test.mjs`: start records its ref; a dry run records nothing; start, abandon, start gives a new
    id; a paired dry run clears ids merged in Core (t124 where unpaired gives t122); a paired dry run clears a ref
    recorded only in Core.
  - `task/tests/command-line.test.mjs`: pins the CLI result objects through `runTaskCommandLine`. It covers
    `start --dry-run` (full deepEqual, `t042`, `task/t042-...`), a branch-only `start` followed by `list`, a paired
    `start --worktree --core --base --dry-run` (nested paths, one branch name for both sides), slug refusal before
    any ref is written, and `abandon --dry-run` then `abandon`, after which the id stays spent.
- Decided against: `progress-note.mjs` stays in EXT. It writes `scope: "worktree"` and Core's writes `scope: "task"`,
  so merging them would change one side's stderr output or Core's API. It is a two-line channel of the worktree half,
  not a shared rule. Also not done: no option to inject a git runner. No EXT caller or test needed one, since every
  test uses real fixture repositories.
- `scripts/worktree/core-sibling.mjs` already had the lead's uncommitted switch to `coreRootOf` before I started. My
  only edit there is the `samePath` import.

## Commands run and observed results

- CORE `node --test "scripts/task/tests/*.test.mjs"`: 32 pass before. After: `# tests 48 # pass 48 # fail 0`.
- CORE `node scripts/structure-audit.mjs`: `structure-audit: passed (409 warning(s), 1152 baselined).` One new
  advisory warning: `scripts/task/: 20 source files is past the 15-file advisory threshold`. The fail limit is 25.
- EXT `node --test "scripts/task/tests/*.test.mjs" "scripts/worktree/tests/*.test.mjs"`:
  - Before: `# tests 146 # pass 146`.
  - After, first run: `# tests 136 # pass 136 # fail 0`.
  - Later runs in the real tree: first 9 files failed with
    `ERR_MODULE_NOT_FOUND ... scripts\build-cache\build-order.mjs imported from scripts\build-cache\index.mjs`. Most
    recently `# pass 132 # fail 4`, all four in `worktree/tests/core-build.test.mjs`
    (`pnpm --filter @fluxiq/contracts build ... was not stamped`). Both are the concurrent build-cache rewrite.
  - On the overlay (scratchpad `h6-overlay`: my `scripts/`, HEAD's `scripts/build-cache`, junction to this tree's
    Core): `# tests 136 # pass 136 # fail 0`.
- The new `start.test.mjs` and `command-line.test.mjs` also pass against HEAD's original EXT scripts
  (`git archive HEAD scripts` into the scratchpad): `# tests 10 # pass 10 # fail 0`. So they pin behaviour the old
  implementation already had.
- Tests of the other worktree-barrel importers (`check/core-build`, `check/core-mirror`, `lab/core/build-lease`,
  `lab/core/commit`, `lab/live-guards`, `lab/pair`, `core-scripts`):
  - Real tree: they fail through the same build-cache `ERR_MODULE_NOT_FOUND`.
  - Overlay: 93 of 95 pass. `package-gates.test.mjs` fails because the overlay has no `apps/`.
    `facility-failure-run.test.mjs` test 4 (refusal screening) fails identically on HEAD's untouched scripts, so it
    has nothing to do with this change.
- EXT `node scripts/structure-audit.mjs`: exit 0, `structure-audit: passed (213 warning(s), 635 baselined).` No new
  finding for task or worktree. Only advisory directory-count warnings, and the directories now hold fewer files than
  before.
- EXT `node scripts/check/core-mirror.mjs`:
  `core-mirror: 1 mirror set(s) match FluxIQ Core at C:\Users\osrs_\FluxStuff\fxwork\t727\!FluxIQ: structure-audit (58 files).`
  (exit 0)
- EXT `node scripts/task/run-task.mjs list` before and after: both exit 0, but the bytes differ. Every task's `behind`
  is +2 because `dev` gained two commits between the captures. To compare like with like, I ran the dispatcher back
  to back with HEAD's original scripts and the new ones against the same repository (scratchpad `h6-compare.mjs`):
  - repositoryRoot = this tree: `old==new: true old==old-again: true bytes: 18729 18729`.
  - repositoryRoot = the main checkout (read-only `list`): `old==new: true ... bytes: 18783 18783`.

## Not verified

- A real `pnpm task start/finish/abandon/prune` on the real repositories (forbidden by the brief). `finish` and
  `prune` are not driven by the new tests: they only switched imports, and they get `runGit`/`samePath` from the
  barrel exactly as before.
- The EXT suites in the real tree in a state where build-cache is consistent. The overlay stands in for that, so the
  lead should rerun the same command after the build-cache worker lands.
- Behaviour on non-Windows (the Windows-only path cases are skipped there).

## Open questions or contradictions found

1. **Merge order.** Once EXT contains this change, anything that loads `scripts/worktree/index.mjs` or
   `scripts/task/` needs a Core sibling that has `scripts/task/git-answered-no.mjs`, `path-inside.mjs` and the
   `pairedRepositories` option of `task-id.mjs`. That covers `pnpm task`, `check/core-mirror`,
   `check/core-build/freshness`, `lab/pair`, `lab/live-guards` and `lab/core/*`. Without them,
   `importCoreScript` fails with "that Core predates the shared tooling ... Merge Core's dev into it".
   - This applies to the main checkout's Core (`C:/Users/osrs_/FluxStuff/!FluxIQ`), the shared flat-worktree Core
     `fxwork/!FluxIQ`, and the Lab's `fxlab/!FluxIQ`.
   - The Core change is purely additive and Core's own behaviour is unchanged, so landing it on Core `dev` early is
     safe.
   - A Core-paired finish normally merges EXT first. Here that would leave the main EXT checkout's `pnpm task` broken
     until Core t727 is merged and the main Core checkout is on that `dev`. Either merge Core's side first (keeping
     the t727 Core worktree in place until the EXT finish has run its checks), or run Core's finish immediately after
     EXT's and update the main Core before any lane runs `pnpm task` again.
   - Concurrent lanes in that window get the clear `importCoreScript` error, not a wrong id.
   - An old Core that has `task-id.mjs` but no `pairedRepositories` would silently ignore the option. It cannot be
     reached, because `start.mjs` statically imports `worktree/index.mjs`, which loads `git-answered-no.mjs` first and
     fails on such a Core before any allocation.
2. **Docs I did not own** still say "keep the two in step":
   - Core `AGENTS.md` lines 286-287.
   - EXT `docs/architecture/repository-layout.md` lines 776-778.
   Both should now say the downstream repository imports Core's `scripts/task/task-id.mjs`, `record-task-id.mjs`,
   `task-id-ref-prefix.mjs`, `branch-name.mjs`, `git-command.mjs`, `git-answered-no.mjs`, `path-identity.mjs` and
   `path-inside.mjs` through `scripts/core-scripts/importCoreScript`, with a paired start passing Core as a paired
   repository.
3. **Mirror drift list:** no EXT file remains a byte-identical copy of a Core file. EXT `worktree/progress-note.mjs`
   is deliberately different (scope `worktree`), so it is not a mirror.
4. **Package.json and core-scripts:** neither root `package.json` needs a glob change, because the new tests are in
   existing `tests/` directories. `scripts/core-scripts/` needs no change.
5. **Cross-repository contract:** EXT now depends on these Core module paths and export names: `scripts/task/`
   `git-command.mjs` (runGit), `git-answered-no.mjs` (gitAnsweredNo), `path-identity.mjs` (samePath),
   `path-inside.mjs` (pathInside), `branch-name.mjs` (taskBranchName, parseTaskBranch), `record-task-id.mjs`
   (recordTaskId) and `task-id.mjs` (allocateTaskId with `pairedRepositories`). Renaming any of them in Core breaks
   EXT loudly at load.
