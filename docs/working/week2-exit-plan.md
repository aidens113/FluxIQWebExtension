# Week 2 Exit Plan

Status: Active
Status detail: Execution plan written from four audits; I1 (t027), I2 (t033 schema fix), L2 (t035) and L3 (t036) in flight.
Created: 2026-09-21
Last updated: 2026-09-21
Owner: Senior supervisor agent
Scope: Take the 30-day MVP over the Week 2 exit line — Fail, Diagnose, Explore, Recover, Generate Repair, Validate, Persist, Resume, Re-run Deterministically, proven live through the real panel and extension — by integrating the open task branches, closing the loop's remaining gaps across all three entry points, and building an end-to-end UI test lane that exercises it.
Paired document: `F:\!FluxIQ\docs\working\mvp-week2-automation-loop-plan.md` (Core's side of the Week 2 loop)
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [data extraction](./first-class-data-extraction-plan.md), [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2 exit criteria), [agent git workflow](./agent-git-workflow-plan.md)

---

## Current State

The user asked on 2026-09-21 to enhance the plan and push the project over
the Week 2 MVP line, including end-to-end UI testing and the adaptability of
model-authored Flows. This document owns that push; the Week 2 loop document
keeps its history and phase detail. The four discovery reports are in
`week2-exit-plan/reports/` and each claim below was checked in source.

**Week 2 is over the line when all of these hold, judged by oracle and by
`build.providerCalls == observed.calls`, never by verdict:**
1. On `identity-drift-rename-redesigned-after-creation`, one Lab run shows
   Fail, Diagnose, Explore, Recover (a trial restores the expected state),
   Generate Repair, Validate (adaptation `validated`), Resume (the same run
   continues from the failed node and passes its oracle), Persist (approved
   and applied), then a keyless re-run with zero provider calls that passes.
2. The same chain passes through the real panel as `ui:e2e` journey P2.
3. The third entry point works: `social-scheduler-week-ahead` built on the
   baseline page is improved against the `whats-new` rendering, gaining the
   route and Subflow, then matches 14 of 14 on both routes with zero calls.
4. The provider-free `ui:e2e` lane passes, and the `week2` corpus is measured
   once with the 2.9 adaptation metrics populated.

**Why it is not over the line today (`w2x-exit-loop-gap-audit`).** Only Fail,
Diagnose, Explore and Generate Repair have live evidence on a created Flow, on
the isolated target that deletes the Flow. **Recover and Resume cannot happen
in production Core for any model-written repair:** a granted run is forced to
`adaptiveMode: "manual_approval", authorizedExternalSideEffects: false`
(Core `service.ts:3081`, checked); the adaptive retry is skipped whenever a
grant is present (`service.ts:3224,3278`, checked); a target override counts as
a side effect and is refused at preflight (`live-patch.ts:140-141`, checked);
and recovery exploration can never press, type or navigate under the default
policy (`harness-options/registry.ts:270-276`). The 2.5 exploration reduction
is computed and discarded, the 2.6 replay recorder has no caller, the Lab's
approve/apply/replay lane is wired only to recorded Flows, the 2.9 metrics are
all `null`, and there is no `week2` corpus. The last full corpus (2026-09-18)
passed 4 of 36 by oracle and predates t010-t027.

**UI (`w2x-ui-e2e-audit`).** No committed command drives the exit chain
through the UI; `panel:golden` (t027 only) declares five of twelve stages
`unverified` in code and its repair stage has 0 of 9 passes. Three journeys
have no product UI: improving an existing Flow (the authoring panel refuses
non-blank Flows, `blank-flow-authoring-model.ts:98-104`), a permission request
from a run or repair, and a structural repair diff.

**Branches (`w2x-branch-integration-audit`).** t027 (41 downstream, 11 Core
commits) carries most proven Week 2 value plus a first-generation batch whose
Core defaults to 16 actions per decision; it lands first with that surface
removed, production staying single-action as on `dev`. t033 (default-one
multi-action) cleared its rereview (`1433d90`) apart from one medium schema
gap, now fixed (`6992da5`); before landing, its `llm/evidence-loop.ts` (810
lines, over Core's 800 limit) must be split. t029 (JavaScript node) is committed on its branch and held on
three review findings. t034 needs t027. Worktree-only work in all three was
committed on 2026-09-21. Core `service.ts` is the serial bottleneck: t027 is
37 lines over its 6,404-line ratchet, and t027, t033, C0, CF and Resume all
edit it.

**In flight:** `w2x-t027-reconcile` (I1; authorized to lift provider
resolution out of `service.ts` and fold `llmEvidenceRuntimeStatus` into the
existing readiness method, clearing both Core ratchets);
`w2x-verification-agreement` (L2,
t035); `w2x-lab-llm-permit` (L3, t036).

**Next:** verify and land t027 in both repositories, then run Phase I's t033
decision and dispatch U1 and L1 in parallel with it.

**Blockers:** none.

---

## Execution Plan

Slice names C0-CU2, D3-DL are defined in `reports/w2x-existing-flow-and-repair-design.md`;
steps 1-4 of the gap audit are in `reports/w2x-exit-loop-gap-audit.md`
("Smallest ordered set of changes"). Every slice proves itself live first, on
the scenario its report names, then runs its focused tests. At most four code
workers run at once.

| Id | Work | Repos | After | Status |
| --- | --- | --- | --- | --- |
| **I1** | Land t027 without its first-generation batch surface | both | — | in flight |
| **I2** | t033: rereview, merge `dev`, same-code live A/B on `social-scheduler-schedule-post` (1 vs 16), land. If the rereview blocks again or the A/B fails, hold t033 and go on: it is not on the exit path | both | I1 | schema gap fixed `6992da5`; split `evidence-loop.ts` (810 lines) before landing; waits for I1 |
| **I3** | t034 post-action readiness: merge `dev`, dispatch its existing brief | downstream | I1 | waiting |
| **I4** | t029 JavaScript node: held until its three review findings are fixed; after the exit | both | — | held |
| **I5** | Clean-up: `pnpm task prune`; abandon t006, t007, t017; t005 with `--force`; t021 after discarding its rejected Core prototype; remove the `F:\fxlab\t027-*` worktrees; keep t008 and t011 evidence until checked | both | I1 | waiting |
| **L0** | C0: bring Core `service.ts` under its ratchet by behaviour-unchanged moves | Core | I1, I2 decision | waiting |
| **L1** | Gap step 1: the created-Flow repair lane on `persistent-isolated`, with `--replays` for instruction tasks; proves Persist and the zero-call re-run on identity-drift | downstream | I1 | waiting |
| **L2** | C5a+C5b+D5: result verification repeats a "does not answer" once; disagreement records `unverified` | both | — | in flight |
| **L3** | D3: the Lab's `--llm-permit`, carried to the grant's `permittedConsequences` | downstream | — | in flight |
| **L4** | C3: recovery receives the permitted set; the permission gate, not `allowExternalSideEffects`, decides acting options | Core | L0, L3 | waiting |
| **L5** | C4+D4: a repair needing a side effect becomes a needs-permission request, not a preflight refusal | both | L4 | waiting |
| **L6** | Gap step 3: Resume on granted runs — record the verified trial's continuation and continue from `verdict.resumeFrom`; relax the `autoApply`-only retry for in-run use (L9) | Core | L0, L5 | waiting |
| **L7** | Gap step 4: 2.9 plumbing — `providerCallCount` and `adaptationsExercised` on every run, the 2.6 recorder wired, Lab adaptation metrics and bench rows | both | L6 | waiting |
| **N1** | CF+DL: improve an existing Flow — the instruction entry, then the edge-case entry (week-ahead to whats-new) | both | L0 | waiting |
| **N2** | CG: a repair that edits Flow structure | Core | L5, N1 | waiting |
| **N3** | CU1: run and repair permission request in the panel | Core web | L4 contract | waiting |
| **N4** | CU2: existing-Flow revision panel and structural diff | Core web | N1, N3 | waiting |
| **U1** | `ui:e2e` phase 1: briefs A-F from the UI audit (topology, Runtime Debug and adaptation assertions, extraction, failure and restart journeys, creation driver) | downstream | I1 | waiting |
| **U2** | `ui:e2e` suite and launcher; `panel:golden`'s declared stages become measured; testing-facility documentation | downstream | U1 | waiting |
| **U3** | Provider journeys P2, P5 and P6 switched on as L6, N3 and N4 land | downstream | U2 and those | waiting |
| **M1** | `week2` corpus and adaptation-cycle lane; one full corpus run and one `ui:e2e` run as the exit measurement | downstream | L7, N1, U2 | waiting |
| **M2** | X6, extraction repair: stretch, after the exit | both | M1 | stretch |

Serial chains, by shared file: Core `service.ts` I1, I2, L0, then L6 and N1
(one at a time); `recovery/annotation/annotate.ts` L0, L4, L5, N2;
`llm/execution-grants.ts` L4 after L2; `structured-response.ts` and
`deepseek-provider.ts` L5 then N2; `web/runtime/FlowRunView.tsx` N3 then N4;
downstream `live-llm/live-llm-plan.ts` L3 then N1's DL.

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

### Brief: w2x-verification-agreement
- Repository: paired task t035, `F:\fxwork\t035\!FluxIQWebExtension` and `F:\fxwork\t035\!FluxIQ`, branch `task/t035-verification-agreement` in both. `AS/` is Core `packages/fluxiq/src/programs/automation-studio/`; `TR/` is downstream `packages/test-runner/src/`.
- Task: plan step L2 — slices C5a, C5b and D5 of `reports/w2x-existing-flow-and-repair-design.md`, "Item 5". A "does not answer" from result verification is asked once more with the same evidence; the two answers combine in a new pure `result-verification/agreement.ts` exactly per that section's table; `verify_result` grants get a fixed allowance of two calls; the Lab counts verification interventions in `live-llm.json`.
- Required reads: this Current State; the design report's "Item 5" section; the sources it cites.
- Owns: Core `AS/runtime/result-verification/{verify,contracts,verdict,verification-status,run-outcome}.ts`, new `agreement.ts`, their tests; `AS/runtime/llm/grant-capabilities.ts`; `AS/runtime/llm/execution-grants.ts` (the `verify_result` allowance only); `AS/api/contracts/llm.ts`; Core web `RunDetailPanels.tsx` only to render "Unverified: the two checks disagreed". Downstream `TR/live-llm/live-llm-run.ts` and its test.
- Must not touch: Core `AS/runtime/service.ts` (over its ratchet, serial), `recovery/annotation/*`, any other file; git commits; other worktrees; shared `dev`; the user's panel, store, profile or ports 3000 and 4711.
- Live first, DeepSeek from the worktree's `.env.local`: reproduce the disagreement before changing code where feasible. Proof (a), the Core probe in the design report: verify the stored 14-of-14 `social-scheduler-week-ahead` playback 10 times — no `refuted`, and every "does not answer" is followed by a second call; negative control with the `social-scheduler-whole-queue` instruction ends `refuted` after two calls. Proof (b): `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1` twice — 14 of 14 `matchedRecords`, `resultVerification.status` `confirmed` or `unverified`, never `refuted`, the verification calls listed.
- Then focused tests (Core from inside `packages/fluxiq`), Core `check` and `build`, the downstream live-llm tests and `pnpm check`. No full suites.
- Definition of done: both proofs pass with run paths quoted; tests and checks pass; the report lists every file changed; changes left uncommitted.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-verification-agreement.md`

### Brief: w2x-lab-llm-permit
- Repository: task t036, flat worktree `F:\fxwork\t036-lab-llm-permit` (branch `task/t036-lab-llm-permit`) on the shared read-only Core `F:\fxwork\!FluxIQ`.
- Task: plan step L3 — slice D3 of the design report. Add a Lab option `--llm-permit <class,...>` that carries the named action-consequence classes into the execution grant's `permittedConsequences`, which Core already accepts (`AS/runtime/llm/execution-grants.ts:178,237`). Unknown classes are refused before any provider call. No grant carries a class nobody asked for.
- Required reads: this Current State; the design report's "Item 3" live-proof paragraph and D3 row; `TR/live-llm/{execution-grant,live-llm-plan}.ts`; `packages/test-contracts/src/llm.ts`; `scripts/lab/live-campaign.mjs`; where `--llm-*` flags are parsed (`TR/commands.ts`).
- Owns: those files and their tests. Keep any `commands.ts` or `cli.ts` hunk minimal: t033 also edits them and merges after this.
- Must not touch: Core; any other file; git commits; other worktrees; shared `dev`; the user's panel, store, profile or ports 3000 and 4711.
- Live first: `social-scheduler-schedule-post` as a `create-flow` run on `persistent-isolated`, once without the option and once with `--llm-permit` set to the class the first run requested (or `send_or_publish` if none was requested). Pass: the second grant's preflight lists exactly the requested classes, no permission request is raised for them, the Flow is created and its replay passes the oracle with `build.providerCalls == observed.calls`.
- Then focused tests for the touched files and `pnpm check`. No full suites.
- Definition of done: both runs quoted with paths; tests and check pass; changes left uncommitted.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-lab-llm-permit.md`

### Brief: w2-multi-action-schema-fix
- Repository: t033 Core worktree `F:\fxwork\t033\!FluxIQ`, branch `task/t033-multi-action-reconcile`; report in the t033 downstream worktree.
- Task: close the medium finding of `F:\fxwork\t033\!FluxIQWebExtension\docs\working\multi-action-exploration-reconcile\reports\w2-multi-action-remediation-rereview.md`: `runtime/llm/evidence-batch/input-schema.ts` accepts invalid input inside `oneOf` branches, for tuple or boolean `items`, and for boolean property schemas. Add the single schema-level check the rereview describes so an unsupported shape fails closed, with a test per case. Also make the low finding truthful: a list that exceeds the remaining action budget must not end exploration as "used every action".
- Owns: `evidence-batch/input-schema.ts`, `evidence-batch/stop.ts` if the low finding needs it, `evidence-batch/tests/contract.test.ts`; the report.
- Must not touch: any other file; git commits; other worktrees; shared `dev`; provider or browser.
- Definition of done: the evidence-batch contract tests and the evidence-loop tests pass from inside `packages/fluxiq`; singleton and default-one behaviour unchanged; changes left uncommitted. No live run: nothing reaches this path until the A/B, which follows.
- Report to: `F:\fxwork\t033\!FluxIQWebExtension\docs\working\multi-action-exploration-reconcile\reports\w2-multi-action-schema-fix.md`

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

### 2026-09-21 — Execution plan written; four code workers dispatched
- Agent: supervisor; workers `w2x-exit-loop-gap-audit`, `w2x-existing-flow-and-repair-design`, `w2-multi-action-remediation-rereview`
- Changed: Current State rewritten with the exit definition; new Execution Plan (phases I, L, N, U, M); briefs `w2x-verification-agreement`, `w2x-lab-llm-permit`, `w2-multi-action-schema-fix`; tasks t035 (paired) and t036 (flat) started.
- Why: the audits show the chain stops at Generate Repair because Core forbids Recover and Resume on every granted run; the plan orders the Core changes around the `service.ts` bottleneck and starts the pieces that touch no shared file.
- Validation: Core `dev` `runtime/service.ts:3081` read `input = { ...input, adaptiveMode: "manual_approval", authorizedExternalSideEffects: false };`; lines 3224 and 3278 read `adaptationContext && !input.llmExecution ? await this.retryRuntimeSessionAfterAutoAppliedPatch(` and `input.llmExecution ? null : await this.retryRuntimeSessionAfterAutoAppliedPatch(`; `live-patch.ts:140-141` pushes the side-effect refusals; `pnpm task start verification-agreement --worktree --core` printed `"id":"t035"` and `pnpm task start lab-llm-permit --worktree` printed `"id":"t036"`.
- Outcome: Partial
- Follow-up: verify each worker before landing; I1 first.

### 2026-09-21 — t033 rereview cleared; schema gap fixed
- Agent: supervisor; workers `w2-multi-action-remediation-rereview`, `w2-multi-action-schema-fix`
- Changed: t033 Core `6992da5` (input-schema fails closed on unsupported shapes, `__proto__`, `-0`, code-point lengths; supervisor made the `action_limit` sentence true for an over-budget list); t033 downstream `74c509f` (both reports).
- Why: the rereview found every earlier finding fixed and one medium fail-open schema gap.
- Validation: `npx vitest run .../evidence-batch/tests/contract.test.ts .../llm/tests/evidence-loop.test.ts` from `packages/fluxiq` printed `Tests  54 passed (54)`; `npx vitest run .../recovery/tests/runtime-exploration.test.ts .../recovery/tests/exploration-budget.test.ts` printed `Tests  62 passed (62)`; `git show HEAD:.../llm/evidence-loop.ts | wc -l` printed `810`.
- Outcome: Partial
- Follow-up: after I1 lands, merge `dev` into t033, split `evidence-loop.ts` under 800 lines, run the live A/B.

---

## Open Questions

- None.
