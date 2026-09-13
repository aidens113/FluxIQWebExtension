# Report: r-bench-comparison

## Outcome

Done. The final Week 1 comparison is now a tracked extension of `lab compare`,
using validated `BenchReport` / `RunEvaluation` inputs and the existing contract
tolerances. It does not introduce a second report contract.

## Interface and behavior

```text
pnpm lab compare <baseline-report> <candidate-report> [--sequential]
pnpm lab compare <report> --halves
```

The two-report form emits one bounded JSON value containing report ids, the
contract outcome, `comparisonPassed`, every rate on both lanes, p50/p95 latency,
run duration, evidence distributions/count, Week 2 null fields, explicit
absent/unmeasured rows, explicit unstated tolerances, result/run verdict and
category differences, six numbered exit-criterion figures, and per-report
`recording.persistence` discard counts. Shared load is the default label;
`--sequential` changes that label. A metric outside tolerance in either
direction or any differing result/run verdict makes `comparisonPassed` false and
the CLI exits 1. `--halves` retains its narrower contract comparison.
`comparisonPassed` means only that the A/B tolerances and verdicts agree; it is
not overall Week 1 acceptance, and partial/unmeasured criteria remain open.
It fails closed when exactly one side omits a tolerance-bearing measurement.
Metrics structurally without a population in both reports are marked
`not-applicable`; rows for which the plan states no tolerance are disclosures
and do not make criterion 5 partial.
Before computing figures, the command requires `runs.json` to provide the same
result identities/count as `report.json` and exactly `repeatCount` validated
evaluations per result; a partial/tampered runs file fails closed.

Discard inspection reads only failed runs classified `recording.persistence`.
It aggregates discard kinds, maxima, whether entries named a recording or came
after finalization, window exclusions, and unreadable-file counts. It never
returns event messages, event payloads, page data, or recording ids. Duplicate
discard entries repeated in multiple evidence events are counted once.

Criterion 3 counts only Flow-lane W20-W23 drift variants plus Flow-lane
unarmed/contextual W26, excludes recording-lane observations and W26's negative
`no-context` variant, and requires every repeat to pass with zero harness
activations. Criteria that require the final repeat-three benches
are explicitly `partially-measured` when either report has `repeatCount < 3`.

## Files changed

- `packages/test-runner/src/bench/closeout-comparison.ts` — loads both complete
  bundles and composes the durable closeout output.
- `packages/test-runner/src/bench/comparison-details.ts` — renders all stated
  metrics/tolerance gaps, symmetric verdict differences, and six criteria.
- `packages/test-runner/src/bench/persistence-discard-diagnostics.ts` — safe,
  count-only discard reader.
- `packages/test-runner/src/bench/index.ts` — exports the closeout command.
- `packages/test-runner/src/bench/tests/compare-reports.test.ts` — unchanged and
  changed-row fixtures, discard/redaction/dedup proof, criterion-3 countercase,
  and short-repeat status proof.
- `packages/test-runner/src/commands.ts`, `packages/test-runner/src/cli.ts`, and
  `packages/test-runner/src/tests/commands.test.ts` — expose `--sequential`,
  reject invalid combinations, select the closeout path, and set exit status.
- `docs/architecture/testing-facility.md` — documents the durable interface and
  its data boundary.
- This report.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check` — exit 0.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — exit 0.
- `node --test packages/test-runner/dist/bench/tests/compare-reports.test.js packages/test-runner/dist/tests/commands.test.js`
  — 28 passed, 0 failed. The fixtures cover old-equivalent-to-old, a changed
  result/run, persistence counts, withheld secret/page/recording text, duplicate
  evidence, W26-negative exclusion, zero-harness recovery, repeat-1 status, and
  rejection of a skipped/missing evaluation against a complete report,
  recording-lane fallback exclusion, one-sided metric absence, structurally
  N/A rates, and disclosure-only metrics in a complete repeat-three comparison.
- `node packages/test-runner/dist/cli.js compare` — exit 1 with the documented
  usage including `[--sequential]`; no topology, browser, or Lab run started.
- Structure audit with every source rule except `working-docs` — passed with 43
  advisory warnings, 14 baselined. The full audit reached only the concurrently
  stale generated working-document index; the supervisor must regenerate that
  shared index after all reports settle and rerun the full audit.

## Gaps and unverified work

- No real bench or Lab artifact was opened or compared. The real repeat-three
  pair remains a supervisor-owned Stage 4 validation.
- Criterion 2's 16-item evidence assertion and sensitive-input leak assertion,
  and criterion 6's authored blocker ranking, are not fields in `BenchReport`;
  the output marks them partially/not measured instead of inventing proof.
- Evidence-size and p50 latency values have no plan tolerance. They are emitted
  with `no-tolerance-stated` and do not affect `comparisonPassed`.
- No full repository test/build gate or browser test was run; focused package
  validation is green. No commit or push was made.
