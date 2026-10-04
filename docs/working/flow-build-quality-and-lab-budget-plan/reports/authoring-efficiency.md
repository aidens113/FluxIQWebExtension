# Authoring efficiency: page-aware choice feedback

Status: Complete
Owner: authoring-efficiency worker
Scope: One generic correction to misleading draft reorder feedback.

## Current State

- Implemented within supervisor-released files; worker made no commits.
- Current Core choice-order feedback previously used positions alone. A listing click incorrectly claimed as the cart act generated a concrete reorder instruction placing its later item choice before the listing click.
- Feedback now compares opaque domain replay places before recommending that reorder. Different known places produce claim-review/post-act-change feedback. Same or unavailable place evidence preserves the existing reorder hint.
- Claims remain unchanged; completion is not refused; whole-Flow testing and judgement remain required. The different-place feedback also avoids suggesting repeating a lasting act as a repair.
- Lane A's authored reports show Flash passed at $0.024166530 / 20 calls. The $0.212718924 Pro comparison used 31 calls; the reports attribute nine repair decisions ($0.064632392) and a second 41.2-second build test to choices moved before the page containing them. These historical measurements motivate the fix; its actual live saving is unmeasured.

## Changed files

Core paths relative to packages/fluxiq/src/programs/automation-studio/runtime/:

- flow-bootstrap/instructed-acts/choice-order.ts: accepts recorded steps, uses existing automationStudioFlowDraftStepMovedTarget for opaque replay.from comparison, and chooses context-safe feedback.
- flow-bootstrap/instructed-acts/checklist.ts and check.ts: both pass the same recorded steps so model and completion-check feedback agree.
- flow-bootstrap/instructed-acts/tests/choice-order.test.ts: four added tests (two parameterized different-place cases, same-place compatibility, absent-evidence compatibility).
- Core docs/architecture/automation-studio/llm-flow-bootstrap.md: documents the recorded-place guard and unchanged judgement requirement.
- This downstream report.

## Evidence and decisions

Read t174 authored lead round-1003 report, its Flash and Pro debug documents, and worker w114's report. No raw run bundles, page data, or private env were opened. The measurements are historical reports, not independent live verification. Read current t261 choice-order feedback and its consumers/tests. Existing automationStudioFlowDraftStepMovedTarget compares domain replay.from without interpreting browser concepts, preserving Core's domain boundary. This is a narrow independent repair rather than copying Claude's uncommitted broad changes.

## Validation

From t261 Core packages/fluxiq:

- Before source edit: pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/choice-order.test.ts -> 2 failed / 5 passed. Both different-place cases received the unsafe amend_draft reorder instruction.
- After source edit: same command -> 7/7 passed.
- Owning directory: pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests -> 6 files / 230 tests passed.
- git diff --check from Core root -> exit 0; no whitespace failures.
- Call-site rg confirms only the two modified runtime consumers call the changed helper.
- An initial guessed package filter matched no project, so it performed no test; corrected commands above ran from the actual owning package.

## Not verified

No paid run, browser test, panel operation, package typecheck, Core build, or structure audit performed by this worker. Supervisor owns combined typecheck/build/audit and independent verification. No claim of actual dollar savings is made until equivalent live runs verify behavior and accounting. Other lane defects (stale rerun handles, stale replay marks, cancelling toggles) remain outside this bounded edit.
