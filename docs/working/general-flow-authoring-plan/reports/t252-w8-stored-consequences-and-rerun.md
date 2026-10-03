# t252-w8-stored-consequences-and-rerun: report

## Outcome

Done. Nothing is committed. R = `packages/fluxiq/src/programs/automation-studio/runtime` in the t252 Core tree.

## What changed and why

- `R/flow-bootstrap/adaptation.ts`: each materialised Flow node copies its plan node's `consequences` into `metadata.declaredConsequences`. The key is a module-local constant, so no new export was needed. `[]` is kept, because the plan contract says `[]` ("nothing lasting") is a different answer from absent. When the plan node has no `consequences`, the key is left off. The value is a copy of the plan's array. Nothing reads it at run time.
- `R/llm/evidence-loop/rerun-request.ts`:
  - **Rerun of a written step** (`step.written`): the call is sent with `write: true`. Any binding form in the merged `parameters` is translated with `automationStudioFlowDraftTranslateBindings` from `R/flow-draft/binding-forms.ts`. This matches what `evidence-loop-decision.ts readNodeCall` does for a written call, which the rerun path never goes through.
    - A form that cannot be translated (a malformed form, or `$step`) is refused as the existing `bind_malformed`. It is never sent on as a literal. This handling is my addition; the brief did not ask for it.
  - **Rerun of a recorded step**: if the merged argument still holds a binding anywhere (`automationStudioFlowDraftHoldsBinding`, which catches `$state`, `$row`, `$input` and `$step` at any depth), it is refused as `rerun_holds_binding` and not run.
    - This is checked after the existing `run_by_the_loop` checks and before `changes_nothing`.
    - A rerun that replaces every binding with a concrete value still runs live, unwritten.
  - The local keys `write` and `parameters` follow the existing precedent in `rerun-input.ts`, which keeps its own keys and does not import from `node-tools/`.
- `R/flow-draft/amendment.ts`: `rerun_holds_binding` is added to the refusal union. This is the only change to that file.
- `R/llm/draft-amendment-feedback.ts` telling: "A bound step runs only in the Flow: rerun it with a concrete value for every bound parameter, or write it (write true)." The brief's text, capitalised and given a period to match the other tellings.
- `R/flow-bootstrap/evidence-loop-steps.ts`: the reason is added to the allow-list.
- `R/activity/wording/draft-edit-refused.ts`:
  - New BECAUSE phrase: "that step takes a value that varies, which is known only when the Flow runs".
  - The card's title is now "Didn't run the step again" for this reason as well as for `changes_nothing`, through a new `RERUN_REASONS` set. A rerun refused for this reason is a rerun that was not run.
- Tests, written first; 10 failed before the implementation:
  - `flow-bootstrap/tests/adaptation.test.ts`: 1 new test.
  - `llm/evidence-loop/tests/rerun-request.test.ts`: 6 new tests:
    - a written rerun carries `write: true`
    - a written rerun translates a form
    - a written rerun refuses a bad form as `bind_malformed`
    - a recorded step with a stored `$state` gives `rerun_holds_binding`
    - each of the three forms given to a recorded step gives `rerun_holds_binding`
    - a recorded step whose bindings are all replaced runs live
  - `llm/tests/draft-amendment-feedback.test.ts`: added to the exhaustive reason map, plus 1 telling test.
  - `flow-bootstrap/tests/evidence-loop-steps.test.ts`: 1 round-trip test.
  - `activity/wording/tests/reasons.test.ts`: 1 card test.

## Commands run and observed results

- First run of the 5 test files, before the implementation: `Test Files 5 failed (5)`, `Tests 10 failed | 80 passed (90)`.
- The same 5 files after the implementation: `Test Files 5 passed (5)`, `Tests 90 passed (90)`.
- `npx vitest run R/flow-bootstrap R/llm/evidence-loop/tests R/activity R/flow-draft/tests/amendment.test.ts R/llm/tests/draft-amendment-feedback.test.ts` -> `Test Files 111 passed (111)`, `Tests 1491 passed (1491)`.
- `npx vitest run R/flow-change/tests/contracts.test.ts` -> 12 passed. This is the one other test that matches on node metadata.
- `pnpm --filter fluxiq check` -> rc 0, no `error` lines. It ran while the other workers were editing, so the build-cache did not stamp it.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (229 warning(s), 349 baselined).`
  - `adaptation.ts` is 397 lines, under the 400 advisory, after I shortened my comments.
  - `draft-amendment-feedback.test.ts` is at 418 lines; it was already over 400 before I added to it.

## Not verified

- The full suite and live behaviour.
- Whether the domain accepts a written rerun whose parameters carry `$state`. P2 says the write path passes `$state` through.
- How `rerun-replacement.ts` marks the replacing step as written. It goes through the ordinary tool-call path, so it should read `core.run_node.written`, but I did not trace it.

## Open questions or contradictions found

1. The brief did not cover a rerun of a written step that carries a malformed or `$step` form. I refuse it as `bind_malformed`, the same as bind does.
2. `step.input` for a written step may already carry `write: true`, depending on what the domain answered in `draft.input`. The rerun sets it either way.
3. The `rerun_holds_binding` check runs before `ranAlready`, so a bound recorded rerun is never offered to the repeat guard.
