# Concurrent Live-Testing Plan

Status: Proposed
Created: 2026-09-20
Owner: Senior supervisor agent
Scope: Run independent FluxIQ live tests concurrently under worker agents while
the supervisor controls provenance, budgets, integration, and evidence review.

## Objective

Use as many specialized workers across the campaign as produce useful parallel
evidence, without allowing one run's checkout, server, browser, database,
cache, or provider traffic to contaminate another. Concurrency is adaptive:
fill the environment's safe capacity when lanes are independent, and reduce it
when provider contention, shared integration work, or coordination overhead
would make the campaign slower. Live browser evidence remains the first gate.
Unit tests run only after the focused live behavior works, and the full
integration gate runs once for a coherent candidate rather than after every
edit.

## Current evidence and starting point

Task t027 is an uncommitted, unmerged paired Core/downstream experiment.
Its focused Chromium A/B exercised the same six browser actions and reduced
provider decisions from six to three when multi-action output was enabled. A
real-provider run then entered four fields consecutively but did not create a
Flow: the model attempted a lasting press during exploration and correctly hit
a permission requirement. The tool wording was tightened. The next attempt
received an intermittent generation HTTP 400, and the following identical
retry was deliberately stopped when the user requested this plan. These are
promising measurements, not acceptance evidence.

## Coordination model

The senior supervisor owns the task boundary, worker briefs, provider budget,
source changes, conflict resolution, evidence review, final validation,
commits, merges, and pushes. Each worker receives one bounded scenario/config
lane and writes only its own report. Workers do not commit, merge, edit shared
working documents, or declare a product result from the Lab verdict alone.

Every concurrent live-validation lane gets its own task branch and worktree;
concurrent validation is itself the reason to use worktree isolation. When the
candidate changes Core, each lane uses a paired Core worktree at the exact same
candidate revision. All lanes must report both repository commit hashes plus a
dirty-tree fingerprint before launch. A result with different source
provenance is not an A/B comparison.

No two lanes may share any of the following:

- mutable extension or Core checkout;
- `FLUXIQ_TEST_INSTANCE`, `FLUXIQ_TEST_RUNS_DIR`, build/cache root, or `.next`;
- server/scenario/gateway ports or base URLs;
- browser user-data directory or profile;
- SQLite/project store, recordings, or run output;
- environment-derived runtime identity.

The supervisor assigns explicit provider limits per lane: provider/model,
maximum calls, input/output/run tokens, cost, and retry allowance. Start with
at most two real-provider lanes concurrently; a third worker uses local
Chromium or panel/UI validation. More parallel provider traffic is likely to
increase rate-limit noise and make the comparison slower, not faster.

## Adaptive worker topology

There is no fixed worker count in this plan. The supervisor uses as many
simultaneous and successive specialists as the active environment safely
supports, based on independence, machine capacity, provider limits, and the
cost of coordination. Completed workers are replaced by new specialists until
every coverage lane is finished.

| Role | Owner | Initial lane | Responsibility |
| --- | --- | --- | --- |
| Supervisor | Senior supervisor | Control and integration | Freeze candidate provenance, issue briefs and budgets, watch health, inspect evidence call by call, and make any source fix serially. |
| Baseline worker | Replaceable specialist | Single-action baseline | Run schedule-post with multi-action disabled on the same candidate and report calls, actions, timing, stop reason, Flow, and oracle. |
| Batching worker | Replaceable specialist | Multi-action candidate | Run the identical task with multi-action enabled and the same budgets; prove at least one completed multi-action batch. |
| UI worker | Replaceable specialist | Panel golden path | Drive instruction/recording, oversight, approval, execution, failure, repair, rerun, and reuse through the real FluxIQ panel. |
| Safety worker | Replaceable specialist | Safety boundaries | Prove refusal, permission, failure, navigation, and unstable-target stops in live Chromium. |
| Performance worker | Replaceable specialist | Timing and bottlenecks | Measure stage timings and isolate the largest avoidable delay without competing with the A/B provider measurement. |
| Scenario workers | Replaceable specialists | Breadth and parity | Cover additional demos, persisted reuse, Chromium side panel, and Firefox popup with separate bounded briefs. |

These are responsibilities, not a prescribed number of agents. Independent
lanes can run simultaneously; dependent lanes queue behind the result they
need. As soon as a lane reaches its evidence barrier, its capacity is
reassigned to the next recording, repair, persistence, browser-parity,
breadth, or performance brief. Additional workers may perform bounded
read-only analysis. The supervisor avoids spawning a worker only when
briefing, isolation, and subsequent verification would cost more than the
small task saves.

The first implementation prerequisite is a test/config seam such as
`maxActionsPerDecision: 1 | 16` (or an equivalent
`allowMultipleToolCalls`). It must flow through the real live plan so both A/B
lanes use identical code. Comparing different commits or a stale baseline
branch is not acceptable.

## Complete worker coverage

Workers rotate through waves at the maximum useful concurrency; the plan does
not treat one schedule-post run as coverage of the product. Every row below
gets a bounded worker brief, isolated live run, and worker-owned report. The
supervisor reviews the raw evidence and integrates each independently useful
result.

| Wave | Worker lane | Live behavior that must be exercised |
| --- | --- | --- |
| A | Instruction-to-Flow baseline | A person types a plain instruction in the real panel; FluxIQ explores one action per decision, proposes a reviewable Flow, receives approval, runs it, and reports the result. |
| A | Multi-action exploration | The identical instruction and candidate use optional multiple ordered actions per provider output; compare correctness, calls, tokens, cost, and elapsed time with baseline. |
| A | Safety and target continuity | Live Chromium proves batching stops after refusal, permission requirement, failed action, navigation, or unstable targets, while stable field entries may continue. |
| B | Recording-to-Flow UI | A person records a task through the extension/panel, FluxIQ turns it into a Flow, exposes it for review, and executes it from the UI. |
| B | Oversight and approval UI | The panel visibly shows exploration/progress, proposed actions/Flow, consequences, permission requests, approval/decline, and an honest final outcome. |
| B | Failure and automatic repair | Induce a realistic target/page change, observe failure in the panel, let the model diagnose and propose/fix the Flow, approve when required, rerun, and pass the oracle. |
| C | Persistence and deterministic reuse | Reload/restart the product, find the saved Flow, rerun it without model calls on the normal path, and prove the resulting browser state. |
| C | Cross-scenario breadth | Run the same creation/repair contract against additional demos representing forms, disclosure/navigation, extraction, and permission-bearing actions rather than optimizing only for social-scheduler. |
| C | Performance | Capture end-to-end and per-stage timing for panel startup, provider waits, evidence capture, action execution, verification, save, repair, and replay; identify and live-test the largest avoidable delay. |
| C | Browser/UI parity | Exercise the supported Chromium side-panel path and the Firefox popup path wherever the shared product contract applies; document any platform-specific gap rather than inferring parity. |

The end-to-end UI lanes must drive the actual FluxIQ web panel and production
extension build. Direct content-harness, service, or API calls are useful
preflight evidence but cannot satisfy UI acceptance. A UI run covers the
visible instruction or recording entry, progress, Flow review, approval,
execution, failure presentation, repair, rerun, persisted reuse, and final
status. Any step not reached remains explicitly open.

