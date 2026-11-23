# FluxNode input-name boundary intake
Role: read-only discovery; existing p0_judge, gpt-6.1-sol medium. No source edits, git or heavy jobs.
Goal: identify the minimal shared fix for valid FluxNode names rejected by Flow input binding/automatic processing.
Read in paired t984 Core: packages/contracts/src/fluxnode/spec/goal.ts and flow/interface.ts; packages/fluxiq/src/runtime/flow-authoring/draft/binding-forms.ts; components/automation/processing-inputs.ts; framework/automation-service/service/answer-first/flow-run/input-bound-steps.ts. Follow only their owning validators/resolver as necessary.
Public goal accepts uppercase/underscore identifiers; draft names currently lower camel max32. No canonicalization was found in input-bound-steps.
Determine exact valid public name space, reserved names/prototype/path collisions, existing parameter resolver semantics, and whether a neutral shared contracts helper suffices.
Do not add processing equality lifting, weaken explicit input ownership or permit arbitrary state/row/step access.
Propose exact owner paths/tests and compatibility impact; no invented names/restrictions or independent runtime parser copies.
Coordinate findings with p0_permission; it owns implementation in t984 and is already correcting invalid-source recovery.
Existing t986 corrected typecheck remains priority; no browser or new heavy submissions.
Report: docs/working/data-first-simplification-plan/reports/input-name-boundary-intake.md in t986 downstream.
Return Outcome/Changed/Validation/Not verified/Report/Notes; concise report, no file dumps.
