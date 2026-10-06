# t273-s2-w3-route-wiring-and-completion: worker report

Worker for brief `t273-s2-w3-route-wiring-and-completion` (`t273-creation-wiring.md`, S2). Core tree `fxwork/t273/!FluxIQ`; paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` (R). No commits were made, and nothing was run in a Lab, a browser or against a provider.

## Outcome

Done. One audit failure is still open, and it is not mine: the structure audit fails only on `llm/tests/` holding 26 files against a limit of 25. The extra file is the concurrent worker's new `llm/tests/evidence-loop-decision.test.ts`; `llm/tests/` already held exactly 25 files before S2.

## What changed and why

- **New `R/llm/harness-options/draft-route.ts`** defines `automationStudioFlowBootstrapDraftRoute({route?, activeInstructions?, startLocation?, arrival?})`.
  - With no `route` it returns `{}`. Otherwise it returns `route()` and `routeCheck(steps)`.
  - `route()` takes `currentAutomationStudioInstructionRoute(peek)`. A `named` reading gives `{state:"named", quote, places}`, with `places` being the waypoints sorted by `order` and mapped to `quote`. An `open` reading gives `{state:"open"}`; anything else gives `undefined`.
  - `routeCheck(steps)`:
    - `first` is the first step for which `automationStudioFlowDraftStepIsProposed` holds.
    - A shortcut means all of the following:
      - `startLocation` and `arrival` are both given;
      - `automationStudioFlowBootstrapDraftStepGoesToLocation(first, …)` holds;
      - the declared arrival value (`(ranWith ?? input).parameters[arrival.parameter]`) differs from `startLocation` once trimmed and with trailing `/` removed;
      - it is not a named route on which `first.places` includes `r1`.
    - `route.read()` is sent only for a shortcut while the current reading is `unread`. The promise is memoised, so it is sent at most once even if `peek` never settles. The result goes through `current()`, so a stale reading counts as unavailable.
    - A `named` reading produces these refusals, in this order:
      - shortcut → `bootstrap.route_shortcut`;
      - missing places → `bootstrap.route_place_missing`;
      - out-of-order places → `bootstrap.route_out_of_order`.
    - A shortcut on a reading that is neither `named` nor `open` → `bootstrap.route_unconfirmed`.
    - The texts are the brief's exact refusal texts. The missing text lists every missing place and names the first in `(place "rK")`. The out-of-order text names the first out-of-order place. When several refusals apply, their sentences are joined with a space.
    - Feedback shape: `{ok:false, code:"flow_bootstrap.completion_refused", refusal:"flow_bootstrap.route_not_followed", issues:[{code}…], instruction}`.
  - Imports:
    - The `service` type is imported with `import type` through the `../../service/index.ts` barrel. Importing the file directly would break the barrel rule; the type-only barrel import passes the audit.
    - Values come from the `action-permissions`, `flow-bootstrap` and `flow-draft` barrels.
- **`R/llm/harness-options/draft-acts.ts`** takes `route?` and `activeInstructions?` and spreads `automationStudioFlowBootstrapDraftRoute({route, activeInstructions, startLocation, arrival})` into its result. The return type is widened with `& ReturnType<…>`. The service.ts seam the lead specified (`route: authority.route, activeInstructions: resolvedInstructions.instructions`) now type-checks against it.
- **`R/llm/loop-configuration.ts`**:
  - `draft.route?()` and `draft.routeCheck?(steps)` are added.
  - New `automationStudioLlmEvidenceLoopRouteChecked(input)` returns `input` unchanged when there is no `routeCheck`. Otherwise it replaces `checkCompletion` with one check that runs `routeCheck(context.steps)` first, falls back to the caller's check (called with `this = input`), and otherwise returns `{ok:true}`.
  - The new check carries a `testRefused` that forwards to the inner check's listener.
- **`R/llm/evidence-loop.ts`** is 797 lines; the limit is 800, so every edit is in place except one added line:
  - The input is now `ProgressTrace(RouteChecked(untraced))`. A route refusal therefore takes exactly the path of a refused `checkCompletion`: the same `core.completion_check` entry, `unusable` row, no-progress count and trace line.
  - `draftRecord`'s `authored` gains `place`. A kept, authored step gets `automationStudioFlowDraftSetRoutePlaces(appended, place)`. Unlike `act`, this does not require `effect === "mutate"`, because a read may be on a place.
  - The tool_call path passes `place: decision.place`.
  - The decision context passes `route: input.draft.route?.()`.
- **`R/llm/decision-context/shown.ts`**: `draft.route?` is threaded into `automationStudioFlowDraftEntry({... route})`.
- **Tests**:
  - New `R/llm/harness-options/tests/draft-route.test.ts` has 14 tests covering (a)–(f), plus route display, a stale reading, the exemption for a first step on `r1`, the case with no start location or arrival, and the spread through `draft-acts`.
  - A new `describe` block appended to `R/llm/tests/evidence-loop.test.ts` adds 3 tests:
    - (g) is a loop-level run with `place` on decisions built directly. The refusal reaches decision 3 as `core.completion_check` with the exact r2 text, the trace row is `unusable`/`bootstrap.route_place_missing`, and the build's check is not called for the refused completion.
    - The wrapper runs route-then-check and forwards `testRefused`.
    - With no route check, the wrapper returns the same input.
  - Placement: the loop-level tests were first written as a new `llm/tests/evidence-loop-route.test.ts`. They were moved into `evidence-loop.test.ts`, the nearest test of `evidence-loop.ts`, because the audit refused a 27th file in `llm/tests/` and also refused that file's direct import of `../harness-options/draft-route.ts`. The moved test uses the `harness-options` barrel through `automationStudioFlowBootstrapDraftActs`.

## Commands run and observed results

All commands ran in `fxwork/t273/!FluxIQ`.

1. **Fail-first**, run before any source existed:

   ```
   npx vitest run …/harness-options/tests/draft-route.test.ts …/llm/tests/evidence-loop-route.test.ts
   ```

   Output: `Test Files 2 failed (2)`. Both suites failed with `Error: Failed to load url ../draft-route.ts` (and `../harness-options/draft-route.ts`): `Does the file exist?`.
2. **First pass after the source was written**, same command: `Test Files 2 passed (2)`, `Tests 17 passed (17)`.
3. **After moving the loop tests**, `npx vitest run …/draft-route.test.ts …/llm/tests/evidence-loop.test.ts` → `Test Files 2 passed (2)`, `Tests 51 passed (51)`.
4. **All `R/llm` tests**, `npx vitest run src/programs/automation-studio/runtime/llm` → `Test Files 155 passed (155)`, `Tests 1531 passed (1531)`.
5. **Type check**, `pnpm run check` in `packages/fluxiq` (`fluxiq:check`), run after the final edits: exit 0, with `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store"` and no tsc errors.
6. **Structure audit**, `node scripts/structure-audit.mjs`:

   ```
   FAIL [directory-files] …/runtime/llm/tests/: 26 source files exceeds the 25-file limit.
   structure-audit: 1 violation(s) across 1 rule(s).
   ```

   No other violations. My files only produce advisory warnings: `evidence-loop.ts` at 797 lines and `loop-configuration.ts` at 465 lines.

