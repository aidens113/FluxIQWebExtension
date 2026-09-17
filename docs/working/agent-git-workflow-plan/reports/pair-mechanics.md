# How `pnpm lab:pair` works, and what an authoring workflow can reuse

Read-only study of the Testing Lab worktree pair. Nothing was modified and no
worktree was created. All line references are to files as of 2026-09-17.

`pnpm lab:pair` is `node scripts/lab/pair.mjs` (`package.json:53`). The entry
point is 36 lines (`scripts/lab/pair.mjs:34-36`); all work is in
`scripts/lab/pair/`, whose barrel `index.mjs:14-21` names the responsibility of
each module.

One thing to know before the rest: **`pnpm lab:pair` never creates a worktree.**
It only *moves* a pair that already exists, and refuses with
`create it with git worktree add --detach` when the extension root is not
already a worktree of this repository (`pair/command-line.mjs:110`). Creation,
Core-side worktree creation, and removal are all manual today. That is the
largest single gap an authoring workflow has to fill.

## 1. The exact command sequence

Two phases. Every refusal is decided in the read phase, before anything changes
(`pair/command-line.mjs:5`, `:45-63`).

### Read phase (nothing is changed)

1. Resolve roots - no commands, one file read of
   `<extRoot>/domain/package.json` (`pair/roots.mjs:18-35`, called at
   `pair/command-line.mjs:48`).
2. Identity of the extension worktree (`pair/command-line.mjs:105-111`), two
   commands run concurrently:
   - `git -C F:\!FluxIQWebExtension rev-parse --path-format=absolute --git-common-dir`
   - `git -C <extRoot> rev-parse --path-format=absolute --git-common-dir`
3. Per side, concurrently for core and ext (`readSideState`,
   `pair/side-state.mjs:13-22`; dispatched at `pair/command-line.mjs:50-53`).
   In source order within a side:
   - `git -C <root> rev-parse --show-toplevel`
   - `git -C <root> rev-parse --verify HEAD`
   - `git -C <root> rev-parse --verify --quiet <target>^{commit}` - only when
     `--ext`/`--core` named a revision for that side; omitted otherwise, and the
     side's target becomes its current HEAD (`side-state.mjs:18`)
   - `git -C <root> status --porcelain=v1 --untracked-files=normal`
   - `git -C <root> rev-parse --verify <resolvedCommit>:pnpm-lock.yaml`

   Plus `realpath()` on the root and toplevel, `stat()` on each Core `dist`
   directory, and reads of the two marker files (section 4).

   Every git invocation goes through `runGit` (`pair/git-command.mjs:7-13`),
   which is `execFile("git", ["-C", root, ...args])` - no shell, so a revision
   is never word-split; `arguments.mjs:5` additionally rejects any revision that
   is not `/^[A-Za-z0-9._/@{}^~][A-Za-z0-9._/@{}^~-]{0,199}$/`.

4. Decide the plan per side (`planSideMove`, `pair/move-plan.mjs:17-32`), then
   collect refusals (`command-line.mjs:55-56`).
5. If anything would move and `--allow-running` was not passed, enumerate
   processes (`command-line.mjs:57-63`). On Windows that is one command:
   `powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress"`
   (`pair/process-list.mjs:10,16`); elsewhere `ps -Ao pid=,ppid=,args=`
   (`process-list.mjs:25`).

With `--dry-run` the run stops here and prints `{"status":"planned",...}`
(`command-line.mjs:64,71`).

### Write phase

Plans are applied **sequentially, Core first, then ext** - the array is built
`[core, ext]` at `command-line.mjs:54` and consumed by
`for (const plan of plans) await applyPlan(plan)` at `:65`. Per side
(`applyPlan`, `command-line.mjs:76-93`), in this order:

1. **Checkout** (only when `plan.to !== plan.from`):
   `git -C <root> checkout --detach <resolvedCommit>` (`command-line.mjs:80`)
2. **Install** (only when the target lockfile blob differs from the installed
   marker): delete the install marker, then in `cwd = <root>`:
   - `pnpm install --frozen-lockfile --config.confirm-modules-purge=false --offline`
   - if that exits non-zero, retry **without** `--offline`:
     `pnpm install --frozen-lockfile --config.confirm-modules-purge=false`
     (`command-line.mjs:35,95-103`; the offline-first attempt exists so a
     lockfile already satisfied by the pnpm store needs no network)
   - then write the install marker.
