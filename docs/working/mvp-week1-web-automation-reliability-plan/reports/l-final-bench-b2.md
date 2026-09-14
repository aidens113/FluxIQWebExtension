# Report: l-final-bench-b2

Worker report, 2026-09-13. This is the independent final2 Bench B campaign.
Only bounded identifiers, counts, categories, sizes, and timings are reported;
raw logs, screenshots, page data, and secret values remain in the owned run root.

## Setup

- Downstream worktree `F:\fxlab\fxlab-16ff729-b`: detached and clean at pushed
  `54e30bc127f76041269d3707817c2e78d369c6b2`; `origin/dev` equals it.
- Shared Core worktree `F:\fxlab\!FluxIQ`: clean at pushed
  `19468b72c4472fd5cc58940737702d5e4d72c985`; `origin/dev` equals it.
- As the single Core build owner, built `@fluxiq/contracts`, `fluxiq`, and
  `@fluxiq/client-gateway-websocket` serially, all exit 0. Core is read-only
  after that build.
- Built B's `domain`, `test-contracts`, and `scenario-lab` packages serially,
  all exit 0.
- Package resolution from domain, extension, test-runner, and test-contracts
  reached the pinned Core worktree's package `dist` trees; `unpinned=0`.
- New B root `F:\fxlab-runs\final2\b` was absent at reservation time.
- Before coordinated launch: other Lab instances 0 and free memory 12.26 GB.

## Current status

Bench B launched at `2026-09-13T23:38:26.806Z` with wrapper child PID 13792,
pre-launch free memory 12.31 GB, and exact command `pnpm lab bench --corpus
week1 --repeat 3 --target isolated`. The wrapper holds an exclusive lock,
samples memory every 15 seconds, checks each finalized bundle for leaks every
5 seconds, and supplies the auth-gate value only through the child process
environment. The value is never printed or persisted. The immediate
post-launch machine count was two Lab instances, confirming concurrent A/B
execution; point-in-time free memory was 9.28 GB.

First milestone: 4 executable results finalized and passed, alongside the 12
planned W04/W08 Flow absences. W02 Flow repeat 1 passed. Leak and persistence
failure counts were 0, harness activations 0, and minimum free memory 6.02 GB.
Three logical `recording.event_discarded` observations had appeared (0 actions,
1 event, 8–15 ms after finalization); each appeared in both discard reads and
was unioned by entry id. No blocker was present.

At 48 executable finalizations, 43 passed and 5 failed. The failure set was
three concurrent-load pairing timeouts (W09 Flow, W10 primary Flow, and W14
recording, all repeat index 0) plus the ruled W05 short-catalog and W13
banner-absent observations. There were 9 unique evidence-only
post-finalization discards, zero action-bearing discards, zero persistence
failures, zero harness activations, and no leak. The timing-only observations
were retained for later isolated rerun after both paired labs clear.

At 90 executable finalizations, 82 passed and 8 failed. Repeat index 0's
executable block was complete and repeat index 1 was in progress. The bounded
failure set comprised four ruled-row observations and four pairing-only
timing observations; no new failure occurred at the milestone. Leak remained
false, action-bearing discards and harness activations remained zero, minimum
free memory was 5.11 GB, and there was no blocker.

At 95 executable finalizations, W13 banner-absent Flow repeat index 1 added
the ninth failure. This was the fifth ruled-row observation rather than a new
failure class; the other four failures remained the queued timing-only
pairing observations. Aggregate was 86 passed and 9 failed, leak remained
false, minimum free memory remained 5.11 GB, and the campaign continued.

At 121 executable finalizations, 111 passed and 10 failed. The failure set
remained six ruled-row observations plus four timing-only pairing
observations; no new non-ruled issue appeared. Leak, persistence failure,
harness activation, and action-bearing discard counts remained zero. Minimum
free memory was 5.11 GB and there was no blocker.

At 145 executable finalizations, 134 passed and 11 failed. Since the prior
milestone only ruled W05 short-catalog Flow repeat index 2 was added, leaving
seven ruled-row observations plus four timing-only pairing observations and
no new non-ruled issue. Leak, persistence failure, harness activation, and
action-bearing discard counts remained zero. Minimum free memory was 4.91 GB
and there was no blocker.

## Final status: incomplete process termination

