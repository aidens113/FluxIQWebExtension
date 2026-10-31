# w3-cited-yes report

## Outcome
Partial. The feature is built and checked. Four tests fail by design: they compare the verification prompt with `system-prompt-pins.json`, which I may not touch. The lead updates the pin.

## What changed and why
RT = `C:/Users/osrs_/FluxStuff/fxwork/t810/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.

- **RT/llm/verification-checked/** (new: `schema.ts`, `well-formed.ts`, `index.ts`, `tests/well-formed.test.ts`). Same style as `verification-defects`.
  - Shape: at most 12 items `{row, column, value}`, closed, each text bounded to 500 characters.
  - Malformed entries are dropped, as are entries past the twelfth.
- **RT/llm/harness/structured-response.ts**: new type `AutomationStudioLlmVerificationChecked`, and `checked?` on the diagnosis fields. `harness/index.ts` exports the type.
- **RT/llm/harness/provider-result.ts**:
  - `checked` is an allowed diagnosis key.
  - Malformed entries are dropped, with the warning `llm_output.diagnosis_checked_dropped`.
  - The read copy is rebuilt from the well-formed entries.
- **RT/llm/harness/context-packet.ts**: `checked` is re-read key by key on the way out.
- **RT/llm/deepseek/output-schema.ts**: `checked` sits beside `defects` on the verification diagnosis only, and is not required.
- **RT/llm/diagnosis-instructions.ts**: one sentence appended to the end of the verification instruction. "When you answer yes, list in diagnosis.checked the stored rows you checked, each as its label in row, a stored column in column and that row's own value there in value, the cell that shows the request asks for it; Core looks each up in the stored rows, and a yes citing a cell the result does not hold is not taken as a yes." No scenario content.
- **RT/result-verification/cited-yes/** (new; barrel; one export per file):
  - `stored-cells.ts` reads the answer's stored rows and skips working sets. It reports `complete: false` when Core holds only a sample or none.
  - `citation-refuted.ts` returns Core's sentence for a citation it cannot find, or nothing.
    - Row: matched by label with the row-id prefix stripped.
    - Column: matched by the same letters-and-digits fold the located defects use.
    - Value: matched by the same fold located-defects uses on cells.
    - Sentences never quote the stored cell, and judge text is cut at 120 characters.
  - `yes-citations.ts` returns `{cited, refuted}`, or nothing when no `checked` was given. A cited row Core does not find is refuted only when `complete` is true. A build test's answer holds no cells, so none of its citations is refuted.
  - Test: `tests/yes-citations.test.ts`.
- **RT/result-verification/verdict/result-verdict.ts**:
  - A yes carries `yesCitations` when `checked` is given, including on the held-yes return.
  - A yes with any refuted citation returns `unsure`, code `yesCitationRefuted`, basis `model`, with a failure record. It keeps `answeredReading` and `yesCitations`.
  - The check runs after the existing refusal gates, so `does_not_answer` outcomes keep priority. A held yes (exclusion evidence missing) stays held.
  - A yes with no `checked` is unchanged.
  - I did not edit `codes.ts` or `contracts/`; both were already in place.
  - The header comment in `verdict/index.ts` is updated.
  - Test: `verdict/tests/cited-yes.test.ts`.
- **Existing tests updated**:
  - `llm/deepseek/tests/output-schema.test.ts`: key lists and a new `checked` test.
  - `llm/tests/diagnosis-channel.test.ts`: key list.
  - `llm/deepseek/tests/system-prompt.test.ts`: new `CHECKED` constant, the `endsWith` assertion, and the once-each list.

## Commands run and observed results
- `pnpm check` (in packages/fluxiq, under the heavy lock): exit 0.
- `pnpm test` over `RT/result-verification/cited-yes`, `RT/result-verification/verdict`, `RT/llm/verification-checked`, `RT/llm/verification-defects`, `RT/llm/deepseek/tests` and all of `RT/llm/tests` (which includes diagnosis-channel and the prompt-contract tests):
  - `Test Files 1 failed | 46 passed (47)`
  - `Tests 4 failed | 688 passed (692)`
  - The 4 failures are all in `system-prompt.test.ts`: byte-identical for `loop_verification`, byte-identical for `loop_verification_build_test`, and the two matching "keeps every word of Core's message" cases. All four compare against the pin file.
  - An earlier run had 8 failures. Four were my fixtures and key-list tests, now fixed. The other four are the pin drift above.
- Downstream, from `fxwork/t810/!FluxIQWebExtension`: `node scripts/check/model-text.mjs` printed `model-text: ok (208 scenario tokens, 386 model-facing Core files, 11919 string literals)`, exit 0.

## Pin drift for the lead
- The pin file is `RT/llm/deepseek/tests/system-prompt-pins.json`. The keys `loop_verification` and `loop_verification_build_test` each need the sentence below appended at the very end, after a single space. The current text ends with "...answer unknown when the evidence cannot settle a requirement."
- Sentence to append: `When you answer yes, list in diagnosis.checked the stored rows you checked, each as its label in row, a stored column in column and that row's own value there in value, the cell that shows the request asks for it; Core looks each up in the stored rows, and a yes citing a cell the result does not hold is not taken as a yes.`
- Regenerate by pinning `automationStudioDeepSeekSystemPrompt(...)` for the two cases. No other pinned case changes.

## Not verified
- No model calls were made. Whether the model actually fills `checked` is untested.
- No end-to-end test of `verify.ts` with a cited yes. The other worker's re-ask code that reads `yesCitations` is not exercised.
- Not run: the full `RT/result-verification` suite, apart from `verdict/`. The existing `tests/verdict.test.ts` did not break (it lives in the `RT/result-verification/tests` folder, which I did not run), and no verdict behaviour changed for a yes without `checked`.

## Open questions / doc notes
- Edited outside the literal owned list, because the harness validation had to accept the field: `llm/harness/{structured-response,provider-result,context-packet,index}.ts`, `llm/deepseek/output-schema.ts`, `llm/deepseek/tests/{output-schema,system-prompt}.test.ts` and `llm/tests/diagnosis-channel.test.ts`.
- Choices to confirm:
  - A citation of a row Core does not hold is not refuted when Core holds only a sample of the answer. I judged that safer than a false refutation.
  - A refuted yes returns `unsure` with the failure record, as `requestedOutputHeld` does.
- Doc note for `docs/architecture` (verification section): a yes may carry `diagnosis.checked`. Core checks each cited cell against the stored rows. The verification records `yesCitations {cited, refuted}`. A refuted citation makes the yes `unsure` with code `core.result.yes_citation_refuted`. A yes with no `checked` is unchanged.
