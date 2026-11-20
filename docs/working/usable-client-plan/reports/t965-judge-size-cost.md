# t965: judge request size and cost (worker report)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t965/!FluxIQ` (`task/t965-judge-trail-per-attempt`, off `dev` at `db17d59c5`, which includes t963 and t964). Nothing committed.

## Outcome

Done. All four fixes are in the t965 tree, with tests; nothing is committed.

- **Size:** raw page captures are out of the trail.
- **Measure:** the judge's request is measured conservatively and fitted before it is sent, and a size refusal steps down to the next shorter form.
- **Cost:** the judge stays on the attempt's base model while the decider climbs.
- **Cache:** the trail is a cached prefix of the judge's message.

Every test folder ran green except one Anthropic provider test, `llm/anthropic/tests/provider.test.ts`, "unchanged task guidance". It fails identically in the t963 tree, which has none of these changes: since t962, Sonnet sends `thinking: between_tools`, and that test still expects no `thinking`.

## Redesign (lead's message: the judge reuses the decider's cache)

Items 1 and 2 stand as below. Items 3 and 4 changed as follows.

### The paid probe (pre-approved, two calls on `claude-haiku-5-5`, no balance error)

- **Setup.**
  - The first call was decider-shaped: a ~9.7k-token system prompt with a cache mark, and a user turn of six evidence blocks with a mark on the last, in a decider-like format.
  - The second call had the same model, `thinking` and system blocks, and the same user blocks up to the mark, then appended final data and a mid-conversation `{role: "system"}` judge message, in the judge's own `output_config.format`.
- **Observed usage:**
  - decider: `input_tokens 7`, `cache_creation_input_tokens 9699`, `cache_read_input_tokens 0`, `output_tokens 20`;
  - judge: `input_tokens 68`, `cache_creation_input_tokens 9707`, `cache_read_input_tokens 0`, `output_tokens 84`.
- **Conclusion.**
  - The second call read nothing and rewrote the whole prefix, the system prompt included. Model, `thinking`, and the system and user bytes were identical, so the different `output_config.format` invalidates the cache from the system tier down.
  - The mid-conversation system message sits after the messages prefix, so it cannot cause a system-tier miss. This is an inference: no third call isolated it, since none was approved.
- **Consequence.** The judge must send the decider's format. It is not the judge's own.

### What makes that possible

The decider already sends the adapter's JSON-text transport (`output_config.format` = the constant `result_json` schema, plus a second system block with its instruction). This was seen in run-mwodpw10's decide requests 0064 (Sonnet) and 0123 (Haiku). Its instruction says to put the object the user message's outputSchema asks for into `result_json`. So the judge keeps that exact format, its own message carries its own outputSchema, and its answer is decoded from `result_json` and checked against the judge's schema, as any JSON-text answer is.

### Changes

- **The continuation builder.** New `runtime/models/providers/anthropic/continuation.ts`.
  - `automationStudioAnthropicDeciderPrefix` keeps a decider's request: every top-level member in order, and its user blocks up to and including the last cache mark, with the call ids those blocks' evidence entries hold.
  - `automationStudioAnthropicJudgeContinuation` builds the judge's request:
    - that request, with the same model, `max_tokens`, `thinking`, system blocks and `output_config`;
    - the same user blocks up to the mark;
    - then the judge's own JSON message, with every trail entry whose call the decider's evidence already holds left out (`trail.shownAbove` says how many);
    - then a `{role: "system"}` message with a short turn note and the judge's own system prompt, last.
- **Only this attempt's decider.** A continuation is built only when every call the prefix holds is in the judge's own trail, which holds this attempt's calls across a resume. Otherwise the judge is sent on its own. An earlier attempt's history is never shown.
- **The Anthropic provider.** `runtime/llm/anthropic/provider.ts` keeps the latest decider prefix per project and Flow, on the provider instance of the model that served it.
  - A `loop_verification` request with `metadata.continuesDecider` is sent as the continuation, in JSON-text format.
  - It falls back to the standalone judge when no prefix is held, when the prefix is another attempt's, or when the continuation would not fit the window.
