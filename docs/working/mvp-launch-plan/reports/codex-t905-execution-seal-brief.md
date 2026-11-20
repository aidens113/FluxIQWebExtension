# t905 execution-use sealing discovery brief

Role: heavy worker, gpt-6.1-sol, Max. Design only.
Goal: connect an authenticated stored input revision to the exact inputs actually used by graph execution.
Read: codex-t905-input-owner-design.md, codex-t905-input-owner.md, the new owner/store contracts, and the actual engine input assembly/capture call sites.
Own: docs/working/mvp-launch-plan/reports/codex-t905-execution-seal-design.md in the paired extension checkout.
Must not touch: any source, shared working documents, generated output, git, private t902 work, or other lanes.
Trace the effective frame after secret overlay and before child projection; redacted InvocationFrame.inputs is not authority.
Propose runtime-safe injected ports, trusted producer/scope provenance, cancellation and lifetime semantics, and exact causal tests.
Separate stored-binding identity from actual-use evidence. Active/unverified secret context stays unknown; no new task ending or judge exemption.
t911 owns service.ts authority seams. Propose a pure engine/frame unit first; shared service wiring waits until that lane lands.
Acceptance: a concrete path ownership table and stable interface proposal; source inspection is not test validation.
No tests, browser, paid calls, or source implementation in this brief.
Return: Outcome / Changed / Validation / Not verified / Report / Notes.
