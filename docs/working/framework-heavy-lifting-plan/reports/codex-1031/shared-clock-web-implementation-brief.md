Role: standard worker; gpt-6.1-sol, medium.
Goal: t823 consume Core's stable date reference through existing browser extraction path without model-authored clock input.
Source root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQWebExtension.
Read: MAIN downstream reports/codex-1031/shared-clock-web-discovery.md; FHL Current State/K1/W7 only.
Owned: domain/src/output-nodes/native-runtime.ts, extract-list/** and owning tests; domain/src/runtime/adapter.ts and owning tests; browser content/extraction/{item-filter,order-rows}.ts and owning tests IF required by actual clock gap.
Must not touch: Core files, shared docs, package versions, git, unrelated sources.
Stable new Core SDK seam: AutomationStudioNativeNodeContext.host.referenceNow?:number (epoch ms). Executor native request.hostContext.referenceNow and effect context.referenceNow. This is lead-owned and will be built after Core workers finish.
Replace unsupported runStartedAt cast with SDK host referenceNow, propagate existing extractList.now. Preserve explicit request now and absent metadata fallback; no model/schema/UI clock redesign.
Check sorting/relative-date ordering uses same request reference as where filtering. Handle runtime adapter effect context if needed using the stable context seam; ask for extra ownership/type changes first.
Add named tests for supplied reference despite wall-clock crossing midnight, preservation of explicit request now, legacy no-context behavior, and sorting date parity.
Do not build/typecheck or run generated domain tests before lead rebuilds Core libs. Source tests may be prepared; standalone named browser unit tests only if they don't compile the entire package while Core edits.
No full suites, provider/API/browser launch/panel management. No user data. No relaxed assertions/baselines.
Report: MAIN downstream docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-web-implementation.md.
Return Outcome, Changed, Validation exact command/output, Not verified, Report, Notes(max3lines).
