# w2-catalog-end-and-sanitizer

Worker report. Date: 2026-09-16. Paths: `FB/` =
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\flow-bootstrap\`,
`CUI/` = `F:\!FluxIQWebExtension\packages\test-runner\src\demo-llm-create-ui\`.

## Outcome

Done. Both failures are root-caused and fixed, each with tests that failed
first. The coordinator's mid-task question (why the live form Flow had no
`web.dom.select`) is answered and fixed too. Its cause was ranking, not the
byte budget. Nothing was committed.

## What changed and why

### 1. The required `end` node dropped from the catalog (Core)

**Root cause, measured** with the web domain's real 18 definitions and Core's
builtins, using the domain test's instruction and its 3,000-token context:

- `automationStudioFlowBootstrapCatalogByteBudget({maxInputTokens: 3000, instructionBytes: 145})`
  = **3,761 bytes** (Core `dist`; the `src` gives 3,757).
- Required terms, in order: `enter, choose, submit, verify, start, end`. Those
  map to `dom-type, dom-select, dom-click, dom-wait_for_text, builtin.control.start, builtin.control.end`.
- Bytes per entry, before `59dbb22` -> now:

  | Entry | Before | Now |
  | --- | --- | --- |
  | dom-type | 689 | 843 |
  | dom-select | 737 | 891 |
  | dom-click | 603 | 757 |
  | dom-wait_for_text | 579 | 733 |
  | start | 418 | 418 |
  | end | 397 | 397 |

  Including brackets and commas, the required set grew from **3,430 to 4,046
  bytes**. It was appended greedily in order, so after 3,648 bytes `end`
  (397 + 1) no longer fit, and `missingRequiredTerms` came back as `['end']`.
- The growth is **not** the node descriptions: every web node description is
  already under 80 characters, except `extract_list` at 119. It is the web
  `expectedState` object parameter, whose 145-character description the
  catalog now sends. That adds +154 bytes to every web action entry. Across
  the full catalog (59 entries) the total is 38,484 bytes, and `dom-extract_list`
  is the largest entry at 1,776 bytes, 1,270 of them parameters.
- Bounding description growth would not fix this: the text involved is well
  under every limit. The defect was the ordering. Required entries competed
  with their own optional text.

**Fix, `FB/plan/catalog.ts`.** Required definitions are now reserved first in a
*condensed* form: the description is cut at 80 characters, and parameter
descriptions and examples are left out. Ports, parameter ids, types, defaults,
options, constraints and output actions are unchanged, so validation behaves
the same. Then each reserved entry is upgraded to its *whole* form, in order,
if the growth fits. An entry that cannot grow stays condensed, and a later,
smaller one may still grow. After that come the preferred entries, then the
ranked ones, both whole only. A required term is missing only when its
condensed form cannot fit. The `usedBytes` accounting still equals
`Buffer.byteLength(JSON.stringify(nodeCatalog))`, and the tests assert this.
For the domain test's context, the result is 6 entries: type and select whole,
click and wait_for_text condensed, and nothing missing.

`FB/plan/limits.ts` is unchanged: no limit needed to move.

**Tests, `FB/plan/tests/catalog.test.ts`, plus a new fixture
`FB/plan/tests/web-domain-definitions-fixture.ts`.** The fixture is the web
domain's 18 definitions reduced to the fields the catalog and registry read.
Core never imports the domain, so it is a copy. I checked it against the real
definitions: the catalog JSON was byte-identical in all 20 combinations of 4
instructions and 5 budgets. The new rows:

- Required nodes are all kept when their whole text does not fit; the condensed
  form has no parameter description and an 80-character description.
- Required nodes are sent whole when the budget allows, before any other node.
- A required node is still reported missing when even its condensed form does
  not fit.
- The web definitions keep every required node at the domain's 3,000-token
  context.
- A sweep of budgets from 3,000 to 20,000 tokens in steps of 250: nothing is
  missing and `usedBytes` is exact. It covers the form instruction, and a
  scrape instruction of 1,536 bytes from 4,000 tokens. At 3,000 tokens a
  1,536-byte instruction leaves about 2,370 bytes, which fits five nodes in no
  form, so that case genuinely cannot fit.
- The required web actions are sent whole in the live 4,000-token context.

### 1b. Coordinator question: `web.dom.select` absent from the live form Flow (Core)

The live run was `run-mu4u2qui-969f0f76`, with the instruction "Fill in the form
with Ada as the name and the Team plan, then submit it." I reconstructed the
exact catalog the model was offered, using the real definitions and the
evidence-guided path in `service.ts`:

- The instruction text is the title "Evidence-guided generation goal", a
  newline, then the body.
- `maxCatalogEntries` is 12.
- The budget is computed from `resolveAutomationStudioLlmInstructions` JSON
  (442 bytes), giving **6,460 bytes**.

The catalog offered was **6 entries, 3,420 bytes**: `end, start,
get-variable, set-variable, dom-click, dom-type`. The same six came back under
the committed code and under my catalog fix.

- **Select was not squeezed out by the budget.** More than half the byte
  budget and half the entry cap were unused.
- **The cause is ranking.** The required terms are only `fill` (-> type) and
  `submit` (-> click). No word of the instruction scores `dom-select`
  ("plan" and "team" are field values), and ranking drops zero-score
  definitions, so select was never a candidate. The same holds before
  `59dbb22`: the filter predates it.
- **"An earlier run on older Core emitted select" is not supported by the
  artifacts.** Every earlier run whose `snapshots/flow-lane.json` contains
  `web.dom.select` is a recording-lane run: `run-mtxn8uhk`, `run-mtz1...` and
  `run-mtz2...`, `basic-form`, 2026-09-12, with a proposal and mapper id. The
  only two created-Flow runs, `run-mu4t20d1-93b60760` and
  `run-mu4u2qui-969f0f76`, both built click ×2 + type ×1 with no select.
- No other form verb was dropped by the budget either.

**Fix, `FB/plan/ranking.ts`.** I added `BOOTSTRAP_IMPLIED_INTENTS`: an
instruction containing the word `fill` *prefers*, but never requires, the best
definition of the select intent group. It is placed ahead of tag preferences.
It is preferred, not required, so a domain without a select node, or a catalog
without room for one, fails nothing. I also extracted the repeated "best
candidate" code into `bestBootstrapDefinition`, and renamed a
`preferTaggedDefinitions` parameter to `alreadyChosenIds`.

With the fix, the live catalog includes `web.output.dom-select`. Three new
tests, using the real web definitions and the live wording:

- Select is offered and required terms are unchanged.
- Creation still builds when select does not fit.
- An instruction that only enters text is not offered select.

### 2. `failure-sanitizer.test.ts` failure (this repository)

**Root cause.** The failing assertion was the "out-of-bounds token count" row,
`accounting.totalTokens: 50001`, which expected the response to be refused.
`6be4698` deliberately made a failure record's accounting a build's
**cumulative** totals: `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS`
= `maxIterations` (64) × 50,000 = 3,200,000. So 50,001 is now valid, and Core's
record is correct. The test's literal was stale. The observed failure was
`expected 'generation.http-400'`, actual `'generation.provider-output-validation'`,
at line 253 of the built test.

The new record shape also carries `issueCodes` (up to 16 strings matching
`/^[a-z0-9_.:-]{1,100}$/i`), and evidence-loop counts now follow the loop's
limits (`evidenceBytes` up to 1,048,576). The old sanitizer silently dropped
`issueCodes`, which was safe but meant a run could not say why a plan was
refused.

**Changes:**

- **`CUI/tests/failure-sanitizer.test.ts`.** The out-of-bounds row now uses
  `Number.MAX_SAFE_INTEGER`. A new row checks that a build total of 50,001 is
  kept.
- **`CUI/generation-failure.ts`.** The sanitized failure now has
  `issueCodes?` and `issueCodesWithheld?`.
  - A code is admitted only when all three hold:
    - it is a lower-case dotted identifier
      (`/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/`);
    - it is at most 64 characters, so the evidence recorder can name it;
    - it comes from a vocabulary built of literals:
      - by exact value: Core's published `AUTOMATION_STUDIO_PLAN_PARAMETER_ISSUE_CODES`
        or the domain's published `WEB_PLAN_HANDLE_ISSUE_CODES`;
      - by namespace: `bootstrap.`, `record_output.`, `record_schema.` or
        `web.extract_list.`.
  - Everything else is only counted.
  - I checked that Core builds all 71 of its `bootstrap.*` codes from literals,
    with none templated. The longest is 43 characters.
  - The consumers (`build-flow-ui.ts`, `explore-proposal-ui.ts`) use none of
    the other new record fields.
- **`CUI/exploration-failure-evidence.ts` (new).** It holds
  `recordExplorationGenerationFailure`, moved out of `explore-proposal-ui.ts`
  and exported from `CUI/index.ts`.
  - It records one `exploration-plan-issue` diagnostic per admitted code, and
    `plan-issue.withheld` with `withheldCount` when codes were withheld.
  - **Latent crash fixed:** the recorder throws on any fact above 1,000,000,
    and Core now admits `evidenceBytes` up to 1,048,576. A long exploration
    that failed would therefore have thrown "Evidence diagnostic facts are
    invalid" instead of reporting its failure. Such a count is now omitted and
    `evidenceBytesOverMillion: true` is recorded instead.
- **Tests:**
  - `CUI/tests/refused-plan-issue-codes.test.ts` (new) covers kept and
    withheld codes, `evidence_unusable_decision`, a message-shaped list that
    Core refuses (nothing leaks), and a record with no codes (no fields added).
  - `CUI/tests/exploration-failure-evidence.test.ts` (new) goes through the
    **real** `BrowserEvidenceRecorder`: issue codes are recorded, the withheld
    code is absent, `evidenceBytes` of 1,000,000 is kept, and 1,048,576 is
    flagged without throwing.
  - The issue-code test was first written inside `failure-sanitizer.test.ts`.
    I moved it out when the file passed the 400-line advisory limit (it is now
    351 lines).
  - The helper was first named `generation-failure-evidence.ts`. I renamed it
    because the structure audit failed on three `generation-` files.

## Commands run and observed results

Core (`F:\!FluxIQ`):

- `npx vitest run .../flow-bootstrap/plan/tests/catalog.test.ts`:
  - before the fix: 3 failed, 12 passed. Two failures reproduced
    `expected [ 'end' ] to deeply equal []`, one of them at `3000 tokens, 3757 bytes`.
  - after the catalog fix: 15/15.
  - with the select test added, before the ranking fix: 1 failed (6 entries,
    no select), 17 passed.
  - after the ranking fix: **18/18**.
- `pnpm check` (structure tests, `structure-audit`, `pnpm -r check`): **exit 0**.
  It printed `structure-audit: passed (148 warning(s), 254 baselined)`; none of
  the warnings names a flow-bootstrap/plan file.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap`:
  **5 files, 114/114 passed**.