## Branch and integration cadence

Each implementation or fix is one task branch, with its own worktree whenever
live validation can overlap another lane. Workers may test a frozen candidate
and write reports, but only the supervisor commits or merges. The supervisor
reviews the diff and raw live evidence as soon as a worker reports rather than
waiting for every wave to finish.

A branch is merged promptly into `dev` when it is a coherent, independently
valuable improvement, the affected live scenario passes, narrow checks pass,
and no known breakage is included. A successful safety fix, UI-path repair,
latency reduction, or scenario capability therefore need not wait for the
entire corpus. After each merge, later worker branches merge current `dev` and
rerun their narrow affected live lane before integration so results are not
based on stale composition.

Do not merge partial refactors, experiments whose benefit is only speculative,
provider/facility workarounds that hide product failures, or code validated
only by compilation. Cross-repository improvements merge downstream first and
Core second under their respective checks, then both `dev` branches are pushed
as one coherent unit. Full suites remain an integration-boundary gate, not a
per-branch development loop.

## Live-first execution sequence

1. **Freeze and preflight.** The supervisor selects one candidate revision,
   confirms clean isolated lane worktrees, records both repository hashes,
   allocates unique resources, checks ports, and publishes written briefs.
2. **Cheap browser proof.** Workers A and B run the focused content-harness
   scenario once with their respective setting. Worker C runs the refusal /
   unstable-target safety scenario. Failure stops the cohort before paid calls.
3. **Concurrent real-provider A/B.** Workers A and B run the same
   schedule-post instruction, target, model, budgets, and oracle concurrently.
   They do not edit code or silently retry product outcomes.
4. **Evidence barrier.** All workers stop. The supervisor compares snapshots
   and `evaluation.json` call by call rather than trusting top-level verdicts.
   No new run begins until each lane's provenance and outcome are accounted for.
5. **Panel golden path.** Only after the A/B is behaviorally correct, Worker C
   uses the actual FluxIQ web panel for instruction entry, progress, proposed
   Flow review/approval, execution, failure presentation, repair/rerun, and
   deterministic reuse. This is the UI acceptance lane; content-harness success
   alone does not cover it.
6. **Serial repair loop.** When evidence identifies one product defect, the
   supervisor pauses the cohort, makes one scoped fix, provisions a new frozen
   candidate, and reruns only the affected live lane(s). Multiple workers never
   edit the same source during diagnosis.
7. **Regression gates last.** After the focused live lanes pass, run the
   narrow unit/check targets implied by the change. Run `pnpm check`, tests,
   and builds once at the coherent integration boundary, not after each edit.
8. **Rotate through coverage waves.** Reassign each available worker slot to
   the next independent recording, oversight, repair, persistence/reuse,
   scenario-breadth, performance, or browser-parity brief until every row has
   live evidence or a precisely recorded blocker. Use as many workers over the
   campaign as useful; do not manufacture parallelism when lanes depend on the
   same fix or mutable resource.

## Required worker report

Each report records, without secrets or page values:

- worker/lane, scenario and instruction-task identifier;
- extension and Core commit hashes, dirty fingerprint, configuration toggle,
  browser/build target, provider/model, and allocated ports/run directory;
- run id; start/end/elapsed time and stage timings when available;
- provider decision count, executed browser action count, completed batch sizes,
  token/cost accounting, stop code/reason, permission/refusal events;
- whether a Flow was proposed, approved, persisted, executed, repaired, rerun,
  and deterministically reused;
- oracle result plus the call-by-call evidence that supports it;
- exact classification: product defect, facility defect, provider noise, or
  inconclusive, with no unbounded retry.

Reports include identifiers, counts, codes, and timings only. They never copy
tokens, credentials, cookies, recorded page contents, browser state, or entered
values.

## User manual-testing intake

The user's hands-on findings enter through
[Manual Panel Test Findings](../../manual-panel-test-findings.md). The user may
paste rough notes into its Quick Drop or use the full finding template. The
supervisor assigns stable `PANEL-###` identifiers, triages independent issues
into bounded worker briefs, verifies each worker's evidence, and updates the
finding through ready-for-retest and closed. A live-validated fix may merge to
`dev` without waiting for unrelated manual findings.

## Retry and stop rules

Retry once only for a recognized provider/facility signature such as an empty
generation HTTP 400 or a known transient launch failure, using the same source,
configuration, and budget. Never retry away a model decision, permission stop,
action failure, wrong Flow, or failed oracle. Stop the cohort immediately if a
lasting action executes without permission, any action runs after a refusal or
unstable-target stop, provenance differs, stores/profiles overlap, or batching
systematically stops after action one.

## Acceptance gates

- Baseline and batching lanes both create a reviewable Flow and pass the same
  scenario oracle; batching is not accepted merely for executing more tools.
- At least one enabled decision completes two or more ordered actions, and no
  later action executes after refusal, permission-required, failed action, or
  invalid target-continuity evidence.
- Enabled provider decisions fall materially below baseline; the initial goal
  is at least 25%, with elapsed stage timings, token use, and cost recorded so
  latency work optimizes the actual bottleneck.
- The panel lane proves instruction/recording entry, visible progress,
  review/approval, run, failure, repair, rerun, and reuse through the product
  UI. Any bypassed step is named and remains open.
- Only after those live gates pass do narrow automated checks and one final
  integration gate determine whether the candidate can merge.

## Shutdown and integration

At each barrier the supervisor stops every lane's server and browser, confirms
its allocated ports are closed, and preserves ignored run artifacts for later
inspection. A successful paired task finishes downstream first and Core second,
then the supervisor pushes both `dev` branches as one coherent unit. Failed or
inconclusive experiments remain unmerged; their evidence report records why.

## Next execution step

Resume t027 without merging it. Add the same-code single-action/multi-action
configuration seam, re-prove the focused Chromium A/B, freeze the candidate,
then dispatch the three lanes above with unique resources and fixed provider
budgets.

## Active Worker Briefs

### Brief: w2-t027-batch-toggle
- Repository: paired t027; Core implementation, downstream report
- Task: add a real-plan configuration seam that selects one action per evidence
  decision or permits the existing bounded action batch, with single-action as
  an explicit testable setting; preserve all stop/safety semantics.
- Required reads: Week 2 Current State; this plan; Core evidence-loop,
  loop-limits, service request/plan construction, and their direct contracts
- Owns (may edit): Core `runtime/llm/evidence-loop.ts`,
  `runtime/loop-limits/{evidence-loop,flow-bootstrap-evidence-loop}.ts`,
  `runtime/service.ts`, directly required Core contract/barrel files, and
  downstream `reports/w2-t027-batch-toggle.md`
- Must not touch: downstream source/tests, UI, other reports/working docs,
  commits/pushes, or full suites
