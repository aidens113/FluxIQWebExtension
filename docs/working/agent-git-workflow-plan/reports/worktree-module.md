# Report — `scripts/worktree/`, a module owning safe worktree operations

## Outcome

Done. `scripts/worktree/` exists with 15 source files and 10 test files. Seven
files were extracted out of `scripts/lab/pair/` and rewired, six lifecycle
modules were added, and a barrel exports all thirteen names the brief fixed as
the contract with `scripts/task/`. All 74 pre-existing tests still pass, plus 35
new ones.

Two defects were found by testing and fixed; one of them was a real hole in the
Core-sibling check that `lab:pair` also had. Both are described below.

## What changed and why

### Extraction

Moved with `git mv` (history preserved), from `scripts/lab/pair/` to
`scripts/worktree/`: `git-command.mjs`, `pnpm-command.mjs`, `path-identity.mjs`,
`process-list.mjs`, `processes-using-roots.mjs`, `markers.mjs`,
`side-state.mjs`, and the four matching test files from
`scripts/lab/pair/tests/` to `scripts/worktree/tests/`.

`scripts/lab/pair/` keeps exactly what the brief listed: `roots.mjs`,
`move-plan.mjs`, `command-line.mjs`, `instructions.mjs`, `arguments.mjs`,
`provider-key.mjs`, `campaign-environment.mjs`.

Three signature changes were forced by the brief's required export names, and
each required editing call sites in `command-line.mjs`, not only its import
lines. This is slightly beyond "import lines and file moves", and it was
unavoidable: the names are the coordination contract with the parallel worker,
and leaving the old shapes would have made a silently wrong call rather than a
loud one.

- **`pathInside(parent, child)`** — the brief reverses the existing
  `pathInside(child, parent)`. Argument order was swapped to match the brief,
  because a silent reversal in `scripts/task/` would have produced a check that
  always passes. One call site in `command-line.mjs` was flipped to match, and
  the moved test now reads in the new order.
- **`runPnpm(root, args, options)`** — was `(root, args, env)`. Now takes
  `{ env }`. A bare fallback to `process.env` would have handed a worktree
  install every provider secret this repository has, with nobody having written
  that down, so an omitted `env` is refused outright. `runPnpm` was also made
  `async` so that refusal rejects rather than throwing in the caller's frame.
  Three call sites in `command-line.mjs` updated.
- **`readSideState(root, target, options)`** — was one object. `root` and
  `target` are the whole question; `side`, `buildable` and `distPaths` are what
  a particular caller labels and additionally measures, so they moved into
  options with defaults. Two call sites updated.
- **`processesUsingRoots(roots, options)`** — was
  `({ processes, roots, selfPid })` and synchronous. It now lists processes and
  reads `process.pid` itself, and is async; tests still pass both explicitly, so
  the selection stays pure to test. One call site updated.

`scripts/lab/pair/` now imports these through `../../worktree/index.mjs`, the
barrel, which is what the structure audit's import rule requires of a consumer
crossing into another directory. `pair/index.mjs` stopped re-exporting
`processesUsingRoots` (nothing outside consumed it) and its header comment now
says which responsibilities left.

The marker file names on disk (`.lab-pair-installed-lock`,
`.lab-pair-built-commit`) were deliberately **not** renamed: they are state, and
every existing Lab pair holds files under those names. Renaming them would have
made each pair reinstall and rebuild once for nothing. The reason is written in
the file. The error message did change, to "Unknown worktree marker".

### New modules

- **`disposable-root.mjs`** — `assertDisposable({ base, root, repositoryRoot,
  workingRoots })`. Refuses a root that is the disposable base itself, that is
  not below the base, or that is / contains / lies inside the repository this
  process runs from or any named working checkout. Returns the resolved root.
- **`core-sibling.mjs`** — `resolveCoreSibling(extRoot, { coreRepositoryRoot })`.
  Resolves the sibling from the worktree's `domain/package.json` `link:`, and,
  when the sibling is present and an expected Core is named, proves it is a
  worktree of that Core. An absent sibling is reported, not refused, because
  `create.mjs` adds it next.
- **`checkout-repository.mjs`** — `checkoutRepository(root)`, the identity
  comparison plus the proof that `root` is the top of its checkout. See the
  defect below for why those two are one function.
