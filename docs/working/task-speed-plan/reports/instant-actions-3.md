# Instant actions, round 3: readiness from the page's own work, presses complete when their work is done (t892, S10)

## Outcome

Partial. The two items asked for landed, and both sites keep their outcomes.

- **Item 1.** The navigation's one-second clock is gone wherever the page can speak. Readiness now ends when the browser's events say the tab finished moving and the page world says the page's own work has drained, with its document unchanged across a task.
- **Item 2.** The ~850 ms after a replayed in-place press is gone: a press that began no request is complete once its own handlers' work has run.
- **Item 3.** Replays ran on a second site, crossborder free hubs. Its replay stops the same way on `dev` and with these changes, at a point that predates this lane.

The gain is uneven. Explorations and navigations are faster, and some replayed acts now wait before acting: the page moved after the look, which used to happen inside the old second. Decision-to-press on replay rose as a result. This is a hypothesis, not confirmed: see Open questions.

local-classifieds dining tables, provider-free, headed, 4 attempts. Before is `run-mwanaq9u-eb3ca953` (`dev`, 82f3b8cb7); after is `run-mwaopobs-6ca50510`. Attempts 1-3 were right in both runs, on the same 18-step Flow with 24 explored steps, and attempt 4 stopped at its judge in both (the known script limit). This includes the two explorations that failed in round 2: the address-only sort and the listing's Save panel. Exploration went 37.3 → 31.4 s; the replays 30.3/29.1 → 28.4/28.8 s. Each cell gives the mean ms per step before → after: step / overhead / decision-to-press (to `pressed`; navigate and extract have none, so they use the content script's start).

| Node | Explore step | Explore overhead | Explore to-press | Replay step | Replay overhead | Replay to-press |
| --- | --- | --- | --- | --- | --- | --- |
| click | 1417 → 1171 | 998 → 887 | 354 → 469 | 1235 → 1255 | 536 → 607 | 68 → 138 |
| type (submits) | 2162 → 1655 | 2005 → 1474 | 159 → 248 | 1961 → 1355 | 1813 → 1200 | 156 → 156 |
| select | 620 → 633 | 541 → 555 | 150 → 181 | 424 → 719 | 359 → 617 | 20 → 61 |
| navigate | 1764 → 1053 | 492 → 488 | 312 → 185 | 1513 → 1179 | 275 → 574 | 87 → 160 |
| extract_list | 2147 → 2153 | 334 → 398 | 109 → 179 | 1677 → 2196 | 228 → 466 | 18 → 91 |

n per kind, explore 8/1/2/6/3 and replay 27/3/6/21/6, in both runs. Per step in replay 2:
- **Navigate:** page time 1.27 s → 0.54-0.68 s.
- **Typed search:** look after 1.29 → 0.45 s.
- **Location chip (s5):** content time 851 → 159 ms (item 2).
- **Before some acts (s5, s10):** a new ~200 ms readiness wait. Across the search and the chip, s4 + s5 went 3.21 → 2.14 s.

Second site, crossborder free hubs. Before (on `dev`) is `run-mwap35zr-db3a23d2`; after is `run-mwaoxazg-c72ca4af`. Exploration was right in both, 24.6 → 21.7 s (navigate 3252 → 1992 ms, click 2640 → 2131 ms). The replay ran the same path in both runs and ended the same way. Its successful steps got faster: navigate 1987 → 1030 ms, typing 1750/1971 → 823/1371 ms, a click 1928 → 1265 ms.

## What changed and why

