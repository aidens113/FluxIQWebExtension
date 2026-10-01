# t210 report: remove the caps that remain on what the model sees

## State at stop (2026-09-30, rounds 3 and 3b done, uncommitted)

**Rounds 3 and 3b are complete and validated, not committed.** Every change is
an unstaged working-tree change in the Core tree (`fxwork/t210/!FluxIQ`, branch
`task/t210-remove-remaining-caps`, HEAD `c070c94b`). Downstream, only this report
changed.

Checks run after the last source edit:

- `npx tsc --noEmit -p .`: exit 0.
- `node scripts/structure-audit.mjs`: `passed (203 warning(s), 353 baselined)`.
- `pnpm docs:check`: `passed` and `Deterministic framework reference is current.`
- Full vitest over
  `runtime/{conversations,llm,recovery,result-verification,flow-bootstrap,service}`:
  `Tests 3 failed | 2648 passed | 1 skipped (2652)`. All three are 15 s
  timeouts under load.
- The two files with those timeouts, alone: `Tests 30 passed (30)` at the
  default timeout, and again with `--testTimeout=120000`.

**Ready to commit:** everything listed under "Round 3: files" and
"Files (round 3b)".

**Exact next step:** the supervisor verifies and commits on the Core task
branch. Open choices:

- the run-summary window, still 100 runs, at `resolve-context.ts:40`. It feeds
  the training budget and stability, not a model;
- passing `offset` through the person-facing reusable-context list endpoint.

Task t210, branch `task/t210-remove-remaining-caps` in both trees:
`C:/Users/osrs_/FluxStuff/fxwork/t210/!FluxIQWebExtension` (downstream) and
`C:/Users/osrs_/FluxStuff/fxwork/t210/!FluxIQ` (Core). No commit was made and no
Lab was run.

The user's order, verbatim: "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS
PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE ANY RANKING ALGORITHM."

These stay in place: secret and denied-key screening, the $0.25 per-build
spend ceiling, and the model's 1,000,000-token context window as the only bound
on a request.

## Outcome

Done. All four brief items are complete:

1. Core's default token cap is removed, with a migration for stored Flows.
2. The read account (F14) caps are removed.
3. The rejected-row sample caps are removed on both sides, and the secret
   screen still applies.
4. The sweep found further caps on the model path and removed them.

Every listed check passes. Some Core service tests failed on wall-clock
timeouts before they passed; see "Commands run" for those runs.

## What changed and why

### 1. Core's default `maxTokensPerRun: 12000`

**The default is gone.**
- `model/flows.ts`: the default Flow settings no longer carry
  `budgets.maxTokensPerRun`.
- New Flows are written with `tokensPerRunDefaultCleared: true`. The key is
  defined in the new file `model/tokens-per-run-default-cleared-key.ts`
  (`AUTOMATION_STUDIO_TOKENS_PER_RUN_DEFAULT_CLEARED_KEY`) and exported from
  the model barrel.

**The migration.**
- New file `runtime/service/flow-settings/tokens-per-run-default-migration.ts`,
  exporting `withoutAutomationStudioTokensPerRunDefault`.
- It clears exactly `12000`, and only on a Flow that does not carry the key.
  After clearing, the Flow carries the key. Any other value is left alone.
- It is applied the same way as the existing locked-default clearing:
  - when a Flow is read: `service/flows/store.ts`, `getFlow`;
  - when settings are resolved: `merged-metadata.ts`.
- Why a stored 12,000 can be treated as the default: the web form saved this
  field only when it differed from 12,000, so no person ever stored 12,000 as
  their own choice.

**The web settings form** (`apps/web/.../settings/flow-settings-model.ts`):
- A blank box means no cap, and it is the new default.
- Validation now accepts blank. A typed value must be 128 to 1,000,000.
- The Effective Values list shows "No limit" for a blank box.
- The save writes the value only when the box is not blank.
- `flowSettingsMetadata` no longer adds 12000 to new Flows.
- Every save writes `tokensPerRunDefaultCleared: true`, so a 12,000 a person
  types later is kept.

**Tests:**
- `tests/tokens-per-run-default-migration.test.ts` (new).
- `locked-default-migration.test.ts`: the budgets case now expects no token
  cap.
- `service-flows/tests/creation.test.ts`: asserts no cap and the key.
- Web: `settings-round-trip.test.tsx` covers a blank box (no cap) and a typed
  12000 (kept, with the key). `settings-view.test.tsx` checks the box no
  longer renders 12000.
- Docs: a migration note in `docs/architecture/package-boundaries.md`.

### 2. The read account (`runtime/result-verification/read-account/`)

**Removed from `accounts.ts`:**
- `MAX_READS` (4), `MAX_CONDITIONS` (8) and `MAX_DEDUPE_KEYS` (6).
- The `withheld` member of the return value, which no longer has anything to
  report. `result-summary.ts` and `verdict.ts` were updated to match: the
  sentence no longer mentions "a read left unaccounted".

**Removed from `condition.ts`:**
- `MAX_CONDITION_LENGTH` (200), `MAX_OPERAND_LENGTH` (60) and `MAX_OPERANDS`
  (6, with its "and N more").
- The length bounds in the `WORD` (`{0,31}`) and `NAME` (`{0,63}`) patterns.
  The character classes stay.
- The locator and secret screens stay.

**Tests:** `accounts.test.ts` gains the block "a read's account has no caps":
- 12 reads;
- 20 conditions, each with 20 long values;
- 8 dedupe keys;
- a long value found by a condition's own read;
- an attribute name of more than 100 characters.

**Also:** a comment in `contracts.ts` was corrected.

### 3. Rejected-row samples

**Extension** (`content/extraction/rejected-samples.ts`):
- `ROWS_PER_CONDITION` (3) and `CHARS_PER_VALUE` (80) are removed.
- Identical rows are still collapsed to one per condition. That is
  de-duplication, not a cap.
- Comments updated in `list-reader.ts`, `actions/extract-list.ts` and
  `shared/extraction-continuation.ts` (the checkpoint contract).

**Domain** (`actions/extraction/rejected-samples.ts`):
- The exported constants `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_ROWS` and
  `WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_CHARS` are removed, and the reader
  copies every row whole.
- Comments updated in `node-run/rejected-rows.ts` and `summary.ts`.

**Screening stays.** Rows still go through `webNodeReadResult`, which drops
denied keys and withholds secret-shaped strings. A new test in
`rejected-rows.test.ts` passes a card number in an uncapped row and checks that
it is withheld while the rest of the row stays whole.

**Tests now assert:** 41 and 200 rows arrive, values of 5,000 or more
characters arrive whole, and a multi-page read keeps a fourth row.

### 4. Sweep

**How it was done:**
1. I read t200's inventory.
2. I diffed every non-test source file the lanes changed between t200's base
   and the pre-t200 merge, plus t208's merge, in both trees. That is 324
   downstream files and 189 Core files.
3. I searched the added lines for count, slice, top-N, byte and character
   bounds.

**Removed, because they bound what a model is shown:**

