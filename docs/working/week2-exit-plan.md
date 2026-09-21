# Week 2 Exit Plan

Status: Active
Status detail: Opened 2026-09-21; four read-only discovery audits dispatched to ground the completion plan before execution.
Created: 2026-09-21
Last updated: 2026-09-21
Owner: Senior supervisor agent
Scope: Take the 30-day MVP over the Week 2 exit line — Fail, Diagnose, Explore, Recover, Generate Repair, Validate, Persist, Resume, Re-run Deterministically, proven live through the real panel and extension — by integrating the open task branches, closing the loop's remaining gaps across all three entry points, and building an end-to-end UI test lane that exercises it.
Paired document: `F:\!FluxIQ\docs\working\mvp-week2-automation-loop-plan.md` (Core's side of the Week 2 loop)
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [data extraction](./first-class-data-extraction-plan.md), [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2 exit criteria), [agent git workflow](./agent-git-workflow-plan.md)

---

## Current State

The user asked on 2026-09-21 to enhance the plan and push the project over
the Week 2 MVP line, including end-to-end UI testing and development, and the
adaptability of model-authored Flows. This document owns that push; the
Week 2 loop document keeps its history and phase detail.

**Where things stand.** `dev` is clean and pushed at `d3ad8c5`. Four task
branches are open and unmerged. t027 is the big one: 41 downstream commits,
about 9,200 lines, plus 11 Core commits, holding the panel golden-path lane,
the 44.7% runtime latency cut, closed repair diagnostics and bounded repair
candidate ranking; its worktree also has uncommitted edits to the Week 2
document and a latency audit report. t033 has multi-action exploration
slices 1-4 built behind a default of one, awaiting a live A/B. t029 has a
node-library gap audit and a planned privileged JavaScript node. t034 has
only a brief for a post-action readiness latency cut.

**What Week 2 has not yet shown live:** the exit chain end to end. The
newest real-provider repair run made a diagnosis call and an exploration call,
judged the run unachievable, and never produced a patch. Existing-Flow
improvement, the third entry point, is not started; neither are 2.9's
FluxBench Week 2 metrics, adaptation-cycle lane and `week2` corpus, nor X6.

**In flight:** four read-only discovery audits (briefs below). Their reports
decide the integration order, the minimal work to demonstrate the exit loop,
the end-to-end UI suite, and the existing-Flow and repair-structure design.

**Next:** read the four reports, rewrite this Current State as the
completion plan with ordered, file-partitioned execution phases, then execute
live-first.

**Blockers:** none.

---

## Worker Briefs

### Brief: w2x-branch-integration-audit
- Repository: both repositories, read-only. Downstream `F:\!FluxIQWebExtension` (dev) and task worktrees under `F:\fxwork\t027`, `t029`, `t033`, `F:\fxwork\t034-post-action-readiness`; Core `F:\!FluxIQ` (dev) and `F:\fxwork\t027\!FluxIQ`, `t029`, `t033`.
- Task: decide how each open task reaches `dev`. For t027, t029, t033 and t034, in both repositories: what each commit series adds, which of it is live-proven (cite the report and its evidence), which is unproven or failed live (t027's unified one-or-many output did not complete a Flow), uncommitted changes in each worktree, textual conflicts with `dev` and with each other (use `git merge-tree --write-tree`, never a real merge), and semantic overlap (t027 and t033 both touch `flow-lane/creation/build-proposal.ts` and `existing-fluxiq-control.ts`).
- Also: list the `F:\fxlab\*` and `F:\fxwork\*` worktrees and the closed-task branches (t005, t006, t007, t008, t011, t017, t021) that are safe to remove, using `pnpm task prune --dry-run` and `pnpm task list`.
- Required reads: this Current State; each task's own working document and reports only; `git log`/`git diff --stat` output.
- Owns: `docs/working/week2-exit-plan/reports/w2x-branch-integration-audit.md` only.
- Must not touch: any branch, worktree, source, working document, git history, build output, the user's panel or port 3000, provider credentials. No builds, tests, or live runs.
- Definition of done: per-task table (content, proven, unproven, conflicts, disposition: merge as-is / merge after split / hold / close); a recommended integration order with the narrowest check to run after each merge; the removal list.
- Report to: `docs/working/week2-exit-plan/reports/w2x-branch-integration-audit.md`

### Brief: w2x-exit-loop-gap-audit
- Repository: both repositories, read-only; `dev` plus the t027 worktrees (`F:\fxwork\t027\!FluxIQWebExtension`, `F:\fxwork\t027\!FluxIQ`), which are ahead of `dev`.
- Task: for each link of the Week 2 exit chain — Fail, Diagnose, Explore, Recover, Generate Repair, Validate, Persist, Resume, Re-run Deterministically — and for each entry point (new Flow from instruction, failing run, edge case in an existing Flow), state: the code path that implements it (Core and downstream file:line), the strongest live evidence (report path and run directory; confirm `build.providerCalls` equals `observed.calls` in `snapshots/live-llm.json`, and judge extraction by `matchedRecords` against `expectedRecords`, never `observedRecords`), and the exact gap. Include 2.9 (FluxBench Week 2 metrics, adaptation-cycle lane, `week2` corpus) and X6. Find the latest full corpus measurement and give its per-scenario results by oracle, not verdict.
- Required reads: this Current State; `docs/working/mvp-week2-automation-loop-plan.md` Current State and Phases table (the t027 copy); the Week 2 exit criteria in `FluxIQ Web Extension — 30-Day MVP Implementation Plan.md` lines 363-680; reports and `test-runs/` evidence only as needed to confirm a claim.
- Owns: `docs/working/week2-exit-plan/reports/w2x-exit-loop-gap-audit.md` only.
- Must not touch: source, tests, working documents, git state, the user's panel, provider credentials. No builds, tests, or live runs.
- Definition of done: a link-by-link table with code path, evidence, and gap; the smallest ordered set of changes that would let one scenario show the whole chain live with a zero-provider-call replay; which Lab scenarios best demonstrate each entry point; cost and wall-clock estimates from past runs.
- Report to: `docs/working/week2-exit-plan/reports/w2x-exit-loop-gap-audit.md`

### Brief: w2x-ui-e2e-audit
- Repository: downstream, read-only; `dev` plus `F:\fxwork\t027\!FluxIQWebExtension`, which holds the new `panel-golden-path` lane.
- Task: inventory end-to-end UI testing through the real FluxIQ panel and the real unpacked extension. For each user journey — create a Flow from an instruction, record by demonstration, pick and extract data, run, watch Runtime Debug, see a failure, review and apply a repair proposal (and its diff), grant or refuse a permission request, inspect adaptation history, revert, restart and reuse — say whether it is automated, by which lane/spec/script (`panel-golden-path`, `demo-llm-create-ui`, `demo-workspace`, `existing-fluxiq-control`, `apps/extension` Playwright specs), whether it needs the provider, its measured duration, and any recorded flakiness. Say which journeys have no UI at all yet, as distinct from UI with no test.
- Then propose the E2E UI suite for Week 2: journeys in priority order, one command, isolation (worktree, ports, profile, store), provider-free versus provider lanes, expected wall clock, and what each assertion reads.
- Required reads: this Current State; `docs/architecture/testing-facility.md`; the lane and script sources named above; t027's `w2-concurrent-live-testing-plan.md`.
- Owns: `docs/working/week2-exit-plan/reports/w2x-ui-e2e-audit.md` only.
- Must not touch: source, tests, working documents, git state, the user's panel or port 3000, provider credentials. No live runs; reading existing `test-runs/` evidence is allowed.
- Definition of done: journey table (automated? lane, provider, duration, gap), a missing-UI list, and the proposed suite with a file-partitioned build order.
- Report to: `docs/working/week2-exit-plan/reports/w2x-ui-e2e-audit.md`

### Brief: w2x-existing-flow-and-repair-design
- Repository: both repositories, read-only; Core `F:\fxwork\t027\!FluxIQ` (dev plus t027) is the reference tree. Path prefix `AS/` is `packages/fluxiq/src/programs/automation-studio/`.
- Task: design, to file:line, the Core and downstream changes for five open items, each as an implementation slice partitioned by file with its narrowest live proof: (1) the third entry point — improving an existing, non-blank Flow from a new instruction or an edge case, where Flow bootstrap refuses non-blank Flows today; (2) repair editing structure — repair returns a revised Flow script and Core shows the person a diff, so a Flow missing a step can be fixed, not only declined (designed in `mvp-week2-automation-loop-plan/reports/w2-routing-and-subflows.md`); (3) the recovery path receiving the permitted set (t018 report); (4) under `explore_and_adapt`, a repair needing a side effect becoming a permission request instead of being dropped (`recovery/annotation/patches.ts:142`); (5) result verification that disagrees with itself at temperature 0 — one repeat on "does not answer", disagreement records `unverified` (t022 report). Say which slices share files and must run serially.
- Required reads: this Current State; the reports named above under `docs/working/mvp-week2-automation-loop-plan/reports/`; the Core and downstream source they cite.
- Owns: `docs/working/week2-exit-plan/reports/w2x-existing-flow-and-repair-design.md` only.
- Must not touch: source, tests, working documents in either repository, git state, the user's panel, provider credentials. No builds, tests, or live runs.
- Definition of done: per-item design with exact sites, contract changes, UI surface, a live proof on a named Lab scenario, and a file-ownership table showing which slices can run in parallel.
- Report to: `docs/working/week2-exit-plan/reports/w2x-existing-flow-and-repair-design.md`

---

## Work Ledger

### 2026-09-21 — Week 2 exit push opened
- Agent: supervisor
- Changed: this document; four read-only discovery briefs.
- Why: the user asked to push the project over the Week 2 MVP line, with end-to-end UI testing and Flow adaptability; the latest state lives on unmerged task branches, so the plan needs grounding first.
- Validation: `git rev-list --count dev..task/t027-multi-action-exploration` printed `41`; Core `task/t027-multi-action-exploration ahead=11 behind=0`; no Codex session file exists for 2026-09-21, so no other agent is working the task worktrees.
- Outcome: Partial
- Follow-up: integrate the four reports into the completion plan.

---

## Open Questions

- None.
