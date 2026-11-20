# Live campaign 2026-11-19: supervisor report

## Outcome

Phase 0 is done and the campaign is waiting for "go". No live run, build or paid call has happened yet.

## Phase 0

- **Read:** testing-facility.md, the four sections the brief names. Each run's bundle is
  `test-runs/attempts/<runId>/` (`attempt-report.txt`, `attempt.json`, `attempt-N/`). Its steps are
  `C:/Users/osrs_/FluxStuff/lab-runs/<date>/<runId>/steps/`.
- **Matrix:** chosen and recorded in `live-campaign-2026-11-19/results.md`. There are three rounds of ten, one task per
  site per round, hardest first. Haiku, Sonnet and Opus rotate so that each site sees all three models across the
  rounds and at least two by the end of round 2. Lanes alternate.
- **Lab slots:** slot-1 now belongs to `campaign-a` (t959) and slot-2 to `campaign-b` (t960). Both had stale t907
  owners from 2026-11-12 (pid null).
- **`.env.local`:** neither lane worktree had one, so I copied it from the main checkout with a plain file copy and
  never read it. It is gitignored. This is finding F0.
- **Results and findings:** `results.md` is created. A hook refuses a file named `findings.md`, so the findings are a
  `## Findings` section inside results.md.
- **Approved-client proof:** queued for lane A right after its build, before the first live run, as the lead
  added.

## State of the lanes when Phase 0 ended

| Tree | HEAD | Status |
| --- | --- | --- |
| Extension dev | d95da431a | |
| Core dev | 396449cd3 | |
| t959 extension | contains dev | |
| t959 Core | b0bd551b4 | behind Core dev |
| t960 extension | contains dev | |
| t960 Core | contains dev | missing 10 of 143 compiled entry points (client-gateway-websocket, ui-components), so it needs `pnpm build` |

## Plan after "go"

1. **Build each lane through the gate:**
   - Core: `pnpm build` in `../!FluxIQ`.
   - Lab packages: `pnpm --filter @fluxiq-web-extension/test-runner... build`.
   - Extension: `pnpm --filter @fluxiq-web-extension/extension build`.
   - `run-lab` builds each instance's own bundles.
2. **Lane A:** run the approved-client proof.
3. **Live runs:** start lane A on everything-store-plus-earbuds-under-50 (Sonnet) and lane B on
   job-board-remote-easy-apply (Haiku), with `FLUXIQ_LAB_INSTANCE`/`FLUXIQ_LAB_LANE` set to campaign-a or campaign-b.

## Open questions for the lead

- **Findings file:** is a `## Findings` section in results.md acceptable, or should the lead create `findings.md`?
- **`.env.local`:** check why `copyEnvLocal` did not run for t959 and t960.

## After "go" (02:20 to 02:55): paused for the t925 merge

- **Builds:** both lanes' builds (Core `pnpm build`, Lab packages, extension) were queued in the heavy-slot gate at
  about 02:20. They waited behind `lead-verify-trio-t925`, `t905og-gate` and `t958-rf`; the gate is first come,
  first served, and memory sat between 0.6 and 4.7 GB free.
- **Cancelled:** when dev moved (t925: Core 76535e793, extension b7a8a1843), I stopped both queued builds before
  either got a slot. Their logs end on "waiting", so nothing was built.
- **Nothing else ran:** no approved-client proof, no live run, no paid call.
- **Prepared:** a launcher script with the instance and lane env, the gate and `--llm-max-cost-usd 5`. It is in the
  supervisor's scratchpad (`run-lane.sh`).
- **On "continue":** queue both builds again, run the approved-client proof in lane A, then round 1 as planned.

## Resumed 11-19 12:55; stopped by the lead at about 14:50

**Builds**
- Lane A: its 02:57 build checked good (Core current, web `Compiled successfully`, extension dist present).
- Lane B: rebuilt at 13:05 on an idle machine, exit 0. Its 02:58 web build had crashed with 0xC00000FD under load
  (finding F1).
- Both lanes: the Scenario Lab and the web panel host also had to be built (`scenario-lab build`,
  `domain host:build`). The proof needs both.

**Approved-client proof (lane A)**
- Did not hold. Every model-access check passed (configured later, after logout, after reconnect, after a Core
  restart), and so did the stream proof.
- It then timed out on the pairing dialog, whose title Core's t925 changed (finding F2, SIMPLE).
- F2 is fixed in lane A: `prove.ts` and `panel-navigation.ts` match `/^.+ wants to connect$/u`, with
  `pairing-approval.test.ts` updated. The test-runner was rebuilt and 14/14 tests pass.
- Rerunning the proof is pending.

**Live run 1 (lane B), job-board-remote-easy-apply, Haiku: PARTIAL, $0.76, 50 min**
- The user stopped it by hand after attempt 3 looped for 34 minutes on judge refusals.
- Debug: `fxwork/t960/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mwo3dp11-a47a032d.md`.
- New findings: F3 to F6 (FUNDAMENTAL) and F7 (SIMPLE, not fixed).

