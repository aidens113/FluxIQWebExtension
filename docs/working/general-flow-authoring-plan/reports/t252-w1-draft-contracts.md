# t252-w1-draft-contracts: report

## Outcome

Done. P1a draft contracts are in the t252 Core tree. Nothing is committed. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

New files:
- `R/flow-draft/binding-forms.ts` translates the model's forms into state bindings at any depth, through objects and arrays:
  - `{"$row": f}` becomes `{"$state":{"path":"item.f"}}`.
  - `{"$input": n, "test": v}` becomes `{"$state":{"path":n,"fallback":v}}`.
  - `$step` is refused as `step_binding_not_yet`.
  - It reuses `automationNodeStateBinding` and `isAutomationNodeParameterStateBinding` from `nodes/`.
  - Name rules: input names match `^[a-z][A-Za-z0-9]{0,31}$`, and `item` is reserved. Row fields match `^[^.\s]{1,64}$`.
  - Refused as `malformed`: extra keys, wrong types, a missing or `null` test, or a test that holds a binding. A refused form is left out of the output and never passed on as a literal.
  - Answers `{parameters, refused: [{path, reason}]}`.
  - Also exports:
    - `...IsBindingForm`
    - `...HoldsBinding` (true for a form or a `$state`, at any depth)
    - `...StoredBindingKind` (`row` for path `item.<f>`; `input` for a dotless path with a fallback)
    - `...StoredBindings` (every one with its path)
    - the two name regexes
  - Depth is capped at 16, as in the executor.
- `R/flow-draft/binding-render.ts` turns a stored `$state` back into the model's form. A `$state` of any other kind is left as it is.
- `R/flow-draft/flow-inputs.ts`: `automationStudioFlowDraftInputs(steps)` returns `{inputs: [{name, test, steps}], conflicts: [{name, tests, steps}]}`.
  - It reads proposed steps only.
  - It reads `ranWith.parameters ?? input.parameters`, falling back to the whole argument.
  - Test values are compared ignoring key order.

Edited files:
- `step.ts`: adds `written?: true` and `instance?: JsonObject`, with doc comments. `IsProposable` is now `isAction && (written || effectApplied !== false)`.
- `amendment.ts`:
  - `bind` is in the change enum, the header and the schema. The text is in both the `change` and `input` descriptions; the existing rerun sentences pinned by `rerun-input.test.ts` are kept.
  - `bindStep` follows D2 and checks everything before it writes anything:
    - kept or proposed steps only, else `not_a_kept_step`
    - the `parameters` wrapper is optional
    - every leaf must be a form, else `bind_not_a_binding`
    - every leaf must replace an existing key, else `bind_new_key`
    - `$input` without a test takes the replaced value. If that value is already a stored input, its test is used.
    - a translate failure gives `bind_malformed`
    - `$row` needs the step inside a repeat span (the repeating step through `through`, as in `routing.ts`), else `bind_row_outside_loop`
    - the same binding again gives `already_so`
  - It writes `$state` into `ranWith.parameters` and `input.parameters`.
  - The first concrete argument is kept as `instance`, never on a written step, and is never replaced.
  - The refusal type gains `parameter?: string` (the dotted path) and the four `bind_*` reasons.
  - `did_not_work` never applies to a written step.
- `entry.ts`:
  - The step line renders bindings as forms, shows `written: true`, and shows `passes`.
  - `passes` is read by shape from `replayed.passes`: a number, or an array, which is counted.
  - The entry gains `inputs` when there are any.
  - A written step is never `did_not_work`.
  - `AUTHORED_INSTRUCTION` is rewritten per D8: explore freely, `write true`, `written true`, a loop rather than a sequence, write a lasting act, the binding forms, `amend_draft bind`, `inputs`, `passes`. Every previously pinned phrase is kept.
- `full-run-required.ts`: adds the word `not_reached` and its sentence. Both instructions now name `write true`. Still domain-neutral (the existing regex test passes).
- `index.ts` exports the three new modules.
- `R/llm/draft-amendment-feedback.ts`: a telling for each `bind_*` reason, and `parameter` is carried on a refused entry.

