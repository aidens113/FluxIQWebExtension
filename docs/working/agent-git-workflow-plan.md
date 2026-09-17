# Agent Git Workflow

Status: Active
Status detail: Design settled for tiering, naming, provenance and merge policy; four measured inputs (pair mechanics, orchestrator gap, worktree cost, generated-output conflicts) are in flight and the sections marked PENDING depend on them.
Created: 2026-09-17
Last updated: 2026-09-17
Owner: Senior supervisor agent
Scope: How work reaches `dev` in this repository when several agents run at once — when a unit of work gets its own branch, when it also gets its own worktree, how a worktree is paired with FluxIQ Core, how provenance survives the fact that workers never commit, and what tooling makes the correct path the cheap one. It deliberately does not introduce pull requests, review gates on `dev`, or any change to what `pnpm check`, `pnpm test` and `pnpm build` mean.
Paired document: none yet — a Core-side document is required only if Core adopts the paired-branch half of this (see Open Questions).
Related: [AGENTS.md](../../AGENTS.md), [Agent Working Document Protocol](./agent-working-doc-protocol.md), [Repository layout and commands](../architecture/repository-layout.md)

---

## Current State

Nothing is implemented yet. This document records the design and the evidence
behind it.

Today every agent works in the single checkout at `F:\!FluxIQWebExtension` on
the `dev` branch. Workers edit that shared working tree and never commit; the
supervisor commits and pushes. There are no authoring branches. The only
branches that exist are `dev`, `main` and a stale `week1-core-production-build`.

That arrangement has three concrete costs, and it is worth being precise about
which of them branch-per-agent would actually fix:

1. **No isolation of the working tree.** Several workers edit one filesystem.
   Disjoint edits coexist safely, but a worker that runs `pnpm check`,
   `pnpm test`, `pnpm build` or a Lab run observes every other worker's
   half-finished edits. That produces false failures and, worse, workers that
   "fix" a file another worker is mid-way through writing. Branches do not fix
   this. Worktrees do.
2. **No task boundary in history.** A unit of work lands as a scattered run of
   commits on `dev` with nothing marking where it began or ended, so reverting
   one task means finding and reverting its commits by hand.
3. **No provenance.** A commit records the supervisor as author and says
   nothing about which brief or which worker produced the change.

The consultant advice that prompted this work assumed agents commit to `dev`
themselves, which is where branch-per-agent earns its keep. Here they do not,
so the design below takes the part that transfers — **isolation is per unit of
work, never per agent** — and supplies provenance by a different mechanism,
because there is no per-agent commit to carry it.

The governing constraint is that this must not slow ordinary work down. The
design is therefore tiered: most changes keep exactly today's cost.

**Next:** finish the four measurements, fill the PENDING sections, then build
`scripts/task/`.

## Why Branch-Per-Agent Is The Wrong Unit Here

A branch should bound a change, not a worker. Three reasons specific to this
repository:

- Workers are ephemeral and often several run against one brief; a branch named
  for an agent would outlive the agent and mean nothing after it exits.
- `AGENTS.md` already partitions briefs by file, so the natural isolation
  boundary is the brief, which is a unit of work.
- A worker that is dispatched, returns, and is re-dispatched to fix its own
  work is the same unit of work throughout. Its branch should be too.

Agent identity is preserved in commit trailers instead, where it is queryable
and does not pollute the branch namespace.

## The Three Tiers

The tier is chosen by the supervisor when it writes the brief, by the
mechanical rule below — not by taste.

| Tier | When | Cost | What it gives |
| --- | --- | --- | --- |
| 0 — direct on `dev` | Supervisor edits at most two files it already understands: documentation, a ledger entry, config, a one-line fix. No brief exists. | Zero. Identical to today. | Nothing changes. |
| 1 — task branch, shared checkout | Any unit of work that has a brief, when no other agent is running repository-wide validation at the same time. | Two git commands, at the start and the end. | A merge commit bounding the task, one-command revert, readable first-parent history. |
| 2 — task branch plus worktree | Escalate when **any** of: another agent is running repository-wide validation concurrently; the work is experimental and may be thrown away; the work is a long Lab or build run that would otherwise observe other agents' edits. | Worktree creation plus install — PENDING, being measured. | Everything in Tier 1, plus a filesystem no other agent can perturb. |

The escalation trigger is deliberately about **validation, not editing**.
Concurrent workers editing disjoint files in one tree is already safe and stays
Tier 1. What is not safe is a validation run reading a tree that someone else
is editing, and that is the case Tier 2 exists for.

### Safety valves

These exist so the workflow can never become the reason work stalls:

- A task is abandoned by deleting its branch and worktree. Nothing on `dev`
  needs cleaning up.
- A Tier 1 task that turns out trivial still merges in one command. There is no
  penalty for having opened a branch.
