# w2x-exit-loop-gap-audit

Worker report, 2026-09-21. This was a read-only audit. No source, test, working
document, git state, panel or credential was touched, and no build, test or live
run was made. The only file written in the repositories is this report.

**Where the line numbers come from.**

- Core: `F:\!FluxIQ` on `dev` at `2d3e69a`.
- Downstream: `F:\!FluxIQWebExtension` on `dev`. The code is as at `d3ad8c5`;
  the later commits `2b3484b` and `0406764` add documents only.
- The t027 Core worktree differs from Core `dev` in two places only:
  - `recovery/annotation/annotate.ts`, from line 257 (+7 lines). Exploration now
    also needs a requested patch, and closed skip and failure codes are recorded.
  - `runtime/service.ts`, in the bootstrap area (about +14 lines from 1816).
- Core paths without a prefix are relative to
  `packages/fluxiq/src/programs/automation-studio/`.

**How success was judged.** Only a deterministic run of the created Flow counts.
A run is deterministic when all of these hold:

- `build.providerCalls` equals `observed.calls` in `snapshots/live-llm.json`;
- the created lane's `repair.observed.calls` is 0, or the run is a `lab replay`
  made with no key;
- for extraction, `matchedRecords` equals `expectedRecords`.

## Outcome

Done. The chain has never been shown whole. Two of its links, Recover and
Resume, cannot happen in production Core today.

**Only the start of the chain has live evidence on a Lab-created Flow.**

- Links covered: Fail, Diagnose, Explore and Generate Repair.
- Scenario: `identity-drift-rename-redesigned-after-creation`.
- Runs: `F:\r16\run-mu7gjreo-057ccafc`, `F:\r16\run-mu7hke99-a1addea5` and
  `F:\r25d\run-muac8im4-602aeecc`.
- What each run did: it built the Flow with 1 provider call (build equals
  observed). Drift then broke the Flow. The run ended with one pending
  target-override proposal after 2 or 3 repair calls.
- Why that is as far as it goes: all three runs used the isolated target, which
  deletes the Flow when the run ends. None of these proposals can ever be
  applied or replayed.

**A repair followed by Persist and a zero-call re-run was shown live only
once.**

- Run: the 2026-09-16 demo lane, `pnpm demo:llm:adapt:focused`, with
  `finalReplayProviderCallCount: 0`.
- Why it cannot be relied on: it ran on a private Core worktree that has since
  been removed, on a Flow built on 7 September, and was judged by the demo's own
  oracle. It has never been reproduced and cannot be re-checked.

**Recover and Resume have never been observed live.** For any repair the model
writes, production Core cannot reach them:

- A provider exists only when a run carries a grant
  (`programs/_shared/runtime.ts:79-91`).
- Every granted run is forced into manual review with no external side effects
  (`runtime/service.ts:3081`, `llm/runtime-session-grant.ts:125,142`).
- Under those settings a target override is either only proposed, with no trial
  (`recovery/annotation/patches.ts:142-145`), or refused at preflight
  (`runtime/live-patch.ts:140-141`).
- The adaptive retry is skipped whenever the run carries a grant
  (`service.ts:3224,3278`).
- The retry also needs `autoApply`, which a target override can never get:
  overrides are classed as high risk with an external side effect
  (`live-patch.ts:544,594`), and the promotion gate refuses both
  (`training-modes.ts:365-366`).

**Several Week 2 pieces are built but not wired in:**

- The exploration reduction (2.5) is computed and then thrown away:
  `annotate.ts` never reads `.reduced`. Nothing produces an
  `insert_deterministic_path` patch.
- The replay confidence recorder (2.6), `recordAutomationStudioAdaptationReplays`,
  has no caller outside tests, on either `dev` or t027.
- The Lab's approve, apply and replay lane (`--replays`) is wired only to the
  recorded-Flow lane. No `snapshots/repair-lane.json` exists in any run root I
  searched.

**Not started:**

- The 2.9 metrics exist only as types. Every producer writes `null`, and the
  bench validator requires `null`.
- There is no `week2` corpus and no adaptation-cycle lane.
- X6 has not started: list extraction is deliberately not repairable.
- The third entry point, improving an existing Flow, has not started. Flow
  Bootstrap refuses any Flow that is not blank (`service.ts:1839`,
  `:4048-4057`).

**The latest full corpus measurement is corpus A–D on 2026-09-18: 4 of 36 tasks
pass by oracle.** All four were deterministic in-lane runs, and each matched
every expected record. The measurement is stale: it predates the fixes in t010
through t027.

## Findings

### Entry point 2: a failing run (the main chain)

#### Fail

- **Code path.**
  - Core: `runtime/service.ts:3059` (`runRuntimeSession`). Recovery starts at
    `:3213-3237` for a routed run and `:3268-3291` for a direct one.
  - Downstream failure codes: `domain/src/runtime/failure/{classify,codes}.ts`.
  - Lab: the created-Flow lane, `packages/test-runner/src/flow-lane/creation/lane.ts:114`.
    Drift is armed after the build at `run-scenario.ts:255`.
- **Strongest live evidence.** `F:\r16\run-mu7gjreo-057ccafc` and
  `F:\r16\run-mu7hke99-a1addea5` (2026-09-18), and
  `F:\r25d\run-muac8im4-602aeecc` (2026-09-20). Each created the Flow on the
  baseline page (build 1 = observed 1). Each then failed with
  `web.target.not_found` on `renamed-redesign` (report
  `w2-created-flow-recovery.md`).
