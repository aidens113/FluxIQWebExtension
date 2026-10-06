# Live lane C — `everything-store-plus-earbuds-under-50`

Lead: t274 lane C lead. Slot `lab-slots/slot-1`, instance `t274-slot-1`, tree
`fxwork/t274/!FluxIQWebExtension` (branch `task/t274-live-lane-c`, `efaf2034`, lacks only `dev`'s two
documentation commits) with Core `fxwork/t274/!FluxIQ` (`a83b1471` = Core `dev`). Persistent workspace `t274-c`.
Brief: "Brief: live-lane" in `docs/working/mvp-final-month-plan.md`. One live run this dispatch, then stop.

Previous C runs: `run-musp39u8-9ac026ab` (13/13 and 52/52 by the oracle, but Core's result check refuted it on a
misread page bound, R1); `run-mustvzvg-99695308` (`paginate: true` read one page, C1; failed rerun refused with
words for a read that ran, C4). C1, C4, the judge paging wording (R1) and the re-author fixes are on `dev`.

## Expectations (written 2026-10-06T04:11Z, before the dry run and before any launch)

### The actions a correct Flow takes

1. Open the store home (`/scenarios/everything-store/`).
2. Dismiss the cookie bar ("Decline") and the "Never miss a deal" dialog ("Not now") when present; both are
   sometimes-present, so optional or routed by state, never mandatory clicks that fail on a clean replay.