3. **Build** - Core side only (`buildable: true` is passed only for core,
   `command-line.mjs:51-52`; `move-plan.mjs:30`). Delete the build marker, then
   three commands in `cwd = <coreRoot>`, serially, in Core's own build order
   (`command-line.mjs:30-34,90`):
   - `pnpm --filter @fluxiq/contracts build`
   - `pnpm --filter fluxiq build`
   - `pnpm --filter @fluxiq/client-gateway-websocket build`
   - then write the build marker.

   The extension side is deliberately never built here: the Lab rebuilds it on
   every run (`pair/tests/move-plan.test.mjs:31-35`).

4. After both sides: **verify the link lands in the pair's Core** -
   `realpath(<extRoot>/domain/node_modules/fluxiq)` must be inside `<coreRoot>`
   (`requireCoreLink`, `command-line.mjs:113-118`, called at `:66`).

Every `pnpm` runs through `runPnpm` (`pair/pnpm-command.mjs:7-16`),
`spawn("pnpm", args, { cwd: root, stdio: ["ignore", 2, 2], shell: win32 })`, so
pnpm output goes to stderr and stdout stays a single machine-readable line. The
environment handed to pnpm is
`{ ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" }`
(`command-line.mjs:77`): every provider API key listed in
`scripts/provider-secret-environment.mjs:2-8` is stripped from installs and
builds, and workspace builds are serialized for this machine's memory.

Finally it prints one JSON line
(`{"status":"ready"|"planned", pair, environment, providerKey}`) on stdout,
followed by the bash instructions block (`command-line.mjs:68-73`). Progress
lines are JSON on stderr, tagged `{"lab":"pair",...}` (`command-line.mjs:120-122`).

## 2. Where the pair lives, and why the layout is forced

Default extension worktree:
`path.resolve(extRoot ?? path.join(repositoryRoot, "..", "fxlab", "lab-ext"))`
(`pair/roots.mjs:19`) - i.e. **`F:\fxlab\lab-ext`**, overridable with
`--ext-root DIR`. `repositoryRoot` is derived from the script's own location,
`path.resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")`
(`scripts/lab/lab-instance.mjs:20`).

The Core worktree is **not** a separate option and **not** `FLUXIQ_CORE_ROOT`.
It is read out of the extension worktree's own `domain/package.json`
(`pair/roots.mjs:21-32`):

```js
const spec = manifest?.dependencies?.fluxiq;          // "link:../../!FluxIQ/packages/fluxiq"
const packageDir = path.resolve(ext, "domain", match[1]);
if (path.basename(packageDir) !== "fluxiq" || path.basename(path.dirname(packageDir)) !== "packages") { ... }
const core = path.dirname(path.dirname(packageDir));
```

`domain/package.json:24` is `"fluxiq": "link:../../!FluxIQ/packages/fluxiq"`, so
from `<ext>/domain` the link goes up two levels - to the **parent of the
extension worktree** - and then into `!FluxIQ`. The relative layout is therefore
forced to be:

```
<parent>/
  <ext worktree>/      e.g. lab-ext, fxlab-16ff729, verify-ext
  !FluxIQ/             the Core worktree, named exactly "!FluxIQ"
```

`git worktree list` on both repositories confirms this is how it is actually
used: `F:/fxlab/lab-ext`, `F:/fxlab/fxlab-16ff729`, `F:/fxlab/verify-ext` and
six more extension worktrees all sit beside the single Core worktree
`F:/fxlab/!FluxIQ` (plus `F:/fxlab/lab-core` and `F:/fxlab/verify-core`, Core
worktrees that only an ext worktree placed in a directory of its own can reach).

The reason the layout cannot be relaxed is stated at `pair/roots.mjs:3-6`: that
`link:` - not an environment variable - is what decides which Core the domain
build and the web-panel host actually import. `campaign-environment.mjs:5-6`
says the same from the other side: `FLUXIQ_CORE_ROOT` is exported only because
"from the pair the default already lands there; setting it says so outright."
`requireCoreLink` (`command-line.mjs:113-118`) then proves it after installing,
by resolving the real path of `<extRoot>/domain/node_modules/fluxiq`.

Note the consequence for an authoring workflow: an extension worktree created at
`F:\fxlab-147fdb4` (a real one exists) resolves Core to `F:\!FluxIQ`, the
working Core checkout, and `pnpm lab:pair` refuses it outright (see section 3).

## 3. Repository identity and dirty refusals