Edited outside the listed files (necessary; both are maps keyed by the refusal reason that must list every reason, so they fail typecheck otherwise; entries only):
- `R/flow-bootstrap/evidence-loop-steps.ts`: the reason allow-list gains four `true` entries.
- `R/activity/wording/draft-edit-refused.ts`: `BECAUSE` gains four person-facing phrases.

Tests (written first; 15 failed before implementation): new `binding-forms`, `binding-render`, `flow-inputs` and `step` tests, plus additions to the `amendment`, `entry`, `full-run-required` and `draft-amendment-feedback` tests.

## Commands run and observed results

- First run of the new and extended tests, before implementation: 15 failed, 48 passed; the 3 new-module files failed to import.
- `npx vitest run R/flow-draft/tests R/llm/tests/draft-amendment-feedback.test.ts R/activity R/flow-bootstrap/tests/evidence-loop-steps.test.ts R/llm/evidence-loop/tests/rerun-input.test.ts R/llm/node-tools/tests/dry-run-gate.test.ts R/llm/tests/evidence-loop-seeded-draft.test.ts R/llm/tests/evidence-loop-draft-shown.test.ts R/llm/evidence-loop/tests/authored-draft.test.ts` -> `Test Files 42 passed (42)`, `Tests 443 passed (443)`.
- A wider run, which added `decision-context/tests/recorded-windows.test.ts`, the evidence-loop `draft-numbers`/`stalled-amendments-replay`/`held-amendments`/`rerun-request` tests, `decision-dump`, `evidence-loop-provider`, `evidence-loop-tool-failure` and `ui/activity-action` -> 351 passed, 1 failed: `recorded-windows.test.ts` "everything-store-run4". Its D32/D38/D42 lines lose the `rerun.N web.inspect.succeeded` or `rerun.N.place` half.
  - The failure is not caused by this brief. I copied my files aside, put the HEAD versions of `amendment/step/entry/full-run-required/index.ts` and `draft-amendment-feedback.ts` back, and re-ran: it still failed. I then restored my versions.
  - It is either already on HEAD or comes from the concurrent edits in `flow-bootstrap/authoring/` (`values.ts`, `normalise.ts`, `assemble-draft.ts`).
- `pnpm --filter fluxiq check` -> clean after fixing two type errors of mine (a narrowed `Object.values` in `binding-forms.ts`, and an `exactOptionalPropertyTypes` fixture in `flow-inputs.test.ts`). No errors in `flow-bootstrap/authoring`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (224 warning(s), 349 baselined)`. New advisories only: `amendment.ts` 552 lines (over the 400 advisory, under the 800 limit); `flow-draft/` 20 files and `flow-draft/tests/` 19 (over the 15 advisory, under 25).

## Not verified

- The full suite; nothing outside the files listed above.
- `docs-reference --check` (not in this brief's definition of done).
- How P1b, P2 and P3 consume these contracts. The `passes` shape is assumed, and the write path is not yet wired.

## Open questions or contradictions found

1. `DRAFT_INSTRUCTION` (the transcript, non-authored telling) still says "A step you want and have not run yet is run, not written." D8 names only the authored telling. If `write` reaches transcript-mode loops, that sentence contradicts it.
2. `passes` is not yet a field of `AutomationStudioFlowDraftReplayOutcome`, which is in `dry-run.ts` (not mine). The entry reads it by shape: a non-negative integer, or an array, which is counted. P3 should add the field with one of those shapes.
3. `automationStudioFlowDraftTranslateBindings` refuses `$input` without `test` as `malformed`, so a written step must give its test. Only `bind` fills it, from the replaced value. P1b's parse should either require it or fill it.
4. In a `bind` patch, an array leaf is refused as `bind_not_a_binding`: forms inside a list can be bound only by writing the step.
5. `amendment.ts` grew from 376 to 552 lines. Moving `bindStep` and its helpers into their own module (for example `flow-draft/bind-step.ts`) would be cleaner, but the brief named the files I own, so I did not create one.
6. A refusal's `parameter` is shown to the model, but `evidence-loop-steps.ts` drops it when it records the step (it keeps step, reason and nodeId).
7. The `recorded-windows` everything-store-run4 failure above needs an owner.
