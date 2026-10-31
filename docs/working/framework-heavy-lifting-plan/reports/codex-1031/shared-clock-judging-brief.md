Role: heavy worker; gpt-6.1-sol, max.
Goal: t823 make judge/data readers use the execution's fixed date reference, including cached build replay.
Source root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQ.
Read: MAIN downstream reports/codex-1031/shared-clock-core-discovery.md; Core FHL Current State/K1 only.
Owned: runtime/result-verification/**; runtime/llm/node-tools/dry-run-gate.ts and owning helpers/tests; runtime/service/flow-bootstrap-commands/build-judge.ts and owning tests; runtime/service/candidate-trial/summary.ts and tests.
Must not touch: executor/**, nodes/**, candidate-trial/run.ts, subflow-trial/run.ts, runtime-session/**, docs, package versions, git.
Stable lead interfaces: GraphExecutionOptions.referenceNow?:number, dispatch context.referenceNow, native hostContext.referenceNow, SDK context.host.referenceNow. Epoch ms; now() remains live.
Execution worker seeds graph options from session/trial persisted startedAt. Summaries use that same time, never judge-call wall time. Add optional report/reference fields as necessary and trace callers.
Fresh build replay captures once and supplies its reference to replay dispatch/executor options; cached clean replay/rejudgement retains original time. Resume/partial repair same execution keeps reference; new full execution gets fresh reference only consistently with session start.
Preserve caller numeric now overrides in low-level APIs, legacy fallback when metadata absent, and all acceptance checks. Do not replace live harness timing now().
Propagate through computed order, agreements/value readers and result normalization where relative dates are interpreted. No scenario-shaped guidance.
Add focused midnight, replay reuse, fresh replay and date-order cases in owning tests. No full suites/API/browser/panel calls.
Do not build/typecheck while workers edit. Named owning tests only, max2workers. Request any further source ownership before edits.
Report: MAIN downstream docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-judging.md.
Return Outcome, Changed, Validation exact command/output, Not verified, Report, Notes(max3lines).
