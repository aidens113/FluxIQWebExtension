# t194-w72: a re-author tests the steps it carries as the Flow keeps them

## Outcome

Done. All changes are in the Core tree. If a stored node kept its declaration (`metadata.declaredConsequences`, t252 D5), the re-author now seeds its carried step with `ranWith` and `replay`. The gate does not list such a step as `not_run_in_this_build`, and the build test replays it exactly as stored, through the permission gate, with the step's own declaration. A carried step the model changes (bind, or settings) has to run again. A node with no declaration is seeded exactly as before.

I also fixed one thing beyond the brief: a carried Merge could never stop being `not_run_in_this_build`. See "Open questions".

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime/`

- **`R/llm/node-tools/draft-from-flow.ts`** (seed):
  - `asStored()`: for a node whose `metadata.declaredConsequences` is a list of strings (`[]` included), the seed now writes:
    - `ranWith = {node, parameters: stored parameterValues, consequences: declaration}`
    - `input` gets the same declaration, so the re-authored Flow keeps it, because `draft-step.ts` writes consequences from `input`
    - `replay = {from: startPages[node.id]}` where the run recorded a start page, otherwise `{}`
  - Any other node: only `{node, parameters}` on `input`, exactly as today.
  - New exports:
    - `automationStudioFlowDraftStepCarriedChanged`: carried, and it has `settings` or `instance`. `instance` is set by `bind`.
    - `automationStudioFlowDraftStepCarriedNotRun`: carried, and it has no `ranWith`, no `replay`, or it was changed.
    - `automationStudioFlowDraftCarriedJoinsPassed(executeTool)`: wraps an executor so a `step`/`verify` replay call naming `builtin.control.merge` is answered by Core as `core.replay.replayed`, with Core's words. The call never reaches a domain or the permission gate.
  - Header rewritten. It explains why `replay.from` now holds the start page, and why every reader reads it correctly (next bullet).
- **Readers of `replay.from`, checked, no change needed:**
  - `replay-draft.ts`: reset and reanchor.
  - `flow-draft/verify-only.ts`: `StepMovedTarget` compares consecutive `from` values.
  - `instructed-acts/object-binding.ts` and `quantity-fault.ts` `samePress`.
  - All of them read `from` as "where the step found the target". A node's start page in the run being repaired means exactly that.
- **`R/llm/node-tools/dry-run-gate.ts`:**
  - `cannotRun` now also counts `CarriedNotRun` (changed carried steps).
  - `unrunnableWord` uses the same predicate.
  - The replay is given `CarriedJoinsPassed(input.executeTool)`.
  - Header paragraph added.
  - Optional carried steps keep their `optional` routing, so they are excused or remembered exactly as the build's own optional steps are. I did not exercise this with a failing replay; see "Not verified".
- **`R/flow-bootstrap/unfinished-build/not-run.ts`:** restates the same rule (it cannot import node-tools because of a module cycle): carried, proposed, and (no `ranWith`, no `replay`, `settings` or `instance`). A test holds the two rules to the same answer.
- **`R/llm/node-tools/run-flow-part.ts`:** the executor is wrapped with `CarriedJoinsPassed`, so a part run passes through carried joins instead of stopping on them.
- **Words (today's `not_run_in_this_build` sentences are kept unchanged):**
  - `R/flow-draft/full-run-required.ts`: adds "A step carried from the Flow being changed that is not listed here is tested as the Flow keeps it, and is not rerun." and "It is listed because the Flow kept no consequences for it, or because you changed it since, so it no longer stands as the Flow kept it."
  - `R/recovery/refuted-result/brief.ts`: NOT_RUN_LINES now say:
    - carried steps are tested as the Flow keeps them;
    - rerun only a step you change and any step the test lists as `not_run_in_this_build`;
    - then complete.
    - READ_STEPS 5 and ACT_STEPS 5 say the same.
  - `R/llm/evidence-loop/resume.ts`: `notRunRepairInstruction` adds "Every other step carried from the Flow is tested as the Flow keeps it and is not rerun: rerun only these/this one, and a step you change, which no longer stands as the Flow kept it."
- **Tests:**
  - New: `R/llm/node-tools/tests/carried-as-stored.test.ts`, 11 tests on run musp39u8's seven nodes:
    - no carried step is listed, and the completion is tested: reset plus steps 1, 2, 4, 6 and 7 are sent, the joins are answered by Core, and all seven are `replayed`;
    - each step is sent exactly as stored, with its declaration and its start page;
    - a lasting declaration produces a `verify` call;
    - a node without a declaration is still listed (step 6 only);
    - a first step with no recorded start page is refused as `cannot_run_again`;
    - bind and settings each make the step need its own run;
    - a rerun that took the step's place gets tested;
    - routing changes (optional) leave the step as stored;
    - a part run passes through the joins;
    - the predicate held equal to `not-run.ts`.
  - Added to `draft-from-flow.test.ts` (6 tests), `full-run-required.test.ts` (1) and `resume.test.ts` (1).
  - Updated: `brief-rerun-carried.test.ts`.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq`.

