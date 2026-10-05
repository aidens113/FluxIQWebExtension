# Unusable decision field feedback

Status: owned source frozen;67 focused tests pass, one real-loop regression pending supervisor wiring. Worker resume-cd, 2026-10-03 local. Bounded brief unusable-field-feedback; supervisor owns shared docs and integration. No live/build/full-suite authorization.

## Confirmed cause and partition

B4 seven paid tool_call decisions misplaced boolean write at response.decision.write instead of existing response.decision.input.write. Parser rejectUnexpectedFields currently records parent response.decision only, losing field identity. Harness retains diagnostics, but unusable-decision conversion carries issueCodes/reply account only, and evidence-loop refuses with generic code/shape. Existing schema/permission authority remains correct; do not accept outer decision.write.

Initial8 exact source/test reads: llm/harness/{provider-result,run,diagnostic,task-request}.ts; llm/{unusable-decision,evidence-loop}.ts; llm/tests/unusable-decision.test.ts; llm/harness/tests/run.test.ts. Core AGENTS and downstream Current State/exact brief read; own B4 debug completed earlier. Only released source owners provider-result.ts/run.ts/unusable-decision.ts and nearest tests may change. evidence-loop remains reserved to other lane.

## Proposed typed integration seam

Closed known grammar issue type: code llm_output.unexpected_field, path response.decision.write, expectedPath response.decision.input.write. Parser reports this specific known path only; arbitrary unknown key names remain absent. Existing diagnostics retain strict refusal. Error conversion exposes screened optional readonly fieldIssues and feedback accepts fieldIssues, copying known constants only, with grammar correction and unchanged permission/tool checks.

Supervisor serial integration: extend evidence-loop refuseDecision with optional trailing typed fieldIssues; pass to feedback; catch forwards thrown.fieldIssues. Do not alter progress/status/permission semantics or other lane settlement. Worker will add actual schema/harness-to-feedback and real-loop regression to owning existing tests, then report pre-integration failing case honestly. No evidence-loop edit by worker.

## Validation ledger

- First attempted pnpm filter @fluxiq/fluxiq matched no project and ran no tests; corrected to pnpm -C packages/fluxiq exec vitest. No pass claimed from unmatched filter.
- Actual fail-first owning new fixtures:3cases,2failed/1passed (51existing skipped), exit1. Harness refused outer write but reported only response.decision; real loop next feedback lacked fieldIssues, rejected host call remained unexecuted. Valid nested write/private-field withholding fixture passed already.
- Implemented exact owned provider-result.ts known write path refinement and unusable-decision.ts closed type/error/feedback. harness/run.ts already preserves parser diagnostics unchanged; no edit required. Added actual harness+feedback, real-loop/nohostcall and closed-path reconstruction/unsafe/extras tests in llm/tests/unusable-decision.test.ts. No schema relaxation, mutation/permission/cost/default change.
- Initial after-implementation3cases:2pass/1fail (the real-loop regression intentionally pending supervisor evidence-loop wiring). Root approved serial typed integration after other lane settles. No worker evidence-loop edit.
- Final focused pre-integration owners **67passed/1skipped in2files**, exit0,8.88s runner duration. Only skipped test is the new actual-loop feedback regression requiring supervisor wiring. Existing13harness tests plus54unusable-decision tests pass. Scoped git diff --checkPASS. Module248lines/test674lines, both below800. No typecheck/build/full-suite run by worker; supervisor integration types/audit and final real-loop pass remain required.

Exact owning command from paired Core:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 field feedback owned preintegration' pnpm -C packages/fluxiq exec vitest run src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts -t '^(?!.*delivers precise feedback)'
```

After supervisor wiring, rerun the same two files without -t, which includes the exact integrated next-model/zero-hostcall case. Do not treat67passed as integrated acceptance.

Exact root import is type AutomationStudioLlmUnusableDecisionFieldIssue from ./unusable-decision.ts alongside existing error/feedback import. In refuseDecision append fieldIssues?:readonly AutomationStudioLlmUnusableDecisionFieldIssue[] after resultReason; feedback call passes fieldIssues; catch forwards thrown.fieldIssues after thrown.reply?.case. Existing no-path cases omit fieldIssues entirely. FieldIssue is a type export from unusable-decision.ts; no new module or barrel needed for existing direct loop owner import. Supervisor may independently assess public llm barrel if desired; worker did not read/edit index outside initial partition.

No live/build/full-suite/store/profile/env/key/guard/shared-doc/commit changes. Current source changes bounded to owned parser/unusable-decision/test; report only downstream.
