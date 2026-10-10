# t413: a step's `done when:`, and proof the Lab stops the extension's worker (worker report)

## Outcome

Done, with one gap outside my files (open question 1).

- A candidate-script step can now carry its own `done when:`. It becomes the node's expected state as page facts.
- When a lasting act's outcome is unknown, the effect check and the transition comparison read those facts through the batched fact check (C9).
- Row 11's Flow says what the page shows once Add to cart worked.
- The stop-service-worker perturbation now proves the stop, using the worker's own global scope.
- Row 11 was run headed and provider-free in the t413 tree: **passed**. Core reported `succeeded`, the cart holds **3 pieces from 1 add** (1 cart line, coupon held), and there were 0 model calls.

## What changed and why

Core (`packages/fluxiq/src/programs/automation-studio/runtime/`):

- `flow-bootstrap/authoring/parse.ts`, `contracts.ts`: `AutomationStudioFlowScriptStep.done`.
  - A `done when:` line belongs to a step when another line of that step follows it, for example when it is written right under the step line, before `node:`.
  - Anywhere else it stays the block's or the handler's, as before: before any step, or after a step's last line (followed by `end`, a block statement, the next step or the end of the script). The order of lines decides; indentation means nothing.
  - So every existing part or handler `done when:` keeps its meaning. This includes the format examples and t388's tests, which put the line after the last step.
- `flow-bootstrap/script-statements/step-done-when.ts` (new, exported from the barrel): `automationStudioFlowScriptWithStepDoneWhen`.
  - Uses the same fact grammar (handles, `at "<locator>"`, dialog facts).
  - Writes `expectedState: { facts: [...] }`.
  - Refuses at the `done when:` line, using the existing code `flow_script.fact_invalid` (why that code: open question 2), in these cases:
    - a step that does not act (`metadata.effect: "observe"`, a records read, a check, or a Core node other than Run Output or database);
    - a `call:` step;
    - a node with no `expectedState` parameter;
    - a step that also writes `expectedState` by hand.
- `flow-bootstrap/authoring/assemble.ts`: calls the new function inside `buildNode`'s `normaliseAuthoringNodeParameters` call. The file stays at exactly 800 lines; the structure audit fails above 800.
- `flow-bootstrap/script-statements/flow-requires.ts`: a step's expected-state facts make the Flow declare `web.facts@1`.
- `flow-bootstrap/plan/flow-script-format.ts`: one rule with a one-line example, and no Lab words. "Give a step that commits something (a press, a submit, a choice) its own `done when:` right under its `step` line, before `node:`, so if its answer is lost the run checks the page instead of giving up: `done when: text t9 contains "Saved"`."
- `executor/defensive/effect-check.ts`: `AUTOMATION_STUDIO_EXPECTED_STATE_FACTS_KEY = "facts"`, plus the documentation for it.
- `executor/transition-comparison.ts`:
  - A `{ facts }` expected state goes through `observeAutomationStudioFacts`, never the expectation evaluator.
  - The facts are read again every 500 ms until they hold, or until the node's wait ceiling passes (the effect check also respects any declared `timeoutMs`). A host that was not asked, or that failed, is not asked again.
  - Effect check: `true` → `landed`, a `false` left at the end → `not_landed`, anything else → `unknown`.
  - Comparison: a succeeded attempt is accepted when all facts are true and rejected (`expected_state_missing`) when a fact is still false at the end. When nothing settles, the attempt is left untouched.
  - A failed attempt is read once and gets `expectationSatisfiedAfterFailure`.
  - On item 2: the uncertain-act path already existed after t409 (`step-loop/failed-attempt.ts`). The gap was that it could read only the evaluator's conditions. This fills that gap; nothing in `step-loop/` changed.

Downstream (`packages/test-runner/src/`):

- `recovery-matrix/flows/hub/cart.ts`: the add-to-cart step now has `done when: text at "[data-testid=mini-cart-count]" is "Cart (3)"`.
  - This is the mini-cart flyout's count. It is hidden until hovered, but `innerText` of a `display:none` element still returns its text.
  - It is the same Flow as row 1.
