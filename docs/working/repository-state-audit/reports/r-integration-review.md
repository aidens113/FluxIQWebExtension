# Report: r-integration-review

## Outcome

The integrated remediation is directionally sound. The first review found five
acceptance defects: pairing-detail publication, three comparison defects, and
clone post-run failure precedence. The supervisor fixed all five during review,
and this worker re-reviewed their final source and counter-tests. No unresolved
acceptance defect remains in the inspected scope.
No source, test, shared document, Core file, Lab artifact, commit, or remote was
changed by this worker.

## Resolved during review

### Resolved — criterion 3 credited the recording lane for W26 context recovery

The first inspected `packages/test-runner/src/bench/comparison-details.ts`
selected unarmed W26 without restricting its lane, then aggregated that
population into one `fallbackRecoveredWithoutHarness` figure. The Week 1 corpus
explicitly runs unarmed W26 on both recording and Flow lanes, while
`packages/test-runner/src/bench/corpus/week1.ts:17-20` says only the Flow lane
executes the workflow. A passing recording-lane fixture/probe can therefore
inflate the figure that claims W26 resolved ambiguity by context. The first
test constructed only Flow-lane W26 and could not detect this error.

Correction applied: criterion 3 now requires `result.lane === "flow"`. The
counter-test includes a recording-lane drift result and proves it cannot enter
the shared Flow-only W20-W23/W26 population.

### Resolved — criterion 5 could not become measured

The first inspected comparison combined truly absent `not-compared` rows with
deliberately ungated `no-tolerance-stated` rows, then marked criterion 5 partial
whenever that combined count was nonzero.
`comparisonMetricRows` always emits no-tolerance evidence, p50, and reserved
Week 2 rows, so even two complete repeat-three Week 1 reports can never render
criterion 5 as `measured`. This contradicts the plan's exit criterion at
`docs/working/mvp-week1-web-automation-reliability-plan.md:172`.

Correction applied: `not-applicable`, `not-compared`, and
`no-tolerance-stated` are distinct. Only `not-compared` blocks measured status;
a repeat-three test proves N/A and disclosure rows remain visible without
blocking the criterion.

### Resolved — an absent comparable metric could still exit zero

The first inspected closeout comparison computed `comparisonPassed` by
rejecting only `improved`/`regressed` rows and verdict differences. A candidate
could omit an action-latency type present in the baseline; that row became
`not-compared`, but the CLI could still exit 0. Matching run verdicts/categories
do not prove that FluxIQ executed the same action set.

Correction applied: `comparisonPassed` now rejects `not-compared`, while a
metric null on both sides is explicitly N/A. A fixture with equal verdicts and
one missing action-latency metric now asserts a failed comparison.

### Resolved — pairing timeout diagnostics now reach run evidence

The first inspected version kept stage and sanitized last status only on the
thrown `RunnerFailure`; `run-scenario` discarded those details. The supervisor
added `pairingStatusWaitFailureDetails` in
`packages/test-runner/src/pairing-status-wait.ts`, restricted it to the exact
closed five-field status projection, wired it into the run error event at
`run-scenario.ts:379-382`, and added helper and wiring assertions. Re-review
found no raw reference code, session id, error, URL, or page/activity field in
the selected output.

### Resolved — clone post-run verification replaced an earlier failure

The first inspected source still assigned clone source post-run verification's
category and message unconditionally inside `finally`. The supervisor extended
the shared precedence rule with a `clone-source-verification` stage and optional
classified category. `run-scenario.ts:401-406` now preserves an existing
complete primary, appends a separately labelled event, and retains
`classifyRunnerFailure(error)` only when verification is the first failure. The
helper test covers all four completion stages and the first-failure category;
its initially over-specific summary regex was also corrected during review.
The discard-audit precedence later in `finally` remains separately documented
and intentionally superseding.

## Verified invariants

- `cleanupFailureOutcome` preserves an existing category and message and emits
  a separately labelled event under the completion failure's actual category.
  Browser, topology, clone-source-verification, and clone-destination paths all
  use it; cleanup defaults to `process.startup`.
- Finalization waits default to 90 seconds, require two stable finished reads,
  and expose only the named id/boolean/count/time projection.
- Pairing diagnostics distinguish pre-approval and post-approval and expose
  presence booleans rather than the pairing reference or session id.
- Verdict differences traverse both directions, so candidate-only and
  baseline-only lane-aware results/runs are represented.
- Persistence-discard output is count-only and does not copy event messages,
  payloads, page data, recording ids, or run ids. Run ids are filename-checked
  and lexically contained below the configured runs directory.
- The supervisor-added complete-bundle check rejects unequal result-group
  counts and groups missing the report's repeat count before computing figures.
- The focused tests and mutation results in the two implementation reports are
  credible evidence against the original 30-second bound, dropped finalization
  projection, pairing-presence loss, and cleanup-primary overwrite. The new
  comparison counter-tests cover the three comparison findings above.
- `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json
  --noEmit` passed after the final inspected fixes.

## Unverified risks

- No live browser pairing timeout, cleanup failure, finalization timeout, or
  clone verification failure was injected in this review.
- No real bench bundle was opened. Criterion populations and comparison behavior
  were reviewed from contracts, corpus declarations, source, and synthetic tests.
- Lexical path containment does not defend against a run-directory symlink that
  escapes the runs root. The current reader emits only validated counts, so this
  is a hardening risk rather than evidence of a present secret leak.
- The report/bundle consistency guard checks identities and repeat counts, but
  does not recompute report pass rates, flake classes, or aggregate metrics from
  the loaded evaluations. A manually inconsistent but individually valid bundle
  can therefore produce mixed report/evaluation truths.
- Heavy gates were intentionally left to the supervisor during integration.