- Definition of done: one candidate supports same-code baseline and batching;
  build/type check only if needed after implementation; report exact live
  configuration path for the supervisor
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-batch-toggle.md`

### Brief: w2-panel-golden-path
- Repository: this repository and paired Core, read-only except report
- Task: trace the exact production panel/extension path for typed instruction,
  recording, progress, Flow review/approval, run, failure, repair, rerun, and
  persisted reuse; identify existing Lab drivers and the smallest missing seam.
- Required reads: Week 2 Current State; this plan; panel E2E/Lab entry points,
  scenario manifests, production extension fixture, and direct Core UI routes
- Owns (may edit): only `reports/w2-panel-golden-path.md`
- Must not touch: source/tests, other reports/working docs, processes, commits,
  pushes, provider calls, or broad documentation
- Definition of done: executable lane design with exact command/config,
  assertions for every visible stage, file ownership for missing work, and
  blockers separated from already-supported steps
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-golden-path.md`

### Brief: w2-safety-performance-lanes
- Repository: this repository and paired Core, read-only except report
- Task: map existing live scenarios/assertions for refusal, permission, failed
  actions, navigation, target instability, and stage timing; design independent
  worker lanes and name the smallest missing measurement hooks.
- Required reads: Week 2 Current State; this plan; t025/t026 reports; current
  multi-action spec; Lab evaluation/timing contracts and runner summaries
- Owns (may edit): only `reports/w2-safety-performance-lanes.md`
- Must not touch: source/tests, other reports/working docs, processes, commits,
  pushes, provider calls, or run artifacts
- Definition of done: a live-first matrix of exact scenarios/commands/oracles,
  safe parallel groupings, timing fields already emitted versus missing, and
  narrowly owned follow-up files
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-safety-performance-lanes.md`

### Brief: w2-t027-lab-batch-control
- Repository: t027 downstream implementation; Core is read-only
- Task: expose Core's `maxActionsPerDecision: 1 | 16` through the real Lab
  live create-flow path using an explicit CLI option, so isolated baseline and
  batching runs differ only by that option.
- Required reads: Week 2 Current State; this plan; batch-toggle report;
  downstream CLI LLM option parsing, `LiveLlmPlan`, flow settings, and creation
  request construction plus their direct barrels/contracts
- Owns (may edit): `packages/test-runner/src/commands.ts`,
  `packages/test-runner/src/live-llm/{live-llm-plan,flow-settings}.ts`, directly
  required test-runner live-plan/command contract files, and
  `reports/w2-t027-lab-batch-control.md`
- Must not touch: Core, extension/domain source, browser tests, other reports /
  working docs, commits/pushes, live/provider/full-suite runs
- Definition of done: `--llm-max-actions-per-decision 1|16` reaches the real
  create-flow request, rejects other values/non-create use, and is recorded in
  the live snapshot/plan; run only the narrow build/type check needed
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-lab-batch-control.md`

### Brief: w2-t027-batch-safety-spec
- Repository: t027 downstream; production source and Core are read-only
- Task: add one focused live Chromium spec proving an ordered batch stops and
  does not execute later actions after target instability, refusal/not-applied
  mutation, navigation, and intervention, while retaining stable continuation.
- Required reads: Week 2 Current State; safety-performance report; existing
  multi-action and target-stability specs; directly reused fixture helpers
- Owns (may edit): only
  `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-safety.spec.ts`
  and `reports/w2-t027-batch-safety-spec.md`
- Must not touch: production/Core/test-runner source, existing tests, other
  reports/working docs, commits/pushes, provider/full-suite runs
- Definition of done: focused spec uses real Chromium/content action path,
  asserts stop code plus next action not run for each feasible row, runs only
  this spec live, and reports any impossible row rather than changing product
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-batch-safety-spec.md`

### Brief: w2-t027-panel-golden-orchestrator
- Repository: t027 downstream; Core is read-only
- Task: implement the smallest test-runner orchestrator that carries one exact
  Flow identity through typed panel creation, visible review/apply, run,
  induced failure, repair review/apply, rerun, restart, and saved reuse, reusing
  existing production UI drivers and BrowserEvidenceRecorder.
- Required reads: Week 2 Current State; panel-golden-path report; only the
  driver modules and package/script registrations named there
- Owns (may edit): new `packages/test-runner/src/panel-golden-path/`, new
  `scripts/run-panel-golden-path.mjs`, directly required test-runner barrel,
  root `package.json`, and `reports/w2-t027-panel-golden-orchestrator.md`
- Must not touch: Core or extension/domain production source, existing driver
  internals, other reports/working docs, commits/pushes, provider/full suites
- Definition of done: launcher composes existing drivers, binds exact IDs,
  asserts the twelve visible stages where supported, explicitly fails open
  gaps rather than claiming coverage, and passes a narrow build/type check;
  live run remains a separate isolated validation lane
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-golden-orchestrator.md`

### Brief: w2-t027-provider-baseline
- Repository: pinned t027 validation pair, source read-only
- Task: run the real DeepSeek `social-scheduler-schedule-post` created-Flow
  lane with `--llm-max-actions-per-decision 1`; inspect artifacts call by call.
- Required reads: Week 2 Current State; concurrent plan acceptance/stop rules;
  batch-control report; only this run's sanitized artifacts
- Owns (may edit): only main t027
  `reports/w2-t027-provider-baseline.md`; run artifacts stay ignored
- Must not touch: source/tests/other reports, manual panel, commits/pushes, or
  retry except one recognized provider/facility transient
- Definition of done: record exact candidate hashes, instance/run root, run id,
  elapsed time, calls/actions/tokens/cost, Flow/proposal/playback/oracle outcome,
  stop reason, and call-by-call evidence classification without page content
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-provider-baseline.md`

### Brief: w2-t027-provider-batching
- Repository: separate pinned t027 validation pair, source read-only
- Task: run the identical real DeepSeek created-Flow lane with
  `--llm-max-actions-per-decision 16`; prove a completed batch and inspect all
  later-action stop boundaries call by call.
- Required reads: same as baseline brief; only this lane's sanitized artifacts
- Owns (may edit): only main t027
  `reports/w2-t027-provider-batching.md`; run artifacts stay ignored
- Must not touch: source/tests/other reports, manual panel, commits/pushes, or
  retry except one recognized provider/facility transient
- Definition of done: same measurements as baseline plus batch sizes/positions,
  stop codes, proof no later action crossed a stop, and fair A/B classification
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-provider-batching.md`

### Brief: w2-panel-storage-layout
- Repository: paired t027, read-only diagnosis except unique report
- Task: reproduce/trace PANEL-002, where creating an Automation Studio project
  reports that program document transactions require storage layout v2;
  identify whether safe framework migration, launch setup, or product UI is
  missing. Preserve all user/runtime data.
- Required reads: manual finding PANEL-002; Core storage-layout/setup/migration
  route and project creation transaction path; bounded server trace/metadata
- Owns (may edit): only downstream
  `reports/w2-panel-storage-layout.md`
- Must not touch: `.fluxiq` contents, source/tests, manual inbox, running panel,
  processes, commits/pushes, or any migration/reset
