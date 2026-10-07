# Run debug — `run-muxky0df-c9839389`

Lane C, round 4 of the Phase 1 live round (t274): the first live run of the read-list redesign. Written by the lane C
lead. Run folder `R` = `fxwork/t274/!FluxIQWebExtension/test-runs/instances/t274-slot-1/run-muxky0df-c9839389/` (no
central `lab-runs` copy was written). Trees: downstream `5cad8286` (= dev), Core `ffbdea7e` (= Core dev). Previous run
of this lane: `run-mux6naez-6c20f26e` (oracle held, refuted after the run; R3-1).

## Stage 1 — expectations

Written 2026-10-07T03:38Z, before the dry run and the launch, in `docs/working/mvp-final-month-plan/reports/live-C.md`
"Round 4 — expectations". In short:
- Flow: navigate; Decline and Not now optional; type "wireless earbuds"; a one-page read with `where` (sponsored
  absent, Plus present, rating >= 4, price < 50, accessories out); Next page; a do-while Repeat over the read through
  Next page.
- Build test: 5 passes; `ended` on page 5; `stores` with an answer of 13.
- Oracle: 13 ordered records and 52 fields.
- UI: "Reading page N" and "The list ended after 5 pages".

## Watch log

- 03:38Z dry run `ready` (0 calls, ceiling $0.10, no permits, chat build, persistent-isolated, instruction 415
  characters `d4f7835b...`).
- 04:00:29Z campaign started (`--max-attempts 1`); guard `admitted`, fingerprint `sha256:9def8d90...`.
- 04:03:34Z chat; 04:03:37-04:04:32Z round 0; 04:04:32-04:04:51Z test and judges `no`.
- 04:04:51-04:05:35Z repair 1, test and judges `no`.
- 04:05:35-04:06:35Z repair 2, test and judges `no`.
- 04:06:47Z campaign exit 1. Not relaunched.

## Header

- Flow: **none**. `lab.chat_build_failed`, issue codes `flow_bootstrap.build_not_finished` and
  `llm_evidence_loop.draft_amendments_refused`.
- **Calls and cost: 36 provider calls, $0.066685428**, from the campaign summary and the summed step metas:

  | Phase | Calls | Cost (USD) |
  | --- | --- | --- |
  | chat | 1 | 0.000209 |
  | round 0 explore | 16 | 0.028672 |
  | judges (3 pairs) | 6 | 0.009625 |
  | repair 1 | 5 | 0.011685 |
  | repair 2 | 8 | 0.016495 |

  `buildsOverCeiling: 0`. Off-peak prices.
- Oracle: not measured (no Flow). **Verdict: failed**, `runtime.behavior`.
- **Stage reached: 3** (draft authored up to the read; it could never page).

## Stage 2 — exploration (round 0)

| # | Decision (short) | Result |
| --- | --- | --- |
| 0003/0005/0007 | Decline, Not now, type "wireless earbuds" + submit, each `add` | ok, results page 1 |
| 0009/0011 | detect the results list (twice) | `extraction.1`, `extraction.2` |
| 0013/0015 | detect again (twice) | `already_answered` (no re-run, no charge beyond the decision) |
| 0017 | read `extraction.2`, six fields (incl. `plus`, `ad`), `where` ad absent, plus present, rating >= 4, price < 50, name not contains ["ear tips","charging case","eartips"], `add` | **3 records from 1 page**, 17 left out by `where` (the one-page read works) |
| 0019/0021 | keep 9, repeat 9 while 10, add 10 | refused `already_in_flow`, `no_such_step` ("there is no step 10 yet: a step enters the draft only by running") |
| **0023** | `core.run_node` `web.output.dom-next_page` `{nextPage: {list: "extraction.2"}}`, `add` | **`invalid_input` / `node_not_runnable_here`** (~1 s), `describedNodes` [next page] |
| 0025-0032 | rerun step 10 with `control` t847, then t843; repeat 9 while 10 | each rerun **`node_not_runnable_here`** again; the re-send refused `same_amendment` (0029) |
| 0033/0035 | drop 10-12; rerun 10 again | refused `did_not_work`, `changes_nothing`; no-progress 7 of 8 |