**Gate**
- My jobs no longer use `HEAVY_SLOT_PRIORITY`.
- `TaskStop` on a gate wrapper leaves its `heavy-slot` node waiter alive. I killed that one waiter (pid 19584,
  which had not started a run) by the pid in its own ticket. Future stops of a live run use `pnpm lab stop <instance>`.

**State**
- Nothing is running or queued from the campaign.
- Lane A holds the F2 fix, uncommitted, in `packages/test-runner`.
- Both lanes' debugs are current: lane A never made a live run, and lane B's debug is written.

## Go at dev 9e200d95d / Core 871bcdeb1, then hold for unit J

- **Builds:** both lanes rebuilt in one gate job, one after the other, with no priority flag. Exit 0, and each
  lane's web build `Compiled successfully`.
- **Approved-client proof:** held in lane A, 29 of 29 checks (F2 proven).
- **Launcher:** now pins `--llm-model claude-haiku-5-5` and watches its own run. It runs `pnpm lab stop <instance>`
  after 5 minutes with no new step, or on the third same refused completion in an attempt.
- **Hold:** no live run was launched before the hold. Waiting for "go" once J lands.

## Go at dev f9a462369 / Core e3f869237 (after the power cut), then hold for the key-binding fix

- **Builds:** both lanes force-rebuilt (`FLUXIQ_BUILD_FORCE=1`), one after the other through the gate. Exit 0, and both
  web builds compiled.
- **Runs 2 and 3:**
  - Lane A, everything-store-plus-earbuds-under-50.
  - Lane B, job-board-remote-easy-apply.
  - Both stalled when the t962 ladder climbed to Sonnet: there was no key for the climbed model (F8). I stopped them
    with `pnpm lab stop` at 02:27Z.
  - Debugs are written in each lane's tree.
- **Findings:** F8 (key binding against the ladder; the lead is fixing it) and F9 (the act_on_a_read loop).
- **Watchdog:** hardened. Progress now excludes bare page re-reads.
- **Holding:** launches wait for "go".

## Go after t964 (key fix): runs 4 and 5, then hold for the judge fix