- **`create.mjs`** — `createWorktree(...)`. Refusals first, then
  `git worktree add -b`, then the Core sibling (added detached if absent), then
  Core's install and the extension's, then `realpath` on
  `domain/node_modules/fluxiq` required to land inside the sibling.
- **`remove.mjs`** — `removeWorktree(...)`. Refuses a non-worktree, the main
  checkout, the checkout it runs from, a directory inside a worktree, a dirty
  tree, and a tree with a process running below it. Then `fs.rm` recursive and
  `git worktree prune`. It never calls `git worktree remove --force`, and the
  file says why.
- **`env-local.mjs`** — `copyEnvLocal({ fromRoot, toRoot })`. A file-system copy;
  the contents are never read into the process. Absent source and an existing
  destination are answers, not failures.
- **`progress-note.mjs`** — one JSON line per step on stderr, so a minute-long
  install does not look hung and stdout stays clean for the caller's result.

All thirteen contract names are exported from `index.mjs`:
`runGit`, `runPnpm`, `samePath`, `pathInside`, `readSideState`, `readMarker`,
`writeMarker`, `clearMarker`, `processesUsingRoots`, `assertDisposable`,
`resolveCoreSibling`, `createWorktree`, `removeWorktree`, `copyEnvLocal`.

### Two defects found by testing

**1. `git rev-parse` walks up, so a plain directory answers for the repository
enclosing it.** Writing the core-sibling test, the "not a git checkout" case did
not fail as expected: `git rev-parse --git-common-dir` inside an ordinary
directory under the system temp directory reported a repository in the user's
home folder. The consequence is real and not confined to fixtures — a plain
`!FluxIQ/` directory left inside a Core checkout would have reported Core's own
git directory and **passed** the identity comparison the brief asked for. The
same hazard let a path one level wrong inside a worktree reach `removeWorktree`'s
delete. Both are now closed by `checkout-repository.mjs`, which requires
`rev-parse --show-toplevel` to be the directory itself before returning the
common directory, so the two questions cannot be asked apart.

**2. My own live check had a false positive.** The first end-to-end run reported
that the removed worktree was "still listed". It was not: the assertion used
`.includes("lab-ext")` and this repository already has an unrelated
`F:/fxlab/lab-ext` worktree. Re-run with an unambiguous name, the removal and
prune are correct. Recording it because the same substring trap is easy to
repeat.

### Deliberate gap: Core is not built

`createWorktree` installs both sides but does not build Core's packages. A fresh
Core worktree has no `dist/`, so `pnpm check` in the new worktree fails with
TS2307 until they are built (~1 minute, measured previously). This follows the
brief's step list exactly. The build order belongs to Core's own root `build`
script and the list of packages currently lives in
`scripts/lab/pair/command-line.mjs` (`CORE_PACKAGES`); copying it into a second
place would be the wrong fix. **The caller — `scripts/task/` — must run the Core
build after `createWorktree` returns.** This is written in `create.mjs`'s header
comment too.

### Seams added beyond the brief's signatures

All optional, all defaulted to real behaviour: `coreStartPoint` (default
`"HEAD"`), `env`, `note`, and `runInstall` on `createWorktree`; `allowRunning`
and `note` on `removeWorktree`. `runInstall` exists so the ordering and the link
check around the install can be tested without two real installs; the file says
so.

## Commands run and observed results

- `pnpm lab:test` — **before any change**: `# tests 74 / # pass 74 / # fail 0`.
  **After**: `# tests 60 / # pass 60 / # fail 0`. The 14 missing tests are the
  four test files that moved to `scripts/worktree/tests/`; they are unchanged in
  substance and all pass there. `lab:test`'s glob is
  `scripts/lab/**/tests/*.test.mjs`, which no longer reaches them. This is not a
  gap in `pnpm check`: the parallel worker's `package.json` already adds
  `task:test` = `node --test "scripts/task/tests/*.test.mjs"
  "scripts/worktree/tests/*.test.mjs"` and wires it into `check`. I did not edit
  `package.json`.
- `node --test "scripts/worktree/tests/*.test.mjs"` —
  `# tests 49 / # pass 49 / # fail 0`. That is the 14 moved plus 35 new
  (core-sibling 6, create 7, disposable-root 7, env-local 6, pnpm-command 3,
  remove 6). 60 + 14 = the original 74, all still passing.