| Where | Cap | Reaches the model through |
| --- | --- | --- |
| extension `content/extraction/item-filter.ts` | `SEEN_CHARS` 60 | `conditions.seen`, to the judge |
| domain `actions/extraction/seen-values.ts` | `WEB_AUTOMATION_EXTRACT_CONDITION_SEEN_CHARS` 60 (exported; removed) | the same |
| Core `service/summaries/extraction-summary.ts` | `MAXIMUM_SEEN_CHARACTERS` 60 | the same |
| Core `service/summaries/extraction-summary.ts` | `MAXIMUM_CONDITIONS` 64 (more than 64 dropped the whole condition report) | the judge |
| Core `flow-bootstrap/instructed-acts/instruction-acts.ts` | `MAX_ACTS` 8 and `MAX_QUOTE` 200 | the act checklist the build model is shown |
| Core `flow-bootstrap/instructed-acts/instruction-choices.ts` | `MAX_CHOICES` 4 and `MAX_QUOTE` 120 | the same |
| Core `flow-bootstrap/instructed-acts/check.ts` | `MAX_LISTED_STEPS` 100 and `stepsWithheld` | the completion refusal |
| Core `flow-bootstrap/instructed-acts/check.ts` | `MAX_CLAIMS` 16 | see note 1 |
| Core `flow-bootstrap/unfinished-build/judgement.ts` | `slice(0, 16)` on test codes, `actsTodo` and `lastRefusedFor` | the repair's first decision |
| Core `recovery/refuted-result/step-failure-brief.ts` | `MAX_BRIEF_CHARS` 6,000 and `MAX_VALUE_CHARS` 1,200 | the re-author brief |
| Core `flow-bootstrap/reachability/check.ts` | `MAX_FEEDBACK_STEPS` 100 and `stepsWithheld` | see note 2 |
| Core `flow-bootstrap/answerability/check.ts` | `MAX_FEEDBACK_STEPS` 24 and `stepsWithheld` | see note 2 |

1. `MAX_CLAIMS` read only the first 16 of the model's claims. With acts no
   longer capped, a build with more than 16 acts and choices could never be
   completed.
2. These two caps predate the lane work. They are the same pattern as
   `check.ts` and sit on the build-decision path.

**Tests for the sweep:**
- `instruction-acts.test.ts`: a 12-act instruction, and a quote of more than
  200 characters kept whole.
- `instruction-choices.test.ts`: 6 choices on one item.
- `check.test.ts`: 120 listed steps, and a claim at position 22 that is still
  read.
- `reachability/tests/check.test.ts`: 120 steps.
- `answerability/tests/check.test.ts`: 40 steps.
- New `unfinished-build/tests/judgement-value.test.ts`: 40 acts and 30 codes.
- `extraction-summary.test.ts`: 200 conditions, and 5,000-character seen
  values.
- `item-filter.test.ts`: a 100-character seen value.
- Domain `seen-values.test.ts`: a 5,000-character seen value.

**Listed and left, because they bound something other than the information a
model receives:**

- **Format checks and the model's own output:**
  - `read-account/accounts.ts` `STOP_WORD` `{1,40}`: a closed-word format
    check.
  - `instructed-acts/check.ts` `MAX_CLAIM_TEXT` 200: the length of one claim
    id the model wrote.
  - `plan/evidence-schema.ts` `step` `maxLength: 16`: the model's output
    schema.
- **Search bounds of Core's own derived heuristics**, treated as t200 treated
  the identity heuristics:
  - `instructed-acts/choice-evidence.ts` `MAX_DEPTH` 6 and `MAX_VALUES` 200;
  - `reachability/location-agreement.ts` `MAX_VALUES_PER_STEP` 64 and depth 6;
  - extension `content/extraction/detect-pagination.ts`
    `MAX_ANCESTOR_LEVELS`;
  - extension `content/action-runtime/ignored-press/press-scope.ts`
    `SCOPE_LEVELS` 4.

  Risk: the first two can make Core report "not done" for a choice set deep
  in a large input.
- **The navigation guard's memory,** which is never sent to the model:
  - `domain/.../node-run/shown-addresses.ts`: `REMEMBERED_ADDRESSES` 512,
    `REMEMBERED_TYPED` 16, `REMEMBERED_BUILDS` 16, `MAX_READ_DEPTH` 6 and
    `MAX_READ_STRINGS` 256;
  - `domain/.../sanitize.ts` `MAX_PAGE_QUERY_PAIRS` 16 (binding only).

  Risk: a whole-page packet with more than 512 links pushes earlier addresses
  out of the guard's memory. A later navigation to one of them could be
  refused falsely.
- **Retry, round and time bounds:**
  - `MAX_EXTRA_PRESSES` 1;
  - `MAX_PACE_WAIT_MS` 30 s;
  - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS` 6 and `MAX_REPAIR_ROUNDS` 2;
  - `AUTOMATION_STUDIO_PERSON_NEEDED_MAX_ASKS` 3;
  - `AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS` 3.
- **Display only**, shown to a person and never to the model:
  - panel `chat/conversation/read/failure.ts` `DETAIL_MAX` 160;
  - `CHAT_STEP_MESSAGE_LIMIT` 1,000;
  - `panel/automations/rows.ts` `ROW_LIMIT` 30;
  - web `conversation/activity/history.ts` limits (10 units, 500 events per
    unit);
  - `result-verification/check-activity.ts` `MAX_TEXT` 600;
  - `activity/wording` human-label and reason-text bounds;
  - activity-overlay `MAX_SHADOW_DEPTH` 4.
- **The build-ending record and the person's message:**
  - `unfinished-build/not-done.ts`: 16 items, quotes of 200 and 90, and
    `MAX_SAID` 4;
  - `generation-failure/build-ending.ts` record validation
    (`MAX_NOT_DONE` 16, `MAX_QUOTE` 200, message 1,000).

  Both are written for the ending record and the person, not for the model.
- **Log only:** `llm/evidence-progress/progress-trace.ts` `MAX_LISTED` 16.
- **The failure record's 1,024-character text:** `read-account/sentence.ts`
  "brief", the 1,024 limit t200 left out of scope.
- **The Lab:**
  - test-contracts `RUN_EXTRACTION_READ_BOUNDS.maxConditions` 64. This is now
    stricter than Core, which admits any number.
  - test-runner `MAX_CODE_LENGTH` 96 and `permission-point.ts` `MAX_PAGES` 20.

**Found, older than the lane work and outside this sweep, and not changed.** I
recommend a follow-up for each:

- **A per-request bound below the window.** The harness default token limits
  `DEFAULT_AUTOMATION_STUDIO_LLM_TOKEN_LIMITS` (8,000 in, 2,000 out, 10,000
  total) in `llm/harness/token-limits.ts` apply when a resolver gives no
  limits.
  - The recovery's token pot mirrors them (`recovery/annotation/run-budget.ts`,
    `?? 10_000`).
  - The live session-key provider supplies window-sized limits, so the live
    path is not affected.
  - About 20 Core test files pin these numbers.
- **Ranking and a cap on the node catalog the build model is shown.**
  - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS.firstLiveMaxInputTokens` 4,000
    sets the catalog's byte budget (`plan/limits.ts`, `service.ts:1505,1645`,
    `context-packet.ts:251`).
  - `maxCatalogEntries: 64` combined with relevance selection
    (`catalogSelection`) ranks which nodes are shown.
  - This is a ranking algorithm on model input.
