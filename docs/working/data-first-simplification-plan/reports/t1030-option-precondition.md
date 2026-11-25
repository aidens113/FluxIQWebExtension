# t1030 report: an act's standing option is a precondition the Flow checks at playback

Worker: worker-heavy (Opus 5.5). Trees: Core `fxwork/t1030/!FluxIQ`, downstream `fxwork/t1030/!FluxIQWebExtension`. No git writes, no Lab, paid or model run. One provider-free headed browser run in the content harness, at the lead's request (below).

**Core edit notice.** This task crosses into FluxIQ Core. It touches the draft step type and the statement reader (`runtime/flow-authoring/draft/`, `runtime/llm/draft-statement/`, `runtime/llm/evidence-loop/`), the precondition rule (`runtime/flow-authoring/bootstrap/instructed-acts/`), one line wiring it into the draft write (`runtime/llm/harness-options/bootstrap-completion.ts`), and Core's trial sentence (`framework/.../candidate-trial/happened.ts`). The answer-first test fake engine changed too. Compatibility: the statement field `chosen[]` gains an optional `at`, and act nodes gain an optional `requiresChosen` parameter. Old statements and old Flows read exactly as before. The new web failure code joins the closed set.

## Outcome

Done. A Flow saved with an act whose option (size, colour, fulfilment...) was credited by t1023's standing rule now carries that option on the act's node as `requiresChosen: [{ at, words }]`. At playback (a later attempt's Flow run, Run again, a candidate trial, any run of the assembled plan) the content script finds each option again and reads its chosen state from the page's typed state before the act. If the option stands, the act runs as before. If it does not stand, or is not on the page, the act is refused unrun with `web.precondition.option_not_chosen`: Core category `target_not_found`, `effect: "unacted"`, not retryable. The engine's `automationStudioCouldNotRun` therefore holds, so the step routes by page state like any unavailable step, and a repair can add the step that chooses the option. The run is told why in Core's own sentence. The act never presses on silently, and nothing is guessed from page words.

## Follow-up: bigbox, proved in a visible browser (lead's request)

**Bigbox is the readable case.** Its fulfilment chooser (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts`) is a flyout inside the header's open shadow root (`vr-fulfillment-picker`). Closing it, with "×" or by a reload after "Set as my store", only sets `hidden` on the flyout. The Pickup and Delivery tabs stay in the document, drawn apart by a class, and every fresh document is rendered with Pickup drawn apart. So the option is checked from its typed state at act time, on a fresh page where the chooser was never opened. A replay of attempts 2-4 does not refuse while Pickup stands, so no paid repair is needed for it. The conditional root fix (a build-time step that opens the chooser and checks the option) is therefore **not** needed for bigbox, and I did not build it.

New spec (owned path, new file): `apps/extension/e2e/content/tests/required-choices/tests/bigbox-fulfilment.spec.ts`. It runs on the bigbox-retail realistic fixture through the content harness, headed.
- **Build half.** The evidence runtime looks, presses the chooser chip by handle (the view shows `clickable "Pickup" marked`), closes it by its own "×" (Pickup is out of view, and the flyout is in the document but hidden), then presses the "+ Add" of a paper-towel tile by handle. The add's statement says Pickup stood chosen, with `at`, and the cart gains the line.
- **Playback half.** The add as Core saves it (its `ranWith` parameters plus `requiresChosen: [{ at, words }]`) is sent through Core's normalizer and the gateway mapping.
  - On a reloaded, never-opened page it succeeds, and the Scenario Lab's cart gains one.
  - After Delivery is chosen and the chooser closed by "×", it fails with `web.precondition.option_not_chosen`, and the cart is unchanged.
- The page is woken first (`window.vr.awake = true`). The site's first "+ Add" press only wakes it, and the content harness has no page world to see the fresh binding. Without this, the plain press timed out "the first press was unanswered ...", which has nothing to do with the precondition: the Pickup check had already passed.

`pnpm test:content -- required-choices --headed` (in `apps/extension`), observed:

```
build: the add's statement chosen = [{"key":"t320","words":"Pickup","at":{"selector":"div > div:nth-of-type(2) > div:nth-of-type(1)","element":{"tagName":"div","visibleText":"Pickup","selector":"div > div:nth-of-type(2) > div:nth-of-type(1)","classNames":["css-1i18xlx"],"context":{"shadowHosts":["body > div > header > div > vr-fulfillment-picker"]}}}}]
build: the add's outcome = {}; cart 1 -> 2; cart lines [... {"lineId":"L2","productId":"418830190","sku":"5510205","qty":1,"fulfilment":"pickup"}]
playback with Pickup chosen: succeeded  the point 892,361 landed on the target; the page prevented the click's default action
playback with Delivery chosen: failed web.precondition.option_not_chosen required option 1 is not chosen on the page
  1 passed (4.0m)
```

The saved identity leaves out the chosen tab's own class (`classNames: ["css-1i18xlx"]` only, t436), so the same `at` finds Pickup whether or not it is chosen. It also carries the shadow host chain.

One fixture fact you may want: bigbox's tab choice is only drawn in the page. The quick add posts the tile's preset fulfilment, not the tab (`client/shell-script.ts`), so on this fixture Delivery standing does not change what the add does. The precondition still refuses, by design: the Flow was built with Pickup standing.

**Acceptance set re-run after the spec** (Core source unchanged since the final Core rebuild):
- **Core groups:** `vitest-groups --groups=parallel,real-sql` over every changed Core directory. Parallel: `Test Files 256 passed (256)`, `Tests 2430 passed (2430)`.
  - Real-sql: `Test Files 1 failed | 73 passed (74)`, `Tests 1 failed | 505 passed (506)`. The failure was `answer-first/tests/later-attempt.test.ts > a run's own deadline ends the run and never the attempt` (`stoppedAt` 2, expected 3).
  - That test gives the run a 400 ms deadline, and this pass ran beside the extension check, the domain tests and the audit. The same group passed 506/506 in my first full run.
  - Rerun alone, `FLUXIQ_TEST_GROUP=real-sql node node_modules/vitest/vitest.mjs run src/framework/automation-service/service/answer-first/tests/later-attempt.test.ts` gave `Test Files 1 passed (1)`, `Tests 24 passed (24)`.
  - My edit to the fake engine cannot reach that test: its `over` hook answers `RENEW_CARD` before the new check, and it sets no `requiresChosen`.
- **Core audit, run after the groups:** `structure-audit: passed (571 warning(s), 903 baselined)`.
- **`pnpm --filter fluxiq check`:** exit 0. The build cache reused its stamp; inputs unchanged since the last pass.
- **Domain check:** exit 0, `core-build: ... is current with its source`.
- **Extension check after the final Core rebuild:** `browser-host:build` and `extension:check` rebuilt ("inputs changed: apps/extension, core:packages/fluxiq/dist ..."), exit 0. This covers the new spec's types.
- **Domain tests:** `test-domain.mjs src/actions/ src/client/ src/output-nodes/ src/runtime/failure/ src/runtime/llm-evidence/` gave `# tests 2398 # pass 2398 # fail 0`.
- **Extension tests:** `test-extension.mjs required-choices content/actions/tests/execute content/actions/tests/click` gave `# tests 111 # pass 111 # fail 0`.
- **Downstream audit:** `structure-audit: passed (260 warning(s), 551 baselined)`.

**Still open for other sites.** A chooser that leaves the DOM when closed would refuse every replay; bigbox is not such a site. The fix you described (the build adds an idempotent open-and-check step before the act when the option stood only out of view) is not built. I recommend it as a follow-up for the first site that shows it.

## What changed and why

The chain, from evidence to playback:

1. **The domain keeps what finds the option again** (`domain/src/runtime/llm-evidence/node-run/standing-choices/`).
   - `at.ts` (new) turns a handle's resolution on the look that showed it chosen (`targetPackets.resolveOn`) into `{ selector, element }`. That is the same address and identity a press's `ranWith` keeps. Options in a child frame get no `at`.
   - `memory.ts` stores `at` per remembered control and persists it, refreshing it on each look that shows the control chosen.
   - `stated.ts` says it on the statement's `chosen[]`.
   - `tools.ts` passes the finder into both look feeds.
   - `capture.ts` widens the statement type (no added lines).
   - Conditional spreads were replaced by `present<T>()` (structure audit `contract-spread`).
2. **Core carries `at` unread.**
   - `draft/step.ts`: `AutomationStudioFlowDraftStepChosen` gains `at?: JsonObject`.
   - `draft-statement/chosen.ts` accepts `at`: a non-empty plain object, JSON of at most 8,000 characters, otherwise the entry is withheld.
   - `evidence-loop/call-record.ts` copies it onto the appended step, and `tool-execution.ts` documents it.
3. **Core writes the precondition at assembly.**
   - New `instructed-acts/chosen-precondition.ts`.
     - `automationStudioInstructedStandingPreconditions` runs the existing standing loop on the Flow's own (proposed) steps. Every choice answered by the standing credit (`stood`) whose option has an `at` becomes `{ at, words }` on that act step.
     - `automationStudioFlowDraftWriteWithStandingOptions` wraps the draft's `write`. It drops any `requiresChosen` a step carried (Core owns it and re-derives it on every assembly), and writes the derived one where the node's registry definition declares `requiresChosen`.
   - Wired in `fromDraft` (`bootstrap-completion.ts`, 3 lines). That one assembly serves build completion, candidate trials and answer-first's flow-run (`flow-run/assemble.ts` goes through `checkAutomationStudioFlowBootstrapCompletion`).
   - Once a step named for the choice makes it, the credit no longer applies and no precondition is written. Quantities are never credited, so they are never required.
   - `candidate-trial/happened.ts`: a `target_not_found` failure whose code ends `option_not_chosen` reads "The step did not run: an option it was saved with does not stand chosen on the page, so it would have acted with another. A step before it has to choose that option."
4. **Domain wire.**
   - `actions/requires-chosen/` (new): `WebAutomationRequiredChoice` and the strict reader. The `element` goes through `elementFingerprint`, and any malformed entry makes the whole list unreadable.
   - `actions/types.ts`: the `requiresChosen` command field.
   - `actions/schemas.ts`: the schema on click, type and keypress.
   - `output-nodes/definitions.ts`: the parameter on click, type and keypress, `valueType: "array"`, `shownToModel: false`.
   - `client/gateway-action-parameters.ts` lifts it.
   - `client/gateway-mapping.ts` refuses the whole command (`web.action.invalid_parameter`) when it was sent unreadable, even though it is not a required field. Dropping the check would be the defect.
   - `client/index.ts` exports it.
   - `runtime/failure/codes.ts`: `OPTION_NOT_CHOSEN` = `web.precondition.option_not_chosen`, with `{ target_not_found, retryable: false, target_resolution, unacted }`.
5. **Extension check** (`apps/extension/src/content/action-runtime/required-choices/`, new).
   - `requiredChoiceUnmet` resolves each option through `deps.resolveTarget` from a command naming only the option, so the act's row or pass scoping is not applied. Hidden options in the DOM are still read.
   - `standsChosen` reads the same typed states the view prints as chosen: native checkbox or radio `checked`, `aria-checked`, `aria-selected`, `aria-pressed`, `aria-current`, and being drawn apart from like siblings (`setApartFromLikeSiblings`).
   - `actions/execute.ts` runs it inside the recovery callback before any verb, using the raw deps so the option is never noted as the pressed control.
   - The failure record and message name the option by its position in the list, never by its page words.
6. **Tests.**
   - Core `flow-run/tests/saved-flow-road.test.ts`: 4 playback cases appended. The new file was merged in because `flow-run/tests/` hit the 25-file limit.
   - Core `instructed-acts/tests/chosen-precondition.test.ts` (3).
   - Core `draft-statement/tests/chosen.test.ts`: an `at` case, bad `at` cases, and `at` carried onto the appended step.
   - Core `answer-first/tests/fake-library-engine.ts`: `RENEW_CARD` declares and checks `requiresChosen`, and `LibraryTarget.chosen` was added.
   - Domain `standing-choices.test.ts` now asserts `at`.
   - Domain new `client/tests/gateway-mapping-requires-chosen.test.ts` and `output-nodes/tests/requires-chosen-parameter.test.ts`. The second shows the parameter survives Core's plan validation with the real node registry and contracts.
   - Domain `codes.test.ts` gets the new row.
   - Domain `model-facing-catalog.test.ts`: the click's hidden list now includes `requiresChosen`, which is intended.
   - Extension new `required-choices/tests/required-choices.test.ts` (4), run through the real `executeContentAction`.
7. **Docs.** Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` (the `{ key, words, at? }` statement and a new "A saved act requires the option it was built with" paragraph). Downstream `docs/architecture/build-loop.md` ("What Stood Chosen": `at`, the parameter, the gateway refusal, the content check, the code).

## Commands run and observed results

**Acceptance: playback where the option stands and where it does not, failing before the change.** In Core `packages/fluxiq`, `FLUXIQ_TEST_GROUP=real-sql node node_modules/vitest/vitest.mjs run .../flow-run/tests/standing-option.test.ts`. These four cases now live in `saved-flow-road.test.ts`.

- With the change: `Tests 4 passed (4)`.
- With `fromDraft`'s write temporarily set back to the plain `automationStudioFlowBootstrapDraftNodeStep`:

```
× runs where the option stands chosen, its node carrying the option as what it requires
  → expected [ undefined ] to deeply equal [ [ { …(2) } ] ]
× does not run where another option stands chosen: the step is told failed with why, and its failure is one a run routes by page state
  → expected [ { …(2) } ] to deeply equal []        (the act was pressed with Delivery standing)
Tests 2 failed | 2 passed (4)
```

The wiring was restored and the case passed again (it is in the final run below).

**Extension check, failing before.**
- `EXTENSION_TEST_BUILD_LABEL=t1030 node scripts/test-extension.mjs required-choices`: 4/4 pass.
- With the `if (unmet) return ...` line disabled: `not ok 2 - an act whose required option is not chosen, or not on the page, never runs ...`, `# pass 3 # fail 1`. Restored.

**Domain `at`, failing before.**
- `DOMAIN_TEST_BUILD_LABEL=t1030 node scripts/test-domain.mjs standing-choices` with the finder not passed in `tools.ts`: `not ok 1 - an add pressed with the chooser closed ...`, `# pass 3 # fail 1`.
- Restored: `# tests 4 # pass 4 # fail 0`.

**Core.**

| Command | Observed |
| --- | --- |
| `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/flow-authoring/draft/ src/runtime/flow-authoring/bootstrap/instructed-acts/ src/runtime/llm/draft-statement/ src/runtime/llm/evidence-loop/ src/runtime/llm/harness-options/ src/framework/automation-service/service/candidate-trial/ src/framework/automation-service/service/answer-first/` | parallel: `Test Files 256 passed (256)`, `Tests 2430 passed (2430)`. real-sql: `Test Files 75 passed (75)`, `Tests 506 passed (506)`. `[vitest-groups] all groups passed: parallel, real-sql`, exit 0. |
| The same runner after the audit fixes (rename, test merge, `chosen.ts` try removed), over `instructed-acts/`, `draft-statement/`, `answer-first/flow-run/`, `candidate-trial/` | parallel: `Test Files 58 passed (58)`, `Tests 715 passed (715)`. real-sql: `Test Files 15 passed (15)`, `Tests 99 passed (99)`. `all groups passed: parallel, real-sql`. |
| Core libraries rebuilt again after the audit fixes, then `pnpm --filter @fluxiq-web-extension/domain check` | fluxiq and ui-components rebuilt; `core-build: ... is current with its source`; `domain:check` exit 0 |
| `pnpm --filter fluxiq check` | exit 0, run both before and after the audit fixes |
| `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` | exit 0 (fluxiq and ui-components rebuilt). This ran before the audit-fix edits; see Not verified. |
| `node scripts/structure-audit.mjs` (Core root, run alone) | first run: 3 violations (flow-run/tests 26 files, `failure-as-empty` in `chosen.ts`, three `standing-` files). After the fixes: `structure-audit: passed (571 warning(s), 903 baselined)`, exit 0. |

**Downstream.**

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 (`core-build: ... is current with its source`), both before and after the `present()` fixes |
| `DOMAIN_TEST_BUILD_LABEL=t1030 node scripts/test-domain.mjs src/actions/ src/client/ src/output-nodes/ src/runtime/failure/` | first run: 630/631, failing the catalog's exact hidden-parameter list. After updating it: `# tests 631 # pass 631 # fail 0`. |
| `DOMAIN_TEST_BUILD_LABEL=t1030 node scripts/test-domain.mjs src/runtime/llm-evidence/` | `# tests 1767 # pass 1767 # fail 0` |
| After the audit fixes: `test-domain.mjs standing-choices src/client/ src/output-nodes/ src/actions/ src/runtime/failure/` | `# tests 635 # pass 635 # fail 0` |
| `EXTENSION_TEST_BUILD_LABEL=t1030 node scripts/test-extension.mjs required-choices content/actions/tests/execute content/actions/tests/click` | `# tests 111 # pass 111 # fail 0`. After the import fix (`required-choices content/actions/tests/execute`): `# tests 14 # pass 14 # fail 0`. |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0, twice (the second after the test import fix) |
| `node scripts/structure-audit.mjs` | first run: 4 violations (`as never` in my test, `contract-spread` x2, barrel imports in my test). After the fixes: `structure-audit: passed (260 warning(s), 551 baselined)`, exit 0. |


## Not verified

- No live, Lab, paid or model run. The one browser run is the provider-free headed content-harness spec on bigbox-retail (follow-up section). Outside it, the content check runs against fake elements through the real dispatcher. On a real page I did not see:
  - an option resolved again by its saved fingerprint;
  - `setApartFromLikeSiblings` on a hidden chooser;
  - whether a chooser the site removes from the DOM when closed makes every replay refuse until a repair adds the choosing step. That is the honest outcome by design, but its frequency on the realistic sites is unknown.
- The `requiresChosen` playback test is Core's fake library node standing in for the host. The real host's check is covered separately by the extension and gateway tests. No single test runs Core assembly through the real web domain into the content script.
- The domain and extension checks were both rerun after the final Core rebuild, and both passed (see the follow-up section).
- The bigbox spec ran once, headed, and passed. A chooser that leaves the DOM on another site is not covered, and the build-time choose step for that case is not built.
- The model-facing node-run path: a build that reruns a step carried from a saved Flow (`draft-from-flow`) whose node holds `requiresChosen` would get this code back. The domain's refusal mapping has no reason word for it, so the model reads it as `action_failed` plus the record. `tool-rejection.ts` is at 799 lines; adding a reason needs a split.

## Open questions or contradictions found

- **Which options become preconditions.** Only the person's credited options (the standing loop's `stood`), not every option that stood chosen. Requiring every chosen control (a menu's `aria-current`, a remembered checkbox) would make Flows refuse on unrelated state. The brief's words, "the options that stood chosen", could be read more widely.
- **Carried preconditions are dropped and re-derived.** A step carried from an earlier Flow keeps none until it runs again in the build, as t1023 already noted for `chosen`. Until then the checklist owes the choice, which is consistent.
- **Out of the brief's owned paths.** `runtime/llm/draft-statement/`, `runtime/llm/evidence-loop/` and one line in `runtime/llm/harness-options/bootstrap-completion.ts`. They are the statement reader and the assembly call site the wire change needs. `framework/.../candidate-trial/happened.ts` holds the sentence the flow-run tells. No must-not-touch path was edited.
- **The domain's build memory now persists `{ selector, element }`** for each option shown chosen, beside the words it already kept, in Core's build-state store.