- Definition of done: exact root cause and current layout state without private
  data; safe non-destructive fix path; owned files for implementation; focused
  live retest steps and compatibility risk
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-storage-layout.md`

### Brief: w2-t027-panel-live
- Repository: pinned t027 panel validation pair, source read-only
- Task: finish isolated provisioning and execute `pnpm panel:golden` through
  the production FluxIQ panel/extension, preserving exact Flow identity across
  typed creation, review/apply, run, repair, rerun, restart/reuse, and recording.
- Required reads: panel-golden-path and orchestrator reports; concurrent plan
  acceptance/stop rules; only this run's sanitized evidence bundles
- Owns (may edit): only main t027 `reports/w2-t027-panel-live.md`; ignored
  artifacts stay in the assigned panel run/workspace directories
- Must not touch: source/tests/other reports, user's port-3000 panel/runtime
  data, commits/pushes, or credentials outside process-local environment
- Definition of done: run the actual panel launcher; record every visible stage
  as verified/unverified/failed, exact IDs/codes/counts/timings/oracles, first
  real blocker, and no claim of completion from API state alone
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-live.md`

### Brief: w2-panel-autofill
- Repository: paired t027; live reproduction and focused Core web UI fix
- Task: reproduce PANEL-003 in Chromium, identify why ordinary authenticated
  forms are classified as login forms, then add the narrow semantic/autocomplete
  correction without weakening the real login/password-manager experience.
- Required reads: manual finding PANEL-003; affected rendered form components;
  AuthShell login form as the positive control; direct UI test ownership
- Owns (may edit): only confirmed affected Core `apps/web/src/` form/component
  files, their directly owned focused tests, and downstream
  `reports/w2-panel-autofill.md`
- Must not touch: storage/runtime data, downstream production source, other
  reports/working docs, provider lanes, commits/pushes, or full suites
- Definition of done: live browser reproduction first; ordinary forms no longer
  expose credential-field semantics while login retains correct username /
  current-password autocomplete; focused live retest then narrow UI tests
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-autofill.md`

### Brief: w2-panel-runtime-initialization
- Repository: paired t027; Core web implementation with isolated live proof
- Task: fix PANEL-002 by serializing awaited panel runtime initialization and
  running setup only for genuinely fresh storage before authentication writes;
  fail closed for legacy/incomplete layouts and preserve all existing data.
- Required reads: PANEL-002 and storage-layout report; Core web
  `lib/fluxiq.ts`, `instrumentation.ts`, their focused tests; framework setup
  state contract only
- Owns (may edit): Core `apps/web/src/lib/fluxiq.ts`,
  `apps/web/src/instrumentation.ts`, directly owned focused test, downstream
  `reports/w2-panel-runtime-initialization.md`
- Must not touch: user's `.fluxiq`, migration implementation/API/UI, unrelated
  Core/downstream source, other reports/docs, commits/pushes, or full suites
- Definition of done: isolated empty-root panel creates v2 marker before login,
  first login/project creation/restart works live, legacy/incomplete roots do
  not auto-migrate; only after live pass run focused tests/check
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-runtime-initialization.md`

### Brief: w2-t027-single-action-context
- Repository: isolated baseline validation pair; Core fix, downstream read-only
- Task: trace the live `flow_bootstrap.provider_evidence_loop_context_invalid`
  produced only by `maxActionsPerDecision=1`, make the smallest context/schema
  fix, and rerun the identical real-provider baseline before any unit tests.
- Required reads: provider-baseline report and sanitized failed run artifact;
  Core evidence-loop decision schema plus the direct provider context validator
- Owns (may edit): isolated Core evidence-loop and directly responsible
  `runtime/llm/harness/` context/schema files, directly owned focused test only
  after live success, and main downstream
  `reports/w2-t027-single-action-context.md`
- Must not touch: main task source, batching/panel lanes, user panel/data,
  unrelated Core/downstream files, commits/pushes, or full suites
- Definition of done: exact context rejection proven; smallest fix; same frozen
  baseline reaches provider and either creates/runs/passes its Flow or exposes
  the next product blocker; narrow test only after live success
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-single-action-context.md`

### Brief: w2-t027-batch-telemetry
- Repository: isolated batching validation pair; paired implementation/rerun
- Task: publish the minimum sanitized per-decision batch telemetry needed to
  prove real multi-action use—action count/ordinals, closed result codes, and
  stop code—without prompts, inputs, selectors, page evidence, or values; then
  rerun the identical batching lane live.
- Required reads: provider-batching report; Core evidence trace audit detail /
  batch trace types; downstream creation snapshot projection and validation
- Owns (may edit): isolated Core batch/audit projection files, isolated
  downstream creation/live snapshot projection files and directly owned tests
  only after live proof, plus main report `reports/w2-t027-batch-telemetry.md`
- Must not touch: main task source, baseline/panel lanes, user panel/data,
  unrelated files, commits/pushes, or full suites
- Definition of done: sanitized artifact proves or disproves completed batches
  and every stop boundary; identical real-provider candidate rerun passes Flow,
  playback, and oracle; narrow tests only after live success
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-batch-telemetry.md`

### Brief: w2-t027-panel-driver-fix
- Repository: isolated panel validation pair; downstream driver fix/rerun
- Task: make `panel:golden` prepare its blank workspace before creation and
  make the project-name/PIN locators match the current required-field labels;
  rerun the same production panel lane immediately.
- Required reads: panel-live report; golden orchestrator lane/launcher; blank
  workspace preparation driver and existing working provisioning locator
- Owns (may edit): isolated downstream `panel-golden-path/lane.ts`, directly
  responsible blank-workspace driver locator file, focused tests only after
  live progression, and main report `reports/w2-t027-panel-driver-fix.md`
- Must not touch: Core/product UI, main task source, user panel/data, provider
  A/B lanes, unrelated files, commits/pushes, or full suites
- Definition of done: actual panel progresses past project creation and into
  the next visible stage or completes; inspect browser evidence; add narrow
  tests only after live progression; report next exact blocker honestly
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-driver-fix.md`

### Brief: w2-t027-panel-driver-labels
- Repository: isolated panel validation pair; downstream driver fix/rerun
- Task: replace the remaining brittle exact-label assumptions in the current
  blank-workspace form with semantic locators matching the production UI,
  beginning with Description; rerun `panel:golden` immediately after the
  smallest coherent locator repair.
- Required reads: panel-driver-fix report; blank-workspace driver; production
  Create Project form markup; existing focused preparation tests
- Owns (may edit): isolated downstream blank-workspace driver, its directly
  owned focused tests only after live progression, and main report
  `reports/w2-t027-panel-driver-labels.md`
- Must not touch: Core/product UI, main task source, user panel/data, provider
  A/B lanes, unrelated files, commits/pushes, or full suites
- Definition of done: actual production panel clears Description and advances
  to the next visible stage or completes; inspect browser evidence, then run
  only the narrow owned test; report the next exact blocker honestly
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-driver-labels.md`

### Brief: w2-t027-panel-token-confirmation
- Repository: isolated panel validation pair; downstream driver fix/rerun
- Task: align the golden-path driver's high-token confirmation boundary with
  the production UI contract at equality, confirm through the visible panel,
  and rerun from the same isolated golden path immediately.
- Required reads: panel-driver-labels report; panel golden-path lane; production
  UI high-token confirmation condition and diagnostic contract
- Owns (may edit): isolated downstream panel golden-path driver/launcher,
  directly owned focused tests only after live progression, and main report
  `reports/w2-t027-panel-token-confirmation.md`