- **Who continues.** `answer-first/attempt/run-attempt.ts` sets `continuesDecider` once the attempt's decider has decided (`run.decidedAt`). `flow-less/judge.ts` puts it on the request's metadata.
- **Trail call ids.** `run-trail/of/call.ts`, `trail.ts` and the contract now carry each call's `callId` on its trail entry, so the evidence above and the trail name the same calls.
- **Routing.** `runtime/llm/role-routing/provider.ts`:
  - A judge with `metadata.continuesDecider` is served where the decider stands now: its rung, with its cache.
  - Every other judge (a saved Flow's replay judged before any decision, a finished run's check, a trial) stays on its start rung, the attempt's base model.
  - The decider's ladder is unchanged.
- **Unchanged.** The trail cache marker (`trail-cache-content.ts`) still covers judges of their own, including a continuing judge that fell back.

### Tests

- **`runtime/llm/anthropic/tests/judge-continuation.test.ts`** (3 tests): after a decider request, the judge's request has the same model, `max_tokens`, `thinking`, system bytes, `output_config` bytes, top-level key order, and user blocks up to the decider's last mark. Then come the judge's message, with the 3 calls in the evidence left out and the saved-Flow step kept, and the system message last. Its scripted answer decodes from `result_json` as the judge's diagnosis.
  - A judge not continuing the decider is sent on its own.
  - A judge whose trail does not hold the decider's calls (another attempt) is sent on its own.
- **`role-routing/tests/ladder-resolution.test.ts`** has a new case: before a climb, the decider and the continuing judge are both on Haiku. After it, the decider and the continuing judge are on Sonnet, and a replay or trial judge is on Haiku.

## What was found (run-mwodpw10-3d5748ab, read-only)

- **The trail did not grow across attempts.**
  - Judge 0117 (attempt 2) held 23 trail entries, all from its own saved-Flow run (0093-0115).
  - Judge 0091 (attempt 1) held its own 39 calls.
- **Raw captures caused the size.** Three of 0117's entries carried the host's raw capture of the page in `found.outputs.result.result.snapshot`:
  - The capture holds 650 interactive elements with bounds, frame and viewport.
  - Each such entry was about 670-685 KB as sent, against a 17 KB view of the same page in `found.view`.
- **Core's size estimate is too low.** It measures tokens as UTF-8 bytes ÷ 3.
  - Across the run's 37 calls with a reported count, Claude's tokenizer gave 2.02-3.00 bytes per token. Every judge request gave 2.02-2.03, so bytes ÷ 3 under-counts every judge request by about half.
  - Judge 0117's 2.22 MB request measured as fitting 1M tokens beside a 128k reply. The window fitting therefore stopped after summarising only `trail.entries[0..20].asked`.
  - Anthropic counted the request past the window and answered HTTP 400. Core read that as `llm.provider_http_error` and so the check as `not_judged`, three times.
- **The judge climbed with the decider.** Judges 0091 and 0092 ran on Opus with 211,484 and 212,416 input tokens, at $0.873 and $0.872. They read the same trail twice at full price.

## What changed and why

### 1. Raw captures out of the trail

`runtime/result-verification/run-trail/of/attempts.ts` now follows the generic rule; the extension repo is untouched.

- **When it applies:** only where the step has the domain's view after it (`stateRefs.afterAction.summary`, which names its page in `location`).
- **What is left out:** the object deepest in `outputs` that names that same page, by any member, and holds nothing deeper that names it too. That is the host's capture of the page the view already shows.
- **What replaces it:** `"[the host's capture of the page this step left: shown as found.view]"`.
- **What stays whole:** everything around it (validation, extracted rows, extraction account, records, where it moved) and the view itself.
- **No view after the step:** the outputs are kept as they are, so no page is lost.

### 2. A conservative measure, and a size refusal means "fit and resend"