- `perturbations/stop-service-worker.ts`: why round 1's watch could not decide whether the worker stopped, and the fix.
  - The cause: Chrome lists the successor under the stopped worker's own target id, so the target list cannot tell a restart from no stop.
  - The fix: the worker's `performance.timeOrigin` is read just before the stop (`worker.instance`) and again from every listed worker while watching. Each read attaches to the target over CDP without flattening, sends one `Runtime.evaluate`, then detaches.
  - An origin that none of the stopped workers had is recorded as `worker.restarted`, which proves the stop.
  - The stopped worker's own origin answering after the close is recorded as `worker.still-running`, which shows the stop did not take.
  - My first try read the origin through Playwright worker handles. In row 11 run `rmx-2026-10-10T08-51-29-821Z-d17662`, Playwright never handed out a handle for the successor, so no restart was seen (`watch-ended restarted:false`). The second try switched to CDP and worked.
  - The stop mechanism itself (`Target.closeTarget`) was fine. Only the observation was broken.
- `perturbations/check/run-perturbation-check.ts`: the check is proven only when `worker.restarted` is recorded and `worker.still-running` is not.

## Commands run and observed results

- Core `npx tsc --noEmit ...` (packages/fluxiq) → exit 0.
- Core `node scripts/structure-audit.mjs` → `passed (320 warning(s), 1160 baselined)`. New advisory warning: `transition-comparison.ts` is 423 lines, past the 400-line advisory threshold.
- Core vitest over the changed directories, last run: `flow-bootstrap/authoring/tests`, `script-statements/tests`, `plan/tests`, `executor/defensive/tests`, `executor/tests/effect-check`, `executor/tests/transition-comparison.test.ts` → 49 files, 587 tests passed.
  - `flow-bootstrap/candidate` and `authoring-result` tests → 14 files, 150 passed, after the refusal code was switched (open question 2).
  - The new and changed tests were re-run after the final edits → 8 files, 107 passed.
- New Core tests:
  - `script-statements/tests/step-done-when.test.ts` (11 tests): line placement, the expected state, `requires`, the block check beside a step check, refusals at their line.
  - `executor/tests/effect-check/tests/expected-facts.test.ts` (7 tests): true → no second act; late page → still landed; false → ordinary retry; unknown and no fact host → Outcome uncertain; the expectation evaluator is never asked; comparison accept and unknown.
  - 3 more tests in `executor/tests/transition-comparison.test.ts`: rejection after a 2,000 ms wait, accept and unknown, a failed attempt's metadata.
