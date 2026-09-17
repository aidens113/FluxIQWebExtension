# Core task tooling

Worker report. `pnpm task` built in FluxIQ Core at `F:\!FluxIQ`, mirroring the
downstream implementation but carrying the branch lifecycle only.

## Outcome

Done. Fourteen new modules and three test files under `F:\!FluxIQ\scripts\task\`,
plus two script entries in `F:\!FluxIQ\package.json`. No `scripts/worktree/`
directory was created: the primitives Core needs are small enough to live in
`scripts/task/`, as the brief preferred. Nothing was committed, no branch was
created in Core, and no merge was run.

## Command surface

```
pnpm task start <slug> [--id t<NNN>] [--from BRANCH] [--dry-run]
pnpm task finish <id> [title words...] [--skip-checks] [--dry-run]
pnpm task abandon <id> [--force] [--dry-run]
pnpm task list [--dry-run]
```

Every command prints one JSON object on stdout and everything a person reads on
stderr. Every refusal is decided before anything is mutated. Unknown flags are
refused, and so is a known flag aimed at the wrong command.

This matches the contract already written into Core's `AGENTS.md` under
*Branches And Worktrees* (lines 239-285, modified by another worker while this
task ran): branch-only, `task/t<NNN>-<slug>` off `dev`, `--no-ff` back with the
subject `Merge task t<NNN>: <title>`, and the id allocated downstream and passed
here with `--id`.

### Files

| File | Exports | Role |
| --- | --- | --- |
| `run-task.mjs` | — | Entry point; resolves the repository from its own location |
| `index.mjs` | barrel | Directory barrel |
| `arguments.mjs` | `parseTaskArguments` | Command line, per-command flag rules |
| `command-line.mjs` | `runTaskCommandLine` | Dispatch, extra-positional refusal |
| `branch-name.mjs` | `taskBranchName`, `parseTaskBranch` | Slug validation, branch round trip |
| `task-id.mjs` | `chooseTaskId`, `allocateTaskId` | Id policy, including the `--id` seam |
| `locate.mjs` | `locateTask`, `listWorktrees`, `branchCheckedOutElsewhere` | Finding a task and where it is checked out |
| `list.mjs` | `listTasks` | Open tasks with drift from `dev` |
| `start.mjs` | `startTask` | Opening a task branch |
| `finish.mjs` | `finishTask` | Integrate, validate, merge, delete |
| `abandon.mjs` | `abandonTask` | Discarding a task |
| `git-command.mjs` | `runGit` | Primitive, copied from downstream |
| `path-identity.mjs` | `samePath` | Primitive, copied from downstream (Windows path identity) |
| `dirty-lines.mjs` | `dirtyLines` | Uncommitted and untracked lines in a checkout |
| `check-command.mjs` | `runCheck` | Runs Core's own `pnpm check` |
| `progress-note.mjs` | `noteTaskProgress` | One JSON progress line per step, on stderr |

## Where this deliberately diverges from downstream, and why

**1. No worktree provisioning, and no `--worktree`, `--core`, `--base`,
`--allow-running` or `prune`.** Per the brief and per Core's AGENTS.md: a
Core-paired task's Core worktree is created by the downstream tooling, because
`domain/package.json` links Core as a filesystem sibling and the layout is
therefore downstream's to decide. Nothing from `roots.mjs`, `create.mjs`,
`remove.mjs`, `core-sibling.mjs`, `prune.mjs`, `scratch-roots.mjs`,
`stale-directories.mjs` or `orphaned-cores.mjs` was ported.

**2. `--id` is new, and the id policy is stricter than downstream's.**
Downstream's `nextTaskId` only ever allocates. Core's `chooseTaskId` also
validates a handed-in id against everything already used — open `task/t<NNN>-`
branches *and* the subjects of `Merge task t<NNN>:` commits already in `dev` —
and refuses a collision by naming what holds the number. Two further rules:
numbers are compared as numbers, so `t0042` cannot slip past `t042`; and the
spelling is pinned to the canonical three-digit form, so an id that names one
unit of work is also written one way in both repositories. `t42` and `T042` are
refused outright rather than guessed at.

**3. `start` always refuses a dirty tree.** Downstream refuses only when not
using a worktree, because `--worktree` is its escape hatch. Core has none, so
the refusal is unconditional, and its wording says so.

**4. Refusals for a branch checked out in another worktree.** Core is checked
out four times on this machine (`F:/!FluxIQ` plus three detached Lab worktrees
under `F:/fxlab`), and a Core-paired task adds a fifth beside the downstream
worktree. git will not let two worktrees stand on one branch. So `finish` and
`abandon` refuse up front, before any mutation, when the task branch is checked
out elsewhere, and `finish` refuses when the *integration* branch is checked out
elsewhere — naming the checkout to run in instead. Downstream has no equivalent
check for the branch case; its own `finish` only compares HEAD when a worktree
is involved.

**5. `abandon` switches off the branch before deleting it.** Downstream's
`abandonTask` calls `git branch -D` while the main checkout may still be
standing on that branch, which git refuses. In Core that is the ordinary case
rather than an edge one, because there is no worktree to abandon a task from the
outside, so `abandon` moves to the integration branch first. It refuses when the
tree is dirty in that case and only that case, since the switch would otherwise
carry the changes onto `dev`. **This is a latent bug in the downstream
implementation** and is worth fixing there.

**6. A known flag on the wrong command is refused, and so is an extra
positional.** Downstream's parser has one global flag set, so `pnpm task finish
t042 --worktree` parses cleanly and silently does nothing with the flag. Core's
parser knows which flags each command takes and says which command a misplaced
flag belongs to. `finish` is exempt from the extra-positional rule, because
everything after the id is the merge subject.

**7. `pnpm check` inherits the environment unchanged.** Downstream strips
provider secrets before running pnpm, because it is installing worktrees. Core's
`finish` runs no install and reaches no network; the point of that step is to
reproduce exactly what a person typing `pnpm check` in that checkout would get,
so the environment is left alone. Core has no `provider-secret-environment.mjs`
and none was added.

**8. Progress notes.** `finish` runs Core's whole `pnpm check` between two
merges and can sit for minutes, so each mutating step writes one JSON line to
stderr (`{"scope":"task","step":"integrate",...}`). Downstream's task commands
write no progress of their own.

## Commands run and observed results

**New tests — `pnpm task:test` in `F:\!FluxIQ`:** `# tests 20 / # pass 20 /
# fail 0 / # duration_ms 73.7191`. The three files cover branch-name
construction and parsing (including nine slugs that must be refused), id
allocation and the `--id` path (collision against an open branch and against a
merged subject, padding, and six malformed spellings), and argument parsing
(unknown flag, misplaced flag, value flags refusing to swallow the next flag,
`finish` keeping its title words).

