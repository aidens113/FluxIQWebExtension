# t194 live lane C: the Flow judges its own answer

Lane lead report. Trees: `C:\Users\osrs_\FluxStuff\fxwork\t194\!FluxIQWebExtension` and its Core
`C:\Users\osrs_\FluxStuff\fxwork\t194\!FluxIQ`, both on `task/t194-live-judge-answer`, cut from dev
`defcbe2d` (downstream) and `f0dbbd6` (Core). Slot `lab-slots/slot-3`, instance `t194-slot-3`, headed,
deepseek-flash, production profile, 48k in / 8k out / 56k per call, 48 calls, $0.25 cap.
Launcher: `scratchpad/live-run-c.sh` (t174's `live-run.sh` with slot-3, the t194 tree, and the full Lab
log kept under `scratchpad/t194/`).

Goal: the Flow built from language extracts exactly the scenario's expected dataset, judges its own
answer correctly, and when wrong is refuted, re-authored and re-run until right. Stay on a task until
it passes twice in a row. Task order: `everything-store-plus-earbuds-under-50`,
`local-classifieds-bike-search`, `auction-marketplace-kestrel-auctions`,
`crossborder-marketplace-spain-hubs`, `professional-network-rotterdam-data-engineers`, then the other
`judgeBy: "expected-dataset"` tasks.

## Session 5 (2026-10-01, from 19:25 UTC): fixes that need no Lab

Trees fast-forwarded by the supervisor to local dev (downstream `a15a465e`, Core `f3778a8e`: round 5, F17-F20 on dev),
both on `task/t194-live-judge-answer`, clean at start. Labs stay stopped until t223 lands; t223's files (domain
`llm-evidence` page serialization, and the extension files its branch changes: `content/{dom-snapshot,rendered-elements,
describe-element,listed-parents,message-handler}.ts`, `content/actions/{capture-snapshot,types}.ts`, `shared/{protocol,
dom-element,snapshot-capture-options}.ts`, `background/connection/*`) are off limits.
- Core libraries rebuild started 19:29 UTC (Core dist was from 2026-09-30 23:27, older than `f3778a8e`); log
  `scratchpad/t194s5/core-libs.log`.
- Plan: task 1 (F17 leftovers: the closing message's spend and projected figures; `budgetBreaches` kept to the Lab) to
  t194-w23. Task 2: one T2 content-harness probe per task (headless Chromium on the real scenario site, the content
  script's own actions, `extract_list` and structure detection, no model, no Lab): t194-w24 bikes, w25 kestrel, w26 spain
  hubs, w27 rotterdam; each names its gaps to file:line with a proposed diff; the lead then assigns the fixes by file.
- **Supervisor, ~20:40 UTC: t223 is merged into dev (downstream `3851db67`, Core `28ceecf0`); return now with what is
  Ready to commit, narrow checks only (typecheck of touched packages, tests in changed directories, structure audit; no
  full suites).** So no fix round followed the probes: their gaps are listed below as next, each with its proving row.
- w23 (F21 below): task 1 done; task 2 stops at Core `runtime/service.ts:1558-1560` (`loopAccounting` builds the published
  accounting field by field and drops `budgetBreaches`; Must not touch). Publishing it also needs `flow-bootstrap/
  review-projection.ts:18-41` (whitelist), `generation-failure/{diagnostic.ts:25-48, diagnostic-parse.ts:132-159}` (a **wire
  change**: `hasExactFields` refuses the whole diagnostic on an unknown field), downstream `existing-fluxiq-control.ts:110,
  470-477`. The Lab side reads it already (absent = 0).
- Probes (T2, headless Chromium on the real sites, content-script actions, the domain evidence runtime with scripted
  decisions; no Lab, no model). Each gap row asserts the correct answer and is marked `test.fail` with its cause:
  - **bikes (w24)**: the chain works (cookie wall, category, notification, double Apply in the shadow root, price, condition,
    sort, robot pause); with the failed batch's "Try again" pressed by hand the proposal read equals `bikeRecords()` (adverts
    out, batch repeat once via `dedupe url`, outside results out, current price). GAP 1: a click on the shadow-root chip
    opens and re-closes the picker (`content/action-runtime/ignored-press/page-press-listener.ts:94` observes the scope walked
    out of the shadow root, `press-scope.ts:27-35`, so `click.ts:152-160` presses again). GAP 2: no read presses the failed
    batch's bare-span "Try again", every read stops at 9 of 12 (`content/extraction/list-wait.ts:109-119`,
    `pagination.ts:448-461`, `load-retry.ts:37` `PRESSABLE` lacks `[tabindex]`).
  - **kestrel (w25)**: the filter route plus the manifest's selectors returns exactly the 10; every trap handled (overlays,
    condition reset, bot check, round-arrow submit, sort first press, skeletons, `data-adid` ads, the "approx. £" estimate as
    its own column, `where` expresses every condition). G1 (blocks): no detected column is the title alone; m9 reads "New
    listingKestrel 35 …" (`content/extraction/infer-fields.ts:559` `pathStep`, `:649-659`). G2 (keyword route): numbered
    pager not detected, read stops at page 1 with 6 rows, `truncated: false` (`detect-pagination.ts:98`, `item-selector.ts:70`,
    `:123`). G3: `domain/src/actions/extraction/condition-match.ts:98,205` reads "EUR 169,00" as 16900 (not hit by the right
    condition). G4 (decision): an all-empty read passes (`content/actions/extract-list.ts:164`).
  - **spain hubs (w26)**: the walk, lazy tail, ads (`is: absent` on the Ad column), `atLeast 4.5` on the rating text, Best
    Match order and #2/#5 kept apart all work. G1 (blocks): the price is four sibling spans, no detected column holds
    "16,49 €" (`infer-fields.ts:385`). G2 (blocks the list-layout variant): field paths anchored by position through the card
    body (`infer-fields.ts:486-566`). G3: a detect within 600 ms of load names the sidebar (`detect-structure.ts:118-120`).
    G4/G5 (unfiltered route only): numbered pager not detected (`detect-pagination.ts:98,110-123`, `item-selector.ts:90`);
    with no `aria-current` the page control is picked by position (`pagination.ts:525-527`). The spec's fix-proof row reads
    all 13 on both layouts with the selectors the G1+G2 fixes would emit.
  - **rotterdam (w27)**: the whole chain from the feed (overlays, search, See all, 2nd, the Rotterdam NL typeahead, reopen,
    Show results) and the read return exactly the 23; the 429 check is waited out; the upsell variant passes. G1 (blocks a
    proposal-built read): Guildline's script Next goes page 2 -> 2; the read stops `page_repeated` at 20 rows with
    `truncated: false` (`content/extraction/pagination.ts:376` swaps to the page number only for a link back to its own
    page; fix: also when Next has no address). G2: a plan's `maxPages` is dropped when its mode differs from the detected
    one (`domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts:216-217`; detection proposes `maxPages: 1`).

**Session-5 validation (2026-10-01 20:35-21:00 UTC, narrow checks by the supervisor's rule; logs `scratchpad/t194s5/`):**
Core `bash heavy.sh "t194 lead core check" pnpm check` (fluxiq `tsc --noEmit`) rc 0; Core `npx vitest run
src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build` `Test Files 4 passed (4)`, `Tests 29 passed (29)`;
Core structure audit "passed (206 warning(s), 353 baselined)"; test-runner `heavy.sh pnpm build` (its `tsc -p tsconfig.json`)
rc 0, then `node --test dist/live-llm/tests/{build-usage,budget}.test.js dist/flow-lane/creation/tests/*.test.js` `# tests
108 # pass 108 # fail 0`; extension `heavy.sh npx tsc -p tsconfig.test.json --noEmit` (src, tests and e2e specs) rc 0;
the four live-task specs `heavy.sh pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests --reporter=list --output=e2e/test-results/t194-lead` "32 passed (4.4m)", rc 0: 17 rows
pass, 15 are the expected failures of the named gaps (none passed unexpectedly); downstream structure audit "passed (140 warning(s), 118 baselined)".

**Ready to commit (fix set 5: F21, F22), exactly `git status` of both trees.** Core
(`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/`): `budget-exhausted.ts`,
`phases.ts`, `tests/budget-figures.test.ts` (new). Downstream: test-runner `src/flow-lane/creation/build-proposal.ts`,
`src/live-llm/{build-usage.ts, tests/build-usage.test.ts}`; extension `e2e/content/tests/live-tasks/tests/*.spec.ts` (4 new);
docs `reports/t194-w23..w27-*.md` (new), this report. Validation: the session-5 validation above.

**Next (unfixed, each with its proving `test.fail` row):** bikes GAP 2 (Try again) and GAP 1 (shadow-root press); kestrel
G1 (title column) and G2 (numbered pager); spain hubs G1 (price spans) and G2 (positional field paths), then G3-G5;
rotterdam G1 (script Next 2 -> 2) and G2 (`maxPages` dropped); kestrel G3 (decimal comma) and G4 (an all-empty read
passes, a policy call); F21's Core publication of `budgetBreaches` (a wire change). File partition for the fix round:
`infer-fields.ts` (kestrel G1, spain G1+G2) one worker; `detect-pagination.ts` + `item-selector.ts` (kestrel G2, spain G4)
one; `pagination.ts` + `list-wait.ts` + `load-retry.ts` (bikes GAP 2, rotterdam G1, spain G5) one;
`ignored-press/page-press-listener.ts` + `press-scope.ts` (bikes GAP 1) one; domain `plan-resolution/extraction/slot.ts`
(rotterdam G2) and `actions/extraction/condition-match.ts` (kestrel G3) one. Each worker report holds its proposed diff.

## Session 5b (2026-10-01, from 20:50 UTC): live again

The supervisor committed F21-F22 and merged dev (Core `ede2bd94`, downstream `ea19946f`; trees at `90ad1972` / `a6369044`,
with t223's compact page view and lane B's B1) and lifted the Lab stop for this lane: slot-3, headed, the ten realistic
scenarios only; earbuds first until it passes twice; between runs, fix the F22 gaps and turn each `test.fail` into a pass.
- Core libraries rebuilt: `heavy.sh "t194 core-libs s5b" pnpm --filter @fluxiq/contracts --filter fluxiq --filter
  @fluxiq/client-gateway-websocket build` -> contracts and gateway reused from stamp, fluxiq built (54.5 s), rc 0.
- Run 10 (earbuds) launched 20:52:17 UTC through `scratchpad/t194/live-run-c.sh` (log `scratchpad/t194/run10.log`); the reason:
  first live test of t223's compact page view, lane B's B1 and F17-F21 on the task whose run 9 failed only on the purse.
- **Run 10 `run-muq0in9r-0793b448`: stage 0, killed 20:54:41 UTC, 23 s after admission, $0.00, 0 provider calls** (debug
  `debugs/run-muq0in9r-0793b448.md`, t194-d10). Not a product result: the supervisor's `taskkill /T /F` on every process
  matching `run-lab\.mjs` (meant for lane B's stuck run during the DeepSeek outage: every decide timed out at 45 s, a 5-token
  ping took 60 s) took it down. Found on the way, this lane's area: a killed run leaves only `.staging-run-*`, so the spend
  ledger's reconciled finish records no run and no cost (`packages/test-runner/src/run-scenario.ts:603,681`,
  `scripts/lab/live-guards/run-outcomes.mjs:21`, `close-launch.mjs:34-36`, `ledger-queries.mjs:30-45`); not fixed (next).