## Not verified

- **The `service.ts:1594` seam.** I did not edit it, as briefed, and no service-level test runs a build with a real `authority.route` through the loop.
- **Rendering of `route` in the draft entry.** That belongs to the other worker. My loop test only checks that `draft.route` is called.
- **The decision parser producing `place`.** That also belongs to another worker; my loop test builds the decisions directly.
- **The chat observer.** A route refusal is decided before the service's own `checkCompletion` (and the `observeAutomationStudioEvidenceLoop` wrapper around it, if that wraps it). So the chat's "checking" hooks will not see route refusals, although the build trace (`progress-trace`) does, because it wraps outside. I did not check whether the activity observer wraps `checkCompletion` itself.
- **The full suites** (`pnpm check`, `pnpm test`) were not run, per the twice-a-day rule.
- **Live behaviour** was not checked: no Lab, browser or provider calls.

## Open questions or contradictions found

1. **`llm/tests/` is over the 25-file limit.** It is at 26 because of the concurrent worker's new `evidence-loop-decision.test.ts`. The lead needs to merge that file into an existing test, or group the directory.
2. **The `place` claim is applied only to a step that ends up `kept`**, mirroring `act`. A `taken` step the model later keeps needs a `place` amendment to count; the lead put `place?` on the amendment type, so this is possible.
3. **Refusal texts:**
   - When the route is named and the Flow both shortcuts and misses places, the shortcut and missing sentences are both given, in that order, separated by a space.
   - Only the first out-of-order place is named.
   - For a one-place route, the shortcut text reads "goes through X in that order".
