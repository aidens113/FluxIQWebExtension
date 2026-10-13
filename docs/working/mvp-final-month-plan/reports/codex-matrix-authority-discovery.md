# Recovery matrix task authority discovery

Status: read-only discovery complete. Worker codex-t517, 2026-10-13. Main downstream and the retained t418 compile helper inspected; no source edits/tests/build/browser/process/provider/commit operations. This report is the only write.

## Finding and affected paths

Main and t418 `packages/test-runner/src/recovery-matrix/compile/compile-flow-script.ts` are byte-identical. CompileMatrixFlowInput:46-54 carries fluxiqRoot/projectId/flowId/flowName/script, with no task text. Compiler:72 creates the Flow, assembles/validates the script, then :84 persists a Flow-scoped active required instruction whose body is input.flowName. This does not satisfy the new explicit-task product contract even though the current Core selector can technically accept an ordinary nonblank legacy body.

One production call at `recovery-matrix/run/run-matrix-case.ts:115` covers **14 matrix cases / 10 distinct script exports**. It generates `Recovery matrix <id>: <case title>` and truncates to120 characters. There are three compile test call sites in `compile/tests/compile-flow-script.test.ts` (loop's gap and success branches, plus explicit unresolved-handle case).

`matrix-row.ts` RecoveryMatrixCase has title (documented as what the case shows), scenario/workflow/variant, perturbation, script export name, check and site expectation/goalFacts. It has no separate automation task. `matrix-rows.ts` contains hand-authored test-case descriptions and expected site state, not explicit independent authored task descriptions. The ten scripts are HUB_TO_CART, HUB_TO_CART_PROMOTION_HANDLER, HUB_TO_CART_TWO_HANDLERS, PICKUP_CART_STORE_ENTRY, TOWELS_FILTER_ENTRY, SOAP_SEARCH_TWO_BLOCKS, QUICK_ADD_ALTERNATIVE, CONFIRM_QUALIFYING, CONFIRM_WITH_CHECKPOINT and CONFIRM_THEN_STOP. There is no existing task field to forward unchanged. Do not derive it from case title, script summary/actions, scenario workflow instructions, oracle IDs or goalFacts.

Initial five source/test reads were compile helper, its test, immediate run caller, case contract and rows. Only metadata/search results and instruction authority Current State were inspected afterwards; no further script implementations were read to manufacture task prose. A source implementation brief must release the exact hand-authored script files for authoring and checking corresponding explicit task text.

## Smallest synchronized fix

1. Add required `task: string` (or `instruction: string`, name chosen consistently) to RecoveryMatrixCase, documenting **explicit tester-authored automation intent**, separate from the test-case title and site oracle. Author these texts alongside the existing14 case literals; shared explicit constants are fine when several cases genuinely execute the same task. The negative/intentional-failure cases need their actual bounded intended behavior, not an invented success goal or oracle-to-task conversion.
2. Add the same required field to CompileMatrixFlowInput; pass matrixCase.task at the one production call. Keep generated flowName as display title only. No optional fallback.
3. Validate trimmed task1..4000 before opening/creating a Flow or other durable mutation. Missing/blank/oversized input refuses with an actionable fixed RunnerFailure. Do not wait for graph creation before discovering missing authority.
4. Persist that authored task through the existing explicit task-save seam (saveFlowGenerationInstruction) on the newly created matrix Flow, instead of constructing an instruction with body=title. Use the returned instructionId as bootstrap sourceInstructionIds. No Core API change or authority bypass is needed; server provenance and selected task ownership stay with Core. If keeping existing low-level saveFlowInstruction is intentionally chosen, root must explicitly justify why this is an authored tester task and preserve the same exact body/provenance contract; the explicit public save seam is preferable.
5. Update three compile test calls with deliberately authored synthetic test tasks and assert persisted instruction body is the supplied task, never generated name/accepted-summary/oracle. Validate all14 case tasks independently and preserve current flow/script selection, features, negative paths, authority gaps and goal checks.

The matrix creates fresh isolated authored deterministic browser automations. This is legitimate to supply explicit operator/tester-authored instructions at creation. It is **not** evidence of model generation, and not permission to attach fixture goals to reused/user saved Flows. Low-level graph/executor unit primitives need no new task body just to satisfy a browser-product gate; changes belong only at this actual browser automation creation boundary.

## Exact proposed ownership

Production initial unit, four files:

- packages/test-runner/src/recovery-matrix/matrix-row.ts
- packages/test-runner/src/recovery-matrix/matrix-rows.ts
- packages/test-runner/src/recovery-matrix/run/run-matrix-case.ts
- packages/test-runner/src/recovery-matrix/compile/compile-flow-script.ts

Adjacent tests:

- recovery-matrix/compile/tests/compile-flow-script.test.ts
- recovery-matrix/tests/matrix-rows.test.ts
- a new owning compile or run boundary test only if needed to prove early refusal/no side effects without browser startup.

Read-only script owners for authored-text review: recovery-matrix/flows/** for exactly the10 exported scripts above (including hub/confirm compositions). No source changes to scenarios, fixtures, oracle, goalFacts, Core runtime, domain instruction rules or t518. Existing tests generally retrieve case literals from RECOVERY_MATRIX_ROWS, so the required field does not need broad unrelated fixture migration; typecheck will confirm exact residual callers.

## Narrow validation and release sequence

After frozen compatible public dependencies, test-runner source/test typecheck and structure audit, compile only the owning runner package as required by its existing dist test runner, then:

```text
node --test packages/test-runner/dist/recovery-matrix/compile/tests/compile-flow-script.test.js packages/test-runner/dist/recovery-matrix/tests/matrix-rows.test.js
```

New regressions: missing/blank/>4000 before create, persisted exact trimmed task distinct from title, no fallback to oracle/workflow/title, all14 rows described, unchanged script assembly/validation/handle refusal and applied topology. Confirm Core's returned saved task readiness is ready for a new matrix Flow; do not mutate historical saved Flows. No whole package test sweep is required.

Only after integration/public rebuild/synced lane source, rerun the already-authorized **relevant provider-free cases** in t418/current readiness lane. Never run the unchanged matrix or use a temporary flow-name instruction to unblock it. Report matrix execution as hand-authored recovery infrastructure proof, separately from instruction-created model qualification. Existing account/profile/runtime state and t418 work remain preserved.