**Belongs to this repository** - `requireWorktreeOfThisRepository`
(`pair/command-line.mjs:105-111`) compares
`git rev-parse --path-format=absolute --git-common-dir` from this checkout with
the same from the candidate, using the Windows-aware `samePath`. Mismatch:
`"<extRoot> is not a worktree of <repositoryRoot> (its repository is <theirs>); create it with git worktree add --detach"`.
This checks **only the extension side**; the Core side is never proven to be a
worktree of Core, only to be the top of *some* git checkout.

Three weaker structural checks back it up:
- `<extRoot>/domain/package.json` must exist and parse, else
  `"<ext> is not a checkout of this repository"` (`roots.mjs:22-24`).
- Its `dependencies.fluxiq` must be a `link:` spec ending in
  `<core>/packages/fluxiq` (`roots.mjs:25-31`).
- `git rev-parse --show-toplevel` must equal the root after `realpath()` on both
  sides, so a subdirectory, a junction or an 8.3 short name is caught
  (`side-state.mjs:14-16`): `"The <side> side <root> is not the top of a git checkout"`.

**Dirty refusal** - `readSideState` runs
`git status --porcelain=v1 --untracked-files=normal` and keeps every non-blank
line (`side-state.mjs:21,29`). `planSideMove` turns any non-empty list into a
refusal string naming the count and the first three lines
(`pair/move-plan.mjs:18-20`):

> `The core worktree F:/fxlab/!FluxIQ has 4 uncommitted or untracked change(s) ( M domain/src/a.ts; ?? notes.txt; D b.ts). The pair is never edited: commit, stash or remove them first.`

Both sides' refusals are collected and thrown together before any command runs
(`command-line.mjs:55-56`). Untracked files count; git-ignored files do not
(`pair/tests/side-state.test.mjs:72-81`). There is **no** `--force` or
`--allow-dirty` escape - dirty is unconditional.

## 4. Marker files written into ignored space

`pair/markers.mjs:9-15`, two files, both directly inside the worktree's
`node_modules/` (ignored by `.gitignore:1`):

| Kind | Exact path | Value written |
| --- | --- | --- |
| install | `<root>/node_modules/.lab-pair-installed-lock` | the git blob hash of `pnpm-lock.yaml` **at the target commit**, from `git rev-parse --verify <commit>:pnpm-lock.yaml` (`side-state.mjs:22`) |
| build | `<root>/node_modules/.lab-pair-built-commit` | the Core commit the three packages were last built at (`command-line.mjs:91`) |

The install marker is written on whichever side installed - so it exists in both
the ext worktree and the Core worktree. The build marker only ever exists in
Core: the ext side passes `buildable: false`, so `builtCommit` is not even read
(`side-state.mjs:33`).

The discipline that makes them safe is at `markers.mjs:3-5` and
`command-line.mjs:83-85,89-91`: **clear before the step, write only after it
succeeded**. A move interrupted halfway leaves no marker, so simply re-running
finishes it (`move-plan.mjs:6-8`; `pair/tests/move-plan.test.mjs:21-24`). An
unreadable marker is an error, never silently `null`
(`markers.mjs:20-24`; `pair/tests/markers.test.mjs:29-39`).

Decision rules (`move-plan.mjs:28-30`):
- `checkout` when `target !== head`
- `install` when `installedLock !== targetLock`
- `build` when `buildable && (forceBuild || builtCommit !== target || !distPresent)`

`distPresent` is a `stat()` of
`<coreRoot>/packages/{contracts,fluxiq,client-gateway-websocket}/dist`
(`command-line.mjs:51`, `side-state.mjs:23`), so a marker claiming a build whose
output someone deleted does not stop a rebuild.

## 5. The provider key for a fresh worktree

`pnpm lab:pair` **never copies, writes or reads the value of a secret.** It only
reports where a live run *would* find one, by name
(`pair/provider-key.mjs:1-27`). The search follows the runner's own order
(`packages/test-runner/src/live-llm/provider-credential.ts`, cited at
`provider-key.mjs:3-5`):

1. `process.env.DEEPSEEK_API_KEY`, non-blank - source `"the process environment"`
2. `<extRoot>/.env`
3. `<extRoot>/.env.local`

A file counts only if it holds an actual assignment -
`/^\s*(?:export\s+)?DEEPSEEK_API_KEY\s*=\s*["']?[^\s"'#]/m` (`provider-key.mjs:14`)
- so `DEEPSEEK_API_KEY=`, `DEEPSEEK_API_KEY=""` and a commented line do not count
(`pair/tests/provider-key.test.mjs:40-47`). The returned object carries
`{ name, found, source }` or `{ name, found, searched }`, and the tests assert
the value never appears in it (`provider-key.test.mjs:25,33`).

