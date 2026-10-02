# t234 W7: refused replies are charged what they cost

## Outcome

Done. Every refusal the DeepSeek envelope throws once a reply has arrived now carries `paid`, the reply's priced usage. The harness settles both the run ledger and the build purse at `failure.reply?.usage ?? failure.paid`. A result the harness cannot parse is now settled at its reported usage instead of its hold. The step log gets `price`.

All paths below are under `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/`.

## What changed and why

- `provider-contract.ts`
  - `AutomationStudioLlmProviderError` gains a trailing optional 10th constructor parameter, `readonly paid?: AutomationStudioLlmUsageSummary`. It is trailing, so every existing call site still compiles.
  - I did not add a reply-account case.
  - `normalizedAutomationStudioLlmProviderFailure` returns `paid?`. As with `reply`, it reads `paid` only from a real `AutomationStudioLlmProviderError` instance and ignores structural clones.
  - New exported `automationStudioLlmProviderPaidUsage(value)` bounds the usage to the numeric fields only: safe non-negative integer counts, a finite non-negative cost, and `undefined` without `outputTokens`. It applies the same bar as `reply-account.ts`'s private `boundedUsage`. reply-account.ts does not export that reader, and I do not own the file.
  - The type is imported from `./harness.ts`, as reply-account.ts does. My first version imported `./harness/provider.ts`, and the structure audit rejected that.
- `deepseek/response-envelope.ts`
  - A new `refusePaid(code, message, paid)` attaches `paid` to `output_invalid`, `output_truncated`, `output_padding_truncated`, `usage_invalid` and `usage_limit_exceeded`.
  - `parseDeepSeekStructuredResponse` now takes `paid`. Its `outputInvalid` is a local `const outputInvalid: () => never`, explicitly typed so TypeScript narrowing still works.
  - `automationStudioDeepSeekMalformedReply` also sets `paid` from `reply.usage`, so every refusal is uniform.
  - On `usage_invalid`, the lenient read and the strict read ask the same of the counts, so in practice `paid` is absent there. A comment says so.
- `harness/run.ts`
  - Provider-failure branch: it computes `paid = failure.reply?.usage ?? failure.paid` and passes it to both `lease.complete(paid, …)` and `hold.settle(paid)`. A `not_attempted` failure still releases the hold.
  - Parse-throw branch: inside the existing `try`, before the parse, it reads `reported = automationStudioLlmProviderPaidUsage(isRecord(call.result) ? call.result.usage : undefined)`. The `catch` settles both the ledger and the purse at `reported`.
  - No new `catch` was added (the failure-as-empty audit rule counts those). A result that throws even when its usage is read still falls back to the hold.
  - `run-budget.ts` `complete()` confirms that valid reported tokens and cost replace the reservation. The record shows `tokens: "reported"` and `cost: "reported"`. The purse `settle()` uses `usage.estimatedCostUsd` when it is valid.
- `deepseek/provider.ts`: `automationStudioLlmStepLogModelStep` now receives `price: (usage) => estimateAutomationStudioDeepSeekCostUsd(usage.inputTokens, usage.outputTokens, usage.cacheHitInputTokens, model)`, the same as `panel-command.ts`.
- Tests:
  - `deepseek/tests/response-envelope.test.ts` has a new describe block, "what a refused reply cost", with 6 tests:
    - `output_invalid` gives `paid` equal to the priced usage, and that value survives the normalizer. This is test (a).
    - `output_truncated` and `padding_truncated` each carry `paid`.
    - `usage_limit_exceeded` carries `paid`.
    - A malformed reply carries `paid` as well as `reply.usage`.
    - The normalizer bounds `paid` to numbers and ignores a clone.
  - New `harness/tests/paid-refusal.test.ts` runs the real adapter end to end:
    - (b) The run ledger charges the reported cost and tokens, and the record says `reported`.
    - (c) The purse settles at the reported cost, with the hold more than twice that cost.
    - The parse-throw branch charges both the ledger and the purse at the reported usage.

## Commands run and observed results

All run from `packages/fluxiq` unless noted.

- **Fail-on-old-source check.** I copied my four source files to the scratchpad and wrote the `git show HEAD:` versions in their place. Then I ran `npx vitest run …/deepseek/tests/response-envelope.test.ts …/harness/tests/paid-refusal.test.ts`.
  - Result: `Tests 9 failed | 15 passed (24)`. All 9 failures are the new tests; the 15 passes are the existing tests.
  - Examples: `expected undefined to deeply equal { inputTokens: 21424, …(5) }`, and for the purse `expected 0.00264 to be close to 0.00027798`. The second shows the hold being charged where the reply cost much less.
  - Afterwards I restored my files. `git diff --stat` matched exactly what it showed before the swap (89+/26-).
- `npx vitest run src/programs/automation-studio/runtime/llm/deepseek src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/tests/run-budget.test.ts src/programs/automation-studio/runtime/llm/build-purse` gave `Test Files 37 passed (37)` and `Tests 312 passed (312)`. I ran it after the final edit.
- `npx tsc --noEmit -p .` printed no output after the final edit.
  - My first tsc run reported `src/programs/automation-studio/runtime/service.ts(1550,154): error TS2353 … 'interpretationCostUsd'`. That file is outside my scope and I did not touch it. It was gone on later runs.
- Extra run: `npx vitest run` on `llm/tests/deepseek-provider.test.ts`, `deepseek-json-content.test.ts`, `harness.test.ts` and `llm/provider-retry` gave `5 passed (5)` files and `82 passed (82)` tests.
- Extra run, from the Core root: `node scripts/structure-audit.mjs` gave `1 violation(s)`. The violation is `[failure-as-empty] …/llm/deepseek/panel-command.ts` line 154. That file is not mine; another worker has it modified in the working tree. My `provider-contract.ts` imports violation is fixed.
- My Python edits had turned three CRLF working-copy files into LF. I converted them back, and `git ls-files --eol` now shows `w/crlf` for all of them. The index is unchanged (`i/lf`).

## Not verified

- No live or Lab run, per the brief.
- The step log's priced cost on a failed call is not tested. `step-log/` belongs to another worker, and `model-step.ts` reads `error.reply.usage` and then falls back to the envelope's usage plus `price`. It does not read `error.paid`.
- Full package suites were not run (the twice-a-day rule).

## Open questions or contradictions found

- `automationStudioLlmProviderPaidUsage` in provider-contract.ts duplicates reply-account.ts's private `boundedUsage`. Whoever owns reply-account.ts could have `boundedUsage` delegate to the new export (or the reverse) so the bound exists once.
- The retried-call case: `failure` is the last attempt's normalized failure only. The refusals that now carry `paid` are all non-retryable, so nothing is lost today. If a retryable code ever arrives with a paid reply, the earlier attempts' costs would still be charged at the single hold.
- The `failure.paid` value is not put into the failure diagnostic's metadata. The run ledger's call record carries it as `usage`, so the receipt shows it. Whether the published diagnostic should also carry `providerPaid` is the supervisor's decision.