- **Gap.** None.

#### Diagnose

- **Code path.**
  - Deterministic check first: `recovery/llm-invocation.ts:63`, over
    `recovery/deterministic-diagnosis.ts:138`.
  - Failure evidence: `recovery/annotation/annotate.ts:171-216`, with the
    domain's `domain/src/runtime/llm-evidence/tools.ts:353`.
  - The `runtime_diagnosis` call: `annotate.ts:230-250`.
  - The plan: `annotate.ts:252` (`recovery/plan.ts:98`).
  - t027 only: ranked repair candidates,
    `domain/src/runtime/llm-evidence/target/candidates.ts`.
- **Strongest live evidence.**
  - The same three runs; each diagnosis call validated.
  - A real-panel run on 2026-09-21 at 01:48 (`F:\fxlab-runs\t027-repair-result`)
    made 2 calls. Its diagnosis answered `stillAchievable: no` and
    `patchNeeded: false` (`w2-panel-repair-result-boundary.md`).
- **Gap.**
  - The panel run judged a repairable drift to be unachievable.
  - The ranked candidates (t027) have never reached a provider. The attempt
    stopped at `adaptation_readiness.bootstrap_invalid` with 0 calls
    (`w2-repair-candidate-ranking-live.md`).
  - Two items remain open in the Week 2 document. The result check disagrees
    with itself at temperature 0 (t022). A constant
    `unresolved_no_candidates` is fed to the repair (t017).

#### Explore

- **Code path.**
  - `annotate.ts:263` on `dev`. On t027 it is `:270`, which also requires that a
    patch was requested.
  - Then `recovery/annotation/exploration.ts:162` and
    `recovery/runtime-exploration.ts:169`.
  - Limits: `recovery/exploration-budget.ts`.
  - Domain options: `domain/src/runtime/llm-evidence/harness-options/options.ts:66-140`.
- **Strongest live evidence.**
  - `run-mu7hke99`: `evidence_gathered` after 1 call and 1 action (3,543 bytes),
    followed by a patch and a proposal.
  - `F:\r16\run-mu7fas8b-66a630b1` (under `explore_and_adapt`):
    `evidence_gathered` after 4 calls and 3 actions. The model then declined
    with `control_gone`, which was correct.
- **Gap.**
  - `permittedConsequences` never reaches the recovery exploration:
    `exploration.ts` passes none into `runtime-exploration.ts:114`. Any lasting
    press therefore ends the exploration with a request.
  - `dev` still explores when the plan asks for no patch. t027 fixes this.

#### Recover

- **Code path.**
  - The trial: `live-patch.ts:223-281`, then `flow-change/trial.ts:72` and
    `flow-change/verdict.ts`.
  - Resume point: the verdict's `resumable` and `resumeFrom`
    (`flow-change/resume.ts`).
- **Strongest live evidence.** None live. Only unit and service tests with
  mocked providers.
- **Gap.** Target overrides cannot reach a trial:
  - Under `diagnose_and_adapt` the override is only proposed and never trialled
    (`patches.ts:142-145`, `live-patch.ts:188-221`).
  - Under `explore_and_adapt` it is refused at preflight
    (`live-patch.ts:140-141`), because `service.ts:3081` forces
    `authorizedExternalSideEffects: false`.
  - Seen live: `F:\r16\run-mu7gfuph-a57c6b18` and
    `F:\r25i\run-muackkc2-222803dd` both ended
    `runtime_patch.side_effect_not_authorized`.

#### Generate Repair

- **Code path.**
  - The `runtime_patch` call: `annotate.ts:310-338`.
  - `recovery/annotation/patches.ts:88`, then the proposal at `live-patch.ts:188`.
    Temporary patches map to durable ones at `live-patch.ts:542-548`.
  - The domain's target check: `domain/src/runtime/llm-evidence/target/override.ts:71`,
    reached via `tools.ts:393`.
- **Strongest live evidence.**
  - `run-mu7gjreo`: the repair cost $0.0041 over 2 calls.
  - `run-mu7hke99`: $0.0062 over 3 calls, including the exploration call.
  - `run-muac8im4`: 2 calls.
  - Each produced one `temporary_target_override` (`proposalOnly`, preflight
    passed) with an adaptation and a change proposal. t016 read the proposal as
    `pending` in Core's store.
- **Gap.**
  - The model may return only five temporary patch kinds
    (`llm/harness/provider-result.ts:183`).
  - Action sequences and recovery-Subflow calls map to `edit_recovery`, which
    the store refuses to make durable (`storage/project/adaptation-store.ts:445`).
  - `insert_deterministic_path` can be applied (`:449`), but nothing produces
    it. The reduction is computed at `exploration.ts:237,255-275` and never
    read; `annotate.ts:302-308` reads only `.exploration` and `.explored`.
  - As a result, a Flow that is missing a step can only be declined.

#### Validate

- **Code path.**
  - The trial verdict becomes the adaptation's status at `live-patch.ts:325-374`
    (`validated`, `rejected` or `testing`).
  - Promotion gates: `recovery/adaptation-promotion.ts:22`.
  - Replay confidence: `adaptation-confidence/replay.ts:111`.
  - Lab: `flow-lane/repair/prove-repair.ts:53` and `replay-repair.ts:79`.