- Catalog consumers,
  `npx vitest run runtime/llm runtime/tests/service-bootstrap runtime/tests/deepseek-bootstrap-exploration.test.ts runtime/tests/llm-deepseek-flow-bootstrap.test.ts runtime/tests/native-node-runtime.test.ts runtime/loop-limits api/handlers/tests/llm-generation.test.ts _shared/tests/runtime-llm-grants.test.ts`:
  **35 files, 374/374 passed**.
- `npx tsc -b tsconfig.build.json` then
  `node ../../scripts/rewrite-declaration-imports.mjs dist` in `packages/fluxiq`:
  both exit 0, and the new `catalog.js`/`ranking.js` were written at 18:28.
  **This was an incremental build, not `pnpm build`**: `--clean` would have
  deleted `dist` under other workers. It also compiled other workers'
  uncommitted Core source into `dist`.

This repository:

- `DOMAIN_TEST_BUILD_LABEL=w2-catalog-end node domain/scripts/test-domain.mjs`:
  **no entry failed to load**, so `domain.test.ts` loaded and all of its
  top-level assertions passed (lines 189, 197, 225-229, 262, 266-267).
  613 tests: **599 passed, 14 failed**. All 14 failures are in
  `runtime/llm-evidence/tests/`:
  - `target-override` ×6
  - `sanitize` ×3
  - `renamed-save-override` ×2
  - `tools` ×2
  - `packet-carries-no-selector` ×1

  Their source and tests (`repairable-parameters.ts`, `sanitize.ts`,
  `target-override.ts` and their tests) are currently modified by another
  worker, and none of the tests touches the catalog. I used a label, so the
  tracked `domain/.test-build` was not rewritten; I changed no domain source.
