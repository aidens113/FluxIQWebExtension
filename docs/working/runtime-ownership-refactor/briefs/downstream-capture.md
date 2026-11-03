Role: Standard worker; model gpt-6.1-sol; effort medium.
Goal: Fix downstream test typing for Core's explicit unsupported snapshot outcome without weakening assertions.
Owned: domain/src/runtime/tests/host-runtime{,-groups,-places,-repeat,-reacquire}.test.ts,
new test-only helper domain/src/runtime/tests/host/captured.ts if useful; own report only.
Must not touch production/Core/config/package/shared docs/git; no agents.
Read Down AGENTS boundary/testing/structure rules and paired refactor Current State; inspect listed tests.
Core captureStateSnapshot now returns SnapshotRef | {kind:"unavailable",reason:"unsupported_node"}.
Root production host already returns explicit unavailable for non-page nodes; genuine capture failures still throw.
Root host-runtime.test.ts already has captured() narrowing helper and updated unsupported-node assertions.
Other4 test files fail tsc because known-web captures are read as SnapshotRef without narrowing.
Add truthful runtime assertion/ref-returning shared helper, preserve original snapshot object identity/receiver.
Reuse existing test fixture capture helpers where present; avoid repetitive unsafe casts/non-null shape assertions.
Positive captures must assert actual ref; unsupported-node cases assert exact unavailable+zero gateway calls.
Do not alter any score, route, result, timing, privacy or reacquire assertions.
If sharing helper from nested tests/host, move root local helper to it and update5files; no new flat test file (directory budget).
Use canonical type imports fluxiq/runtime/automation-host. Keep source methods receiver correct.
Run pnpm.cmd --filter @fluxiq-web-extension/domain check and filtered normal domain tests runtime/tests/host-runtime.
No full suites, browser/panel/paidcalls. Report docs/working/runtime-ownership-refactor/reports/downstream-capture.md.
End standard Outcome/Changed/Validation/Not verified/Report/Notes + SOURCE FROZEN.