- **Strongest live evidence.** Never during a run. After an apply, only the
  2026-09-16 demo lane (`postApplyValidationStatus: succeeded`, in
  `w2-live-explore-create-repair.md`), on a Core worktree that has since been
  removed.
- **Gap.**
  - No live repair has ever been trialled (see Recover).
  - `recordAutomationStudioAdaptationReplays` has no caller outside tests, so a
    repair never moves from `provisional` to `established`.
  - The Lab's `--replays` lane runs only for recorded Flows
    (`run-scenario.ts:447`) and has never produced a proof.

#### Persist

- **Code path.**
  - Automatic promotion: `service.ts:2885-2959`, then the gate at
    `training-modes.ts:320`.
  - Human review: `reviewFlowAdaptation` at `service.ts:3954`, then
    `adaptation-store.ts:445-470`.
  - Lab: `flow-lane/repair/apply-repair.ts:78`.
- **Strongest live evidence.** The 2026-09-16 demo lane: `reviewOutcome:
  approved`, `applyOutcome: applied`, and a later revert that passed. Never for a
  Lab-created Flow, and never through the UI for a repair.
- **Gap.**
  - Automatic persistence is impossible for target overrides:
    - grants force `proposalMode: "manual"` (`runtime-session-grant.ts:125,142`);
    - overrides are classed as high risk with an external side effect
      (`live-patch.ts:544,594`), and `training-modes.ts:365-366` refuses both.
  - The created-Flow lane never approves or applies a repair:
    - `run-scenario.ts:335-352` has no repair lane;
    - `run-repair-lane.ts:65` requires `live.repairsFlow`, which is false for
      `create-flow` (`live-llm/live-llm-run.ts:108-110`).
  - The isolated target deletes the Flow when the run ends (found in t019).

#### Resume

- **Code path.**
  - `service/adaptations/adaptive-retry.ts:43`; `service.ts:2974-3057`.
  - The trial itself also continues the run (see the header of
    `flow-change/trial.ts`).
- **Strongest live evidence.** None live. `w2-4-resume-point.md` and
  `w2-8a-resumable-caller.md` are unit tests only.
- **Gap.** No repair the model writes can reach it in production:
  - The retry is skipped on granted runs (`service.ts:3224,3278`).
  - The retry needs `approvalDecision.autoApply === true`
    (`adaptive-retry.ts:48`).
  - The trial's executed continuation is returned (`live-patch.ts:276`), but
    nothing records it as the run's outcome.
  - Nothing resumes a run after a person approves its repair.

#### Re-run deterministically

- **Code path.**
  - A run without a grant has no provider (`_shared/runtime.ts:79-91`).
  - Known-adaptation check: `llm-invocation.ts:63`.
  - Lab: `saved-flow-replay/replay-saved-flow.ts:114` (`pnpm lab replay`).
- **Strongest live evidence.** After a repair, only the 2026-09-16 demo lane
  (`finalReplayRunId abf586e0-…`, 0 calls), which cannot be re-checked.
- **Gap.**
  - Never shown for a repaired Lab Flow.
  - `lab replay` records `coreProviderCallCount: null`. Its zero rests on the
    Lab having no key and no grant (`model.calls: 0`), not on a count stated by
    Core.
  - "The model is available and is not called" has never been tested. Every
    zero-call replay ran with no key at all.

### Entry point 1: a new Flow from an instruction

#### Fail

- **Code path.**
  - A failed build ends with a closed code from
    `runtime/flow-bootstrap/generation-failure.ts:65-144`.
  - If a created Flow's first playback fails, it takes entry point 2's path
    under the lane's `diagnose_and_adapt` grant (`run-scenario.ts:346`).
- **Strongest live evidence.** In corpus A–D, 14 of 36 tasks built no Flow. They
  ended with `evidence_tool_failed`, `evidence_repeat_without_progress`,
  `evidence_unusable_decision` or `lab.generation_http_400`.
- **Gap.** The measurement is stale (see the corpus section below).

#### Diagnose

- **Code path.**
  - There is no separate diagnosis stage. Refused and unusable decisions are fed
    back to the model (`llm/unusable-decision.ts`).
  - After playback, the result check runs
    (`result-verification/run-outcome.ts:111`).
- **Strongest live evidence.** t012 (ledger, 2026-09-18):
  `property-listings-newest-homes` now reports `failed`, with
  `resultVerification: refuted` and 0 of 10 records matched.
- **Gap.**
  - The t022 fix for the temperature-0 disagreement is not built.
  - A failed run is never verified (`run-outcome.ts:114`).

#### Explore

- **Code path.**
  - Core: `service.ts:1809` (`generateFlowBootstrapAdaptation`), with
    permissions at `:1905`, then `llm/evidence-loop.ts:249`.
  - Domain: `domain/src/runtime/llm-evidence/tools.ts` and
    `domain/src/runtime/llm-evidence/harness-options/`.
- **Strongest live evidence.**
  - Panel run `demo-llm-explore-2026-09-21T00-22-44-392Z-fdf63b`
    (`F:\fxlab-runs\t027-panel-live`): 3 snapshot tools, 1 call.
  - `F:\r24k\run-muabdpmu-6c1f639d` (schedule-post): 3 build calls.