- **Count caps in `llm/harness/context-packet.ts`,** which t200 classed as
  "not page information":
  - `relevantRuns` 25, `relevantAdaptations` 25, `subflows` 100,
    `availableActions` 100 and `recentActions`;
  - `harness/conversation.ts` 20 turns;
  - `recovery/refuted-result/conversation.ts` 40 turns;
  - `conversations/instructions/request.ts` transcript turns;
  - `llm/draft-amendment-feedback.ts` `MAX_POSITIONS_LISTED`.
- **Web default `llmExecutionSettings.tokenLimits` (8000/2000/10000)** is
  stored in every Flow. Core deliberately ignores it
  (`flow-execution-limits/resolution-within-flow-settings.ts`), so it is not
  enforced.

### Generated file

I regenerated `docs/reference/framework-reference.md` in Core with
`node scripts/docs-reference.mjs`, because `--check` reported it stale. The
diff also contains declarations from other lanes' merges (t208 and others),
because dev's copy was already stale. The t200 tree reports it current.

## Commands run and observed results

### Core (`fxwork/t210/!FluxIQ`)

Heavy commands ran through `build-slots/heavy.sh`.

- **Typecheck:** `pnpm --filter fluxiq check`.
  - First run failed with TS2339 in my new `extraction-summary.test.ts`
    assertion. Fixed with `toMatchObject`.
  - Re-run: `EXIT=0`. Re-run after the key moved into its own file: `EXIT=0`.
- **First vitest run:** `pnpm --filter fluxiq exec vitest run` over
  `runtime/{result-verification,recovery,llm,flow-bootstrap,service/flow-settings,service/summaries,tests/service-flows,tests/service-adaptation,tests/training-modes.test.ts}`
  and `model`.
  - Result: `Test Files 9 failed | 224 passed (233)`,
    `Tests 11 failed | 2518 passed (2529)`.
  - All 11 failures were `Test timed out in 15000ms` in service tests.
- **The same timeouts happen without my changes.** I ran
  `service-flows/tests/execution-digest.test.ts` in the t200 Core tree, which
  does not contain these changes: all 4 of its tests timed out at 15000ms.
- **The 9 failing files with a longer timeout:** `--testTimeout=180000` gave
  `Test Files 9 passed (9)`, `Tests 35 passed (35)`.
- **Full set again with `--testTimeout=180000`, after the key moved into its
  own file:**
  - Result: `Tests 1 failed | 2528 passed (2529)`.
  - The failure is `scale-pages.test.ts`, which asserts a 500 ms wall-clock
    budget on listing Subflows. That code is not touched.
  - Re-run alone: `Tests 3 passed (3)`.
- **The changed test files, verbose:** every new no-cap test is listed as
  passed. That covers `accounts`, `tokens-per-run-default-migration`,
  `instruction-acts`, `instruction-choices`, `check` (instructed acts,
  reachability and answerability) and `creation`.
- **Structure audit:** `node scripts/structure-audit.mjs` gave
  `structure-audit: passed (204 warning(s), 354 baselined)`.
  - It also printed "1 baseline entries can be lowered". The t200 tree prints
    the same line, so it is not from this change.
  - The `model/flows.ts` warning is 9 exported values, the same as before;
    the new key lives in its own file.
- **Build:** `pnpm build` (root: contracts, fluxiq, client gateway, web next
  build) gave `EXIT=0`.
- **Web typecheck:** `pnpm --filter @fluxiq/web check` gave `EXIT=0`.
- **Web settings tests:**
  `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/settings`
  gave `Test Files 9 passed (9)`, `Tests 61 passed (61)`.
- **Docs reference:** `node scripts/docs-reference.mjs --check` reported it
  stale (see "Generated file"). I regenerated it, and it wrote 2844 public
  declarations.

### Downstream (`fxwork/t210/!FluxIQWebExtension`, built against the t210 Core tree)

- **Structure audit:** `node scripts/structure-audit.mjs` gave
  `structure-audit: passed (134 warning(s), 119 baselined)`.
- **Domain tests:**
  `env DOMAIN_TEST_BUILD_LABEL=t210 pnpm --filter @fluxiq-web-extension/domain test`
  gave `# tests 1039`, `# pass 1039`, `# fail 0`. The new tests are listed as
  `ok`: "every sampled row arrives…", "a value arrives whole…" and "with every
  cap gone the screen still holds…".
- **Domain typecheck:** `pnpm --filter @fluxiq-web-extension/domain check`
  gave `EXIT=0`.
- **Extension tests:**
  `env EXTENSION_TEST_BUILD_LABEL=t210 pnpm --filter @fluxiq-web-extension/extension test`
  gave `# tests 1662`, `# pass 1662`, `# fail 0`. The new tests are listed as
  `ok` (indexes 699, 951 and 952).
- **Extension check:** `pnpm --filter @fluxiq-web-extension/extension check`
  gave `EXIT=0`.

## Not verified

- No browser, Lab or live run, as the brief ordered. The whole-page size and
  cost effects of uncapped rejected rows, act checklists and read accounts on
  the ten scenarios are not measured.
- Root `pnpm check` and `pnpm test` were not run in either tree. The
  test-runner and test-contracts suites were not run.
- `pnpm docs:check` (the docs-links rule) was not run.
- The web form was not exercised in a browser.
- The migration was not run against real stored Flows from a live project.
  It is covered by unit tests only.

## Open questions or contradictions found

- **The navigation guard's memory** (`shown-addresses.ts`, 512 addresses and
  256 read strings) is smaller than a whole page can now be. A build could be
  refused a navigation to a link it was shown. This is not model input, so I
  left it.
- **Two items above are request bounds or ranking on model input:** the
  harness default token limits and the bootstrap node catalog's ranked, capped
  selection. They are older than the lane work and outside this sweep, and I
  recommend a follow-up task for both.
- **The Lab's extraction-read validator** still caps conditions at 64, while
  Core now admits any number. A Lab assertion could reject a run record that
  Core accepts.

## Ready to commit

**Downstream:**
- `apps/extension/src/content/actions/extract-list.ts`
- `apps/extension/src/content/actions/tests/extract-list-rejected-samples.test.ts`
- `apps/extension/src/content/extraction/{item-filter,list-reader,rejected-samples}.ts`
- `apps/extension/src/content/extraction/tests/{item-filter,rejected-samples}.test.ts`
- `apps/extension/src/shared/extraction-continuation.ts`
- `domain/src/actions/extraction/{rejected-samples,seen-values,summary}.ts`
- `domain/src/actions/extraction/tests/{rejected-samples,seen-values}.test.ts`
- `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/rejected-rows.test.ts`
- this report