- **Item 1: readiness from the page's own work.**
  - `page-world/page-work/` (new) counts the work a page schedules for itself, each piece until it is done:
    - timers due within `PAGE_WORK_HORIZON_MS` (1 s, the second the old clock gave);
    - animation frames, left out while the document is hidden;
    - fetches, until their resource-timing entry;
    - XHRs, until `loadend`.
  - Recurring work is left out on evidence, not by a time limit: a callback scheduled again once it has run (polling, animation loops, `setTimeout(poll)` after an `await`), an interval once it has fired, and what such a callback begins. It installs before the request probe and press-work, so their wrappers and health checks hold.
  - `shared/scheduled-work-event.ts` is the contract. `runtime/navigation-events/page-settled.ts` is injected into the page: it waits for the drain, then confirms a task later with no mutation (a `MutationObserver`). `page-work.ts` wraps it.
  - `automation-tab.ts` `waitForTabReady` checks, in order:
    - the tab `complete` with no `pendingUrl`;
    - no top-frame navigation in flight (`epochs.ts` `inFlight`);
    - a drive heard beginning;
    - no `<meta refresh>` due within 1 s (`declared-refresh.ts`, `refresh-delay.ts`);
    - the page's work drained.

    The old second is kept only where nothing can speak for the page: no page world, an ignored drive, or a declared refresh.
- **Item 2: presses complete when their work is done.**
  - `ignored-press/request-answers.ts` also takes the press-work mark (`work-mark.ts`). A press that began no request is complete once its causal work is `idle`.
  - The rate-limit and robot-check windows close then. `settled-look.ts` reads the section as it stands once the work is done, with no `QUIET_MS`/`HELD_MS`.
  - Timing inside the content script, from the step's `pressed` point and its `page.click` span: the location chip pressed at +108 ms and replied at 1152 ms; the sort box replied at 834 ms. Both were in-place openers with synchronous handlers, waiting out the rate-limit window and the settled look's `HELD_MS` (700 ms).
  - `pending` and `unknown` (async handlers) keep today's waits.
- **Tests:**
  - `page-world/page-work/tests` (7, the sort and listing shapes among them);
  - `navigation-events/tests/page-settled`, `refresh-delay` and `epochs` (in-flight);
  - `runtime/tests/tab-ready-events` (6, the listing, the sort, no page world, a declared refresh, and a later script redirect caught);
  - `ignored-press/tests/settled-look` (2) and `request-answers` (1);
  - `click-landing-new-tab.test.ts`, adapted: the epochs' permanent listeners, and a stub that answers the settle check.
- **Docs:** `docs/architecture/extension-client.md` covers readiness and the press-work ending.

## Commands run and observed results

- `node scripts/check-extension.mjs` exited 0. The structure audit exited 0, after renaming the contract (`shared/` had three `page-` files), typing the test stand-in instead of `as never`, and unpacking one test line.
- Domain `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` both exited 0. No domain file changed this round.
- `node scripts/test-extension.mjs runtime content background page-world shared` gave 2805/2805 before the renames; the run on the final code is in the return contract.
- Lab, through the 3 GB launcher, instance t892: the four runs above. For the crossborder baseline I saved my 30 files to a tar, restored `dev`'s versions with `git show HEAD:<path>`, let the prelude reuse `dev`'s cached build, then put my files back; the tree matched the saved status exactly.

## Not verified

- No live (paid) run, and no Firefox run.
- A page that polls forever, or a long poll, was not met in the Lab.
- Six realistic scenarios were not run.

## Open questions or contradictions found

- **A new wait before some replayed acts.** Steps s5 and s10 in local-classifieds wait about 200 ms between the send and the content script's start. The proof from the look after the step before is gone by then, so `waitForTabReady` waits for the page's work. My hypothesis is that the page moved the address after that look, which the old second hid inside the look; I did not confirm which navigation event moved the epoch. The next step is to name that event per step (a span from `waitForTabReady`).
- **The crossborder replay fails on `dev` too.** The free-shipping click meets the site's robot check (`web.intervention.required`). The person clears it, the Flow goes on without the filter, and the list read fails four times with `output_not_observed`, about 11 s each. That is the replay and repair path in Core and the domain, not this lane.
- **Still for after t885:** prompt steps absent on replay, and the look before an act re-sending the kept snapshot.
- I touched none of the excepted files (`click-landing.ts`, `action-runner.ts`, `look-check.ts`, `runtime/index.ts`, `next-page.ts`, `move-page.ts`, and the domain files).
