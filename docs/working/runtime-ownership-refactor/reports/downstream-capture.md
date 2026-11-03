# Downstream Snapshot Capture Test Adaptation

Outcome: Done
Changed: domain/src/runtime/tests/host-runtime{,-groups,-places,-repeat,-reacquire}.test.ts; domain/src/runtime/tests/host/captured.ts.

The root test's local captured helper moved to the shared nested test helper. All five files use it for supported captures, including the existing repeat and identity fixture helpers. It calls the capture method through its boundary receiver, asserts the outcome is a snapshot reference, and returns the exact original object. Reacquire types now use the canonical fluxiq/runtime/automation-host export.

Original group, result, route, privacy, timing, identity, reference reuse, gateway count, and reacquire assertions were preserved. The root test's pre-existing explicit unsupported-node assertions and zero gateway-call checks remain unchanged. Genuine capture failures still have their existing rejects checks.

Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0; Core build current; both source and test TypeScript checks passed.
Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/tests/host-runtime` -> 55 passed, 0 failed, 0 skipped; normal package runner, Core build current.
Not verified: whole suites, structure audit, browser behavior (outside this test-only brief).
Report: docs/working/runtime-ownership-refactor/reports/downstream-capture.md
Notes: No production, Core, config, package, shared-document, or git mutations. No provider calls or panel/browser launches.
SOURCE FROZEN