**Core:**
- `apps/web/src/features/automation-studio/settings/flow-settings-model.ts`
- `apps/web/src/features/automation-studio/settings/tests/{settings-round-trip,settings-view}.test.tsx`
- `docs/architecture/package-boundaries.md`
- `docs/reference/framework-reference.md` (regenerated)
- `packages/fluxiq/src/programs/automation-studio/model/{flows,index}.ts`
- `packages/fluxiq/src/programs/automation-studio/model/tokens-per-run-default-cleared-key.ts` (new)
- Under `runtime/`:
  - `flow-bootstrap/answerability/{check.ts,tests/check.test.ts}`
  - `flow-bootstrap/instructed-acts/{check,contracts,instruction-acts,instruction-choices}.ts`
  - `flow-bootstrap/instructed-acts/tests/{check,instruction-acts,instruction-choices}.test.ts`
  - `flow-bootstrap/reachability/{check.ts,tests/check.test.ts}`
  - `flow-bootstrap/unfinished-build/judgement.ts`
  - `flow-bootstrap/unfinished-build/tests/judgement-value.test.ts` (new)
  - `recovery/refuted-result/step-failure-brief.ts`
  - `result-verification/{contracts,result-summary,verdict}.ts`
  - `result-verification/read-account/{accounts,condition}.ts`
  - `result-verification/read-account/tests/accounts.test.ts`
  - `service/flow-settings/{index,merged-metadata}.ts`
  - `service/flow-settings/tokens-per-run-default-migration.ts` (new)
  - `service/flow-settings/tests/locked-default-migration.test.ts`
  - `service/flow-settings/tests/tokens-per-run-default-migration.test.ts` (new)
  - `service/flows/store.ts`
  - `service/summaries/extraction-summary.ts`
  - `service/summaries/tests/extraction-summary.test.ts`
  - `tests/service-flows/tests/creation.test.ts`

**Validation:**
- `pnpm --filter fluxiq check` -> `EXIT=0`.
- Core vitest (10 paths, `--testTimeout=180000`) -> `2528 passed | 1 failed`.
  The failure is the `scale-pages` 500 ms wall-clock assertion, which passed
  3/3 when re-run alone.
- `pnpm build` (Core) -> `EXIT=0`.
- Web check -> `EXIT=0`. Web settings vitest -> `61 passed`.
- Structure audit -> passed in both trees.
- Domain test -> `1039/1039`. Extension test -> `1662/1662`.
- Extension check -> `EXIT=0`. Domain check -> `EXIT=0`.

## Round 2 (the supervisor's follow-up, 2026-09-30)

### Structure audit fix

Core's audit failed in `model/`: 29 source files against a baseline of 28. The
cause was the new `model/tokens-per-run-default-cleared-key.ts`, which I had
added in round 1. My round-1 report said the audit passed; that was wrong. The
run that "passed" was taken before the file existed, and the run after it was
filtered too narrowly to show the FAIL line.

- The key now lives in `model/tokens-per-run/`, with its own barrel `index.ts`,
  under the shared-prefix rule. `model/` is back to 28 files.
- `node scripts/structure-audit.mjs --update` then lowered `runtime/service.ts`
  (4558 to 4505) and removed `flow-bootstrap/plan.ts`. Both are from this
  round. It also dropped four stale `apps/web` entries that this task did not
  touch.

### 1. Harness default token limits

These apply when a resolver names no limits (`llm/harness/token-limits.ts`):

| Default | Was | Now |
| --- | --- | --- |
| `maxInputTokens` | 8,000 | 992,000 |
| `maxOutputTokens` | 2,000 | 8,000 |
| `maxTotalTokens` | 10,000 | 1,000,000 |

- They are exported as `AUTOMATION_STUDIO_LLM_DEFAULT_TOKEN_LIMITS` and
  `AUTOMATION_STUDIO_LLM_DEFAULT_REPLY_TOKENS = 8_000`. The session-key profile
  now reads the same reply constant.
- A limit the caller names still binds, and the missing ones are derived from
  it so they never contradict it:
  - total = the window;
  - output = min(8,000, total);
  - input = total - output.
- The recovery token pot's fallback (`recovery/annotation/run-budget.ts`,
  `?? 10_000`) now reads the default.
- **Consequence, and how I handled it:**
  - Pricing a window-sized call as the worst case costs more than the whole
    $0.25 purse.
  - So a recovery whose resolver names no limits now reserves an even share of
    the purse per call. The worst case is still used when the resolver declares
    limits.
  - The harness still reserves each call at its measured size whenever the
    provider prices requests, as DeepSeek does.
  - A provider that cannot price a request and declares window limits will
    still reserve the purse per call. That was already true before this task.

### Found while doing this, and fixed: the harness cut instructions to a token budget

`llm/harness/instruction.ts` cut the person's instructions. It also cut the
repair brief.

| Request | Instruction budget |
| --- | --- |
| Flow bootstrap | 384 tokens (`bootstrapInstructionTokens`) |
| Any other request, by default | 2,000 tokens |
| A repair build (`service.ts`) | 4,000 tokens |

Every instruction is now carried whole. `tokenBudget` is now only the
request's input limit, which is reported. An oversized request is refused
whole by `run.ts`, never trimmed.

### 2. The node catalog is every offered node, whole and unranked

- `flow-bootstrap/plan/catalog.ts` now builds the catalog from every node the
  resolution offers, in id order.
- Every entry is whole:
  - the label and description are not cut (they were 100 and 240 characters);
  - every structured parameter's description and example is sent whole (the
    description was cut at 900 characters, and an example over 600 bytes was
    left out);
  - there is no condensed form.
- Removed:
  - the ranking (`ranking.ts` is deleted);
  - the byte budget (`automationStudioFlowBootstrapCatalogByteBudget`);
  - `maxCatalogEntries` (100), `maxCatalogBytes` (49,152) and
    `firstLiveMaxInputTokens` (4,000);
  - the evidence-guided build's 64-entry cap and its 16,000-token catalog
    allocation in `service.ts`;
  - the harness input `flowBootstrap.maxInputTokens`;
  - `catalogSelection.byteBudget`;
  - the 12-item cap on `withheldParameterText`.
- `catalogTruncated` stays in the contract and is always `false`.
- The DeepSeek pre-flight no longer checks an entry count or a budget. It still
  checks that `usedBytes` matches the catalog's measured size.
- `required-terms.ts` replaces the ranking. It reads the instruction for one
  thing only: a capability the instruction asks for that no offered node
  provides. That is `missingRequiredTerms`, which still refuses a build before
  any provider call.
- **Measured size of the whole catalog:**
  - built-ins alone: 41 nodes, 24,843 bytes, about 8,300 tokens;
  - built-ins plus the web domain fixture: 59 nodes, 40,418 bytes, about
    13,500 tokens.

  Every build decision carries this.
- **Docs:** `docs/architecture/automation-studio/llm-flow-bootstrap.md` and
  `package-boundaries.md` are updated. The reference is regenerated (2845
  public declarations).

### 3. The navigation guard remembers every shown address

In `domain/.../node-run/shown-addresses.ts`:

- Removed:
  - `REMEMBERED_ADDRESSES` (512, newest kept);
  - `REMEMBERED_TYPED` (16);
  - `MAX_READ_DEPTH` (6);
  - `MAX_READ_STRINGS` (256).
- Every shown address, typed text and read address is kept until the next build
  of the flow.
- A read is walked with an explicit stack, so a deeply nested read cannot
  overflow the call stack.
- Also removed: `sanitize.ts` `MAX_PAGE_QUERY_PAIRS` (16). A page with more
  query pairs than that would not have matched its own address.
- Kept: `REMEMBERED_BUILDS` (16 concurrent builds). It matches arrival's own
  bound, and evicts a build's memory only when 16 newer builds are active.

