# Week 2 Exit Plan

Status: Active
Status detail: t027 in gate triage before landing; t033, P1, L0, L1 running speculatively from its tip; ten realistic-scenario workers and t035 in flight.
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

**In flight:** `w2x-t027-gate-triage` (t027's builds pass; tests fail 3
downstream and 5 in Core web, plus test-runner's stale `dist`); speculatively
from t027's tip: `w2x-t033-land` (I2), `w2x-creation-permission-lost` (P1,
t047), `w2x-created-flow-repair-lane` (L1,
t049, with t036 merged in); `w2x-recovery-permissions` (L4, t050, on L0's Core);
ten
`w2x-realistic-scenarios` workers (S1, t037-t046). Machine limit: 12 threads,
26 GB, about 8 GB free under this load; U1 and I3 dispatch as scenario workers
finish.

**Next:** land t027 when triage is green; merge t036; then each speculative
task re-merges `dev`.

**Blockers:** none.

---

## Execution Plan

Slice names C0-CU2, D3-DL are defined in `reports/w2x-existing-flow-and-repair-design.md`;
steps 1-4 of the gap audit are in `reports/w2x-exit-loop-gap-audit.md`
("Smallest ordered set of changes"). Every slice proves itself live first, on
the scenario its report names, then runs its focused tests. There is no fixed
worker cap (user, 2026-09-21): a worker is added whenever it shortens wall-clock
time without duplicated work, a shared file, or idling on an unlanded dependency.

| Id | Work | Repos | After | Status |
| --- | --- | --- | --- | --- |
| **I1** | Land t027 without its first-generation batch surface | both | — | in flight |
| **I2** | t033: rereview, merge `dev`, same-code live A/B on `social-scheduler-schedule-post` (1 vs 16), land. If the rereview blocks again or the A/B fails, hold t033 and go on: it is not on the exit path | both | I1 | schema gap fixed `6992da5`; split `evidence-loop.ts` (810 lines) before landing; waits for I1 |
| **I3** | t034 post-action readiness: merge `dev`, dispatch its existing brief | downstream | I1 | waiting |
| **I4** | t029 JavaScript node: held until its three review findings are fixed; after the exit | both | — | held |
| **I5** | Clean-up: `pnpm task prune`; abandon t006, t007, t017; t005 with `--force`; t021 after discarding its rejected Core prototype; remove the `F:\fxlab\t027-*` worktrees; keep t008 and t011 evidence until checked | both | I1 | waiting |
| **P1** | Creation without a permit ends in HTTP 400 (`lab.generation_http_400`, t036 run `run-mubktq9k-5cb2485b`) instead of a permission request reaching the person; Core's generation handler appears to drop the cause. Reproduce live, then make it a first-class needs-permission outcome | both | I1 | waiting |
| **S1** | Ten purposefully difficult realistic sites (user, 2026-09-21), one worker each, merged to `dev` and put into live testing as they finish | downstream | — | in flight |
| **L0** | C0: bring Core `service.ts` under its ratchet by behaviour-unchanged moves | Core | I1 | done on t048 (`56d6106`, 6,381 -> 6,275 lines); lands after I1 |
| **L1** | Gap step 1: the created-Flow repair lane on `persistent-isolated`, with `--replays` for instruction tasks; proves Persist and the zero-call re-run on identity-drift | downstream | I1 | waiting |
| **L2** | C5a+C5b+D5: result verification asks once more after any non-yes answer; only no,no refutes; an empty result is recorded as not checked | both | — | done on t035 (`571f9d4` Core, `cf54c30` downstream); lands after I1 |
| **V1** | Judge an empty result against the instruction (an empty table can be the right answer) instead of leaving it unchecked; needs the grant-revalidation hang t024 found in provider resolution fixed first; also remove the empty-record refutation in `result-verification/core-observation.ts`, which `verify` can no longer reach | Core | L2 | waiting |
| **L3** | D3: the Lab's `--llm-permit`, carried to the grant's `permittedConsequences` | downstream | — | in flight |
| **L4** | C3: recovery receives the permitted set; the permission gate, not `allowExternalSideEffects`, decides acting options | Core | L0, L3 | in flight on t050 (`w2x-recovery-permissions`) |
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

### Brief: w2x-realistic-scenarios (shared by ten workers, one site each)
- Repository: the worker's own flat task worktree from the table, on the shared read-only Core `F:\fxwork\!FluxIQ`.
- Task: build **one legitimately complex Scenario Lab site** replicating a kind of site people really automate (user, 2026-09-21), as a fictional brand modelled on its archetype — no real names, logos or copied content.

| Scenario id | Archetype | Task and worktree |
| --- | --- | --- |
| `social-network-feed` | social feed like Facebook | t037 `F:\fxwork\t037-realistic-scenarios` |
| `photo-social` | photo social like Instagram | t038 `F:\fxwork\t038-scn-photo-social` |
| `bigbox-retail` | big-box retail like Walmart | t039 `F:\fxwork\t039-scn-bigbox-retail` |
| `auction-marketplace` | auctions like eBay | t040 `F:\fxwork\t040-scn-auction-marketplace` |
| `everything-store` | everything store like Amazon; carries the hard anti-bot challenge | t041 `F:\fxwork\t041-scn-everything-store` |
| `crossborder-marketplace` | cross-border marketplace like AliExpress | t042 `F:\fxwork\t042-scn-crossborder-marketplace` |
| `professional-network` | professional network like LinkedIn | t043 `F:\fxwork\t043-scn-professional-network` |
| `local-classifieds` | local classifieds like Facebook Marketplace | t044 `F:\fxwork\t044-scn-local-classifieds` |
| `company-website` | an ordinary small-company website | t045 `F:\fxwork\t045-scn-company-website` |
| `job-board` | job postings whose Apply hands off to an applicant-tracking site | t046 `F:\fxwork\t046-scn-job-board` |

- Realism bar, at least six per site: consent banner; newsletter, app-install or notification modals on a delay; a login wall after some scrolling; a chat widget covering a button; lazy loading and infinite scroll; sponsored results mixed into real ones; class names obfuscated per seed; skeleton or delayed rendering; real UI bugs (a button needing a second click, a spinner that clears only on retry, a broken Next that needs page links, a stale count badge); anti-bot (honeypot fields, rate limiting with retry-after, a "verify you are human" interstitial that clears on a wait or a click); iframes; shadow DOM; new tabs; variant pickers; locale-formatted prices and dates; div-buttons with poor accessibility. Anti-bot must be passable by honest behaviour; the hard challenge's correct outcome is asking the person, never bypassing it.
- At least three Lab tasks: an extraction task judged by `expected.extracted`; a state-changing task judged by final state; a consequential task (buy, bid, apply, message, delete) that must end in a permission request unless granted. Plus one drift variant (repair entry point) and one edge-case variant (new popup, empty results, alternate layout) for the existing-Flow entry point.
- Conventions: copy the shape of `apps/scenario-lab/src/scenarios/social-scheduler/` and `storefront-checkout/`; deterministic under `SCENARIO_LAB_SEED`; loopback only; the structure audit's budgets (one export per file, barrels, tests in `tests/`). Tasks go in `src/scenarios/<id>/live-tasks.ts` and `repair-tasks.ts`; add **exactly one appended line** each to `src/registry.ts`, `src/scenarios/index.ts`, `live-instructions.ts` and `live-repair-tasks.ts`, and one appended row to `docs/architecture/testing-facility.md`'s scenario list, so the supervisor's merges are one-line unions.
- Owns: `apps/scenario-lab/src/scenarios/<id>/` and those one-line additions. Must not touch anything else, other worktrees, git commits, shared `dev`, the user's panel or ports 3000 and 4711.
- Validation, in order: a scenario test proving an honest scripted path passes every oracle and a naive path (fills the honeypot, clicks under the overlay, takes a sponsored row) fails; then one live `create-flow` run of the extraction task with DeepSeek on `persistent-isolated`. FluxIQ failing is fine; the report separates fixture defects (fix them) from product gaps (record them). Then the scenario-lab tests and `pnpm check`.
- Definition of done: the site, its tests and `pnpm check` passing, the live run quoted with path and oracle result; changes left uncommitted.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-scenario-<id>.md`

### Brief: w2x-t027-gate-triage
- Repository: the t027 worktrees `F:\fxwork\t027\!FluxIQWebExtension` and `F:\fxwork\t027\!FluxIQ`, branch `task/t027-multi-action-exploration` in both.
- Task: make both repositories' full gates green on t027 so it can land. Known from the supervisor's `pnpm -r --no-bail test` runs: downstream `packages/test-runner` 3 failures — `generation failures retain only Core-validated bounded diagnostics` (`demo-llm-create-ui/tests/failure-sanitizer.test.ts`), `a dataset task is built, settled, applied, run on a freshly presented page, and passes on the records it stored` (`flow-lane/creation/tests/lane.test.ts`; `dev` fails it too), `rejects reused, applied, cross-scope, and over-budget proposals` (`tests/demo-llm-exploration-adaptation.test.ts`); Core `apps/web` 5 failures — three `login attempt bounds` cases in `app/api/auth/login/tests/route.test.ts`, `runs graph conversion only while a graph subscriber is mounted`, `source contract: connector domain scopes are destination-local`. Core `fluxiq` has one known failure owned by t035 (`result-verification/tests/run-outcome.test.ts`, "stored nothing") — leave it; and three load-induced timeouts that pass alone.
- First, the mechanical fix the Week 2 document lists as open item 9: `packages/test-runner`'s build never clears `dist`, so deleted and moved tests keep running. Make its `build` remove `dist` before compiling (keeping `domain:dist`), and show a deleted test no longer runs.
- Then fix every failure at its root cause, whether t027 introduced it or `dev` already had it; say which for each, using `git log dev..HEAD` on the implicated files. Never weaken an assertion. Where a test encodes a contract t027 deliberately changed, update it and keep its safety assertions, as the supervisor did for the generation-lock code in `510680f`. A failure that passes alone under no load is a timeout, not a fix: report its duration.
- Validation: downstream `pnpm -r --no-bail test` and `pnpm build`; Core `pnpm -r --no-bail test` (only the t035-owned failure may remain) and `pnpm build`; quote the per-package counts.
- Owns: the files these fixes need in the two t027 worktrees. Must not touch: `result-verification/*`, other worktrees, git commits (leave changes uncommitted), shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-t027-gate-triage.md`

**Speculative bases (supervisor, 2026-09-21).** So nothing waits on t027's triage, P1 runs in t047, L0 in t048 and L1 in t049, each paired worktree under `F:\fxwork\t04N\` with both branches at t027's tip (t049 also carries t036); t033 merges `task/t027-multi-action-exploration` instead of `dev`. Each re-merges `dev` once t027 lands.

### Brief: w2x-t033-land
- Repository: paired t033 worktrees `F:\fxwork\t033\!FluxIQWebExtension` and `F:\fxwork\t033\!FluxIQ`, branch `task/t033-multi-action-reconcile` in both. Starts once t027 is on `dev` in both repositories.
- Task: plan step I2. Merge `dev` into both t033 branches with `git merge --no-commit` and resolve: t033 is authoritative for the multi-action contract; `dev` (now carrying t027) is authoritative for everything t027 kept — categorical pre-provider codes, `llmEvidenceRuntime` inside bootstrap readiness, the grant-issue mapping, the bounded terminal repair outcome, the resolver contract. Then bring Core `runtime/llm/evidence-loop.ts` (810 lines) under the 800-line limit by a behaviour-unchanged extraction. `service.ts` must not grow past its 6,381-line baseline.
- Live first: the same-code A/B on `social-scheduler-schedule-post`, seed 171, arms `1` and `16`, fresh isolated state per arm, $1 grant each, `FLUXIQ_TEST_ENV_FILES=none`. Pass: both arms create Flows whose replays pass the oracle with `build.providerCalls == observed.calls`; the `16` arm completes at least two ordered actions in one provider decision; usage counted once; state records ordered. Report calls, actions, stop reason, wall clock and cost per arm. If the variant only emits lists without completing two actions, say so: t033 is then held, not forced.
- Then focused tests (Core from inside `packages/fluxiq`), both repositories' `check` and `build`. No full suites.
- Owns: the merge resolution and the `evidence-loop.ts` split in the two t033 worktrees; the report. Must not touch: other worktrees, git commits (leave the merge staged and uncommitted), shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-t033-land.md`

### Brief: w2x-creation-permission-lost
- Repository: a paired task started from `dev` after t027 lands (supervisor creates it). `AS/` is Core `packages/fluxiq/src/programs/automation-studio/`.
- Task: plan step P1. A `create-flow` build of `social-scheduler-schedule-post` without a permit ended `lab.generation_http_400` (t036 run `F:\fxwork\t036-lab-llm-permit\test-runs\run-mubktq9k-5cb2485b`) instead of a permission request reaching the person. Reproduce it live first, find where the cause is lost (suspected: `AS/api/handlers/llm-generation.ts` collapsing `flow_bootstrap.permission_required`), and make needing permission a first-class outcome of creation: Core returns a closed permission-request result naming the missing consequence classes; the panel's existing permission-continuation dialog shows it; the Lab reports `permission.required` with those classes instead of an HTTP failure.
- Live proof, `FLUXIQ_TEST_ENV_FILES=none`: the same build without a permit ends in a permission request naming the missing class, with no Flow mutation; the same build with `--llm-permit <that class>` creates the Flow and its replay passes the oracle.
- Then focused tests and both repositories' `check`. Core `service.ts` must not grow past its baseline; add behaviour in focused modules.
- Owns: the handler, `flow-bootstrap/generation-failure.ts`, the Lab's creation result reading, their tests; the report. Must not touch: `recovery/*`, `result-verification/*`, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-creation-permission-lost.md`

### Brief: w2x-service-headroom
- Repository: a Core-paired task started from `dev` after t027 lands. Slice C0 of `reports/w2x-existing-flow-and-repair-design.md`.
- Task: plan step L0. Make room in Core `AS/runtime/service.ts` (6,381 lines, ratchet 6,381) for L4, L6 and N1 by behaviour-unchanged moves: the review projection (about lines 6021-6128 in the design report's numbering; re-locate by content) to a new `flow-bootstrap/review-projection.ts`, plus the port rebinding and `recovery/annotation/{ports,annotate}.ts` adjustments the design names. No behaviour change, no new exports beyond the moved code, barrels updated. Lower the ratchet with `pnpm structure:baseline` in Core.
- Live proof: one `pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1` with `FLUXIQ_TEST_ENV_FILES=none`: build, apply and review projection unchanged — 14 of 14 `matchedRecords`, `build.providerCalls == observed.calls`.
- Then the service-bootstrap, service-flows and recovery annotation tests from inside `packages/fluxiq`, Core `check` and `build`.
- Owns: `service.ts`, the new module, the two annotation files, barrels, their tests. Must not touch: anything t033 or P1 owns, other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-service-headroom.md`

### Brief: w2x-created-flow-repair-lane
- Repository: a downstream task started from `dev` after t027 and t036 land. `TR/` is `packages/test-runner/src/`.
- Task: plan step L1, gap step 1 of `reports/w2x-exit-loop-gap-audit.md`. Give created Flows the Lab's repair lane: call `runLiveRepairLane` after `runCreatedFlowLane` in `TR/run-scenario.ts`, accept the created lane's repair grant in `TR/flow-lane/repair/run-repair-lane.ts`, make `repairsFlow` true for `create-flow` in `TR/live-llm/live-llm-run.ts`, and let `--replays` through for instruction tasks in `TR/commands.ts` and `scripts/lab/live-campaign/**`. The lane approves and applies the repair as the reviewer, then replays with no provider key.
- Live proof on `identity-drift-rename-redesigned-after-creation`, `persistent-isolated`, `FLUXIQ_TEST_ENV_FILES=none`: the build (calls counted), the drift failure, a repair proposal, approval and apply, then `pnpm lab replay` with no key passing the oracle with zero calls. If Core never proposes a patch (`llm.runtime_patch_not_requested`), record the code and the calls: that is L4-L6's gap, not this lane's.
- Then focused test-runner tests and `pnpm check`.
- Owns: those files and their tests; the report. Must not touch: Core, scenario-lab, other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-created-flow-repair-lane.md`

### Brief: w2x-ui-e2e-foundation
- Repository: a downstream task started from `dev` after t027 lands. `TR/` is `packages/test-runner/src/`. Design: `reports/w2x-ui-e2e-audit.md`, "Proposed Week 2 end-to-end UI suite", briefs A, B and C.
- Task: plan step U1, first half. (A) `TR/ui-e2e/topology.ts`: one Core, panel, gateway and browser topology kept across adjacent journeys, on ports from `allocateLoopbackPort` plus `assertLoopbackPortBindable`, never the fixed demo defaults, never 3000 or 4711; a run-scoped root holding store, profiles and a pinned extension build; provider secrets only in provider journeys. Split start and stop out of `demo-workspace/core-process.ts`'s `withPersistentDemoCore` and let `demo-workspace/configuration.ts` accept the allocated origin and gateway. (B) `TR/ui-e2e/assertions/runtime-debug.ts`: the run row and Action Log show the same run id, status, action count and attempt rows, and the view refreshes without a reload — promoted from the disposable observers the audit cites. (C) `TR/ui-e2e/assertions/adaptations.ts`: adaptation history rows and statuses, the "Changed fields" before/after table, UI Revert and Reject with PIN. Every assertion reads the DOM and Core together and returns closed codes, never page text.
- Live proof, `FLUXIQ_TEST_ENV_FILES=none`: one provider-free record, generate, run pass on `basic-form` through the new topology with (B) passing, and one apply-then-UI-revert on an existing adaptation with (C) passing. Report timings.
- Then tests in `TR/ui-e2e/**/tests/` and `pnpm check`.
- Owns: `TR/ui-e2e/topology.ts`, `TR/ui-e2e/assertions/**`, `demo-workspace/{core-process,configuration}.ts`, their tests. Must not touch: journeys, `demo-llm-create-ui/**`, `panel-golden-path/**`, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-ui-e2e-foundation.md`

### Brief: w2x-ui-e2e-journeys
- Repository: a downstream task started from `dev` after t027 lands. Same design section, briefs D, E and F.
- Task: plan step U1, second half. (D) `TR/ui-e2e/journeys/extraction.ts`: pick a repeating structure in the extension, confirm fields, record, generate, run, then judge the stored dataset with `run-expectations/extraction/judgement.ts` — pass only when `matchedRecords === expectedRecords` — plus the panel preview rows and non-empty CSV and JSON exports. (E) `TR/ui-e2e/journeys/failure-presentation.ts` (arm drift, run with No LLM intervention, the Action Log shows `Failed`, the failed attempt and its closed terminal reason) and `TR/ui-e2e/journeys/restart-reuse.ts` (stop Core and gateway, prove both ports closed, restart, reconnect, find the saved Flows, rerun with identical identities, zero provider activity, and the same dataset digest). (F) `TR/demo-llm-create-ui/explore-proposal-ui.ts`: assert the ordered progress states and add a refuse path for the permission dialog. Use the existing `withPersistentDemoCore` topology for now; the suite owner rewires to the new topology.
- Live proof, `FLUXIQ_TEST_ENV_FILES=none`: (D) on `product-catalog` with the record oracle; (E) on `instruction-only-form` drift and a full restart; (F) one provider creation run on `instruction-only-form` asserting progress order. Report timings and any flakiness.
- Then tests in the owning `tests/` folders and `pnpm check`.
- Owns: `TR/ui-e2e/journeys/**`, `TR/demo-llm-create-ui/explore-proposal-ui.ts` and `tests/exploration.test.ts`. Must not touch: topology, assertions, `demo-workspace/{core-process,configuration}.ts`, `panel-golden-path/**`, other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-ui-e2e-journeys.md`

### Brief: w2x-recovery-permissions
- Repository: paired task t050, `F:\fxwork\t050\!FluxIQWebExtension` (t027's tip plus t036's `--llm-permit`) and `F:\fxwork\t050\!FluxIQ` (t027's Core plus L0 `56d6106`). `AS/` is Core `packages/fluxiq/src/programs/automation-studio/`.
- Task: plan step L4, slice C3 — "Item 3" of `reports/w2x-existing-flow-and-repair-design.md`. One permission gate per recovery, built once the provider resolves, whose authority is the grant's `permittedConsequences` plus the Flow's stored, still-current instructed set; exploration and the patch stage share it. `execution-grants.ts` `resolve()` returns `permittedConsequences`; the provider resolution type (now in `AS/runtime/llm/resolver-contract.ts`, not `provider-resolution.ts`) carries it; new `AS/runtime/recovery/annotation/permissions.ts` builds the gate; `annotate.ts` passes it to exploration and, when `gate.request` is set, skips the patch call with `llm.runtime_patch_permission_required` and records `metadata.permissionRequest` (stage `recovery`) and `llmGate.permissions`; `exploration.ts` and `runtime-exploration.ts` take the gate; `harness-options/registry.ts` offers `mutate` options when mutations are governed by permission, never `destructive`. `policy.allowExternalSideEffects` stops being read on the recovery path; add that line to Core `docs/architecture/automation-studio.md`. The design's line numbers predate t027 and L0: locate by content.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `order-operations-repair-relabelled-dispatch` with `--llm-task repair`: (1) no permit — `llmGate.permissions.granted` is `[]`, a lasting press such as "Pick and pack" ends the recovery with a `metadata.permissionRequest` whose `missing` is non-empty, and nothing is dispatched; (2) `--llm-permit <those classes>` — `granted` lists them, no request is raised, the press appears in the trace. Report whether a patch was then proposed and its outcome code: L5 and L6 build on this.
- Then focused tests from inside `packages/fluxiq` (annotation, runtime-exploration, harness-options registry, execution-grants), Core `check` and `build`, downstream `pnpm check`. `service.ts` must not grow past 6,275 lines.
- Owns: the Core files named above and their tests; the architecture line. Must not touch: `result-verification/*`, `live-patch.ts`, `flow-bootstrap/*`, downstream source, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-recovery-permissions.md`

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

### 2026-09-21 — t027 verified and committed; t036 verified; ten scenario workers
- Agent: supervisor; workers `w2x-t027-reconcile`, `w2x-lab-llm-permit`, `w2x-realistic-scenarios` (ten)
- Changed: t027 Core `f40f78e` and downstream `f1db4e9` (reconciliation; Core `service.ts` baseline lowered 6,404 -> 6,381); t036 `fa8b686`; tasks t037-t046 started; plan rows P1 and S1; the inherited four-worker cap removed (user, 2026-09-21).
- Why: the user asked for more workers where they save time, one worker per realistic site, and scenarios that are purposefully difficult.
- Validation: t027 bundles `demo-llm-explore-...-1ea03e`, `demo-llm-exploration-request-run-...-e5af83` and `demo-playback-...-48bf10` each read `"verdict":"passed"` in `summary.json`; a grep of the added lines of `git diff dev -- . ':!docs'` for the five batch identifiers printed `0` in both t027 trees; `wc -l .../runtime/service.ts` printed `6381`; Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (170 warning(s), 361 baselined).`; t036 `run-mubl2o09-5679c7f2` read `{"build":5,"observed":5,"permissionRequest":null}` and `"oracleVerdict": "passed"`.
- Outcome: Partial
- Follow-up: land t027 when both gate runs pass. Every live-running worker was told to set `FLUXIQ_TEST_ENV_FILES=none`, because task worktrees copy `.env.local`, which targets the user's panel.

### 2026-09-21 — Gate triage on t027; dev test fixes; wave two speculative
- Agent: supervisor
- Changed: `dev` `5fa870a` (content stub page gains fallback table classes; 14 extension tests had failed since `3ee5e1d`); t027 Core `510680f` (generation-lock test expects the categorical code, safety assertions kept); t027 downstream `9617103` (merge `dev`); tasks t047-t049 from t027's tip; briefs for triage and wave two.
- Why: t027's first full gate run failed; triage showed `dev` itself carried broken suites, and waiting on triage would idle the critical path.
- Validation: `pnpm --filter @fluxiq-web-extension/extension test` on `dev` printed `# fail 14` before and `# tests 688`, `# pass 688`, `# fail 0` after; t027 accounting test printed `Tests  8 passed (8)`; Core `dev` `run-outcome.test.ts` "stored nothing" printed `expected 'succeeded' to be 'failed'` (handed to t035); t027 rerun printed downstream `test=1 build=0` with `packages/test-runner` `# fail 3`, and Core `test=1 build=0` with `apps/web` `Tests  5 failed | 1240 passed (1245)`.
- Outcome: Partial
- Follow-up: land t027 on a green triage.

### 2026-09-21 — Result verification: re-ask "unknown", never pass an empty result silently
- Agent: supervisor; worker `w2x-verification-agreement`
- Changed: decisions sent back to the t035 worker; plan row V1.
- Why: live, the flip at temperature 0 is yes/unknown, not yes/no, so the designed table still refuted correct runs; and "fail every empty extraction" is wrong, because an instruction can allow an empty table and schedule-post's empty set comes from its own extract step.
- Decision: re-ask any non-yes first answer once; one yes in the pair records `unverified` (`model_disagreed`); two non-yes answers that are not both `no` record `unverified` (`model_unconfirmed`); only no,no refutes; a silent or unavailable first call still fails closed. An empty result keeps t024's provider-free path but records verification not performed with `core.result.no_records` and says so in run detail.
- Validation: `F:\r35\run-mublcbqf-9e815106` read matched 14 of expected 14, `"oracleVerdict": "passed"`, `{"build":4,"observed":4}`, yet the product's verification recorded `refuted` on a single `unsure` — a false failure.
- Outcome: Partial
- Follow-up: verify t035's live rerun (probe ×10 with zero refuted; `data-table-inventory-empty` not failed).

### 2026-09-21 — L2 verified and committed on t035
- Agent: supervisor; worker `w2x-verification-agreement`
- Changed: t035 Core `571f9d4`, downstream `cf54c30`.
- Why: the product's own result check refuted correct runs on a single `unknown`.
- Validation: `npx vitest run .../result-verification .../llm/tests/verify-result-grant.test.ts` from t035 `packages/fluxiq` printed `Tests  66 passed (66)`; `F:\r35\run-mubmkp4x-d4fadf21` (`data-table-inventory-empty`) read `{"verdict":"passed","oracle":["passed"],"matched":[0],"expected":[0],"build":3,"observed":3}` with `core.result.no_records` in `live-llm.json`; the worker's probe of the stored 14-of-14 run confirmed 20 of 20.
- Outcome: Done
- Follow-up: land after t027; V1.

### 2026-09-21 — L0 verified and committed on t048; L4 dispatched
- Agent: supervisor; worker `w2x-service-headroom`
- Changed: t048 Core `56d6106` (review projection moved out of `service.ts`, ratchet 6,381 -> 6,275); task t050 (L4) from t049's downstream and t048's Core; brief `w2x-recovery-permissions`.
- Why: `service.ts` headroom was the gate on every later Core step; L4 is next on the critical path to Recover.
- Validation: `wc -l .../runtime/service.ts` on t048 printed `6275`; Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (170 warning(s), 361 baselined).`; `run-mubme2r4-81910603` read `{"verdict":"passed","oracle":["passed"],"matched":[14],"expected":[14],"build":5,"observed":5}`. The campaign's playback made one result-verification call; the Flow's steps made none, and the exit criterion's re-run is keyless.
- Outcome: Done (L0)
- Follow-up: land after I1.

---

## Open Questions

- None.