- **Gap.**
  - Several actions per model turn (t033) is off by default (one action per
    turn) and has not been proven live.
  - t027's unified output never completed a Flow.

#### Recover

- **Code path.**
  - The build keeps going after refusals (`w2-creation-loop-keeps-going.md`).
  - `flow_bootstrap.permission_required` hands off to t027's permission
    continuation UI.
- **Strongest live evidence.** `bootstrap-no-proposal-investigation.md`: a live
  `permission_required` refusal was observed. The continuation has been proven
  only without a provider.
- **Gap.**
  - The continuation has never been triggered by a real provider response live.
  - t027 is not on `dev`.

#### Generate the Flow

- **Code path.** `runtime/flow-bootstrap/{adaptation.ts,plan.ts}`; Lab
  `flow-lane/creation/build-proposal.ts:106`.
- **Strongest live evidence.**
  - Panel: one durable proposal from one call, with about 11.6 s from request to
    proposal.
  - `demo-llm-explore-2026-09-21T03-39-51-674Z-b87d9c`: one proposal, not
    applied automatically.
- **Gap.** None.

#### Validate

- **Code path.**
  - Strict plan validation.
  - Lab: `review-proposal.ts:21` and `judgement.ts:19`.
  - The bootstrap apply gate: `training-modes.ts:337`.
- **Strongest live evidence.** The playbacks judged by the oracle, listed under
  Re-run below.
- **Gap.** The model can mark every extracted field optional, which switches off
  Core's required-field check
  (`domain/src/output-nodes/extract-list/record-output.ts:73`).

#### Persist

- **Code path.** `service.ts:2133`, then `applyFlowBootstrapAdaptation` at
  `:4084`.
- **Strongest live evidence.**
  - The panel's Audit, Approve and Apply steps, with 0 provider calls
    (`w2-panel-evidence-runtime-binding.md`).
  - The persistent Lab workspaces from t019 and t020.
- **Gap.** The campaign's default isolated target deletes every created Flow
  when the run ends.

#### Resume

Not applicable to this entry point.

#### Re-run

- **Code path.** `lab replay`, or a run from the panel's Runtime Debug view.
- **Strongest live evidence.**
  - `F:\r19\replays\replay-mu7fwaer-33a79fda.json` and three earlier replays of
    `flow.c1542a11`: 14 of 14 matched, `model.calls: 0`, no key and no grant.
  - `F:\r20\replays\replay-mu7gsejr-6ce62f9d.json` and
    `replay-mu7gvodo-22d5cc23.json`: `flow.9c8f4386`, one Flow taking two
    routes, 14 of 14 on each, 0 calls.
  - Panel: 4 of 4 actions, 0 calls, oracle `Submitted`.
- **Gap.**
  - Only two Lab Flows have ever been replayed.
  - `F:\r19\run-mu7ekvqd-9fbf8185`, the in-lane run that built an earlier
    version of `flow.c1542a11`, recorded one diagnosis intervention during
    playback while build = observed = 3. That in-lane pass is therefore not the
    zero-call proof; the keyless replays are.

### Entry point 3: an edge case in an existing Flow

This entry point has not been started, and there is no live evidence for any
link.

- **Where it is blocked.** `service.ts:1839` raises
  `flow_bootstrap.blank_target_required`. `assertBlankBootstrapTarget`
  (`:4048-4057`) refuses any Flow that has nodes, a Router or Subflows.
- **What already exists but is unused.**
  - `AutomationStudioBootstrapAdaptationMode` includes `"extend"`
    (`flow-bootstrap/adaptation.ts:25`), but nothing uses it.
  - The apply gate already sends an `extend` to manual review
    (`training-modes.ts:337-350`).
- **What is designed but not built.** t020 piece 3 (`w2-routing-and-subflows.md`,
  section "Repair and improvement") covers:
  - showing the current Flow back to the model as a script, using `keep`
    references for unchanged steps;
  - a diff that Core computes and the person reviews;
  - a `revise: { fromRunId? }` option on `generateFlowBootstrapAdaptation`;
  - the repair plan answering `revision_needed` when a step is missing;
  - `create_subflow` writing nodes into the new Subflow, instead of leaving an
    empty graph.
- **What else is needed.**
  - Applying and reverting an extension, with the Flow's earlier state stored.
  - A UI view of the diff.
  - A Lab lane that runs a saved Flow against the edge-case variant and then
    calls the improvement.

### 2.9 and X6

#### 2.9: proving deterministic reuse

- **Scripted test provider (L10).** There is none outside tests. This matches
  the standing direction to use the real provider.
- **Provenance for each attempt.**
  - Run detail carries `adaptationIds`.
  - Core does not publish which adaptations a run actually exercised:
    `adaptationsExercised` appears nowhere in `packages/fluxiq/src`.
  - The Lab contract expects that field
    (`packages/test-contracts/src/adaptation-reuse.ts:22`).
- **Typed Week 2 metrics.** The types exist in
  `test-contracts/src/adaptation-reuse.ts`, but nothing fills them:
  - `test-runner/src/run-evaluation/observed-run-evaluation.ts:130-133` writes
    `null`.
  - `test-runner/src/bench/aggregate-report.ts:254-257` writes `null`.
  - The bench validator requires `null`
    (`test-contracts/src/bench-report-validation.ts:15,103`).
  - `bench/comparison-details.ts:47` says "Week 1 requires this reserved field
    to be null".
