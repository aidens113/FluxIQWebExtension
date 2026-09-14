# `ab-blocker-ranking-refresh` — measured Phase 1.6b ranking

## Outcome

The completed durable pair measures 378 executable runs: 356 passed and 22
failed. Eighteen failures are the three stable variants already ruled out of
Week 1. The other four failures are the only A/B verdict differences and belong
to three downstream lifecycle boundaries which have since been repaired or
hardened. Every tolerance-bearing A/B metric was equivalent.

There is no measured, reproducible Week 1 product failure left on the accepted
repair tree. Two Week 1 release blockers remain: the repaired tree has not yet
passed a fresh clean-pinned A/B pair, and the later observed topology-startup
timeout still lacks its designed closed operation-stage projection. This report
does **not** claim that the fresh post-commit pair exists.

## Measurement basis

- Campaign A: 189 evaluated, 179 passed, 10 failed, plus 12 planned skips.
- Campaign B: 189 evaluated, 177 passed, 12 failed, plus 12 planned skips.
- Stable ruled-out failures: 18/378 runs, six for each of W05 `short-catalog`,
  W13 `banner-absent`, and W24 `unannounced`.
- Variable A/B differences: 4/378 runs across three result groups: one W05
  primary recording, two W19 `expired` Flow runs, and one W25 primary Flow run.
- Metric comparison: all stated tolerances equivalent; overall run p95
  115,898/116,488 ms; packet p95 5,934 bytes and maximum 5,992 bytes.
- Safety/recovery: zero leak findings, zero harness activations, zero
  persistence failures, and zero action-bearing discards across the pair.
- Post-repair targeted runs: W19 successful replays reported `auth_required`
  3/3 after the accepted lifecycle implementation; lifecycle stress passed
  W05 5/5 and W25 5/5 with zero readiness, startup-transport, or raw-fetch
  failures.

## Actual remaining Week 1 blockers

| Rank | Blocker | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- |
| 1 | Fresh repaired clean-pinned A/B acceptance pair has not run | The strict gate covers all 378 executable cells and 126 campaign result groups. The old pair differs on 4 runs / 3 groups and therefore has `comparisonPassed: false` despite metric equivalence | Release-blocking | Certain: this is an explicit missing acceptance observation, not an inferred defect | Senior supervisor: finish gates, commit/push downstream `dev`, dispatch the two durable campaigns, then run the tracked comparison |
| 2 | A bounded topology startup timeout has no durable closed stage | 1/4 accepted-tree W19 invocations failed `process.startup`; its next three confirmations passed. The bundle preserved the category but no `failureDetails`, operation stage, or fixed code. The later W05/W25 stress saw 0/10 startup failures and therefore could not exercise the projection | High diagnostic gap; functional failure was transient | High that the projection is absent; low that the underlying timeout is a reproducible software defect | Downstream test-runner owner: implement `z-startup-stage-design.md` (`scenario.health` / `core.health` only), mutation-prove the closed projector, then supervisor integration gates |

Rank 1 is the final product acceptance gate. Rank 2 must land before that gate so
any recurrence remains actionable after process or host interruption. Neither
item requires a Core change.

## Fixed or closed items

| Closed rank | Item | Measured impact before repair | Closing evidence | Severity before closure | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- | --- |
| C1 | W19 click-landing loss at Stop | 2/6 `expired` A/B repeats failed in B; replay succeeded instead of reporting `auth_required` | The final lifecycle state machine was independently accepted; accepted-tree successful runs reported `auth_required` 3/3 with oracle pass and no harness use | High: false success on an authentication gate and criterion-4 miss | High root-cause and implementation confidence; fresh A/B still required for release acceptance | Supervisor owns the clean-pinned pair; extension lifecycle owner if it recurs |
| C2 | Cold MV3 service-worker readiness window | 1/6 W05 primary-recording A/B repeats timed out before scenario steps | Race-closed 30-second readiness gate is unit/mutation-proved; post-repair W05 stress passed 5/5 with zero readiness failures | High availability, low observed frequency | High boundary diagnosis; moderate confidence that host load was the trigger | Test-runner lifecycle owner if the fresh pair reports `extension.worker` |
| C3 | HTTP startup transport causality was erased | 1/6 W25 primary A/B repeats failed before browser launch as bare `fetch failed` | Fixed HTTP operation stages and closed durable projection are unit/mutation-proved; W25 stress passed 5/5 with no recurrence; non-idempotent project creation remains single-attempt | High diagnosis, low observed frequency | High boundary diagnosis; exact historical operation/code remains unknowable | Test-runner HTTP/coordinator owner if the fresh pair emits a staged transport failure |
| C4 | Benchmark interruption discarded campaign progress | Earlier campaigns were stopped by restart; neither could provide acceptance evidence | Both durable campaigns later completed 189/189 exact cells with 380 contiguous checkpoints each, no active lease, and 189/189 valid bundles; forced kill/resume proof also passed | Critical to repeatability | High | Campaign-store owner only if reconciliation, lease, or checkpoint validation fails |
| C5 | Evidence, fallback, and recording-persistence uncertainty | Previously proof gaps rather than measured failures | Old pair: 378/378 with zero harness activations; required fallback 5/5 in each campaign; zero leak, persistence, and action-bearing-discard findings; bounded packets | High if violated | High at old pin; fresh-pair acceptance remains Rank 1 | Supervisor comparison/attestation pass |

