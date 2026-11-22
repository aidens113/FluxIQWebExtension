# FluxNode compatibility after automatic processing
Role: existing judge worker; gpt-6.1-sol max; no subagents, git mutations or shared working-doc edits.
Workspace: C:/Users/osrs_/FluxStuff/fxwork/t984/!FluxIQ and paired downstream only; t987 stays frozen for root's P6 checks/build.
Goal: repair the observed FluxNode compatibility failures truthfully, preserving real entry-path repair and all output/privacy/replay assertions.
Read: t984-data-stage.md latest compatibility section and the owned tests; t984 ignored Core node_modules/.cache/t984-acceptance/compatibility-independent.log is exact baseline.
Baseline: FluxNode inventory72 tests:38 failed/34 passed;15 failing files below. Two other FluxNode inventory owners passed.
Owned base: packages/fluxiq/src/framework/automation-service/service/fluxnode/ (all paths below relative).
- tests/managed-hosts.test.ts
- tests/act-scope.test.ts
- tests/pinning.test.ts
- tests/fluxnode-runs.test.ts
- tests/idempotency.test.ts
- tests/secret-inputs.test.ts
- tests/fluxnode-registry.test.ts
- tests/pin-act-scope.test.ts
- tests/secret-invariant.test.ts
- tests/model-routing.test.ts
- tests/repair-routing.test.ts
- pipeline/tests/pipeline-runs.test.ts
- pipeline/tests/pipeline-secrets.test.ts
- pipeline/tests/source-secrets.test.ts
- pipeline/tests/source-continuation.test.ts
Support ownership: tests/library-lane.ts only; add at most explicit opt-in forwarding, never a blanket declaration/default or inferred N/A.
Must not touch: all Answer First compatibility fixtures, attempt/opening.ts, attempt/tests/act-scope.test.ts, P2 result-feed/processing/provenance producers; root coordinates any runtime change.
Generic helper additions must be typed and preserve omitted/unknown declaration cases. Data declarations match actual requested conditions/order/columns and explicit input bindings; action-only tasks declare null.
Do not use process:{} for a task with an actual title/date/filter criterion; do not put secret inputs or values into declarations/defaults/logs.
Actual chat/FluxNode omission must remain repairable until result/budget/explicit Stop, never become a new setup_needed ending. Keep processing.test.ts real omission/three-zero-call replay acceptance intact.
Starting-model policy supersedes historical role ladders: trace model-routing expectations against the approved fixed task model, preserving actual cost/call assertions honestly.
No caps, timeout reduction, retry suppression, oracle weakening or historical recorded-reply edits. Trace real source/readiness failures rather than relabeling all failures as fixture omissions.
Validation: narrow owned tests only after root coordinates the shared-tree freeze; later these15 explicit files plus tests/processing.test.ts. No package-wide check/build/audit until both fixture lanes and root freeze. Root re-verifies.
All heavy jobs use unchanged C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs; one job per lane, strict FIFO, one Vitest worker, source freeze and durable logs. No full suites/paid/browser runs.
Report: your existing t987 report; include exact commands, outcomes, cause/distance, changed fixture assumptions and unverified gaps.
Finish with Outcome / Changed / Validation / Not verified / Report / Notes.
