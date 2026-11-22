# S8 read-only gate review
Role: heavy reviewer; model gpt-6.1-sol, effort max (existing p0_permission worker).
Goal: find concrete concurrency, memory-accounting, process-lifecycle, platform or argument-integrity defects before replacing the active gate.
Owned write: fxwork/t984/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/s8-review.md only.
Must not edit: any source, shared working docs, original active gate or git state. No agents, paid calls, browser/panel or heavy commands.
Read: C:/Users/osrs_/MeritClaude/tools/heavy-slot.mjs; tools/heavy-slot/{policy,state,memory,scheduler,run}.mjs; tests/heavy-slot.test.mjs. Current source frozen for review and root tests.
Context: current machine uses fxwork/.heavy-slots/heavy-slot.mjs; old code remains active. New tool must serve strict FIFO with atomic admission, estimate peak need/remaining reservations and system commit headroom, never bypass memory on missing telemetry, and retain a live child's reservation if its launcher dies.
Inspect: lock/reaper races; simultaneous admissions; duplicate labels; memory telemetry/version handling; leases/renew/child exit/cancellation; quoted child arguments on Windows; reservations/history; error cleanup. Identify test gaps, not speculative style changes.
Acceptance: ranked concrete findings with path/line, trigger, consequence and recommended correction; say which cases need empirical checks. Do not claim runtime validation from reading.
Report: short return contract, exact no-test limitation, no source dumps or secrets.
