# Week 2 Exit Plan

Status: Active
Status detail: E1 round 1 complete on all ten sites (no instruction-built Flow replayed; every cause has an owner); fourteen fix workers in flight; E2 after they land.
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

**E1 round 1 result (all five lanes, all ten sites, 2026-09-21).** Not one
instruction-built Flow reached a passing deterministic replay: about 70
creation attempts (Lab and real panel) built one Flow (lane B, everything-store
via the panel), and it failed on replay (P17). Provider-free recorded Flows
passed 3 of about 35 recording-lane runs, all on social-network-feed
(confirm-requests 4/4, move-open-day 1/1). No permission-request ending was
observed, because no consequential task reached its gated control. Spend about
$2.6, no HTTP 429s, `build.providerCalls == observed.calls` in every build.
Ranked causes: P2's build-ending failed tool call (most tasks); the 64 KB
evidence cap, which also masqueraded as P2 (P7); the 26-call cap (P11);
repeat-without-progress with ambiguous handles (P18); the Lab probe race (P8);
dismissible modals classed as needing a person (P9); recorded targets that are
ambiguous or inside shadow roots (P10); extraction across page loads (P15);
Lab and site defects (P13, P16, P19); and a created Flow that dropped the
steps exploration needed while a navigate claimed success (P17). Reports:
`reports/w2x-e2e-lane-{a..e}.md`.

**In flight:** P11 (t057), L5 (t059), N3 (t060), P8 (t061), P9 (t062), P10
(t063), P15 (t064), P17 (t065), P13a (t066), P13b/P16/P19 (t067), U1 (t068,
t069), P18 (t070). Done and waiting to land after round 1's Core hold: t033,
t047, t049, t050, t051. Landed today: t027, t035, t036, t048, all ten sites,
t058.