3. Search "wireless earbuds" (type into "Search Brightaisle", submit) and land on results page 1.
4. One list read over the result cards that pages through every results page (five here) with an explicit
   bound, e.g. `paginate: {next: <next link>, maxPages: >=5}`; never `paginate: true` alone (C1 on dev now
   answers that). Conditions on the read:
   - not sponsored (the `data-ad-id` / "Sponsored" label), and not the sponsored carousel;
   - Brightaisle Plus badge present;
   - rating >= 4.0 as printed on the card (not the store's "4 Stars & Up" filter, which admits 3.8 and 3.9);
   - price < $50.00 (not the "$25 to $50" band, which admits exactly $50.00 and drops pairs under $25);
   - not an accessory: the replacement ear tips and the charging case sold alone are out; a pair "with Wireless
     Charging Case" is a pair and stays in;
   - de-duplicated by url (every page after the first repeats the previous page's last result);
   - page order kept; columns name, price, rating, url as the page prints them (`$26.99`, `4.2`, absolute url).
5. Traps the read must survive: four results a page load only on scroll; page 2's Next link leads back to page 2;
   a sweep faster than a person reads gets a 429.

### Exact oracle facts

- Expected dataset `extract-plus-under-fifty` (workflow `plus-under-fifty`): **exactly 13 records, in this order,
  52 fields (name, price, rating, url), all string-valued, matched in place**, across all five pages:
  1. Lumo Audio Drift ... 50H ... Rose Gold, $49.99, 4.1 (B0PXHP88KT)
  2. Brightaisle Basics Sport ... Black, $22.99, 4.0 (B0R257NR7U)
  3. Zephyrline Z3 ... 24H ... Sage, $34.99, 4.3 (B0P8ZF57AC)
  4. Aurelle Echo ... 40H ... Ivory, $47.99, 4.5 (B0J5MCMBAY)
  5. Aurelle Pods Fit ... 36H ... Ivory, $39.99, 4.4 (B0VNKJTVCD)
  6. Tessaro Arc ... 24H ... Sage, $29.99, 4.2 (B07Z1RZGJG)
  7. Aurelle Pods ... 40H ... Black, $47.99, 4.0 (B00BJX53AC)
  8. Lumo Audio Drift Pro ... Wireless Charging Case ... White, $26.99, 4.2 (B09HZLEPLS)
  9. Aurelle Pods Fit ... Ivory with Wireless Charging Case, $39.99, 4.4 (B0HKSZ2BM6)
  10. Trevio T5 ... ANC ... Ivory, $22.99, 4.6 (B0G68DZTDB)
  11. Trevio T5 ... Wireless Charging Case ... Rose Gold, $39.99, 4.0 (B0X473P78X)
  12. Aurelle Pods ... 50H ... Black, $47.99, 4.0 (B02UB6NJWC)
  13. Soundcrest Air Pro 2 ... Graphite, $34.99, 4.5 (B016CBKJ2R)
  (Names abbreviated here; the oracle compares the full strings from the catalog, `earbud-records.ts`.)
- Final state: not challenged by the robot check at the end; cart count still "2" (nothing added).
- The run passes only if the Lab verdict is `passed`, which needs the oracle held **and** Core's own result check
  not refuting the right answer (musp39u8's failure). Wrong answers that look right: 10 of 13 (the three "with
  Wireless Charging Case" pairs dropped as accessories); page 1 only (3 rows); a page-boundary repeat kept (14+);
  sponsored rows kept.
- Read account to expect: 5 pages, stopped because the next control was disabled on page 5 (`control_disabled`),
  about 94 items seen, 2 earlier-page repeats left out.
- Cost: under the $0.10 per-build ceiling; build plus judges, and any re-author, each held to it.

### UI checkpoints (extension chat and page overlay)

- U-start: the instruction becomes the person's bubble at send, composer empty; the overlay appears promptly.
- U-read: list-read cards show the read's own count ("N rows from M pages"), not a bare "Done", and no chat line
  claims "every page" while the read says one page (mustvzvg U-A).
- U-detect: a detect card names the list, not the label it targeted ("Look · Sponsored", U-B).
- U-words: no step numbers, handles (`extraction.N`), node ids, `page_limit`, `endView`, `paginate`, `extract_list`
  in the person's chat (U-C/U4/U6).
- U-status: the overlay status cut at a word, not mid-word (U-D); no "Deciding the next step" flicker.
- U-tests: the build-test cards are named and shown for every test, including the last (U-E).
- U-run: playback cards hide merges, the step count is right, and it is dropped after the run ends.
- U-end: the ending says the result in words (13 rows saved), or, on failure, what the Flow does now and what
  blocked it; no "--", no "Couldn't fix your Flow" for a first build.

## Progress

- 04:12Z dry run. `FLUXIQ_LAB_INSTANCE=t274-slot-1 FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated
  FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --dry-run
  --max-attempts 1` printed `pnpm lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider
  deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50
  --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48`
  (no `--llm-permit`, no cost option). The same Lab command with `--dry-run` printed `status: ready`,
  `providerCallCount: 0`, `buildEntry: chat`, `target: persistent-isolated`, `coreDefaultModel: deepseek-flash`,
  `authorized.maxEstimatedCostUsd: 0.1`, `maxTotalEstimatedCostUsd: 0.1`, `permittedConsequences: []`, credential
  name `DEEPSEEK_API_KEY` from `.env.local`; prelude rebuilt scenario-lab, domain host and extension for the instance.
  Guards: no `STOP-balance`; instance never ran (no `debug`/`unchanged`/`loop` exposure); tree lacks only `dev`'s
  docs commits (allowed). Browser headed by default. `--max-attempts 1` so the campaign cannot relaunch.
- 04:14:22Z live run 1 launched; guard `admitted`. Run `run-muw60j7c-bb7c9a62`, ended 04:23:50Z, campaign exit 1.
  Not relaunched.

## Run 1 — `run-muw60j7c-bb7c9a62`: failed

- Cost: 54 calls, $0.081399873 (creation build $0.024054, result judges $0.002898, re-author $0.054265; no build
  over the $0.10 ceiling).
- Oracle: records **failed** (expected 13, stored 30, 0 matched in place, 10 in any order; 52/52 fields);
  final state held (not challenged, cart "2"). Core's result check refuted (rightly); re-author ran six rounds,
  never tested, ended on its rounds bound. No replays (nothing passed).
- Cause in source (C-1): the unfiltered exploratory read the model ran at 0017 and never added was pulled into the
  Flow as the opener of the filtered read it did add, because the opener walk
  (`Core .../runtime/flow-draft/path-to-step.ts`) treats any proposable `taken` step whose digests changed as a
  step on the way, and a list read scrolls the page. It became `s6` and appended 20 unfiltered rows.
- Also: C-2 the name rule drops the three "with Wireless Charging Case" pairs (model; both build-test judges said
  yes over `leftOutOnlyByThis` naming them); C-3 build-test judges see no stored record set ("Passed: no rows came
  back"); C-4 the re-author brief orders reruns of carried click/type steps that the domain refuses
  (`target_not_a_handle`, R3a still on dev); C-5 the result judges' false Plus/sponsored advice made the re-author
  discard the exact 13-row answer it held at 0055.
- Debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muw60j7c-bb7c9a62.md`. UI review:
  `docs/working/mvp-final-month-plan/reports/live-C-ui-review.md` (worker; lead re-viewed moments 07, 14, 16).

### Fix left uncommitted (Core lane tree `fxwork/t274/!FluxIQ`)

- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/path-to-step.ts`: `if (candidate.effect ===
  "observe") continue;` after the `kept` check, with the rule written into the header.
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/opener.test.ts`: "a read the model ran
  and never added" (3 tests).
- Validation: before the fix `pnpm.cmd exec vitest run .../flow-draft/tests/opener.test.ts` -> 2 failed
  (`expected [1,2,3,4,6,7] to deeply equal [1,2,3,4,7]`, `expected [3,2] to deeply equal [2]`), 12 passed. After:
  `vitest run .../flow-draft/tests/` -> 19 files, 201 passed; `vitest run .../llm/tests/ .../llm/evidence-loop/tests/
  .../flow-draft/` -> 74 files, 955 passed; `pnpm.cmd run check` (fluxiq tsc) -> exit 0; `node
  scripts/build-cache/cli.mjs structure-audit:check` -> passed (258 warnings, 349 baselined).
- Not enough alone to pass C: the next run would store only `s7`'s 10 of 13 unless C-2 is caught and C-4/C-5 let the
  repair reach its test.

## C-2..C-5 fixes (supervisor request after C-1 merged; no live run)

All uncommitted in Core `fxwork/t274/!FluxIQ` (on `da8b3241`, before lane B's dev merge). Worker reports beside
this file: `t274-c3-build-test-stores.md`, `t274-c25-judge-rows.md`, `t274-c25b-checked-to-repair.md`,
`t274-c4-carried-steps.md`, `t274-c4b-carried-followups.md`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.

- **C-3, build-test judges see what the Flow would store.** New `RT/result-verification/build-test/stores.ts`.
  `buildTest.stores` gives, per dataset in Flow order: write mode, steps, rows, every label in order, and the
  repeated labels, all from the authored nodes' record outputs and each read's test rows. Core's observation of a
  test leads with "N records would be stored, in M datasets" (`verdict.ts`), so the card says "30 rows would be
  stored." (`check-words.ts`). The build verdict's `records.stored` is that count (`build-test/judge.ts`). The prompt
  replaces "stored nothing" with "judge buildTest.stores as the result", and lane D's `afterWithheld` sentence is
  kept. Limit: a read whose node writes no record output (the domain derives its dataset at dispatch) is not in
  `stores`.
- **C-2 (judging half).** New `RT/result-verification/request-rows/`. It produces `leftOutNamingTheItem`: rows left
  out by one condition alone, tested on the row's own label, whose label names first the request phrase that every
  kept row names first, and another request phrase after it. On this run that is the 3 charging-case pairs, not the
  ear tips or the case accessory. It is added to both judges' summary in `verify.ts`. In `verdict.ts`, a `yes` that
  does not name each flagged row, by a distinguishing label prefix or an id, becomes `does_not_answer`
  (`result.left_out_naming_the_item`) with fix and checked lines naming the rows. `agreement.ts` and
  `build-test/judge.ts` count it as a no. It is an accounting rule, not an override: a judge that names each row and
  says why the request excludes it can still say yes.
- **C-5.** Every `no` carries `repair.checked`. These are Core's lines on the rows the judgement names: rows it calls
  left out that are in the result (this run: B0J5MCMBAY and B07Z1RZGJG), and the rows a blamed condition really left
  out. The lines are carried by the re-author brief (`recovery/refuted-result/brief.ts`). Its step 3 now says advice
  resting on such a row is not followed. They are also carried by a build's judged-wrong round
  (`flow-bootstrap/unfinished-build/judgement.ts`, `contracts.ts`, `llm/evidence-loop/resume.ts`), and by the failure
  record's expected text (`core-observation.ts`). The prompt now asks a no to name its concrete wrong or missing rows.
- **C-4, R3a retired.** New `RT/flow-draft/carried-step/` (one predicate). An unchanged carried step with a scheduled
  candidate is not `not_run_in_this_build`, and a carried Merge is passed through: `not-run.ts`, `dry-run-gate.ts`,
  `replay-draft.ts`, `flow-draft/dry-run.ts` (`Replayable`/`ReplayFrom`) and `build-test/summary.ts` all handle it,
  the last leaving the Merge out of judged steps and out of `untestedCarried`. `round-ending.ts` and the repair seed
  in `judgement.ts` keep candidates across a stall. The brief, the round instruction and `full-run-required.ts` no
  longer order reruns of unchanged steps; they list only the steps the test names. Domain (read only): a
  candidate's replay of an element click or type with no handle is accepted (`node-run/run.ts:171-183` returns
  before the refusal at `:283-286`).
- **Prompt and pins.** `llm/diagnosis-instructions.ts` gets the leftOutNamingTheItem and named-rows sentences in the
  shared verification prose, the stores clause in the build-test prose, and two comment entries.
  `system-prompt-pins.json` regenerated: `loop_verification` and `loop_verification_build_test` only.
- **Docs.** `docs/architecture/automation-studio/llm-flow-bootstrap.md` (build-test judging; re-author and carried
  steps); `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`
  regenerated (`pnpm docs:reference`, 3175 declarations).

Fail-first, each observed before its fix:
- `stores.test.ts`: 6 of 7 failed.
- `observation-would-store.test.ts`: 2 of 3 failed ("No rows came back..." vs "30 rows would be stored...").
- request-rows suites failed to load; the verdict test failed with `expected 'answers' to be 'does_not_answer'`.
- c25b: 7 failed (stored 0, no checked or fix lines in the round or the brief).
- carried steps: 6/6 failed (`expected [1,2,3,4,5] to deeply equal []`, brief contained "rerun each step of your
  draft live").
- between-rounds: 3/3 failed (`[1,2,4,5]`, replayable false, untestedCarried `[3]`).

Validation (lead, combined tree), all from `packages/fluxiq` unless noted:
- `pnpm.cmd exec vitest run` over RT `result-verification/ llm/ flow-draft/ flow-bootstrap/ recovery/
  service/runtime-adaptation/ tests/service-bootstrap/ tests/refuted-result/` -> 393 files, 4287 tests passed.
- `pnpm.cmd run check` (fluxiq tsc) -> exit 0.
- `node scripts/structure-audit.mjs` -> passed (261 warnings, 349 baselined).
- `--rule docs-links` -> passed.
- `node scripts/docs-reference.mjs --check` -> current.

Hunks in files lane B also changed on dev (merge and resolve):
- `result-verification/contracts.ts`: 4 additive hunks: the `AutomationStudioResultLeftOutNamingTheItem` type and
  `leftOutNamingTheItem?` on the summary; `AutomationStudioBuildTestStore` and `stores?` on the build-test account;
  `checked?` on the repair directive.
- `result-verification/index.ts`: one export line (`request-rows`).
- `llm/diagnosis-instructions.ts`: two hunks, each one rewritten instruction line plus comments. Keep B's and D's
  sentences.
- `system-prompt-pins.json`: both verification pins. Regenerate them from the builder after resolving.
- Untouched: `result-summary.ts`, `run-outcome.ts`, `llm/harness/request-evidence-check.ts`.
- `buildTest.stores` sits in the same summary object as B's per-step changes (the build-test account), not a
  separate channel.
- Re-run `pnpm docs:reference` after the merge.

Not verified:
- No live or Lab run.
- The phrase rule was tested on this run's request and rows only.
- The ladder's structured copy of the directive (`attempt.ts` -> `context.ts`) does not carry `checked`; it gets
  the rows only through the failure record's expected text.
- A pre-existing module cycle (llm/evidence-loop <-> result-verification) leaves the judge `not_judged` if a test
  imports evidence-loop first. These changes add no edge to it, and production entry points are unaffected.