A fresh worktree has no `.env.local`, so the printed instructions say so plainly
and give the human both remedies (`pair/instructions.mjs:22-26`):

```
# DEEPSEEK_API_KEY: NOT reachable from the pair (searched the process environment, .../.env, .../.env.local), so a live campaign would be refused.
#   Export it in the shell that starts the campaign, or copy .env.local from the working checkout into <extRoot>:
#   git ignores that file, and with FLUXIQ_TEST_ENV_FILES=none the Lab takes only that one name from it.
```

`FLUXIQ_TEST_ENV_FILES=none` (`campaign-environment.mjs:19`) means the run takes
*no* target configuration from an env file; the provider key is the one name
still read by that path. Copying `.env.local` in is therefore a manual,
deliberate act, and `.gitignore:10` keeps it out of the worktree's status.

## 6. Lab-specific versus general worktree lifecycle

**Genuinely Lab-specific (do not reuse):**

- **Core package builds.** `CORE_PACKAGES` and the three `pnpm --filter ... build`
  commands (`command-line.mjs:30-34,90`) exist because a Lab run reads Core's
  `dist`. An authoring worktree wants a typecheck/test build of *this*
  repository, not Core's three packages.
- **`--instance` and `FLUXIQ_LAB_INSTANCE`.** `scripts/lab/lab-instance.mjs:30-55`
  maps a label to `apps/extension/.lab-instances/<label>/`,
  `apps/scenario-lab/.lab-instances/<label>/dist`, and a per-instance host
  bundle. It exists so concurrent browser runs cannot delete each other's build
  output, and so the tracked `apps/extension/build/` is not rewritten - which
  would make the pair dirty and block the next move
  (`campaign-environment.mjs:8-11`). An authoring worktree that runs
  `pnpm check`/`pnpm test` and commits has no such concern; if it ever runs a
  browser build it inherits the same problem and should reuse this rather than
  reinvent it.
- **`scripts/lab/build-lock.mjs`.** A repository-wide lock at
  `<root>/.lab-locks/build.lock` (`lab-instance.mjs:54`) serializing the *build
  phase* of concurrent Lab instances writing shared `dist/`
  (`build-lock.mjs:1-13`). It waits rather than failing, reclaims a lock whose
  pid is gone or whose record is unreadable, and defaults to a 45-minute timeout
  (`build-lock.mjs:28-30,49-52`). Only relevant if two authoring worktrees build
  shared output in one checkout - they do not: each worktree has its own tree.
- **`scripts/lab/core-build-watch.mjs`.** Guards against Core's build deleting
  `dist` files mid-run, by scanning `<core>/packages/*/dist` mtimes before and
  after (`core-build-watch.mjs:77-91,141-163,176-180`). Purely a runtime-race
  guard for long browser runs, and it deliberately never refuses to run
  (`:34-36`). Its header (`:14-36`) records why a lock inside Core was rejected:
  a bench holds it for hours while a Core build takes minutes. Not applicable to
  authoring.
- **The bash instructions block** (`instructions.mjs:19-40`) and
  `campaignEnvironment` (`campaign-environment.mjs:15-21`) are Lab campaign
  ergonomics, though the *pattern* - print exactly the commands to run in the
  new worktree, absolute and single-quoted for bash - is worth copying.

**General worktree lifecycle, reusable close to unchanged:**

- `pair/path-identity.mjs` (whole file, 21 lines) - `samePath` / `pathInside`
  with Windows case- and slash-insensitivity. Zero Lab content.
- `pair/git-command.mjs` - `execFile`-based `runGit(root, args)` with `-C`, no
  shell, trailing-newline-only trim so a porcelain line keeps its leading space.
- `pair/pnpm-command.mjs` - `runPnpm(root, args, env)` with output to stderr.
- `pair/arguments.mjs:5,42-45` - the revision allowlist. Any workflow passing a
  user string to git needs exactly this.
- `pair/side-state.mjs` - HEAD, resolved target, porcelain status, target
  lockfile blob. Entirely generic; only `buildable`/`distPaths` are Lab inputs
  and both are already parameters.
- `pair/markers.mjs` plus the `install` half of `pair/move-plan.mjs` - "install
  only when the lockfile blob at the target commit differs from what was
  installed here", with clear-before/write-after. Generic; an authoring worktree
  wants precisely this and can drop the `build`/`distPresent` fields.