**Next:** land the held work and each fix as it verifies; then E2, the same
campaign on the fuller product.

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
| **I1** | Land t027 without its first-generation batch surface | both | — | **done**: downstream `Merge task t027`, Core `278c44b` |
| **I2** | t033: rereview, merge `dev`, same-code live A/B on `social-scheduler-schedule-post` (1 vs 16), land. If the rereview blocks again or the A/B fails, hold t033 and go on: it is not on the exit path | both | I1 | live A/B passed: arm 1 `run-mubmnrhq-f3f577eb`, arm 16 `run-mubo9tco-90f098f6` (one decision completed 4 ordered field entries; 4 build = 4 observed); resolution staged in t033 worktrees; lands next |
| **I3** | t034 post-action readiness: merge `dev`, dispatch its existing brief | downstream | I1 | waiting |
| **I4** | t029 JavaScript node: held until its three review findings are fixed; after the exit | both | — | held |
| **I5** | Clean-up: `pnpm task prune`; abandon t006, t007, t017; t005 with `--force`; t021 after discarding its rejected Core prototype; remove the `F:\fxlab\t027-*` worktrees; keep t008 and t011 evidence until checked | both | I1 | waiting |
| **P1** | Creation without a permit ends in HTTP 400 (`lab.generation_http_400`, t036 run `run-mubktq9k-5cb2485b`) instead of a permission request reaching the person; Core's generation handler appears to drop the cause. Reproduce live, then make it a first-class needs-permission outcome | both | I1 | partial on t047: premise did not reproduce; fixed the real 400 (a successful build over 64k accounted tokens was rejected after its proposal was built; `f932e40`); Lab reads `permission.required` (`f3646ef`); live request unobserved because of P3 |
| **S1** | Ten purposefully difficult realistic sites (user, 2026-09-21), one worker each | downstream | — | **done**: all ten on `dev` (`08e7dc6`, 41 registered scenarios); `live-instructions.ts` is at 775 of 800 lines and must be split before more tasks are added; two combined-suite runs each had one flaky failure that passed on rerun (identify it) |
| **E1** | Extensive live end-to-end testing on all ten sites (user, 2026-09-21): recording lane, every instruction task, every repair task, one real-panel creation per site; baseline before P2 | downstream | S1 | in flight: five lanes t052-t056 (`w2x-e2e-live-campaign`) |
| **E2** | The same campaign again once P2, L4 and the waiting fixes land, to measure how far FluxIQ gets past the first tool failure | downstream | E1, P2 | waiting |
| **P8** | Lab: the Core action probe types into the site's field on a fresh automation tab where the site's delayed overlays have come back, so recording never starts (5 of 6 lane C recording lanes) | downstream | — | in flight on t061 (`w2x-lab-probe-race`) |
| **P11** | Builds stop at 26 decisions on `evidence_iteration_limit` while still progressing, and the model is never told its remaining budget; recovery keeps a 262,144-byte total cap. Bound by cost, tokens, deadline and progress, with any call ceiling a far-away backstop (user decision, "The fixed call limit was the defect") | Core | P7 | in flight on t057 (same worker) |
| **P10** | Recorded Flows cannot replay their honest path: an ambiguous stored target (company-website chat Close, 7 equal matches) and a step's expected state taken from a later step (local-classifieds cookie click) ; plus a recorded click inside an open shadow root that does not resolve on replay (job-board consent) | downstream | — | in flight on t063 (`w2x-recording-fidelity`) |
| **P12** | Repeating-structure detection fails on company-website's team cards and the model repeats the call; the panel shows only a generic error after a failed build | both | — | waiting |
| **P13** | Lab: scripted navigation refuses URLs with a query string; no run file records which classes `--llm-permit` granted; the Lab counts the initial observation as a decision and flags budget-using builds `performance.budget`; recording events reach Core about one per second, past the Lab's fixed 90 s wait | downstream | P8 | waiting |
| **P15** | `extract_list` loses its read when Next loads a new document, and numbered pagination ends on a loading skeleton (selector audit, bigbox `pickup-towels`) | downstream | — | in flight on t064 (`w2x-extract-across-pages`) |
| **P16** | Scenario-lab browser-path tests for auction, crossborder and professional-network fail under load in the combined suite and pass alone; also job-board's frame-target extract step is refused `fixture.invalid` by the Lab (fold into P13) | downstream | — | waiting |
| **P17** | The campaign's only created Flow (lane B E9, everything-store via the panel) cannot replay: its navigate reported success while the tab stayed on the start page, and the Flow kept none of the overlay dismissals exploration needed | both | — | in flight on t065 (`w2x-created-flow-fidelity`) |
| **P18** | Exploration hands the model ambiguous handles on duplicated labels (`web.handle.ambiguous` in 6 of lane B's 12 builds), which feeds the repeat-without-progress stalls | both | — | waiting |
| **P19** | Site defect: everything-store's recording script clicks the cookie Accept after the 4 s notifications prompt has covered the page, stopping its recording lanes and both repair tasks | downstream | — | waiting (with P13/P16) |
| **P9** | A dismissible promotion modal is classed `web.intervention.required`, so Core's `llm.gate.manual_intervention` gives the model 0 calls; only a challenge a person must answer (the robot check) should be | both | P2 | in flight on t062 (`w2x-dismissible-dialogs`) |
| **P7** | After P2, builds end `evidence_limit` after 10-15 calls: the loop caps total evidence over the whole build at 64,000 bytes. Replace with a bounded per-request context window (newest evidence plus closed summaries), total bounded only by cost, tokens, deadline and progress | Core | P2 | done on t057 (uncommitted): 5 live runs, no `evidence_limit` or false `tool_failed`; builds ran 26 decisions over up to 153,142 bytes, then stopped on the call count |
| **P2** | A failed exploration tool call ends the whole build and is missing from the trace (`evidence-loop.ts` catch sites; domain throws on covered controls `capture.ts:128` and oversized snapshots `sanitize.ts:276`) — the failure on every realistic site | both | — | done on t051 (`0080aca` Core, `363d536` downstream): `run-mubp3phh-cf4643fd` recorded `web.action.rejected.blocked_by_dialog`, the model pressed Not now next, 15 build = 15 observed; lands after E1 round 1 |
| **P3** | The web domain never checks a created Flow's own steps for permission (`resolve-plan-node.ts` has no permission field; design report open question 4, F7), so a created Flow can publish, refund or delete on every run unasked | both | I1 | waiting — next dispatch |
| **P4** | Lab: judge "this task correctly ends in a permission request" (every realistic site's consequential task needs it); record usage when a proposal read fails (`build-proposal.ts:161`, `run-scenario.ts:340-352`) | downstream | — | waiting |
| **P5** | `extract_list` cannot de-duplicate across pagination; Core discards the inner error behind `flow_bootstrap.provider_transport_unknown` | both | — | waiting |
| **P6** | Mechanical: Core has no `.gitattributes` (worktrees check out CRLF, breaking source-contract tests); Core `pnpm check` fails on a fresh checkout because `apps/web` type-checks against `fluxiq`'s built `dist` | Core | — | waiting |
| **L0** | C0: bring Core `service.ts` under its ratchet by behaviour-unchanged moves | Core | I1 | done on t048 (`56d6106`, 6,381 -> 6,275 lines); lands after I1 |
| **L1** | Gap step 1: the created-Flow repair lane on `persistent-isolated`, with `--replays` for instruction tasks; proves Persist and the zero-call re-run on identity-drift | downstream | I1 | done on t049 (`768eace`): `run-mubmrcyv-beaa2a6b` build 2 = observed 2, repair applied, in-run replay 0 calls; keyless `replay-mubmxtvg-93979815` passed with 0 calls; Core proposed a patch in 1 of 4 runs (L4-L6) |
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

Delivered briefs are archived in [archive/delivered-briefs.md](./week2-exit-plan/archive/delivered-briefs.md).

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

### Brief: w2x-evidence-window
- Repository: paired task t057, `F:\fxwork\t057\!FluxIQWebExtension` and `F:\fxwork\t057\!FluxIQ`, both at P2's tip (t051). `AS/` is Core `packages/fluxiq/src/programs/automation-studio/`.
- Task: plan step P7. With P2 in place, realistic-site builds now end `llm_evidence_loop.evidence_limit` after 10-15 calls, because the loop caps the total evidence bytes collected across the whole build (the flow-bootstrap 64,000-byte limit), not just what one request carries. The standing direction (Week 2 document, "The fixed call limit was the defect") is that the loop iterates while it makes progress and stops on cost, tokens, the deadline or the no-progress guard, never on a small fixed cap. Make total evidence unbounded except by those: each provider request carries a bounded context window — the newest evidence in full plus compact, closed summaries of older calls (call id, tool id, result code, whether it changed the page) — within the existing per-request evidence context bound and the one 64k-token context constant. Older raw evidence leaves the window whole, never cut mid-record. Accounting still records total evidence bytes. A total-evidence stop survives only as a far-away, configurable backstop. If Core already has a context-window module, extend it rather than adding a second.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: `professional-network-rotterdam-data-engineers` and `auction-marketplace`'s extraction task (both on `dev`; merge `dev` into the downstream worktree first). Pass: builds go past 15 calls without `evidence_limit` and end in a proposal or another meaningful closed outcome, with `build.providerCalls == observed.calls`. Report whether a Flow was created, matched against expected records, calls, tokens, cost and where the build stopped on the site.
- Then focused tests from inside `packages/fluxiq`, Core `check` and `build`, downstream `pnpm check`. `evidence-loop.ts` is 776 lines: put new behaviour in a focused module and keep it under 800. `service.ts` must not grow.
- Owns: `AS/runtime/llm/evidence-loop.ts`, a new or existing context-window module beside it, `AS/runtime/loop-limits/*`, their tests. Must not touch: `recovery/*`, `result-verification/*`, `service.ts`, domain and Lab source, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-evidence-window.md`

### Brief: w2x-repair-permission-request
- Repository: paired task t059, `F:\fxwork\t059\!FluxIQWebExtension` and `F:\fxwork\t059\!FluxIQ`, carrying L4 (t050) and P2 (t051) on current `dev`. `AS/` is Core `packages/fluxiq/src/programs/automation-studio/`.
- Task: plan step L5 — "Item 4" of `reports/w2x-existing-flow-and-repair-design.md` (slices C4 and D4): the model's runtime patch declares `consequences`; the patch stage asks the recovery gate L4 built; a refused patch becomes `metadata.permissionRequest` (patch code `llm.runtime_patch_permission_required`) instead of a preflight refusal; a permitted patch carries `sideEffectPermission: "permitted"` and runs. Move the runtime-patch schemas out of `deepseek-provider.ts` into `llm/harness/runtime-patch-schema.ts` first (it sits at the 800-line limit). The domain's `target/override.ts` returns the resolved control's name. Line numbers predate t027, L0 and L4: locate by content.
- Also, from L4's live runs (`reports/w2x-recovery-permissions.md`): (a) a permitted override was still `preflight_rejected` because the Lab's host lacks the `action-dispatch` capability — find where the Lab host declares capabilities and supply it, and confirm the real panel host has it; (b) exploration decisions never see `policyGates` because `deepseek-provider.ts` leaves them out of their context — include them; (c) runtime recovery still ends on a thrown tool — pass P2's `toolFailures: "observe"` on the recovery path.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `--llm-task repair`, on `social-scheduler-repair-renamed-composer`: run 1 with no permit — `runtimePatchAttempts[0].permissionRequired` true, the request names "Add to queue", nothing executes, the variant's final state is unchanged; run 2 with `--llm-permit <missing>` — the override runs, its trial verifies, an adaptation id is recorded; approve and apply it; a keyless replay on the variant reaches the declared final state with zero calls; the task's negative (never "Save as draft") holds. Then the same shape on `order-operations-repair-relabelled-dispatch`. This is Recover and Validate in the Week 2 exit chain: report each link.
- Then focused tests from inside `packages/fluxiq`, Core `check` and `build`, downstream `pnpm check`. `service.ts` must not grow; `deepseek-provider.ts` and `evidence-loop.ts` stay under 800 lines.
- Owns: `llm/harness/{structured-response,provider-result,runtime-patch-schema}.ts`, `llm/deepseek-provider.ts`, `live-patch.ts`, `live-patch/*`, `action-permissions/request.ts`, `recovery/annotation/{patches,annotate}.ts`, `recovery/runtime-exploration.ts`, domain `target/override.ts`, the Lab host capability site, their tests. Must not touch: `evidence-loop.ts` and `loop-limits/*` (P7), `result-verification/*`, `service.ts`, web UI, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-repair-permission-request.md`

### Brief: w2x-run-permission-ui
- Repository: paired task t060 on L4's base (t050), `F:\fxwork\t060\!FluxIQWebExtension` and `F:\fxwork\t060\!FluxIQ`. Core web is `apps/web/src/features/automation-studio/`.
- Task: plan step N3, slice CU1 of `reports/w2x-existing-flow-and-repair-design.md` ("What the person sees" under Items 3 and 4). A permission request raised by a run or a repair must reach the person in the panel: `runtime/run-input-model.ts` treats `explore_and_adapt` as an explicit LLM run mode; a new `runtime/RunPermissionRequest.tsx`, rendered in the post-run summary of `runtime/FlowRunView.tsx`, reads `runDetail.metadata.permissionRequest` through t027's public client export `parseAutomationStudioActionPermissionRequest` and shows the consequence phrases; **Allow and run again** issues a grant whose `permittedConsequences` are exactly the request's `missing` classes and re-runs with the same run intent, mirroring t027's creation continuation in `authoring/BlankFlowAuthoringPanel.tsx`; **Don't allow** dismisses it. Nothing is granted beyond what was asked.
- Live first, through the real panel and unpacked extension (the committed `demo-workspace` drivers; `FLUXIQ_TEST_ENV_FILES=none`, allocated ports, never 3000 or 4711): an `explore_and_adapt` repair on `order-operations-repair-relabelled-dispatch` (or another task where recovery reaches a lasting press) shows the request; Allow re-runs with exactly the missing classes; Don't allow leaves the Flow and page unchanged. If no live run raises a request, say so plainly, prove the component against a request Core actually produced in an L4 run detail, and record the gap.
- Then the web runtime tests and Core `check` and `build`.
- Owns: the web files named above, their tests, and any client barrel line the component needs. Must not touch: Core runtime, `result-verification/*`, `RunDetailPanels.tsx` beyond mounting (t035 changed it), downstream source, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-run-permission-ui.md`

### Brief: w2x-lab-probe-race
- Repository: a downstream flat task on the shared read-only Core (`71e2798`). `TR/` is `packages/test-runner/src/`.
- Task: plan step P8. E1 lane C found that 5 of 6 recording lanes on `auction-marketplace` and `crossborder-marketplace` never start recording: `proveCoreActionRoundTrip` in `TR/run-scenario.ts` (about lines 650-690) checks a `type` step's target is usable on the original page, then has Core navigate a fresh automation tab and types there — where the site's delayed overlays (promotion, coupon popup, cookie banner) have come up again and cover the field, so the probe throws `action.dispatch` and the lane fails before recording. The probe's job is to prove one Core-issued action reaches the page through the production gateway; it must not depend on the site under test being free of overlays. Make it robust on every realistic site: for example, prove the round trip with an action whose success does not need an uncovered control, or treat a closed page-condition result (such as P2's `blocked_by_dialog` rejection, when present) as proof that the command reached the page. Whatever you choose must still fail when the gateway, extension or content script is genuinely broken. `run-scenario.ts` is at 797 of 800 lines: move the probe into its own module under `TR/` with its test.
- Live first, provider-free, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: the recording lanes that failed on `auction-marketplace` and `crossborder-marketplace` (lane C's report, `reports/w2x-e2e-lane-c.md`) now start and record; one established scenario (`basic-form`) still passes; and a deliberately broken gateway (for example a wrong session id) still fails the probe.
- Then test-runner tests for the moved module and `pnpm check`.
- Owns: the probe code, its new module and test, the call site in `run-scenario.ts`. Must not touch: Core, extension, domain, scenario-lab, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-lab-probe-race.md`

### Brief: w2x-dismissible-dialogs
- Repository: paired task t062 on P2's base (t051), `F:\fxwork\t062\!FluxIQWebExtension` and `F:\fxwork\t062\!FluxIQ`.
- Task: plan step P9. E1 lane C: on `auction-marketplace` a dismissible promotion modal (it has its own close control) makes a replayed action fail `web.intervention.required` (`domain/src/runtime/failure/codes.ts`, category `user_intervention_required`), and Core's `recovery/deterministic-diagnosis.ts` maps that to `manual_intervention`, so the model gets 0 calls — the recorded Flow that built and the auction repair task both died there. "Needs a person" must mean only what a person alone can answer: a robot check, a credential or second-factor prompt, a payment confirmation. A covering dialog the page lets anyone dismiss must come back as the closed page condition P2 introduced (`web.action.rejected.blocked_by_dialog`, with the dialog's own controls ranked first), which recovery can act on. Find where the extension decides intervention is required, draw the line on evidence the page gives (dismiss or close controls, aria roles, the challenge fixtures' markers) rather than on site names, and keep `everything-store`'s robot check as `web.intervention.required`.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: (1) `auction-marketplace`'s recorded-Flow replay and its repair task — the promotion no longer ends as intervention-required, and recovery gets calls to deal with it; (2) `everything-store`'s robot-check variant still ends `user_intervention_required` and nothing tries to solve it. Report where each run stopped next.
- Then focused extension, domain and Core recovery tests, both repositories' `check`.
- Owns: the extension and domain code that classifies a blocked action, `failure/codes.ts` only if a code must be added, Core `recovery/deterministic-diagnosis.ts` only if the mapping must change, their tests. Must not touch: `evidence-loop.ts`, `loop-limits/*`, `live-patch*`, `recovery/annotation/*`, scenario-lab, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-dismissible-dialogs.md`

### Brief: w2x-recording-fidelity
- Repository: a downstream flat task from `dev` on the shared read-only Core (`71e2798`).
- Task: plan step P10. E1 lane E (`reports/w2x-e2e-lane-e.md`) found recorded Flows that cannot replay the honest path they recorded: (1) `company-website`'s chat widget Close is stored with a target that resolves to 7 equal matches, so replay cannot choose — the recorder must store enough identity (the owning widget or dialog, the accessible name in context, position among equals, a stable fingerprint) that the target resolves to exactly the element pressed, and replay must refuse an ambiguous match with a closed code rather than guess; (2) `local-classifieds`' cookie-consent click is stored with a later search's URL as its expected result — each recorded step's expected post-state must come from the page state that step produced, not from a later step. Fix both at their cause in the extension recorder and the domain target and expectation code; do not tune the sites.
- Live first, provider-free, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: record and replay `company-website`'s primary workflow and `local-classifieds`' primary workflow (the recording lane); each recorded step replays to its own recorded state; report oracle results and records matched against expected (lane E saw 13 where 12 were expected on one extraction — say whether that is the recorder, the extractor or the site). One established scenario (`basic-form`) still records and replays.
- Then focused extension and domain tests and `pnpm check`.
- Owns: the extension's recording and target-capture code, the domain's target identity and expected-state code, their tests. Must not touch: the extension's action-runner classification of blocked actions (P9 owns it), Lab and scenario-lab source, Core, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-recording-fidelity.md`

### Brief: w2x-extract-across-pages
- Repository: a downstream flat task from `dev` on the shared read-only Core (`71e2798`).
- Task: plan step P15. The selector audit (`reports/w2x-scenario-selector-audit.md`) found that `extract_list` reads page 1 of `bigbox-retail`'s `pickup-towels` and then fails (`run_failed`, message channel closed) when its Next control loads a new document, and that numbered pagination ends on a loading skeleton instead of the next page's records. A paginated extraction must survive a Next that navigates (re-attach to the new document, keep the records already read, continue) and must wait for the next page's records to render before reading, bounded by its timeout, while keeping de-duplication and the item cap. E1 lane E also saw 13 records where 12 were expected on one extraction: check whether it is this code.
- Live first, provider-free, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: `bigbox-retail`'s `pickup-towels` recording lane reads every page and matches its expected records; one numbered-pagination site on `dev` (for example `professional-network` people search) reads past page 1; an established paginated scenario (`product-catalog` or `property-listings`) still matches.
- Then focused extension and domain extraction tests and `pnpm check`.
- Owns: the extension's page extraction engine and pagination, the domain's extraction contracts only if a closed code must be added, their tests. Must not touch: the recorder and target-capture code (P10), the action runner's blocked-action classification (P9), Lab and scenario-lab source, Core, other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-extract-across-pages.md`

### Brief: w2x-created-flow-fidelity
- Repository: a paired task from `dev` in both repositories.
- Task: plan step P17. E1 lane B's E9 (`reports/w2x-e2e-lane-b.md`) is the only created Flow the campaign produced, and it cannot replay: through the real panel, `everything-store` with the `first-page-plus-earbuds` instruction was proposed and applied as navigate (to `/scenarios/everything-store/s?k=wireless+earbuds`), click `a[aria-label="Brightaisle Plus"]`, `extract_list`, end; the keyless run's navigate reported success while its before and after screenshots are identical and Core's after-action location is the start page, and the click then failed `web.target.not_found`. The Flow also kept none of the cookie and notification dismissals exploration needed, so replay met both overlays. Fix both at their cause. (a) A navigate that did not reach its URL must never report success: trace which tab the extension navigated versus the tab being observed, and make navigate verify its outcome. (b) A created Flow must carry what exploration needed to reach its target: find why the authored Flow omitted the dismissals (what the bootstrap shows the model when it writes the Flow, and what Core keeps from exploration — the Week 2 gap audit notes the exploration reduction is computed and discarded) and make the smallest change that gets them into the Flow.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, allocated ports, never 3000 or 4711: reproduce E9 through the panel (`demo:llm:*` with `FLUXIQ_LLM_SCENARIO_ID` for everything-store, as lane B did); after the fix the created Flow's keyless run reaches the results page past both overlays and its extraction is judged by `matchedRecords` against `expectedRecords`, with zero provider calls in the run. Report each step of the created Flow and what exploration did that it kept or dropped.
- Then focused tests in the files you change and both repositories' `check`.
- Owns: the extension's navigate action and its outcome reporting, Core's flow-bootstrap authoring and plan code that decides which explored steps a Flow keeps, their tests. Must not touch: `evidence-loop.ts` and `loop-limits/*` (P11), `recovery/*`, `live-patch*`, the recorder (P10), extraction pagination (P15), blocked-action classification (P9), other worktrees, git commits, shared `dev`, the user's panel.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-created-flow-fidelity.md`

### Brief: w2x-lab-defects
- Repository: task t066, flat worktree `F:\fxwork\t066-lab-defects` on the shared read-only Core (`71e2798`). `TR/` is `packages/test-runner/src/`.
- Task: plan step P13, the Lab defects E1 found (`reports/w2x-e2e-lane-{a,c,d,e}.md`): (1) scripted navigation refuses a URL with a query string, blocking `local-classifieds` save-dining-tables and its repair task; (2) `job-board`'s frame-target extract step is refused `fixture.invalid`; (3) `TR/…/extract-intent.ts` sends Lab extract fields as required (the extension defaults `required: true`), blocking `social-network-feed`'s feed-digest recording; (4) no run file records which classes `--llm-permit` granted — record them in `live-llm.json`; (5) the Lab counts the initial observation as a decision (Core's `decisionCount` is the trace length) and flags builds that used their budget as `performance.budget` — count decisions, not trace rows; (6) the task catalog cannot judge "this task correctly ends in a permission request naming these classes": add a closed expectation to the live-task contract, judge it from Core's run detail (`metadata.permissionRequest`, or the creation diagnostic), and set it on each realistic site's consequential task that is run without a permit.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: the save-dining-tables recording lane starts; the job-board frame extract runs; the feed-digest recording lane runs; one `--llm-permit` run's `live-llm.json` lists the granted classes. (6) is proven by unit tests plus a run where Core raises a request if one can be produced; otherwise say so.
- Then focused test-runner and test-contracts tests and `pnpm check`.
- Owns: test-runner and test-contracts files for the six items and their tests, the consequential tasks' expectation lines. Must not touch: `TR/run-scenario.ts` and the Core action probe (P8 owns them — if an item needs them, name the site in your report), the Lab's snapshot reader for permission fields (L5), scenario pages and oracles, Core, extension, domain, other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-lab-defects.md`

### Brief: w2x-fixture-defects
- Repository: task t067, flat worktree `F:\fxwork\t067-fixture-defects` on the shared read-only Core (`71e2798`).
- Task: plan steps P19 and P16. (1) `everything-store`'s recording script clicks the cookie Accept after the 4 s notifications prompt has already covered the page, so every recording lane and both repair tasks stop (`reports/w2x-e2e-lane-b.md`, site defect 1): make the recorded honest path deal with the page as a person would (answer the prompt that is covering the page, then the cookie banner) without changing the site's timings or difficulty. (2) The combined scenario-lab suite fails one browser-path test under load (auction, crossborder or professional-network) and passes it alone: find the cause (fixed sleeps, timeouts, shared browser state) and make each test wait on the page condition it needs, never by lengthening a fixed sleep. Also make sure `live-instructions.ts` (775 of 800 lines) has room: split it by moving the realistic sites' tasks into their own module.
- Live first: everything-store's primary recording lane (provider-free, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`) passes the opening; then the full scenario-lab suite three times in a row with no failure while the machine is loaded.
- Owns: the ten realistic sites' manifests, workflows and `tests/`, `apps/scenario-lab/src/scenarios/live-instructions.ts` and a new sibling module for the split. Must not touch: pages, oracles and task wording, test-runner, Core, extension, domain, other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-fixture-defects.md`

### Brief: w2x-exploration-handles
- Repository: paired task t070, `F:\fxwork\t070\!FluxIQWebExtension` (P2's domain changes plus current `dev`) and `F:\fxwork\t070\!FluxIQ` (P2's Core).
- Task: plan step P18. The realistic sites repeat labels on purpose, and exploration hands the model ambiguous handles: `core.decision_unusable` with `web.handle.ambiguous` appears in 6 of E1 lane B's 12 builds and feeds the repeat-without-progress stalls (`reports/w2x-e2e-lane-b.md`, product gap 2). Every element the evidence packet offers must carry a handle that resolves to exactly one element, with the disambiguating context a person would use (the owning card or dialog, the row's other text, position among equals) in bounded, closed form; the model must never be offered two elements it cannot tell apart. Keep P2's front-layer ranking.
- Live first, `FLUXIQ_TEST_ENV_FILES=none`, `persistent-isolated`: `everything-store-first-page-plus-earbuds-deal-wheel` and one more ambiguous-label task of your choice; report ambiguous-handle decisions before and after, where the build stopped, and whether a Flow was created with matched against expected records.
- Then focused domain evidence tests, both repositories' `check`.
- Owns: the domain's `llm-evidence` packet, handle assignment and structure code, their tests. Must not touch: Core, the extension recorder (P10), extraction pagination (P15), blocked-action classification (P9), other worktrees, git commits, shared `dev`.
- Report to: `F:\!FluxIQWebExtension\docs\working\week2-exit-plan\reports\w2x-exploration-handles.md`

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

### 2026-09-21 — t027 landed; five realistic sites on dev; t033 A/B passed
- Agent: supervisor; workers `w2x-t027-gate-triage`, `w2x-t033-land`, `w2x-created-flow-repair-lane`, `w2x-creation-permission-lost`, scenario workers
- Changed: t027 triage `e2159d3` (Core) and `1c5c7ad` (downstream: test-runner clears `dist` before building); t027 merged in both repositories; scenario tasks t043, t045, t037, t038, t040 merged; t049 `768eace`; t047 `f932e40`, `f3646ef`; plan rows P2-P6.
- Why: t027 carried most of the proven Week 2 work; the scenarios must be in live testing; every realistic site's live run exposed the same build-ending tool failure.
- Validation: t027 `pnpm --filter @fluxiq-web-extension/test-runner test` printed `# tests 1195`, `# pass 1195`, `# fail 0`; Core `vitest run --no-file-parallelism .../generation-failure.test.ts .../service-bootstrap` printed `Tests  113 passed (113)`; the three web test files printed `Tests  48 passed (48)`; each scenario landing printed scenario-lab `# fail 0` (385, 407, 445 passing) and `task finish` reported `"validation":{"ran":true,"command":"pnpm check","passed":true}`; Core `pnpm task finish t027` printed `"merge":"Merge task t027: multi-action-exploration" ... "passed":true` after `fluxiq` was built (its first attempt failed `apps/web` `TS2307` on a stale `dist`: P6); t049 run read `{"verdict":"passed","oracle":["passed"],"build":2,"observed":2}` with repair `["applied","ran"]` and replay calls `[0]`; `replay-mubmxtvg-93979815` read `"verdict":"passed"` with calls `[0]`.
- Outcome: Partial
- Follow-up: push both `dev` branches; land the finished tasks; clean up t040's worktree, whose finish crashed parsing the process list after merging.

### 2026-09-21 — All ten realistic sites on dev; live end-to-end campaign started
- Agent: supervisor
- Changed: scenario tasks t044, t046, t039, t042, t041 merged (all ten sites on `dev` `08e7dc6`, pushed); lanes t052-t056; brief `w2x-e2e-live-campaign`; rows E1 and E2.
- Why: the user asked for extensive live end-to-end testing of FluxIQ on every new site.
- Validation: each landing printed scenario-lab `# fail 0` (463, 491, 518, then 541 and 570 on rerun after one flaky failure each) and `task finish` reported `"command":"pnpm check","passed":true`; `scenarioIds` counted `41 scenario ids`; the first lane start moved the shared Core to `278c44b` and built it.
- Outcome: Partial
- Follow-up: E2 after P2; identify the flaky combined-suite test.

### 2026-09-21 — Core landings paused for E1; shared Core sync; P2 done; P7 dispatched
- Agent: supervisor; workers `w2x-tool-failure-feedback`, E1 lanes
- Changed: t036, t035 (both repositories) and t048 landed; t051 committed (P2); t057 (P7) started on P2's tip; lanes A, C, D, E asked to pause.
- Why: landing t035 moved Core `dev`, and the Lab's behind-`dev` guard then refused every new lane run against the shared Core. Decision: no further Core landings until E1 round 1 finishes (t047, t051, t033 wait); sync the shared Core once, with no run in flight, rather than forcing it under running processes. Lane D disclosed that its environment had set `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` from the start; its four creation runs still used Core `278c44b` and count as round 1 on that revision. No lane may use the override.
- Validation: `pnpm task sync-core --dry-run` from lane B printed "26 running process(es) are working inside it or a worktree that shares it"; t051 `run-mubp3phh-cf4643fd` `live-llm.json` contains `web.action.rejected.blocked_by_dialog` and reads `{"build":15,"observed":15}`.
- Outcome: Partial
- Follow-up: sync and resume the lanes; land P2 after round 1.

### 2026-09-21 — E1 lane C complete; L4 committed; L5, N3 and P8 dispatched
- Agent: supervisor; workers `w2x-e2e-lane-c`, `w2x-recovery-permissions`
- Changed: t050 `9be9f11` (Core recovery permission gate) and `1f6932e` (Lab waits for recovery to settle); t059 (L5) and t060 (N3) on L4's base, t061 (P8); rows P8 and P9.
- Why: lane C showed no Flow built on either marketplace site; the causes are P2 (11 tasks), the Lab probe race (6), exploration stalls (2), and a dismissible modal classed as needing a person (2). L4's live runs reached complete, accounted recoveries but were refused at preflight, which L5 turns into a permission request.
- Validation: t050 `npx vitest run --no-file-parallelism .../recovery .../harness-options .../execution-grant-permissions.test.ts` printed `Tests  399 passed (399)`; lane C's campaign summaries read auction "0 of 5 … 23 calls $0.115517" and crossborder "0 of 5 … 40 calls $0.208087"; neither consequential task reached its gated control, so no permission request was observed.
- Outcome: Partial
- Follow-up: P9 at the next free slot; E2 after P2, P7 and P8.

### 2026-09-21 — E1 lane E complete; P7 done; P9, P10 dispatched; P11 given to the P7 worker
- Agent: supervisor; workers `w2x-e2e-lane-e`, `w2x-evidence-window`
- Changed: tasks t062 (P9) and t063 (P10); rows P10-P13; P7's worker extended to P11.
- Why: lane E showed 0 of 13 builds and 0 of 7 recorded replays succeeded on local-classifieds and company-website; 5 builds reported `evidence_tool_failed` were really the 64,000-byte budget; recorded Flows stored ambiguous targets and wrong expected states. P7 removed the evidence cap live, and builds then stopped on a fixed 26-call cap, which the user's standing decision rejects.
- Validation: lane E judged every run from its files — 0/13 builds created a Flow, 0/7 recorded Flows passed their oracle, 0/2 panel explores produced a proposal, `build.providerCalls == observed.calls` in every provider run; P7's live runs ended `evidence_iteration_limit` at 26 decisions (up to 153,142 bytes) or `repeat_without_progress`, with no `evidence_limit` or `tool_failed`.
- Outcome: Partial
- Follow-up: P11 live; E2 after P2, P7/P11, P8, P9 and P10 land.

### 2026-09-21 — E1 lane D complete; selector audit landed; L5 partial; P15 dispatched
- Agent: supervisor; workers `w2x-e2e-lane-d`, `w2x-scenario-selector-audit`, `w2x-repair-permission-request`
- Changed: t058 landed (selectors the extension can execute, bigbox naive-path test updated by the supervisor); L5 extended to its four blockers; P10 extended to shadow-root targets; t064 (P15); rows P15, P16.
- Why: lane D built 0 of 12 Flows (P2 on 10 tasks; a dismissible modal gating the repair; shadow-root and frame targets). L5's code passes but its live proofs were blocked by a 60 s grant claim window shorter than the failing Flow (a panel defect too), a domain equivalence check that reads "Pick and pack" as two actions, and a Lab snapshot reader that drops the permission fields.
- Validation: t058 bigbox `browser-paths.test.js` printed `# pass 12`, `# fail 0` after the supervisor's one-line fix; its landing printed scenario-lab `# pass 570`, `# fail 0` and `"command":"pnpm check","passed":true`; L5 Core focused vitest "452 passed (452)"; lane D: 0 of 12 created, `build.providerCalls == observed.calls` in every build, 77 calls, $0.3624.
- Outcome: Partial
- Follow-up: L5 live proofs after its fixes; E2.

### 2026-09-21 — E1 lane B complete; the first created Flow does not replay; P17 dispatched
- Agent: supervisor; worker `w2x-e2e-lane-b`
- Changed: t065 (P17); rows P17-P19.
- Why: lane B built 0 of 12 Flows in the Lab (7 on P2, others on repeats, the evidence cap and an unclassified 400); its everything-store panel creation proposed, applied and ran a Flow with 0 calls that failed, because a navigate reported success without navigating and the Flow dropped the dismissals exploration needed. A created Flow replaying deterministically is the project's measure of success, so this outranks the remaining exploration gaps.
- Validation: lane B's report rows E1-E9 and R1-R6, each judged from its run files; `build.providerCalls == observed.calls` in every build; $0.7304 over 135 Lab calls plus $0.053 for the panel; E9's replay before and after screenshots share hash `389ba81a01c8` and Core's after-action location is the start page.
- Outcome: Partial
- Follow-up: lane A; then round 2.

### 2026-09-21 — E1 round 1 complete; plan compacted
- Agent: supervisor; worker `w2x-e2e-lane-a`
- Changed: Current State (round 1 result); 18 delivered briefs moved to `archive/delivered-briefs.md` (document 587 -> 399 lines); tasks t066-t070 and their briefs.
- Why: all five lanes reported; the next wave fixes every cause round 1 ranked.
- Validation: lane A — 0 of 16 creation runs made a Flow, 3 of 7 recording-lane Flows replayed and passed (social-network-feed confirm-requests 4/4, move-open-day 1/1 matched); `compact-plan.mjs` printed "moved 18 briefs, 191 lines; document now 399 lines".
- Outcome: Partial
- Follow-up: E2.

---

## Open Questions

- None.
