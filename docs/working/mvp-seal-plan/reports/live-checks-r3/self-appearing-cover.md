# Self-appearing cover: attribution of a new layer to an act (t885, Cause A)

## Outcome

**Done in code, partly verified.** New layers are now credited to the act that came before them by evidence the page holds. Where the page holds none, the act's kind decides. The memory-level tests for (a) and (b) pass, and each fails when the fix is reverted.

The end-to-end test through the real runtime is written but **could not run**. Core's compiled output is stale: `fluxiq/automation` does not export `automationStudioLlmStepLogSpans`. For the same reason, `domain check` stops at its Core-currency gate. As the brief says, I did not work around either.

## The true cause, decided from the code

The cause is attribution by timing alone. Before this change, `own-layers/memory.ts` `pressed()` credited **every** new unrecognised layer on the look after **any** on-page mutate act to that act (`run.ts:532`). The crossborder card rose on a 3.5 s timer, so it was remembered as the typing's own. "Not now" then answered nothing, its step was saved as required, and a later run stopped on it.

Neither of the previous worker's proposals is the root:

- **"Only a click claims a layer" (`PRESS_NODE_ID`).** It drops layers that typing or choosing genuinely opens, such as a suggestion list hanging from a field (probe 2 below shows these tests failing). It also keeps a press with a send (`type` + `submit`) out.
- **"Exclude typing without submit".** The extension's typing (`apps/extension/src/content/action-runtime/keyboard/type-text.ts:35`) fires a trailing `change`, as a select or check does. At the event level nothing sets typing apart from the other value setters.

Two kinds of evidence answer "did this act open this layer". Both are already in the packet: `attributes` are published (screened), and so are `box`, `parent` and `expanded`.

1. **A tie between the acted control and the layer** (new `own-layers/tied.ts`):
   - **Named.** The control's `aria-controls`, `aria-owns` or `aria-activedescendant` names, by id, the layer or an element the layer holds.
   - **Anchored.** The layer is drawn at the control's edge: its top within one control-height of the control's bottom, or its bottom within one control-height of the control's top. It must also share some of the control's width and not stand over the control. A layer whose box holds the control's middle, or that the capture says covers it, is a cover.
2. **The control's own `aria-expanded` turning true** across the act.

Where some new layers are tied, those alone are the act's. Where no tie exists, the fallback is the domain's own trusted effect floor (`actions/action-effect/table.ts`, resolved by `webAutomationResolvedActionEffect`):

- **A `commit`** (press, keypress, `type` with `submit`, dialog, next page) still owns its untied new layers, as before. The t869 covering rule still applies. A page need not tie a dialog to its button (t193, the store chooser).
- **A `state` setter** (type without submit, clear, select, check, upload) owns nothing untied. Its effect is the value it names; that is the table's own repeat-safe promise.

**Why the act's kind is the fallback.** For an untied layer after a state setter, no captured fact separates "the value raised it" from "a timer raised it in the same instant". So the kind is the only honest basis left. It is the domain's existing classification, not a new list.

**The cost, stated plainly.** A confirm that a typed or chosen value raises, with no tie at all and no send, now reads as an interruption. Its answer runs whenever the confirm shows and is skipped only when it does not. Core never makes a step that claims an act optional (`packages/fluxiq/src/runtime/flow-authoring/draft/interruption.ts`, the `step.acts?.length` guard), so the standing rule holds. The opposite error, today's, stops every saved Flow whose page remembers the answer.

## What changed and why

All paths are under `domain/src/runtime/llm-evidence/node-run/`.

- **`own-layers/opened-by.ts` (new).** The attribution rule. Tied layers come first; then the expanded flag or a commit; otherwise none. The header records the problem, the rule and the cost.
- **`own-layers/tied.ts` (new).** The two ties, named and anchored. They are read from attributes and boxes only, never from the layer's words.
- **`own-layers/act.ts` (new).** The `WebNodeLayerAct` type: handle, action type, and parameters as written. `submit` is read from the parameters; an unresolved binding resolves to a commit, which is the conservative side.
- **`own-layers/beneath.ts` (new) and `own-layers/held-by.ts` (new).** The t869 covering rule and the layer-membership helper, moved unchanged out of `memory.ts`, because the new modules need the membership helper too.
- **`own-layers/memory.ts`.** `pressed(build, before, after)` became `acted(build, before, after, act)`, which delegates to `webLayersOpenedBy`. The header's "What is remembered" and "What it does not know" now say what holds.
- **`own-layers/index.ts`.** Also exports `type WebNodeLayerAct`.
- **`run.ts`.** The same five lines (526-532), changed in place: the comment and the call `run.layers.acted(..., { handle, actionType: node.actionType, parameters: written })`. The file is still 785 lines.
- **`own-layers/tests/memory.test.ts`.** The existing calls pass a `PRESS` act. Their assertions are unchanged.
- **`own-layers/tests/opened-by.test.ts` (new, 9 tests).**
  - (a) An untied card after typing is not owned. Nor is one after clear, select or check.
  - (b) A layer the typing opens is owned when it hangs from the field with no relation written, when the field names it by `aria-controls`, or when the field's `aria-expanded` turned true. A confirm after `type` + `submit` is owned; the same confirm without submit is not.
  - A press still owns a lone untied layer.
  - Of a tied list and an untied card that rose together, only the list is owned.
  - A cover standing over the field is not "anchored", even one whose edge meets the field.
