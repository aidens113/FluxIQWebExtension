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

The design is settled and evidenced by four measurement reports under
`agent-git-workflow-plan/reports/`. Implementation is part done.

**Landed.** Generated build output is untracked and line endings are normalized
(`e46b987`); `AGENTS.md` carries the tiering rule and the worktree layout;
`scripts/task/` is written, wired as `pnpm task`, and its argument, branch-name
and layout tests pass 12/12. A pre-existing type error on `dev` was fixed on the
way (`eff5097`) — `pnpm check` had been red, which would have made
`pnpm task finish` refuse every task.

**In flight.** `scripts/worktree/` (the extraction from `scripts/lab/pair/`
plus the create/remove/Core-sibling modules), the architecture policy documents
that still assert the old tracking answer, and the `test-domain.mjs` outdir
cleaning fix.

**Not started.** End-to-end exercise of a real task through
`start` → `finish` on a throwaway slug; the Core-side paired-branch half.

Before this work, every agent worked in the single checkout at
`F:\!FluxIQWebExtension` on `dev`. Workers edit that shared working tree and
never commit; the supervisor commits and pushes. There were no authoring
branches — only `dev`, `main` and `week1-core-production-build`, which turned
out to hold 4 unmerged commits rather than being stale (see Open Questions).

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

**Worktree.** Tier 2 only. `domain/package.json` links Core as
`link:../../!FluxIQ/packages/fluxiq`, resolved from the worktree's `domain`
directory, so Core must be the worktree's **sibling**. A worktree placed
anywhere else cannot resolve Core and cannot install. `F:/fxwork/` is used
rather than `F:/fxlab/` so authoring worktrees are never confused with the
Lab's pinned, never-edited test worktrees.

Because the link resolves to the *parent* directory, sibling worktrees share
one Core — which is why nine Lab worktrees under `F:/fxlab` share the single
`F:/fxlab/!FluxIQ`. Measurement (below) shows Core is 48.6s of a 52.6s setup,
so sharing it is worth a great deal. Two layouts, chosen by whether the task
edits Core:

```text
Default — flat, shared Core, ~4s per task:
F:/fxwork/
    !FluxIQ/               one worktree, detached at Core's dev, never edited
    t042-flow-editor/      ext worktree on task/t042-flow-editor
    t043-recorder-fix/     ext worktree on task/t043-recorder-fix

Core-paired task — nested, private Core, ~53s:
F:/fxwork/t044/
    !FluxIQWebExtension/   ext worktree on task/t044-...
    !FluxIQ/               Core worktree on Core's own task/t044-... branch
```

A task that edits Core must take the nested form, because the shared Core is
detached and read-only; editing it would change what every other task builds
against.

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

Evidence: [reports/pair-mechanics.md](./agent-git-workflow-plan/reports/pair-mechanics.md)
and [reports/orchestrator-gap.md](./agent-git-workflow-plan/reports/orchestrator-gap.md).

**`packages/agent-orchestrator` is not the foundation, and `scripts/task/` will
not be built on it.** It is dormant: nothing in the repository imports it, and
its only caller is a manual root script. It contributes exactly one useful
artifact — a validated three-command argv plan for
`git worktree add -b` / `status --short` / `worktree remove`
(`packages/agent-orchestrator/src/worktree.ts:90-92`) — and spawns nothing.

It is rejected as a base because its types encode a different problem. An
`AgentTaskPacket` mandates `scenario {id, seed, command}` and
`baseline {runId, artifactIndexSha256}`, with a uint32 seed and 64-hex hash
enforced (`src/types.ts:48-49`, `src/task.ts:62-63`), so an ordinary authoring
task cannot be expressed in it at all; a packet addresses exactly one
repository, which a Core-paired task violates; and its review gate demands two
full `RunEvaluation`s plus a `CandidateComparison`, which a task validated by
`pnpm check` rather than by the Testing Lab cannot supply. Retrofitting it would
mean breaking changes to a package built for scenario-based improvement runs.

What is taken from it is the *idea* of a disposable-root path policy — a
worktree must live inside a disposable base that overlaps neither the repository
nor the main workspace — reimplemented in `scripts/worktree/`. Its hash-chained
NDJSON audit log is deliberately **not** adopted: it is ceremony this workflow
does not need, and its `evaluateReviewGate` trusts an unchecked `auditVerified`
boolean with no link to any log anyway.

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

## Cost Of A Worktree — measured

Evidence: [reports/worktree-cost.md](./agent-git-workflow-plan/reports/worktree-cost.md).
Measured on a real probe worktree pair, since removed.

| Step | Wall-clock | Result |
| --- | --- | --- |
| `git worktree add` (warm) | 1.1s | OK |
| `pnpm install --frozen-lockfile` (extension) | 2.9s | OK |
| `pnpm install --frozen-lockfile` (Core sibling) | 35.8s | OK, 301 packages, 0 downloaded |
| Core build: contracts, fluxiq, client-gateway-websocket | 12.8s | OK |
| `pnpm build` (extension) | 18.1s | OK |

**~52.6s for the first worktree, ~4s for each one after it** under the flat
layout that shares Core. Marginal disk is ~80 MB per worktree: pnpm hardlinks
from `F:\.pnpm-store\v3`, proven by an identical inode across both checkouts.

This is cheap enough that Tier 2's trigger does **not** need tightening. The
escalation rule stands as written.

**Core's `dist/` is gitignored**, so a fresh Core worktree has source but no
types and `pnpm check` dies with `TS2307: Cannot find module
'@fluxiq/contracts/automation-studio'`. Provisioning must install and build Core
or the worktree cannot type-check at all. This is the whole reason the shared
Core is worth having.