- Urgent fixes go Tier 0, straight to `dev`, with no ceremony.
- No pull requests, and no review gate on `dev`. CI currently runs only on
  `pull_request` and pushes to `main`, so a gate on `dev` would be fictional.
  Validation stays exactly what `AGENTS.md` already requires.

## Naming, Layout And Provenance

**Task id.** `t<NNN>`, allocated by scanning existing branches and the subjects
of prior task merge commits for the highest number. One id is shared by both
repositories when a change spans this repository and Core.

**Branch.** `task/t042-flow-editor-cleanup` off `dev`. Deleted after merge.

**Worktree.** Tier 2 only. The layout is forced, not chosen:

```text
F:/fxwork/t042/
    !FluxIQWebExtension/   worktree of this repository on task/t042-...
    !FluxIQ/               worktree of Core, detached at dev, or on Core's paired branch
```

`domain/package.json` links Core as `link:../../!FluxIQ/packages/fluxiq`,
resolved from the worktree's `domain` directory, so it points at the worktree's
**sibling**. A worktree placed anywhere else cannot resolve Core and cannot
install. This is the same constraint `scripts/lab/pair.mjs` already lives
under, which is why `F:/fxlab/!FluxIQ` exists. `F:/fxwork/` is used rather than
`F:/fxlab/` so that authoring worktrees are never confused with the Lab's
pinned, never-edited test worktrees.

**Provenance.** The supervisor writes trailers on each commit, alongside the
existing `Co-Authored-By` line:

```text
Task: t042
Worker: <agent-label>
Brief: docs/working/<effort>.md#brief-<agent-label>
```

**Merge.** Always `--no-ff` into `dev`, subject `Merge task t042: <title>`.
Individual commits are kept, not squashed — they are the step-by-step record.
The merge commit is the boundary, so first-parent history reads as a list of
tasks and `git revert -m 1 <merge>` undoes one cleanly.

**Integration before merge.** `dev` is merged into the task branch and the
narrowest relevant checks re-run *before* the task merges back. This is the
step that catches two tasks that changed different files and still produced an
incompatible system, which git itself cannot detect.

## Reusing What Already Exists

Evidence: [reports/pair-mechanics.md](./agent-git-workflow-plan/reports/pair-mechanics.md).
The orchestrator half is still PENDING on its own report.

**`pnpm lab:pair` does not create worktrees.** It only moves a pair that
already exists, and refuses otherwise with "create it with
`git worktree add --detach`" (`scripts/lab/pair/command-line.mjs:110`). So
creation, removal, pruning, and branch-based (non-detached) checkout are
entirely absent, and that is precisely the gap `scripts/task/` must fill.
Everything around that gap already exists and is reusable.

Reusable close to unchanged, from `scripts/lab/pair/`:

| Module | What it gives `scripts/task/` |
| --- | --- |
| `path-identity.mjs` | Windows-aware path comparison after `realpath`, so junctions and 8.3 names cannot spoof identity. |
| `git-command.mjs` | `execFile("git", ["-C", root, ...])`, never a shell. |
| `pnpm-command.mjs` | pnpm with provider secrets stripped and `workspace_concurrency: 1`. |
| `side-state.mjs` | One worktree's HEAD, resolved target, dirty lines and lockfile blob in one read pass. |
| `markers.mjs` | `node_modules/.lab-pair-installed-lock` — the lockfile blob hash at the target commit, so a redundant install is skipped. Cleared before, written only after success, so an interrupted setup is repaired by re-running. |
| `process-list.mjs`, `processes-using-roots.mjs` | Refuse to move a worktree while a process is running below it; an unreadable listing is an error, never an empty list. |
| `move-plan.mjs` (install half) | Dirty-tree refusal wording and the decide-everything-before-acting shape. |

The install incantation to copy verbatim is offline-first with a fallback:
`pnpm install --frozen-lockfile --config.confirm-modules-purge=false --offline`,
retried without `--offline` on failure.

**Layout constraint confirmed from source.** `scripts/lab/pair/roots.mjs:25-32`
derives the Core root by resolving `domain/package.json`'s
`link:../../!FluxIQ/packages/fluxiq` and walking up two levels, so Core is the
worktree's sibling by construction, not by configuration. `FLUXIQ_CORE_ROOT` is
exported only to state the result, never to choose it. Nine Lab worktrees under
`F:/fxlab` share the single Core worktree `F:/fxlab/!FluxIQ`; the stray
`F:/fxlab-147fdb4` resolves Core to the working checkout and would be refused.

**A precedent for the tracked-build-output problem.** `.lab-instances/` exists
so a browser build writes outside the tracked `apps/extension/build/` and leaves
the worktree clean. The Lab already solved for authoring what this workflow
needs; see the generated-output section.