### Tests added or changed in round 2

- **Default limits and whole instructions** (new):
  `llm/harness/tests/default-token-limits.test.ts`.
- **Whole catalog:**
  - `plan/tests/catalog.test.ts`, rewritten: 250 nodes in id order, the same
    catalog for any instruction, label, description and parameter text whole,
    required terms, missing terms, and every declared field carried;
  - `plan/tests/extraction-vocabulary.test.ts`;
  - `flow-bootstrap/tests/plan.test.ts`: 300 nodes, never truncated.
- **Navigation guard:**
  - `shown-addresses.test.ts`: a page with 1,200 links where both the first and
    the last can be followed, and 400 read addresses ten levels deep;
  - `whole-page.test.ts`: a page query with 40 pairs.
- **Pins that follow from the change** (each changed line has a comment):
  - `llm/tests/harness.test.ts`;
  - `recovery/.../run-budget.test.ts`;
  - `iteration-guards.test.ts`: the reply reserve is now 8,000, so 30,000
    tokens admit 6 decisions instead of 15.
- **Fixtures whose per-call limits (3,000 to 12,000 tokens) the whole catalog
  no longer fits:**
  - Raised in `service-bootstrap/*`, `deepseek-bootstrap-exploration` (the
    helper default is now 20,000/2,000/22,000) and `extension-chat`.
  - `service-fixtures.ts` no longer carries the retired 12,000 default.
  - In downstream `domain/src/tests/domain.test.ts`, the 3,000-token bootstrap
    request is now the window, with assertions that it carries every node.

### Round 2 validation (observed)

**Core:**
- `pnpm --filter fluxiq check` -> pass (no TS errors).
- `pnpm --filter fluxiq build` -> `EXIT=0`.
- `pnpm --filter @fluxiq/web check` -> `WEB_EXIT=0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (202
  warning(s), 353 baselined)`, after the baseline update.
- `node scripts/docs-reference.mjs --check` -> `Deterministic framework
  reference is current.`
- `node scripts/structure-audit.mjs --rule docs-links` -> `structure-audit:
  passed`.

**Core vitest over all of `src/programs/automation-studio`, with
`--testTimeout=180000`:** see the final run under "Ready to commit (round 2)".
The failures that are not caused by this change:

- **Three tests in `runtime/tests/deepseek-bootstrap-exploration.test.ts`:**
  - "stops on the no-progress guard while the run still has calls";
  - "names the ending ... more than sixteen decisions";
  - "reproduces the measured 26-decision ...".

  **Why they are not this change's:**
  - They still fail when every round-2 source file is put back to its HEAD
    version (a file-swap bisect, afterwards undone).
  - Dev has since rewritten all three. Dev's t214 merge (`ef7cdf4d`, "the chat
    and ending tests follow the new contract") and t211 now expect
    `evidence_budget_exhausted`, which is what they produce here.
  - Dev passes them: `Tests 11 passed (11)` in `C:/Users/osrs_/FluxStuff/!FluxIQ`.
- **Wall-clock and scale assertions in files this change does not touch**
  (`scale-pages.test.ts` with its 500 ms page budget, and
  `runtime-stream-store` with a million events in 60 s). They fail under load,
  and `scale-pages` passed 3/3 when run alone earlier.

**Downstream:**
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (134
  warning(s), 119 baselined)`.
- Domain test (`DOMAIN_TEST_BUILD_LABEL=t210`) -> `# tests 1042`, `# pass
  1042`, `# fail 0`.
  - The new guard and page-query tests ran: ok 592, 593 and 932.
  - `node --test .test-build-scratch/t210/tests/domain.test.mjs` -> 1/1 pass.
- `pnpm --filter @fluxiq-web-extension/domain check` -> pass. Its first run
  failed with TS errors in `domain.test.ts`, which is now fixed.
- Extension test (`EXTENSION_TEST_BUILD_LABEL=t210`) -> `# tests 1662`,
  `# pass 1662`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` -> `CHECK_EXIT=0`.

### Round 2: expected merge conflicts and open points

- **Merge conflicts with dev (t211/t214) in two files:**
  - `runtime/tests/deepseek-bootstrap-exploration.test.ts`: take dev's version,
    then re-apply this task's helper default limits (20,000/2,000/22,000) and
    the 20,000/2,000/22,000 limits in "records a build's token totals".
  - `runtime/conversations/commands/tests/extension-chat.test.ts`: take dev's
    version and re-apply the 40,000/2,000/42,000 resolver limits.
- **Cost:** every build decision now carries the whole catalog, about 8,000 to
  13,500 tokens for the scenarios' registries. This is unmeasured live; prompt
  caching should absorb most of it.
- **A Flow whose stored `maxTokensPerRun` was a person's own value** (key
  present) still binds. With the 8,000-token reply reserve, a small value now
  admits fewer calls.
- **Still listed and left**, as in round 1 (not raised by the supervisor):
  - the `context-packet.ts` caps: relevantRuns 25, relevantAdaptations 25,
    subflows 100, availableActions 100 and recentActions;
  - the harness conversation (20 turns) and the recovery conversation (40
    turns);
  - `run-node.ts` `MAX_ENUMERATED_NODES` (400), which only affects the
    enumeration in the tool schema: every name is in the whole catalog now.

### Ready to commit (round 2)

**Final Core vitest:** `pnpm exec vitest run src/programs/automation-studio
--testTimeout=180000` -> `Test Files 3 failed | 484 passed (487)`,
`Tests 5 failed | 4539 passed | 1 skipped (4545)`.

None of the five failures is caused by this change:

| Test | Why it fails | Evidence that it is not this change |
| --- | --- | --- |
| Three in `runtime/tests/deepseek-bootstrap-exploration.test.ts` | The test file is stale against the base's t208 build phases | Dev rewrote them in t211/t214, and dev passes 11/11 (see "Round 2 validation") |
| `service-flows/tests/scale-pages.test.ts` | A 500 ms wall-clock budget, run under load | Run alone, it passes: `Tests 12 passed` of 13 in that run, with only the stream test failing |
| `storage/project/tests/runtime-stream-store.test.ts` "a million events" | It times out at 60 s, both alone and in the full run | The file is untouched here, and dev fixed it after this task's base (`600869c0`, "proves tailing without timing the action-summary projection"). Dev passes 11/11. |

**Files ready to commit:** every path in `git status` of both trees, as at this
report. That is round 1's files plus:

**Core:**
- New: `model/tokens-per-run/`, `plan/required-terms.ts`,
  `llm/harness/tests/default-token-limits.test.ts`.
- Deleted: `plan/ranking.ts`. The key file `model/tokens-per-run-default-cleared-key.ts`
  moved into `model/tokens-per-run/`.
- Changed:
  - `plan/{catalog,parameter-text,limits,contracts,index,issue-feedback}.ts`
    and `plan.ts`;
  - `llm/harness/{context-packet,run,instruction,task-request,token-limits,index}.ts`;
  - `llm/{session-key-provider,deepseek/preflight,node-tools/run-node}.ts`;
  - `recovery/annotation/run-budget.ts` and `service.ts`;
  - the tests listed under "Tests added or changed in round 2";
  - `.structure-baseline.json`;
  - both `framework-reference.md` copies;
  - `llm-flow-bootstrap.md` and `package-boundaries.md`.

**Downstream:**
- `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts` and
  `llm-evidence/sanitize.ts`, with `tests/shown-addresses.test.ts` and
  `tests/whole-page.test.ts`;
- `domain/src/tests/domain.test.ts`.

## Round 3 (2026-09-30)

### Outcome

Done. Every count cap, cut, ranking and byte budget found on what reaches a
model, in the five owned directories, is removed. The caps left in place are
listed below with file:line and the reason. Secret screening and the $0.25
spend ceiling are untouched. A request over the window still fails with its
size (`llm/harness/run.ts:98-101`).

### 1. The `whole-thread.test.ts` type error

`exactOptionalPropertyTypes` refused passing the reader's input to the fake
page reader. The fix is the one the earlier stop note gave:
`page({ limit: input.limit ?? 200, ...(input.sinceTurnId === undefined ? {} : { sinceTurnId: input.sinceTurnId }) })`.
The structure audit then refused the test's deep import
`../../recovery/refuted-result/conversation.ts`, so it now imports from
`../../recovery/index.ts`.

### 2. The seven recovery failures: a stale build, not the product or the tests

The two arrays, printed by the failing assertion in
`runtime-exploration-permission.test.ts:249`:

```text
expected: [["waiting_permission", <id>, "Asked a question (permission)", "started", undefined],
           ["repairing",          <id>, "Asked a question (permission)", "succeeded", "allowed"]]
