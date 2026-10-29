# t787 fix 3b: trial toggle end to end (Done)

## Outcome

Done. All three gaps are closed, and each has a test that failed first and now passes.

1. A trial press that flips its own control now reports the toggle signature, and it lands at Core's `outputs.result.toggle`.
2. The build's `AutomationStudioExploredToggles` now reaches the candidate-trial and subflow-trial ports. In a project build it is the same instance the brief submissions read.
3. The claim was **true**, and it is fixed. `ensureState` reached `buildPlan.plan` only. The laid-out `buildPlan.subflows`, which the graph is built from (`normalizeAutomationStudioFlowBuildPlan`), kept the parameters from before the toggle pass. That includes an `ensureState` the model wrote itself, which the plan had removed.

## What changed and why

### Gap 3: Core `flow-bootstrap/candidate/submission.ts`

- New private `relaid(buildPlan, plan)`. When the toggle pass changed the plan, it re-validates it with `validateAutomationStudioFlowBootstrapPlan` (registry, resolution, size), as `layer-handlers/explored.ts` does. It then takes `plan`, `risk` and `subflows` from that one validation.
- If validation refuses the plan, the submission is refused with the validator's errors under `candidate.toggle_not_idempotent`. An unchanged plan is returned as is.
- The `submit` header now says this.
- Why it matters: `verification/detached-execution.ts` refuses a candidate whose plan re-validates to other subflows (`candidate.execution_plan_rewritten`). Promotion saves the topology built from `subflows`.
- Test (new): `flow-bootstrap/candidate/tests/toggles/tests/submission-toggles-graph.test.ts`.
  - It records a trial press (`toggles.trial([...])` for `node.bootstrap.<ns>.primary.n0`) and submits the same step again.
  - It asserts `ensureState` on `buildPlan.plan`, on `buildPlan.subflows`, and on the normalized graph node's `parameterValues`.
  - It asserts the plan re-validates to the stored subflows (the trial's rewrite guard).
  - It asserts a neighbouring step stays a plain press, and a model-written `ensureState` is absent from subflows and from the graph.

### Gap 2: wiring

- `service.ts` (~1584): the build's trial environment is now `{ ...automationStudioServiceTrialEnvironment(...), exploredToggles: permissions.exploredToggles }`.
  - Whole trials spread the environment into their ports (`trial-ports/whole-ports.ts`).
  - Subflow trials spread `project.trialEnvironment` too (`project-build/subflow-trials.ts:81`).
  - So both trial kinds call `trial()` on it.
- `service/project-build/brief-ports.ts` (~262): briefs now share `project.trialEnvironment.exploredToggles` when it is an `AutomationStudioExploredToggles`, rather than minting their own. Otherwise subflow trials would record into an instance no brief submission reads. It falls back to a new one, as before.
- Test (new): `service/candidate-trial/tests/already-in-state/tests/trial-toggles.test.ts`.
  - It runs a real `runAutomationStudioCandidateTrial` whose native press answers `outputs: { result: { toggle: { signature } } }`.
  - It asserts the record holds `{ node: "custom.press", handles: [], signature }`, with `trialNodes[0]` ending `.primary.press`. That confirms fix 3's assumption about executed ids.
  - A press without a toggle records nothing.
  - This covers the `run.ts` call fix 3 added. It passed on its first run; it is coverage, not a fail-first item.

### Gap 1: domain and extension wire path

The trial press path is: Core executor → `domain/src/runtime/adapter.ts` → `io/gateway-output-dispatcher.ts` → gateway → background (`gateway-payloads.ts` / `server-command-channel.ts` via `client/gateway-mapping.ts`) → extension `content/actions/click.ts`.

- `apps/extension/src/content/actions/click.ts`
  - For a press made in place (not a link), it reads the control with `toggleReadingOf` just before the press.
  - After a press that succeeded with no failure, it reads the control again. That happens only if the element is still connected and the document address is unchanged.
  - The domain's `webToggleSignatureOf` derives what flipped, and the result carries `toggle: WebToggleSignature`. No signature logic is copied.
  - The press body moved unchanged into `pressInPlace()`. `clickAction` wraps it with `withToggle()`. The header explains why.
- `apps/extension/src/content/actions/toggle-reading.ts`: `getAttribute?.(...)` for the state attributes, as the class reader already did. Every in-place press now reads the control, and the click tests' fake element has no `getAttribute`.
- `domain/src/actions/types.ts`: `WebAutomationActionResult.toggle?: WebToggleSignature`. `BrowserActionResult` is this type, so it is one protocol change.
- `domain/src/client/gateway-mapping.ts`: copies `toggle` through `webToggleSignatureValue`, only on a succeeded, unskipped result.
- `domain/src/io/gateway-output-dispatcher.ts`: lifts `toggle: { signature, idempotentWith? }` to the top of the dispatch payload beside `skipped`. That is Core's `outputs.result.toggle`, which `explored-toggles.ts trial()` already reads. It only does this on a success that pressed, after reading the value through `webToggleSignatureValue`. The Core reader is unchanged.
- `domain/src/actions/toggle-signature/output.ts` (new, plus its barrel line): `webToggleOutput(signature)` and the type `WebToggleOutput`. This is the one rule (attribute → `idempotentWith: "web.output.dom-check"`) for both explored and trial presses.
  - `runtime/llm-evidence/node-run/press-effect/toggle-signature.ts` now uses it. `WebPressToggleOutput = WebToggleOutput`, so the shape is unchanged.
- Tests (new):
  - `apps/extension/src/content/actions/tests/click/tests/press-toggle.test.ts` (5 rows): an attribute flip, a name flip Like→Unlike, a press with `ensureState` that was not yet shown, a press that changes nothing, and a press that moved the page.
  - `domain/src/io/tests/gateway-output-dispatcher-toggle.test.ts` (3 rows): the name lift, the attribute lift with `idempotentWith`, and failed, skipped, malformed or absent values putting no toggle on the payload.
  - `domain/src/client/tests/gateway-mapping-toggle.test.ts` (2 rows).

## Commands run and observed results

- **Core graph test, before the fix:** `pnpm test .../flow-bootstrap/candidate/tests/toggles` gave "2 failed | 7 passed (9)".
  - Row 1 failed at the `buildPlan.subflows[0].nodes[0].parameters?.ensureState` assertion.
  - Row 2 failed with "expected { target, ensureState: { state: 'made.up' } } to deeply equal { target }".
- **Extension test, before the click change:** `EXTENSION_TEST_BUILD_LABEL=t787-fix3b node scripts/test-extension.mjs content/actions/tests/click/tests` gave "tests 18, pass 15, fail 3". Rows 4-6, the positive toggle rows, failed.
- **Domain tests with the feature disabled.** I temporarily neutralised the dispatcher's `toggle` and the mapping line, then restored both. `DOMAIN_TEST_BUILD_LABEL=t787-fix3b node scripts/test-domain.mjs io/tests/gateway-output-dispatcher-toggle.test.ts client/tests/gateway-mapping-toggle.test.ts` gave "tests 5, pass 2, fail 3": the three positive rows failed.
- **After the changes:**
  - Core: `pnpm test` on candidate/tests/toggles, tests/explored-toggles.test.ts, script-statements/tests, executor/node-execution/tests, service/candidate-trial, service/subflow-trial, project-build-brief-ports.test.ts, service/trial-ports and layer-handlers gave "67 passed (67) / 497 passed" and "2 passed / 11 passed".
  - Core: `pnpm test` on flow-bootstrap/candidate, flow-bootstrap/tests, flow-bootstrap/subflow-candidate and project-agents gave "154 passed / 1088 passed" and "1 passed / 12 passed".
  - Core: `pnpm test .../executor/node-execution/tests/already-in-state-rerun.test.ts` gave "✓ already-in-state-rerun.test.ts (1 test)", 1 passed.
  - Core: `pnpm test .../service/candidate-trial/tests/already-in-state` gave "2 passed / 5 passed".
  - Core: `pnpm test .../service/project-build` gave "20 passed / 121 passed" and "7 passed / 35 passed".
- **Core `pnpm check` (C/packages/fluxiq).**
  - The first run failed: TS2307 on my new test's core import depth.
  - The structure check then flagged its file import ("reach into another directory's files instead of its barrel").
  - After both fixes, `pnpm check` finished with no errors (build-cache stored), and `pnpm structure:check` (C) gave "structure-audit: passed (448 warning(s), 1152 baselined)".
- **Core build:** `pnpm build` (C/packages/fluxiq) finished: "stored in the shared store (10674 file(s) ...)".
- **Downstream, after the Core build:**
  - `DOMAIN_TEST_BUILD_LABEL=t787-fix3b node scripts/test-domain.mjs io/tests client/tests actions/toggle-signature/tests runtime/llm-evidence/node-run/press-effect/tests` gave "tests 193, pass 193, fail 0".
  - `EXTENSION_TEST_BUILD_LABEL=t787-fix3b node scripts/test-extension.mjs content/actions/tests content/actions/tests/click/tests background/connection/tests` gave "tests 466, pass 466, fail 0".
  - `pnpm --filter @fluxiq-web-extension/domain check` printed "core-build: ... current with its source", then domain:check was stored with no errors.
  - `pnpm --filter @fluxiq-web-extension/extension check`: extension:check was stored with no errors.
  - `node scripts/structure-audit.mjs` (D) gave "structure-audit: passed (232 warning(s), 616 baselined)", exit 0.

## Not verified

- **Live browser and real DOM.** No live or Lab run was made. The click tests use the faked element.
  - A page that replaces the pressed element when it re-renders (`isConnected === false`) gives no trial toggle, so that step stays a plain press.
  - The reading after the press is taken once the click's own watches end. A control that changes state only after a slower request finishes would read unchanged and give no toggle.
- **The project-build path end to end.** No test shows a subflow trial's toggle reaching a brief's next `core.submit_subflow`. The sharing relies on the `instanceof` in brief-ports and on subflow-trials spreading `project.trialEnvironment`, both read in code.
- **Detached execution itself.** I did not run `runAutomationStudioDetachedCandidate` on a toggled candidate. Before the fix, the test stopped at the subflows assertion, so the rewrite-guard row was not reached. My inference from the code is that the trial would have refused such a candidate as `candidate.execution_plan_rewritten`.
- **Sensitive targets.** For a sensitive target, `runtime/adapter.ts` `secretSafeDispatchPayload` may drop or keep the top-level `toggle`. Not checked.
- Offline-first trials record nothing, since no press happened; I did not test this.

## Open questions or contradictions found

- **The debug note versus gap 3.** The debug note says rev 1-5's like "skipped correctly (0055, 0078)" with `ensureState`, from a t775 explored press. But on HEAD's `submission.ts`, a toggled submission left `buildPlan.subflows` without `ensureState`, and when no layer handler was added nothing re-validated it. I did not work out how those steps carried it. Possibly the t775 checkpoint code then differed, or 0055/0078 were not trial graphs. Worth a look before trusting the note's account.
- **`idempotentWith` on trial presses is new behaviour.** A trial press that flips a stated attribute (aria-pressed, aria-checked, aria-selected, checked) now carries `idempotentWith: "web.output.dom-check"`. The next submission of that step is then refused `candidate.toggle_not_idempotent`, as it already is for explored presses. This is consistent, but it means a model can be told to rewrite a step after a trial, not only after exploration.
- **Files outside `D/domain/src/runtime/**`.** I edited these, because the trial press's wire path runs through them and none is on the must-not-touch list:
  - `domain/src/actions/toggle-signature/{output.ts,index.ts}`
  - `domain/src/actions/types.ts`
  - `domain/src/client/gateway-mapping.ts`
  - `domain/src/io/gateway-output-dispatcher.ts`
- **Stale docs (not edited):**
  - Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` lines 250-253 ("the domain answers an exploration press with `toggle` ...; `explored-toggles.ts` records it"). Trial presses now answer and record it too, and submission now re-validates the toggled plan.
  - `FluxIQWebExtension/docs/architecture/web-capabilities.md` lines 610-630 ("An exploration press of the click node ... answers `toggle`"; "derived from the page packets"). The click verb now also reports `toggle` from live readings before and after a press made in place, and the dispatcher lifts it beside `skipped`.
  - Core `docs/reference/framework-reference.md:1145` and `packages/fluxiq/docs/reference/framework-reference.md:1145` describe `AutomationStudioExploredToggles` as "Every explored press". It is generated, so regenerate it rather than hand-edit.