- `node --test` on the sanitizer tests: with the committed sanitizer and the
  old inline evidence code swapped in, **3 of 7 failed** (issue codes absent;
  the recorder threw past 1,000,000). With my code restored, **7/7 passed**.
- `pnpm check` (repo root): at first **exit 1**, with
  `[naming] ... 3 files share the prefix "generation-"`. After the rename,
  **exit 0**, `structure-audit: passed (61 warning(s), 17 baselined)`.
- `pnpm test` in `packages/test-runner`: **exit 0, 1096/1096 passed**. I ran it
  twice, before and after the rename.
- I removed my untracked scratch builds (`domain/.test-build-scratch/w2-catalog-*`)
  and the stale `dist` outputs from before the rename.

## Not verified

- **No live run** (the brief forbids them). Whether DeepSeek now emits a select
  node for the form task is unproven. The catalog now offers one.
- **Core's full `pnpm test` and the full runtime suite were not run.** I ran
  only the flow-bootstrap suite and the 35 consumer files.
- **This repository's other packages** (`apps/extension`, `scenario-lab`,
  `test-contracts`, `test-evidence`) were not tested. Only `domain` and
  `test-runner` were run, plus the repo-wide `pnpm check`.
- **The 14 `llm-evidence` failures** were not checked against a Core `dist`
  without other workers' changes. I attribute them to the in-progress
  `llm-evidence` work by file ownership and test subject only.