received: [... same ...,
           ["repairing",          <id>, "Asked a question (permission)", "succeeded", undefined]]
```

Only the ask row's `resolution` was missing. The conversation reads that round 3
changed play no part in it.

- `activity/bounded.ts:21` keeps a `resolution` only when
  `CLIENT_GATEWAY_ACTIVITY_RESOLUTIONS` (from `@fluxiq/contracts/client-gateway`)
  names it.
- `packages/contracts/dist/client-gateway.js` was built at 17:03, before the dev
  merge brought that constant into `packages/contracts/src/client-gateway.ts`
  (20:44). The dist file had no `RESOLUTIONS` at all (`grep -c` gave 0).
- At runtime the set was therefore empty, and every resolution was dropped.

Both product and test were right. The fix was to regenerate the build output
with the package's own script: `pnpm --filter @fluxiq/contracts build`. That is
generated output, not a source edit. Afterwards the dist had the constant
(`grep -c RESOLUTIONS` gave 1), and both files passed: `Test Files 2 passed (2)`,
`Tests 25 passed (25)`. Any other worktree whose contracts dist predates the
merge will show the same seven failures until it rebuilds.

### 3. Sweep: caps removed

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `conversations/instructions/prompt.ts`: the chat model was told the first 60
  Flows and a count of the rest. It is now told every Flow.
- `llm/draft-amendment-feedback.ts`: an amendment refusal listed 16 refusals and
  the newest 32 draft positions. It now lists all of both.
- `llm/harness-options/bootstrap-completion.ts`: a refused completion showed the
  first 16 issues, and quoted the refused script back only when it was under
  6,000 characters. It now shows every issue and the whole script.
- `flow-bootstrap/plan/issue-feedback.ts`: the issue feedback had 16 issues,
  300-character paths, 400-character authored messages and a 3,000-byte budget
  on accepted shapes. Now every issue, every path (still stripped of control
  characters), every message and every shape is shown, each shape once per
  parameter.
- `flow-bootstrap/plan/profile-limits.ts`: at most 12 exceeded limits were
  reported. Now all are.
- `flow-bootstrap/plan/validation.ts`: a parameter contract's first 8 codes were
  kept. Now every well-formed one is. A malformed or `bootstrap.`-prefixed code
  still becomes the generic violation.
- `llm/unusable-decision.ts`: an unusable decision's feedback carried 8 issue
  codes. It now carries every one.
- `flow-bootstrap/authoring/plan-shapes.ts`: a refused plan's keys were cut to
  12, each at 40 characters, with "+N more". Every key is now shown whole.
- `flow-bootstrap/authoring/matching.ts`: a step that matched several nodes was
  answered with the 5 sharing the most words. That was ranking. It now names
  every near match, in id order.
- `llm/harness/provider-result.ts`: past 200 provider-output findings, the rest
  were suppressed under `llm_output.finding_limit`. All are now kept.
- `llm/harness/context-packet.ts`: a runtime diagnosis's
  `expected`/`observed`/`changed` were cut at 500 characters when packed into
  the follow-up request. They are now carried whole. The reply contract still
  limits what the model may write (see below).
- `llm/node-tools/run-node.ts`: past 400 node ids, `core.run_node`'s schema
  stopped enumerating them. It now always enumerates every id.
- `llm/harness-options/builtin.ts` and `host.ts`: `core.prior_adaptations` had
  a maximum `limit` of 20 and a default of 5. It has neither now; with no limit
  the host is asked for every adaptation, so `listPriorAdaptations` gets `limit`
  only when the model gave one. No host in Core or downstream implements it.
- `result-verification/repair-directive.ts`: removed
  `AUTOMATION_STUDIO_RESULT_REPAIR_DIRECTIVE_LIMITS`. The repair directive held
  itself to 8 findings, 8 fix lines of 300 characters, 240-character details, 8
  columns a finding and a 500-character judgement. It now carries all of it.
  Secret screening and locator rewriting of the judgement stay.
- Round 3 from the previous session, now validated: the context packet's 12
  actions, 25 runs, 25 adaptations, 100 Subflows and 100 actions; the
  conversation slot's 20 turns, 4,000 bytes and 1,500-character cut; the chat
  transcript's 20 turns; the recovery's 40 turns; and `getFlowInstructionSet`'s
  first 100.

### Round 3: caps left in place

**Outside this brief's paths (the supervisor's decision):**

The first two items below were removed in round 3b (see "Round 3b").

- `service/runtime-adaptation/resolve-context.ts:41-48`. A run loads the newest
  100 adaptation summaries and only the first 25 records
  (`AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT`, `recovery/llm-invocation.ts:110`).
  Those records reach the model through the recovery context's adaptations
  section (`recovery/annotation/annotate.ts:373`). The constant is in an owned
  file, but its only use is in `resolve-context.ts`, which this brief does not
  own. Removing it means paging both reads there. **This still hides records
  from a model.**
- `storage/project/reusable-llm-context-store.ts:191` clamps `limit` to 1..100
  and has no offset or cursor. `service.ts:1390` asks for 100, so reusable
  context offers the newest 100 records. `docs/architecture/automation-studio/persistence.md:213`
  already says so. Removing it needs a store paging change. **This still hides
  records from a model.**
- `result-verification/core-observation.ts:141-142`. Core's observation is cut
  to `AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength`, a
  `@fluxiq/contracts` failure-record limit that a longer text would fail to
  validate. Changing it is a contracts change.
- `service.ts:1475`. An extend build picks its Subflow from the first 50
  summaries. That chooses which Subflow is extended and is not what the model is
  shown, but a Flow with more than 50 Subflows could have the right one missed.

**Not a limit on what the model is shown (kept on purpose):**

- These bound the model's own reply:
  - `llm/harness/structured-response.ts:99-179` (500-character diagnosis text,
    16 handles, 8 patch steps, serialized lengths) and its schemas in
    `deepseek/output-schema.ts` and `harness/runtime-patch-schema.ts`;
  - `provider-result.ts:81-302` (100 patches, 16 amendments and the like);
  - `evidence-loop-decision.ts:55` (16 amendments a decision);
  - `plan-parameter-resolution.ts:57-58`, `plan-step-consequences.ts:68` and
    `flow-bootstrap/plan/evidence-schema.ts:35`;
  - `flow-bootstrap/authoring/*` name, key and tag lengths, which become a
    Flow's identifiers;
  - `conversations/instructions/parse.ts:26`.

  They limit what the model writes, not what it reads, and they refuse rather
  than trim input.
- These are registration bounds that throw: `llm/harness-options/option.ts:23`
  (32 harness options) and `llm/stages/registry.ts:30` (40 stage instructions).
  A host registering more fails loudly at registration. Both are public exports.
- These are shape checks that refuse loudly rather than trim:
  - `context-packet.ts:206` (a recent action's ids of at most 200 characters);
  - `json-bounds.ts` (20,000-character strings, depth 64);
  - `explored-evidence-label.ts:25` (ordinal 999);
  - the depth guards.
- These are written for a person or a record, never to the model:
  - `conversations/instructions/invocation.ts:41,231-236` (8 Flows named in a
    question to the person);
  - `flow-bootstrap/unfinished-build/*`, `generation-failure/build-ending.ts:64-68`
    and `answerability/instruction-ask.ts:41-46`;
  - `generation-failure/diagnostic.ts:161` (a stored diagnostic's 16 codes);
  - `llm/run-call-record.ts:99`, `evidence-progress/progress-trace.ts:91`,
    `recovery/exploration-state/recorder.ts:128` and
    `result-verification/check-activity.ts:14`;
  - `llm/unreadable-reply.ts:123` (the build-ending summary's 4 cases).
- `flow-bootstrap/evidence-loop-steps.ts:196,375-391` reads a stored trace row
  back with bounds that match the decision contract's own 16 amendments.
- `recovery/structured-diagnosis.ts:281,288` quotes 64 characters of the model's
  own invalid value back. It is the model's writing, not new information.
- `flow-bootstrap/authoring/matching.ts` still takes an inexact match when one
  definition shares strictly more words than any other. That resolves which
  node the model meant; it does not filter what the model sees.

### Round 3: tests changed

These pinned the removed caps and now pin "whole":

- `llm/tests/draft-amendment-feedback.test.ts`: all 40 positions; 20 refusals.
- `flow-bootstrap/plan/tests/issue-feedback.test.ts`: 42 issues; a 405-character
  path; 40 accepted shapes.
- `flow-bootstrap/plan/tests/validation.test.ts`: 21 codes.
- `llm/harness/tests/patch-request-diagnosis.test.ts`: 900-character `expected`.
- `result-verification/tests/verdict.test.ts`: the 919-character advice, whole.
- `result-verification/tests/repair-directive.test.ts`: more than 8 findings and
  fix lines, 12 columns, and an 800-character advice.
- `llm/harness-options/tests/builtin.test.ts` and `registry.test.ts`: no limit
  is `null` (every adaptation); `limit: 99` is accepted; `limit: 0` is refused.

### 4. Docs

`docs/architecture/package-boundaries.md`: round 3's removals are added to the
existing "Next minor (unreleased): the model sees the whole page" migration
note, under **Removed.** Both `framework-reference.md` copies were regenerated
with `pnpm docs:reference`, the owning script: `Wrote ... (2852 public
declarations).` They drop the removed constants and add
`automationStudioConversationWholeThread` and
`AutomationStudioConversationThreadPage`. They are outside the brief's listed
paths, but `docs:check` cannot pass without them.

### Round 3: commands run and observed results

All Core commands ran in `fxwork/t210/!FluxIQ`, through `heavy.sh`.

- `pnpm --filter @fluxiq/contracts build`: `build-cache ... restored from the
  shared store (inputs changed: packages/contracts; 4 file(s) copied)`.
- `npx vitest run .../runtime-exploration-permission.test.ts .../runtime-exploration-person-needed.test.ts`:
  - before the rebuild, permission alone: `Tests 3 failed | 11 passed (14)`;
  - after: `Test Files 2 passed (2)`, `Tests 25 passed (25)`.
- `npx tsc --noEmit -p .`: two errors in the harness-option tests, then exit 0
  after they were updated, and exit 0 again at the end.
- `npx vitest run runtime/{conversations,llm,recovery,result-verification,flow-bootstrap}`:
  `Test Files 6 failed | 192 passed (198)`, `Tests 7 failed | 2306 passed (2313)`,
  in 206 s. The failures are listed under "Round 3: tests changed", plus the
  `execute.test.ts` timeout.
- Rerun of the 6 failing files plus `execute.test.ts`: `Test Files 6 passed (6)`,
  `Tests 69 passed (69)`.
- `npx vitest run conversations/tests/whole-thread.test.ts llm/harness/tests/whole-context.test.ts`
  (after the barrel import): `Test Files 2 passed (2)`, `Tests 8 passed (8)`.
- `npx vitest run result-verification/tests/repair-directive.test.ts`:
  `Tests 18 passed (18)`.
- `npx vitest run runtime/tests/service-flows/tests/scale-pages.test.ts`, which
  calls `getFlowInstructionSet`: `Tests 3 passed (3)`.
- `node scripts/structure-audit.mjs`:
  - first `1 violation(s)`, the deep import above;
  - then `structure-audit: passed (203 warning(s), 353 baselined)`.
- `pnpm docs:check`: `structure-audit: passed (0 warning(s), 0 baselined)` and
  `Deterministic framework reference is current.`
- Downstream grep over `domain/src`, `apps`, `packages` and `scripts` found none
  of: every removed constant, `finding_limit`, `listPriorAdaptations`,
  `RecoveryConversationReader`, `packAutomationStudioLlmConversation`, the issue
  feedback, the repair directive, `matchAuthoringDefinition` and
  `withheldTurns`. So the downstream domain test was not required and was not
  run.

### Round 3: not verified

- The whole vitest set was not rerun after the six test updates. Only the
  failing files and the two new ones were.
- The `runtime/tests` heavy service suites were not run, apart from
  `scale-pages.test.ts`.
- No downstream check, extension build or Lab run.
- How large real requests now get. With no counts, a thread of thousands of
  turns or a Flow with thousands of instructions is bounded only by the window
  refusal, which is the user's rule.

### Round 3: files

All Core files are under `packages/fluxiq/src/programs/automation-studio/runtime/`
unless a path says otherwise.

- **New:**
  - `conversations/whole-thread.ts`;
  - `conversations/tests/whole-thread.test.ts`;
  - `llm/harness/tests/whole-context.test.ts`.
- **Changed, conversations:** `conversations.ts`, `index.ts`,
  `instructions/prompt.ts` and `instructions/request.ts`.
- **Changed, flow-bootstrap:**
  - `authoring/matching.ts` and `authoring/plan-shapes.ts`;
  - `plan/issue-feedback.ts`, `plan/profile-limits.ts` and `plan/validation.ts`;
  - `plan/tests/issue-feedback.test.ts` and `plan/tests/validation.test.ts`.
- **Changed, llm:**
  - `deepseek/preflight.ts`, `draft-amendment-feedback.ts`,
    `unusable-decision.ts` and `node-tools/run-node.ts`;
  - `harness-options/{bootstrap-completion,builtin,host}.ts` and
    `harness-options/tests/{builtin,registry}.test.ts`;
  - `harness/{context-packet,conversation,index,provider-result}.ts` and
    `harness/tests/patch-request-diagnosis.test.ts`;
  - `tests/draft-amendment-feedback.test.ts`.
- **Changed, recovery and result-verification:**
  - `recovery/refuted-result/conversation.ts`;
  - `result-verification/repair-directive.ts` and
    `result-verification/tests/{repair-directive,verdict}.test.ts`.
- **Changed, service:** `service.ts`.
- **Changed, docs:** `docs/architecture/package-boundaries.md` and both
  `framework-reference.md` copies.
- **Regenerated (ignored build output):** `packages/contracts/dist/`.

## Round 3b (2026-09-30, the coordinator's follow-up)

### Outcome

Done. The two caps round 3 left outside its paths, which still hid records from
a model, are removed. The coordinator widened the owned paths to cover these two
files, their direct callers and their tests.

### 1. Adaptation context (`runtime/service/runtime-adaptation/resolve-context.ts`)

- Before, a run read the newest 100 adaptation summaries and loaded the full
  records of only the first 25 (`AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT`).
  Those records are what the recovery context shows the model
  (`recovery/annotation/annotate.ts:373`).
- It now reads every summary, page after page, 100 at a time. That is the
  summary store's own maximum (`service/summaries/store.ts`,
  `clampInteger(limit, 1, 100, 25)`). Paging stops at a short page, or at
  `total` when the port gives one; the service's port returns the store's
  `total`. Every record is loaded.
- `AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT` is removed from
  `recovery/llm-invocation.ts` and from the import in `service.ts`.
- Side effect: `computeAutomationStudioStabilityMetrics` now sees every
  adaptation summary, not the newest 100.
- Left as is: the run summaries on line 40, still the newest 100. They feed the
  training budget, stability and run counts, not a model request. The
  coordinator named lines 41-48 only, so this is the supervisor's call.

### 2. Reusable-context store (`storage/project/reusable-llm-context-store.ts`)

- `AutomationStudioReusableLlmContextList` gains `offset`, and `list` pages with
  `limit ? offset ?`. The 1..100 page size stays; a negative or non-integer
  offset throws.
- New `listEvery(input)` reads every page in the list's order: created time,
  newest first, then record id.
- Callers:
  - `service.ts:1390` (`packReusableLlmContexts`, what a model is offered) now
    calls `listEvery`. It read one page of 100.
  - `clearScope` already looped until the scope was empty.
  - `listReusableLlmContexts`, the person-facing API listing, keeps its caller's
    page. Its handler (`api/handlers/caches.ts`) does not pass `offset` through
    yet. I did not touch it: it is not a model path, and it is a caller of the
    service, not of the store.

### Tests added

- New `runtime/service/runtime-adaptation/tests/resolve-context.test.ts`:
  - 260 summaries are read at offsets `[0, 100, 200]`, and all 260 records are
    loaded in order;
  - with no `total`, paging stops on a short page (150 summaries, 2 calls).
- `storage/project/tests/reusable-llm-context-store.test.ts` gains "pages by
  offset, and listEvery reads every page in the list's order": 120 records,
  page 2 at offset 100, `listEvery` returns all 120 newest first, and offset -1
  throws.
  - Its first version wrote 230 records and timed out at 15 s under load. It
    now writes 120 and has a 60 s timeout, because it makes 120 encrypted,
    audited writes. It passes in 4.6 s.

### Docs

- `docs/architecture/package-boundaries.md`: two more **Removed** bullets in
  the same migration note.
- `docs/architecture/automation-studio/persistence.md:213` said "The store's own
  page of candidates is still at most 100 records". It now says packing reads
  every page through `listEvery`.
- Both framework references regenerated: `Wrote ... (2851 public
  declarations).` They drop `AUTOMATION_STUDIO_KNOWN_ADAPTATION_LOAD_LIMIT`.

### Commands run and observed results (after the last source edit)

- `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (203 warning(s), 353 baselined)`.
- `pnpm docs:check`: `structure-audit: passed (0 warning(s), 0 baselined)` and
  `Deterministic framework reference is current.`
- The full set,
  `npx vitest run runtime/{conversations,llm,recovery,result-verification,flow-bootstrap,service}`:
  `Test Files 2 failed | 241 passed (243)`, `Tests 3 failed | 2648 passed | 1 skipped (2652)`,
  in 287 s. All three failures were `Test timed out in 15000ms`:
  - `service/summaries/tests/run-detail-preservation.test.ts`: "keeps a repaired
    run's recovery annotation ..." (16.3 s) and "refuses to rebuild run details
    when the run index is present but unreadable" (15.5 s);
  - `service/recordings/tests/proposal-candidates.test.ts`: "is dropped, and the
    action still proposed, when it is not a plain object" (16.2 s).
- Those two files alone:
  - at the default timeout: `Test Files 2 passed (2)`, `Tests 30 passed (30)`
    (9.9 s and 36.1 s for the files);
  - with `--testTimeout=120000`: `Test Files 2 passed (2)`, `Tests 30 passed (30)`
    (12.2 s and 42.4 s).
- `npx vitest run runtime/service/runtime-adaptation/tests/resolve-context.test.ts storage/project/tests/reusable-llm-context-store.test.ts`:
  - first `Tests 1 failed | 7 passed (8)`: the 230-record test timed out at
    15 s, then hit `EBUSY` on cleanup;
  - after the change above, the store file alone: `Tests 6 passed (6)`. The
    resolve-context file passed both times (2 tests).
- `storage/project` is outside the coordinator's six directories. Only the
  store's test file was run from it.
- Downstream grep for `KNOWN_ADAPTATION_LOAD_LIMIT`, `ReusableLlmContextStore`,
  `AutomationStudioReusableLlmContextList` and
  `AutomationStudioRuntimeAdaptationContextPorts` found nothing, so no
  downstream test was required.

### Not verified

- The whole full set was not rerun after the timeout reruns. No source changed
  between them.
- The rest of `storage/project/tests`, the `runtime/tests` heavy suites,
  downstream checks and any Lab run.
- How long a run's start now takes for a Flow with thousands of adaptations: it
  loads every record.

### Files (round 3b)

- **Changed:**
  - `runtime/service/runtime-adaptation/resolve-context.ts`;
  - `runtime/recovery/llm-invocation.ts`;
  - `runtime/service.ts`;
  - `storage/project/reusable-llm-context-store.ts` and
    `storage/project/tests/reusable-llm-context-store.test.ts`;
  - `docs/architecture/package-boundaries.md` and
    `docs/architecture/automation-studio/persistence.md`;
  - both `framework-reference.md` copies.
- **New:** `runtime/service/runtime-adaptation/tests/resolve-context.test.ts`.
