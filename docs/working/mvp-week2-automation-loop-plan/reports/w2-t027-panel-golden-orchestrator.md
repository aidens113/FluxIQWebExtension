# T027 Panel Golden Path Orchestrator

Status: implementation complete; narrow type check passed; live validation not run
Date: 2026-09-20
Worker: `w2-t027-panel-golden-orchestrator`
Candidate: paired t027 worktree

## Result

Added `pnpm panel:golden`, a thin launcher over a new test-runner orchestrator.
The orchestrator reuses the production UI drivers and their existing
`BrowserEvidenceRecorder` bundles. It does not create another browser driver,
artifact format, Core contract, or extension implementation.

The lane performs these operations in order:

1. typed instruction and provider-backed creation proposal;
2. bound UI review, approval, and apply;
3. bound deterministic panel run and registered scenario oracle;
4. target drift, failed adapting run, and exact repair proposal;
5. UI repair review/apply and provider-free validation;
6. a second provider-free validation in a newly owned Core/browser invocation;
7. the independent extension recording, generated Subflow, and panel replay.

Creation writes the existing request binding. The orchestrator loads that
binding and requires every creation/run/repair/reuse result to retain its exact
`projectId` and `flowId`. It separately requires the creation adaptation and
repair adaptation identities to remain unchanged across their respective
boundaries. Recording/replay has its own explicit identity check because that
path intentionally creates a separate deterministic Flow.

## Visible-stage contract

All twelve requested stages are represented in one closed stage ledger. Seven
are currently asserted by the composed production drivers:

- instruction entry;
- creation proposal review;
- creation approval;
- creation application;
- normal run plus scenario oracle;
- repaired provider-free rerun;
- restart and saved reuse of the exact repaired Flow.

Five remain `unverified`; the command returns `incomplete` and exits with code
2 rather than claiming full UI coverage:

- ordered exploration progress presentation;
- normal run row and Action Log identity;
- failed-attempt and terminal-reason presentation before repair;
- human-readable structural repair diff (review/apply itself is driven);
- separate review-before-apply for recording generation (recording and replay
  themselves are driven).

These are the same product/driver gaps found by the preceding panel audit. The
orchestrator makes them machine-visible while preserving all successful run
IDs and identities in content-free launcher output.

## Files

- `packages/test-runner/src/panel-golden-path/assertions.ts`
- `packages/test-runner/src/panel-golden-path/lane.ts`
- `packages/test-runner/src/panel-golden-path/index.ts`
- `scripts/run-panel-golden-path.mjs`
- `packages/test-runner/src/index.ts`
- root `package.json`

## Validation

Passed:

```text
pnpm --filter @fluxiq-web-extension/test-runner check
```

No live browser, provider, unit, package-wide, or repository-wide suite was
run, as required by the brief. The next isolated live lane should invoke
`pnpm panel:golden` with the private workspace configuration described in
`w2-panel-golden-path.md`, inspect every underlying browser evidence bundle,
and treat exit code 2 as incomplete UI acceptance until all five presentation
gaps are implemented and observed.

