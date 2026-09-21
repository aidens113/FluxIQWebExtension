# Week 2 Exit Plan

Status: Active
Status detail: Integration under way: t027 is being reconciled onto dev without its first-generation batch surface; t033 remediation is in rereview; two discovery audits remain.
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

**Where things stand (from `w2x-branch-integration-audit`, supervisor-checked).**
Four task branches are open. **t027** (41 downstream and 11 Core commits)
holds the panel golden-path lane, the 44.7% runtime latency cut, reconnect,
extraction exit, closed repair diagnostics, candidate ranking and the
permission-continuation UI, but also a first-generation multi-action batch
whose Core defaults to **16** actions per decision
(`loop-limits/evidence-loop.ts:53`, checked; `dev` has no such constant), so
every t027 creation proof ran on settings that must not ship. **t033**'s
default-one multi-action contract was blocked by an integration review; its
remediation is now committed (`1433d90` Core) but not rereviewed, and its
live A/B never ran on the right task. **t029**'s privileged JavaScript node is
implemented and live-proven for the hand-authored path but blocked by three
rereview findings; its work is now committed on its task branch (`77b5182`,
`b1ec0da`) and held. **t034** depends on t027-only snapshot-readiness code.

**Integration decision (supervisor, 2026-09-21): t027 first, with its
first-generation batch surface removed, then t033 on top, then t034, then
t029.** Codex's integration map put t033 first, but t033 is review-blocked and
unmeasured, and waiting on it stalls the UI suite and everything built on
t027. The map's own fallback applies: land t027's independent work with
production single-action exactly as on `dev`. The shared seams need a manual
union in either order, so this costs nothing extra. t027 downstream now
contains `dev` (`3ba5417`); Core t027 is 0 behind Core `dev`.

**What Week 2 has not yet shown live:** the exit chain end to end. The
newest real-provider repair run made a diagnosis call and an exploration call,
judged the run unachievable, and never produced a patch. Existing-Flow
improvement, the third entry point, is not started; neither are 2.9's
FluxBench Week 2 metrics, adaptation-cycle lane and `week2` corpus, nor X6.

**End-to-end UI testing (from `w2x-ui-e2e-audit`, supervisor-checked).** No
committed command drives the exit chain through the UI. `panel:golden` exists
only on t027, has never finished, and cannot pass by construction: five of its
twelve stages are declared `unverified` in code (`panel-golden-path/lane.ts:127-137`
on t027), not measured. Its repair stage has 0 of 9 passing bundles. The
Runtime Debug, no-reload refresh, extraction and reconnect proofs used
disposable drivers that were never committed, and no UI lane judges extraction
by `matchedRecords`. Three journeys have **no product UI**: improving an
existing Flow (Core's authoring panel refuses non-blank Flows,
`authoring/blank-flow-authoring-model.ts:98-104`, checked), a permission
request raised by a run or repair, and a structural repair diff. Revert,
adaptation history and the "Changed fields" table have UI but no test.
**Decision:** replace `panel:golden` with `pnpm ui:e2e` — a provider-free lane
(F1 record-generate-run-Runtime Debug, F2 pick-extract-dataset with
`matchedRecords === expectedRecords`, F3 visible failure, F4 restart and reuse;
about 3-4 min) and a provider lane (P1 create, P2 fail-repair-diff-apply-rerun,
P3 UI revert and history, P4 repaired reuse, P5 permission grant and refuse, P6
existing-Flow improvement; about 6-8 min, cents). Every stage is measured; a
journey whose UI does not exist reports `not_built` and fails. Build order is
in the report: t027's drivers first, then six parallel briefs on disjoint files,
then one owner for the suite and launcher.

**In flight:** `w2x-t027-reconcile` (code and live, t027 worktrees);
`w2-multi-action-remediation-rereview` (read-only, brief in t033's
`multi-action-exploration-reconcile.md`); and two read-only audits (exit-loop
gaps, existing-Flow and repair design) that decide the minimal work to
demonstrate the exit loop and the product changes the missing UI journeys need.

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