- `pnpm --filter fluxiq build` in the Core tree → built (63 s).
- test-runner `pnpm run check` → exit 0, re-run after the final edit. `pnpm run build`, then `node --test dist/perturbations/tests/*.test.js dist/recovery-matrix/flows/tests/*.test.js` → 25/25. `stop-service-worker.test.js` → 4/4 (2 of them new). `dist/recovery-matrix/**/*.test.js` → 45/45.
- Downstream `node scripts/structure-audit.mjs` → `passed (184 warning(s), 651 baselined)`.
- `FLUXIQ_TEST_ENV_FILES=none node dist/perturbations/check/cli.js --kind stop-service-worker` (headed, social-network-feed) → `proven: true`.
  - Event sequence: `worker.instance {read:1}` → `worker.stopped` → `worker.gone` (+0.26 s) → `worker.started {sameTarget:true}` → `worker.restarted {afterMs:1049, sameTarget:true, stillRunning:false}`.
  - Core answered `unknown` ("interrupted ... not made again"); `siteTookTheAct: true`.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 11` (headed, provider-free):
  - First run, `rmx-2026-10-10T08-51-29-821Z-d17662` (Playwright-handle observation): verdict passed; run succeeded; `pieces 3, adds 1`; watch ended `restarted:false`.
  - Final run, `rmx-2026-10-10T08-59-37-514Z-2494d1`:
    - Verdict **passed**, run `succeeded`, 16 attempts.
    - Site: `{pieces:3, adds:1, couponHeld:true, cartLines:1}`.
    - Accounting: 0 model calls. Measures: `duplicatedActs 0`, `trueFailures 0`, `closedWithoutModel 1`.
    - s15 (add to cart, `lasting:true`) had one attempt, `ambiguous_or_unknown/web.action.unknown`, projected as held (`status: succeeded`). It was never dispatched again.
    - Perturbation events: `worker.instance {read:1}` → `worker.stopped` → `worker.gone` → `worker.started {sameTarget:true}` → `worker.restarted {afterMs:1563, sameTarget:true, stillRunning:false}`.

## Not verified

- The attempt's `effectCheck: { result: "landed" }` is not in the matrix bundle: the attempt records do not carry it, and the passed case's workspace was removed. "Landed through the facts" is inferred: a lasting act failed as unknown, it was not repeated, and the run succeeded with no model call. That outcome is only reachable through the effect check or the ladder's satisfied rung, and both read the facts.
- A step `done when:` naming a **handle** has not been checked through real domain resolution (open question 1). Only locator facts and Core's stand-in resolver were exercised.
- No full suites and no paid runs. Row 1, which shares HUB_TO_CART, was not re-run with the new `done when:`. Row 11's run passed s15 with it, so the comparison accepted `Cart (3)` there; rows 4, 5 and 6 use other Flows.
- The extension chat was not reviewed. Firefox was not run.

## Open questions or contradictions found

1. **Gap outside my files: handle facts in a step `done when:` will be refused by the web domain at bootstrap.**
   - The cause:
     - `llm/harness-options/plan-fact-targets.ts` collects fact targets only from handler parameters, entry and checkpoint metadata, and the success check.
     - A handle inside a node's `parameters.expectedState.facts` therefore reaches the domain as part of the node's own parameters.
     - The domain's `resolve-plan-node.ts` refuses a handle outside its slots as `web.handle.misplaced`.
   - The fix is three lines, in that file's `subflow.nodes.forEach` callback, for every node:
     `const state = node.parameters?.expectedState; if (state && typeof state === "object" && !Array.isArray(state)) collect(state.facts, \`${nodeAt}.parameters.expectedState.facts\`, ref);`
   - Fact sites are resolved and replaced before node resolution, so the domain would never see the handle.
   - Until this lands, a model following the new format rule with a handle gets its node refused.
2. **Refusal code.** I first used a new code, `flow_script.step_done_when_invalid`. The corpus guard `flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts` (not my file) requires a corpus case for every new code, so the refusal now uses the existing `flow_script.fact_invalid`. Its message names the actual problem ("is on a step that does not act ..."). If a dedicated code is wanted, add one corpus line there.
3. **When the facts are false.** A succeeded attempt whose `done when:` is still false after the wait ceiling is demoted to failed, then judged by the effect check, as the brief specified: `false` means `not_landed`, so the act is made again. An author's wrong fact can therefore repeat a committing act. This is the same as the existing expectation-condition path, but it is now reachable from model-written lines.
4. `transition-comparison.ts` is now 423 lines, past the 400-line advisory threshold (not a hard limit).

## Revision after the coordinator's review (two changes before merge)

1. **Safety: a step whose act answered success is never pressed again because its `done when:` is still false.** This closes open question 3.
   - `transition-comparison.ts`: a succeeded attempt whose facts stay false is now failed with `AUTOMATION_STUDIO_EXPECTED_FACTS_FALSE_FAILURE` (`expected_state_missing`, `core.step.done_when_false`, stage `verification`, defined in `defensive/effect-check.ts`). It is no longer an unknown outcome.
   - `defensive/assess.ts` (only this rule): that failure on a lasting act is refused, with no `actUncertain`. So no effect check runs and no retry happens; it is a true failure, which goes to in-run repair or an honest end. A step that declared `consequences: none` falls through to the existing gates and gets an ordinary retry.
   - The effect check (used only when the outcome is genuinely unknown) now answers `false` with `not_landed` only for an act that does not last. For a lasting act it answers `unknown`, so the run stops as Outcome uncertain.
   - New and updated tests:
     - `expected-facts.test.ts` (9 tests):
       - a lasting press that answered success with false facts is pressed once, fails with `core.step.done_when_false`, has no `effectCheck`, and is not Outcome uncertain;
       - a lost reply with true facts carries on with no second press;
       - a lost reply with false facts on a lasting act stops as Outcome uncertain with one press;
       - the same on a non-lasting step is retried.
     - `defensive/tests/assess.test.ts` (+2): the lasting case is refused with no `actUncertain`; the `consequences: none` web step is retried.
2. **The handle gap is closed.** This closes open question 1.
   - `llm/harness-options/plan-fact-targets.ts` now collects `parameters.expectedState.facts` on every node as fact target sites. They are resolved before node resolution.
   - Tests in `plan-fact-targets.test.ts` (+2), against a stand-in domain that refuses any handle in a step's parameters as misplaced:
     - the fact resolves; the step is asked with no handle; `assert...HandlesResolved` passes;
     - an unissued handle is refused at `plan.subflows.0.nodes.0.parameters.expectedState.facts.0.target`, and the step is never asked.
- Checks after the revision:
  - Core vitest over `flow-bootstrap/{authoring,script-statements,plan,candidate}`, `executor/defensive/tests`, `executor/tests/effect-check`, `executor/tests/transition-comparison.test.ts` and `llm/harness-options/tests`: 74 files, 843 tests passed.
  - Core `tsc --noEmit` → exit 0.
  - Core structure audit → passed.
- Not re-run after the revision: the row 11 Lab run. Its path (a lost reply with true facts → landed) is unchanged and is covered by `expected-facts.test.ts`. Downstream files did not change in this revision.
- Note, not changed: the older host-expectation demotion (`EXPECTATION_REJECTED_FAILURE`, which has no stage) on a recorded lasting node still reaches the effect check through gate 3 in `assess.ts`. It is the same class of risk for recorded `expectedState` conditions.

## Revision 2: the older expectation-rejection hazard is closed too

- **Correction to my earlier note.** I said `EXPECTATION_REJECTED_FAILURE` carried no stage. That was wrong: it already carries stage `verification` (`nodes/policy/expectation.ts`), and I did not change it. The hazard was real for another reason, in two parts:
  - `defensive/assess.ts` treated any lasting act's failure as an uncertain outcome. Either gate 1 for a node it marks as acting, or gate 3 for a web node, set `actUncertain`.
  - The effect check then read the same rejection as `not_landed` and pressed again.
  - Separately, a host's own record could reach the attempt with no stage.
- **The fix.**
  - `transition-comparison.ts`: a succeeded attempt failed by the host's verdict on its expected state now always carries stage `verification`, whether the record is the host's own or Core's.
  - `defensive/assess.ts`: the t413 rule now applies to any such demotion, not only to `core.step.done_when_false`.
    - It recognises the demotion as a failed attempt whose comparison the host judged (`metadata.hostEvaluated`), with stage `verification`. Only that demotion produces such an attempt.
    - On a lasting act the rule refuses with no `actUncertain`. No effect check runs and there is no retry, so it is a true failure.
    - A step that does not last goes on to the existing gates and keeps its ordinary retry.
- **New tests.**
  - `executor/tests/transition-comparison.test.ts`: a lasting `builtin.policy.action` whose expectation is rejected after success is dispatched once. The run fails, not as Outcome uncertain, and the attempt has no `effectCheck`. Before this change the same Flow would have dispatched twice, through gate 1 → effect check → `not_landed` → retry.
  - `defensive/tests/assess.test.ts`:
    - the facts rejection and the evaluator rejection on a lasting web step are each refused with no `actUncertain`;
    - a step that declared nothing lasting is retried;
    - a lasting act's failure that the host did not judge after a success still gets `actUncertain`.
- **Existing tests whose expectations changed: none.** No existing test repeated a lasting act after a rejection of a successful act:
  - the expectation-rejection tests in `node-execution.test.ts` use a non-lasting node, and still pass unchanged;
  - `uncertain-act.test.ts` covers lost replies, not rejections after success.
  - Earlier in this task I changed my own `expected-facts.test.ts` case "false on a lasting act" from retry to Outcome uncertain, as the coordinator's first review required.
- **Checks.**
  - Core vitest over `runtime/executor` (all of it, including `defensive` and `transition-comparison`), `runtime/service/{runtime-adaptation,adaptations,adaptation-projections}` and `nodes/policy`: 106 files, 1000 tests passed.
  - `script-statements` and `llm/harness-options` tests: 21 files, 260 passed.
  - Core `tsc --noEmit` → exit 0. Core structure audit → passed.
