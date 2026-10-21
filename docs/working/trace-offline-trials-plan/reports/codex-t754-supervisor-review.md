# t754 supervisor verification

## Current state

Source reviewed; final worker launcher smokes and current-dev integration remain before acceptance.

Reviewed manifests and lock changes: exact public Core testing/evidence-build-scope exports; existing DSL export reused;
11 private runner exports; root workspace/link dependencies explicitly resolve their owning packages. Core root's
workspace:0.7.0 selects the framework package despite the root sharing its name. Lock changes add local importers only.
The dependency-free realistic-scenarios source export preserves the prebuild guard. Representative launcher help paths
load public modules before exiting without entering the operation. The arrival regression still proves distinct-copy
identity through a query on the resolved public export. No runtime implementation source was changed.

Independent checks, 2026-10-21:

- From paired Core root: node --input-type=module imports public testing, evidence-build-scope and DSL modules,
  asserting measureAutomationStudioLegacyBaseline, createAutomationStudioScaleCertificationTemplate,
  runWithAutomationStudioEvidenceBuildScope and compileFlowSource are functions -> native0,
  `public Core script exports resolve`.
- From paired downstream root: node --test scripts/lab/live-campaign/tests/selection.test.mjs
  scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs -> native0,8passed/0failed.
  External log: lab-runs/2026-10-21/codex-t754-review/supervisor-guard-owner-tests.log.

Baseline regeneration and final merge gates remain supervisor-owned. No paid run, browser, panel management or
full suite was run for these independent checks. Initial task lifecycle performed a downstream workspace build;
later verification uses owning builds only.

Supervisor inspected final external launcher harness and output: all31 actual subprocesses invoke --help, require native0 and Usage output; provider secrets removed from child environment; public failure describer redaction asserted. Regenerated both baselines with pnpm.cmd structure:baseline, native0. Independently parsed before/after JSON using git show HEAD:.structure-baseline.json and deepEqual after deleting only package-exports: exactly3 Core and35 downstream keys removed; all other baseline content identical. Source checkpoint is ready; current-dev integration and final narrow gates remain before mergeback.