- **`own-layers/tests/typed-beside-a-cover.test.ts` (new, 2 tests).** Through the real runtime, in the shape of `run-mwa9oytn-d866da84`:
  - type into a field, a card rises far away, press "Later": `draft.interruption === true`;
  - type into a field, a suggestion list hangs below it, press the suggestion: no `interruption`.
  - **Not run** (see below).

## Commands run and observed results

All from `fxwork/t885/!FluxIQWebExtension`.

- **`cd domain && DOMAIN_TEST_BUILD_LABEL=t885-cover node scripts/test-domain.mjs node-run/own-layers/tests`**
  - Result: `# tests 17 # pass 17 # fail 0`, plus `2 of 4 domain test entries failed to load: .../prompt-over-opened-layer.test.ts, .../typed-beside-a-cover.test.ts`.
  - Both failed with `SyntaxError: The requested module 'fluxiq/automation' does not provide an export named 'automationStudioLlmStepLogSpans'`. Exit 1. `prompt-over-opened-layer.test.ts` is pre-existing and I did not change it.
- **Reverted-fix probe 1: the old timing-only attribution.**
  - What I did: put `return webLayersBeneathOthers(fresh, after)` first in `opened-by.ts`, the old `openedOf` behaviour, on the memory and opened-by tests.
  - Result: `pass 12 fail 5`. The tests that failed:
    - 9, untied card after typing;
    - 10, after clear, select or check;
    - 14, the confirm without submit;
    - 16, the tied list beside the card;
    - 17, the cover over the field.
  - So the (a) tests fail without the fix. The (b) tests pass, as expected, because the old code owned everything.
- **Probe 2: the act's kind alone, with no ties (the previous worker's proposal).**
  - Result: `pass 13 fail 4`. The tests that failed:
    - 11, the anchored suggestion list;
    - 12, the `aria-controls` list;
    - 13, `aria-expanded`;
    - 16, the tied list.
  - So the (b) tests fail without the tie evidence.
- **Restoring after the probes.** After each probe the file was restored from a scratchpad copy. `diff` printed nothing ("restored-identical"), and `grep -c REVERT-PROBE` printed `0`.
- **`cd domain && DOMAIN_TEST_BUILD_LABEL=t885-cover node scripts/test-domain.mjs runtime/llm-evidence/node-run`**
  - Result: `# tests 164 # pass 164 # fail 0`, but `43 of 69 domain test entries failed to load`.
  - All 43 failed on the same stale export: 43 `SyntaxError` lines naming `automationStudioLlmStepLogSpans`, and no other error lines.
- **`pnpm --filter @fluxiq-web-extension/domain check`**
  - Result: exit 1 at `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...\!FluxIQ is not current with its source". The stale builds are `contracts`, `fluxiq`, `client-gateway-websocket`, `sdk` and `ui-components`.
  - **Not passed.** I did not rebuild Core (Core is off limits).
- **Diagnostic only, not the acceptance check: `cd domain && npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit`.**
  - Result: 1 and 3 errors respectively. Every one is in `node-run/timing/` and comes from the missing `automationStudioLlmStepLogSpans`, or follows from it.
  - **0 errors** in `own-layers/**` or `run.ts`.
- **Confirming the cause is stale output.** `grep` finds the export in Core's `packages/fluxiq/src/runtime/llm/step-log/` and not in its `dist`.
- **`node scripts/structure-audit.mjs`** → `structure-audit: passed (244 warning(s), 552 baselined)`, exit 0.
  - None of the warnings names `own-layers`. The `run.ts` warning (785 lines, over the 400 advisory threshold) is pre-existing.

## Not verified

- **The run-level tests have not run** (`typed-beside-a-cover.test.ts`, and the existing `prompt-over-opened-layer.test.ts`). The stale Core blocks them. They need Core's libraries rebuilt and then a rerun.
- **`domain check` has not passed**, for the same reason.
- **No Lab or live rerun of the crossborder pair**, as the brief says.
- **The fixture's card geometry against the anchoring rule.** The card is `position:fixed; top:78px; left:24px; width:340px`. On the scrolled page it sits around document y 186-320, and the Max field is several sidebar rows below "Poland", which the card covers. I did not measure either box: the step logs keep page text, not boxes. It is unlikely to be within one field-height of the field's edge, but that is inferred.
- **Anchoring is vertical only.** A popup drawn to the side of its control and naming nothing is not tied. After a state setter it would read as an interruption.

## Open questions or contradictions

1. **Core's compiled libraries in `fxwork/t885/!FluxIQ` are stale.** That blocks both the domain check and 43 of 69 `node-run` test entries. They need rebuilding with the command the gate prints, by whoever owns Core, before this lane's run-level tests and check can be read.
2. **Two new header claims rest on that rebuild.** `memory.ts` and `opened-by.ts` say the run-level outcome holds: "Not now" is marked `interruption` after typing, and Core then makes the step optional. The memory-level tests cover the attribution; only the unrun runtime test covers the `interruption` flag end to end.
3. **The brief's "a confirm a typed value genuinely opens".** It is kept when the typing sends (`submit`) or when the confirm is tied to the field. An untied, unsent one cannot be told from a timed cover by anything the capture holds. It now reads as an interruption, which is never applied to a step that claims an act. The supervisor may want to confirm that this trade is acceptable.
