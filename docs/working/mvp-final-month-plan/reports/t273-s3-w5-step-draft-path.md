# t273-s3-w5-step-draft-path: the draft side of P5 `$step`

Worker: t273-s3-w5. Date: 2026-10-05. Tree: Core `fxwork/t273/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing was committed. There were no Lab, browser or provider calls.

## Outcome

Done. The four owned source files are wired as t270 specified (items 5, 6, 7 for the feedback text, and the t269-c4 paragraph for `draft-from-flow.ts`). Tests were written to fail first and now pass. The `R/flow-draft`, `R/llm/node-tools` and feedback suites pass, except for one failure in w4's in-progress `run-node.test.ts`. `fluxiq:check` and the structure audit fail, but only on w4/w6 files that are still in progress. Details are below.

## What changed and why

- `R/flow-draft/amendment/bind.ts`: `bind` now translates with `{ steps, at: step.position }`, so `{"$step": n, "output": o[, "path": f]}` is stored as `$step.<step id>.<o>[.<f>]`. Every refusal still returns `bind_malformed` with its `parameter`: `step_missing`, `step_not_earlier` (self or later), `step_not_usable`, `malformed`, or `step_binding_not_yet`, which can no longer occur here. No `bind_step_*` reasons were added, per the lead's decision. `nodeOf` is not passed because the amendment path has no node registry in scope, so assembly checks the output against the registry instead. The S1 `bindable` on `bind_new_key` is untouched. The doc comment now mentions `$step`.
- `R/flow-draft/entry.ts`: `stepLine` renders with `automationStudioFlowDraftRenderBindings(step.input, all)`. A `$step` binding now shows the position its source holds now, or `null` once the source is gone from the draft. The S1 `bindable` projection is untouched.
- `R/llm/draft-amendment-feedback.ts` `bind_malformed`: the sentence "cannot be bound yet" was replaced with t270's exact text: `{"$step": <n>, "output": <output id>}: n is a step before this one that worked and is not withdrawn, output an output its node declares, and "path" (optional) field names of a record output, never a list index.`
- `R/llm/node-tools/draft-from-flow.ts`: on re-seed, each node's `parameterValues` go through `rewriteAutomationNodeStatePaths` with a rewrite built by the new `stepOutputPaths`:
  - It turns `$node.<key>.<rest>` into `$step.<seed id>.<rest>`. The key is looked up with `automationNodeOutputReference`, then matched to a node by a unique `metadata.bootstrapSymbolicKey` across all of the Flow's nodes, the same way the executor matches it. The node is then mapped to its seed id through `stepIdOf`.
  - A key that no node carries, that two nodes carry, or whose node seeds no step (a control or framing node) is left as written. Assembly then refuses it with `flow_draft.step_binding_source_missing`.
  - A value with nothing to rewrite comes back by identity, so loop bodies are still kept byte for byte.
  - A header paragraph explains this.
- Tests:
  - `R/flow-draft/amendment/tests/apply.test.ts`:
    - The old "`$step` is malformed" assertion now uses a stray key (`extra: true`), because a valid `$step` is now accepted.
    - New: a bind of `{"$step": 1, "output": "records", "path": "name"}` on step 2 is applied and stored as `$step.d1.records.name` in both `ranWith` and `input`, and the instance keeps the concrete value.
    - New: a bind on self (2), a later step (3), a missing step (9) or a dropped step (1) is `bind_malformed` with `parameter: "query"` and changes nothing.
  - `R/flow-draft/tests/entry.test.ts`, new: a `$step` binding shows position 1, then 3 after a reorder that put the source third, then `null` when the source is gone.
  - `R/llm/tests/draft-amendment-feedback.test.ts` (~254): asserts the new sentence and the absence of "cannot be bound yet".
  - `R/llm/node-tools/tests/draft-from-flow.test.ts`, new describe:
    - A saved list node (key `s1`) and a type node reading `$node.s1.records.name` re-seed as `$step.f1.records.name`. That draft assembles with no error issues, and plan node 2 carries `$node.s1.records.name` again.
    - An unmapped key `$node.s9.records` is left as written, and assembly reports `flow_draft.step_binding_source_missing`.
    - A key that two nodes carry is left as written.

Files are LF in this working copy, not CRLF as the dispatch note said; I checked with `grep -c $'\r'`, which found 0 in every owned file. I kept LF.

## Commands run and observed results

All runs used `npx vitest run` from `packages/fluxiq`.

1. **Fail-first, before any source edit:** the four test files `R/flow-draft/amendment/tests/apply.test.ts`, `R/llm/tests/draft-amendment-feedback.test.ts`, `R/flow-draft/tests/entry.test.ts` and `R/llm/node-tools/tests/draft-from-flow.test.ts`. Result: `Test Files 4 failed (4)`, `Tests 4 failed | 153 passed (157)`. The four that failed:
   - `binds an earlier step's output under that step's id...`: got `{ applied: 0, refused: [...] }`.
   - `shows an earlier step's output at the position its step holds now...`: the stored `$state` was rendered as is.
   - `seeds the reference as the step its node became...`: the `$node` path was kept.
   - `names the parameter a refused bind was about...`: the text still read "cannot be bound yet".

   The refusal tests and the unmapped and duplicate-key tests already passed, because before this change they were refused or left untranslated anyway.
