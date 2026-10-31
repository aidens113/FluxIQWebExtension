Role: heavy worker; gpt-6.1-sol, max.
Goal: implement t823 stable date reference through Core executor/native dispatch and trial run boundaries.
Source root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQ.
Read: downstream shared-clock-core-discovery.md, shared-clock-web-discovery.md; Core FHL Current State/K1 only.
Owned: runtime/executor/** EXCEPT contracts.ts; runtime/native-runtime/** (locate actual owner); native runtime host adapter; runtime/service/runtime-session/**; service/candidate-trial/run.ts; service/subflow-trial/run.ts; flow-bootstrap/verification/detached* execution runners. Owning tests beside these paths.
Must not touch: executor/contracts.ts, nodes/importer-sdk.ts, result-verification/**, llm/**, candidate-trial/summary.ts, docs, package versions, git.
Stable lead-owned interfaces already added: GraphExecutionOptions.referenceNow?:number; effectDispatcher context.referenceNow?:number; native request.hostContext.referenceNow?:number; SDK native context.host.referenceNow?:number. All epoch milliseconds.
Use enclosing run startedAt as fixed reference; keep now() live for deadlines, retry pacing and elapsed time. Capture once at root. Resume/partial repair and children inherit; fresh new root/trial captures fresh reference.
Candidate/subflow trial run boundaries pass their already-persisted startedAt as referenceNow into detached options. Ordinary runtime should match its persisted start too.
No model-authored parameter/schema changes. Propagate through canonical native execute host-context adapter. Validate malformed explicit reference safely, no wall clock frozen.
Add focused midnight/advancing timer, nested child/resume, and normal/native/effect/trial reference tests. Keep prior behavior where no clock metadata existed.
Do not build/typecheck while other workers edit. You may run only named owning tests with max2workers, no full suites/API/browser/panel calls.
No test assertions weakened. No global reset/baseline updates. Report any additional owned path needed before editing it.
Report: MAIN downstream docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-executor.md.
Return Outcome, Changed, Validation exact command/output, Not verified, Report, Notes(max3lines).