- The install command itself:
  `pnpm install --frozen-lockfile --config.confirm-modules-purge=false`, offline
  first with a non-offline retry (`command-line.mjs:35,95-103`).
- `pair/process-list.mjs` plus `pair/processes-using-roots.mjs` - "is anything
  running inside this directory", including the ancestor walk that excludes the
  asking process and its parents, and the cycle guard
  (`processes-using-roots.mjs:19-23`; `tests/processes-using-roots.test.mjs:34-37`).
- `withoutProviderSecrets` from `scripts/provider-secret-environment.mjs` for any
  spawned build or install.
- The shape of the whole command: decide everything first, refuse before
  changing anything, one JSON line on stdout, progress on stderr, a `--dry-run`
  that stops after planning.

**Missing from the Lab pair, needed by an authoring workflow:** creation
(`git worktree add --detach`, plus the sibling Core worktree), branch-based
(non-detached) checkout, removal and pruning, and anything that commits or
pushes. `pair.mjs` assumes the worktrees exist and are read-only mirrors.

## 7. Refusal and safety rules an authoring workflow should also enforce

1. **Never the checkout you are running from.** `roots.mjs:20` -
   `samePath(ext, repositoryRoot)` gives
   `"The pair must be a separate checkout, but <ext> is the checkout this script runs from"`,
   with the Windows-spelling test at `tests/roots.test.mjs:21-24`.
2. **Never another agent's working checkout.** `roots.mjs:33-34` refuses when the
   resolved Core is `<repositoryRoot>/../!FluxIQ`:
   `"The pair's Core side would be <core>, the working Core checkout; place the extension worktree where its ../!FluxIQ is a Core worktree of its own"`.
   An authoring workflow needs the same rule in both directions: never move
   `F:\!FluxIQWebExtension` or `F:\!FluxIQ` on someone's behalf.
3. **Prove the worktree belongs to this repository** before acting on it -
   `--git-common-dir` equality (`command-line.mjs:105-111`), not a name guess.
4. **Refuse on any uncommitted or untracked change**, naming a few, on *every*
   side, with no override flag (`move-plan.mjs:18-20`). Untracked counts.
5. **Refuse while a process is working inside the worktree.**
   `command-line.mjs:57-63` lists processes whose command line names a path
   *below* a root, excludes self and ancestors, reports up to five by name and
   pid, and requires an explicit `--allow-running` to proceed. The check runs
   only when something would actually move. A listing that cannot be read is an
   error, never an empty list - "an empty list would read as 'nothing is running
   in the pair'" (`process-list.mjs:3-4`).
6. **Start child processes by absolute path** so they are attributable to a
   worktree in the process list. `instructions.mjs:5-10` explains that
   `pnpm lab:campaign` appears only as `node scripts/lab/live-campaign.mjs`,
   naming no checkout, so rule 5 could not see it.
7. **Decide every refusal before changing anything** (`command-line.mjs:5`), and
   offer a `--dry-run` that prints the plan and exits.
8. **Validate every argument that reaches git** against a strict pattern, and
   never through a shell (`arguments.mjs:5,42-45`; `git-command.mjs:9`).
9. **Strip provider secrets from every spawned install and build**
   (`command-line.mjs:77`), and report a key by source, never by value
   (`provider-key.mjs:6-7`).
10. **Verify the post-condition rather than assuming it.** After install,
    `requireCoreLink` resolves the real path of the `fluxiq` link and fails if it
    does not land inside the pair's Core (`command-line.mjs:113-118`). An
    authoring workflow should likewise assert its worktree's links point where
    intended before reporting success.
11. **Never write a completion marker before the step completed**
    (`markers.mjs:3-5`), so an interrupt costs a redo and never a false claim.
12. **Write only into ignored space.** Markers live in `node_modules/`, instance
    output in `.lab-instances/`, locks in `.lab-locks/` - all in `.gitignore`
    (lines 1, 32, 33), so the worktree stays clean and rule 4 keeps working.

## Files read

`scripts/lab/pair.mjs`;
`scripts/lab/pair/{index,arguments,roots,path-identity,git-command,pnpm-command,command-line,side-state,markers,move-plan,campaign-environment,instructions,provider-key,process-list,processes-using-roots}.mjs`;
all nine files under `scripts/lab/pair/tests/`;
`scripts/lab/{lab-instance,build-lock,core-build-watch}.mjs`;
the directly imported `scripts/provider-secret-environment.mjs`;
plus `package.json` (script name), `.gitignore` and `domain/package.json` for
the exact lines the code above depends on.