- **Failing first:** `npx vitest run .../node-tools/tests/carried-as-stored.test.ts .../node-tools/tests/draft-from-flow.test.ts` before the source change printed `Tests 15 failed | 20 passed (35)`. Examples:
  - `expected [ 1, 2, 3, 4, 5, 6, 7 ] to deeply equal []`
  - `expected 'core.run_flow.stopped' to be 'core.run_flow.ran'`
  - After the change: `Tests 35 passed (35)`.
- **Brief words:** `brief-rerun-carried.test.ts` printed `2 failed | 5 passed` before the change and `Tests 47 passed (47)` after (whole refuted-result dir).
- **Resume words:** `resume.test.ts` printed `2 failed | 21 passed (23)` before and `23 passed (23)` after.
- **Full-run-required words:** that test was written after the source edit, so it was not watched failing.
- **Validation run:** `npx vitest run R/llm/node-tools R/flow-draft R/flow-bootstrap/unfinished-build R/recovery/refuted-result R/llm/evidence-loop R/tests/deepseek-bootstrap R/llm/tests/evidence-loop-seeded-draft.test.ts R/llm/harness/tests/draft-screen.test.ts R/llm/harness-options/tests/inherited-plan-nodes.test.ts` printed `Test Files 101 passed (101)`, `Tests 825 passed (825)`, Duration 109.81s. That includes deepseek-bootstrap, so there are no failures to report from it.
- **Typecheck:**
  - `npx tsc --noEmit -p tsconfig.json`: first run had 1 error, in my own test (`ranWith: undefined` under exact optional types). After the fix: 0 errors.
  - `carried-as-stored.test.ts` rerun: 11 passed.
- **Structure audit:** `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (240 warning(s), 349 baselined)`. The only warning on my files is advisory: `dry-run-gate.ts` is 494 lines (it was already 478, past the 400 threshold). `draft-from-flow.ts` is 398 lines.
- **Not needed:** domain `replay.ts` is unchanged, so the Core build (`heavy.sh`) and the downstream `narrow-tests.mjs` were not run.

## Not verified

- **No live run.** I did not check that the web domain's `replay: "step"` actually resolves stored selector/`element` parameters for click and type. That was the brief's stated premise (from the `node-run/replay.ts` header: it runs the kept, resolved parameters through `resolveWebPlanNode`). No domain test was run for it.
- **Optional carried steps on a real page.** The rule is the existing one for `optional` routing, but none of my tests made a replay fail on an optional carried step.
- **The unfinished-round path** (`judgement.ts` with the caller's `replayable`) was not run with a seeded draft; it now sees joins and declared steps as replayable.
- **Full suites** (`pnpm check` and the like) were not run, per policy.

## Open questions or contradictions found

1. **Carried Merges (beyond the brief).** In run musp39u8, steps 3 and 5 were `builtin.control.merge`, listed `not_run_in_this_build` (see `steps/0291-decide`). The assembler derives Merges (`draft-routing.ts`, `mergeStep`), so they never have a declaration, and the domain cannot run them (`node_not_runnable_here`). Without a fix, those two steps would have kept every re-author untested even with declarations on all other nodes. I seed a Merge with Core's own `consequences: []` (its `input` is unchanged) and answer its replay in Core through `automationStudioFlowDraftCarriedJoinsPassed`, applied in the gate and in `run-flow-part`. This also applies to Flows built before t252. Two known gaps:
   - `step-place.ts`'s put-back (not mine) uses its own executor, so a join there would go to the domain. It never does in practice, because a join has no `replay.from`, which breaks the same-page run.
   - In the replay, a join's outcome is `replayed`. So a step right after an excused optional step and its join is not re-anchored the way it would be in a fresh build, where the join is not a step (`leftUndone` reads the previous outcome).
   - Cleaner long-term home: `replay-draft.ts` skipping Core control nodes (not mine).
2. **First carried step with no recorded start page.** In the bundle's `flow-lane.json`, the navigate node (s1) has no `beforeAction` evidence packet, so it may have no start page in the run record. If so, the test refuses step 1 as `cannot_run_again` until the model reruns the navigate once. A navigate has no element target, so that rerun works. Whether the real run record has `stateRefs.beforeAction.from` for s1 is unverified.
3. **The brief is composed before the seed.** Its caller is `service/runtime-adaptation/refuted-result-port.ts` (not mine), and `brief.ts` cannot tell whether the Flow kept declarations. So one set of words covers both cases. For a pre-t252 Flow the model is no longer told up front to rerun every step; it learns which ones from the first refusal, which costs one decision.
4. **"Changed" is detected through `settings` or `instance`.** If a stored node's parameters already held a binding, `bind` does not set `instance` (`amendment.ts:490`), so a further bind on it goes undetected.
5. **A changed carried click or type still cannot be rerun live** (`target_not_a_handle`). The model has to run the node again on the live page and drop the carried one. None of the words say this yet; this may belong to whoever owns the rerun words.
