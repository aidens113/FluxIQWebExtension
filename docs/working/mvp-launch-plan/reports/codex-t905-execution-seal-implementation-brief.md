# t905 graph-entry input-use implementation brief

Role: heavy worker, gpt-6.1-sol, Max. Implement unit A from codex-t905-execution-seal-design.md only.
Goal: prove the exact initial input dictionary consumed by graph execution through an explicit private session.
Own C=paired Core packages/fluxiq/src/engine/automation: new input-use/**; contracts/graph-execution-options.ts; graph-run.ts; composite/boundary.ts; adjacent tests/input-use.test.ts and composite/tests/boundary.test.ts.
Own E report: docs/working/mvp-launch-plan/reports/codex-t905-execution-seal.md.
Read the approved design and named real consumption paths; accepted owner/store contracts are stable, unchanged.
Do not edit service.ts, input owner/store, run-secret owner, node dispatch, replay/admission, task memory, result/judge, exports, versions, baseline, generated output or other lanes.
Use runtime-safe injected authority and opaque per-run session ports, never a new global/ALS registry or Node storage import.
Preserve effective overlay precedence and all public frame projections. Active ambient secrets yield unknown without normal persistence.
Retain full private child input handoff before projection; isolate the post-overlay dictionary before await and verify authenticated lease copy/currentness.
Only actual working-values initialization mints graph_entry_inputs coverage; execution must consume that prepared copy.
Unsupported/ordinary authority failure preserves execution with unknown; never promote initial unknown at completion.
Seeded resume stays unknown; node/default/wired/refresh use and whole execution are explicitly uncovered.
Child attempts receive distinct controllers with their actual signal/lifetime; never inherit the parent seal by spreading options.
Recheck owner/producer before completed observation; close captures/leases in finally, preserve exact cancellation reason and existing graph cancellation behavior.
No getter/value normalization, redacted-value equality, new hashes, false rollback, new task ending, or judge exemption.
First reproduce the design's causal regressions, then run adjacent tests, affected Core typecheck and unchanged audit through heavy-slot, one job at a time.
No full suite, browser, provider, external writes or git. Freeze source and return exact command/output endpoints.
Return Outcome / Changed / Validation / Not verified / Report / Notes. Lead independently accepts.
