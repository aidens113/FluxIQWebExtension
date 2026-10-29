# t792 fix1: toggle ties (Core)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t792/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Both rules from debug `run-mvswfjbq-d0a95f6e` fix 1 are in place, and both named tests failed first and now pass:

1. When an exploration press hits a control this build already flipped, it runs with `ensureState` set to the earliest tied press's signature.
2. When a plan step is tied to presses that disagree, the earliest press's signature is the one the step takes.

## What changed and why

- **New `R/flow-bootstrap/script-statements/toggle-tie.ts`** exports `automationStudioExploredToggleTie(tie, explored)`. It returns the earliest recorded press tied to a step or call, so both rules use one tie. A press is tied when all of these hold:
  - it ran the same node;
  - it shares a handle, or its whole canonical target is equal, or (for steps only, via `ref`) a trial node id ends with `.<ref>`.

  It now owns the `canonical` helper that used to be private in `toggle-idempotent.ts`. The barrel `script-statements/index.ts` exports it, with a t792 comment.
- **`R/flow-bootstrap/script-statements/toggle-idempotent.ts`**:
  - The `[...input.explored].reverse().find(...)` call is replaced by `automationStudioExploredToggleTie(...)`, so the earliest tied press decides and a later opposite press is treated as a reversal.
  - The header comment now says "The earliest such press decides (t792)" and cites the run.
  - The private `canonical` is removed (it moved to `toggle-tie.ts`).
  - The `idempotentWith` refusal, the `takesEnsureState` guard and the removal of model-written `ensureState` are unchanged.
- **`R/flow-bootstrap/action-permissions.ts`**:
  - **New helper.** Private `heldToToggle(toolId, value, exploredToggles)` plus a local `RUN_NODE_TOOL_ID` const. For a `core.run_node` call it finds the earliest record in `exploredToggles.list()` tied by the call's `parameters.target.handle` or its whole `parameters.target`. It then returns the input with `parameters.ensureState` set to a clone of that record's signature. Any other call comes back unchanged.
  - **Gates that use it.** Both the no-site-reset path and the candidate (site-reset) path run, and record, the held value. In the candidate path the held value is used only when the claim is not an undo, so an undo keeps going through the existing undo/reset path unchanged.
  - **Header.** It gained a paragraph saying all of this.
- **`R/flow-bootstrap/explored-toggles.ts`: not changed at all.** `trial()` and `explored()` keep their signatures and behaviour. Records stay in push order, which the earliest rule depends on.
- **Tests:**
  - `script-statements/tests/toggle-idempotent.test.ts`:
    - New test "two tied presses with opposite signatures give the step the first one's". It uses a notes board's Pin/Unpin control, with three sets of records: [pin, reversal], [pin, reversal, trial-pass reversal] and [pin, trial-pass reversal].
    - The existing first test encoded the newest-press rule. I renamed it to "takes the earliest matching press..." and changed its expectation to the first record's signature.
  - `tests/action-permissions.test.ts`, new describe "an exploration press on a control this build flipped":
    - "a second exploration press on a control this build flipped is run with its ensureState". It re-presses by handle and by resolved target: both answer `already_in_state`, the control stays pinned, and nothing new is recorded. Another handle and another node get no `ensureState`.
    - "holds a candidate build's press the same way, and leaves an undo of its act unchanged". It uses a stubbed site reset: the undo runs without `ensureState` and flips the control back.

## Commands run and observed results

- **Fail-first** (source unchanged, new tests in place), under the lock: `pnpm test -- .../toggle-idempotent.test.ts .../action-permissions.test.ts` -> `Tests 4 failed | 39 passed (43)`. The 4 were the two new tests, the renamed earliest-press test and the candidate-path test. Each failed as expected: wrong signature, or no `already_in_state`.
- **After the change**, under the lock:
  - The same files plus `explored-toggles.test.ts` -> `Test Files 3 passed (3)`, `Tests 50 passed (50)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- **Acceptance**, under the lock:
  - `pnpm test -- src/programs/automation-studio/runtime/flow-bootstrap/script-statements/ src/programs/automation-studio/runtime/flow-bootstrap/tests/` (from `packages/fluxiq`) -> `Test Files 31 passed (31)`, `Tests 338 passed (338)`, `[vitest-groups] all groups passed: parallel, real-sql`, `TEST_RC=0`.
  - `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` (packages/fluxiq) -> no output, `TSC_RC=0`.
- **`pnpm structure:check`** (Core root) -> `structure-audit: 3 violation(s) across 2 rule(s)`, exit 1. None of the three is in a file I touched:
  - `[directory-files] service/project-build/`: 26 files.
  - `[directory-files] service/project-build/tests/`: 35 files.
  - `[imports] service/project-build/tests/zz-t792-scoped-copy.ts`: 9 barrel-skipping imports. This is another worker's scratch file.

  For my files there was no import-cycle or imports failure, including the new barrel import in `action-permissions.ts`. The only warnings for my files are advisory:
  - `action-permissions.ts` is 742 lines (above the 400 advisory, under the 800 limit);
  - `script-statements/` has 22 files (above the 15 advisory, under the 25 limit).

## Not verified

- **Domain behaviour.** I did not check in the domain that an exploration `core.run_node` of `web.output.dom-click` carrying `ensureState` skips and answers `already_in_state`. The domain's `web.dom.click` declares `ensureState`, and its dispatcher handles it. The tests use a stand-in domain.
- **`takesEnsureState` at the gate.** The gate does not check it: it holds any node a toggle record ties to. The web domain answers `toggle` only for `web.output.dom-click`, which declares the parameter. A domain that answered a toggle for a node without it would receive an undeclared key. I did not add that input, because its callers are `service/project-build/brief-ports.ts` (must not touch) and `service.ts`.
- **No live run** and no model calls.

## Open questions or contradictions found

- **Handle-only ties.** A tie by handle alone could tie a different control that reuses the same handle token on another page. The effect is limited: `ensureState` only stops a press toward a state the control already shows. The plan-step rule already ties by handle the same way.
- **Draft steps.** An exploration press made with `add: true` now records `ensureState` in its draft step's parameters. Plan submission (`toggle-idempotent`) strips and re-derives it from the same earliest record, so the result should agree. I did not trace every draft-to-plan path.
- **Judgement call from the debug, left as is.** An item that was already in the asked state before the build, and whose first press flipped it the wrong way, is still taught wrong.
- **Not my files.** `structure:check` currently fails on other workers' `service/project-build` files.