### Brief: w2x-t027-reconcile
- Repository: paired t027 worktrees `F:\fxwork\t027\!FluxIQWebExtension` and `F:\fxwork\t027\!FluxIQ`, branch `task/t027-multi-action-exploration` in both; both already contain current `dev`.
- Task: remove t027's first-generation multi-action surface so production behaves exactly as `dev` — one action per model decision, no list schema, no Lab max-action control — while keeping every independent t027 change. `docs/working/bootstrap-no-proposal-investigation/reports/w2-t027-t033-integration-map.md` (t027 downstream) classifies every commit. **t033 has not landed**: wherever the map says t033 is authoritative, use `dev`'s version instead.
- Core: drop superseded `ef7892f`, `4b79c00`, `042562e`. Delete `runtime/llm/evidence-window.ts` and every t027-only file under `runtime/llm/evidence-batch/`. For each file the map lists as t033-authoritative, restore `dev`'s version except hunks from the independent commits (`1079ba8`, `b3f772f`, `fe6e77a`, `680c515`, `949735d`, `bb430e4`, `2dcf06b`); use `git log dev..HEAD -- <file>` to tell them apart. Union by hand: `flow-bootstrap/generation-failure.ts` and test (keep `949735d`'s categorical pre-provider codes), `runtime/service.ts` (keep `llmEvidenceRuntimeStatus` and categorical bootstrap-boundary assignments, drop `batchDecisions`), `api/handlers/llm-generation.ts` and test (keep `bb430e4`'s grant-issue mapping, no `maxActionsPerDecision`).
- Downstream: restore `dev`'s max-action plumbing in `packages/test-runner/src/{cli,commands}.ts`, `flow-lane/creation/{lane,build-proposal}.ts` and test, `live-llm/{live-llm-plan,live-llm-run}.ts`. In `existing-fluxiq-control.ts` and test drop the `batchDecisions` parser, keep `03c20a6`'s terminal repair outcome. Delete `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-{exploration,safety}.spec.ts`. Keep `719a34d`'s `domain/src/runtime/llm-evidence/tools.ts` sentence.
- Negative inventory: grep both trees for `MAX_ACTIONS_PER_DECISION`, `maxActionsPerDecision`, `batchDecisions`, `evidence-window`, `tool_calls`; nothing may remain that `dev` lacks.
- Live first, from a fresh isolated store and profile on allocated ports (never 3000 or 4711), DeepSeek from `.env.local` as earlier t027 reports did: (1) `pnpm panel:golden` through prepare, explore, apply and bound run — explore yields exactly one durable proposal, the bound run passes its oracle with zero provider calls; the repair stage is expected to fail, record its outcome code. (2) One replay of the saved four-action Flow: about 8.2 s, 4/4, oracle passes. Fix only failures the reconciliation introduced.
- Then focused tests. Core, run from inside `packages/fluxiq`: generation-failure, llm-generation handler, service-bootstrap generation, blank-flow-authoring, action-permissions client, recovery annotate and stages. Downstream: automation-tab, action-runner, target candidates, llm-evidence tools, build-proposal, existing-fluxiq-control, commands, browser-session. Then downstream `pnpm check` and Core `check` and `build`. No full suites.
- Owns: the files named above, in the two t027 worktrees only; the report.
- Must not touch: git commits, merges or history (leave changes uncommitted for the supervisor); any other worktree; shared `dev`; the user's panel, store or profile.
- Definition of done: negative inventory empty; both live results with bundle paths; focused tests and checks pass; the report lists every changed file keyed to the map's commit classification.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-t027-reconcile.md`

---

## Work Ledger

### 2026-09-21 — Week 2 exit push opened
- Agent: supervisor
- Changed: this document; four read-only discovery briefs.
- Why: the user asked to push the project over the Week 2 MVP line, with end-to-end UI testing and Flow adaptability; the latest state lives on unmerged task branches, so the plan needs grounding first.
- Validation: `git rev-list --count dev..task/t027-multi-action-exploration` printed `41`; Core `task/t027-multi-action-exploration ahead=11 behind=0`; no Codex session file exists for 2026-09-21, so no other agent is working the task worktrees.
- Outcome: Partial
- Follow-up: integrate the four reports into the completion plan.

### 2026-09-21 — End-to-end UI test audit integrated
- Agent: supervisor; worker `w2x-ui-e2e-audit`
- Changed: Current State (UI testing findings and the `ui:e2e` decision); `reports/w2x-ui-e2e-audit.md`.
- Why: the Week 2 exit chain must be proven through the real panel, and no committed lane can do that today.
- Validation: `grep -n verified packages/test-runner/src/panel-golden-path/*.ts` in the t027 worktree printed five stages declared `status: "unverified"` in `lane.ts` (lines 127, 132, 133, 134, 137) and `status: unverifiedStages.length ? "incomplete" : "passed"` at line 142; Core `blank-flow-authoring-model.ts:98-104` returns `{ ok: false }` unless nodes, edges, router and Subflows are all empty.
- Outcome: Partial
- Follow-up: fold the remaining three audits into ordered execution phases.

### 2026-09-21 — Branch audit integrated; t027 goes first without its batch surface
- Agent: supervisor; worker `w2x-branch-integration-audit`
- Changed: Current State; brief `w2x-t027-reconcile`; t027 downstream `71f4fc0` (latency audit report), `3ba5417` (merge `dev`), `6122a78` (archive six delivered briefs, Week 2 document 808 -> 704 lines); t033 Core `1433d90` and downstream `c82e774` (remediation and reports, previously uncommitted); t029 downstream `77b5182` and Core `b1ec0da` (review-blocked work, previously uncommitted, held).
- Why: worktree-only work was one accident from loss; t027 carries most of the proven Week 2 value and must not wait on a review-blocked t033.
- Validation: `grep -rn 'MAX_ACTIONS_PER_DECISION *='` in t027 Core printed `runtime/loop-limits/evidence-loop.ts:53: ... = 16`, and in Core `dev` printed nothing; `git status --short | wc -l` printed `0` in the t027 downstream, t033 and t029 worktrees after the commits, apart from t029's untracked `.tmp-w2-final-boundary-live.mjs` driver; `node scripts/structure-audit.mjs` on t027 printed `structure-audit: passed (83 warning(s), 122 baselined).` with exit 0 after the compaction.
- Outcome: Partial
- Follow-up: verify `w2x-t027-reconcile` and the t033 rereview; then t033's live A/B on top of the reconciled `dev`.

---

## Open Questions

- None.