- **`run-trail/window.ts`** (`automationStudioResultSummaryFormForWindow`) chooses which form of the judge's summary to send.
  - It measures each form at 1.8 bytes per token, below the densest judge request seen (2.02). It adds the person's words and 64 KiB of framing (about 48 KB measured in 0091).
  - It picks the first form that fits the judging model's window beside its reply. That is the whole summary wherever it fits.
- **The Flow-less judge** (`flow-less/judge.ts`) and **the run check** (`verify.ts`) send that form, with the shorter ones as the harness's own fitting.
- **On a size refusal** (`llm.provider_input_budget_exceeded`), both ask again with the next shorter form. A refusal reads as not judged only once no shorter form is left. Each form is tried at most once.
- **The Anthropic adapter.** `models/providers/anthropic/messages.ts` with the new `size-refusal.ts` now reads a 400 whose message says the prompt is too long or past the context limit, or a 413, as `llm.provider_input_budget_exceeded`, not retryable. That is the code Core's own adapter size check already uses. All other 400s stay `llm.provider_http_error`.

### 3. The judge stays on the attempt's base model (superseded in part by the redesign above)

`runtime/llm/role-routing/provider.ts` (`laddered`):

- The judge role is served on its own start rung however far the attempt has climbed. That is the attempt's base model, or the run's own judge model where one is named.
- The decider and the repair climb exactly as before.
- In `ladder-resolution.test.ts`, the expected judge call after a climb is now Haiku. A new test checks that the judge stays on Haiku after two climbs, while the decider is on Opus.

### 4. Cache breakpoint after the trail (for judges of their own)

- **Trail first.** `flow-less/judged-summary.ts` now places the trail right after the question (and the Run-again note). Everything up to the trail's end is then the same bytes from one check of an attempt to the next while the attempt only adds entries. The rows, views and reads that change come after it.
- **Splitting.** New `models/providers/anthropic/trail-cache-content.ts`, with `json-offset.ts` shared with `cache-content.ts`:
  - It splits a judge's user message into a head block, one block per trail entry, and a tail block.
  - It marks the last entry, and one entry 19 blocks earlier, so a call that added entries finds the earlier call's mark within Anthropic's 20-block lookback.
  - With the system prompt's marker, a request has at most 3 markers. The text is unchanged.
- **Wiring.** `runtime/llm/anthropic/request.ts` uses it for any task request that is not an evidence decision and has a trail.

## Commands run and observed results

### Final tree, after the redesign

All vitest runs used `node node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs`.

| Batch | Files | Tests |
| --- | --- | --- |
| b1 | 39/39 passed | 448 |
| b2 | 39/39 passed | 296 |
| b3 | 44/44 passed | 320 |
| b4 | 47/47 passed | 340 |
| b5a | 28/28 passed | 193 |
| b5b | 26/26 passed | 132 |
| b6a | 28/28 passed | 158 |
| b6b | 28/28 passed | 126 |
| b7a | 27/28, including `judge-continuation` (3) and `ladder-resolution` (8) | 236 of 237 |
| b7b | 27/27 passed | 200 |

The one failure is the pre-existing `llm/anthropic/tests/provider.test.ts` "unchanged task guidance" case. It expects no `thinking` on Sonnet, which t962 changed, and it fails the same way in the t963 tree.

Other checks:

- **Targeted `tsc`** over every changed source and test (scratch tsconfig, deleted afterwards):
  - first run: exit 2 with one error, `judge-continuation.test.ts(50,12): 'answer' is of type 'unknown'`;
  - after fixing it: exit 0, no errors.
- **`node scripts/structure-audit.mjs`:** `structure-audit: passed (557 warning(s), 911 baselined)`, after replacing one `as never` cast in the new test.
- **Paid probe:** the two-call Haiku probe described under "Redesign" (no balance error).

### Before the redesign (items 1-4 as first built)


All vitest runs used `node node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs` (both slots were held for long stretches because free memory was 1.2-2.2 GB).

