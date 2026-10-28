# t775-P: toggle tie (P1) and the job-board detect throw (P2)

## Outcome
Partial.
- P1 is fixed through to the trial. Two causes were found, and both are fixed with tests that fail before the fix.
- `judged-change-like-loop` (pinned) now passes headed. The newest variant now fails only on one check: it asserts the skipped act has a `row`. Core deliberately never names a row by an address, and the newest rows hold only a link. The owner has to decide this.
- P2 is not a product defect. The spec's harness runtime does not declare structure detection, so the domain throws its "client does not declare repeating-structure detection" fault. The fix belongs in `apps/extension/e2e/`, which this brief must not touch.

## P1 causes and evidence
Baseline, the headed `-g pinned` run before any change: it failed at line 123 with `Received ["DQwjFQMHFgA","DZcqnvywrLW"]`.

In the diagnostic:
- The explored press answered `toggle: {signature: {via:"name", gains:["unlike"], loses:["like"]}}` (node `web.output.dom-click`, handle t542).
- The judge request's flowShape for the like step (`main.s6`) held `"expectedState":{"via":"name","gains":["unlike"],"loses":["like"]}`, and no `ensureState`.

So the tie worked: the node id, the handle and handleViews all matched. The signature was then renamed.

**Cause 1 (domain + Core): the press never declared `ensureState`.**
- Core re-validates the candidate's plan before the trial (`verification/detached-execution.ts:57`, `validateAutomationStudioFlowBootstrapPlan`).
- Validation first runs `correctAutomationStudioFlowBootstrapPlanNames`. That resolves an undeclared key to the nearest declared name, so `ensureState` became `expectedState`.
- The click therefore got no `ensureState` and pressed. That unliked the post.

Fixes:
- Domain `domain/src/output-nodes/definitions.ts`: `web.output.dom-click` declares `ensureState` (object, `shownToModel: false`).
- Core `script-statements/toggle-idempotent.ts`: new optional `takesEnsureState(definitionId)`. A node whose definition does not declare the parameter stays a plain press, instead of having its signature renamed into another parameter.
- Core `candidate/submission.ts`: passes `takesEnsureState`, worked out from `registry.get(...).parameters`.

After this fix, headed: likedAtEnd contained the explored post (newest `['D1OKDvAEHfa', …]`, pinned `['D96ahbWGjtY', …]`), and line 123 passed. The flowShape showed `"ensureState":{...}`. Both variants then failed at line 127, because there was no `already_in_state` act.

**Cause 2 (domain): the client's skip never reached Core.**
- The extension answered `skipped: "already_in_state"`. The post stayed liked, and `webAutomationActionResultPayload` carries the field.
- `io/gateway-output-dispatcher.ts` nests the client payload under `result`, and Core keeps the dispatch payload as `outputs.result` (Core `io-policy.ts:52`).
- So the skip sat at `outputs.result.result.skipped`. Core's `already-in-state.ts` reads `outputs.result.skipped`.
- The trial's feedback showed step 7 as a plain `succeeded`.

Fix: the dispatcher lifts `skipped` to the top of the dispatch payload, as it lifts `route`. It does this only on a succeeded result and only for that literal.

After this fix, headed:
- Step 7 reads `"skipped":"Its control already showed the asked state, so it was not pressed."`.
- siteChange.acts lists `{step:7, pass 1/3, outcome:"already_in_state"}`. In the pinned variant it also has `row:"Pinned post icon"`.
- Pinned passes.

**Remaining newest-variant failure (line 128, `act.row` must be a string)**
- The newest read has two fields, `link` (a URL) and `badge`. `badge` is empty on non-pinned tiles.
- Core's `activity/loop/row.ts` never names a row by an address. That rule is deliberate (t378, "A field whose value is an address is never the row's name").
- So the pass has no row name. This is not a toggle defect.
- The owner must decide: either the spec reads a readable column, or Core falls back to some identity for an address-only row. `activity/loop/row.ts` is not in this brief.

**The domain honours ensureState on a row-bound target.** `content/actions/click.ts` checks `webToggleSignatureShown` against the element it resolved for that pass, at run time. The headed run confirms it: pass 1 (on the liked post) was skipped, and passes 2 and 3 were pressed (`changed`).