- The model's plan was the expected Flow from 0019 on (read, Next page, repeat the read while Next page succeeds).
  It was blocked only because the Next page node could not run.
- Build tests 0037-0042, 0060-0065 and 0093-0098: the same 5 steps, one page, 3 rows.

## Stage 6 — judgement and repair

- Judges 0043/0044, 0066/0067 and 0099/0100: all **no**, correctly: "reads only page 1 ... no step advances to page 2".
- 0043 also claimed the `plus` condition left out two rows "carrying the Brightaisle Plus badge". It is wrong: on the
  page, neither Kinetra Run Graphite (t586-t612) nor Aurelle Pods Fit Sage (t924-t950) carries the badge.
  0044/0099 say the conditions are right (R4-3).
- Repair 1 (0045-0059) and repair 2 (0068-0092):
  - The model reran the read with handle `extraction.3` five times; each was 3 rows, page 1.
  - It tried to author Next page as `{"step": 6, "change": "add", "input": {...}}` on the round's own look step. That
    was refused `not_a_kept_step`, three in a row in round 2, which ended the round.
  - It never sent Next page again as a new call (R4-2).
- Ending: "My last 2 attempts to fix it each got no further than the one before: the judge's finding changed ... No
  step advances to page 2."

## Cause — R4-1, verified by the lead

**The Lab's persistent browser profile runs a stale extension background worker.** Chromium stores an extension's
service worker in the profile (`Default/Service Worker/ScriptCache`). On a later `launchPersistentContext` with
`--load-extension` from the same path, it starts that stored copy even after the files on disk have changed. The
content scripts, the panel and the manifest are read fresh; only the background is old.

What happened here:
- The `t274-c` profile's only cached worker script is from 2026-10-05 21:19, when the workspace was made. It
  mentions `web.dom.extract_list` 19 times and **`web.dom.next_page` 0 times**. The built
  `.lab-instances/t274-slot-1/dist/e2e-chromium/background/index.js` mentions it 11 times.
- The old worker's `normalizeWebAutomationActionType` answers the unknown type with `UNSUPPORTED_TYPE`.
- `domain/.../action-failure/refusal.ts` maps that to `invalid_input` / `node_not_runnable_here`.

Why the redesign's tests missed it: the content e2e specs stand in for the background worker, so the real worker never
ran Next page before this run.

**Every lane is affected.** Cached workers:
- A (`t262-a`) and B (`t262-b`): 2026-10-03 18:31;
- C (`t274-c`) and D (`t275-d`): 2026-10-05 21:19.

None contains Next page. Up to 28 commits since 2026-10-03 18:31 (A, B) and 18 since 2026-10-05 21:19 (C, D) touched
source that bundles into the background (extension `runtime/`, `background/`, `shared/`, domain client); not all
domain code is bundled. Background-side behaviour in every live run since then was the old build's.

Fix in the lane tree, uncommitted (worker `live-C-r4-next-page`, verified by the lead):
- new `packages/test-runner/src/guarded-browser/forget-cached-service-workers.ts`, which removes
  `<profile>/Default/Service Worker` before a launch and keeps cookies, storage and sign-ins;
- called before every persistent Chromium launch: `run-scenario/browser-session/launch-browser.ts`,
  `guarded-browser/launch-guarded-context.ts`, `interactive-session.ts` and `saved-flow-replay/replay-browser.ts`.
  `guarded-browser/index.ts` exports it.
- Tests:
  - `run-scenario/browser-session/tests/launch-browser-worker.test.ts`: real Chromium, two builds on one profile;
  - `guarded-browser/tests/forget-cached-service-workers.test.ts`;
  - `guarded-browser/tests/fresh-extension-worker.test.ts`: a structural test that every launch site calls it.

Validation (lead, observed):
- Fail-first: with the call taken out of `launch-browser.ts` and test-runner rebuilt, `node --test
  dist/run-scenario/browser-session/tests/launch-browser-worker.test.js` gave `not ok 1 ... 'first' !== 'second'`,
  `# fail 1`. The file was restored (diff-identical to the fixed copy).