**`git worktree remove --force` does not work here and must not be used.** Both
probe removals failed with `failed to delete '...': Directory not empty`:
`--force` covers modified tracked files but not `node_modules`. Worse, it is
**not atomic** — it partly deleted the tree before aborting, leaving the `.git`
file gone. `scripts/worktree/remove.mjs` therefore does `rm -rf` (3.6s) followed
by `git worktree prune`, never `worktree remove --force`.

**`.env.local` is absent from a fresh worktree** and broke neither check nor
build. It matters only for Lab and live-provider runs, so copying it is a
convenience, not a prerequisite.

## Tracked Generated Output — PENDING

`apps/extension/build/` (10 files) and `domain/.test-build/` (300 files) are
tracked build output, and there is no `.gitattributes`. Parallel branches that
each rebuild will collide in minified bundles and source maps, which cannot be
hand-resolved. Whatever the chosen remedy, the workflow must never ask an agent
to resolve such a conflict by hand. Depends on the generated-output report.

## A Guard Untracking Removed, And Why That Is Accepted

Untracking the generated bundles removed a refusal the Testing Lab was getting
for free. `scripts/lab/pair` reads dirtiness with
`git status --porcelain=v1 --untracked-files=normal`, which does not report
ignored paths. While `apps/extension/build/` was tracked, an unlabelled build in
a pair worktree left it modified, and the next attempt to move the pair refused.
Now that the path is ignored, that refusal no longer fires.

This is accepted rather than replaced, for three reasons. The refusal was
incidental — a side effect of tracking build output, not a guard anyone
designed. The hazard it half-covered is still covered directly: `lab:pair`
refuses to move a worktree while a process is running below it, which is the
actual concurrency risk, and the build's destructive `rm` of the unpacked
extension is what a concurrent reader needs protecting from. And the Lab rebuilds
on every run, so stale ignored output is overwritten rather than trusted.

What is lost is the nudge that made someone clean up after an unlabelled build.
That is a cost worth paying to make parallel branches possible at all.

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

## Tooling To Build

The tooling is the enforcement. A rule that is one command is followed; a rule
that is a paragraph in `AGENTS.md` is not. Two new directories, each following
the small-single-purpose-file shape `scripts/lab/pair/` already uses (one
exported thing per file, an `index.mjs` barrel, tests in `tests/`).

### `scripts/worktree/` — operating safely on a checkout

Owns what both the Lab and the task tooling need. Moved from
`scripts/lab/pair/`: `git-command.mjs`, `pnpm-command.mjs`, `path-identity.mjs`,
`process-list.mjs`, `processes-using-roots.mjs`, `markers.mjs`, `side-state.mjs`.
New here, because `lab:pair` never had it:

- `create.mjs` — `git worktree add -b <branch> <root> <startPoint>`, then the
  sibling Core worktree, then install, then verify the Core link resolves.
- `remove.mjs` — refuse when dirty or when a process runs below the root, then
  `git worktree remove`, then prune.
- `disposable-root.mjs` — the path policy: a worktree lives under the
  disposable base and overlaps neither the repository nor any working checkout.
- `core-sibling.mjs` — resolve and **prove** the Core sibling, closing the
  weakness that `lab:pair` only checks Core is the top of some checkout.
- `env-local.mjs` — copy `.env.local` into a new worktree when one exists,
  reporting by source and never reading the value.

### `scripts/task/` — the task lifecycle

- `pnpm task start <slug> [--worktree] [--core]` — allocate the id, branch off
  `dev`, optionally create the worktree pair and install, print the path.
- `pnpm task finish <id>` — refuse if dirty, merge `dev` in, require the checks
  to have been observed, merge `--no-ff` into `dev`, delete the branch, remove
  the worktree.
- `pnpm task abandon <id>` — delete branch and worktree without merging.
- `pnpm task list` — open tasks, their worktrees, and how far behind `dev`.

Every command decides all refusals before changing anything, supports
`--dry-run`, prints one JSON line on stdout with progress on stderr, and never
operates on the checkout it runs from.

The only hook proposed is a `commit-msg` hook requiring the `Task:` trailer on
`task/*` branches, which leaves Tier 0 commits on `dev` untouched.

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
- Scratch directories from past worker runs are never reclaimed: measured
  2026-09-17, `apps/extension/.test-build-scratch` holds 1.4 GB across 162
  label directories and `domain/.test-build-scratch` 178 MB across 99, plus the
  `.lab-instances` directories. Each self-cleans when its label is reused, but
  an abandoned label is never removed. All of it is ignored space, so this is
  disk cost rather than repository cost. A blind sweep is unsafe because a
  running worker owns one; the fix is an age-based prune, which fits naturally
  as a `pnpm task prune` alongside `git worktree prune`. Owner: supervisor, once
  the task tooling is verified.
- `packages/agent-orchestrator` is dormant — no importer anywhere — yet its 16
  tests run inside every `pnpm check` and `pnpm test`. This plan does not build
  on it, which leaves it with no prospective consumer either. Keep it, wire it
  up, or retire it? Owner: user. Out of scope here; recorded so the decision is
  not lost.
- `week1-core-production-build` is **not** merged into `dev`: it holds 4 commits
  `dev` does not have, the newest being `99dbed6` (2026-09-15, "Stop durable
  publications leaving their own temporary behind"), while `dev` is 101 ahead.
  It is therefore unmerged work, not a stale pointer, and must not be deleted as
  part of branch hygiene until someone decides whether those 4 commits are
  wanted. Owner: user, or supervisor once the commits are reviewed.
