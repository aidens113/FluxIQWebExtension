# Repository Audit Remediation Briefs

These briefs implement the three pre-Stage-4 findings recorded in the parent
working document. Workers do not commit, push, or edit shared working documents.

## r-wait-and-cleanup

- Repository: `F:\!FluxIQWebExtension`
- Task: implement `f-lab-wait-bounds` and preserve the first scenario failure
  when later browser/topology/clone cleanup also fails.
- Required reads: parent Current State; `reports/audit-downstream.md`;
  `mvp-week1-web-automation-reliability-plan/briefs/finish-week1.md` at
  `f-lab-wait-bounds`; named source and colocated tests.
- Owns: `packages/test-runner/src/run-scenario.ts`;
  `packages/test-runner/src/flow-lane/finalized-recording.ts` and its test; the
  focused modules and tests under `packages/test-runner/src/run-lifecycle/`;
  necessary colocated runner tests;
  `reports/r-wait-and-cleanup.md`.
- Must not touch: bench tooling; shared working documents; Core; generated or
  Lab runtime data.
- Requirements: 90-second finalize bound with measured rationale; safe wait
  details on persistence errors; pairing timeout includes sanitized last status
  and pre/post approval stage; cleanup is primary only absent an earlier error.
- Validation: focused tests, mutation proofs for each guard, test-runner check,
  and structure audit. Restore every mutation byte-identically.
- Report: exact files, behavior, commands/results, mutations, and unverified work.

## r-bench-comparison

- Repository: `F:\!FluxIQWebExtension`
- Task: promote the final Week 1 comparison procedure into cohesive tracked CLI
  tooling using existing bench contracts instead of a parallel report model.
- Required reads: parent Current State; `reports/audit-integration.md`; Week 1
  Metrics and proof rules; existing `src/bench/` implementation/tests; the old
  `reports/i-bench-compare-prep.md` for behavior, not authority.
- Owns: `packages/test-runner/src/bench/**` except files touched by the other
  worker; CLI/command files strictly needed to expose the tool; colocated tests;
  `docs/architecture/testing-facility.md`; `reports/r-bench-comparison.md`.
- Must not touch: runner wait/cleanup files; shared working documents; Core;
  Lab runs or recorded data.
- Requirements: render every stated metric/tolerance, differing row verdicts,
  six exit-criterion figures, and persistence discard diagnostics; explicitly
  report absent metrics/tolerances; output identifiers/counts/rates only.
- Validation: old-equals-old and changed-row fixtures, focused tests,
  test-runner check, CLI help/usage probe, and structure audit.
- Report: exact interface, files, commands/results, gaps, and unverified work.

## r-week1-doc-truth

- Repositories: both, read-only except its report in the downstream repository.
- Task: prepare exact, compact replacements for stale Current State claims and
  the post-remediation ledger entries Claude will need to resume the campaign.
- Required reads: parent Current State; both Week 1 Current States; both audit
  reports; remediation brief; current Git heads/status.
- Owns: `reports/r-week1-doc-truth.md` only.
- Must not touch: either Week 1 plan, source, generated data, or Core files.
- Requirements: distinguish implemented, supervisor-verified, and still-live-
  unverified states; retain Stage 4 order and faulty-RAM validation rules; give
  exact replacement prose for both repositories without claiming future gates.
- Validation: cross-check each proposed claim against source, Git, or a named
  report and list that evidence.
- Report: paste-ready paired edits plus remaining inconsistencies and unknowns.

## r-integration-review

- Repository: `F:\!FluxIQWebExtension`
- Task: adversarially review the integrated runner-wait, cleanup-precedence, and
  closeout-comparison changes for correctness, security, test gaps, and contract
  drift before supervisor acceptance.
- Required reads: parent Current State; the two implementation reports; only
  changed source/tests/docs shown by `git diff`; existing contracts those files
  directly import when needed.
- Owns: `reports/r-integration-review.md` only.
- Must not touch: source, tests, shared documents, Core, generated/runtime data.
- Requirements: prioritize concrete defects; check first-failure semantics,
  redaction boundaries, symmetric comparison, criterion populations, exit-code
  behavior, path containment, and whether tests would fail on the old behavior.
- Validation: read-only focused commands are allowed, but avoid heavy gates while
  the supervisor is integrating; cite file/line evidence.
- Report: findings by severity, then verified invariants and unverified risks.
