# S8 process ownership completion
Role: heavy worker, gpt-6.1-sol, max. No subagents or git mutations.
Tree: C:/Users/osrs_/MeritClaude, branch feat/memory-aware-heavy-gate.
Read existing s8-review report and tools/heavy-slot source/tests. Root hands off these paths after current focused test completes.
Owned: tools/heavy-slot/**, tests/heavy-slot.test.mjs, tests/fixtures/heavy-*.
Must not edit package.json, shared AGENTS/CODEX, other tests/tools, active machine gate, P2 source or shared plans.
Resolve review findings: hung telemetry cannot prevent child completion/cancellation; preserve requested signal; own entire launched process tree, including descendants that outlive a short-lived parent before telemetry sees them.
On Windows prefer kernel job-object containment: launch suspended, assign to owned job before resume, keep wrapper/job alive until all members finish, kill-on-close for crash/cancellation. No PID-only guessing or process-name kills. If a platform lacks proven containment, fail closed explicitly.
No arbitrary job timeout/memory cap; telemetry failure retains reservations while lifecycle completion remains reliable. Do not lower admission estimates/thresholds.
Add actual controlled parent/grandchild lifetime and cancellation tests, plus deferred telemetry test; keep FIFO, leases, argv/native exit regressions.
Review existing direct spawn cleanup and npm/npx prefix fixes; preserve them. Current focused27 tests already queued by root; wait root result before edits.
Use existing machine gate for validation, no override. Do not install new gate.
Report in t984 downstream docs/working/data-first-simplification-plan/reports/s8-review.md, distinguish checks from static claims.
P2 runtime remains your next priority after this bounded correction and P1 handoff; notify if implementation needs broader ownership.
Return Outcome/Changed/Validation/Not verified/Report/Notes.