The bench process tree disappeared before the campaign completed and before
the wrapper could write `wrapper-outcome.json`. No exit code or normal bench
completion marker is available. The last finalized bundle was W13
banner-absent Flow at repeat index 2. An empty staging directory for the next
run remained, consistent with W14 recording repeat index 2 having been
reserved but not started. No launch or rerun was attempted after discovery.

- Planned accounting: 201 row results = 189 executable evaluations plus 12
  planned W04/W08 Flow absences.
- Preserved accounting: 167 row results = 155 finalized executable
  evaluations plus all 12 planned absences. The remaining 34 executable
  evaluations were not finalized.
- Finalized verdicts: 143 passed and 12 failed (92.26% raw).
- Recording lane: 59 finalized, 57 passed, 2 failed (96.61% raw).
- Flow lane: 96 finalized, 86 passed, 10 failed (89.58% raw).

The 12 failures divide into eight ruled-row observations and four
concurrent-load pairing-only observations:

- Ruled rows: W05 short-catalog repeats 0/1/2, W13 banner-absent repeats
  0/1/2, and W24 unannounced repeats 0/1. The third W24 observation was among
  the 34 evaluations not reached.
- Timing-only queue retained for later isolated rerun: W09 Flow repeat 0
  (`run-mu0h2wqy-d3df58af`), W10 primary Flow repeat 0
  (`run-mu0h5988-fde79b62`), W14 recording repeat 0
  (`run-mu0hi94h-e3f48158`), and W28 recording repeat 0
  (`run-mu0ionkx-33f5b10f`). Each failed before usable lane evidence because
  the extension pairing-state wait timed out under paired-lab load.

## Bounded count and evidence audit

- All 155 finalized rows had `harnessActivations=0`; the 94 finalized Flow
  rows that produced a Flow snapshot also had start candidate index 0.
- Candidate counts across those 94 Flow snapshots were: 1 candidate in 16,
  2 in 23, 3 in 30, 4 in 11, 5 in 8, 7 in 1, 8 in 2, and 9 in 3. Two Flow
  evaluations stopped at the pairing wait and produced no Flow snapshot.
- Flow snapshot statuses were 67 succeeded and 27 failed. The latter includes
  expected/ruled negative behavior and is distinct from the top-level bench
  verdict. Flow creation was true in 94/96 finalized Flow evaluations.
- Flow oracle verdicts were 91 passed, 3 failed, and 2 absent; Flow reported
  verdicts were 67 passed, 27 failed, and 2 absent. Recording oracle verdicts
  were 57 passed and 2 absent; recording reported verdicts were 13 passed and
  46 absent.
- Executed/recorded action counts were 259 in Flow and 26 in recording. Flow
  action kinds: navigate 2, tab 6, check 9, click 116, keypress 18, scroll 30,
  select 6, type 47, upload 2, and wait-for-selector 23. Recording action
  kinds: navigate 13 and type 13.
- Flow evidence contained 518 sanitized packets totaling 2,101,654 bytes;
  packet sizes were 528-5,992 bytes. Truncation count totaled 163 across 27
  packets. All 94 evidence-packet-budget invariants passed. Recording carried
  no sanitized packets under this lane contract. Raw-snapshot byte count in
  evaluation evidence was zero for both lanes.
- Persistence failures were 0. The finalized event summaries contained 44
  discard reads representing 22 unique entries: all were
  `recording.event_discarded`, each discarded 0 actions and 1 event, 7-27 ms
  after finalization. Thus action-bearing and unexplained discard counts were
  both 0.
- Redaction attestations existed for all 155 finalized bundles: 149 were
  not-applicable and 6 passed. They covered 6 configured literals and reported
  0 findings. The wrapper leak watcher remained false through its last status
  update; no leak finding was observed.
- Minimum sampled free memory was 4.91 GB, above the 3 GB start/pause guard.

## Cleanup and verification

- Exact owned process-tree count is 0; therefore owned listener count is 0.
- The stale empty wrapper lock was removed after the owned process check.
- The partial run root, 155 complete bundles, empty staging directory, and
  work directory were preserved. Nothing was deleted from the evidence root.
- Downstream remains clean at
  `54e30bc127f76041269d3707817c2e78d369c6b2`; Core remains clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.

## Blocker and unverified items

This campaign is **incomplete**. Its terminal blocker is unexplained process
termination without a wrapper outcome or exit code. The remaining 34
executable evaluations, complete-repeat acceptance, and the four prescribed
isolated timing reruns are unverified. The 155 finalized bundles remain valid
bounded observations, but they do not establish full Stage 4m bench
acceptance.
