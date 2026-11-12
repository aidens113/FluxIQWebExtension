# W3 t899: each role's request built to its own model's window

## Outcome

Done. A judge whose model has a smaller window than the evidence now gets a request that fits that model's window. The request says what was summarised, and the judge returns a verdict instead of "not judged". With no routing, or when the judge's window holds the evidence, the evidence sent is byte-identical to before. Explore calls are built exactly as before. The narrow tests, the structure audit and the docs check pass. The fluxiq tsc was not run, as the brief asked.

## How the explorer is sized (found, not changed)

- **Limits.** Each resolution sets `tokenLimits` from its own model's context window: the window less an 8,000-token reply reserve (`session-key-provider.ts`, `automationStudioSessionKeyProviderTokenLimits`). An attempt passes its explore resolution's limits to every decision (`answer-first/attempt/decide.ts`).
- **No trimming.** The harness measures the request with the served provider's `measureInput`. A request over the limits is refused by size, never trimmed (`llm_budget.input_limit_exceeded` / `request_total_exceeded`). The adapter refuses on its own window too (`llm.provider_input_budget_exceeded`).
- **Within a round.** Held evidence is kept whole. An earlier view is replaced by a `core.view_reference` to its own call, can be recalled, and the newest view is shown whole (`context-window.ts`, `decision-context/current-view.ts`).
- **When a decision outgrows its window.** The refusal maps to `freshRound` (`runtime/answer-first/pre-model/table.ts`). The next round starts with an empty evidence window and a round note: Core's own account, in counts and Core's words, of the acts, the rows kept and what was tried (`answer-first/attempt/round-note.ts`). The judge's summarising follows the same pattern: Core's account in place of the item, in counts, and labelled as such.

## The defect

- **The judge's limits were never its own model's.** The Flow-less judge calls the harness with no `tokenLimits`, so it was held to the default, largest window. The role-routing resolution threw away each role resolution's `tokenLimits` ("a role's own are not read").
- **What that caused.** A judge model with a smaller window was sent a request its adapter then refused by size. The judge read that refusal as `not_judged`.
- **Demonstrated.** Test `judge-window.test.ts` > "was refused by its own adapter and not judged while the request was built to the caller's limits".

## How the judge is sized now

1. **The serving model says its own limits.**
   - New module `runtime/llm/harness/served-limits.ts`. `automationStudioLlmProviderWithTokenLimits(provider, limits)` returns a forwarding view of the provider. The view's `metadata.metadata.servedTokenLimits` holds that model's limits.
   - `automationStudioLlmServedTokenLimits(provider)` reads them back.
   - They travel in `metadata` because the domain-instructions decorator forwards `metadata` unchanged and re-applies itself to whatever `servedBy` returns. A WeakMap keyed by identity would be lost there. A test covers the decorator case.
   - Only `provider` and `model` of the metadata are recorded on interventions or receipts.
2. **Role resolutions keep their limits.** In `role-routing/resolution.ts`, each judge or repair model resolved by its own resolution now gets its provider wrapped with that resolution's `tokenLimits`.
   - A role that uses the explore model reuses the explore provider unchanged.
   - Call, cost and run-token limits are still not read, because the attempt has one purse.
3. **The harness builds the request to the serving model's limits.** New module `runtime/llm/harness/sized-request.ts`, which `run.ts` calls (`measuredInput` moved there with its doc comment). The steps:
   1. Build the request at the caller's limits.
   2. Ask `servedBy`.
   3. If the served provider states limits, rebuild the request to those, including the instructions' `tokenBudget`, then measure it with the served provider.
   4. If the provider states none, the request is exactly what it was.

   `run.ts` passes in the context packer, because a module of the harness that imported `context-packet.ts` closed an import cycle the audit refuses. `run.ts` went from 431 to 366 lines.
4. **Shorter forms are sent only when the whole summary does not fit.**
   - New optional harness input `resultSummaryFitting` (in `task-request.ts`) holds the result summary in shorter forms, shortest last.
   - The harness sends the whole summary if it fits. Otherwise it sends the first shorter form that fits.
   - If none fits, the shortest form is refused by size, as before, and the check is not judged.
   - The harness itself trims nothing.
5. **How the judge's summary is shortened.** New module `runtime/result-verification/flow-less/window-fitting.ts`, called from `judge.ts`. It is applied to each request, the citation re-ask included. `judged-summary.ts` was not touched.
   - **Order.** One more item is summarised at each step: `witnesses.before`, `witnesses.after`, `endView.view`, `looked`, `readPages`, `acts`, `answerText.text`, and the rows last.
   - **Rows.** They are reduced first to their count, columns and each row's label (its first-column value), and then to count and columns only.
   - **Small items.** An item whose account would be no shorter than the item itself is left whole.
   - **No count cap.** Nothing is cut to a count. Items are summarised only as far as the window needs.

## What the judge is told

- **Each summarised item, in its place:** `{"core.summarised": {item, characters, kind, ...}}`, in counts only.
  - An object lists its keys, each as "list of N entries", "text of N characters" or "object of N keys", with numbers and flags shown as they are.
  - A list gives its number of entries. A text gives its number of characters.
  - Rows give `rows`, `columns`, and in the first rows form `labelColumn` and `labels`.