**`pnpm task list` in `F:\!FluxIQ`:** `{"command":"list","tasks":[]}`, exit 0.
Core has no `task/*` branches and no `Merge task` subjects yet, so the first
allocation would be `t001`.

**`pnpm task start probe --dry-run` and `pnpm task start probe --id t099
--dry-run` in `F:\!FluxIQ`:** both exit 1 with

```
F:\!FluxIQ has 3 uncommitted or untracked change(s) (M AGENTS.md; M package.json;
?? scripts/task/); commit, stash or discard them before opening a task branch.
This checkout is the only place a Core task runs.
```

That is requirement 4 firing correctly on this checkout's own pending work
(`AGENTS.md` was modified by another worker, `package.json` and `scripts/task/`
are mine). It also confirms pnpm forwards the flags: the echoed command line was
`node scripts/task/run-task.mjs "start" "probe" "--id" "t099" "--dry-run"`.

Because that refusal masks the happy path, the same dry runs were repeated
against a **disposable shallow clone of Core `dev`** in the session scratchpad
(`git clone --depth 5 --single-branch --branch dev`), with `scripts/task/` copied
in and listed in that clone's `.git/info/exclude` so its tree read clean. The
clone and a scratch worktree of it were deleted afterwards; `F:\!FluxIQ` was
confirmed unchanged (same four worktrees, branches `dev` and `main`, same
modified files). Observed, verbatim:

```
### start probe --dry-run
{"command":"start","id":"t001","branch":"task/t001-probe","from":"dev",
 "startPoint":"1be6c9ed0960d240a5aa4fe05fe1e21b2e223c51","allocated":true,"applied":false}
### start probe --id t099 --dry-run
{"command":"start","id":"t099","branch":"task/t099-probe","from":"dev",
 "startPoint":"1be6c9ed0960d240a5aa4fe05fe1e21b2e223c51","allocated":false,"applied":false}
### start probe --id t42 --dry-run
"t42" is not a task id: an id is the letter t and at least three digits, for example "t042".
### start probe --id t0099 --dry-run
Task t0099 is written differently here and downstream, which defeats the point of
sharing an id: write it t099.
### start Bad_Slug --dry-run
"Bad_Slug" is not a usable task slug: use lower-case words joined by single hyphens...
### start probe --from nosuchbranch --dry-run
"nosuchbranch" does not name a commit in <clone>, so a task cannot branch off it.
### start probe extra --dry-run
"start" takes 1 argument(s), but was given 2 (probe, extra). pnpm task start <slug> ...
### start probe --dry-runn
--dry-runn is not a flag of "start". pnpm task start <slug> [--id t<NNN>] [--from BRANCH],
and every command takes --dry-run.
### prune
Unknown command "prune". Use start, finish, abandon, list.
```