- **Behaviour at every budget below 3,000 tokens** was not swept; the sweep
  starts at 3,000.

## Open questions or contradictions found

1. **Core doc is now incomplete** (`F:\!FluxIQ\docs\architecture\automation-studio\llm-flow-bootstrap.md`,
   lines 37-41; not my file). Proposed replacement for "Required intent groups
   are selected first. If a viable required group is unavailable or cannot
   fit, the context records it as missing…":
   > Required intent groups are selected first, each reserved in a condensed
   > form (description cut at 80 characters, no parameter description or
   > example) and then sent whole, in order, while the byte budget allows, so
   > longer node or parameter text can never leave a required node out. An
   > instruction that says "fill" also prefers, without requiring, the select
   > group's best node, because a form's choice lists are not named by its
   > values. If a viable required group is unavailable or cannot fit even
   > condensed, the context records it as missing…
2. **The domain should publish its extract-list issue codes** as a runtime
   list, for example `WEB_AUTOMATION_EXTRACT_LIST_ISSUE_CODES`, from
   `domain/src/output-nodes/extract-list/issues.ts` (another worker's area).
   The sanitizer could then admit those codes by exact value instead of by the
   `web.extract_list.` namespace. The union today has 16 literals.
3. **`catalogSelection` does not say which required entries were condensed.**
   If that is wanted for diagnosis, `FB/plan/contracts.ts` (not mine) would
   need a field such as `condensedIds: string[]`, filled from the reserved
   entries that did not grow.
4. **Latent: `CUI/build-flow-ui.ts` passes token totals straight into recorder
   facts, which are capped at 1,000,000.** Core now admits totals up to
   3,200,000. It is unreachable today, because that path makes one bounded
   call (≤ 50,000 tokens). I left it unchanged.
5. **Ownership overlap in `CUI/`.** Another party has uncommitted edits in the
   same directory: new `applied-binding.ts` and `tests/applied-binding.test.ts`,
   a modified `apply-proposal-ui.ts`, and the `applied-binding` export line in
   `CUI/index.ts`. My `index.ts` edits sit beside that line, so commit both
   together. With my new file the directory has 16 files, past the 15-file
   advisory (a warning, not a failure).
6. **Optional domain improvement** (another worker's area): tag
   `dom-select` with dropdown vocabulary (`dropdown`, `choice`), so
   instructions that name a dropdown without "select"/"choose" prefer it
   through the existing tag mechanism.