First, the new and directly changed files (15 files): 4 failed.

| Failure | Cause | Fix |
| --- | --- | --- |
| raw-capture | The capture also names its page in a nested `navigation`, so the "deepest" rule dropped the wrong object | Rule changed to "outermost page-naming object inside an answer that names it" |
| judge-size ×2 | Test fixture had no shorter form left after the first | Fixture now has three page entries |
| judge-window | Expectation | Corrected: the routed judge says no window, so the default reply budget alone exceeds that model's window. It now tries every form once, each smaller, then is not judged |

The four affected files were then rerun directly: `Test Files 4 passed (4)`, `Tests 11 passed (11)`.

Folder batches on the final tree (all `runtime/result-verification`, the answer-first `completion`, `flow-run`, `trail`, `attempt`, `tests` and `carry-on` folders, `runtime/llm/role-routing`, `runtime/models/providers/anthropic`, `runtime/llm/anthropic`):

| Batch | Files | Tests |
| --- | --- | --- |
| b1 | 39/39 passed | 448 |
| b2 | 39/39 passed | 296 |
| b3 | 44/44 passed | 320 |
| b4 | 47/47 passed | 340 |
| b5a | 28/28 passed | 193 |
| b5b | 26/26 passed | 132 |
| b6a | 28/28 passed | 158 |
| b6b | 28/28 passed | 126 |
| b7a | 27/28 | 233 of 234 |
| b7b | 26/26 passed | 199 |

The one failure in b7a is the pre-existing `llm/anthropic/tests/provider.test.ts` case described under Outcome. Run in the t963 tree it also gives `Tests 1 failed | 23 passed (24)`.

Other checks:

- **Targeted `tsc`** over the changed sources and new tests, using a scratch tsconfig that is deleted afterwards: no errors, exit 0.
- **`node scripts/structure-audit.mjs`:** `structure-audit: passed (557 warning(s), 911 baselined)`, after removing one `catch` that read a parse failure as "no trail".

## Not verified

- **Live behaviour:** no live or paid run. In particular, whether the cache marker actually saves money on the second judge call of an attempt.
- **The continuation, live:** no live run has sent a continuing judge yet. The probe shows the judge's own format breaks the cache; it does not show a full continuation's `cache_read_input_tokens`, since a third call was not approved. The first live attempt's judge after a decision should report a large `cache_read_input_tokens` beside a small `input_tokens`.
- **Purse hold and window measure:** a continuing judge is held and measured by the harness at the standalone judge request's size. The real request is larger, but mostly cached reads.
- **Accounting of refused calls:** a refused-for-size call in `verify.ts` is retried inside one `askOnce`. Its intervention record is the final call's; the refused call is free (HTTP 400), but it is not recorded separately.

## Open questions or contradictions found

1. **Two files outside the listed paths.**
   - `runtime/llm/anthropic/request.ts` (the call site of the Anthropic split) needed a one-line change.
   - `runtime/result-verification/flow-less/judged-summary.ts` was edited to move the trail first. It is listed, under `runtime/result-verification/**`.
2. **Decider calls now get a size code too.** A provider size refusal of a *decider* call is now `llm.provider_input_budget_exceeded`, not `llm.provider_http_error`.
   - That code's disposition is `END_MODEL_CALLS` (`models/failures/disposition.ts`). The evidence loop already treats it as a size problem (a fresh, smaller round, then a setup ending).
   - Before, the same refusal was spent and asked again unchanged. I think the new behaviour is right, but it is a change for every Claude call, not only the judge.
3. **Every Anthropic call is under-measured.** Decide calls measured 2.37-3.00 bytes per token in the same run. Price holds and window checks for every Anthropic call use bytes ÷ 3, so they under-count by up to about 1.5×.
   - The judge is fixed here, but the shared estimator (`models/limits/token-estimation.ts`, the adapter's `measureInput`) is outside this task.
   - It could make a large decide request refused by the provider, or a purse hold too small.