- **`harnessRecovery`.** It is filled only for `lab run`. The bench row still
  records `null` (`w2-lab-repair-outcome.md`, open question 1).
- **Adaptation-cycle lane.** There is no `flow-lane/adaptation-cycle/`. The
  closest is `flow-lane/repair/`, which serves recorded Flows only.
- **`week2` corpus.**
  - `bench/corpus/` holds only `smoke.ts` and `week1.ts`.
  - The live task catalogue is not a FluxBench corpus. It is
    `apps/scenario-lab/src/scenarios/live-instructions.ts` (79 tasks) and
    `live-repair-tasks.ts` (19 tasks).
  - There are no side-effect counters, and no fixtures in which item selectors
    drift.
- **A/B pair and live checkpoint.** Neither exists for Week 2.

#### X6: extraction repair

- List extraction is deliberately not repairable
  (`domain/src/runtime/llm-evidence/repairable-parameters.ts:14-21`). Core
  refuses it as `action_not_repairable` (`w2-w2-extraction-repair-fail-closed.md`).
- The intended route is to re-issue the node's `extractList` request as a
  parameter override. It is not built.
- W04 (product catalog, text variant) and W08 (data table, column reorder)
  exist only in `bench/corpus/week1.ts:38,42`.
- There is no live evidence.

### Latest full corpus measurement, by oracle

**The run.**

- When: 2026-09-18 UTC, 05:37 to 06:00. Corpus A–D, with the four slices run in
  parallel.
- Campaigns: A `2026-09-18T05-50-53-606Z`, B `05-44-53-303Z`,
  C `05-45-02-191Z` and D `05-45-01-147Z`, plus probe runs.
- Bundles: `F:\!FluxIQWebExtension\test-runs\instances\corpus-{a,b,c,d}`.
- Versions: Core `cf176fe`, extension `3ba6742`. Real DeepSeek, isolated
  target.
- Reports: `w2-corpus-{a,b,c,d}.md`.

**The result.** 4 of 36 tasks passed by oracle. 18 built a Flow that the oracle
failed, and 14 built no Flow. In all 4 passes build equalled observed and there
was no activity during playback, so each was a deterministic run of the created
Flow. In 7 runs FluxIQ reported `passed` while the oracle failed.

In the table, "Exp/obs/match" means expected, observed and matched records, and
"Calls" means build calls / observed calls.

| Scenario | Task (run) | Oracle | Exp/obs/match | Calls | USD |
| --- | --- | --- | --- | --- | --- |
| social-scheduler | schedule-post (`run-mu6jcss9`) | no Flow | — | 24/24 | 0.1062 |
| | schedule-post-restyled (`run-mu6jjaqd`) | no Flow | — | 13/13 | 0.0506 |
| | schedule-post-renamed-composer (`run-mu6jmqso`) | no Flow | — | 11/11 | 0.0412 |
| | retry-failed (`run-mu6jqnkd`) | failed | 10/0/0 (not run) | 7/7 | 0.0264 |
| | retry-failed-quiet-week (`run-mu6jtzlz`) | failed; reported passed | 3/3/0 | 7/7 | 0.0264 |
| | week-ahead-reordered-columns (`run-mu6jxr07`) | **passed** | 14/14/14 | 4/4 | 0.0139 |
| social-inbox | answer-mention (`run-mu6jzzz2`) | no Flow | — | 1/1 | 0.0026 |
| | answer-mention-restyled (`run-mu6k12r3`) | no Flow | — | 3/3 | 0.0080 |
| | answer-mention-moved-send (`run-mu6k2dqu`) | no Flow | — | 2/2 | 0.0053 |
| | unanswered-backlog (`run-mu6jq4ev`) | failed | 28/0/0 (not run) | 5/5 | 0.0180 |
| | unanswered-backlog-quiet (`run-mu6jswim`) | failed | 3/0/0 (not run) | 4/4 | 0.0138 |
| | first-screen (`run-mu6jm8yg`) | **passed** | 25/25/25 | 2/2 | 0.0068 |
| | open-conversation (`run-mu6jsegm`; first attempt HTTP 400) | failed | 1/0/0 (not run) | 5/5 | 0.0178 |
| property-listings | newest-homes (`run-mu6j6drm`) | failed; reported passed | 10/10/0 | 7/7 | 0.0262 |
| | newest-homes-agent-withheld (`run-mu6jbah9`) | failed; reported passed | 10/10/0 | 3/3 | 0.0105 |
| | kelford-homes (`run-mu6jdfb7`) | failed; reported passed | 57/57/0 | 4/4 | 0.0140 |
| | kelford-homes-renamed-pagination (`run-mu6jg1bu`) | failed; reported passed | 57/10/0 | 5/5 | 0.0176 |
| | cheapest-home (`run-mu6jit0f`) | failed; reported passed | 1/10/0 | 6/6 | 0.0206 |
| | home-facts (`run-mu6jlj95`, `run-mu6jwdm1`) | no Flow (HTTP 400) | — | null/1 | not reported |
| | last-page (`run-mu6jnax5`) | failed (playback goal) | — | 5/5 | 0.0139 |
| company-directory | register-page (`run-mu6j8l11`) | no Flow | — | 6/6 | 0.0182 |
| | logistics-sector (`run-mu6jc98w`) | failed | 40/0/0 (not run) | 3/3 | 0.0100 |
| | logistics-sector-relabelled (`run-mu6jekpu`) | failed | 40/0/0 (not run) | 4/4 | 0.0135 |
| | no-companies (`run-mu6jgqqv`) | failed | 0/0/0 (not run) | 3/3 | 0.0101 |
| | company-profile (`run-mu6jiapp`) | no Flow | — | 5/5 | 0.0131 |
| | last-page (`run-mu6jkba5`) | failed (playback goal) | — | 5/5 | 0.0131 |
| support-desk | sla-breaches (`run-mu6j76fk`) | **passed** | 12/12/12 | 3/3 | 0.0107 |
| | sla-breaches-recovered (`run-mu6jbrpv`) | **passed** | 3/3/3 | 3/3 | 0.0108 |
| | triage-backlog (`run-mu6je1lu`) | failed (playback goal) | — | 4/4 | 0.0172 |
| | reply-and-resolve (`run-mu6jh81a`) | no Flow | — | 14/14 | 0.0530 |
| | escalate-longest-breach (`run-mu6jjt35`) | no Flow | — | 9/9 | 0.0417 |
| order-operations | partial-refund (`run-mu6jnwhw`) | no Flow | — | 8/8 | 0.0233 |
| | batch-export (`run-mu6jpmxx`) | failed; reported passed | 13/7/0 | 5/5 | 0.0163 |
| | batch-export-quiet-week (`run-mu6jteua`) | failed | 3/0/0 | 3/3 | 0.0099 |
| | line-items (`run-mu6jvvj9`) | no Flow | — | 13/13 | 0.0410 |
| | dispatch-run (`run-mu6jz5m3`) | no Flow | — | 6/6 | 0.0167 |

