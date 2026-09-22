# w2x-fixture-defects: P19 and P16 (task t067)

Worktree: `F:\fxwork\t067-fixture-defects`, branch `task/t067-fixture-defects`, on the shared
read-only Core. All changes are uncommitted. Every run set `FLUXIQ_TEST_ENV_FILES=none`.
`FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never set.

## Outcome

**Done.** The acceptance checks pass:

- **P19 (live).** everything-store's primary recording lane now passes its opening every
  time. In the final run the recorded Flow also replays past the opening.
- **P16.** The full scenario-lab suite passed three times in a row, 570 of 570 each time, at
  100% CPU. The load was other workers plus a 6-thread burner of mine.
- **`live-instructions.ts`** is split: 775 lines became 757.

The race behind P19 is not unique to everything-store. On two more sites (auction,
professional-network) the recorded opening loses the same race, which lanes C and D had
already seen live. I fixed their recorded openings the same way and checked them live.

The brief named one flaky test, but the suite had several, and each had its own cause. I
fixed each one where it started. Four tests were changed to wait for a condition on the page
instead of sleeping, and one new-tab wait was sped up (details below).

## What changed and why

### P19: everything-store opening (`everything-store/workflows/shared-steps.ts`)

**Order.** `SHARED_STEPS.openStore` now runs: wait for the notifications prompt, press
"Not now", then press Accept on the cookie banner. The old script pressed Accept first. That
click lost to the 4 s prompt whenever the first step came late, which the Lab's Core probe
always causes. The new order is the only one that holds whatever the timing.

**Budget.** The wait for the prompt is 15 s. The prompt always comes, but its timer fires late
on a loaded machine.

**No site changes.** Pages, timings and oracles are untouched. Step ids are unchanged, so
repair tasks still find them.

### Same race in two more recorded openings

**auction-marketplace (`manifest.ts`).** A new `ARRIVE` step list runs first: the promotion
(2.5 s), then "Not now", then the greeting (3.5 s), then its close, then "Accept all".
`SEARCH_STEPS` and `watch-endings` now start with it.

- This removes two sources of flakiness. The greeting used to cover "Review bid" on the item
  page, which is why the bid honest-path test was flaky. The promotion used to cover
  "Accept all" whenever a Flow was replayed (lane C runs #2 and #19).
- Each answer lasts for the whole session, so no later page brings these interruptions back.

**professional-network (`manifest.ts`).** A new `ARRIVE` step list runs first: the app prompt
(2.5 s), then "Not now", then the conversation (3.5 s), then its close, then Accept.
`WITHDRAW_SCRIPT` and `SEARCH_SCRIPT` start with it, and their later prompt and conversation
steps are removed.

- Lane D found `people-search` failed 2 of 2 on this race.
- Replay also always hit it, because a replay starts long after the timers have fired.

### P16: tests that failed under load

I stressed the suite by running three full copies at once on a machine already 80–100% busy.
I also ran targeted diagnostics under a 12-thread CPU burner. Causes and fixes:

1. **crossborder "No tab opened" (6 tests).**
   - *Cause:* Chromium starts a new renderer process for each new `target=_blank` tab. Under
     load that took 23.5 to 30 s per tab. With `--process-per-site` it took 0.3 to 1.1 s.
     Unloaded, both take 0.1 to 0.4 s.
   - *Fix:* the crossborder and job-board test browsers launch with `--process-per-site`.
   - *Budget:* the manifests' tab-switch budgets are now 30 s (crossborder `listing-tab` was
     8 s, job-board `careers-site` was 10 s). The Lab's browser does not use the flag.
   - The harness's "No tab opened" error now lists the tabs that are open.
2. **professional-network "paging faster than a person reads".**
   - *Cause:* one tab cannot reliably send four results requests inside 3 s. Unloaded, each
     page took about 0.9 s (4 requests in 2.68 s, a 0.32 s margin). Under load it took about
     1.5 s, so the check never came.
   - *Fix:* four tabs, each on page 1, press "2" together. The first tab found showing the check
     is kept, the others are closed, and "I'm not a robot" is pressed there.
   - *Budget:* the wait for results is 15 s, which covers both of the page's own retries.
   - The test's title changed to say it uses four tabs.
3. **professional-network `arrive`.** Pressing Accept on the feed raced the app prompt. It now
   accepts cookies with the same request the banner's Accept sends (`postToSite` "set-consent").
   Recordings still press Accept.
   - The honest-search spec clears the prompt and conversation on the feed, where they first
     appear.
   - `arm` became `postToSite`, which keeps `browser-session.ts` at 8 exports.
4. **crossborder consent test.** It asserted after a fixed 1300 ms sleep. It now waits for the
   chat pill, then asserts the stack order at the point: consent above the chat pill above
   add-to-cart. The welcome scrim is ignored there, and a separate assertion checks it is on
   top once it arrives.
5. **crossborder Next test.** It checked for the page error after a fixed 800 ms sleep. It now
   polls until the page error appears.
6. **everything-store early-press test.**
   - The press must land before hydration, 1.2 s after load, and under load it landed too late.
   - An init script now presses Add to Cart at `DOMContentLoaded`, then the test waits for the
     page to come alive.
   - "Alive" is signalled by the app banner, which the page's own timers show after hydration.
7. **everything-store honest paths.** A sleep of `productHydrate + 300` is replaced by
   `awaitLiveProductPage`: wait for the app banner and close it, as the recordings do.
   - `settleIn` uses the new order, and the naive honeypot test calls it.
8. **auction tests.**
   - `arrive` and `arriveAndSearch` mirror the new `ARRIVE`.
   - The test that clicks Confirm while the greeting covers it now opens the bid drawer with
     dispatched clicks, so the greeting cannot intercept them.
   - Other tests close the greeting before pressing anything.
9. **company-website.**
   - A 300 ms sleep before reading `chat.opened` is replaced by polling server state.
   - `await-newsletter` has 15 s instead of 9 s. The newsletter opens 4 s after the consent
     save returns, and one loaded run exceeded 9 s.
10. **job-board redesign test.** It used `Promise.race` of two `waitFor` calls. The loser kept
    running, and its timeout 6 s later failed the test from outside. It now uses
    `retry.or(more).first().waitFor`.

### `live-instructions.ts` split

The new `realistic-site-live-tasks.ts` gathers the ten site lists into
`REALISTIC_SITE_LIVE_TASKS`, in the same order. This saves 18 lines (775 to 757, 43 lines of
headroom). The realistic sites' tasks already lived in each site's own `live-tasks.ts`, so
only the imports and spreads could move.

## Commands run and observed results

### Live Lab runs

All runs used `node scripts/lab/run-lab.mjs run <site> [--workflow w] --flow --target persistent-isolated --workspace t067-*`.

**everything-store opening:**

| Run | When | Result |
| --- | --- | --- |
| `run-mubthwcy-173fe9eb` | Before the fix | `accept-cookies` click hit the 30 s timeout: the prompt "intercepts pointer events". Reproduced. |
| `run-mubtluwb-9b9acfad` | After the fix | Opening passed and all 23 steps ran. Then `recording.persistence`: Core was still writing after 90 s. |
| `run-mubvrbrd-a85298bd` | After the fix | 23 steps; recording persisted (149 entries); Flow built (20 candidates). Replay's first node, "Not now", got `target_not_found`: it clicked before the 4 s prompt existed. The failure screenshot, taken later, shows the prompt. |
| `run-mubxfpn6-3a16865f` | Final code | 23 steps; recording persisted. Replay: 8 nodes matched, including Not now, Accept, the search and the browser check. The 9th, `wait_for_selector section > div > button` (the chat's minimise button in a shadow root), timed out. |

**Other sites:**

| Run | Site / workflow | Result |
| --- | --- | --- |
| `run-mubvw3fe-01ae180f` | professional-network withdraw | New opening and all steps passed. Flow run then hit `http.timeout` 30 s on `/api/programs/automation-studio/run-runtime-session`. |
| `run-mubw4ks4-31177a79` | professional-network `people-search` | New opening and all steps passed. Extract returned 10 of 23 records: the known skeleton-pagination gap. |
| `run-mubw7rvz-c86acb87` | auction bid | The Lab's Core probe typed under the promotion before step 1 (`action.dispatch`). This is L1. |
| `run-mubw9tw8-ef37fa18` | auction `watch-endings` | **Passed.** Flow created and replayed with 0 LLM calls; `matchedRecords` 5 of 5 expected. |

### Suite and stress runs

All used `pnpm test` or `node --test "dist/**/*.test.js"` in `apps/scenario-lab`.

**Suite runs (pass / 570):**

| Run | Code | Result | CPU |
| --- | --- | --- | --- |
| Baseline | Unfixed tests | 570 | 80% |
| Acceptance round 1 | After the first fixes | 570, 569, 570 | 32–97% |
| Acceptance round 2 | After the auction, professional-network and company fixes | 570, 570, 570 | 57–86% |
| **Final acceptance** | Final code | **570, 570, 570** | **100%** (other workers plus a 6-thread burner) |

- Round 1's failure was company-website `await-newsletter` at 9 s.

**Extreme stress (three copies at once):**

| Run | Code | Result |
| --- | --- | --- |
| stress-a | Before, full suite ×3 | 563, 562, 566 / 570 |
| stress-b | Before, 5 browser files ×3 | 58, 59, 61 / 66 |
| stress-d | After round 1, 7 files ×3 | 79, 79, 78 / 79 |
| stress-e, stress-f, stress-g | Later, full suite ×3 | 570/566/566, then 570/569/570, then 567/561/569 |

- stress-e included the new-tab cause, fixed afterwards.
- stress-f's one failure was the job-board race, fixed afterwards.
- stress-g's failures all stopped on condition waits running out of time, not on any race:
  company-website clicks at 10 s, crossborder `results-drawn` at 6 s, auction `promotion-shown`
  at 6 s (that budget has since been raised to 15 s).

### Other checks

| Command | Result |
| --- | --- |
| `pnpm --filter`-equivalent `pnpm check` in `apps/scenario-lab` | Exit 0 |
| `node scripts/structure-audit.mjs` | `passed (84 warning(s), 122 baselined)`, the same count as before |
| `git diff --check` | Clean |

## Not verified

- **Auction's primary recording lane.** The Lab's Core probe (L1) is refused under the
  promotion before step 1 runs.
- **Flow replays.** Only auction `watch-endings` passed end to end. The others stopped in Core or
  the runtime, as tabled above.
- **The last budget edits were not re-run under stress.** Those are the 15 s arrival waits and
  `clearInterruptions` at 15 s. They were covered only by the final loaded acceptance runs.
- **Not run:** `test:e2e` (Playwright e2e), repository-wide `pnpm check`/`pnpm test`, and
  Firefox.
- **Five sites not audited** for the same opening race: bigbox-retail, local-classifieds,
  photo-social and social-network-feed have timed overlays. job-board changed only its
  harness, its tab budget and one test.

## Open questions or contradictions found

1. **Runtime readiness (product).** A replayed Flow does not wait for a timed interruption that
   has not appeared yet. `run-mubvrbrd` pressed "Not now" before the 4 s prompt existed and got
   `target_not_found`. `run-mubxfpn6` reached the node later and passed. Any recorded Flow
   that answers a timed interruption depends on how late the runtime reaches that node.
2. **Shadow-root waits (product, P10).** The final everything-store replay stopped at
   `section > div > button` inside the assistant's shadow root.
3. **L1 still blocks auction's primary lane.** The Core probe runs before the recording's
   arrival steps, so it types under the promotion.
4. **Scope.** The brief named the everything-store opening. I applied the same fix to the auction
   and professional-network recorded openings, because lanes C and D had shown the same race
   live. These are files the brief says I own, but the supervisor may want to confirm.
   Recorded step ids changed on those two sites:
   - auction: added `greeting-shown` and `close-greeting` to the opening;
   - professional-network: removed `search-accept-cookies`, `search-conversation-opened` and
     `search-close-conversation`.

   No code outside the manifests referenced them.
5. **The professional-network specs no longer press Accept.** They set consent by request. The
   recordings still press it.
6. **`live-instructions.ts` has only 43 lines of headroom.** More room would need moving
   non-realistic corpus groups, such as social-scheduler or social-inbox.