## Ruled-out variants retained in the corpus

| Week 2 rank | Variant | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- | --- |
| W2-1 | W24 `unannounced` | 6/6 failed across A/B (0/3 in each campaign) | High product gap: an unannounced dynamic payload needs an authored contract and safe evaluation path | High; identical and deterministic in both campaigns | Cross-repository Week 2 design: contract/mapper/evaluator owners |
| W2-2 | W05 `short-catalog` | 6/6 failed across A/B (0/3 in each campaign) | Medium-high product gap: recorded pagination assumes a Next action and has no conditional-loop mapper | High; identical and deterministic in both campaigns | Week 2 recording/domain authoring owner, with Core only if a generic loop seam is justified |
| W2-3 | W13 `banner-absent` | 6/6 failed across A/B (0/3 in each campaign) | Medium product gap: optional dismissal needs a failure-route/node-outcome contract without weakening W12 | High; identical and deterministic in both campaigns | Core failure-route/node-policy owner plus downstream mapping/evaluation owner |

These 18 runs explain all failures common to A and B. They stay visible in the
corpus but do not block Week 1 under the recorded scope rulings.

## Non-repeating machine and startup observations

| Watch rank | Observation | Affected cells / runs | Severity | Confidence | Next owner |
| ---: | --- | --- | --- | --- | --- | --- |
| M1 | Accepted-tree topology startup timeout | 1/4 W19 attempts; no repeat in the next three. No equivalent failure in the 10-run W05/W25 stress | High when it occurs because no browser/Flow is reached | Certain category and bound; exact service stage unknown | Rank 2 test-runner diagnostic owner; no retry policy without a staged recurrence |
| M2 | Cold extension-worker timeout | 1/6 old W05 A/B primary-recording repeats; 0/5 post-repair W05 stress runs | High availability, low frequency | High lifecycle boundary; environmental amplifier only moderate | Runner lifecycle owner; inspect only closed `extension.worker` details on recurrence |
| M3 | Pre-return HTTP transport rejection | 1/6 old W25 A/B primary repeats; 0/5 post-repair W25 stress runs | High availability, low frequency | High transport boundary, low exact-cause confidence | Runner HTTP/coordinator owner; use the fixed stage/code, never blind-retry project creation |

The observations are at different boundaries and do not support one shared
software cause. Host load or the known faulty machine may amplify them, but
none repeated in its immediate confirmations. They are watches, not grounds to
broaden timeouts or add unsafe retries.

## Closeout work that is not a measured product blocker

- The supervisor must rerun final integration gates, commit and push the single
  downstream repair unit before Rank 1 can start. Core stays separately pinned
  and unchanged.
- This ranking becomes criterion 6 evidence only when the supervisor records it
  in the Phase 1.6b ledger.
- The accepted recorder lifecycle prose identified in
  `z-recorder-doc-audit.md` remains required authored-document maintenance if it
  has not already been applied. Broader architecture-history cleanup is closeout
  hygiene, not an exit-criterion failure.

## Verification boundary

This ranking is a synthesis of the named final reports. No fresh post-commit
A/B pair was claimed or run. No code, shared working document, generated
artifact, Core file, build, Lab process, commit, or remote was changed; only
this report was written.
