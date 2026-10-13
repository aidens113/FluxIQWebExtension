# t521 durable learning run summary

Status: implemented, source/tests frozen; corrected owning checks passed. Worker codex-t517, 2026-10-13. Paired task trees fxwork/t521; no commits or shared-document edits.

## Scope and behavior

Only Core apps/web/src/features/automation-studio/runtime/FlowRunView.tsx, its new tests/learning-summary.test.tsx and the adjacent diagnosis-authorization-interactions.test.tsx copy assertion changed. No extraction/component split/new helper/module needed. No Core runtime package or downstream source changes.

Read-back after a cut-short run response now copies explicit boolean runDetail.summary.durableBehaviorChanged from Core. Missing summary proof stays absent/unknown. It no longer infers application from autoApply or created ids, and naturally handles kept handler/inRunRepairs and reauthor outcomes reported by the same authoritative summary.

Post-run copy says when this run kept a change, when recorded changes were not kept (details can explain proposed/waiting/held-back state), when no change was kept, or when application information is unavailable. The Durable field renders unknown for missing proof. The view does not say every created adaptation requires approval and does not claim a future run has already reused the change. Existing links, permissions, history and live controls remain in place.

## Producer trace / compatibility

Core api/handlers/runtime-execution.ts and runtime/service/summaries/conversions.ts both use automationStudioRunChangedDurableBehavior. This recognizes actual receipts across runtimePatchAttempts/inRunRepairs and a kept resultReauthor marker. The existing helper deliberately accepts missing applied on pre-t249 legacy automatic receipts; current held receipts explicitly applied:false. This task consumes the authoritative summary and leaves that compatibility untouched. Unknown old UI responses are not guessed.

## Validation

Fail-first new mounted regression file: 9/9 failed on unchanged FlowRunView. Failures reproduced intent incorrectly reported durable, kept handler/reauthor incorrectly lost in readback, missing proof incorrectly reported durable, and unconditional review/no-durable summary language.

Owning command from paired Core apps/web:

```text
pnpm.cmd exec vitest run src/features/automation-studio/runtime/tests/learning-summary.test.tsx src/features/automation-studio/runtime/tests/run-permission-request.test.tsx src/features/automation-studio/runtime/tests/run-control-interactions.test.tsx src/features/automation-studio/runtime/tests/diagnosis-authorization-interactions.test.tsx src/features/automation-studio/runtime/tests/runtime-views.test.tsx
```

Executed via cmd.exe /d /c with logs outside repositories to avoid PowerShell native-stderr status ambiguity. Initial owning selection passed52/53; the remaining existing diagnosis assertion expected retired unconditional Ready-for-review copy. Updated only that assertion, retaining Review link/no-grant checks. Also corrected the new timer act callback to return void (supervisor type finding). Affected2-file rerun passed15/15, native exit0; other three files already passed38/38. Supervisor owns package types/audit and independent verification. No browser, provider, live adaptation, package build/typecheck, full suite or panel process was run by worker. Current tests use actual mounted readback with mocked authoritative Core replies; they do not prove production learned reuse.
