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
