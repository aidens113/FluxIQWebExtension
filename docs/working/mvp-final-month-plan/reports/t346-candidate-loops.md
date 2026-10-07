# t346 candidate submissions can express loops and bindings: worker report

Worker: t346-candidate-loops. Core tree: `C:\Users\osrs_\FluxStuff\fxwork\t346\!FluxIQ` (base `e5f25177`), uncommitted.
Paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/` unless they say otherwise.

The first dispatch stopped Blocked because the brief named `plan/parsing.ts` as the script parser. It is the JSON plan parser; the script grammar is in `authoring/`. The supervisor re-briefed: ownership now covers `authoring/{parse,contracts,assemble,draft-routing,draft-bindings,assemble-draft}.ts` and `authoring/tests/**`, `candidate/submission.ts`, and the candidate-only text in `plan/flow-script-format.ts`. This report covers the re-briefed work. The file:line map of the legacy loop shape from the first pass is kept, in short form, at the end.

## Outcome

Done, with two pieces of wiring left for the supervisor, in files I do not own (see "Open questions"). Candidate scripts can now state both loop forms and all three binding forms:

- Both loop forms assemble to exactly the node, parameter and edge shape the legacy drafted repeat builds. Tests compare the two plans directly.
- Candidate submissions run the existing loop and binding checker against the submitted graph. Bindings the graph cannot honour are refused, with diagnostics that name the line or the parameter.
- Legacy prompt and completion schema bytes are unchanged. Legacy drafted-path behaviour is unchanged, and every existing test in the owned directories passes unmodified.

## What changed and why

**Syntax (`authoring/parse.ts`, `authoring/contracts.ts`).** A step accepts four new lines, read onto the step as `AutomationStudioFlowScriptStep.repeat`:

- `repeat over: <label>`
- `repeat through: <label>`
- `repeat while: <label>`
- `repeat most: <n>`

They map one-to-one onto the draft relation `{kind:"repeat", over, through}` / `{kind:"repeat", while, most}` in `flow-draft/routing.ts`. The keys are two words, so they never collide with a node parameter (a key containing a space names no parameter). Before this change the same lines were refused as `bootstrap.unknown_parameter`, so no script that was valid before changes meaning.

**One wiring for both paths (`authoring/draft-routing.ts`).** I moved the graph emission of the drafted `repeat` and `repeatWhile` into `emitRepeatOver` and `emitRepeatWhile`, unchanged. The draft path now calls them, and so does a new `routeAutomationStudioFlowScriptRepeats`, which lowers a script block's `repeat` statements into the same derived steps:

- Merge nodes at the loop head and exit.
- For Each with `items`, `body`, `done`, and `item` going to every row-taking step; or Repeat with `body`, `done`, `most`, and the last step's `branch` routes (next-page's `ended`) going to the exit.
- `targetPort` and `routed` set exactly as the draft path sets them.

Derived labels start with `:`, which a written label can never contain.

The script-side refusals use script wording and give `flow.line.N` as the path:

| Code | When |
| --- | --- |
| `flow_script.repeat_invalid` | Neither or both of `over`/`while`; `most` used with `over`; `through` differs from `while`; `most` not a whole number in the Repeat node's bounds |
| `flow_script.repeat_span_unknown` | Span end or `over` label not in this block, or written before the span |
| `flow_script.repeat_not_after_its_source` | Listing written at or after the span; listing inside another loop; a check that is not just before the span; loop at the very start |
| `flow_script.repeat_body_is_routed` | A repeat nested inside a span |
| `flow_script.repeat_body_branches` | A span member has an `on ...:` branch or runs a block |
| `flow_script.branch_into_repeat` | A branch from outside the span goes into it |
| `flow_script.repeat_while_never_ends` | The last step has no ending route and there is no `most`. This is the unbounded-repeat refusal |
| `flow_script.repeat_unavailable` | The library has no Merge, For Each or Repeat node |

The legacy messages are byte-identical; `repeatDefaultPasses` produces the same phrase as before. `listPort`, `takesRow` and `writtenDefinition` now take the written step (`{node, description}`) instead of the draft wrapper.

**Bindings in scripts (`authoring/assemble.ts`).** `assembleAutomationStudioFlowScriptPlan` routes each block through `routeAutomationStudioFlowScriptRepeats` first; a block with no `repeat` comes back as the same array. In `buildNode`, a value (top-level or dotted) written as one of these forms becomes the state binding the drafted path stores for the same intent:

| Written | Stored |
| --- | --- |
| `$row.<field>` | `{"$state":{"path":"item.<field>"}}` |
| `$input.<name> = <test>` | `{"$state":{"path":"<name>","fallback":<test>}}` |
| `$step.<label>.<output>[.<field>]` | `{"$state":{"path":"$node.<key>.<output>..."}}`, keyed by the labelled step's node |

Names follow the draft's own rules: `AUTOMATION_STUDIO_FLOW_DRAFT_ROW_FIELD` and `..._INPUT_NAME`, imported from `flow-draft`. A malformed form gets `flow_script.invalid_binding` at `plan.subflows.i.nodes.j.parameters.<path>`.

**The single checker, extended (`authoring/draft-bindings.ts`, `authoring/assemble-draft.ts`).**

- `authoringDraftBindingIssues` takes an optional `written: true`, which adds:
  - parameter-level paths and script wording;
  - `flow_draft.row_binding_unknown_field`: a `$row` field the walked listing's `fields` or `columns` do not read, using the same reading `assembled-record-output.ts` uses;
  - `flow_draft.loop_unbounded`: a cycle that passes through no For Each or Repeat. Plan validation accepts any cycle that closes through a join.
- `authoringPlanGraph` adds graph order facts: back edges found by DFS, precedence, dominators, and loop membership (For Each bodies and cycles).
- The drafted earlier-output checks became `earlierOutputBindingIssues` over an `EarlierOutputSubject`. The draft path supplies the same answers as before, with byte-identical messages. The new exported `automationStudioFlowBootstrapWrittenPlanBindingIssues` supplies graph answers for `$node.<key>` references: missing, not earlier, unknown output, conditional, or repeated source read from outside its loop.
- The draft path never sets `written`, so legacy behaviour is unchanged.

**Candidate submissions (`candidate/submission.ts`).** After a valid completion verdict, the controller runs `automationStudioFlowBootstrapWrittenPlanBindingIssues` on `verdict.buildPlan.plan`, for script and JSON plans alike. Any error refuses the revision with `check.feedback.code: "candidate.loop_or_binding_refused"` and issues carrying code, path and message, and leaves no candidate.

I did not pass `draftSteps` as the re-brief literally suggested. Passing them would switch the completion check onto the drafted path, which ignores the submitted script entirely (`llm/harness-options/bootstrap-completion.ts:211-219`). Running the same checker on the submitted graph meets the intent. Please confirm.

**Format text (`plan/flow-script-format.ts`).** New candidate-only `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`, placed beside `AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE`. It holds the rules for the four repeat lines and the three binding forms, plus two examples:

- "reading every page of a list": lane C shape, with `repeat while: next`, `web.dom.next_page`, and `recordOutput.columns` plus `recordOutput.process` for run-end processing;
- "acting on each row a listing kept": lane D shape, with `repeat over:` and `repeat through:`, a `modify_existing` press, and `$row.name`.

`AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` and the act example are untouched; the git diff for this file is only `@@ -205,0 +206,56 @@`.

**Tests (all new; no existing test edited).**

- `authoring/tests/candidate-loops.test.ts` (16 tests):
  - Lane C and lane D: the drafted plan (`assembleAutomationStudioFlowDraftPlan` with repeat routing) and the written script (`acceptAutomationStudioFlowBootstrapResult`) give equal `shape()`: node definitions, parameters including the `$state` row binding and `recordOutput.process`, consequences, and every edge by node index and port. The only difference is the derived dataset id and label, which the draft names after its step id and a script after its node key. Both plans validate, and the written checks find nothing.
  - `$input` and `$step` forms.
  - Refusals: unknown `$row` field, `$row` outside the span, a reader after the loop reading `$step.page.records` (repeated source), a span end that is unknown or written earlier, a member branching out, a branch into the span, unbounded `repeat while` and the same loop accepted once `repeat most: 5` is added, invalid `most`, `over` naming a later or missing step, malformed bindings, and a JSON plan cycle through joins alone.
  - A script with no `repeat` passes through unchanged.
- `plan/tests/loop-format.test.ts` (4 tests): the text is kept out of FORMAT, the act example and the completion schema; there is one example per loop; each example builds into the loop shape.
- `candidate/tests/submission-loops.test.ts` (3 tests): the lane D script is accepted as a draft revision; `$row.colour` is refused with `flow_draft.row_binding_unknown_field` at `plan.subflows.0.nodes.5.parameters.text` and the earlier receipt is spent; a JSON merge-only cycle is refused with `flow_draft.loop_unbounded`.

## Commands run and observed results

Run from `packages/fluxiq` unless noted.

- Baseline before edits: `npx vitest run .../flow-bootstrap/authoring .../candidate .../plan` gave "Test Files 31 passed (31), Tests 300 passed (300)".
- **Fail-first.** With the eight source files temporarily restored to HEAD and the new tests kept, `npx vitest run` on the three new test files gave "Failed Tests 21". The causes were `bootstrap.unknown_parameter` at path `plan.subflows.0.nodes.2.parameters.repeat over`, and "automationStudioFlowBootstrapWrittenPlanBindingIssues is not a function". Afterwards I restored my edits; `git diff --stat` showed "8 files changed, 882 insertions(+), 80 deletions(-)" (before later small edits).
- After the change: `npx vitest run .../flow-bootstrap/authoring .../candidate .../plan` gave "Test Files 34 passed (34), Tests 323 passed (323)", which is 300 existing plus 23 new.
- Wider run: `npx vitest run .../runtime/flow-bootstrap/ .../runtime/llm/ .../runtime/flow-draft/` gave "Test Files 3 failed | 293 passed | 1 skipped (297); Tests 5 failed | 3504 passed". All five failures are pre-existing: each also fails with every one of my files restored to HEAD.
  - `generation-failure/tests/provider-refusal.test.ts` and `provider-throw.test.ts` (4 tests): "automationStudioWithoutLocators is not a function" and "runAutomationStudioLlmHarness is not a function", a module-cycle evaluation-order fault. At HEAD the run printed "Tests 4 failed | 343 passed".
  - `llm/tests/loop-budget.test.ts` (1 test): "expected +0 to be 7". At HEAD the run printed "Tests 1 failed | 16 passed".
- Nonincremental typecheck: `npx tsc --noEmit -p tsconfig.json` printed nothing, exit 0. It includes the tests: an earlier run caught two test typing errors, which I fixed.
- Structure audit, from the Core root: `node scripts/structure-audit.mjs` printed "structure-audit: passed (287 warning(s), 509 baselined)".
- `git diff | grep -c "as never"` printed 0, and the new test files contain 0 as well.

## Not verified

- The model does not see the loop format yet. `candidate/authoring-loop.ts:29` builds the `flow` description from FORMAT and the act example only, and it is not mine to edit.
- No live, provider or Lab run, and no trial execution of a looped candidate through the runtime. The shape equals the legacy one by construction and by test, but I did not run the executor on a written loop.
- The example's `nextPage: extraction.1` assumes the domain resolves an extraction handle for the next-page request. Real next-page parameters (`nextPage` object, `ended` route) come from `domain/src/output-nodes/next-page/parameters.ts`. I did not verify handle resolution for `nextPage`.
- `flow_draft.row_binding_unknown_field` only knows fields when the listing writes `fields`/`columns` literally. With an extraction handle (the usual live case) the fields are unknown at submission, so the check passes. A row field the domain adds beyond the declared fields would be wrongly refused if a listing declares fields literally.
- I typechecked only `packages/fluxiq`; the other Core packages and the downstream repo were not checked. The changes add exports and change no existing export signatures.
- The `flow_script.*` refusal messages raised during assembly reach the model as code and path only (see the next section). The candidate-level refusals carry full messages.

## Open questions or contradictions found

1. **Supervisor wiring, needs a file outside ownership.** In `candidate/authoring-loop.ts:29`, append `\n${AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT}` to the `flow` property description, and import it from `../plan/index.ts`. Without this the syntax works but the model is never told about it.
2. **Supervisor wiring, needs a file outside ownership.** Add the new authored codes to `AUTHORED_CODES` in `plan/issue-feedback.ts`, so their sentences reach the model the way `flow_script.duplicate_label` does: `flow_script.repeat_invalid`, `repeat_span_unknown`, `repeat_not_after_its_source`, `repeat_body_is_routed`, `repeat_body_branches`, `branch_into_repeat`, `repeat_while_never_ends`, `repeat_unavailable`. Exclude `invalid_binding`, whose message quotes the written value. Today the model gets code and `flow.line.N` only.
3. **Check whether my reading of the re-brief is correct.** It said "make candidate submissions run the existing draft-step loop and binding checks, which line 12 currently omits". Passing `draftSteps` would replace the submitted script with the draft path. I ran the same, single checker on the submitted graph instead.
4. **Legacy surface.** The parser and assembler are shared, so the legacy completion now also accepts `repeat ...:` lines and `$row`/`$input`/`$step` values, which it previously refused or kept literally. The legacy prompt never shows them, and no script that was accepted before changes meaning. The candidate-level graph checks (`written`) run only in `candidate/submission.ts`.
5. **File size.** `authoring/draft-routing.ts` is now 743 lines, under the 800-line limit but past the 400-line advisory threshold. If it grows again, split the script router into its own module.

## Map kept from the first pass (file:line, legacy loop shape)

- Draft relation: `flow-draft/routing.ts:64,74`. Draft routing to script steps: `authoring/draft-routing.ts` (`routeAutomationStudioFlowDraftSteps`). Assembly through `authoring/assemble-draft.ts:149` and `assemble.ts`.
- Row loop: head `success -> loop.branches`; listing array port `-> each.items`; `each.body -> first`; `each.done -> exit`; `each.item -> member.item` for row-taking members; last member `success -> loop.branches`, routed.
- Repeat while: head `success -> loop.branches`; `pass.body -> first`; `pass.done -> exit.branches`; last member `success -> loop.branches`, and each `branch`-role route `-> exit.branches`.
- Cycles are accepted only through `multiple` ports: `plan/validation.ts:200-203,383-385`.
- Bindings: `flow-draft/binding-forms.ts:206-247`. `$step` is rewritten to `$node.<key>` in `authoring/assemble-draft.ts` (`withNodeOutputReferences`).
