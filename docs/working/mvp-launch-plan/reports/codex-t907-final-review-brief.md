Role: critical review worker, gpt-6.1-sol, max. Read-only t907 final dependency integration review.
Roots: C:/Users/osrs_/FluxStuff/fxwork/t907/!FluxIQ and paired !FluxIQWebExtension.
Read downstream codex-t907-lead-acceptance.md and last host-shutdown paragraphs of codex-t907-resume.md only.
Review Core service/fluxnode/{create-fluxnode-service.ts,run-registry.ts,fluxnode-service.ts,run-fluxnode.ts} against current dev using read-only git diff dev.
Focus final t909 target/task/memory admission combined with t907 host close/drain and exactly-once ownership release.
Named adjacent tests: managed-hosts.test.ts, run-registry-shutdown.test.ts, idempotency.test.ts, corrupt-scoped-memory.test.ts, pin-act-scope.test.ts.
Lead independently passed all 31 cases across those plus act-scope, and Core typecheck; structure audit finishing. Do not launch duplicate checks.
Find concrete regressions, races, missing cleanup or changed refusal semantics. Preserve result-or-budget rule; note pre-existing behavior separately.
No edits to source/shared docs, no git mutation, no build/test/browser/paid calls, no other lane reads, no subagents.
Write only downstream docs/working/mvp-launch-plan/reports/codex-t907-final-review.md.
Return concise findings with exact file/line evidence, severity, minimum regression needed; otherwise state inspected boundary and limits.
Return Outcome/Changed/Validation/Not verified/Report/Notes. A clean review does not claim production model custody.
Lead read-only expansion: adjacent result-of.ts, hosts host-pool owner and owner-flows.ts for precise error-finalization/runtime-edge review; distinguish existing swallowed cleanup reporting from newly claimed successful close.