- **Supervisor, after run 10: no Lab until DeepSeek answers again, and no new direct-API run at all: live builds must start by
  typing the instruction into the real extension chat (t227 builds that launcher).** Meanwhile the F22 gaps were fixed, F23-F27,
  by t194-w28..w32 in parallel (partitioned by file), then t194-w33 turned the probe rows green (F28).

**Session-5b validation (2026-10-01 ~21:30-22:35 UTC, narrow; logs `scratchpad/t194s5/v-*.log`, `t2-sweep.log`):** extension
`heavy.sh npx tsc -p apps/extension/tsconfig.json --noEmit` rc 0; `-p apps/extension/tsconfig.test.json` 3 errors, all TS2610
`ownerDocument` in unmodified `src/panel/{extraction/tests/dialog-dom.ts, recording/review/tests/recording-review.test.ts,
settings/tests/forget-confirmation.test.ts}` over `panel/chat/tests/fake-dom.ts` (from the dev merge; not this lane's, for the
supervisor); domain `npx tsc -p domain/tsconfig.json` and `-p domain/tsconfig.test.json` rc 0; narrow unit runs
(`scratchpad/t194s5/narrow-tests.mjs`, the package's own esbuild settings): extension `content/extraction` +
`content/action-runtime/ignored-press` 29 files `# tests 235 # pass 235 # fail 0`, domain `actions/extraction` +
`runtime/llm-evidence/plan-resolution/extraction` 14 files `# tests 100 # pass 100 # fail 0`; T2 `heavy.sh pnpm --filter
@fluxiq-web-extension/extension test:content -- e2e/content/tests/extraction/tests e2e/content/tests/live-tasks/tests`
**"106 passed (4.5m)", rc 0**, no `test.fail` left; downstream structure audit "passed (145 warning(s), 118 baselined)".
Not run: `e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts:73` fails (rank 37, under 15 expected) with
F26 reverted too (w31), so not this lane's; owner likely t223 (handle ranking), for the supervisor.

**Ready to commit (fix set 6: F23-F28), exactly `git status`; Core unchanged.** Extension `content/extraction/{infer-fields,
detect-pagination, detect-structure, item-selector, list-reader, list-wait, load-retry, order-rows, pagination}.ts`,
`content/extraction/{composed-value/, placeholder-run/}` (new), `content/extraction/tests/{detect-pagination.test.ts,
fake-shadow-dom.ts, infer-fields.test.ts, item-selector.test.ts, load-retry.test.ts, pagination.test.ts, store-pager.ts,
selector-page.ts (new)}`, `content/action-runtime/ignored-press/{index.ts, page-press-listener.ts, scope-roots.ts (new),
tests/page-press-listener.test.ts, tests/scope-roots.test.ts (new)}`, `e2e/content/tests/live-tasks/tests/*.spec.ts` (4),
`e2e/content/tests/extraction/tests/job-board-listing.spec.ts`; domain `actions/extraction/{condition-match.ts,
tests/condition-match.test.ts}`, `runtime/llm-evidence/plan-resolution/extraction/{slot.ts, tests/slot.test.ts}`; docs
`debugs/run-muq0in9r-0793b448.md`, `reports/t194-w28..w32,w34-*.md`, this report. Validation: session-5b validation above.

**Next:** earbuds live through t227's chat launcher once dev is merged; first, the cause of t227's `run-muq310ht-ab80eed0`
(earbuds, $0.277, 0 of 13 records, `core.result.does_not_answer_request`). Open: kestrel G4 (an all-empty read passes,
`content/actions/extract-list.ts:164`; the grid-view manifest read returns 10 empty records as `passed`): a policy call for
the supervisor; killed runs unaccounted in the spend ledger (run 10's debug); F21's Core publication of `budgetBreaches`
(a wire change); the link-text column glued to a badge is still offered beside the clean title span (a model may pick it).

## Session 6b (2026-10-02): Lab-free items while lane B fixes the rerun page

The supervisor merged F29-F31 (`6552e2c3`) and routed: reruns reading wherever the tab is to lane B (top priority);
`not_at_start_location` to t228 (awaits the user); a `changed` dry-run step no longer blocks completion (lane D). Lane C, no
Lab until the supervisor's go (after t229's page-view fix and lane B's rerun fix): F32 (judge brief), F33 (re-author patch
shapes), F34 (store only the declared columns), all validated narrowly (Fix log). Decision for the supervisor: a Flow
with no declared record schema (run 12) still stores helper columns; options: the build always declares the schema from
the instruction's named columns, or leave as is.

## Session 6 (2026-10-01, from 22:45 UTC): live through the chat launcher

The supervisor committed and pushed the merge, F23-F28 and G4 (dev `8fa5a944`); trees at current dev (Core `83a6cc3a`), with
t223's stable handles, t227's chat launcher, lanes A/B/D's fixes. Live again on slot-3, headed, builds started by typing the
instruction into the real extension chat (the Lab's default path; `live-run-c.sh` unchanged: `deepseek-flash` is the chat's
default model). Lane B's general guard against repeated identical failing calls has not landed: a run that visibly loops
on one action is stopped early. Decisions are watched live by `scratchpad/t194/watch-run.mjs` (tool, node, result code,
repeat count from the decision dump; no page text).
- Core libraries rebuilt rc 0 (`scratchpad/t194s5/core-libs-3.log`).
- Run 11 (earbuds) launched 22:48:50 UTC; the reason: first chat-driven earbuds run on current dev, and t227's
  `run-muq310ht-ab80eed0` (0 of 13 on an older tree) is to be re-tested. t194-d227 (background) reads that run's artifacts
  for the cause of its 0 rows.
- t194-d227 (`reports/t194-d227-zero-rows.md`): t227's Flow had no typing step (the build typed the search but the step
  stayed `taken`, not added: Core `evidence-loop.ts:207-211`, draft authoring), so playback pressed Go on an empty box; its
  read saw `never_appeared`, `minItems 0`, and passed; the dry run could not see it, because `node-run/replay.ts:92,243`
  counts the longest array in the payload (`fieldNames`, `snapshot`) as the record count.
- **Run 11 `run-muq4oaof-464f5bce`: failed, $0.1729, 39 calls (the Lab counts 20: the re-author's 19 are missing),
  input tokens per call min 1,573 / median 30,104 / max 75,814** (debug `debugs/run-muq4oaof-464f5bce.md`, t194-d11). The
  chat built and applied a Flow; it ran and stored 21 rows, 0 of 13 matched. Causes: (1) the build's five reruns of its read
  all ran on page 5, where the first read left the tab (Next disabled: one page, 11 unfiltered rows each); a rerun does not
  return to the step's `replay.from` (Core `llm/evidence-loop/rerun-request.ts:74`, **lane B**); (2) 16 re-author reruns
  refused `invalid_input`/`consequences_unreadable` for a `consequences: null` nobody wrote (domain `node-run/run.ts:692`
  writes it back, `permission.ts:91` refuses it): lane C, fixed F29; (3) the Flow got a second copy of the list read (s9,
  page 5 again; `flow-draft/amendment.ts:209-224`, **t196**); (4) helper columns `plus` and `ad` stored beside the four asked
  for, so the Lab paired no row although positions 0-6 were right: lane C, F30 (the model is told) and F31 (the Lab says
  "extra columns"); (5) the dry run passed an unfiltered duplicate read and counts arrays, not records: F29; (6) the judge
  advised aligning s8 and s9 rather than dropping s9; the "charging case" rule dropped 3 true pairs again (F19 showed it).
  The repeat guard (t193 RG) landed after launch; by d11's count it would have refused 3 of the 5 build reruns and stalled
  each re-author round 4 decisions sooner.
- Supervisor, during the fixes: no new refusal of anything the model chose (user rule); prefer information. F29 removes a
  refusal (`null` consequences on a read) and makes the existing dry-run comparison accurate; F30 is text; F31 is the Lab's
  report. Note: F29's dry run now answers `changed` for a read that returns 0 rows where the build's had rows, and a
  `changed` step still refuses completion (`llm_evidence_loop.dry_run_refused`, Core `flow-draft/dry-run.ts`) until t228
  removes that gate.
- Fixes, validated (narrow): domain `tsc -p tsconfig.json` rc 0; `-p tsconfig.test.json` 1 error, in
  `node-run/tests/covered-press.test.ts:51` from dev's `46cf82c2` (not this lane's); domain `node-run` + `llm-evidence/tests`
  44 files `# pass 297 # fail 0`; test-runner `check` rc 0, `run-expectations/extraction` tests `# pass 44 # fail 0`;
  structure audit passed. Core libraries rebuilt after RG, rc 0.
- **Run 12 `run-muq66ff9-cb3767a1` (launched 23:31:50 UTC; reason: F29-F31 and RG live): failed, $0.3239 over 80 calls
  (build $0.0980 / 26, judge $0.0125 / 8, re-author $0.2134 / 46 incl. 3 malformed; the Lab counts 34), input tokens per call
  min 1,575 / median 28,921 / max 46,820; 11 rows stored, 0 of 13 matched** (debug `debugs/run-muq66ff9-cb3767a1.md`,
  t194-d12). F29 took effect (no `consequences_unreadable`); RG fired 17 times and stalled 2 rounds; F31 named the extra
  columns `plus`, `ad`; F30 did not change behaviour (both still kept). Causes: (1) **lane B**: a rerun runs wherever the
  last read left the tab (page 5), so every rerun read one page of 11 (`llm/evidence-loop/rerun-request.ts:74`); (2) **t228**:
  a repair round's opening `initial.` call erases the arrival the stall test made, so 3 reads were refused
  `not_at_start_location` (domain `node-run/run.ts:211,255`, `arrival.ts:69-71`); (3) lane C, judge: a false
  `result.column_always_empty` on `ad` (empty because `where ad absent` requires it; Core `repair-directive.ts:216-222`) and
  "raise maxPages" said of a list that ended (`read-account/sentence.ts:14-15`); (4) lane C, re-author: 14
  `unexpected_input_keys` from the model alternating `{extractList}` and `{parameters: {extractList}}` patches
  (`flow-draft/amendment.ts:140`, `rerun-input.ts:30-45`), and `where` replaced whole loses its selectors (`rerun-input.ts:42`);
  (5) lane C: re-authors applied untested; the domain stores all six columns over the author's four-column schema
  (`reconciled-record-output.ts:67-75`).

## Session 5c (2026-10-01, from ~22:45 UTC): the dev merge, and G4

