# Core branching instructions

Added a `## Branches And Worktrees` section to FluxIQ Core's `F:\!FluxIQ\AGENTS.md`,
between `## Validation` and `## Committing And Pushing`. Purely additive: 47
insertions, 0 deletions, no other file touched.

## What I added

Six paragraphs plus a three-item tier list, covering every content requirement
in the brief:

- Isolation is per unit of work, never per agent; a branch bounds a change, not
  a worker; agent identity travels in commit trailers.
- The three tiers as a choosing rule — direct on `dev` for supervisor edits of
  at most two files, a task branch for any unit of work with a brief, a task
  branch plus its own worktree for concurrent repository-wide validation,
  experimental work, or a long build run — with the escalation trigger stated
  as validation rather than editing.
- Commands `pnpm task start <slug>`, `finish <id>`, `abandon <id>`, `list`.
- Trailers `Task: t<NNN>` and `Worker: <agent-label>`, `--no-ff` merge with
  subject `Merge task t<NNN>: <title>`, `git revert -m 1 <merge>`, never squash.
- Merge `dev` in and re-run the narrowest relevant checks before merging back.
- Core-specific: one id across both repositories, allocated downstream and
  passed as `--id t<NNN>`; Core's `pnpm task` is branch-only with no
  `--worktree` flag, and a Core worktree is created by downstream tooling
  because `domain/package.json` there links Core as a filesystem sibling.

## Where I adapted rather than copied, and why

**Dropped the link to the plan document.** Downstream's section ends its first
paragraph with a link to `docs/working/agent-git-workflow-plan.md`. Core has no
such document, and Core's `docs-links` audit rule fails a link that does not
resolve or that escapes the repository. Linking downstream's copy would have
been both broken and a boundary violation, so the paragraph ends at the trailer
sentence instead.

**Added the reason workers never commit.** Downstream says agent identity
travels in commit trailers and leaves the reason implicit. Core's voice states
the mechanism with its cause, so this reads "Workers never commit, so agent
identity travels in commit trailers rather than in a branch name."

**Dropped the entire worktree-provisioning paragraph.** Downstream devotes a
paragraph to `F:/fxwork/` versus `F:/fxlab/`, sibling Core layout, the nested
layout for Core-editing tasks, and the `git worktree remove --force` hazard.
None of it is Core's to describe, per the brief. It is replaced by a short
paragraph saying plainly that Core's tooling is branch-only and that the
worktree belongs to downstream's tooling, so nobody hunts for a `--worktree`
flag here.

**Dropped `pnpm task prune`.** Downstream's reclamation paragraph concerns
per-label test build directories and the shared Core, neither of which exists in
Core, and the brief does not list `prune` among Core's commands.

**Folded `abandon` and `list` into the task-branch bullet.** Downstream does not
document them in this section; the brief requires them in Core. Putting them on
the tier they belong to avoided a fourth bullet for two one-clause commands.

**Cross-referenced rather than restated the push rule.** The cross-repository
paragraph ends by pointing at `[Committing And Pushing](#committing-and-pushing)`
using the same in-file anchor style Core's `Start Here` already uses for
`[Repository Boundary](#repository-boundary)`, rather than repeating the
both-branches-in-one-work-unit requirement that section already carries.

**Voice.** Used "the supervisor" (Core's term) not "the senior supervisor
agent" (downstream's), and matched Core's ~76-column wrap and bold bullet
lead-ins.

## Contradiction and gap found — needs supervisor action

**Core has no `pnpm task` command at all.** This is the significant finding.
The section I was briefed to write documents four commands that do not exist in
this repository:

- `F:\!FluxIQ\package.json` has no `"task"` script. Full script list checked;
  nearest matches are `structure:*`, `docs:*`, `studio:*`, `flows:*`.
- `F:\!FluxIQ\scripts\` contains no task tooling. The only repository-wide grep
  hit for "pnpm task" or "task start/finish/abandon" is an unrelated
  `task-policy.ts` label string in Automation Studio.
- Downstream has the implementation: `"task": "node scripts/task/run-task.mjs"`
  plus `scripts/task/` with `start.mjs`, `finish.mjs`, `abandon.mjs`,
  `list.mjs`, `prune.mjs` and support modules.

So the section is currently aspirational. It documents a workflow Core cannot
execute. My brief told me both to document these commands and to "confirm it
introduces no command Core does not have" — those two instructions cannot both
be satisfied, and the brief told me to report rather than silently resolve. I
wrote the section as briefed, on the reading that the supervisor intends to port
the tooling; the section should not be committed to Core without that port, or
an agent following it will run `pnpm task start` and get a missing-script error.

**The `--id t<NNN>` flag exists in neither repository.** Downstream's
`run-task.mjs` header documents `pnpm task start <slug> [--worktree] [--core]
[--base DIR] [--from BRANCH]`. There is no `--id` option, and grepping
`arguments.mjs`, `start.mjs` and `task-id.mjs` for it returns nothing. The
cross-repository shared-id mechanism the brief specifies is therefore a design
not yet built on either side. Porting the tooling to Core will need to add it,
and downstream will need it too if the id is to be allocated there and passed.

**No contradiction with Core's existing sections.** The new section does not
conflict with `Validation` (it adds no check and reuses "the narrowest relevant
checks", Core's existing phrasing) or with `Committing And Pushing` (it defers
to that section for the cross-repository push rule and repeats none of it). The
"only the supervisor commits" rule and the trailer convention agree: trailers
are written by the supervisor on the worker's behalf, which is why identity
needs a trailer rather than a branch.

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule docs-links` in Core →
  `structure-audit: passed (0 warning(s), 0 baselined).`
- `git status --porcelain` in Core → ` M AGENTS.md` only.
- `git diff --stat` in Core → `1 file changed, 47 insertions(+)`.
- `grep -c $'\r$' AGENTS.md` → `0` of 312 lines; the file was already uniformly
  LF and stayed that way. Git's "LF will be replaced by CRLF" notice is
  autocrlf on checkout, not mixed endings introduced here.

## Not verified

- Did not run `pnpm check`, `pnpm test` or `pnpm build` in Core. The change is
  one prose section in a root Markdown file; the only gate that could plausibly
  fail is the link rule, which I ran directly. `AGENTS.md` is outside
  `docsLinkDirs: ["docs"]`, so its links are in fact not checked at all — I ran
  the rule to confirm I broke nothing elsewhere, and kept the link in-file and
  inside the repository regardless.
- Did not verify the anchor `#committing-and-pushing` renders on the user's
  Markdown viewer; it follows the GitHub slug convention and matches the
  existing `#repository-boundary` usage in the same file.
- Did not commit, per the brief.
- Did not read Core's `docs/working/` beyond listing it for a git-workflow
  document, so I cannot say whether a Core-side plan document should exist and
  be linked once the tooling lands.