**Refusal rules to carry over.** Never operate on the checkout you run from;
never on another agent's working checkout; prove repository identity by
`--git-common-dir` rather than by directory name; refuse on any dirty or
untracked change with no override; refuse while a process runs below the root;
decide all refusals before changing anything and offer `--dry-run`; never write
a completion marker before the step completed; write only into ignored space so
the dirty check keeps working.

**Two weaknesses not to inherit.** The Core side is only checked as "the top of
some git checkout", so an unrelated repository named `!FluxIQ` would be accepted
and then have `git checkout --detach` run in it; and `.env.local` handling is
entirely manual. `scripts/task/` creates the Core worktree itself, so it can
prove Core's identity properly, and it should copy `.env.local` in — while
keeping the existing discipline of reporting a key by source and never reading
its value.

## Cost Of A Worktree — PENDING

Measured standup cost of an authoring worktree: install, check, build, disk, and
whether anything fails for a worktree-specific reason. Depends on the
worktree-cost report. If the measured cost is high, Tier 2's trigger tightens.

## Tracked Generated Output — PENDING

`apps/extension/build/` (10 files) and `domain/.test-build/` (300 files) are
tracked build output, and there is no `.gitattributes`. Parallel branches that
each rebuild will collide in minified bundles and source maps, which cannot be
hand-resolved. Whatever the chosen remedy, the workflow must never ask an agent
to resolve such a conflict by hand. Depends on the generated-output report.

## Where The Shared Primitives Live — decided

`scripts/task/` must not import from `scripts/lab/pair/`: authoring tooling
depending on Testing Lab tooling is the wrong dependency direction, and
`AGENTS.md` forbids copying generic behavior into a second place instead.

The primitives are therefore extracted into a new `scripts/worktree/` that owns
*operating safely on a checkout*, with both `scripts/lab/pair/` and
`scripts/task/` depending on it. Measured blast radius: `scripts/lab/pair/` is
imported by exactly one file (`scripts/lab/pair.mjs:32`), and
`path-identity.mjs`, `git-command.mjs`, `pnpm-command.mjs`, `process-list.mjs`,
`processes-using-roots.mjs`, `markers.mjs` and `side-state.mjs` have no consumer
outside that directory. The move is roughly six import lines plus two test
files, and `pnpm lab:test` (74 tests, observed passing before the change) is the
regression gate.

`scripts/lab/pair/` keeps what is genuinely Lab-specific: the three Core
`--filter` builds, instance directories, the build lock, the Core build watch,
and its own move planning.

## Tooling To Build — PENDING refinement

A `scripts/task/` module, following this repository's structure rules, exposing:

- `pnpm task start <slug> [--worktree] [--core]` — allocate the id, branch off
  `dev`, optionally create the worktree pair and install, report the path.
- `pnpm task finish <id>` — refuse if dirty, integrate `dev`, require observed
  checks, merge `--no-ff`, delete the branch, remove the worktree.
- `pnpm task abandon <id>` — delete branch and worktree without merging.
- `pnpm task list` — open tasks, their worktrees, and how far behind `dev`.

The tooling is the enforcement. A rule that is one command is followed; a rule
that is a paragraph in `AGENTS.md` is not. The only hook proposed is a
`commit-msg` hook requiring the `Task:` trailer on `task/*` branches, which
leaves Tier 0 commits on `dev` untouched.

## Work Ledger

### 2026-09-17 — Design opened, four measurements dispatched
- Agent: supervisor
- Changed: docs/working/agent-git-workflow-plan.md (new), docs/working/README.md
- Why: User asked for a version-control workflow modelled on standard
  branch-per-task practice but tailored to this repository and explicitly not
  heavy-handed.
- Validation: `git worktree list`, `git ls-files apps/extension/build | wc -l`,
  `grep -n "link:" domain/package.json` -> 11 existing Lab worktrees; 10 tracked
  extension build files and 300 tracked `domain/.test-build` files; Core linked
  as `link:../../!FluxIQ/packages/fluxiq`, confirming the sibling-layout
  constraint.
- Outcome: Partial
- Follow-up: Fill the four PENDING sections from the worker reports, then build
  `scripts/task/`.

## Open Questions

- Does Core adopt the paired-branch half? A cross-repository task needs the same
  id and a `--no-ff` merge on both `dev` branches, which means editing Core's
  `AGENTS.md`. Owner: supervisor, after this repository's side works.
- Should `pnpm task finish` refuse without observed check output, or only warn?
  Refusing is mechanical enforcement; warning keeps Tier 1 at two commands.
  Owner: supervisor, settled once worktree cost is known.
- `week1-core-production-build` is **not** merged into `dev`: it holds 4 commits
  `dev` does not have, the newest being `99dbed6` (2026-09-15, "Stop durable
  publications leaving their own temporary behind"), while `dev` is 101 ahead.
  It is therefore unmerged work, not a stale pointer, and must not be deleted as
  part of branch hygiene until someone decides whether those 4 commits are
  wanted. Owner: user, or supervisor once the commits are reviewed.
