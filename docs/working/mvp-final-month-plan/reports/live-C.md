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

## Round 2 — expectations (written 2026-10-06T06:24Z, before the dry run and the launch)

Tree: ext `624c7a70` = dev, Core `9fd634d3` = dev (C-1 `5e368d1d` and C-2..C-5 `d7cb90ca`, lane B per-step changes, lane A
and D fixes, t276 UI). Instance `t274-slot-1`, workspace `t274-c` (it holds round 1's Flow; the chat build creates
a new run-owned project).

- Actions and oracle: unchanged from round 1. One filtered list read over every page (5), sponsored and non-Plus
  out, printed rating >= 4.0, price < $50.00, ear tips and the lone charging case out, pairs "with Wireless Charging
  Case" in, dedupe by url, page order, columns name/price/rating/url. Oracle `extract-plus-under-fifty`: **exactly
  13 records in order (B0PXHP88KT, B0R257NR7U, B0P8ZF57AC, B0J5MCMBAY, B0VNKJTVCD, B07Z1RZGJG, B00BJX53AC, B09HZLEPLS,
  B0HKSZ2BM6, B0G68DZTDB, B0X473P78X, B02UB6NJWC, B016CBKJ2R), 52 string fields matched in place, all pages**; final
  state not challenged, cart "2". Pass = Lab verdict `passed` (oracle held and Core's result check not refuting).
- What the round-1 fixes should show:
  - C-1: an exploratory read the model runs without `add` never joins the Flow (one read in the proposed Flow, or
    only reads the model added).
  - C-3: the build-test judge's request carries `buildTest.stores` with the rows the Flow would store; the check
    card reads "N rows would be stored", never "no rows came back".
  - C-2: if a name condition leaves out the charging-case pairs, the judge's summary carries
    `leftOutNamingTheItem` (the 3 pairs, not the two accessories) and a yes that does not name them becomes a no
    with those rows in the repair.
  - C-5: a refutation carries `repair.checked` lines, and a re-author brief shows them.
  - C-4: if a re-author runs, its brief orders no rerun of unchanged carried steps; carried Merge passes through.
- Look-alike wrong answers: 10/13 (charging-case pairs dropped), 3 (page 1 only), 14+ (boundary repeat), 30 (an
  unfiltered read stored beside the filtered one), sponsored rows kept.
- UI checkpoints as round 1, plus t276's fixes: read cards with counts, detect card naming the list, no internal
  words, overlay cut at a word, "Sending your message" gone, ending names result and blocker, test card says what
  would be stored.

## Round 2 — `run-muwansvz-a2b4a987`: failed

- Cost: 22 calls, $0.079061508, one build under the $0.10 ceiling. No Flow was proposed: the build stopped at its
  spending limit. No playback, the oracle was not reached (`oracleVerdict: null`), no replays. Not relaunched.
- Round 0 added a list read with no conditions and no dedupe (82 rows from 5 pages). The build-test judge said no,
  citing `buildTest.stores` ("would write 82 rows ... 6 labels repeated"), so C-3 works live. C-2, C-4 and C-5 were
  not exercised: no condition left rows out, there was no result check, and no re-author ran.
- Cause (R2-1): the repair round opened on results page 5, where the test left the page. Detection there proposed
  no pagination, because the last page draws Next as disabled text. The new handle therefore carried none, and the
  domain refused every paging rerun on it as `malformed` (six reruns, two refused completes) until the purse ran
  out.
- Fix, left uncommitted (downstream): `apps/extension/src/content/extraction/detect-pagination.ts` (`lastPageNext`:
  a pager Next drawn disabled is proposed as `next`) and its test in
  `apps/extension/src/content/extraction/tests/detect-pagination.test.ts` ("run muwansvz"). The test failed before
  the fix with `actual undefined, expected 'next'` and passes after it, including the page-one round trip.
- Validation:
  - that test file alone: 16/16 pass;
  - `EXTENSION_TEST_BUILD_LABEL=lane-c node scripts/test-extension.mjs`: 2493 pass, 0 fail;
  - `npx tsc -p tsconfig.json --noEmit` (apps/extension): exit 0.
- Proposed, not done:
  - R2-2: the refusal names its reason (`domain/.../extraction/slot.ts`);
  - R2-4: a repair round opens on the blamed step's start page;
  - R2-U: the check card's count for a no, the ending's dollar bookkeeping, "Step 8", and the judge's text cut at
    "(e.g.".
- Debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muwansvz-a2b4a987.md`. UI review:
  `live-C-r2-ui-review.md`.

## Round 3 — expectations (written 2026-10-06T21:18Z, before the dry run and the launch)

Tree: downstream `f224b38a` (= dev except the doc-only `7880abda`), Core `e1551fa3` (= Core dev), both synced and
rebuilt by the supervisor at 21:16Z. Instance `t274-slot-1`, workspace `t274-c` (round 2's), slot 1. Off-peak
(Tuesday 21:18Z; no start after 00:45Z).

- Actions and oracle: unchanged from round 1. One filtered list read over every page (5) with an explicit bound;
  sponsored and non-Plus out; printed rating >= 4.0; price < $50.00; ear tips and the lone charging case out, pairs
  "with Wireless Charging Case" in; dedupe by url; page order; columns name/price/rating/url. Oracle
  `extract-plus-under-fifty`: **exactly 13 records in order (B0PXHP88KT, B0R257NR7U, B0P8ZF57AC, B0J5MCMBAY,
  B0VNKJTVCD, B07Z1RZGJG, B00BJX53AC, B09HZLEPLS, B0HKSZ2BM6, B0G68DZTDB, B0X473P78X, B02UB6NJWC, B016CBKJ2R), 52
  string fields matched in place, all pages**; final state not challenged, cart "2". Pass = Lab verdict `passed`.
  Look-alikes: 10 (charging-case pairs dropped), 3 (page 1), 14+ (boundary repeat), 30/82 (unfiltered read kept),
  sponsored kept, 0 (a name rule "earbuds" that drops every pair).
- Must be seen fixed for C (round-3 notes): a repair round looks and detects where the blamed step starts (results
  page 1 after the search), never on the last results page; if a detect still lands on a pager-less page, a paging
  rerun on it is refused with hint `...paginate.no_pager_detected.detect_on_step_start_page`, not a bare
  `malformed`; R2-1 (on dev since round 2): a detect on page 5 now proposes `next` pagination from the disabled Next.
- New on this source, checked in the debug: `judgement.whereToFix` in the repair instruction ("look and detect
  there, not on the page the test left"); lane A's loop fix (a rerun amendment re-sent after it changed nothing or
  failed on an unchanged draft is refused unrun `same_amendment`, counts toward the refused-in-a-row stop; history
  rows "unchanged"/"refused", never "applied"); B's "keep adds nothing"; `web-state.v4` frame-stable digest; t278
  (`checked` rows reach a node repair); D's `strands_a_step` / unreached note / D2-2 (`unreproducible` for a list
  never found on another page). Earlier C fixes still to watch: C-1 (no un-added read in the Flow), C-2
  (`leftOutNamingTheItem` names only the 3 pairs), C-3 (`buildTest.stores` in the build-test judge), C-4, C-5.
- UI checkpoints (t277 `t277-r3-ui.md` "what the next live UI review must see", plus round 1-2 checkpoints):
  - check card "Check result · Didn't pass: N rows would be stored, but <one clause>", never a bare "Didn't pass";
  - no card or thought cut at "(e.g." or glued to the next sentence (the repair heading and ending may still be);
  - no "extract list node", "extraction", "scrapes", "pagination", "dedup", "the judge", "next call", "Step N" in
    thoughts or cards; the look-up card reads "Look · how to read a list";
  - panel live line "Starting…" with the overlay from the send ("Sending your message" cleared);
  - a refused read says why ("FluxIQ didn't read it, as the step didn't say which list ..."), never "it wasn't on
    the page"; overlay "-- not tried: ...";
  - repeated refused reruns fold into one card "(N times)";
  - one list name ("name, price and 4 more") in overlay, build card and test card alike;
  - detect card still "Look · the repeating list on the page" (R2-U-9 open);
  - moment 01 may still show the previous run's "is ready" thread (R2-U-10 open, Lab/profile, not the panel);
  - no overlay-absent sample 100 ms or more after a new document while FluxIQ works;
  - a repeat whose list the test never reached: "Skipped: the test reached no rows for it to repeat over";
  - the ending still carries purse arithmetic (R2-U-2 not landed); reported, not counted as a regression.

### Round 3 — progress

- 21:19Z dry run. `pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --dry-run --max-attempts 1` (env
  `FLUXIQ_LAB_INSTANCE=t274-slot-1`, `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_TARGET=persistent-isolated`,
  `FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c`) printed the same Lab command as rounds 1-2 (`--llm-max-calls 48`, no
  permit, no cost option). That Lab command with `--dry-run` printed `status: ready`, `providerCallCount: 0`,
  `buildEntry: chat`, `target: persistent-isolated`, `coreDefaultModel: deepseek-flash`,
  `authorized.maxEstimatedCostUsd: 0.1`, `maxTotalEstimatedCostUsd: 0.1`, `permittedConsequences: []`, instruction
  415 characters `d4f7835b...`; prelude rebuilt the domain host and the extension for the instance (Core quiet,
  newest Core file 21:10:47Z).
- 21:20:12Z live run launched (`--max-attempts 1`); guard `admitted`. Run `run-mux6naez-6c20f26e`, 21:20:28Z to
  21:31:30Z, campaign exit 1. Not relaunched. The supervisor then ordered no further paid run this round (read-list
  redesign), so there is no second run.

## Round 3 — `run-mux6naez-6c20f26e`: failed, with the oracle held

- Cost: 55 provider calls, $0.103665108 in all. Per build: creation $0.054091, result-check judges $0.002263,
  re-author $0.047221. No build over the $0.10 ceiling.
- **Oracle passed**: 13 records, **13 matched in place**, 52/52 fields, final state held. The Flow is correct: one
  filtered read over 5 pages, 94 items seen, 2 earlier-page repeats, stop `control_disabled`, dedupe by url.
- **Verdict failed**: Core's post-run result check (judges 0080/0081, `no`, 0.6) refuted the exact answer as
  `core.result.does_not_answer_request`. The re-author then followed its advice, dropped the correct `plus is
  present` condition, and ran out of budget (`flow_bootstrap.evidence_budget_exhausted`) before testing it.
- Build path: the first draft dropped the three charging-case pairs (10/13). Both build-test judges said no and named
  exactly those pairs (C-2 live). The repair's first rerun read the exact 13. The model then reran the same read six
  more times, until lane A's `repeat_refused` and the refused-in-a-row stop sent the draft to a retest. Both judges
  said yes (C-3 `buildTest.stores` cited), and the Flow was proposed and played back.
- **Cause (R3-1, Core)**: `result-verification/request-rows/summary-reads.ts` inferred that a condition tested the
  row's own label whenever its left-out rows were said by label alone. The Flow stores only name/price/rating/url, so
  the playback's `plus is present` rows had no tested cell. `left-out-naming-the-item.ts` flagged two non-Plus "with
  Wireless Charging Case" pairs as "the item asked for", and the judge's instruction then makes a yes impossible
  unless it explains those rows one by one.
- Fix, left uncommitted (Core lane tree `fxwork/t274/!FluxIQ`, worker r3-c-tested-label, verified by the lead):
  - `read-account/accounts.ts` sets `testedLabel: true` only when every left-out row is labelled by the column the
    authored condition tests;
  - `request-rows/summary-reads.ts` takes that field for a run read (a build test keeps the inference: its replay
    always sends the tested cell, "(no value)" for null);
  - `contracts.ts` gains `testedLabel?: true`;
  - header updates in `types.ts` and `left-out-naming-the-item.ts`;
  - tests in `request-rows/tests/left-out-naming-the-item.test.ts` (new "run mux6naez" case),
    `request-rows/tests/run-muw60j7c.ts` (fixture name condition carries `testedLabel: true`) and
    `read-account/tests/alone-rows.test.ts`.
- Validation (lead):
  - fail-first, with `summary-reads.ts` at HEAD: `1 failed | 5 passed (6)`;
  - after: `npx vitest run` over `result-verification/{request-rows,read-account,build-test}/tests` and
    `result-verification/tests` -> 39 files, 377 passed;
  - `fluxiq:check` stamp current;
  - Core `structure-audit:check` passed (264 warnings, 349 baselined);
  - worker: Core `pnpm.cmd build` exit 0;
  - no downstream reference to the changed contract.
- Note for the supervisor: the result judge's JSON now shows `testedLabel: true` on a condition that tested the label.
  Its instructions already speak of rows "tested on the row's own label", and no instruction text or pin changed. To
  hide the field from the judge, strip it in `read-account/judge-paging.ts`.
- Proposed, not done:
  - R3-2: answer an unchanged rerun as unchanged (it says `applied` / `draftState: changed` because the rerun step
    gets a new id) and key the repeat guard on the step's resulting input and result (`R/llm/decision-handlers`,
    `R/llm/evidence-loop`);
  - R3-3: after a blamed read's rerun keeps the rows `judgement.checked` named, tell the model so and to complete;
  - R3-U-1..7 UI defects (`live-C-r3-ui-review.md`).
- Seen working on this source: lane A's repeat refusal and refused-in-a-row stop; history "unchanged"/`sameAs`;
  `whereToFix` and `checked` (t278) in the repair input; C-1; C-2 at the build test; C-3; B's `already_in_flow`
  answer.
- Not exercised: the paging hint, R2-1, D's reach fixes.
- C's must-see was only partly met: the repair round still opens on page 5, but the model ran no detect there, and
  the rerun put the page back to the step's start.
- For the read-list redesign (description only, no change made): this run's paging was right, so it needs nothing
  from the redesign. The redesign must still carry, to the judge, the value each condition tested on a left-out row,
  even when that column is not stored. Today a condition on an unstored column (here `plus`, `sponsored`) runs as an
  inline read whose per-row value never leaves the page, so the result check sees those rows by label only. If rows
  are post-processed from the run's dataset, keep the condition columns in the collected rows and drop them only
  from the stored output.
- Debug: `docs/working/language-driven-flow-loop-plan/debugs/run-mux6naez-6c20f26e.md`. UI review:
  `live-C-r3-ui-review.md`. Fix report: `r3-c-tested-label.md`.
