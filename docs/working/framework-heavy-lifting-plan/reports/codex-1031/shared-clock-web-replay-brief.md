Role: standard worker; gpt-6.1-sol, medium.
Goal: finish t823 metadata edge from replay binding calls to actual browser tool dispatch.
Root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQWebExtension.
Read your prior implementation report plus Core llm/harness-options/{binding,registry,option}.ts referenceNow additions.
Owned additional paths: domain/src/runtime/llm-evidence/harness-options/**, llm-evidence/node-run/**, and actual executeTool caller owner required for reference metadata (name it in report); owning tests. Do not edit Core or shared docs.
Core fresh replay now supplies call.referenceNow?:number through executeTool metadata; cached replay retains original. Propagate this optional epoch value to actual browser action/extraction using the same referenceNow seam, not model input. Preserve explicit extractList.now.
Also source review identified current helper injection is guarded by request.where. Ensure sort-only relative date ordering receives run reference when required, while preserving backwards compatibility for ordinary reads. Apply the same valid epoch max8.64e15 rule as Core.
Add focused tests proving binding metadata reaches extract-list effects/node-run, explicit request now wins, legacy absent metadata works. No domain builds/types until Core rebuilt; no full suites/provider/browser/panel calls.
Report append to MAIN downstream reports/codex-1031/shared-clock-web-implementation.md, with changed paths and unverified edges.
Return required Outcome/Changed/Validation/Not verified/Report/Notes contract.
