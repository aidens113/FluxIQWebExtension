# Report: audit-downstream

## Outcome

Done. The focused downstream audit confirmed three defects already adjacent to
`f-lab-wait-bounds`, found one additional failure-precedence defect that can
misclassify Week 1 bench runs, and found one lower-priority misleading timeout
diagnostic. No source or runtime state was changed and no Lab run was started.

### Prioritized findings

1. **High — the intended concurrent Stage 4 benches still carry the 30-second
   recording-finalization bound already proven too short under the same load.**
   `packages/test-runner/src/flow-lane/finalized-recording.ts:71` still defines
   `DEFAULT_TIMEOUT_MS = 30_000`; both the runner's first round-trip wait
   (`packages/test-runner/src/run-scenario.ts:592-594`) and the Flow lane's
   second exact-recording wait (`packages/test-runner/src/flow-lane/run-flow-lane.ts:98-105`)
   use that default. The directly required evidence,
   `reports/i-stage3-load-failures.md`, records five W10 failures at this bound
   while two benches overlapped and a passing overlapping W10 finalization at
   25,789 ms. This is a confirmed Stage 4 blocker, not an unverified risk. The
   queued 90,000 ms change is the narrow fix justified by the measured latency.

2. **High diagnostic gap — a finalization timeout constructs the necessary
   evidence but the run bundle drops it.** `finalized-recording.ts:121-131`
   attaches the recording id, seen/finalized state, last entry count, elapsed
   time, polls, and bound to its `RunnerFailure`. The catch in
   `packages/test-runner/src/run-scenario.ts:371-385` publishes
   `failureDetails` only when the category is `recording.contract`
   (`:377`), so `recording.persistence` loses those details. This is confirmed
   by code and by all five W10 timeout bundles summarized in
   `i-stage3-load-failures.md`. A repair should publish this wait's safe shape,
   not blindly publish every `recording.persistence` detail: that category is
   also used for recording-start diagnostics at `run-scenario.ts:277-282` and
   several other paths.

3. **High diagnostic gap — the 15-second pairing timeout records neither the
   last extension status nor which of the two pairing polls expired.**
   `pairExtension` calls the same generic poll before approval and after
   approval (`run-scenario.ts:512-517`), while `pollStatus` throws a fixed
   message with no details (`:603`). Thus the W13 load failure cannot distinguish
   waiting for a reference code from waiting for the approved session, nor show
   the last safe state the extension reported. This is confirmed by source and
   by `i-stage3-load-failures.md`; keeping the 15-second bound while adding a
   caller-supplied stage plus a deliberately sanitized status is appropriate.

4. **Medium, additional defect — browser or topology cleanup can overwrite the
   real run failure and corrupt failure-classification results.** After the main
   catch has stored the functional failure (`run-scenario.ts:371-385`), browser
   cleanup unconditionally replaces `failureCategory`/`failureMessage` with
   `process.startup` (`:404-405`), and topology cleanup does the same
   (`:429-430`). The later matching error event is then added (`:431-433`) and
   the replaced category is returned (`:498`). The clone cleanup has the same
   overwrite at `:450-460`, though clone is outside the Week 1 bench target.
   Therefore an expected negative such as W19 or W25 can be scored as a rig
   failure if teardown also fails. `ProcessSupervisor.cleanup` can genuinely
   throw when a child remains active or tree termination fails
   (`packages/test-runner/src/process-supervisor.ts:76-90`), particularly
   relevant to loaded Windows benches. No test under `packages/test-runner/src`
   asserts preservation of a scenario failure across browser/topology cleanup;
   the analogous demo defect was repaired and tested separately in
   `demo-workspace/core-process.ts`. Preserve the primary failure and append a
   labelled cleanup failure; use cleanup as primary only when the run had no
   earlier failure.

5. **Low — a timeout can falsely claim the finalized timeline kept growing.**
   When the first observation carrying `endedAt` arrives at or beyond the
   deadline, `awaitFinalizedRecording` stores it, immediately breaks, and has no
   confirming read (`finalized-recording.ts:102-120`). `timeoutMessage` then
   always says the timeline "kept growing" merely because `endedAt` exists
   (`:135-138`). The stopped bench's W10 recording run had this exact likely
   shape, as `i-stage3-load-failures.md` explains. This does not hand on a short
   recording, but it sends diagnosis toward a Core immutability violation when
   the actual event may only be a bound hit. The test at
   `flow-lane/tests/finalized-recording.test.ts:58-79` covers unfinished and
   unseen timeouts, not first-finalized-at-deadline.

The structure audit also reports advisory modularity pressure (not correctness
failures), notably `run-scenario.ts` at 697 lines and the 28-method
`ExistingFluxIQControlClient`. These should not delay Stage 4.

## What changed and why

- Added only this report, the file assigned by the worker brief.
- No source, tests, generated outputs, Core files, Lab worktrees, run artifacts,
  or runtime state were changed.

## Commands run and observed results

- `pnpm exec tsc -p packages/test-runner/tsconfig.json --noEmit` — exit 0.
- `node --test packages/test-runner/dist/flow-lane/tests/finalized-recording.test.js packages/test-runner/dist/bench/tests/compare-reports.test.js packages/test-runner/dist/run-evaluation/tests/runner-wiring.test.js`
  — exit 0; 17 tests passed, 0 failed. These were the existing built tests; no
  build was run.
- `pnpm structure:audit` — exit 1 because no such script exists; the correct
  repository script is `structure:check`.
- First `pnpm structure:check` — exit 1 only because the newly created shared
  audit document lacked the required blank line after its H1. The supervisor
  corrected that file; this worker did not edit it.
- Corrected `pnpm structure:check` rerun — the header violation was gone, but
  exit 1 because `docs/working/README.md` was temporarily out of date with the
  new document's header blocks while the supervisor's shared audit-document
  work was still in progress. All product-code findings were advisories, not
  violations.
- Final `pnpm structure:check`, after the supervisor regenerated the shared
  index — exit 0; 42 advisories and 17 baselined findings, with no violation.
- Read-only searches and numbered source reads used `rg`, `Get-Content`,
  `git log`, `git diff`, and `git status`. No secret, recorded-page, browser
  profile, or `.fluxiq` content was opened or printed.

## Not verified

- No Testing Lab, browser, fixture, full root gate, full package test suite,
  mutation proof, build, demo, or live concurrent bench was run.
- The audit was focused on the Week 1 runner, benchmark, evidence/leak paths,
  and recent relevant changes. It was not an exhaustive line-by-line audit of
  every extension UI, content-script, domain, demo, or testing-facility module.
- The 90-second bound and new diagnostic behavior do not exist yet, so their
  proposed tests and mutation proofs could not be verified.
- The additional cleanup-precedence finding is proven by control flow but was
  not reproduced with a live cleanup failure or a new fault-injection test.

## Open questions or contradictions found

- The Week 1 Current State says stopped `f-lab-wait-bounds` left partial
  uncommitted edits, but the source remains at the old behavior and intake
  reported a clean tree. Treat the partial-edits statement as stale.
- Decide whether cleanup-failure precedence must be fixed before Stage 4. It is
  independent of the wait-bounds files, but a teardown failure can invalidate a
  negative row's classification, so fixing and fault-injection testing it before
  the final benches is the safer sequencing.
- `f-lab-wait-bounds` should identify the finalization-wait failure by a narrow
  diagnostic shape or explicit marker. Publishing every failure solely because
  its category is `recording.persistence` broadens the evidence surface beyond
  the stated task.