The supervisor committed F23-F28 (`32c764c3`) and merged dev (Core `83a6cc3a` clean; downstream stopped on 4 conflicts
against lane A's F16, lane D's F20/F28/F31/F33). Resolved by the lead, both sides kept:
- `ignored-press/page-press-listener.ts` (+ test): one implementation, `scopeRoots` (the roots the scope walk crossed,
  closed ones too, plus every open root beneath the scope through dev's `openRootsWithin`), which is a superset of lane A's
  `shadowRootsWithin`; lane A's guard for a scope that cannot be searched moved into `scope-roots.ts`. The test keeps both
  rows (our chip-inside-a-root row, lane A's nested-widget row) over one fake page.
- `extraction/detect-structure.ts`: lane D's `Attempt {answer, improvable}` with lone records, and our placeholder wait:
  `attemptOf` (was `settledUnlessRefused`) also marks an answer improvable while a larger placeholder run is being drawn.
- `extraction/tests/pagination.test.ts`: both appended blocks kept.
- The merged tree failed the structure audit (`pagination.ts` 802 lines; `extraction/tests/` 26 files), so the pager
  reading moved to `extraction/pager-reading/` (pagination.ts 685 lines) and `list-reader-lazy-tail.test.ts` folded into
  `list-reader.test.ts`. Staged with the resolution.
- **G4, the supervisor's decision: an all-empty read fails** (`content/actions/extract-list.ts` `validationFor`: rows came
  back and every declared field of every row read nothing -> `failed`, whatever `minItems`; the domain already names it
  `records_have_no_fields`); `actions/tests/extract-list.test.ts` (the old row now fails; a new row covers `minItems: 0`, 9 of
  10 empty passes, 0 rows with `minItems: 0` passes); the kestrel grid-view row now expects the failure. Not staged.
- Validation: Core libraries rebuilt rc 0; extension `tsc -p tsconfig.json` and `-p tsconfig.test.json` rc 0; narrow units
  `content/extraction` + `ignored-press` 32 files `# pass 269 # fail 0`, `content/actions` 13 files `# pass 106 # fail 0`;
  structure audit "passed (154 warning(s), 118 baselined)"; T2 extraction + live-tasks + click `122 passed, 2 failed`, the 2
  in `click.spec.ts`; `press-answers` (lane A's) 3/3 and `shadow-roots` with 3 failures. **The 5 failures are dev's, not the
  resolution's:** with dev's own `page-press-listener.ts` swapped in, the same 5 fail (`click.spec.ts:119` a press that
  changes nothing now fails `output_not_observed`, lane A F16; `:132` a disabled target retried 5 times, lane D F32;
  `shadow-root-controls.spec.ts:73` pre-existing; `:93,:163` clicks on a search box fail `output_not_observed`, lane A F16).

## Session 4 (2026-10-01, from 05:00 UTC), after round 3 and t210 rounds 1-2

Trees fast-forwarded to pushed dev (downstream `58fd0cd3`, Core `e5b8f015`); every lane C fix set (F0-F16) is on dev.
- Core libraries rebuilt first: `heavy.sh "t194 core-libs" pnpm --filter @fluxiq/contracts --filter fluxiq --filter
  @fluxiq/client-gateway-websocket build` -> contracts and client-gateway-websocket restored from the store, fluxiq built
  from source (94 s), each "build: Done", rc 0.
- Launcher `scratchpad/t194/live-run-c.sh` (session `58ff9269`): one run per launch, no loop; refuses on `STOP-balance` or a
  held `slot-3/owner`; per-call flags at Core's window (`--llm-max-input-tokens 992000 --llm-max-output-tokens 8000
  --llm-max-total-tokens 1000000`), `--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events`, decision dump to
  `test-runs/instances/t194-slot-3/decision-dumps/`, `FLUXIQ_LAB_KEEP_RUN_STATE=1`.
- Stage 1 for the other four tasks written by t194-w18 from source only (`reports/t194-w18-stage1-four-tasks.md`): bike
  search 12 records, kestrel 10, spain-hubs 13, rotterdam engineers 23.
- Run 9 (`run-mup2u8o3-6697c4be`, earbuds) started 05:06 UTC, admitted by the guards; the reason: first live test of
  round 3, t210 and lane C's F10-F16.
- **HOLD (supervisor, 2026-10-01 ~05:20 UTC): no new live run until the supervisor says the compact page format has
  landed.** The user rejected the current page evidence (every rendered element as JSON with all its attributes, about
  500 KB per page). Run 9 may finish and is debugged as usual. `domain/src/runtime/llm-evidence/` page serialization
  (elements, capture, page-evidence, present, attributes, tools) is now t223's; lane C does not edit it.
- **STOP (supervisor, by the user's direct order, 2026-10-01 ~05:30 UTC): no Lab of any kind, live or provider-free,
  until the supervisor lifts it; the supervisor killed every running Lab.** Lane C had nothing in flight: run 9 had
  finished on its own at 05:19:39 UTC (launcher `exit=1`, `slot-3/owner` cleared). Only non-Lab work continues.
- Run 9 cost **$0.2969** (spend ledger `finish`, `buildsOverCeiling 1`). Lane spend this session: $0.2969, one run.
- **State at hand-back (2026-10-01 ~06:55 UTC):** no Lab running or started since run 9; `slot-3/owner` clear. Fix set 4
  (F17-F20) validated and Ready to commit (Fix log). Streaks: every task 0. Next, once the stop is lifted and t223 has
  landed: merge dev, rebuild Core, re-run earbuds to test F17-F19 live with the compact page view. Open follow-ups: F17's
  closing-message figures and breach propagation (`flow-bootstrap/unfinished-build/{budget-exhausted,phases}.ts`,
  `service/flow-bootstrap-commands`, Lab `live-llm/build-usage.ts:55`); a domain test holding its execution-result key list
  to Core's exported `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS` (F18); the supervisor's decision on giving the
  judge the alone rows themselves (F19).

## Fix log

Newest first. Status: validated (the named checks ran and passed), or in progress.

| Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| F39 A field spec carrying a member its kind does not take (`attribute` on a non-attribute kind, `header` on a non-column kind) is read by its kind with the stray member dropped, in the field map and the condition `read` form, instead of refusing the field; a kind missing its own member is still refused (cannot execute). Closes F37's `header` case (w42's second option, matching the no-refusal rule) (t194-w45; three tests that pinned the old refusal updated by the lead) | domain `actions/extraction/{read-request.ts, tests/read-request.test.ts}`, `client/tests/gateway-command-parameters.test.ts`, `output-nodes/extract-list/tests/issues.test.ts`, `extraction/tests/structure-detection.test.ts` | F37 open question | w45: 2 tests fail on the old source; lead: domain tsc x2 rc 0; narrow `client`, `extraction`, `output-nodes/extract-list`, `actions/extraction` 28 files 172/172 and `runtime` 109 files 749/749; audit passed | validated |
| F38 "The instruction asks for a column X that no field reads" is information, never a refusal: to the building model as a `note` after the acts in the draft entry it sees every decision (no id, never counted missing), and to the judge as `resultSummary.instructionColumnsUnread` in its brief; the completion's warning rides on the ok verdict as `warnings` (not on `check`, whose keys the loop holds exact) (t194-w44). Not done: nothing persists `verdict.warnings` yet (`runtime/service.ts`) | Core `runtime/flow-bootstrap/authoring/{instruction-record-columns.ts, index.ts, tests/instruction-record-columns.test.ts}`, `runtime/llm/harness-options/{draft-acts.ts, bootstrap-completion.ts, tests/{draft-acts.test.ts (new), bootstrap-completion.test.ts}}`, `runtime/result-verification/{contracts.ts, verify.ts, read-account/{index.ts, unread-columns.ts (new), tests/unread-columns.test.ts (new)}, tests/judge-sees-the-read.test.ts}` | F35's unmatched-column warning was dropped | w44: 6 tests fail on HEAD; lead: Core vitest (result-verification, llm/harness-options, flow-bootstrap/authoring) 36 files 370/370, `pnpm check` rc 0, audit passed | validated |
| F37 A rerun patch that changes a field's `kind` drops the stored member named after the old kind (`attribute`), so `{kind: "text"}` over a stored attribute field no longer keeps its old `attribute` (t194-w42; a table column's `header` is not covered, options in the report) | Core `runtime/llm/evidence-loop/{rerun-input.ts, tests/rerun-input.test.ts}` | run 12 (w39 cause 6a) | w42: 2 tests fail on HEAD's file; lead: as F35 | validated |
| F36 Stored conditions name a kept column by its key (`field: <key>`) where a kept column reads the same value, and a column the plan does not keep still carries its own `read` spec, which F34 turns back into a read when the declared schema drops a helper (end-to-end test); the dispatch reader already took the key form (t194-w42) | domain `runtime/llm-evidence/plan-resolution/extraction/{conditions.ts, tests/{conditions,column-match,slot}.test.ts}` | run 12: the model was shown `read: {kind, required}` for its own columns and rewrote them blind (w39) | w42: 6 tests fail on HEAD's `conditions.ts`; lead: domain tsc x2 rc 0, plan-resolution + output-nodes/extract-list + actions/extraction 30 files 193/193, audit passed | validated |
| F35 **The build always declares the columns the instruction names** (supervisor's decision): an extraction step with no declared record output gets a schema of the instruction's named columns (Core's own `namedColumns`, moved to `answerability/instruction-columns.ts`) matched to its field keys, through both doors (a reply's plan and the build's draft); an author-declared schema is never overwritten; unmatched names are recorded as `record_output.named_column_unmatched` (information, no gate); the completion now passes the instruction text in (lead: `llm/harness-options/bootstrap-completion.ts`, 4 lines, and a test through `checkAutomationStudioFlowBootstrapCompletion`). With F34 the read and the store then carry exactly those columns (t194-w43 + lead) | Core `runtime/flow-bootstrap/answerability/{instruction-columns.ts (new), instruction-ask.ts, index.ts}`, `runtime/flow-bootstrap/authoring/{instruction-record-columns.ts (new), normalise.ts, record-output.ts, assemble.ts, json-plan.ts, accept.ts, assemble-draft.ts, index.ts, tests/instruction-record-columns.test.ts (new)}`, `runtime/llm/harness-options/{bootstrap-completion.ts, tests/bootstrap-completion.test.ts}` | run 12: `recordOutput: null`, helper columns stored | w43: 5 tests fail on HEAD; lead: the wiring test fails with HEAD's `bootstrap-completion.ts`; Core vitest (authoring, answerability, llm/evidence-loop, llm/harness-options) 43 files 346/346, `pnpm check` rc 0, audit passed. Not done: the success path drops warnings, so `named_column_unmatched` reaches neither model nor judge yet | validated |
| F34 The stored answer carries exactly the Flow's declared record-output columns: a kept field outside the schema that a `where` reads is still read for the condition and left out of `extracted`, the stored rows, the preview and `fieldNames`, applied at the dispatch so page, summary and store agree; nothing changes with no declared schema (t194-w40). Not covered: run 12 declared none (`recordOutput: null`), so its `plus`/`ad` would still be stored: a decision for the supervisor | domain `output-nodes/extract-list/{declared-columns.ts (new), dispatch.ts, reconciled-record-output.ts, index.ts, tests/declared-columns.test.ts (new)}` | runs 11, 12: helper columns stored | w40: 4 new tests fail on HEAD; lead: domain tsc x2 rc 0, `output-nodes/extract-list` 39/39, audit passed | validated |
| F33 The re-author's rerun patches: a patch naming none of `node`, `parameters`, `consequences` over a node call is read as a parameters patch (one clause in the `input` description), and a rewritten `where` gets back the selectors the model was never shown, from the stored condition it repeats or the one column it matches (t194-w39). Not done: changing a field's `kind` keeps its old `attribute`; a proposed domain diff (stored conditions name kept columns by key) in the w39 report | Core `runtime/llm/evidence-loop/{rerun-input.ts, tests/rerun-input.test.ts}`, `runtime/flow-draft/amendment.ts` (one clause) | run 12: 14 `unexpected_input_keys`, `where` replaced whole | w39: 6 tests fail on the old source; lead: Core vitest (result-verification, flow-draft, llm/evidence-loop) 47 files 365/365, `pnpm check` rc 0, audit passed | validated |
| F32 The judge's brief: a column a read's own condition keeps empty (`is absent` and the like) is no longer reported `column_always_empty`; a read stopped because the list ended is said as "read every page (N) and the list ended", and only a `page_limit` stop is told to raise maxPages (t194-w38) | Core `runtime/result-verification/{repair-directive.ts, read-account/{sentence.ts, index.ts, stop.ts (new), emptied-columns.ts (new)}, tests/repair-directive.test.ts, read-account/tests/{sentence,emptied-columns}.test.ts}` | run 12: false `column_always_empty` on `ad`; "raise maxPages" for a list that ended | w38: 6 tests fail on the old source; lead: as F33 | validated |
| F31 The Lab's mismatch report says "extra columns": rows refused only for keys the expectation does not name are `extra-columns` with the key names (never values), and the step says how many rows would pair on the named columns alone; the judgement stays strict (t194-w37) | test-runner `src/run-expectations/extraction/{mismatches.ts, tests/mismatches.test.ts}` | run 11: 21 rows, `values-differ` with `fields: []` | w37: 2 tests fail on the old source; lead: `# pass 44` | validated |
| F30 The exploring model is told, in the detect tool's description, that a `where` condition may name a column `fields` does not keep: keep only the columns asked for, never a mark used only to filter (t194-w36). Not done: a note on the read naming kept columns used only by conditions (needs `node-run/run.ts:414`); `output-nodes/extract-list/catalog-text.ts` (700 of 700 characters) still does not say it | domain `runtime/llm-evidence/{tools.ts, tests/tools.test.ts}` | run 11: `plus`, `ad` kept | lead: domain narrow 297/297 | validated |
| F29 A rerun no longer carries a `consequences: null` nobody wrote: the domain never writes back consequences the call did not carry, and a read accepts `null` as none declared (an acting node still treats it as unreadable); the dry run reads a list read's own `extraction.recordCount`/`itemsSeen`, answering `changed` when the replayed read returns 0 where the build's had rows, or reads unfiltered where the build's applied conditions (t194-w35) | domain `runtime/llm-evidence/{permission.ts, node-run/run.ts, node-run/replay.ts, node-run/tests/{unwritten-consequences, replay-read-account}.test.ts (new), node-run/tests/rejected-rows.test.ts}` | run 11 (16 refused reruns); t227 run (0 rows passed the dry run) | w35: 9 tests fail on HEAD's sources; lead: 297/297 | validated |
| F28 The probe specs after F23-F27: no `test.fail` left; the bikes read leaves adverts out by the column reading "Sponsored" (a title now reads on an advert too, F24), the kestrel read picks its title as a model would (the text column that names a Kestrel and tells cards apart whose words lie inside every other such column's: the new title span, not the badge-glued link) (t194-w33, which stalled before its report, and the lead); `job-board-listing.spec.ts:90` rewritten to F10's contract: "names nothing" stops `control_absent` on the board's last page, and on page one follows the board's own Next (t194-w34) | extension `e2e/content/tests/live-tasks/tests/*.spec.ts`, `e2e/content/tests/extraction/tests/job-board-listing.spec.ts`; `content/extraction/order-rows.ts` (comment: the continental number rule) | F22; `job-board-listing:90` had failed on dev since F10 | session-5b validation (below) | validated |
| F27 A plan's own page bound is kept whatever mode it names (within the cap; only the detected control is ever pressed), so `{mode: numbered, maxPages: 5}` reads every page; a number written the continental way is read as written ("169,00" -> 169, "1.165,00" -> 1165) where it can only be continental, English forms unchanged, ambiguous lone groups as before (t194-w32) | domain `runtime/llm-evidence/plan-resolution/extraction/{slot.ts, tests/slot.test.ts}`, `actions/extraction/{condition-match.ts, tests/condition-match.test.ts}` | F22 probes: rotterdam G2, kestrel G3 | w32: new rows 3 fail on HEAD's sources; session-5b validation (below) | validated |
| F26 The ignored-press watch also observes every shadow root the press's scope walk crossed and every open root beneath the scope, so a click that opens a panel inside a shadow root is not pressed a second time (Kerbfind's radius chip) (t194-w31) | extension `content/action-runtime/ignored-press/{scope-roots.ts (new), page-press-listener.ts, index.ts, tests/scope-roots.test.ts (new), tests/page-press-listener.test.ts}` | bikes GAP 1 | w31: the new listener row fails with the root observation removed; session-5b validation | validated |
| F25 Detection: a numbered pager whose current page carries an extra class, and whose links sit inside a pager element, is detected (shared classes, not the first control's); Next still preferred where it reads every page; a detection made while the results are skeleton cards waits for them rather than settling on the sidebar (t194-w29) | extension `content/extraction/{detect-pagination.ts, item-selector.ts, detect-structure.ts, placeholder-run/ (new), tests/{detect-pagination,item-selector}.test.ts, tests/selector-page.ts (new)}` | kestrel G2, spain G3/G4 | w29: 6 new tests fail on HEAD; session-5b validation | validated |
| F24 Detected columns: a classless element is named by `tag:not([class])`, so a title span is its own column without the "New listing" badge; a value drawn in sibling spans ("16" ",49" " €") is offered as one column; field selectors name the element by its own class anywhere in the card before its position, so a Flow built on the grid reads the list layout; keys and labels unchanged, only newly built Flows get the new selectors (t194-w28) | extension `content/extraction/{infer-fields.ts, composed-value/ (new), tests/{infer-fields.test.ts, fake-shadow-dom.ts}}` | kestrel G1, spain G1/G2 | w28: the 4 gap rows fail with HEAD's infer-fields; session-5b validation | validated |
| F23 Paging reads: the one-page reveal and a scroll-paged read press the list's own "Try again" under it (a bare focusable span counts; whole-label rule; at most 2 per read), so a failed lazy batch is read; a Next with no address of its own (a script button) is swapped for the pager's next number, and a read that stops `page_repeated` while the pager showed a later page ends `truncated: true`; with no `aria-current`, the current page is the numbered control linking to this document, never a position (t194-w30) | extension `content/extraction/{load-retry.ts, list-wait.ts, pagination.ts, list-reader.ts (800 lines), tests/{load-retry,pagination}.test.ts, tests/store-pager.ts}` | bikes GAP 2, rotterdam G1, spain G5 | w30: every new row fails on HEAD; session-5b validation | validated |
| F22 Four T2 probe specs, one per live task (bikes, kestrel, spain hubs, rotterdam): the Stage 1 chain walked with the content script's own actions on the real scenario site, reads through `extract_list` and the domain evidence runtime with scripted decisions; every gap row asserts the correct answer, marked `test.fail` with its cause (t194-w24..w27; the bikes and spain-hubs markers added by the lead) | extension `e2e/content/tests/live-tasks/tests/{local-classifieds-bike-search, auction-marketplace-kestrel-auctions, crossborder-marketplace-spain-hubs, professional-network-rotterdam-data-engineers}.spec.ts` (new) | Stage 1 of the four tasks (w18); the Lab stop | session-5 validation (below) | validated; the gaps they prove are next |
| F21 F17's leftovers: a purse refusal's closing message states the spend and the refused call's worst case ("…limit of $0.25 before the Flow was finished: it had spent $0.154, and its next call could have cost up to $0.146."; whole-build figures, repairs included; message only, no wire field); `budgetBreaches` is summed across rounds (`phases.ts`), and the Lab reads Core's count when published (`build-proposal.ts` `accountingOf`, `build-usage.ts:56`; absent = 0), so its budget check flags a build's breaches as a run's (t194-w23) | Core `runtime/flow-bootstrap/unfinished-build/{budget-exhausted.ts, phases.ts, tests/budget-figures.test.ts (new)}`; test-runner `src/flow-lane/creation/build-proposal.ts`, `src/live-llm/{build-usage.ts, tests/build-usage.test.ts}` | run 9 (F17 follow-ups) | w23: new Core test 5 of 7 fail on the old source; new downstream test `expected: 2, actual: 0` on the old line; session-5 validation (below) | validated. **Not done:** Core does not publish breaches (`service.ts:1558-1560`; then `review-projection.ts:18-41`, `diagnostic-parse.ts:132-159`, a wire change; downstream `existing-fluxiq-control.ts:110,470-477`) |
| F20 A live run whose product failed (a build without a Flow) is never labelled a facility failure when the Lab's budget check also fails it: the `performance.budget` breach carries the lane's `runtime.behavior` failure as its `cause`, and `productFailureOf` reads through it; the category stays `performance.budget` (t194-w22) | test-runner `src/live-llm/{budget-over-product-failure.ts (new), live-llm-run.ts, lane-settlement.ts, index.ts}`, `src/run-scenario/product-failure.ts` + tests (`run-scenario/tests/product-failure.test.ts`, `live-llm/tests/{live-llm-run,lane-settlement}.test.ts`) | run 9: `facilityFailure: scenario.execute/unclassified` on a no-Flow, over-ceiling build | w22: new tests 3 fail on the old source, 32/32 after; test-runner check rc 0; session-4 combined validation (below) | validated (worker); see combined |
| F19 The rows a `where` condition removed **by itself** are said apart: the exploring model's `read.rejectedRows` gives per condition `{where, rejected, alone, rowsAlone, rowsWithOthers}` and one sentence (`rejectedRowsNote`) to check the alone rows against the instruction; every read (playback too) counts `conditions.alone`, carried across pages, stored as counts only; the judge's read account says "rejected 20 rows, 5 of them by itself" and points at such a condition first (t194-w21 for the page, domain and summary; lead for the judge) | extension `content/extraction/{rejected-samples.ts, list-reader.ts, filtered-answer.ts}`, `content/actions/extract-list.ts`, `shared/extraction-continuation.ts`; domain `actions/extraction/{summary.ts, rejected-samples.ts}`, `runtime/llm-evidence/node-run/rejected-rows.ts` (extraction rows, not page serialization); Core `service/summaries/extraction-summary.ts`, `result-verification/{contracts.ts, read-account/accounts.ts, read-account/sentence.ts}`; tests beside each | run 9: the accessory rule `name not contains "charging case"` rejected 20 (17 also failed price, rating or Plus); the 5 it removed alone were 2 accessories and the 3 missing earbuds | w21: domain 1063/1063, extension 1678/1678 (run directly; Core dist was stale then), downstream audit passed; lead: Core read-account 15/15 (2 new); session-4 combined validation | validated in parts; see combined. **Decision for the supervisor:** giving the judge the alone rows themselves means playbacks ask for rejected rows and store page text in Core's run record; recommended: counts only until the user decides |
| F18 A tool result that carries `clearedWait` (a click that waited out a robot check that cleared by itself) is no longer refused as `llm_evidence_loop.tool_result_invalid`: Core's exact key list lacked the member the domain had emitted since t203 (`domain/.../node-run/cleared-wait.ts:25`; the domain's own list at `capture.ts:283` had it). A refused result now names its check, `llm_evidence_loop.tool_result_invalid.<check>` (14 closed checks, no page content); the key list is exported as `AUTOMATION_STUDIO_LLM_EVIDENCE_TOOL_EXECUTION_KEYS` (t194-w20) | Core `runtime/llm/{evidence-loop-decision.ts, tool-failure.ts, evidence-loop.ts (two call sites)}`, `llm/tests/evidence-loop-tool-failure.test.ts` | run 9 decision 4: the Go press worked (results loaded after a 9.2 s cleared check) and the model was told it "failed and returned no evidence"; the draft kept a `did_not_work` step | w20: the run's dumped results through the parse: before `s2: false`, after `s2: true`; Core llm vitest 90 files / 805; tsc rc 0; session-4 combined validation | validated (worker); follow-up: a domain test holding its key list to Core's exported one (needs the dist) |
| F17 The $0.25 build ceiling holds **before** a decision is sent: each build decision (and each repair round's) is priced at its worst case from the request about to go out (its measured input all uncached plus the whole reply allowance), and refused unsent when spent + in flight + projected would cross the ceiling; the build ends `evidence_budget_exhausted` with `budgetBound: cost` and a `costRefusal` (spent, projected, ceiling); a call that costs more than it was held at counts as a breach; an ending no longer counts the decision it never sent (t194-w19) | Core `runtime/llm/build-purse/{index,purse,projected-cost,harness-hold,run,refused}.ts` (new), `llm/evidence-loop/cost-purse.ts` (new), `llm/harness/run.ts`, `llm/evidence-loop.ts` (one line), `llm/evidence-loop/{accounting,exhaustion,index}.ts`, `llm/loop-budget.ts` + tests (`build-purse/tests/purse.test.ts`, `evidence-loop/tests/cost-purse.test.ts`, `tests/loop-budget.test.ts`) | run 9: decision 9 sent with $0.154 spent, cost $0.1429, total $0.297; Core `budgetBreaches: 0` (the build's decide callback in `service.ts` reserved nothing; the loop counted decisions left at the average cost) | w19: with the purse lookup disabled the over-ceiling decision was sent ("expected 2 to be 1"), with it 10/10; vitest llm, loop-limits, flow-bootstrap, refuted-result, recovery 182 files / 2168; tsc rc 0; run 9's numbers: the entries alone estimate 453,849 tokens (95 % of the provider's 477,506) and refuse decision 9 ($0.1539 + $0.1458 > $0.25); session-4 combined validation | validated (worker). Not done: the closing message does not yet state spent and next-call figures (`flow-bootstrap/unfinished-build/{budget-exhausted,phases}.ts`); `budgetBreaches` is dropped after the loop (`phases.ts`, `service/flow-bootstrap-commands`) and the Lab's `live-llm/build-usage.ts:55` writes 0; the instruction-authority call, the one-shot build and the plan check are not held by the purse. Compatibility: no wire field changed; builds on large contexts stop earlier instead of overspending |
| F16 G2: a malformed provider reply's decision record says which malformed case it was, why the provider stopped, and its length and tokens, never its content; malformed replies' tokens now count in the build's accounting and so against the $0.25 ceiling (t194-w17). Cause of the malformations not established | Core `runtime/llm/{reply-account.ts (new), deepseek/{response-envelope.ts, provider.ts, panel-command.ts}, provider-contract.ts, harness/run.ts, unusable-decision.ts, evidence-loop.ts, evidence-loop/progress-trace.ts}` + tests (`deepseek/tests/response-envelope.test.ts` new, `tests/unusable-decision.test.ts`, `harness/tests/run.test.ts`, `evidence-loop/tests/progress-trace.test.ts`), `runtime/tests/deepseek-bootstrap-exploration.test.ts` | run 7: 14 of 35 re-author replies malformed, code only recorded; run 8: 3 of 24 | wrap-up validation (below) | validated; cause open (Top causes #10) |
| F15 The Lab's observed spend counts every model call of the run (build, judge, re-author and its retries, runtime repair) with a per-phase breakdown; a finished repaired re-run's detail says its recovery ended and the Lab treats it as settled (no 306 s idle); a build that ended without a Flow is a product failure (`productFailure.code: flow_lane.flow_not_built`), not a facility failure (t194-w16) | test-runner `src/live-llm/{live-llm-run.ts, index.ts, reauthor-record.ts (new), run-spend.ts (new)}`, `flow-lane/terminal-run-wait.ts`, `run-scenario.ts` (classification lines), `run-scenario/{index.ts, product-failure.ts (new)}` + tests; Core `service/runtime-adaptation/repair-rerun.ts` + test | run 7: `live-llm.json` $0.0418 / 24 calls of a real $0.0861 / 60; 306 s idle; run 5 labelled `scenario.execute/unclassified` | wrap-up validation; run 7's numbers recomputed to 60 calls / $0.086099 (worker) | validated; `scripts/lab/.../reported-spend.mjs` (campaign) still sums build + repair only |
| F14 The judge is told what each condition with its own read actually read: the page reports, per condition, one value (60 characters) its read produced on a row it kept, carried across pages; the domain admits it inside `conditions`; Core renders e.g. `attribute aria-label (read "Brightaisle Plus" on a row it kept) is present`, screened, withheld when not sayable (t194-w15) | extension `content/extraction/{item-filter.ts, filtered-answer.ts, list-reader.ts}`, `content/actions/extract-list.ts`, `shared/extraction-continuation.ts`; domain `actions/extraction/{summary.ts, index.ts, seen-values.ts (new)}`; Core `service/summaries/extraction-summary.ts`, `result-verification/read-account/{condition.ts, accounts.ts}`; tests beside each | run 7: the Plus badge condition read "aria-label present" and the judge advised adding a Plus condition that existed | wrap-up validation | validated. **Decision for the supervisor:** this puts up to 60 characters of page text per condition into Core's stored run record on every read; w15's report gives the change to also screen it at the projection |
| F13 A `next` or numbered read reveals every page it reads to its end (the lazily loaded last results) before reading it, bounded by the deadline; a reveal the deadline cuts short ends the read `timedOut`/`deadline`, never a complete page. The extract dispatch sends its (scaled) `timeoutMs` at the payload top level too, so Core waits as long as the page may read (it waited the gateway's 30 s default) (t194-w13) | extension `content/extraction/{list-reader.ts, list-wait.ts}`, `tests/{store-pager.ts, list-reader-lazy-tail.test.ts}`; domain `output-nodes/extract-list/dispatch.ts` (+ `tests/dispatch-timeout.test.ts`) | run 7: 4 of 13 expected rows sat in pages' lazy tails; `list-reader.ts:487-505` revealed only a one-page read | worker: domain 987/987, extension 1493/1493, extension check rc 0, audit passed; reveal disabled -> 4 of 6 new tests fail | validated (worker); not yet live |
| F12 A re-run after a repair numbers its attempts after the first pass's (`priorAttemptCount`), so the run store no longer drops them as repeated ids; a child Flow numbers its own from one (w7 item 3, applied by the lead) | Core `runtime/executor/{contracts.ts, graph-run.ts, node-execution.ts}`, `service/runtime-adaptation/repair-rerun.ts` (+ `tests/repair-rerun.test.ts`) | runs 4, 6, 7: the re-run's s1-s3 attempts were missing from the bundle and `s3.attempt.3` showed the first pass's success | round-2 combined validation (below) | validated; not yet live |
| F11 A ladder retry, wait or cleared dialog does not spend the subflow recovery budget, so an optional press whose target is absent still takes its authored `failed` route on its third miss (lead) | Core `runtime/executor/recovery-budget.ts` (+ `executor/tests/optional-failed-route.test.ts`) | runs 4, 6, 7: the re-run stopped on the optional "Continue shopping" press | round-2 combined validation | validated; not yet live |
| F10 A `next` read finds the page's own Next when the authored selector names nothing or another page's control, and waits briefly for a pager drawn after the items (t194-w12) | extension `content/extraction/{detect-pagination.ts, pagination.ts}`, `tests/{store-pager.ts, pagination.test.ts, detect-pagination.test.ts}` | run 6: played `a:nth-of-type(6)` named nothing on page 1; run 7: `(4)` read pages 1, 2, 5, 3, 4 | round-2 combined validation | validated; not yet live |
| F9 One per-origin page-load pace (2.5 s spacing, cooled after a 429/503) for navigations and paginated loads, answered by the worker, and the pace noted on the result (t194-w10); the `rate_limited` stop word (w5 Diff B) and `paginationStop` in the Lab's read record (w5 Diff A) | extension `background/page-pace/*`, `runtime/{action-runner.ts, command-router.ts}`, `shared/protocol.ts`, `content/extraction/pagination.ts`; domain `actions/extraction/summary.ts`; `packages/test-contracts/src/extraction-read/*`, test-runner `flow-lane/extraction-read.ts` | run 5: the build's reruns met the 429 limiter three times and the session was flagged | round-2 combined validation | validated; live in run 7 (no 429 met) |
| F8 The judge and the re-author see how each read went (pages, stop, items seen, rows kept, each condition as written with its rejected count) (t194-w8); the exploring model sees up to 3 rows each `where` condition rejected (t194-w9); a re-author's seed keeps an optional press's route (t194-w7) | Core `result-verification/read-account/*`, `result-summary.ts`, `run-outcome.ts`, `verdict.ts`, `recovery/refuted-result/{brief,history}.ts`, `llm/diagnosis-instructions.ts`, `service/summaries/extraction-summary.ts`, `llm/node-tools/draft-from-flow.ts`, `flow-bootstrap/authoring/draft-routing.ts`; domain `actions/extraction/rejected-samples.ts`, `llm-evidence/node-run/*`; extension `extraction/rejected-samples.ts`, `list-reader.ts`, `actions/extract-list.ts`, `shared/extraction-continuation.ts` | run 4: judge advised a paging loop that existed; the "charging case" rule's victims were invisible; the re-author flattened the optional route | round-2 combined validation | validated; live in run 7 (w7 held; w8 faithful but see run 7 cause 4) |
| F7 An icon-only badge (an element with no text but a constant accessible name, like the store's `<i role="img" aria-label="Brightaisle Plus">`) is offered as an optional attribute column named by that name, so `where {field: <badge>, is: "present"}` expresses "Plus eligible"; a name that varies per item is never a label (t194-w6) | downstream `apps/extension/src/content/extraction/{infer-fields.ts, badge-name.ts (new)}` (+ `tests/badge-column.test.ts`), `domain/src/output-nodes/extract-list/catalog-text.ts` (+ test), `domain/src/runtime/llm-evidence/structure/packet.ts` (comment) (+ `structure/tests/badge-column.test.ts`), `docs/architecture/web-capabilities.md` (two rows) | runs 1, 3, 4: no Flow could say "Plus only"; detection offered only images, links, controls, test ids and text (`infer-fields.ts:333-372`) | combined round-1 suites: extension 1239/1239, domain 914/914 (both include the badge tests); structure audit passed | validated (not yet live) |
| F6 A list read that meets a 429/503 page mid-pagination waits a bounded backoff, reloads the same address and resumes with its records; if refused again, or if the list vanished mid-read, it ends `truncated: true` with the stop named, never `truncated: false` (t194-w5) | downstream `apps/extension/src/content/extraction/{pagination.ts, list-reader.ts}`, `apps/extension/src/content/actions/extract-list.ts`, `apps/extension/src/shared/extraction-continuation.ts`; tests `extraction/tests/{pagination.test.ts, list-reader-refused-page.test.ts}`, `actions/tests/extract-list-refused-page.test.ts`, `shared/tests/extraction-continuation.test.ts`; `docs/architecture/web-capabilities.md` (Pagination row) | run 1: the 5th results page was the store's 429 page; the read stopped `list_vanished` and reported success, `truncated: false`; 8 of 13 expected rows never read | combined round-1 extension suite 1239/1239 (includes the 6 refused-page tests); structure audit passed | validated (not yet live). Not applied, proposed in the w5 report: a `rate_limited` stop word in the domain (Diff B) and `paginationStop` in `packages/test-contracts` (Diff A) |
| F5 A multi-page read counts its filter conditions over the whole read, not its last page (t194-w3's diff, applied by the lead) | downstream `apps/extension/src/shared/extraction-continuation.ts` (+ test), `apps/extension/src/content/extraction/list-reader.ts` (+ test) | run 1 `run-munnhi5q`: s9 reported `conditions {applied: 0, kept: 0}` over 56 items, making it look like the two `where` filters did nothing; the counters restart on every page and the handover dropped them | extension suite `pnpm --filter @fluxiq-web-extension/extension test` (heavy.sh): 1223/1223 | validated |
| F4 The repair diagnosis keeps the Flow graph with the failing node and that node's parameters: lossless trims first, then largest-first trims, instead of dropping whole sections at the 8,000-byte budget (t194-w4) | Core `runtime/recovery/{context.ts, context-summary.ts}`, new `runtime/recovery/context-budget/*` (+ `tests/trims.test.ts`), new `runtime/recovery/tests/context-fit.test.ts` | run 1: context carried only `failure`; `flow_graph`, `step_parameters`, `subflow`, `route_context`, `recent_nodes` omitted `byte_budget` (measured 15,489 B against 8,000) | Core vitest `recovery` + harness-options + flow-bootstrap/authoring + draft-shown: 52 files, 664/664; Core `tsc --noEmit` rc 0; Core structure audit passed | validated |
| F3 The re-author can re-run and amend the Flow's own extraction: the repeat memory starts over when a loop opens, and an inherited literal extraction whose item is a list this Flow detected is accepted, its withheld field selectors restored by key (t194-w2) | downstream `domain/src/runtime/llm-evidence/{repeated-refusal.ts, tools.ts, structure/handles.ts, plan-resolution/resolve-plan-node.ts}`, new `plan-resolution/own-extraction-list.ts`; tests `tests/repeat-across-explorations.test.ts`, `tests/reauthor-reruns-own-extraction.test.ts`, `plan-resolution/tests/own-extraction-list.test.ts` | run 1 re-author: first detection `answered_the_same_again` (the build's answer was still remembered); rerun of f9 `extraction_handle_required` then `answered_the_same_again` ×3 | domain suite `pnpm --filter @fluxiq-web-extension/domain test` (heavy.sh): 911/911; downstream structure audit passed | validated |
| F2 A re-author's inherited, untouched presses are not sent back through the consequence gate (only steps the build adds or changes are gated; move money, delete, send/publish still need the person) (t194-w1) | Core `runtime/llm/harness-options/{inherited-plan-nodes.ts (new), plan-parameter-resolution.ts, bootstrap-completion.ts}` (+ `tests/inherited-plan-nodes.test.ts`), `runtime/flow-bootstrap/authoring/{contracts.ts, draft-routing.ts, assemble-draft.ts}` | run 1 re-author: 8 completions refused `web.step.consequences_undeclared` for Accept, Go and Continue shopping, steps it inherited and could not declare | as F4 (same Core run): 664/664, tsc rc 0, audit passed | validated |
| F1 `FLUXIQ_LAB_KEEP_RUN_STATE=1` keeps the run's `.work/<runId>` (Core workspace and database, Flow source with real parameters, logs) | downstream `packages/test-runner/src/run-scenario/keeps-run-state.ts` (+ test), `run-scenario/index.ts`, `run-scenario.ts:679` (line-neutral) | run 1: Stage 3's real parameters were unanswerable; the bundle screens them and the Lab deleted the workspace | test-runner build rc 0; `keeps-run-state.test.js` 2/2; used live in run 3 | validated |
| F0 t174's committed fixes applied as working-tree patches, byte-identical to `task/t174-live-lane` (as t193 and t195 did): network-guard start crash, gateway open timeout, draft-shown `did_not_work` throw, thrown-issue codes, build progress trace, summary bound, long build request | Core `f0dbbd6..task/t174-live-lane` (20 files); downstream `merge-base..task/t174-live-lane` minus docs (26 files) | run 2 `run-munoaqcn`: `page.goto: Page crashed` opening the side panel (t174's Fix 3 cause) | Core build rc 0; extension suite 1223/1223; domain 911/911 | validated (owned by t174; not t194's changes) |

**Session-4 combined validation (2026-10-01 06:00-06:47 UTC, after w19-w22 and the lead's judge edit; script
`scratchpad/t194/validate-s4.sh`, session `58ff9269`):** Core libraries build rc 0 (fluxiq built from source, 324 s);
Core `npx tsc --noEmit -p tsconfig.json` rc 0; Core vitest (llm, loop-limits, flow-bootstrap, result-verification,
service/summaries, recovery, tests/refuted-result, service/runtime-adaptation, executor, flow-draft,
deepseek-bootstrap-exploration) `Test Files 1 failed | 235 passed (236)`, `Tests 1 failed | 2813 passed (2814)`, the one
failure the known 15 s timeout in `service/summaries/tests/run-detail-preservation.test.ts`, which alone with
`--testTimeout=90000` passes `Tests 3 passed (3)` (the slow case 5.5 s), so load; Core structure audit **1 violation, not
this lane's**: `runtime/service.ts` 4506 lines against a baseline of 4505, and the file is unmodified here and 4506 lines at
HEAD (Core dev `e5b8f015`), so **Core dev itself fails this rule**; domain check rc 0, suite `# tests 1063 # pass 1063 #
fail 0`; extension check rc 0, suite `# tests 1678 # pass 1678 # fail 0`; test-runner check rc 0, suite `# tests 1729 #
pass 1729 # fail 0`; test-contracts `# tests 156 # pass 156 # fail 0`; downstream structure audit "passed (136
warning(s), 119 baselined)".

**Ready to commit (fix set 4: F17, F18, F19, F20), exactly `git status` of both trees.** Core
(`packages/fluxiq/src/programs/automation-studio/runtime/`): `llm/{evidence-loop-decision.ts, evidence-loop.ts, tool-failure.ts,
loop-budget.ts, harness/run.ts}`, `llm/evidence-loop/{accounting.ts, exhaustion.ts, index.ts, cost-purse.ts (new),
tests/cost-purse.test.ts (new)}`, `llm/build-purse/**` (new), `llm/tests/{evidence-loop-tool-failure.test.ts,
loop-budget.test.ts}`, `result-verification/{contracts.ts, read-account/accounts.ts, read-account/sentence.ts,
read-account/tests/accounts.test.ts}`, `service/summaries/{extraction-summary.ts, tests/extraction-summary.test.ts}`.
Downstream: extension `content/actions/{extract-list.ts, tests/extract-list-rejected-samples.test.ts}`,
`content/extraction/{filtered-answer.ts, list-reader.ts, rejected-samples.ts, tests/list-reader.test.ts,
tests/rejected-samples.test.ts}`, `shared/{extraction-continuation.ts, tests/extraction-continuation.test.ts}`; domain
`actions/extraction/{rejected-samples.ts, summary.ts, tests/rejected-samples.test.ts}`,
`runtime/llm-evidence/node-run/{rejected-rows.ts, tests/rejected-rows.test.ts}`; test-runner
`src/live-llm/{budget-over-product-failure.ts (new), index.ts, lane-settlement.ts, live-llm-run.ts,
tests/lane-settlement.test.ts, tests/live-llm-run.test.ts}`, `src/run-scenario/{product-failure.ts,
tests/product-failure.test.ts}`; docs `debugs/run-mup2u8o3-6697c4be.md`, `reports/t194-w18..w22-*.md`, this report.
Validation: the session-4 combined validation above. Core `llm/evidence-loop.ts` is at 799 of 800 lines; the next change
there needs a split. `domain/.../node-run/rejected-rows.ts` is extraction rows, not page serialization (t223's), and imports
`../present` without changing it.

**Round-2 combined validation (2026-09-30 18:25-18:37 UTC, after the dev merge; script `scratchpad/t194/validate-r2.sh`):** Core build rc 0; Core `tsc --noEmit` rc 0; Core vitest (executor, runtime-adaptation, result-verification, recovery, llm/node-tools, llm/harness-options, llm/harness, flow-bootstrap, service/summaries, flow-draft) 147 files, 2031/2031; Core structure audit passed (200 warnings, 354 baselined); domain check rc 0, suite 982/982; extension check rc 0, suite 1487/1487; test-contracts 156/156; test-runner check rc 0; downstream structure audit passed (128 warnings, 120 baselined).

Ready to commit: the round-2 WIP is already on the branch (downstream `518e38fe`, Core `4c8753ed`) and the dev merge was committed (`0d5b62c4`, `dff9b004`); add the three debug files `debugs/run-{muntc23v-7fcc4110,munv53gt-a0e6f545,munw7ffn-fe1cecd2}.md`, the report `reports/t194-d56-run-debugs.md` and this report; validation: the round-2 combined validation above -> all rc 0, Core 2031/2031, domain 982/982, extension 1487/1487.

**Wrap-up validation (2026-09-30 20:03-20:29 UTC, after w13, w15, w16, w17 and the w14 revert; `scratchpad/t194/validate-r3.sh`):**
Core build rc 0; Core `tsc --noEmit` rc 0; Core vitest (executor, llm, deepseek-bootstrap-exploration, runtime-adaptation,
result-verification, recovery, flow-bootstrap, service/summaries, flow-draft) 203 files, 2581/2583, the 2 failures 15 s timeouts in
`service/summaries/tests/run-detail-preservation.test.ts`, which pass 3/3 alone with `--testTimeout=90000` (17.6 s, 6.9 s, 1.3 s;
the second took 15.5 s in the suite, so load-dependent); Core structure audit passed; domain check rc 0, suite 990/990; extension
check rc 0, suite 1496/1496; test-contracts 156/156; test-runner suite 1697/1700, the 3 not this lane's: 914 `runner-wiring`
expects a `runRedactionScopes(...)` string that committed `run-scenario.ts:617` no longer has (untouched by w16), 1280
`clone-cache` lock timeout, 1449 `demo-workspace`; downstream structure audit passed (128 warnings, 120 baselined).

Ready to commit (fix set 3): downstream extension `content/extraction/{list-reader.ts, list-wait.ts, item-filter.ts, filtered-answer.ts}`,
`content/extraction/tests/{store-pager.ts, list-reader-lazy-tail.test.ts, item-filter.test.ts, list-reader.test.ts}`,
`content/actions/{extract-list.ts, tests/extract-list.test.ts}`, `shared/{extraction-continuation.ts, tests/extraction-continuation.test.ts}`;
domain `actions/extraction/{summary.ts, index.ts, seen-values.ts}` and its test, `output-nodes/extract-list/{dispatch.ts, tests/dispatch-timeout.test.ts}`;
test-runner `src/live-llm/**`, `src/flow-lane/terminal-run-wait.ts` + test, `src/run-scenario.ts`, `src/run-scenario/{index.ts, product-failure.ts, tests/product-failure.test.ts}`;
docs `debugs/run-muohgblr-ed6ddc49.md`, `reports/t194-w13..w17-*.md`, this report. Core `runtime/llm/**` (F16),
`runtime/service/runtime-adaptation/{repair-rerun.ts, tests/repair-rerun.test.ts}`, `runtime/service/summaries/{extraction-summary.ts, tests/extraction-summary.test.ts}`,
`runtime/result-verification/read-account/{condition.ts, accounts.ts, tests/accounts.test.ts}`, `runtime/tests/deepseek-bootstrap-exploration.test.ts`
(exactly `git status` of both trees; nothing else is dirty). Validation: the wrap-up validation above -> Core 2581/2583 (2 load
timeouts, pass alone), domain 990/990, extension 1496/1496, test-runner 1697/1700 (3 pre-existing, not this lane's), all checks
and audits rc 0.

Taken from other lanes, not fixed here: the dry run's `core.replay.unreproducible` on draft steps (runs 1 and 3, 6-7.5 s each) is t174's (their run 4, t174-w2), recorded as t193's cause D. The Lab screenshot gap is recorded by t193 (G2) and t174 (`run-scenario/ui-review/`, uncommitted); this lane photographs its headed window through the OS (`scratchpad/t194/ui-shots.ps1`) meanwhile.

## Pre-run

- Core libraries built through the build cache (`scripts/worktree/core-build.mjs` `buildCore`, heavy.sh b1):
  `@fluxiq/contracts`, `fluxiq`, `@fluxiq/client-gateway-websocket` all `reuse` from stamp.
- Other live lanes' reports at start (2026-09-30 05:11 UTC): t174's exists (runs 1-12, Fixes 1-3);
  t193's and t195's did not exist yet.

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-munnhi5q-4867dabe` | plus-earbuds-under-50 | 6: refuted correctly; re-author failed | Flow read 28 rows unfiltered by Plus/rating/price; conditions' counts reset per page (F5); 429 page lost a results page (F6); Plus inexpressible (F7); re-author blocked by `consequences_undeclared` ×8 (F2) and rerun `extraction_handle_required`/`answered_the_same_again` (F3), profile limit ×4 (t174's summary bound, F0); repair context dropped for byte budget (F4) | F2-F7 | see Fix log |
| 2 | `run-munoaqcn-b90a601c` | same | none (facility) | `page.goto: Page crashed` opening the side panel: t174's network-guard cause | F0 (t174 Fix 3) | runs 3 and 4 started cleanly |
| 3 | `run-munojusu-26a9ad62` | same | 6: refuted; re-author failed (pre-F2/F3) | Flow's only filter was sponsored; 43 rows; dry run refused completions on `core.replay.unreproducible` (t174's) | F2, F3 (landed after) | see Fix log |
| 4 | `run-munq5s8x-6d620cdf` | same | **6: refuted, re-author applied, re-run executed** | build wrote rating `atLeast 4`, price `lessThan 50`, sponsored and accessory filters; 8 of 13 (accessory rule drops three true "Wireless Charging Case" earbuds; Plus inexpressible; limiter); re-run stopped on the optional "Continue shopping" press its session no longer showed; judge advised a pagination loop that existed (not told pages/stop) | F6, F7; re-run stop and judge context under investigation | debug `debugs/run-munq5s8x-6d620cdf.md` |
| 5 | `run-muntc23v-7fcc4110` ($0.0615) | same | 2: no Flow | the build's 11 extract reruns met the store's 429 limiter three times, the session was flagged and the store showed its robot check; 10 dry-run resets `reset_failed` (mid-build restarts: t196's); the Lab mislabelled it a facility failure (`run-scenario.ts:505`); the model could not see its own extract argument (512-byte entry cap, `flow-draft/entry.ts:80`, t189/t195's file) | F9 (w10 pace); the rest recorded | debug `debugs/run-muntc23v-7fcc4110.md` |
| 6 | `run-munv53gt-a0e6f545` ($0.0856 incl. re-author) | same | 6: refuted, re-author applied, re-run stopped | played `next a:nth-of-type(6)` names nothing on page 1 (stop `control_absent`, 2 of 13); re-author's "charging case" rule drops true rows and chained two reads (transcript draft: t196's); re-run stopped on the optional press (ladder retries spent the subflow budget); re-run attempt ids collided | F10 (w12), F11, F12 | debug `debugs/run-munv53gt-a0e6f545.md` |
| 7 | `run-munw7ffn-fe1cecd2` ($0.086: Lab reported $0.0418, the re-author's $0.0425 missing) | same | 6: refuted correctly, re-author applied, re-run stopped on the optional press | 11 of 13 read, 9 true: each page's lazy last four never read (4 expected rows missing); no accessory rule (kept Ear Tips, Charging Case Replacement); positional Next read pages 1,2,5,3,4 and a false `truncated`; judge told "aria-label present" for the Plus badge; re-author explored from page 4; 13/35 re-author replies malformed; Lab idle 306 s after the re-run; re-author spend absent from `live-llm.json` | F13 (lazy tail); F10-F12 landed after it; others open below | debug `debugs/run-munw7ffn-fe1cecd2.md` |
| 8 | `run-muohgblr-ed6ddc49` (cost NO EVIDENCE: killed before the Lab's accounting; 24 decisions, roughly $0.04-0.05) | same | 2: build iteration 24, **stopped by the supervisor at the user's order** (19:19:57 UTC, 7 min in) | the first paged read took 13.7 s and the frame shows the page revealed to its last row (F13 acting); then 16 `amend_draft rerun`s of the extraction in 80 s with 3 malformed replies, the same rerun loop as runs 5-7 | none (Lab runs stopped) | debug `debugs/run-muohgblr-ed6ddc49.md` |
| 9 | `run-mup2u8o3-6697c4be` (**$0.2969**, 9 calls, 1,624,763 input tokens; over the $0.25 ceiling) | same | 3: draft complete, completion check ok; the test from the start refused s3 (cookie Accept `unreproducible`, the reset kept the build's consent: t196/t174 D1) and the build ended `evidence_budget_exhausted` with no money left | **the build's read held 10 of 13, all true and in order**: F7 badge, F10 label Next, F13 lazy tail and F9 pace all worked live; the 3 missing were true "… with Wireless Charging Case" pairs dropped by `name not contains "charging case"` (cause #2). Cost: page view ~300-500 KB a page (t223), raw `read.snapshot` 471 KB in the extract result (t193 W1), prompt cache lost after an amend (t193 W2: 1,792 of 477,506 cached), ceiling enforced after the fact (F17); a working Go press refused `tool_result_invalid` (F18); facility mislabel (F20) | F17, F18, F19, F20 | debug `debugs/run-mup2u8o3-6697c4be.md` |
| 10 | `run-muq0in9r-0793b448` ($0.00, 0 calls) | same | 0: killed 23 s after admission | the supervisor's blanket `taskkill` on `run-lab.mjs` during the DeepSeek outage (operator action); killed runs go unaccounted in the spend ledger (Lab gap, next) | none | debug `debugs/run-muq0in9r-0793b448.md` |
| 11 | `run-muq4oaof-464f5bce` ($0.1729, 39 calls) | same, chat-driven | 6: built, ran (21 rows, 0 of 13), judged, re-authored (16 refused reruns), repair refused | reruns on page 5 (lane B), `consequences: null` refusals (F29), duplicate read s9 (t196), helper columns kept (F30, F31) | F29-F31 | debug `debugs/run-muq4oaof-464f5bce.md` |
| 12 | `run-muq66ff9-cb3767a1` ($0.3239, 80 calls) | same, chat-driven | 6: built, ran (11 rows, 0 of 13), 3 re-author attempts, RG fired 17 times | reruns on page 5 (lane B); `not_at_start_location` after a stall test (t228); false `column_always_empty` and 'raise maxPages' in the judge's brief; patch-shape `unexpected_input_keys`; helper columns still kept | next | debug `debugs/run-muq66ff9-cb3767a1.md` |

## UI evidence for t191

From this lane's OS captures of the headed window (`scratchpad/t194/shots/run01/`, `run04/`, 15 s), side panel open throughout:
- The "Get set up" card says **"Add an AI model key: To do"** in every frame, while a keyed build is running (runs 1 and 4).
- **"RIGHT NOW: Done / Last step: Looked at the page"** mid-build (run 1, 05:19:24), and **"RIGHT NOW: Nothing running"** while FluxIQ was re-authoring and re-running (run 4, 06:40:58 to 06:42:14). The one correct frame: "FluxIQ is working / Reading data from the page" with Stop (run 4, 06:34:54).
- **No on-page FluxIQ overlay** was visible on the site in any frame of runs 1 and 4.
- The site's own cookie banner and "Never miss a deal" modal stay up during playback and the re-run.

## Round 1 (2026-09-30), ready

All t194 edits are validated; nothing is in progress in the trees. Combined checks after every worker returned: extension suite 1239/1239, domain suite 914/914, test-runner build rc 0 with its lane tests 51/51, Core `tsc --noEmit` rc 0, Core vitest (harness-options, flow-bootstrap/authoring, recovery, draft-shown) 664/664, structure audits passed in both repositories.

**F0 files (t174's fixes applied by hand; take t174's/dev's version at the merge):** Core, the 20 files of `f0dbbd6..4d126f6`; downstream, the 26 files of `6f29c62c..2d6d27f8` minus docs. Lists: `scratchpad/t194/f0-core.txt`, `f0-down.txt`.

**Mixed files (F0 plus t194 lines):** downstream `packages/test-runner/src/run-scenario.ts` (t194: `keepsRunState` in the import and at the `finally`, line 679), `packages/test-runner/src/run-scenario/index.ts` (t194: one export line); Core `runtime/llm/harness-options/bootstrap-completion.ts` (t194: the `inheritedNodeRefs` import and two call sites, t174's summary lines unchanged).

**t194 files that dev has also changed since `defcbe2d`/`f0dbbd6` (true merges):** downstream `apps/extension/src/content/extraction/pagination.ts` (t195/t174 load-more Retry vs t194 F6 429 reload), `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` and `domain/src/runtime/llm-evidence/tools.ts` (F3), `docs/architecture/web-capabilities.md`; Core `runtime/flow-bootstrap/authoring/draft-routing.ts` (F2) and `runtime/llm/harness-options/bootstrap-completion.ts`.

## Merge of dev after round 1 (2026-09-30)

The supervisor committed round 1 (Core `c4c469de`, downstream `31be444b`) and merged dev (t174, t193, t195, t196, t191 round 1) into both trees; the lead resolved the conflicts and the supervisor committed the merge (Core `b75459d8`, downstream `8b5fcb9b`).
- Conflicts: Core `llm/harness-options/bootstrap-completion.ts` (dev's side plus `inheritedNodeRefs`); `domain/src/runtime/llm-evidence/tools.ts` (the `repeatedRefusals.answered(scope, toolId, answer)` call F3 needs, beside t196's `observed` state-digest binding); `packages/test-runner/src/run-scenario.ts` and `run-scenario/index.ts` (dev's `uiReview`, `periodicCapture`, `createRunScreenshotAdapter`, plus `keepsRunState` in the import, at line 670 and as one export). Every F0 file resolved to dev's version.
- First checks failed on a stale Core `dist` (4 domain tests on failure records; extension check on `effect`/`retryAfterMs`), not on the merge: Core rebuilt, then all green.
- Validation: Core fluxiq tsc rc 0, Core vitest (harness-options, flow-bootstrap/authoring, recovery, draft-shown) 672/672; domain check rc 0, suite 948/948; extension check rc 0, suite 1348/1348; test-runner check and build rc 0, lane node tests 87/87; both structure audits passed.
- The Lab now takes its own screenshots (t174's `ui-review`, t193's `periodicCapture`); this lane's OS capture stays as a cross-check.

## Round 2 triage, new session (2026-09-30, from 18:20 UTC)

The previous lead ended on a session limit after run 7; its round-2 work was committed as WIP (downstream `518e38fe`,
Core `4c8753ed`) and dev merged in (Core `dff9b004` clean; downstream one conflict).

- **merge resolved: `apps/extension/src/runtime/action-runner.ts`**, both sides kept. Navigation: dev's settled landing
  (`settleLandedReading` over the first `readLandedPage`, `checkWait` on the landing) plus this lane's page pace
  (`navigationResult` wrapped in `withPaceNote` when `paceNavigation` held the load). Frame send: this lane's paced
  `sendAction(..., pace)` plus dev's `sendClickCheckingLanding(..., LANDED_TAB_ACCESS)`. Staged with `git add`, not committed.
- Round-2 changes found in the WIP, mapped to their owners (runs 5-7 were not yet in the runs table; added below):
  w7 seed keeps an optional press's route (Core `llm/node-tools/draft-from-flow.ts`, `flow-bootstrap/authoring/draft-routing.ts`);
  w7 item 3 applied by the lead, a re-run numbers its attempts after the first pass's (Core `executor/{contracts,graph-run,node-execution}.ts`,
  `service/runtime-adaptation/repair-rerun.ts` + test); lead fix, ladder retries do not spend the subflow recovery budget, so an
  optional press's third miss still takes its `failed` route (Core `executor/recovery-budget.ts`, `executor/tests/optional-failed-route.test.ts`);
  w8 judge and re-author see each read (Core `result-verification/read-account/*`, `result-summary.ts`, `run-outcome.ts`, `verdict.ts`,
  `recovery/refuted-result/{brief,history}.ts`, `llm/diagnosis-instructions.ts`, `service/summaries/extraction-summary.ts`);
  w9 exploring model sees rejected rows (domain `actions/extraction/rejected-samples.ts`, `summary.ts`, `llm-evidence/node-run/*`;
  extension `extraction/rejected-samples.ts`, `list-reader.ts`, `actions/extract-list.ts`, `shared/extraction-continuation.ts`);
  w10 one per-origin page-load pace (extension `background/page-pace/*`, `runtime/{action-runner,command-router}.ts`,
  `shared/protocol.ts`, `extraction/pagination.ts`); w12 a `next` read finds the page's own Next (extension
  `extraction/{detect-pagination,pagination}.ts`, `tests/store-pager.ts`); w5 Diffs A and B applied by the lead (`rate_limited`
  stop word in domain `summary.ts`; `paginationStop` in `packages/test-contracts` and test-runner `flow-lane/extraction-read.ts`).
  No w11 exists. Nothing found half-written; combined validation below.

## Wrap-up at the supervisor's stop (2026-09-30, from 19:20 UTC)

The supervisor stopped all Lab runs at the user's order and killed run 8 mid-build. No Lab run was started after that.
The supervisor's item 3 (a run that spent 53 s trying steps and made no repair attempt) was not this lane's: lane C launched
nothing between 09:32 and 19:08 UTC, and run 8 never reached a Flow.

- **t194-w14 reverted, described here.** A re-author explores from where the step it changes starts (run 7 cause 6). The worker
  built and tested it (Core vitest `recovery`, `flow-bootstrap`, `service/runtime-adaptation`: 84 files, 1314 passed): before the
  re-author's first model call, replay the Flow's own steps up to the changed step through the build's permission-gated tools,
  withheld when any earlier step declares a consequence; a failed replay is reported in the brief; the brief says where the page
  is. It was **not wired**: the caller (`service/runtime-adaptation/refuted-result-port.ts`, `service.ts`) was outside its files,
  so it never ran in a repair. Rather than leave unwired code, the lead reverted it. The patch is kept at
  `C:/Users/osrs_/FluxStuff/evidence/t194/t194-w14-reauthor-start-page.core.patch` (15 files; `git apply --check` clean against
  Core at `dff9b004`), with the wiring steps in `reports/t194-w14-reauthor-start-page.md`.
- F13 (w13) was validated before run 8 and is kept.

## Top causes for the audit

Across runs 1-9 of `everything-store-plus-earbuds-under-50` (the only task this lane reached). Run ids: 1 `munnhi5q`,
2 `munoaqcn`, 3 `munojusu`, 4 `munq5s8x`, 5 `muntc23v`, 6 `munv53gt`, 7 `munw7ffn`, 8 `muohgblr`, 9 `mup2u8o3` (each `run-<id>-…`).

| # | Recurring cause | Runs | Stage it stops at | Status |
| --- | --- | --- | --- | --- |
| 1 | **The build reruns its own extraction over and over** (11 in run 5, 10 in run 7's build, 13 in run 6's re-author, 16 in run 8), each rerun "succeeding"; in run 5 the burst tripped the store's limiter and no Flow was built | 1, 5, 6, 7, 8 (not 9: one read, no rerun) | 2 (exploration) | **Open.** Contributing: the model is shown its own extract argument cut at 512 bytes (`flow-draft/entry.ts:80`): **owned by t200** (a limit on what the model sees). A draft grown by rerunning rather than authored: **owned by t196**. Decision parameters are not recorded (gap G1), so why each rerun happened is unanswerable |
| 2 | **The Flow keeps the wrong rows**: no accessory rule, or a "charging case" rule that drops three true "... Wireless Charging Case" earbuds | 3, 4, 6, 7, 9 | 5 (answer) | **Fixed in part, F19 (not yet live).** Run 9 showed why the samples did not help: of the rule's 20 rejected rows 17 also failed another condition; the 5 it removed alone (2 accessories, 3 wanted pairs) were not set apart. F19 sets them apart for the exploring model and counts them for the judge. The grammar already had `startsWith`/`matches`, so the rule was expressible |
| 3 | **A paged read never read each page's lazily loaded last results** (4 of 13 expected rows in run 7) | 4, 6, 7 | 5 | **Fixed, live-proven in run 9** (F13: every expected row was seen across 5 pages) |
| 4 | **Positional Next selector** (`a:nth-of-type(n)`): pages read 1, 2, 5, 3, 4, a false `truncated`, or a stop on page 1 | 4, 6, 7 | 5 | **Fixed, live-proven in run 9** (F10: `a[aria-label^="Go to next page"]`, pages 1-5 in order, `truncated: false`) |
| 5 | **The store's 429 limiter**: bursty page loads lost a results page (run 1) or flagged the session into its robot check (run 5) | 1, 5, 6 | 2 and 5 | **Fixed**, F6 + F9 (per-origin pace); runs 7 and 9 met no 429 |
| 6 | **The repaired re-run stops on the optional "Continue shopping" press** (ladder retries spent the subflow recovery budget; earlier the re-author also flattened the optional route) | 4, 6, 7 | 6 (repair re-run) | **Fixed**, F11 + F8 (w7 route), not yet live |
| 7 | **The re-author explores from where the playback left the tab** (page 4), never where the changed step starts | 6, 7 | 6 | **In progress**: t194-w14 built and reverted unwired (patch above) |
| 8 | **The judge misdescribes the read**: advised a paging loop that existed (run 4); read "aria-label present" for the Plus badge and a false `truncated` (run 7); "part of the summary was withheld" (runs 4, 7) | 4, 7 | 6 (judgement) | **Fixed** in part: F8 (w8), F14 (w15), F10. The judge summary's 4,000-byte budget that withholds parts is a limit on what the model sees: **owned by t200** |
| 9 | **The re-author chains several reads writing one dataset** (a transcript of its reruns, not an authored Flow) | 6, 7 | 6 | **Owned by t196** (draft authoring) |
| 10 | **Malformed provider replies**: 14 of 35 re-author replies in run 7, 3 of 24 in run 8, just before full extract reruns | 7, 8 | 2 and 6 (time and spend) | **In progress**: F16 (w17) records the case, finish reason and length; cause not established; proposed: a rerun sends only the keys it changes |
| 11 | **Re-run evidence and spend were lost**: attempt ids collided (the re-run's steps hidden); the re-author's spend missing from `live-llm.json` (run 7 reported $0.042 of $0.086); the Lab idled 306 s after a failed repaired re-run; run 5 mislabelled a facility failure | 4-7 | 4-6 (evidence) | **Fixed**, F12 and F15 (w16) |
| 12 | **Mid-build replays and resets**: dry-run `core.replay.unreproducible` (runs 1, 3) and ten `reset_failed` resets (run 5) | 1, 3, 5 | 2 | **Owned by t196** |
| 13 | **UI**: status cards over the chat, raw tool and node ids, "Add an AI model key: To do" while building, the pill over the cookie banner, "Running your Flow" and "passed its check" during a re-author | every run | UI (never a pass) | **Owned by t191/t174** (t174 U1-U13). Run 9 (t191 round 2 live): clean chat with reasons and cards; still two identical consecutive status lines, a "Test run Passed" card for the completion check, the overlay absent while the store opened and flickering once |
| 14 | **Cost: the build overspent its ceiling** ($0.297 of $0.25 in 9 decisions): page view of 300-500 KB a page (t223), the extension's raw `read.snapshot` riding in every node result (t193 W1), the prompt cache lost after a draft amendment (t193 W2), and the ceiling checked only after a call | 9 | 3 (no money left to answer the test) | **F17 fixed the ceiling** (not yet live); the rest owned as named |
| 15 | **A working click refused as `tool_result_invalid`**: a result carrying `clearedWait` (a robot check that cleared by itself) was outside Core's exact key list | 9 | 2 (a wasted decision and a `did_not_work` step in the draft) | **Fixed**, F18 (not yet live) |
| 16 | **The test from the start keeps the build's site state**: a required cookie Accept is `unreproducible` after the reset | 9 (as runs 1, 3) | 3 | **Owned by t196 / t174 D1** |
