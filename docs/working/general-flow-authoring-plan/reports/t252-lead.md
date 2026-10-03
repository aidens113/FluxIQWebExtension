# Report: t252-lead

## Outcome

Partial. P1 (Core contracts) and P2 (web domain) are implemented and verified, uncommitted, in both t252 trees.
P3 (the test walker, the judge view, parity and the scripted proof) is blocked on merging dev into the t252 trees:
a hook refuses git history changes from the lead, so the merge commit must be the supervisor's.

## What changed and why

Design: `docs/working/general-flow-authoring-plan.md` (t251, copied here; Current State and briefs updated for t252).

- **Core** (`fxwork/t252/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`):
  - w1, P1a: `R/flow-draft/binding-forms.ts`, `binding-render.ts`, `flow-inputs.ts` (new); `step.ts` (`written`,
    `instance`; a written step is proposable), `amendment.ts` (`bind`), `entry.ts` (written, forms, inputs line,
    passes, authored instruction), `full-run-required.ts` (`not_reached`, `write` in the instructions), `index.ts`;
    `R/llm/draft-amendment-feedback.ts`; reason maps in `R/flow-bootstrap/evidence-loop-steps.ts` and
    `R/activity/wording/draft-edit-refused.ts`.
  - w2, P1c: `R/flow-bootstrap/authoring/draft-bindings.ts` (new; `row_binding_outside_loop`, `input_shadowed`),
    `assemble-draft.ts`, `normalise.ts`, `values.ts` (a `$state` object survives assembly on string and array
    parameters; before, it became a string or a one-element list), `index.ts`.
  - w4, P1b: `R/llm/node-tools/replay.ts` (mirrored names; replay calls take `item` and resolved parameters),
    `run-node.ts` (`write`, description, binding forms), `R/llm/evidence-loop/tool-execution.ts` and `call-record.ts`
    (`outputs`, `draft.written`), `R/llm/evidence-loop-decision.ts` (write implies add; forms translated for a write;
    `run_node.binding_needs_write` for a live call; policy and `add` texts), `decision-refusal.ts` and
    `R/llm/unusable-decision.ts` (named refusal codes and their tellings), `R/llm/harness-options/bootstrap-completion.ts`
    (`DRAFT_SCRIPT_NOTE`), `R/llm/deepseek/tests/system-prompt-pins.json` (policy pin).
- **Downstream** (`fxwork/t252/!FluxIQWebExtension`), w3, P2: `domain/src/output-nodes/targets/row-scope.ts` (new,
  `scopedToRow` moved, stale comment fixed), `native-runtime.ts`; `domain/src/runtime/llm-evidence/node-run/`
  `written-step.ts`, `node-call.ts` (new), `run.ts` (write mode: checks and handle resolution, no gateway action, no
  permission request, `core.run_node.written`), `replay.ts` and `verify.ts` (row scope from `item`),
  `replay-answer.ts` (`outputs.records`), `capture.ts`; `plan-resolution/state-binding.ts` (new, `$state`
  pass-through); `system-instructions/instructions.ts` (`web-4`).

## Commands run and observed results

- Core: `npx vitest run` over flow-draft, flow-bootstrap/authoring, llm/tests, llm/node-tools, llm/evidence-loop,
  llm/harness-options, llm/deepseek tests -> "Test Files 114 passed (114)", "Tests 1191 passed (1191)".
- Core: `pnpm --filter fluxiq check` -> clean (build-cache reuse: inputs match the passing stamp).
- Core: `node scripts/structure-audit.mjs` -> "structure-audit: passed (226 warning(s), 349 baselined)".
- Core: `recorded-windows.test.ts` "everything-store-run4" -> 1 failed in the t252 tree, and still 1 failed with w2's
  four files and two new files put back to HEAD (w1 showed the same for its files); passes on main dev `d401eeaa`,
  which carries t253's fixture fix. Pre-existing on the base `424a70b3`; the merge resolves it.
- Domain: w3's scratch runner over 49 test files beside the changes (`DOMAIN_TEST_BUILD_LABEL=t252-lead`) ->
  "# tests 390 # pass 390 # fail 0"; `pnpm --filter @fluxiq-web-extension/domain check` -> rc 0.
- Downstream audit -> README out of date (new document); `pnpm structure:baseline` -> "structure-audit: passed
  (160 warning(s), 118 baselined)".
- `git stash push -u` in the Core tree -> refused by hook: "workers must not change git history".

## Not verified

- P3 entirely: no test yet runs a loop per row, so the walker, `passes`, `not_reached`, the judge view and the step
  log screening are unbuilt. No parity or proof test yet.
- Core and domain together end to end; the extension and test-runner typechecks against a rebuilt t252 Core.
- Whole suites (not run, by rule); no live runs (held by the user).

## Open questions or contradictions found

- **Merge needed (supervisor).** In each t252 tree: keep the uncommitted t252 edits (stash, or commit them as a
  t252 step first), merge dev with a `Task: t252` trailer, restore the edits. Files both sides changed: Core
  `runtime/flow-draft/full-run-required.ts`, `runtime/llm/deepseek/tests/system-prompt-pins.json` (regenerate the
  pin from the merged policy text); downstream `domain/src/runtime/llm-evidence/node-run/replay.ts`,
  `replay-answer.ts`, `run.ts`, `tests/replay.test.ts`. The lead resolves the rest and re-runs the P1/P2 checks.
- Lane D brings domain-declared `rowContextKeys` and per-item `at`: it will meet w3's move of `scopedToRow` into
  `targets/row-scope.ts` and w1's `draft-amendment-feedback.ts`; reconcile on "lane D landed".
- w3: `outputs.records` holds whole page-text rows; w6 must keep them out of the model, the judge and the step log.
- w4: whether a pass with an `item` still sends `produced`; a `rerun` patch holding a binding skips the needs-write
  check (decide in w5).
- `R/flow-draft/amendment.ts` is 552 lines; the `bind` logic could move to its own module.
- Directory limits: downstream `node-run/` and `node-run/tests/` are at 25 files; Core `R/llm/evidence-loop/` at 25.
