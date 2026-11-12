Role: heavy worker, gpt-6.1-sol, max. t907 shutdown cleanup failure propagation.
Read your final-review finding and current named host lifecycle files; no broad discovery.
Own Core fluxnode/create-fluxnode-service.ts, run-registry.ts, existing tests/managed-hosts.test.ts and tests/run-registry-shutdown.test.ts if needed; own downstream codex-t907-final-review.md report.
Goal: service.close must reject with actual owner cleanup failures after draining every admitted controller/leaf, rather than reporting success while an owner remains.
First extend the existing simultaneous attempt/owner-release failure regression to reproduce close resolving incorrectly.
Preserve original attempt/fallback result and events; do not create an unended run or change an achieved/stopped task into a fabricated failure because close now reports cleanup errors.
Preserve exactly-once release, host release, late-admission Stop, target/task binding and strict-memory checks. Drain all work even if one cleanup fails.
Use registry-owned finalization error tracking or another cohesive existing owner seam; do not mask errors, retry/cap cleanup, or add process-local execution identity.
Tests must cover repeated close sharing the same rejection, no duplicate cleanup, successful unrelated runs draining and original result remaining inspectable.
Run focused red then green via heavy-slot, one lane reader; after green run Core typecheck and structure audit. No full sweep.
Source freezes during readers. No other source/docs, git mutation, browser/paid run/panel, other lanes or subagents.
Lead will independently rerun acceptance, sync dev and integrate; t902 must remain untouched and off GitHub.
Return Outcome/Changed/Validation/Not verified/Report/Notes and distinguish this fixed close gap from pre-existing task-result behavior.
Lead expansion: same create-service and managed-hosts test paths must validate every resolved reachable leaf runtime against managed pool domain before parent/child admission, including nested pipelines and missing runtime. Reuse t909 frozen target manifest; reject invalid_request without host or execution-owner acquisition. Add red regression first. No new admitted-task ending.