**By scenario:**

| Scenario | Passed by oracle |
| --- | --- |
| social-scheduler | 1 of 6 |
| social-inbox | 1 of 7 |
| property-listings | 0 of 7 |
| company-directory | 0 of 6 |
| support-desk | 2 of 5 |
| order-operations | 0 of 5 |

**Why this measurement is stale.** Focused live runs since then have changed
some of these rows:

- `company-directory-no-companies` passed (t010).
- `logistics-sector` observed 40 records and matched 35, so its oracle still
  fails (t010, ledger 2026-09-18).
- `social-scheduler-schedule-post` passed its oracle in
  `F:\r24k\run-muabdpmu-6c1f639d` (build 3 = observed 3, 0 repair calls).
- `social-scheduler-week-ahead` matched 14 of 14 (t019).

**The last campaign that included repair tasks.**

- Campaign: `test-runs/campaigns/2026-09-17T02-23-20-255Z`, 50 tasks run with
  `--all`.
- By run verdict, 18 passed; by judgement, 15 passed.
- By kind: form 6 of 6, extract 4 of 14, navigate-and-extract 1 of 16,
  repair 4 of 14.
- Its run bundles no longer exist (each `runPath` is missing), so I could not
  confirm build = observed for any of its runs.

### Smallest ordered set of changes to show the whole chain on one scenario

**The scenario is `identity-drift-rename-redesigned-after-creation`.**

- The instruction is "Rename the workspace to Aurora Field Team and save the
  settings."
- The build explores the page before the drift variant is switched on. The
  `renamed-redesign` variant is armed afterwards.
- The oracle is the fixture's "Saved" fact.
- This scenario already reproduces Fail, Diagnose, Explore and Generate Repair
  live. It has done so three times, at about $0.007–$0.009 per run.

#### Step 1: give created Flows the Lab's repair lane (Lab only, no Core change)

What to change:

- Call `runLiveRepairLane` after `runCreatedFlowLane`
  (`packages/test-runner/src/run-scenario.ts:335-352`). Pass `lane.flowId`,
  `lane.run` and `steps: []`, and a `checkGoal` built from the armed variant's
  final-state facts.
- Accept the created lane's repair grant at `run-repair-lane.ts:65`. The
  `repairsFlow` test at `live-llm/live-llm-run.ts:108-110` is false for
  `create-flow`.
- Let `--replays` through for instruction tasks, in `commands.ts` and
  `scripts/lab/live-campaign/**`.
- Run on the `persistent-isolated` target. Then, in a shell with no provider
  key, run:
  `pnpm lab replay identity-drift --workspace <ws> --flow <id> --instruction-task identity-drift-rename-redesigned-after-creation`

What this proves live:

- Fail, Diagnose, Explore and Generate Repair.
- Persist: the Lab approves and applies the repair as the logged-in reviewer.
- Validate, in a weak form only: replays after the apply, judged by the oracle.
- A deterministic re-run with zero provider calls.

It does not prove Recover or Resume.

#### Step 2: let a recovery perform a press the instruction asked for, or ask permission (Core)

What to change:

- Carry the grant's `permittedConsequences` into the recovery path: through
  `annotate.ts`, then `exploration.ts`, then `runtime-exploration.ts:114`. This
  mirrors what the bootstrap does at `service.ts:1905`.
- Replace the blanket `authorizedExternalSideEffects: false` at
  `service.ts:3081`. Authorize an override when the failed node already declared
  its consequence and the grant or the instruction permits that consequence.
