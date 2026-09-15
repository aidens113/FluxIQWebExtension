# `bb-facility-campaign-persistence` — durable diagnostic integration

## Outcome

Integrated `RunEvaluation.facilityFailure` through both bench execution paths,
finalized-bundle reconciliation, checkpoint resume, mutable projections, terminal
summaries, and Markdown. A synthetic no-final-bundle failure no longer copies
its raw thrown message into the campaign directory; the immutable evaluation's
closed diagnostic is now the durable source.

## Changed

- `bench/run-bench.ts`:
  - resumable and legacy outer catches preserve an existing
    `ProjectedFacilityError` diagnostic or project an unwrapped injected error
    once as `no-final-bundle / bench.persist`;
  - neither catch persists `describeError(error)` as a synthetic cause/problem;
  - finalized reconstruction passes `source.facilityFailure` through the lane
    evaluator instead of dropping it;
  - ordinary finalized evaluation reads take the diagnostic from the bundle's
    immutable evaluation;
  - both record constructors copy the evaluation diagnostic into `runs.json`;
  - bundle-less completed cells require an inconclusive evaluation whose
    diagnostic boundary is `no-final-bundle`.
- `bench/report-store.ts`: evaluated records can carry the nullable typed
  diagnostic; skipped records continue to omit it.
- `bench/failure-cause.ts` and `bench/render-markdown.ts`: aggregation and display
  prefer a deterministic string made only from boundary, stage, reason, and
  present closed optional fields. The per-run table exposes the same typed fact.
  Existing redacted finalized-bundle event summaries remain troubleshooting
  text but cannot override the immutable diagnostic.
- `bench/campaign/identity.ts`: bench semantics advanced from 0.2 to 0.3, so a
  paused earlier campaign cannot mix old and new evaluation semantics. Campaign,
  checkpoint, and receipt schemas did not change; the checkpoint's evaluation
  digest already authenticates the field.
- Bench test fixtures now write evaluation schema 0.2 and explicit null
  diagnostics.

## New proofs

- A projected synthetic module failure is persisted, then execution is crashed
  immediately after its completion checkpoint. Resume executes the scenario
  exactly once, preserves the same immutable diagnostic in `evaluation.json`,
  `runs.json`, terminal causes, and Markdown, and remains idempotent on a second
  resume.
- That test places a unique sentinel in the raw error message, path, and
  credential-shaped data, then recursively scans every file inside the campaign
  directory as bytes. The sentinel is absent.
- A finalized readiness diagnostic survives a crash after bundle publication,
  reconciliation, reconstructed evaluation publication, and `runs.json`; the
  finalized scenario is not rerun.
- A hash-consistent schema-0.1 bundle-less synthetic evaluation normalizes to a
  null diagnostic and is rejected on resume rather than accepted as completed.
- Campaign semantics are pinned at 0.3.

## Validation

- Focused strict TypeScript check over all Partition C production files and
  owning bench tests: exit 0.
- Focused bench tests: 52/52 passed, including all five existing persistence
  crash boundaries plus the new synthetic and finalized diagnostic cases.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0 after the
  supervisor integrated the sole unrelated schema fixture.
- `pnpm structure:check`: passed with existing/baselined advisory warnings.
- `git diff --check` over Partition C: exit 0.

No contract, scenario/projector, Core, extension, or A/B campaign file was
changed. No Lab/full corpus run, commit, or push was performed.