- `node scripts/structure-audit.mjs` — `1 violation(s) across 1 rule(s)`:
  `FAIL [working-docs] docs/working/README.md is out of date with the documents'
  header blocks.` **Not mine.** `docs/working/README.md` is unmodified;
  `docs/working/agent-git-workflow-plan.md` was modified by the parallel worker,
  so the generated index no longer matches it. The audit reports **zero**
  findings naming `scripts/worktree` or `scripts/lab`, and needs no baseline
  change. Fix is `pnpm structure:baseline`, which I did not run because it would
  also regenerate a document I do not own.
- `node -e "import(...)"` on `scripts/lab/pair/index.mjs`,
  `scripts/lab/pair/command-line.mjs` and `scripts/worktree/index.mjs` — all
  link; ESM resolves named imports at link time, so this proves every rewired
  import resolves. Barrel exports printed and checked against the contract.
- `node scripts/lab/pair.mjs --ext-root <nonexistent>` — refuses cleanly with
  the expected single JSON line and usage.
- **Live end-to-end**, against a real `git worktree add --detach` of this
  repository on a different drive, with a stand-in Core checkout beside it:
  `node scripts/lab/pair.mjs --ext-root <tmp> --dry-run` printed
  `{"status":"planned", ...}` with both sides clean, `install:true` for both and
  `build:true` for Core. Then `removeWorktree` against the real repository:
  `{"removed":true,"dirtyLines":[]}`, `still listed? false`, and
  `git worktree prune -n -v` afterwards printed nothing. `git worktree list` is
  back to its original 10 entries plus the main checkout. This exercises the
  rewired `readSideState` and `processesUsingRoots` call sites and the real
  `rm -rf` + prune path. Temporary directories removed.
- `node --check` on all 25 files in the module — all parse.
- Line counts: 15 files, 662 lines, average 44, largest `create.mjs` at 107.
  `scripts/lab/pair/` averages 37 with a largest of 122, so this is in range.

## Not verified

- **No real `pnpm install` was run by `createWorktree`.** The happy path is
  tested with an injected installer that creates the same symlink pnpm would.
  The real install command string is copied verbatim from the brief but has not
  been executed from this module, and neither has the offline-then-online retry.
- **The `git worktree remove --force` failure was not re-derived.** The brief
  said it is measured and not to re-derive it; the design takes it as given.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run.** Scope was
  `scripts/`, and `pnpm check` currently fails on the docs index above, which is
  not mine to fix.
- **`lab:pair` was not run outside `--dry-run`**, so the `runPnpm({ env })` call
  sites in `command-line.mjs` were not executed against real installs and
  builds. They are compile-and-link verified and the guard rejects a missing
  `env`, but a real pair move has not been done.
- **Windows only.** `DIRECTORY_LINK` in the create test uses `junction` on
  Windows and `dir` elsewhere; the POSIX branch is untested. `listProcesses` on
  POSIX is likewise untested here.
- The parallel worker's `scripts/task/` was not read or run, so nothing
  confirms it calls these names as the brief specified — only that the names and
  the barrel exist.

## Open questions or contradictions found

1. **`pnpm lab:test` cannot still be 74.** The brief made it the regression gate
   and required 74/0, but the extraction moves 14 of those tests out of that
   command's glob by construction. Resolved as 60 + 14 = 74, with the parallel
   worker's `task:test` covering the new location inside `pnpm check`. No
   regression exists; the gate's number simply had to split.
2. **`resolveCoreSibling(extRoot)` cannot verify anything with one argument.**
   The brief requires it to prove the sibling is a worktree of "the expected Core
   repository", but the expected Core appears only in `createWorktree`'s
   parameters. Resolved with an optional second argument
   `{ coreRepositoryRoot }`; with it omitted the function resolves and reports
   but sets `verified: false`. A caller that wants the hole closed must pass it.
   **`scripts/task/` needs to know this** — calling `resolveCoreSibling(root)`
   alone gets the old `lab:pair` behaviour.
3. **Three signatures required edits beyond import lines** in
   `scripts/lab/pair/command-line.mjs` (8 lines total). Called out above; flagged
   here because it crosses the brief's stated ownership line.
4. `scripts/lab/pair/command-line.mjs` still owns `CORE_PACKAGES`, the Core
   build order. If `scripts/task/` needs to build Core — and it does, per the
   gap above — that list is about to have two consumers and should probably move
   into `scripts/worktree/` or be read from Core itself. Not done here; it was
   not in the brief and the file is not mine.