- For everything else, return a "needs permission" outcome instead of the
  preflight refusal at `live-patch.ts:140-141`.
- In the Lab, have the repair authorizer ask for `explore_and_adapt` with the
  consequences the instruction calls for (`live-llm/live-llm-run.ts`,
  `live-llm/authorize-flow.ts`).

What this makes possible live:

- Recover: a trial whose verdict shows the expected state restored
  (`live-patch.ts:252`).
- Validate during the run: the adaptation is `validated`, at the `provisional`
  confidence tier.

#### Step 3: make Resume real on a granted run (Core)

What to change. Either of these:

- Record the verified trial's continuation as the run's outcome, as a
  `metadata.resume` entry. It should take the shape of `RunAdaptationResume` in
  `test-contracts/src/adaptation-reuse.ts`.
- Or continue from `verdict.resumeFrom` using the candidate Flow, instead of
  skipping the retry at `service.ts:3224,3278`.

In both cases, relax the `autoApply`-only condition at `adaptive-retry.ts:48`
for this use inside the run (decision L9).

The chain would then run in this order:

1. Fail
2. Diagnose
3. Explore
4. Recover
5. Generate Repair
6. Validate
7. Resume
8. Persist, by approval (step 1)
9. Re-run deterministically

**Recommendation: keep manual approval.** Two further changes would let Persist
come before Resume inside one run with no person involved:

- honour the Flow's own approval mode under grants
  (`runtime-session-grant.ts:125,142`);
- stop classing every override as high risk with an external side effect
  (`live-patch.ts:544,594`, `training-modes.ts:365-366`).

Both are policy changes to the promotion gate. The exit criterion does not need
them. They are needed only if the stated order must hold without a person
approving the repair.

#### Step 4: plumbing for the 2.9 measurements (Core and Lab)

- Core states `providerCallCount` and `adaptationsExercised` on every run
  detail, including runs without a grant.
- Core calls `recordAutomationStudioAdaptationReplays` after runs without a
  grant, so that two replays move a repair from `provisional` to `established`.
- The Lab fills `adaptationReuse`, `adaptationValidation`,
  `adaptationPersistence` and `adaptationCost` (`observed-run-evaluation.ts:130-133`),
  and bench rows are allowed to carry them.

#### Step 5: only then, the panel and the corpus

- Repeat the same chain through the real panel on t027. The fresh UI repair
  cycle is no longer blocked, now that t027's creation acceptance has passed.
- Then measure the corpus once.

### Lab scenarios that best demonstrate each entry point

**A new Flow from an instruction:**

- `social-scheduler-week-ahead`: 14 of 14 matched, and replayed five times with
  0 calls.
- `social-scheduler-week-ahead-whats-new` and `-no-announcement`: one saved Flow
  took two different routes, 14 of 14 on each, with 0 calls.
- `social-scheduler-schedule-post` changes state on the page. It passed its
  oracle in `F:\r24k`.
- Through the UI: `instruction-only-form-submit` (panel, 4 of 4 actions,
  0 calls).

**A failing run:**

- Best: `identity-drift-rename-redesigned-after-creation`.
- For recorded Flows: `identity-drift-repair-renamed-save`.
- Negative controls, where the right answer is to refuse. These passed judgement
  on 2026-09-17: `failure-surfaces-refuse-locked-record`,
  `modal-flows-refuse-blocking-offer` and `multi-tab-refuse-blocked-popup`.
- Through the UI: `instruction-only-form` with drift on the submit target
  (`demo:llm:explore:adapt`).

**An edge case in an existing Flow:**

- Best: build `social-scheduler-week-ahead` on the baseline page. Then run the
  saved Flow against the `whats-new` rendering, where an announcement modal
  blocks the queue. The improvement should add the route and the `announcement`
  Subflow. t020 already proved that this Flow shape works: `flow.9c8f4386`
  matched 14 of 14 on both routes with 0 calls.
- Second choice: `property-listings-kelford-homes`, then
  `-renamed-pagination`. The Flow stopped at page one, observing 10 of 57
  expected records.
- Third choice: `data-table-inventory`, then `-empty` and `-may-be-empty`.

### Cost and wall-clock from past runs

| Activity | What was observed | Source |
| --- | --- | --- |
| Created identity-drift run with a repair proposal | 1 build call plus 2–3 repair calls; $0.0066–$0.0088 in total; 42.9–98.0 s | Evaluations in `F:\r16` and `F:\r25d`; t016 report |
| Repair with exploration, under `explore_and_adapt` | 6 calls, $0.0142 for the repair; 235 s for the run | `F:\r16\run-mu7fas8b` |
| Creating a Flow in the panel | 1 call, 6,736 input and 332 output tokens; 9.6 s from the Explore click to a durable proposal | `w2-mvp-latency-critical-path-audit.md` |
| Repair in the panel | 2 calls; 19.1–24.6 s from the Run click to the response | Panel repair reports |
| Saved 4-action run in the panel | 8.165 s, down from 14.774 s before t027's readiness change | Latency audit |
| Preparing a blank panel workspace | 58.5 s | `w2-repair-reuse-live.md` |
| Cold restart until the graph is verified | 14.4 s | Latency audit |
| One `lab replay` | About 1 minute. Inferred from two replay records written 71 s apart; not measured | Timestamps in `F:\r20\replays` |
| Full corpus A–D (36 tasks) | $0.78 over 39 runs; 57.6 run-minutes, 89 s per run on average; about 20 minutes of wall-clock with 4 slices in parallel | `test-runs/instances/corpus-*` |
| `--all` campaign on 2026-09-17 (50 tasks) | $0.31 over 123 calls; 51 minutes, run one task at a time | Campaign summary |