- **Builds:** both lanes rebuilt incrementally (Core's fluxiq, ui-components and web; the domain; the extension).
  Exit 0.
- **Run 4 (lane A), everything-store-plus-earbuds-under-50:** Lab `passed`, campaign PARTIAL. All 4 answers right,
  and attempts 3 and 4 made zero calls.
  - The ladder climbed Haiku to Sonnet to Opus in attempt 1, with no key errors, so F8's first half is closed.
  - New findings: F10 (raw page captures, about 1 MB each, made the judge's request too large: HTTP 400. Corrected after the lead's diagnosis), F11 (the judge on the
    climbed model empties the purse, $4.70), F12 (right answers labelled `budget_out`).
- **Run 5 (lane B), job-board rerun:** stopped by me before any call, under the lead's hold.
- **Launcher lesson:** never edit the launcher script while a run is executing it. Bash reads scripts as it goes, and
  this run's final summary line failed to parse. The run itself was unaffected.
- **Holding:** launches wait for "go".

## Interim report, 2026-11-19 21:30 (about 3 hours into round 1 under t962 to t965)

### Runs so far: 9 launched, 7 counted

| # | Lane | Task | Verdict | Cost | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | B | job-board-remote-easy-apply | PARTIAL | $0.76 | Before t962; the user stopped it |
| 2 | A | everything-store-plus-earbuds-under-50 | FAILURE (stopped) | ~$0.22 | F8 key stall after the climb |
| 3 | B | job-board-remote-easy-apply | FAILURE (stopped) | ~$0.07 | F8 |
| 4 | A | everything-store-plus-earbuds-under-50 | PARTIAL (Lab passed) | $4.70 | 4/4 right, a3/a4 zero calls; F10, F11, F12, F13 |
| 5 | B | job-board | not run | $0 | Stopped under the lead's hold |
| 6 | A | auction-marketplace-lens-hood-seller-shop | PARTIAL (Lab passed) | $0.58 | 4/4 right; a3 zero calls |
| 7 | B | job-board-remote-easy-apply | PARTIAL (stopped) | ~$0.95 | a1 right; a2 `run_flow` loop (F15) |
| 8 | A | crossborder-marketplace-free-hubs-under-ten | FAILURE (watchdog) | ~$0.02 | Person check never answered (F16) |
| 9 | B | professional-network-netherlands-data-engineers | not counted | ~$0.03 | Watchdog false stop; rule fixed; relaunched |

- **Tally (counted runs, all Haiku base):** 0 SUCCESS, 4 PARTIAL (two of them Lab-passed with 4/4 right),
  3 FAILURE (two from F8, one from F16).
- **Spend:** about $7.3 in total.
- **Ladder:** it climbs Haiku to Sonnet to Opus on `loop_persisted`, `completion_refused_again` and `repair_failed`.
  The model's own loop decisions seen so far are `ask_person` (twice) and `change_approach` (twice).

### Findings

| Finding | Status | What |
| --- | --- | --- |
| F2 | SIMPLE, fixed in lane A, proven | The Lab's pairing step matched the old dialog title |
| F8 | First half fixed (t964); second half recorded | Key binding against the ladder; endless 60 s retry on a non-retryable failure |
| F10 | t965 | Raw page captures in the judge's trail |
| F11 | t965 | Judge on the climbed model empties the purse |
| F12 | FUNDAMENTAL | A right zero-call replay is labelled `budget_out` |
| F13 | Lead's call | A refused call keeps its purse reservation |
| F14 | FUNDAMENTAL | The first judge of a pair writes its trail to cache, never reads it |
| F15 | FUNDAMENTAL | Loop detection misses a successful call repeated with the same input |
| F16 | Being traced provider-free in lane A | A cleared person check whose Continue never reached Core |

F3 (job-board Easily apply) did not recur after t963.

### Watchdog

It stops a run on:
- 5 minutes with no decision, judge or Flow step;
- the third same refused or unjudged completion;
- 4 of the last 6 unrefused decisions being one call, newest included. That last rule caught run 7's loop. Its first
  version made a false stop (run 9) and has been fixed.

### Next

- Lane B: the professional-network rerun is queued.
- Lane A: the provider-free F16 probe is queued, then lane A continues.

## Interim report 2, 2026-11-19 23:50: holding for the merge round (t966 on dev)

### Since interim 1

| # | Lane | Task | Verdict | Cost | Note |
| --- | --- | --- | --- | --- | --- |
| 10 | B | professional-network-netherlands-data-engineers | FAILURE (budget_out) | $5.02 | No model dropped the promoted row (F17); the Opus judge $1.10 |
| 11 | B | bigbox-retail-new-store-cheapest-towels | not counted | | Watchdog false stop (race); rule fixed |
| 12 | A | crossborder-marketplace-free-hubs-under-ten | FAILURE (watchdog) | | F16 again, with its error now logged |
| 13 | B | bigbox-retail-new-store-cheapest-towels | PARTIAL (Lab failed, budget_out on a4) | ~$4.6 | a1 to a3 right; a2/a3 replays repaired (28 decisions each); Sonnet judges ~$0.80 each (F14) |
| 14 | A | photo-social-august-over-1300 | FAILURE (watchdog: third refused completion) | ~$1.83 | The read stored only URLs; the stop came right after the climb to Opus |

At 23:46 both launches (social-network-feed-delete-stranger-requests in lane B, local-classifieds-bikes-within-alex-price
in lane A) were refused by `behind-dev` before any spend: Core dev has t966.

### Tally

Counted runs, Haiku base with the ladder: 11 runs.
- 0 SUCCESS.
- 5 PARTIAL. Two of them the Lab rates passed with 4/4 right: everything-store and auction.
- 6 FAILURE: 2 from F8, 2 from F16, 1 `budget_out` (F17), 1 stopped after three refusals.

2 more runs are not counted because of watchdog errors. Total spend is about $19.

### Sites covered so far

everything-store, auction-marketplace, job-board, professional-network, bigbox-retail, crossborder-marketplace and
photo-social. Not yet run: social-network-feed, local-classifieds and company-website.

### Fixes waiting to land, all in lane A's `packages/test-runner`, all Lab code

| Fix | Files | Proof |
| --- | --- | --- |
| F2 | 3 files | Approved-client proof held, 29/29 |
| F16 | `view-target-press/in-panel-target.ts`, `press-in-view-target.ts`, `tests/panel-driver-press.test.ts` | 9/9 tests; the old code fails 2 with the live error; scripted crossborder pressed Continue; audit passed |
| F16 diagnostic | `attempt-lane/live/attempt-person.ts` (the hand-off note on the log line) | 78/78 tests |

### Fundamentals recorded since interim 1

- F17: rows marked as promoted are not excluded by the read (F3 family; feeds the post-processing design).
- F14 still shows: judges after a climb to Sonnet read about 1% from cache, $0.78 to $0.85 each.
- Replays deviate on later attempts (bigbox) and need full repair.
- The photo-social read stored only URLs.

### Worker

One worker-heavy (F16) finished in about 90 minutes. The supervisor verified it: diff reviewed, tests rerun, audit
passed.

### Next on "continue"

1. Rebuild both lanes.
2. Rerun crossborder in lane A, the live proof of F16.
3. Lane B: social-network-feed delete-stranger-requests. Lane A: local-classifieds bikes-within-alex-price.
4. Then company-website, and reruns.