- After the rebuild with the fix (`pnpm.cmd run build`, exit 0):
  - the three new test files plus `launch-containment` and the other `run-scenario/browser-session` tests: `# tests
    18 # pass 18 # fail 0`;
  - `saved-flow-replay/tests/*`: `# tests 20 # pass 20 # fail 0`;
  - `pnpm.cmd run check` (test-runner): no type errors;
  - `node scripts/structure-audit.mjs`: `passed (176 warning(s), 118 baselined)`.
- The only other `launchPersistentContext` is the extension's e2e fixture (`apps/extension/e2e/fixtures/
  extension-context.ts`), not a live path. Firefox installs a temporary add-on and was not probed.

## Other causes and findings

| # | Finding | Where | Status |
| --- | --- | --- | --- |
| R4-1 | Stale background worker in persistent Lab profiles (above) | `packages/test-runner` launch sites | **fixed in lane tree, uncommitted** |
| R4-2 | After the Next page refusals, both repair rounds tried to author Next page as an `add` amendment with `input` on the round's look step (`not_a_kept_step`), never as a new call; the refusal's `next` says to run it as a new call | Core `R/llm` amendment answer / repair brief | open; likely moot once Next page runs; watch next run |
| R4-3 | Judge 0043 said the `plus` condition dropped two rows that carry the badge; they do not (its no was right for paging) | Core build-test judge | open; watch |
| R4-U | UI defects (see the review) | Core activity words, extension cards | open |

Proposal (not done; for the supervisor): enforce R4-1 mechanically as well. The Lab could read the running worker's
build id (the dist has `build-info.json`) after launch and refuse a run whose worker is not the build on disk. That
would also catch a cache this fix does not cover (Firefox, another browser channel).

## Checks of what is new on this source

Most of the new behaviour was not reached, because no Flow could page.
- Seen working:
  - the one-page read (`3 records from 1 page`);
  - node definitions on first use (`describedNodes`, and "is under describedNodes" on the second refusal);
  - `already_answered` for a repeated detect;
  - `same_amendment` refusal of an identical rerun (0029);
  - every refusal names its way out;
  - three same-kind refusals end the round (round 2: 0088/0090/0092 `not_a_kept_step`, then the test);
  - each round left room for its judge pair;
  - the judges see `buildTest.stores` with `passes 1, collected 3`.
- Not exercised:
  - the do-while Repeat, run-end dedupe, the page-pass and loop-end words;
  - act claims, settings rewrite, "nothing to change", R3-1 (`testedLabel`), R3-3.

## UI review

Full review: `docs/working/mvp-final-month-plan/reports/live-C-r4-ui-review.md` (worker). The lead checked S07 against
`screenshots/00007-e7f03f1a4c7d.jpg`, and it matches.
- Seen fixed: "Starting…"; "Done: 3 rows from 1 page"; no thought ends on ";"; the ending reads "Build failed", not
  "Couldn't fix your Flow"; every test shows its "Testing:" cards.
- Open:
  - R4-U-1: the refused Next page shows as "Action · Dom next page / Didn't work: the step wasn't accepted". The name
    is internal, the reason is none, and the two cards are not folded. The panel's own copy has "Going to the next
    page", so the card is the activity fallback for a step that never reached the page.
  - R4-U-2: internal words: "s6" on the check card, "(store passes=1, collected=3, answer rows=3)", "(passes 1)", and
    "the judge" in the ending.
  - R4-U-3: edit cards say "Done: added "looking over the whole page" ... repeat while ... works, at most 20 times"
    under an "Adding the Next page step" heading, and the same list gets a second name.
  - R4-U-4: the round-0 stop blames "kept asking to run steps again", not the refused step. The ending never names
    the Next page refusal as the blocker.
- Not exercised: "Reading page N", "The list ended after 5 pages", "(N times)" folding.

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | Which layer refused (`UNSUPPORTED_TYPE` from the worker's gateway mapping vs the content fallthrough): the refusal detail keeps only the reason, and the failure message never reaches the step folder | domain `node-run/run.ts` -> `refusal.ts` (`detail` drops `failure.actual` / message); Lab step writer |
| all | Which extension build the background worker ran | nothing records it; see the proposal above |
