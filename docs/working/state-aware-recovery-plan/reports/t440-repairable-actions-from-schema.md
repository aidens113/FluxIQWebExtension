# t440: every element-taking action is repairable in-run

## Outcome

Done. The list of actions a repair can re-point is now worked out from the action schemas instead of being kept by hand. Set Checked (`web.output.dom-check`), Upload (`dom-upload`), Scroll (`dom-scroll`) and Assert (`dom-assert`) are now repairable. Before, the hand-kept table left them out, so their repairs were refused with `action_not_repairable`.

## What changed and why

- `domain/src/runtime/llm-evidence/repairable-parameters.ts`
  - The hand-kept `ELEMENT_ROLE_BY_DEFINITION_ID` record is gone. It is replaced by:
    - `ELEMENT_ROLE_BY_ACTION_TYPE`, typed `Record<WebAutomationActionType, Role | null>`. It must list every action, so a new action will not compile until someone gives it a role or `null`.
    - `ELEMENT_ROLE_BY_DEFINITION_ID`, a Map built from `webAutomationActionDefinitions`. It takes every action whose `parameterSchema.properties` has `element`, keyed by `webAutomationOutputNodeId`. If an action takes an element but its role is `null`, the module throws when it loads.
  - Roles:
    - check → `clickable` (pressing it sets the state)
    - upload → `clickable` (see open questions)
    - scroll and assert → `observable`
    - existing actions keep their roles
  - `webRepairableParameters` now uses `Map.get`. That keeps the inherited-name safety the old `Object.hasOwn` check gave.
- `tests/repairable-parameters.test.ts`, two new tests:
  - Builds the set of element-taking nodes from schemas that have `element` plus output nodes with `metadata.elementTarget === true`. It asserts each one offers exactly one required `element` parameter, and that every other output node offers none. This is the mechanical guard.
  - Checks the roles for check, upload, scroll and assert. Also checks that a recorded action (`builtin.policy.action`, output `web.dom.check`) is offered `element`.
- `target/tests/override.test.ts`, one new test: a Set Checked override with a handle the model was shown resolves to `#gift`. It covers both the `web.output.dom-check` node and `builtin.policy.action` with `outputId: web.dom.check`.
- `target/override.ts` was not changed. It did not need to be.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t440 node scripts/test-domain.mjs llm-evidence/tests/repairable-parameters llm-evidence/target/tests`
  - Printed `# tests 51 / # pass 51 / # fail 0`. The new tests passed: ok 39, ok 44, ok 45.
- `pnpm --filter @fluxiq-web-extension/domain check` (both tsc passes)
  - Printed no errors. The build-cache line read `"step":"domain:check","reason":"no stamp; ..."`.
- `node scripts/structure-audit.mjs` (worktree root)
  - Printed `structure-audit: passed (184 warning(s), 651 baselined).` None of the warnings are for the changed files. `override.test.ts` is now 388 lines.

## Not verified

- I did not run the old code against the new tests. It is clear by reading that the old table had no `dom-check`, so the first test's length assert would have failed.
- No live run. No wider domain test suite.
- Whether the scroll and assert DOM outputs actually read the repaired `target`. Both have the `target` parameter (`output-nodes/definitions.ts` gives them `selectorParameters`), but I did not trace their execution.

## Open questions or contradictions found

- Upload's role is `clickable`, and that role also accepts buttons and links. A tighter `uploadable` role (`input[type=file]`) would need `target/candidates.ts` `ROLES` changed too, and that file is outside this brief. I did not add it. A safe follow-up: export the role list from `repairable-parameters.ts`, have `candidates.ts` import it, and add `uploadable`. For now the kind check in `target/equivalence.ts` against the recorded control is the only thing that would tell a file input from a button.
- F1 in the r4a-4 report says to assert against `written-literals.ts` `ELEMENT_REQUIRED_NODE_IDS`. That set is not exported, so the test builds the wider set itself (schema `element` ∪ `elementTarget`). That set includes everything with a required selector.