2. **The same four files after the source edits:** `Test Files 4 passed (4)`, `Tests 157 passed (157)`.
3. **`R/flow-draft`, `R/llm/node-tools` and `R/llm/tests/draft-amendment-feedback.test.ts`:** `Test Files 1 failed | 49 passed (50)`, `Tests 1 failed | 570 passed (571)`. The one failure is `run-node.test.ts > names the binding forms in the parameters description, for a written step only`, which expects `{"$step": <n>, "output": "<output id>…`.
   - That test belongs to w4: `git status` shows `run-node.test.ts` modified while `run-node.ts` is not yet changed, so it is w4's fail-first test.
   - I did not touch it.
4. **`R/llm/tests` and `R/flow-bootstrap`** (a wider check that the entry render change breaks nothing): `Test Files 109 passed (109)`, `Tests 1648 passed (1648)`.
5. **`pnpm --filter ./packages/fluxiq run check` (fluxiq:check):** exit 2, with 6 errors, none of them in my files.
   - `R/conversations/commands/tests/run-flow.test.ts` (36, 66): `paired` does not exist on `AutomationStudioConversationCommandContext`. That file is w6's.
   - `R/llm/evidence-loop/tests/authored-draft.test.ts` (642, 646, 651, 652): `Expected 1 arguments, but got 2`. That file is w4's: the new `binding` argument is not yet in `evidence-loop-decision.ts`.
6. **`node scripts/structure-audit.mjs`:** exit 1, `1 violation(s)`.
   - The violation is `[imports] R/tests/earlier-output/tests/loop.test.ts` importing `../../../llm/evidence-loop-decision.ts` instead of the barrel. That file is w4's.
   - It reported no violation in my files. `draft-from-flow.ts` is at 376 lines. The test files are past the 400-line advisory threshold (`draft-from-flow.test.ts` 434, `entry.test.ts` 431, `apply.test.ts` 672), which is a warning only.

## Not verified

- `fluxiq:check` and the structure audit have not been seen to pass with my files alone, because w4/w6 files are mid-flight. Rerun both once w4 and w6 land.
- No live path was exercised: no Lab, browser or provider run.
- `R/tests/earlier-output` (w4's) was not run by me.

## Open questions or contradictions found

- **Numbering inside one decision.**
  - The amendment rule says every number in one decision names the step as the model was shown it (`amendment/shown-numbering.ts`). `bind` reads `$step: n` against the steps' current `position`, as the brief specifies (`at: step.position`).
  - So a decision like `5 reorder to 2` plus a bind on another step with `$step: 3` reads n after the move, not as shown. Assembly still refuses a reader that does not run after its source, so this is never a wrong value, only a possibly confusing refusal or a different source.
  - The fix is about two lines in `amendment/apply.ts`: pass `shown` into `bind`, and build the context from shown numbers. That file is outside my ownership, so I did not change it.
- **`nodeOf` is not available on the amendment path.** A bind naming an output the node does not declare is accepted at bind time and refused at assembly (`flow_draft.step_binding_unknown_output`).
- **t270's open question about `automationStudioFlowDraftPlanNodeIds` assuming `s<index>`:** already addressed on dev. `planKeys` reads the keys against the plan and skips derived Merge and For Each nodes (C4, t269). I changed nothing there.
- **Re-seeding and the executor's key match.** `stepOutputPaths` matches keys across all Flow nodes, including routing nodes, the same way the executor's `idsByKey` does. So a key carried by a Merge maps to a node with no seed id, and the reference is left as written and refused at assembly.
- **The dispatch note said "files are CRLF".** In this working copy the owned files are LF.
