# Instant actions, round 2: request-answered windows, pace on evidence, the press moment (t891, S10)

## Outcome

Partial. Four of the five items landed with the same outcomes. Item 3 (the navigation's one-second clock) was built, then reverted, after two Lab runs showed what the clock really covers.

- **Item 1.** The page world now counts the requests a press began and which have answered, and the rate-limit and robot-check windows after a press close once every one has answered. A `window.open` hook keeps the click grace only for a page that opened a tab.
- **Item 2.** The 2.5 s page pace now applies only after an origin has refused a load.
- **Item 4.** `actedAt` reaches Core as a `pressed` point, and the Lab report counts Flow-run steps.
- **Item 5.** The docs are updated.

Measured on local-classifieds dining tables, provider-free, headed, 4 attempts. Before is `run-mwajemrl-82b9d2b0` (dev, with t890); after is `run-mwam3zw3-74ceea96`. Attempts 1-3 were right in both runs, and attempt 4 stopped at its judge in both (the known script limit). Exploration went from 41.0 s to 35.9 s; the replays from 34.4/34.6 s to 33.5/34.8 s. The replays look flat because the new exploration authored a 19-step Flow against the old 18: it caught a timed prompt the old one missed, which adds one absent-prompt click of about 4.5 s to each replay (see Open questions). Each cell gives the mean ms per step before → after: step / overhead (the step less the act's page time) / decision-to-press.

Decision-to-press means two things here. Before, it is the step's start to the content script's start of the act. After, it is the step's start to `pressed`, the act itself. The two differ by 5-20 ms.

| Node | Explore step | Explore overhead | Explore to-press | Replay step | Replay overhead | Replay to-press |
| --- | --- | --- | --- | --- | --- | --- |
| click | 1584 → 1230 | 991 → 933 | 339 → 275 | 1236 → 1587 | 535 → 540 | 66 → 77 |
| type (submits) | 2748 → 2024 | 2565 → 1863 | 403 → 143 | 1952 → 1943 | 1807 → 1802 | 114 → 141 |
| select | 610 → 538 | 533 → 472 | 142 → 141 | 449 → 534 | 377 → 463 | 20 → 77 |
| navigate | 1944 → 1736 | 612 → 475 | 350 → 306 | 2200 → 1529 | 275 → 288 | 90 → 91 |
| extract_list | 2098 → 2065 | 327 → 294 | 98 → 99 | 1669 → 1718 | 229 → 256 | 19 → 18 |

n per kind, explore: 8/1/2/6/3 → 9/1/2/6/3. Replay: 27/3/6/21/6 → 30/3/6/21/6. The replay click mean takes in the extra 4.5 s absent-prompt failures. Like for like, a replayed non-navigating click went 1230 → 1172 ms and 1249 → 1174 ms. The page time of a replayed navigate fell from 1.9-2.4 s to 1.26-1.28 s once the pace no longer spaced one origin's loads 2.5 s apart. A press's own content time when exploring fell from 594 to 297 ms a click: the 500 ms window now ends when the server has answered.

Second site, everything-store batteries-and-descaler, exploration only. The verdict was the same designed one as before ("answer wrong because records, final_state, repeated_act, not_shown"), so no replays ran, as in round 1. Against round 1's run on the same code (`run-mwahl78d-85363fb5`, figures from `instant-actions.md`; that worktree is gone): click step 1058 → 940 ms, page 243 → 155 ms, overhead 816 → 785 ms, and decision-to-press 196 ms. The attempt took 15.0 → 14.4 s.

## What changed and why

- **Item 1: the window ends when the press's requests have answered.**
  - `page-world/request-starts.ts` closes a counted `fetch` on its resource-timing entry, matched by URL, and an XHR at its own `loadend`. A beacon is never opened, and a WebSocket message stays open for good. It answers `fluxiq:request-pending` for a mark and announces each answer as `fluxiq:request-answered`.
  - `content/action-runtime/ignored-press/request-answers.ts` (`watchPressAnswered`) reads that. `rate-limit-notice.ts` and `robot-check/robot-check-watch.ts` close their window one task after the last answer.
  - Each window keeps its whole length when the press began no request, when the page world is missing or tampered with, or when a notice is still missing its wait.
  - `page-world/window-opens.ts` announces each `window.open` call (`fluxiq:window-open`). The navigation watch reports it as `opened`, and `click-landing.ts` keeps the grace only for that tab, ending when the tab appears.
- **Item 2: pacing on evidence** (`background/page-pace/origin-pace.ts`, `pace-settings.ts`).
  - The history: the pace was added on 2026-09-30 by an agent fix (t194 w10, merged as F9) after `run-muntc23v-7fcc4110` tripped everything-store's limiter. No user rule asked for it. The user's rule (2026-10-09) is to wait out a rate limit and go on slower.
  - Now an origin is not paced until a 429 or 503, whether to a read's load or to a navigation's landing (`rate-limited-landing.ts`). Then it holds 8.5 s, spaces loads at 5 s (twice the base), and doubles up to 8 s.
  - At first the first refusal set only the 2.5 s base. With a foreign load every 4 s, the limiter simulation then hit three refusals and flagged the session; at twice the base it stays at two or fewer, never flagged.
- **Item 4: the press moment.**
  - `content/action-runtime/acted-at/` is noted by the click gesture, the key event, the value setter and the input events.
  - `content/actions/execute.ts` puts it on the result as `actedAt`. `domain/src/client/gateway-mapping.ts` carries it, and `node-run/timing/timing.ts` records a zero-length `pressed` span.
  - `packages/test-runner/.../speed.ts` counts `kind === "flow"` steps as browser steps, with `dispatch` as the act, under `<node> (Flow run)`.
- **Item 5.** `docs/architecture/extension-client.md` gains the section "Acting without fixed waits" and a corrected readiness paragraph. `testing-facility.md` covers Flow-run steps and decision-to-press.

## Commands run and observed results

- `node scripts/check-extension.mjs` exited 0. `node scripts/test-extension.mjs runtime content/actions content/action-runtime background/page-pace page-world shared` gave 1142/1142 before item 3's revert; the run after the revert is in the return contract. `node scripts/structure-audit.mjs` exited 0 after I renamed the module and gave its catches their reasons.
- Domain: `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` both exited 0. `node scripts/test-domain.mjs client runtime/llm-evidence/node-run/timing runtime/tests/host-runtime-timing.test.ts` gave 86/86.
- test-runner: `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test dist/attempt-lane/live/attempt/tests/speed.test.js` gave 3/3.
- Lab `FLUXIQ_LAB_INSTANCE=t891 FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt <site> --task <id> --authoring-mode answer-first --scripted-model`, each launched at 3 GB or more free. Runs cut short by my own changes (two with item 3, two everything-store runs on mixed builds) were stopped and their processes killed.

## Not verified

- No live (paid) run. Firefox not run.
- The pace on evidence was not met in the Lab by a real 429: neither task paged fast enough. It is proven only against the limiter simulation.
- `window.open` was not exercised on a realistic page.
- Six of the realistic scenarios were not run.

## Open questions or contradictions found

- **Item 3, reverted.** Ending `waitForTabReady` on the browser's events, with a declared-refresh check, in-flight tracking and a page-world "requests open" query, cost two failed explorations:
  - `run-mwaliwap-12e3ad05`: the results list was missing after a sort that rewrites the address in place;
  - `run-mwalxlxu-efd58e23`: a listing's Save was missing; its panel is drawn by `setTimeout(fetch, detailDelay)`.

  The second is not a redirect: the realistic sites draw content after load from timers, and all ten use `setTimeout`. Only some mark the work `aria-busy`, and a scheduled timer gives no event until it fires. The everything-store checkout redirect the brief names is post-click (`checkout-script.ts:46`, after `await mutate`), not post-load. The evidence that would end the wait is a page-world count of the timers a page schedules while it loads, as `page-world/press-work/` already counts a press's. I recommend that as the next step.
- **Still out of scope:**
  - absent prompt steps on replay: 4.5 s each, and this exploration authored two, so state routing needs conditional steps;
  - the look before an act re-sending the kept snapshot (`gateway-mapping.ts` plus `run.ts`).
- **Two replayed clicks** (s5 and s10, about 850 ms of content time) did not get faster. Their time is inside the content script after the press, most likely the settled-look check (`NO_EFFECT_SETTLE_MS`) on a press answered only in its section. I could not split it without content-side spans.
- I touched none of the files reassigned to t885 (`move-page.ts`, `replay.ts`, `shown-rows/**`, `next-page.ts`, `action-runner.ts`, `runtime/index.ts`, `look-check.ts`, `capture.ts`, `check-wait.ts`, `system-instructions/**`).