- Must not touch: Core/product UI, main task source, user panel/data, unrelated
  files, provider batch lane, commits/pushes, or full suites
- Definition of done: the visible confirmation is handled at the exact
  production threshold and the real API/provider request begins; continue to
  the next visible stage or report its exact first blocker; run only narrow
  owned tests after the live attempt
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-token-confirmation.md`

### Brief: w2-t027-batch-adoption
- Repository: isolated batching validation pair; paired prompt/rerun iteration
- Task: use the successful telemetry rerun to identify why the provider chose
  only single actions, make the smallest Core instruction/schema-description
  change that clearly prefers multiple ordered actions when they are safe and
  target-stable, then rerun the identical real-provider lane.
- Required reads: batch-telemetry report; evidence-loop system instruction and
  tool schema; sanitized batch counts only (never prompt/page evidence/values)
- Owns (may edit): isolated Core evidence-loop prompt/schema-description files,
  directly owned focused tests only after live proof, and main report
  `reports/w2-t027-batch-adoption.md`
- Must not touch: batch telemetry projection except to retain its existing
  scoped diff, downstream product source, panel/user data, unrelated files,
  commits/pushes, or full suites
- Definition of done: identical real-provider run creates/applies the Flow,
  passes playback/oracle, and sanitized telemetry proves at least one decision
  completed two or more actions; otherwise report the exact adoption evidence
  and next smallest lever without claiming batching success
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-batch-adoption.md`

### Brief: w2-t027-panel-generation-response
- Repository: isolated panel validation pair; downstream observability/rerun
- Task: preserve a sanitized generation-response status, closed diagnostic
  code/stage, and visible panel error when the confirmed Explore/create request
  settles; rerun the identical production panel path and diagnose the response.
- Required reads: panel-token-confirmation report; golden-path lane; production
  generation API/UI response contract; existing event/error sanitization
- Owns (may edit): isolated downstream panel golden-path driver and directly
  owned event/test types, focused tests only after live progression, and main
  report `reports/w2-t027-panel-generation-response.md`
- Must not touch: Core/product UI, main task source, user panel/data, batch lane,
  unrelated files, commits/pushes, or full suites
- Definition of done: live evidence records the response status plus only
  closed safe diagnostic fields/visible generic error, and either advances to
  proposal review or identifies the exact next product/driver blocker; narrow
  owned tests run only after the live attempt
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-generation-response.md`

### Brief: w2-t027-panel-busy-confirmation
- Repository: isolated panel validation pair; downstream driver fix/rerun
- Task: after approving the visible high-token confirmation, treat that same
  modal's disabled/busy `Building...` state as transitional rather than a new
  confirmation, then await response, visible alert, proposal, or timeout.
- Required reads: panel-generation-response report; golden terminal observer;
  production confirmation modal busy/close behavior and response events
- Owns (may edit): isolated downstream panel golden-path observer/driver and
  directly owned focused tests only after live progression, plus main report
  `reports/w2-t027-panel-busy-confirmation.md`
- Must not touch: Core/product UI, user panel/data, batch lane, unrelated files,
  commits/pushes, or full suites
- Definition of done: the same production panel run advances beyond the busy
  confirmation into a real response/alert/proposal or reaches its true timeout;
  evidence records only sanitized status/code/stage and provider counts
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-busy-confirmation.md`

### Brief: w2-t027-panel-preflight-diagnosis
- Repository: isolated panel validation pair; downstream diagnosis/rerun
- Task: project the response's closed pre-provider diagnostic stage and bounded
  issue codes, trace them to the exact panel/Core contract mismatch, apply only
  the smallest in-scope repair if downstream-owned, and rerun the real UI path.
- Required reads: panel-busy-confirmation report; generation API response and
  Flow Bootstrap diagnostic contracts; corresponding panel request builder
- Owns (may edit): isolated downstream golden observer/request builder and
  directly owned tests; if the defect is Core-owned, report the exact file/seam
  without editing it; main report `reports/w2-t027-panel-preflight-diagnosis.md`
- Must not touch: unrelated Core/product UI, user panel/data, batch lane,
  unrelated files, commits/pushes, full suites, or raw prompt/page evidence
- Definition of done: live response records closed stage/issue codes and the
  exact contract mismatch; a downstream fix, if applicable, advances to a
  provider call/proposal or reports the next blocker; narrow tests follow live
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t027-panel-preflight-diagnosis.md`

### Brief: w2-panel-existing-root-recovery
- Repository: main t027 panel root plus Core, strictly read-only diagnosis
- Task: determine the official non-destructive recovery path for the user's
  marker-less root created before awaited initialization, preserving its auth
  database and any state; do not execute migration, setup, reset, or writes.
- Required reads: PANEL-002 diagnosis/runtime reports; Core storage inspection,
  migration source/tests/operations doc; metadata-only current root inventory
- Owns (may edit): only main report
  `reports/w2-panel-existing-root-recovery.md`
- Must not touch: user's `.fluxiq` contents, running port-3000 panel, source,
  tests, branches, commits/pushes, raw database rows, credentials, or secrets
- Definition of done: report current layout classification, which official
  operation applies, its backup/rollback and server-stop requirements, exact
  expected file transitions, risks, and whether explicit user approval is
  required before the supervisor may execute it
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-existing-root-recovery.md`

### Brief: w2-host-state-command-timeout
- Repository: isolated paired t027 unit; downstream runtime repair/live proof
- Task: apply a finite command timeout to web host snapshot/route-state gateway
  captures so a missing browser answer cannot leave created-Flow playback
  running beyond its HTTP/read-back windows; rerun one created Flow live first.
- Required reads: `reports/w2-t011-created-run-timeout.md`; downstream host
  runtime/dispatcher; ordinary action timeout contract; current adoption hang
- Owns (may edit): downstream `domain/src/runtime/host-runtime.ts`, its directly
  owned focused tests only after live proof, and main report
  `reports/w2-host-state-command-timeout.md`
- Must not touch: Core, batch prompt/telemetry, panel/user data, unrelated files,
  commits/pushes, full suites, or raise outer HTTP/grant timeouts
- Definition of done: real created-Flow playback either completes normally or
  fails terminally with a bounded host-state timeout and readable run detail;
  it must not remain running through the 600-second read-back; narrow tests
  follow the live result
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-host-state-command-timeout.md`

### Brief: w2-uncommitted-v2-adoption
- Repository: isolated paired t027 unit; Core framework recovery implementation
- Task: add an explicit, fail-closed recovery seam for a marker-less root that
  contains only valid v2-owned top-level state, preserving existing databases
  byte-for-byte and writing only the missing v2 commit marker; never auto-adopt.
- Required reads: existing-root-recovery report; Core storage layout/migration,
  framework public API and tests; operations docs; panel initialization contract
- Owns (may edit): Core framework storage inspection/recovery/API and directly
  owned focused tests/docs, plus main downstream report
  `reports/w2-uncommitted-v2-adoption.md`
- Must not touch: user's `.fluxiq` or server, downstream product source, batch/
  panel lanes, unrelated files, commits/pushes, full suites, or automatic startup
- Definition of done: isolated live fixture made through real fresh panel/auth
  then stripped only of its marker is explicitly adopted and restarts with auth
  intact; byte hash of preexisting DB is unchanged; legacy roots, journal,
  unknown/ambiguous entries, and malformed DB fail without writes; focused tests
  only after live proof
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-uncommitted-v2-adoption.md`

