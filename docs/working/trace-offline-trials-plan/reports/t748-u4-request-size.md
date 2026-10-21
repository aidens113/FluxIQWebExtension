# t748-u4-request-size

## Outcome

Done. The harness's pre-provider context-window check now counts only what the provider sends. The node catalog the packed request carries, which is never sent, no longer counts toward it. The exploration test is back at its narrow window of 20,000 input / 22,000 total, and it passes.

## What changed and why

Root cause: `llm/harness/run.ts` `measuredInput()` set the size to the larger of the packed request (`JSON.stringify(request)`, whole node catalog included) and the provider's `measureInput` (the DeepSeek adapter's measure of the system and user messages it sends). For an evidence decision the packed request is the larger one, because the adapter sends catalog names and described nodes only. So the window counted a catalog the model never reads. Pricing had already used the sent measure since t254.

All paths below are in Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`, under R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/llm/harness/run.ts`: when the provider gives a valid measure, `estimatedInputTokens`/`estimatedInputBytes` are that sent measure, the same as `pricedInputTokens`. The packed request is still the fallback when a provider gives no measure, or its measure throws or is invalid. That behaviour is unchanged and still tested.
  - Comments are updated: the call-site comment and the `measuredInput` doc.
  - Catalog text that is sent still counts, because it is in the adapter's messages: names, described nodes, and a one-shot `flow_bootstrap`'s whole catalog. The adapter's own refusal (`deepseek/provider.ts:111`) and the preflight declared-size check (`preflight.ts:40-45`) use the same measure, so the harness and the adapter cannot disagree.
  - The file stays at 419 lines.
- `R/llm/harness/tests/run-size.test.ts`:
  - New `describe("the harness's context-window check")`. It drives the real DeepSeek provider's `measureInput` (its `runTask` is stubbed, so no fetch runs) on an evidence decision whose registry is the web fixture plus 100 copies of every node.
    - Test 1: the packed request is more than twice the sent size; a window of sent+100 is below the packed size; no `llm_budget.input_limit_exceeded` or `request_total_exceeded`; the provider is invoked; the declared size equals the sent measure.
    - Test 2: a window one token below the sent measure is still refused before the provider (`not_attempted`), and the diagnostic metadata states the sent measure's tokens and bytes.
  - The existing t254 test "prices what the provider sends…" asserted that the window read the packed request (`> 10_000`). It now asserts the sent 1,000, and is renamed.
  - The new tests were first a separate `sent-size.test.ts`. That put `harness/tests/` at 26 files, past the audit's 25-file limit, so I merged them into `run-size.test.ts` (296 lines) and deleted the separate file.
- `R/tests/deepseek-bootstrap/tests/exploration.test.ts`: the window is restored to `{ maxInputTokens: 20_000, maxOutputTokens: 2_000, maxTotalTokens: 22_000 }`, the value before t744 (8f97e147). The comment now says the window counts what is sent, never the packed catalog (t748).
- `R/llm/deepseek/preflight.ts` and `request-shape.ts`: no change needed.
  - `catalogBytes` in preflight only checks that `catalogSelection.usedBytes` states the catalog's own size; it is not a size check.
  - `request-shape`'s `catalog` diagnostic already reports the catalog as sent (`whole` for flow_bootstrap, `names` for evidence decisions). It never fed the size check.

## Commands run and observed results

All vitest commands ran from `packages/fluxiq`.

- New tests on HEAD's `run.ts` (HEAD copy swapped in from scratch `u4-run.head.ts`, then restored and confirmed with `cmp`):
  - Command: `pnpm exec vitest run R/llm/harness/tests/sent-size.test.ts R/tests/deepseek-bootstrap/tests/exploration.test.ts` (at that point the tests were still in `sent-size.test.ts`).
  - Output: 3 failed | 7 passed:
    - "is not tripped by a node catalog…" failed with `expected [ …(2) ] to not include 'llm_budget.input_limit_exceeded'`.
    - "still refuses, with its size…" failed with `expected { estimatedInputTokens: 678137 … } to match { estimatedInputTokens: 58484 … }`, meaning HEAD reported the packed size.
    - exploration "records a build's token totals past one request's ceiling…" at 20,000/22,000 failed with `expected { totalProviderCallCount: 2, … } to be undefined`.
- With the fix, the same run: both new tests passed (2 passed).
- After merging the tests into `run-size.test.ts`: `pnpm exec vitest run R/llm/harness/tests/run-size.test.ts` gave 12 passed.
- Narrow validation, run as the brief states it: `pnpm exec vitest run src/programs/automation-studio/runtime/llm/deepseek src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/tests/deepseek-bootstrap` gave `Test Files 67 passed (67)`, `Tests 552 passed (552)`. That includes `system-prompt.test.ts`; no pin was moved.
- `node scripts/structure-audit.mjs` at the Core root: 2 violations, both `[naming]` depth in `R/service/candidate-trial/step-control/`, which another worker owns. None is in my files. The `harness/tests/` count is 25, at the limit, which is a warning only.

## Not verified

- No full suites, no build, no live run (per the brief).
- I did not re-prove the HEAD failure after merging the tests into `run-size.test.ts`. The assertions are the same as in the run that failed.

## Open questions or contradictions found

- The two harness refusal messages in `run.ts` still begin "Packed LLM request is an estimated…". The size they state is now the sent size. I kept the wording because `R/llm/tests/context-window.test.ts`, which is outside my ownership, matches the phrase. A follow-up could rename it to "LLM request", together with that test.
- `harness/tests/` is now at 25 files, the hard limit, so the next test added there needs grouping.
