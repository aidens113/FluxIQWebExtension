# t905 node-input consumption discovery brief

Role: heavy worker, gpt-6.1-sol, Max. DESIGN ONLY, unit C; no implementation.
Goal: specify evidence for the actual per-node parameter/input values consumed after resolution, wiring, defaults and target refresh.
Read codex-t905-execution-seal-design.md and codex-t905-execution-seal.md; accepted normal owner contracts and current frozen engine/frame implementation.
Trace paired Core engine/automation/node-execution/attempt.ts, parameter-refresh/inputs.ts, actual built-in/native dispatch and runtime/native-nodes/native-node-runtime.ts only as needed.
Own report docs/working/mvp-launch-plan/reports/codex-t905-node-use-design.md in paired E checkout.
Must not touch source, shared working documents, generated output, git, t902 private work, or service.ts (t911 ownership).
Root is independently testing unit A; do not mutate its source/dependencies.
Identify every actual consumption boundary and exact dictionary/parameter precedence, including retries, refreshed targets, wire filtering, mutable variables and child calls.
Propose runtime-safe injected contracts and opaque engine-only write capabilities, consistent with A's methodless session handle.
Distinguish frame entry, node invocation and final native consumption; do not imply every field was read or that values stayed unchanged after entry.
Explain how private copies actually reach implementation execution; a sidecar reference or before/after equality is not use evidence.
Active/unverified secret contexts and unsupported values remain unknown; no new hashes, secret storage, redacted-value equality or identity from transient positions.
Name producer/executable/child-occurrence authorities still missing from service unit B, and keep their absence unknown rather than manufacturing proof.
Specify signal/lifetime, late cleanup, partial/failed/waiting attempts and initial-unknown non-upgrade; preserve produced traces and landed acts.
Define whether and when an aggregate could be complete, with all missing coverage explicit; no replay/judge exception or new task ending in this unit.
Return exact owned path table, stable interface proposal and causal regression list, at most40-line implementation brief plus concise rationale.
No tests/browser/provider/builds. Return Outcome / Changed / Validation / Not verified / Report / Notes.
