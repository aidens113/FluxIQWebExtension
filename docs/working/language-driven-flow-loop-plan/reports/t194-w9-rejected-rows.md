# t194-w9: the exploring model sees the rows each `where` condition rejected

## Outcome

Done. When `web.dom.extract_list` runs during exploration (`core.run_node` in a build or a re-author), the model's evidence now includes, for each condition that rejected anything, the condition's position, its rejected count and up to 3 of the rows it rejected. They sit in `read.rejectedRows`, next to the kept rows in `read.extracted`. The rows are never put in the Flow's parameters, the draft statement or its replay record. A playback does not ask for them, so the page never collects them. Both packages' `check` and full suites pass, and so does the structure audit. Every new or changed test fails against `HEAD` production code.

## Cause (at `HEAD`)

- `domain/src/runtime/llm-evidence/node-run/run.ts:361`: the model's read is `webNodeReadResult(result.payload, budget/4)`. For a list read, that payload holds only the kept rows (`extracted`) and the summary's counts.
- `domain/src/actions/extraction/summary.ts:4-10` and `:251-257`: the wire summary holds counts only (`conditions: {applied, kept, rejected[], unfiltered}`). `webAutomationExtractionSummaryValue` copies one field at a time, so anything else the page sent is dropped.
- `apps/extension/src/content/extraction/list-reader.ts:285-293`, `:548`: the reader does keep rejected rows, but only as a fallback for a read the conditions emptied (`filtered-answer.ts`). It never records which condition rejected which row.
- As a result, on `run-munq5s8x-6d620cdf` the build and the re-author saw only `conditions {kept: 8, rejected: [13,20,27,16]}`. Neither could see that `name not contains ["charging case", ...]` had removed three true earbuds named "... Wireless Charging Case ...".

## What changed and why

Samples are collected only when the command asks, and only the exploring node run asks.

- **Wire contract**: new file `domain/src/actions/extraction/rejected-samples.ts`.
  - `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY = "rejectedSamples"`. It is both the command parameter that asks and the summary member that carries the rows. It is typed `satisfies keyof WebAutomationExtractionSummary`, and the extension spells it the same way, so the two cannot drift.
  - Bounds: 3 rows per condition, 80 characters per value.
  - Reader `webAutomationExtractionRejectedSamplesValue`: requires one list per condition and only declared field keys; values must be strings or `null`. It cuts rows and values to the bounds.
  - `summary.ts` gains the optional `rejectedSamples` member and admits it only beside `conditions`. Malformed samples drop the whole summary, as every other malformed member does. The header comment names the exception.
  - Exported from the `index.ts` barrel.
- **Exploring node run**: new file `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`.
  - `webNodeDispatchParameters` adds `rejectedSamples: true` to the dispatched command, and only for an `extract_list` node that proposes. The Flow still keeps `ran` unchanged (`flowParameters`).
  - `webNodeReadWithRejectedRows` builds the read the model sees: the kept rows as `read-result.ts` bounds them, plus `rejectedRows: [{where, rejected, rows}]`.
    - Keys Core denies in evidence are screened out, as for kept rows.
    - The samples may use at most 1/3 of the read budget; the rest goes to the kept rows. If 3 rows per condition do not fit, it shrinks to 2, then 1, then drops them.
    - It also returns the payload with the samples taken out.
  - `run.ts` (+6 lines) dispatches with those parameters, shows that read, and passes the stripped payload to `webNodeReplayStatement`.
  - The samples live inside `evidence.read` and never as a new top-level member of the execution result. A test checks every result key against `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`.
- **Page**: new file `apps/extension/src/content/extraction/rejected-samples.ts`.
  - It keeps one list per condition, up to 3 rows each, with each value cut to 80 characters. A row that is already in a condition's list is not added again. A row several conditions rejected goes into each of their lists.
  - `list-reader.ts` (+11 lines, now 773 of the 800 limit):
    - new `ListExtractionOptions.sampleRejected` and outcome `rejectedSamples`;
    - notes each rejection;
    - writes the samples into every checkpoint and starts from `resume.rejectedSamples`.
  - `actions/extract-list.ts`:
    - passes `sampleRejected` only when `action.options.rejectedSamples === true` (the raw parameters travel in `options`, `gateway-mapping.ts:201`);
    - puts `rejectedSamples` on the summary only next to `conditions`.
- **Multi-page reads**: `shared/extraction-continuation.ts` adds `rejectedSamples` to `ExtractionCheckpoint`. `readExtractionCheckpoint` copies it and refuses a malformed one. The page re-applies the bounds to what it carries over, so the total stays at most 3 rows × number of conditions, however many pages are read.
- **Where the samples never go**:
  - **Playback**: `output-nodes/extract-list/dispatch.ts` dispatches the Flow's parameters, which never contain the key, so the page collects nothing.
  - **Stored data**: stored datasets read `extracted` (`recordsPath`), never the summary.
  - **Draft**: the draft statement and its replay record are built from `ran` and the stripped payload.

## Tests (each fails against `HEAD`)

Domain:
- `domain/src/actions/extraction/tests/rejected-samples.test.ts` (3): samples arrive next to the counts; they are cut to 3 rows × 80 characters; a malformed sample drops the summary, as does a sample without `conditions`.
- `domain/src/runtime/llm-evidence/node-run/tests/rejected-rows.test.ts` (3):
  - An end-to-end exploring extraction: detection, then `core.run_node` of `extract_list` with `name not contains ["ear tips","charging case"]`. The dispatched command asked, `read.rejectedRows` holds the "Pro Earbuds Wireless Charging Case" row, and every result key is one Core reads.
  - The same run: the model saw the row, but the draft (`ranWith.parameters`, `replay.produced.records` = 2, not the 3 a sample list would give) holds no sample text. A playback dispatch of the kept parameters, and Core's replay of the step, carry no `rejectedSamples`.
  - The size bound: the read stays within budget at 8000, 2000 and 1200 bytes, rows per condition shrink before they are dropped, and a flooded payload is cut to 3 × 80.