### Brief: w2-panel-evidence-runtime-binding
- Repository: isolated panel pair; Core diagnostic/root-cause repair and rerun
- Task: give an absent evidence runtime/tools its own closed pre-provider code,
  expose only bounded binding/tool-count status, reproduce through the panel,
  trace the instance mismatch or earlier exception, fix the smallest Core-owned
  cause, and rerun the real UI path.
- Required reads: panel-preflight-diagnosis report; Core Flow Bootstrap
  evidence-guided branch/catch; web runtime instance lifecycle/status; downstream
  host registration and five-tool binding seam
- Owns (may edit): isolated Core automation service failure vocabulary/status,
  Core web runtime status or lifecycle files, directly owned focused tests only
  after live evidence, and main report `reports/w2-panel-evidence-runtime-binding.md`
- Must not touch: downstream request/product source, user panel/data, batch lane,
  unrelated files, commits/pushes, full suites, or expose tools/input details
- Definition of done: panel status/response distinguishes missing binding from
  other preflight failure; root cause is fixed so real panel reaches a provider
  call/proposal, or exact remaining Core exception is reported; narrow tests
  follow live progression
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-evidence-runtime-binding.md`

### Brief: w2-batch-schema-order
- Repository: fresh isolated paired t027 unit; Core schema experiment/live proof
- Task: place the existing multi-action evidence-decision schema variant before
  singular variants without changing wording or semantics, then rerun the same
  real-provider created-Flow lane with integrated sanitized telemetry.
- Required reads: batch-adoption and batch-telemetry reports; evidence decision
  schema ordering and existing provider validator tests
- Owns (may edit): isolated Core evidence-batch schema ordering and directly
  owned focused tests only after live proof, plus main report
  `reports/w2-batch-schema-order.md`
- Must not touch: prior failed wording diff, host timeout, panel/user data,
  unrelated files, commits/pushes, or full suites
- Definition of done: Flow creation/playback/oracle pass and telemetry proves at
  least one decision completed two or more actions; otherwise record the exact
  zero-adoption evidence and do not integrate the experiment
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-batch-schema-order.md`

### Brief: w2-recording-panel-live
- Repository: fresh isolated paired t027 candidate; live validation/report only
- Task: exercise the real panel plus loaded extension recording path end to end:
  start recording, perform the scenario task, stop/finalize, inspect the visible
  timeline, generate/apply its deterministic Flow/Subflow, run it, and reuse it.
- Required reads: panel-golden-path/orchestrator reports; existing demo recording
  drivers and one stable recording scenario; only this run's sanitized artifacts
- Owns (may edit): only main report `reports/w2-recording-panel-live.md`; ignored
  run artifacts stay in assigned isolated roots
- Must not touch: source/tests, user panel/profile/data, provider batch lane,
  unrelated reports, commits/pushes, or full suites
- Definition of done: record every visible stage with exact stable IDs/counts/
  timings and page oracle; distinguish UI/extension/API evidence; if blocked,
  stop at and report the first exact product/driver failure without API-only pass
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-recording-panel-live.md`

### Brief: w2-repair-reuse-live
- Repository: fresh isolated paired t027 candidate; real-provider live report
- Task: run one existing created Flow into a controlled target drift, observe
  failure diagnosis and LLM repair, review/apply the repaired Flow, rerun to a
  passing oracle, restart the runtime, then reuse the saved repair without LLM.
- Required reads: t016 created-Flow repair and t025 state-digest reports; current
  repair/reuse driver; one stable scenario manifest; sanitized artifacts only
- Owns (may edit): downstream repair/reuse or blank-workspace driver locators
  when an exact live UI mismatch proves them stale, directly owned focused tests
  only after live progress, and main report `reports/w2-repair-reuse-live.md`;
  ignored artifacts stay in unique isolated roots
- Must not touch: source/tests, user panel/profile/data, recording/batch lanes,
  unrelated reports, commits/pushes, full suites, or retry model decisions
- Definition of done: exact Flow/adaptation/run IDs remain continuous; first run
  fails for intended drift, repair is visibly reviewable/applied, rerun and
  oracle pass, restarted reuse makes zero provider calls; otherwise report the
  first exact blocker and mutation boundary
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-repair-reuse-live.md`

### Brief: w2-unified-evidence-decision-live
- Repository: fresh isolated paired t027 candidate; Core schema experiment/live proof
- Task: replace the competing singular evidence tool-call variants plus optional
  batch variant with one provider-facing `tool_calls` wrapper accepting one to
  the existing bounded maximum, while preserving completion, internal singular
  semantics, ordered execution, permission checks, and every batch stop rule.
- Required reads: batch telemetry/adoption/schema-order reports; evidence-loop
  decision schema/parser; evidence-batch schema/reader/coordinator
- Owns (may edit): isolated Core evidence decision/batch schema, parser and
  directly owned focused tests only after live proof; main report
  `reports/w2-unified-evidence-decision-live.md`
- Must not touch: failed wording/order diffs, downstream source, user panel/data,
  recording/repair lanes, unrelated files, commits/pushes, or full suites
- Definition of done: identical real-provider schedule-post creation, playback,
  and oracle pass; telemetry proves at least one decision executes two or more
  actions. Otherwise record the exact first failure/zero-adoption evidence and
  leave the experiment isolated. Compare provider calls/build and total time.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-unified-evidence-decision-live.md`

### Brief: w2-recording-playback-reuse-live
- Repository: existing isolated `t027-recording-panel` pair/workspace after its
  proven recording-generated Subflow; live validation and report
- Task: run the saved recording-generated Flow through the production panel,
  require every action and scenario oracle to pass, let the runtime stop, then
  start it again and rerun the same saved Flow without regeneration or provider.
- Required reads: `reports/w2-recording-panel-live.md`; demo playback driver;
  saved workspace state and only sanitized artifacts from these runs
- Owns (may edit): downstream demo playback driver only if an exact live UI
  mismatch proves it stale, directly owned focused tests after live progress,
  and main report `reports/w2-recording-playback-reuse-live.md`
- Must not touch: user panel/profile/data, Core/product runtime, provider/batch/
  repair lanes, recording generation, unrelated files, commits/pushes/full suites
- Definition of done: two panel-started runs across separate runtime lifetimes
  execute the same saved graph and identities, every action succeeds, both page
  oracles pass, and provider call count is zero; otherwise stop at first failure
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-recording-playback-reuse-live.md`

### Brief: w2-unified-decision-completion-repair
- Repository: existing isolated `t027-unified-decision` pair retaining only its
  two-file unified-decision candidate; Core completion diagnosis/repair/live proof
- Task: trace the two `bootstrap.unknown_parameter` completion refusals to the
  closed parameter-shape invariant, add only bounded non-content diagnostics if
  needed, and implement the smallest safe normalizer/schema correction without
  weakening unknown-parameter refusal for genuinely unsupported fields.