- **A `summarised` entry, last in the summary** so the bytes before it stay the same: `{count, items: [...], note}`. The note says, in generic words:
  - the request did not fit the context window of the model judging it;
  - Core summarised N of the evidence items listed, each shown in its own place as `core.summarised`, with what it held in counts and never its content;
  - everything else is shown whole;
  - a yes must stand on what is shown whole, and where what was asked can only be settled from a summarised item, the judge should answer unknown.
- **Citation checks are unchanged.** Yes citations are still checked against the full rows held (`read`), not against the summarised copy.

## What changed

Core worktree `fxwork/t899/!FluxIQ`, `packages/fluxiq/src/` unless the path starts with `docs/`:

- `runtime/llm/harness/served-limits.ts` (new), `sized-request.ts` (new), `run.ts`, `task-request.ts` (`resultSummaryFitting`), `index.ts` (two exports).
- `runtime/llm/role-routing/resolution.ts`: role providers carry their resolution's `tokenLimits`.
- `runtime/result-verification/flow-less/window-fitting.ts` (new), `judge.ts` (passes `resultSummaryFitting`; header note).
- Tests (new):
  - `role-routing/tests/served-window.test.ts`: 6 tests. They cover the judge's own limits and a harness size refusal before the adapter's, limits reaching the harness through the domain-instructions decorator, an explore request byte-identical to an unrouted one, the first fitting form being sent and the whole summary when it fits, the shortest form refused when none fits, and the resolution carrying a role's limits.
  - `flow-less/tests/judge-window.test.ts`: 3 tests. A small-window judge gets a request that fits, says what was summarised, and returns yes. The old behaviour is not judged. A large-window judge gets the evidence byte-identical to an unrouted judge.
  - `flow-less/tests/window-fitting.test.ts`: 3 tests.
  - The harness tests stay outside `harness/tests`, which is at the 25-file directory limit.
- `docs/fluxnodes/reference/limits.md`: new "Model requests" section.

## Commands run and observed results

All run from `packages/fluxiq` with `npx vitest run`, unless another directory is named.

- `src/runtime/llm/role-routing/tests src/runtime/result-verification/flow-less/tests src/runtime/llm/harness/tests src/framework/automation-service/service/fluxnode/tests/model-routing.test.ts` (after the final edit) -> `Test Files 42 passed (42)`, `Tests 304 passed (304)`.
- `src/runtime/llm/tests/harness.test.ts src/runtime/llm/tests/context-window.test.ts src/runtime/llm/tests/run-budget.test.ts src/runtime/llm/tests/provider-cache-prefix.test.ts src/runtime/llm/domain-instructions/tests src/runtime/llm/build-purse/tests` -> `Test Files 12 passed (12)`, `Tests 160 passed (160)`.
- `node scripts/structure-audit.mjs` (Core root):
  - First runs failed with two `import-cycles` violations. One came from `resolution.ts` importing the harness barrel; fixed by importing `../harness/served-limits.ts` directly. The other came from `sized-request.ts` importing `./context-packet.ts`; fixed by passing the packer in from `run.ts`.
  - Final run: `structure-audit: passed (533 warning(s), 969 baselined).`
- `pnpm docs:check` (Core root) -> `structure-audit: passed (0 warning(s), 0 baselined).` and `Deterministic framework reference is current.`

## Not verified

- The fluxiq tsc was not run, as the brief asked. The riskiest typing:
  - `import type { packAutomationStudioLlmContext }` used as `typeof` in `sized-request.ts`;
  - `withOwnLimits(resolved)` in `resolution.ts`, which relies on the same `"provider" in resolved` narrowing the existing code used;
  - the `JsonObject` casts in `window-fitting.ts`.
- No live run. Every model Core ships today has a 1,000,000-token window (`models/catalog/anthropic.ts`, `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`), so this path is reachable today only through a resolver that returns smaller `tokenLimits`.
- The Flow-run result check (`result-verification/verify.ts`, `resolveCallerProvider` in `service.ts`) was not changed. It resolves the judge model as its one provider, so whether its harness call passes that resolution's limits was not checked.

## Open questions or contradictions found

1. **The brief's premise, corrected.** The brief says the explorer's evidence is sized to its window. Core never trims or summarises a request to fit: it refuses by size. What it does is start a fresh round with Core's account of what the attempt holds, and the judge's summarising follows that pattern. The judge also did not use the explore model's limits: it passed none, so it got the default, largest window.
2. **A gap outside my paths: the Flow-less judge without routing.** It still passes no `tokenLimits`, so it is held to the largest window, not to the attempt model's own. With an attempt model whose window is smaller than 1,000,000, its adapter would still refuse an oversized judge request.
   - The fix is one line in `answer-first/attempt/run-attempt.ts` (W1, must-not-touch). Either pass `tokenLimits: input.provider.tokenLimits` into the judge's run, or wrap the attempt's provider with `automationStudioLlmProviderWithTokenLimits`.
   - The second option needs a matching `tokenLimits?` field on the judge input.
3. **Recorded metadata now carries the limits.** The forwarding view's `metadata.metadata.servedTokenLimits` appears on `result.provider` for role calls served by a model with stated limits. Interventions and receipts record only `provider` and `model`.