With a `task/t099-taken` ref created in the clone (a ref only — no commit):

```
### list
{"command":"list","tasks":[{"id":"t099","slug":"taken","branch":"task/t099-taken",
 "checkedOutIn":null,"ahead":0,"behind":0}]}
### start other --id t099 --dry-run
Task t099 is taken by the open branch task/t099-taken. A shared id names one unit
of work; allocate a new one downstream and pass that.
### start other --dry-run
{"command":"start","id":"t100",...}                     <- allocation cleared the open branch
### finish t099 Probe the shared id --dry-run
{"command":"finish","id":"t099","branch":"task/t099-taken","into":"dev","head":"dev",
 "merge":"Merge task t099: Probe the shared id",
 "validation":{"ran":false,"command":"pnpm check","reason":"--dry-run"},"applied":false}
### finish t099 --dry-run --skip-checks
{... "merge":"Merge task t099: taken",
 "validation":{"ran":false,"command":null,"reason":"--skip-checks"},"applied":false}
### abandon t099 --dry-run
{"command":"abandon","id":"t099","branch":"task/t099-taken","unmerged":0,"leaves":"dev",
 "applied":false}
```

With that branch also checked out in a second worktree of the clone, `list`
reported `"checkedOutIn":"<worktree>"`, and `finish` and `abandon` refused with
the detach instruction. Run from *inside* that worktree, `finish` refused with
`dev is checked out in <clone>, not in <worktree>, so this checkout cannot merge
into it. Run finish in <clone>.` and `abandon` with `there is nowhere here to
move to before the branch is deleted`.

**Core's `pnpm check` in `F:\!FluxIQ`: exit 0.** `structure-audit: passed (160
warning(s), 361 baselined)`, then `tsc --noEmit` Done for `packages/contracts`,
`packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web`. One of
the 160 advisory warnings is mine: `[directory-files] scripts/task/: 16 source
files is past the 15-file advisory threshold` — advisory only; the hard limit is
25, and downstream's `scripts/task/` sits at 18.

## Not verified

- **No real lifecycle was executed.** `start` never created a branch, `finish`
  never merged, `abandon` never deleted. Every live exercise used `--dry-run`,
  per the brief, and a pre-commit hook blocks workers from committing, so even
  the disposable clone could not be driven through a real `finish`. The merge,
  check, and delete sequence inside `finishTask` past the `dryRun` return is
  therefore **unexercised code**: it is a faithful transcription of the
  downstream implementation, which is proven end to end, but it has not run here.
- **`--skip-checks` and the `pnpm check` failure path** were observed only in
  their dry-run reporting. `runCheck` has never been spawned.
- **The `--id` cross-repository seam has not been exercised across both
  repositories.** It was proven only within Core: an id passed in is honoured,
  and a colliding one is refused.
- **Id allocation against merged history was tested only as a unit.**
  `chooseTaskId` is covered, but no Core history yet contains a
  `Merge task t<NNN>:` subject, so `allocateTaskId`'s history scan has never
  seen a real match.
- **`pnpm check` was run once**, with another worker concurrently editing
  `packages/fluxiq/src/programs/automation-studio/runtime/tests/live-patch.test.ts`
  (it grew from 591 to 640 lines between the audit run and the check run) and
  `AGENTS.md`. It passed, but it was reading a tree someone else was writing.
- **No documentation was written.** Core's `AGENTS.md` already describes this
  command surface, and the brief scoped me out of every file but
  `scripts/task/*` and `package.json`.

## Open questions for the supervisor

1. **`task:test` is not wired into `pnpm check`.** Downstream's `check` runs
   `pnpm structure:test && pnpm lab:test && pnpm task:test && ...`; Core's still
   runs `pnpm structure:test && node scripts/structure-audit.mjs && pnpm -r
   check`. The brief said to add the two script entries only, so I did not touch
   `check`. Given the standing preference for enforcing things mechanically, I
   recommend changing Core's `check` to
   `pnpm structure:test && pnpm task:test && node scripts/structure-audit.mjs &&
   pnpm -r check`. It is a one-line edit and the tests run in 74ms.
2. **Downstream's `abandonTask` should get divergence 5** — switching off the
   branch before deleting it. As it stands, `pnpm task abandon <id>` in the
   downstream main checkout fails with git's own "Cannot delete branch checked
   out at" whenever the task was worked on there without a worktree, which is
   the common case.
3. **Downstream's parser should get divergence 6** if the two are to stay
   mirrored: `pnpm task finish t042 --worktree` currently parses and ignores.