**Estimates for the proposed one-scenario chain** (inferred from the table
above, not measured):

- In the Lab: about $0.01–$0.02 per attempt, and about 2–4 minutes, plus the
  time to build a fresh Lab instance.
- Through the panel: about $0.01, and about 3–5 minutes.

## What changed and why

- Only this report was written in the repositories.
- Two read-only scratch scripts were placed in the session scratchpad, outside
  the repositories: `gapaudit-tab.cjs` and `gapaudit-camp.cjs`. They tabulate
  `evaluation.json`, `snapshots/live-llm.json` and the campaign `summary.json`
  files.

## Commands run and observed results

- **Documents read.**
  - The brief and the exit plan's Current State.
  - From the t027 copy of the Week 2 document: its Current State, Phases table
    and ledger.
  - Lines 363–680 of the 30-day plan.
  - The reports cited above.
- **Corpus A–D, tabulated with `node gapaudit-tab.cjs`.**
  - 39 runs in total; 4 have oracle `passed`.
  - Summed cost $0.7839; summed run time 57.6 minutes.
  - Each pass had build = observed (4/4, 2/2, 3/3 and 3/3) and matched every
    expected record.
- **The run roots `F:\r16`, `F:\r19`, `F:\r20`, `F:\r24k`, `F:\r25*` and
  `F:\r27*`, tabulated with the same script.**
  - `run-mu7gjreo`: build 1 = observed 1; the repair took 2 calls and left one
    pending proposal.
  - `run-mu7hke99`: exploration `evidence_gathered`; the repair took 3 calls.
  - `run-muabdpmu`: oracle passed; build 3 = observed 3; 0 repair calls.
  - `run-muackkc2`: `runtime_patch.side_effect_not_authorized`.
- **The replay files in `F:\r19` and `F:\r20`.** Each shows `verdict: passed`,
  `matchedRecords: 14`, `expectedRecords: 14`, `model.calls: 0`,
  `environmentCredentialVariables: []` and `coreProviderCallCount: null`.
- **Searching for `repair-lane.json`.** I ran `find … -name repair-lane.json`
  over the `F:\r*` roots, `F:\!FluxIQWebExtension\test-runs`, `F:\fxlab-runs`
  and `F:\fxwork`. There were no matches.
- **`grep` over Core `packages/fluxiq/src`.**
  - `recordAutomationStudioAdaptationReplays` appears only in its own module,
    its test and `dist`. This holds on both `dev` and t027.
  - `adaptationsExercised` does not appear anywhere.
  - `.reduced` is never read outside `exploration.ts`.
- **`git diff --stat dev HEAD` in the t027 Core worktree.** It shows
  `annotate.ts`, `stages.ts`, `service.ts` and their tests.
- **`git diff --stat d3ad8c5 HEAD` on downstream `dev`.** Documents only.

## Not verified

- The result of the 2026-09-16 demo lane. Its private Core worktree and its
  evidence have been removed.
- Build = observed for the 50-task campaign of 2026-09-17. Its run bundles are
  missing.
- Whether a Flow run with Core changes 2 and 3 in place would actually restore
  the Saved state. This is inferred from the code, not observed.
- Whether diagnosis would judge a repairable drift achievable once the ranked
  candidates reach the provider.
- How long `lab replay` and the `--replays` lane take. There are no
  measurements.
- The t017 and t022 claims (`io-policy.ts:242`, and the temperature-0
  disagreement). I carried these over from the Week 2 document without
  re-reading the code.
- The code of t029, t033 and t034. I did not read it.

## Open questions or contradictions found

1. **The Week 2 document describes three phases as "built and landed" that have
   no production caller.** These are the 2.5 exploration reduction, the 2.6
   provisional promotion by replay, and the 2.8 resume:
   - the reduction is thrown away (`annotate.ts:302-308`);
   - the replay recorder is never called;
   - resume cannot be reached on a run that carries a grant.

   They should be recorded as built but not wired in.
2. **The created lane's playback is described as deterministic, but it runs
   under a `diagnose_and_adapt` grant** (`creation/lane.ts:96-113`). That grant's
   calls are counted only under `repair.observed` in `snapshots/live-llm.json`.
   One run from before t016, `F:\r19\run-mu7ekvqd`, recorded a diagnosis
   intervention during playback even though build = observed. A zero-call
   judgement therefore needs `repair.observed.calls == 0`, or a `lab replay` made
   with no key. Build = observed alone is not enough.
3. **`lab replay` cannot certify zero calls from Core's own count.** It records
   `coreProviderCallCount: null`.
4. **The exit criterion puts Persist before Resume.** Under manual approval, the
   only mode that grants allow, the order Core can actually reach is: use the
   repair in the current run, then approval, then persistence. Keeping the
   stated order inside one run with no person involved needs the policy change
   described in step 3. The supervisor should decide whether a person approving
   the repair between those two links is acceptable.
