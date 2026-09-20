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