## P2 cause and evidence
- The headed run had the step log on. `0009-tool-web.detect_repeating_structure` shows `status: threw`, `summary: "threw Error"`, 52 ms, input `{target:"t98"}`.
- `judged-change-save-then-read.spec.ts` binds `bindInstrumentedRuntime` (`e2e/site-reset/instrumented-runtime.ts:64`). That runtime passes `eligibleSessionIds` but no `structureDetectionSessionIds`.
- `detect.ts:134` therefore throws a plain `Error("the connected web client does not declare repeating-structure detection")` before any target logic. That is why both target attempts failed the same way.
- Every passing detect spec (offline-first-job, offline-first-photo, like-loop, and the others) uses `bindDetectingRuntime` (`photo-build.ts:28`, `structureDetectionSessionIds: ready`).
- In production, the runtime derives the IDs from the client's capabilities (`runtime/llm-evidence/tools.ts:723`).
- So the throw is not caused by the save, by t775's click outputs, or by toggle reading. `instrumented-runtime.ts` is unmodified in this task (last commit e3d6f7e6, L1).
- Owner: the e2e spec. Use `bindDetectingRuntime`, or add `structureDetectionSessionIds` to `bindInstrumentedRuntime`.

## What changed
- Core: `flow-bootstrap/script-statements/toggle-idempotent.ts` and `flow-bootstrap/candidate/submission.ts` (see above).
- Core: new test `flow-bootstrap/candidate/tests/toggles/tests/submission-toggles-undeclared.test.ts`.
- Domain:
  - `domain/src/output-nodes/definitions.ts`
  - `domain/src/io/gateway-output-dispatcher.ts`
  - `domain/src/output-nodes/tests/model-facing-catalog.test.ts` (hidden parameters now include `ensureState`, and the catalog does not show it)
- Domain new tests:
  - `domain/src/output-nodes/tests/click-ensure-state.test.ts`
  - `domain/src/io/tests/gateway-output-dispatcher-skipped.test.ts`

## Commands run and observed results
- Fail-first tests, each with its fix temporarily reverted (all restored afterwards):
  - Core, without the guard: `submission-toggles-undeclared` failed, and received `expectedState: {gains:["unlike"], loses:["like"], via:"name"}`.
  - Domain, with the click line removed: click-ensure-state `# fail 1`.
  - Domain, without the dispatcher lift: dispatcher-skipped `# pass 1 # fail 1`.
- Core, from `packages/fluxiq`: `node ../../scripts/vitest-groups.mjs --groups=parallel` over `flow-bootstrap/script-statements/tests`, `flow-bootstrap/candidate/tests`, `flow-bootstrap/tests/explored-toggles.test.ts` and `executor/node-execution/tests` -> "Test Files 54 passed (54) / Tests 437 passed (437) / all groups passed: parallel".
- Core `pnpm check` (packages/fluxiq):
  - First run: one TS2322 in my new test (`shownToModel: boolean`).
  - Fixed with `as const`, then re-run: no errors (build-cache stored).
- Core `pnpm structure:check` -> "structure-audit: passed (448 warning(s), 1152 baselined)."
- Domain: `DOMAIN_TEST_BUILD_LABEL=t775-p node scripts/test-domain.mjs io/tests output-nodes/tests actions/toggle-signature client/tests runtime/llm-evidence/node-run/press-effect/tests` -> "# tests 287 # pass 287 # fail 0".
  - An earlier run failed `web.dom.click parameters must be state-bindable`. I had set `allowStateBinding: false`, and removing it fixed the failure.
- Extension: `EXTENSION_TEST_BUILD_LABEL=t775-p node scripts/test-extension.mjs content/actions/tests/click` -> "# tests 51 # pass 51 # fail 0".
- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` in domain and in apps/extension -> exit 0 for all four.
- Downstream root `node scripts/structure-audit.mjs` -> "structure-audit: passed (230 warning(s), 616 baselined)."
- Rebuilt Core libs: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> fluxiq rebuilt (about 66 s). `test:e2e` rebuilt the extension.
- Headed: `pnpm test:e2e e2e/site-reset/tests/judged-change-like-loop.spec.ts --workers=1` -> "1 failed, 1 passed (2.5m)". Pinned: ok. Newest: x at line 128 (row).
- Headed: `pnpm test:e2e e2e/site-reset/tests/judged-change-save-then-read.spec.ts --workers=1` -> "1 failed" at line 111 (trial codes). The detect step log still shows `threw Error`, as the spec-side cause predicts.

## Not verified
- The other photo specs that H attributed to P1 were not rerun: photo-dialog-step, photo-looped-other-item, photo-toggle and photo-dialog-destination.
- No full suites were run. The Core `service/project-build/tests` were not run, because brief-ports.ts was not changed.
- The live Lab or extension chat path was not run, and no paid run was made.

## Open questions
1. Newest like-loop: should an act whose row holds only a link get a row identity, or should the spec read a text column? See `activity/loop/row.ts` and its t378 rule.
2. The domain's `idempotentWith` is `"web.dom.check"`, an action type rather than the node id `web.output.dom-check`.
   - Core only quotes it in the refusal sentence.
   - The script reader accepts the action type, but the catalog lists the node id.
3. The step log records a plain domain `Error` as "threw Error" with no message, which hid the P2 cause. A coded error in `detect.ts` would make it readable.