Extension:
- `apps/extension/src/content/extraction/tests/rejected-samples.test.ts` (4): which condition rejected which row, including the true earbuds; a read that was not asked keeps none, in the outcome or the checkpoint (contrasted with the same page when asked); the bounds and de-duplication; a multi-page read, where the checkpoint carries the samples and the next document continues from them, capped at 3.
- `apps/extension/src/content/actions/tests/extract-list-rejected-samples.test.ts` (2): a command that asks gets samples, which survive the domain's wire copy (`webAutomationActionResultPayload`) cut to 80 characters. A command that does not ask (no options, no key, or a non-`true` value) collects and carries none, contrasted with the asking command.
- `apps/extension/src/shared/tests/extraction-continuation.test.ts` (+1): samples cross the checkpoint, and malformed samples refuse it.

**Checked against `HEAD`** with scratch script `t194-w9-without-fix.mjs`. It rebundles the new tests with `run.ts`, `summary.ts` (domain) and `list-reader.ts`, `extract-list.ts`, `extraction-continuation.ts` (extension) replaced by their `git show HEAD:` contents, into ignored `.test-build-scratch/t194-w9-without-fix`, which I deleted afterwards. Domain: `# pass 0 / # fail 6`. Extension: 7 fail (all 7 new or changed tests). The 5 that pass are the pre-existing checkpoint tests. The first version of the two "not asked" guards passed against `HEAD`, because without the fix nothing ever asks. Each now also asserts the asked-for contrast.

## Commands run and observed results

Final runs, after the last source edit:
- `bash .../heavy.sh "t194-w9 domain check" pnpm --filter @fluxiq-web-extension/domain check` -> exit 0, no `error TS`.
- `bash .../heavy.sh "t194-w9 domain" pnpm --filter @fluxiq-web-extension/domain test` -> exit 0, `# tests 954 # pass 954 # fail 0`. The new tests are ok 50-52 and ok 521-523.
- `bash .../heavy.sh "t194-w9 ext check" pnpm --filter @fluxiq-web-extension/extension check` -> exit 0, no `error TS`.
- `bash .../heavy.sh "t194-w9 ext" pnpm --filter @fluxiq-web-extension/extension test` -> exit 0, `# tests 1355 # pass 1355 # fail 0`. On the previous full run, the new tests were ok 561-562, 750-753 and 1329.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (126 warning(s), 120 baselined)`, the same count as before my edits.
  - An earlier run failed 2 `contract-spread` findings (`rejected-rows.ts`, its test) and 1 `imports` finding (the test imported `output-nodes/extract-list/dispatch` rather than the barrel). All three are fixed.
  - `summary.ts` went past the 400-line advisory and was trimmed back to 400.
- An intermediate `check` failed on two test-only type errors: TS2352 in `rejected-rows.test.ts:112` and TS2345 in `extract-list-rejected-samples.test.ts:61`. Both are fixed.

I waited for the Lab prelude gate (`"step":"total"` in `run05.log`) to succeed before the first edit.

## Not verified

- No Lab or browser run (the brief forbids them). Whether a live build reads `rejectedRows` and fixes an accessory rule is unproven.
- Whether Core writes the model's evidence (the decision trail) into a Lab bundle or artifact. If it does, the samples would appear there as part of "what the model was shown". This repository's code puts them nowhere else. I did not read Core's evidence recording.
- That the plan resolver refuses a model-written top-level `rejectedSamples` beside `extractList`. `catalog-text.ts` says such keys are refused, but I did not test it. Playback dispatch (`output-nodes/extract-list/dispatch.ts:55`, not mine) passes top-level keys through, so a Flow carrying the key would collect samples during playback.
- A failed exploration read (`status !== "succeeded"`, e.g. a timeout) shows no samples. The refusal path reads counts through `action-failure/read-shortfall.ts`, which I do not own.

## Open questions or contradictions found

- The config comment in `scripts/structure-audit/config.mjs` says `domain/src/runtime/llm-evidence/` is not in `contractSpreadPaths`, but the audit enforces the contract-spread rule there. The comment is stale.
- Suggested defence in depth (files I do not own), for the supervisor to decide:
  - `domain/src/output-nodes/extract-list/dispatch.ts:55`: drop the key from playback parameters, e.g. `const { recordOutput: authored, rejectedSamples: _sampling, ...rest } = nodeParameters;` (or filter it by `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY`). This makes "a playback collects none" independent of the resolver.
  - `domain/src/client/gateway-mapping.ts:308`: withhold `extraction.rejectedSamples` for a sensitive `result.element`, as `secretSafeExtracted` already does for `extracted`. Today only the page's own refusal (D2) guarantees a sensitive read yields no rows.
- The extension cannot import the domain's bound constants (3, 80): `domain/client` reaches `actions/extraction` only through the explicit re-export list in `domain/src/actions/types.ts`, which I do not own. The page restates them, and the domain reader enforces them at the wire. One exact diff would share them: add `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_ROWS, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_CHARS, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY` to the `export { ... } from "./extraction"` list at `types.ts:214`.
- The working tree also holds uncommitted edits by another worker in `summary.ts` (`rate_limited`) and `pagination.ts`. I edited `summary.ts` in separate regions and left theirs intact.