- Required reads: unified-decision report; bootstrap completion normalization,
  validation feedback, node catalog parameter schemas, and relevant prior easy-
  model-output report; only this run's local fixture artifacts
- Owns (may edit): isolated Core bootstrap normalization/schema/closed diagnostics
  and focused owned tests only after a live pass; unified two-file candidate;
  main report `reports/w2-unified-decision-completion-repair.md`
- Must not touch: downstream source, user panel/data, batch executor safety,
  permissions, recording/repair lanes, unrelated files, commits/pushes/full suite
- Definition of done: same real-provider lane completes at least one 2+ action
  batch, creates/applies/plays the Flow, and passes the oracle; unsupported
  parameters still fail closed. Otherwise stop at the next exact failure.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-unified-decision-completion-repair.md`

### Brief: w2-playback-latency-live
- Repository: existing isolated `t027-recording-panel` pair/workspace after two
  proven deterministic playbacks; downstream timing diagnosis/live iteration
- Task: use sanitized stage/action timings to decompose the ~16 s panel runtime-
  run step, identify the largest avoidable fixed wait or polling delay, change
  only that owner, and rerun the same saved Flow once through the panel.
- Required reads: recording playback/reuse report; its sanitized timelines;
  demo panel-run/control-wait driver and directly implicated host wait only
- Owns (may edit): downstream demo playback/panel wait or test-runner host wait
  proved responsible, directly owned focused tests after live improvement, and
  main report `reports/w2-playback-latency-live.md`
- Must not touch: Core/product action semantics, saved workspace identities,
  provider/batch/repair lanes, user panel/data, unrelated files/full suites/
  commits/pushes
- Definition of done: exact saved Flow still passes every action and oracle with
  zero LLM activity, and measured runtime-run latency falls materially; if the
  16 s is real action time, report the breakdown and do not weaken waits.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-playback-latency-live.md`

### Brief: w2-unified-decision-provider-repro
- Repository: unchanged isolated `t027-unified-decision` completion-repair candidate
- Task: rerun the identical real-provider schedule-post lane exactly once, with
  no source mutation, to distinguish the pre-decision HTTP 400 from the earlier
  accepted unified schema and exercise the completion wording if provider entry
  succeeds.
- Required reads: unified-decision and completion-repair reports; sanitized
  artifacts only
- Owns (may edit): only main report
  `reports/w2-unified-decision-provider-repro.md`; ignored isolated artifacts
- Must not touch: source/tests, user panel/data, other lanes, retries beyond this
  one run, commits/pushes/full suites
- Definition of done: record whether provider entry succeeds; acceptance still
  requires a completed 2+ action batch, Flow creation/playback, and passing
  oracle. Stop at the first terminal outcome without changing code.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-unified-decision-provider-repro.md`

### Brief: w2-unified-decision-feedback-only
- Repository: existing isolated `t027-unified-decision` candidate
- Task: remove only the added first-request Flow-script-format sentence while
  retaining unified decisions and the post-refusal unknown-parameter feedback;
  rerun the identical provider lane once to test whether provider entry returns
  and whether the model can correct a refusal without enlarging initial schema.
- Required reads: the three unified-decision reports; exact four-file Core diff
- Owns (may edit): isolated Core `flow-script-format.ts` only to restore its base
  text; main report `reports/w2-unified-decision-feedback-only.md`
- Must not touch: unified schema/executor, normalizer/validator, downstream/user
  data/other lanes, more than one run, tests/full suites/commits/pushes
- Definition of done: provider entry, a 2+ action batch, Flow creation/playback,
  and oracle pass; otherwise stop at the exact terminal outcome and keep isolated
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-unified-decision-feedback-only.md`

### Brief: w2-panel-repair-continuation
- Repository: existing isolated `t027-panel` pair/workspace whose created Flow
  passed apply and deterministic execution; production UI repair continuation
- Task: induce the declared controlled drift, present the failed run, request
  one LLM repair, visibly review/apply it, rerun to a passing oracle, restart,
  and reuse the exact saved repair without another provider call.
- Required reads: panel evidence-runtime report; t016 repair report; persisted
  workspace binding; repair proposal/apply/validation drivers
- Owns (may edit): downstream repair UI drivers/assertions proved stale by live
  evidence and focused tests after live progress; main report
  `reports/w2-panel-repair-continuation.md`
- Must not touch: Core, user panel/data, batching/recording/performance lanes,
  unrelated files, commits/pushes/full suites/model retries
- Definition of done: continuous project/Flow/run/adaptation IDs; intended failure
  is visibly presented; repair review/apply and oracle pass; restarted reuse uses
  zero provider calls. Otherwise stop at first exact boundary.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-repair-continuation.md`

### Brief: w2-panel-run-presentation-live
- Repository: existing isolated `t027-recording-panel` workspace with passed
  deterministic runs; production panel UI assertion
- Task: open the saved Flow's latest run in the real panel and prove the exact
  run row, terminal status, action log, and four successful attempts are visibly
  bound to the durable run identity; repair only stale UI locators/assertions.
- Required reads: recording playback/reuse and latency reports; panel runtime
  run/action-log UI; current demo panel-run driver
- Owns (may edit): downstream panel-run presentation driver/assertions and
  directly owned focused tests after live proof; main report
  `reports/w2-panel-run-presentation-live.md`
- Must not touch: Core/product runtime, saved data, provider/batch/repair lanes,
  user panel/data, unrelated files, commits/pushes/full suites
- Definition of done: real panel visibly presents the exact durable run and all
  four successful action attempts with no API-only inference; stop at first
  exact product/driver failure.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-run-presentation-live.md`

### Brief: w2-unified-no-progress-completion
- Repository: existing isolated `t027-unified-decision` feedback-only candidate
- Task: inspect the sanitized repeated-request sequence after the successful
  four-action batch and safe target-change stop; strengthen only Core's bounded
  already-answered/already-observed feedback so the model completes or chooses
  genuinely different evidence instead of repeating until the guard fires.
- Required reads: feedback-only report; evidence-loop repeat/no-progress path;
  decision-feedback constants and their focused tests
- Owns (may edit): isolated Core evidence-loop repeat feedback and directly
  owned focused tests only after live pass; main report
  `reports/w2-unified-no-progress-completion.md`
- Must not touch: batch schema/executor/safety, completion normalizer, downstream,
  user panel/data, other lanes, more than one live run, full suites/commits/pushes
- Definition of done: same lane completes a 2+ action batch, creates/applies/
  plays the Flow, and passes oracle; repeated requests remain fail-closed and
  bounded. Otherwise stop at the next exact terminal outcome.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-unified-no-progress-completion.md`

### Brief: w2-panel-load-latency-live
- Repository: fresh isolated pair from current integrated t027; production web
  panel load/perceived-latency diagnosis
- Task: open an authenticated Automation Studio project in the real panel,
  record content-free endpoint counts/durations until interactive, identify the
  largest duplicate/fixed wait (especially snapshot/context/project fan-out),
  change one proven owner, and rerun the same warm load.
- Required reads: panel golden and playback-latency reports; Automation Studio
  panel data-loading hooks/routes implicated by the live network trace only
- Owns (may edit): isolated Core web panel request scheduling/cache/deduping code
  and directly owned focused tests after live improvement; main report
  `reports/w2-panel-load-latency-live.md`
- Must not touch: runtime/domain semantics, provider/batch/repair/recording lanes,
  user panel/data, auth/storage, unrelated files, full suites/commits/pushes
- Definition of done: same UI state remains correct and interactive while warm
  load or duplicate request count falls materially; otherwise report measured
  breakdown and make no speculative change.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-load-latency-live.md`

### Brief: w2-panel-unified-batch-live
- Repository: fresh isolated pair from current integrated t027 plus exactly the
  two-file unified provider-decision candidate; real production panel UI
- Task: run typed instruction → high-token confirmation → provider proposal →
  visible Audit/approve/apply → deterministic run/oracle through the panel, and
  inspect sanitized proposal audit for a completed 2+ action decision.
- Required reads: panel evidence-runtime report; unified-decision and feedback-
  only reports; current two-file schema/evidence-loop candidate only
- Owns (may edit): isolated Core `evidence-batch/schema.ts` and `evidence-loop.ts`
  exactly; main report `reports/w2-panel-unified-batch-live.md`
- Must not carry: completion-format/feedback or no-progress wording experiments;
  downstream/user panel/data/other lanes; tests, retries, full suites/commits/pushes
- Definition of done: real panel proposal audit proves a 2+ completed action
  batch and the same proposal applies/runs to 4/4 actions plus passing oracle;
  otherwise stop at the first exact terminal outcome.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-unified-batch-live.md`

### Brief: w2-reconnect-reuse-live
- Repository: fresh isolated pair from current integrated t027 with a copied
  disposable deterministic demo workspace; production panel/extension live
- Task: connect the unpacked extension, stop the owned Core/gateway while idle,
  restart it, restore authenticated panel and extension connection, then run the
  exact saved Flow to a passing oracle without regeneration or provider calls.
- Required reads: recording playback/reuse report; browser-session connection
  waits; persistent Core process lifecycle; sanitized artifacts only
- Owns (may edit): downstream reconnect/persistence driver only after an exact
  live mismatch, focused owned tests after live progress, and main report
  `reports/w2-reconnect-reuse-live.md`
- Must not touch: user panel/profile/data, Core/product runtime, provider/batch/
  repair lanes, saved source workspace, unrelated files/full suites/commits/pushes
- Definition of done: same project/Flow/graph identities survive full owned
  restart, extension reconnects, 4/4 actions and oracle pass, zero LLM activity;
  otherwise stop at first exact failure.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-reconnect-reuse-live.md`

### Brief: w2-stable-tab-latency-live
- Repository: fresh isolated pair from current integrated t027 with a copied
  disposable deterministic demo workspace; production unpacked extension
- Task: use the measured 14.8-second saved playback as the baseline, trace the
  one-second `waitForTabReady` cadence, implement the narrowest readiness-cache
  or event-invalidated alternative that preserves navigation safety, then run
  the exact saved Flow through the real panel for an A/B latency measurement.
- Required reads: playback-latency report; extension `automation-tab.ts`,
  `action-runner.ts`, `click-landing.ts`, and directly owned readiness tests
- Owns (may edit): isolated extension tab-readiness implementation and directly
  owned focused tests only after live evidence; main report
  `reports/w2-stable-tab-latency-live.md`
- Must not touch: Core/domain semantics, user panel/profile/data, provider/batch/
  repair/recording lanes, snapshots/diffs, unrelated files/full suites/commits
- Definition of done: same project/Flow/graph, 4/4 durable actions, oracle pass,
  zero LLM activity, navigation safeguards retained, and a measured material
  runtime reduction; otherwise revert the candidate and report the boundary.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-stable-tab-latency-live.md`

### Brief: w2-panel-unified-batch-task-live
- Repository: reuse the clean isolated unified candidate and fresh disposable
  panel workspace; real production UI and headed Chromium
- Task: choose an existing safe fixture/instruction whose next evidence step
  naturally has at least two independent read-only actions, then run typed
  instruction through confirmation and proposal once; continue through visible
  review/apply/playback/oracle only if sanitized audit proves a 2+ action batch.
- Required reads: panel unified-batch report; unified decision live report;
  existing Scenario Lab fixture catalog and candidate prompt/schema only
- Owns (may edit): no source; main report
  `reports/w2-panel-unified-batch-task-live.md`
- Must not touch: candidate schema/executor/prompt, user panel/data, repair/
  recording/performance lanes, tests/full suites/commits/pushes; no provider retry
- Definition of done: one natural real-panel decision completes 2+ ordered safe
  actions, then the same proposal visibly applies and playback passes its page
  oracle; otherwise stop at the first exact terminal outcome and classify it.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-unified-batch-task-live.md`

### Brief: w2-panel-repair-result-boundary
- Repository: fresh isolated pair from current t027 including the live-proven
  downstream repair-driver corrections; copied disposable repair workspace
- Task: use only sanitized durable detail from the failed two-call repair to
  trace why diagnosis+patch yielded zero patch attempts/proposals; fix one
  deterministic Core boundary or add the narrow missing categorical diagnostic,
  then make one real-panel repair attempt and continue review/apply/oracle only
  if that attempt creates exactly one proposal.
- Required reads: panel repair-continuation report; Core recovery annotation
  `annotate.ts`, `patches.ts`, recovery trace/stages, and directly owned tests
- Owns (may edit): isolated Core recovery result/diagnostic boundary and focused
  owned tests after live progress; downstream only if needed to consume the new
  bounded diagnostic; main report `reports/w2-panel-repair-result-boundary.md`
- Must not touch: user panel/data, unified batch/recording/performance lanes,
  raw provider/page content, unrelated files/full suites/commits/pushes; one
  provider-bearing attempt only
- Definition of done: exact categorical cause is durable; ideally one visible
  proposal is reviewed/applied and the same Flow passes its oracle. Stop at the
  first terminal product result without retrying.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-repair-result-boundary.md`

### Brief: w2-panel-diagnostic-identity-live
- Repository: isolated current-t027 downstream plus the unchanged unified Core
  candidate; reuse only disposable product-catalog setup on fresh ports
- Task: reproduce the reporter masking boundary from the completed live run,
  map arbitrary sanitized Core reason/issue identities to a fixed valid Lab
  diagnostic code while retaining bounded categorical detail, then make one
  real-panel attempt to expose the true terminal reason.
- Required reads: panel unified-batch-task report; downstream browser evidence
  diagnostic validation and generation response/error reporting path
- Owns (may edit): downstream evidence/generation diagnostic adapter and its
  directly owned focused tests after the existing live reproduction; main
  report `reports/w2-panel-diagnostic-identity-live.md`
- Must not touch: unified Core candidate, user panel/data, repair/recording/
  performance lanes, raw provider/page content, unrelated files/full suites/
  commits/pushes; one provider attempt after repair only
- Definition of done: reporter never masks the Core terminal result; live panel
  returns one bounded valid diagnostic identity and preserves the actual reason
  category. Batch/apply may continue only if the same attempt passes that gate.
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-panel-diagnostic-identity-live.md`
