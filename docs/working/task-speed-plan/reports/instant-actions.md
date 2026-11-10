# Instant actions: replay step timing, readiness from a settled wait, no grace after a quiet press (t890, S10)

## Outcome

Partial. Replays are now timed per step, and two fixed waits were replaced by the evidence that ends them. A replay of local-classifieds dining tables went from 44.0/46.5 s to 35.4/34.7 s; exploration from 48.9 s to 41.0 s. The outcomes are the same: attempts 1-3 right, and attempt 4 stopped at its judge (the known script limit). Neither target is met yet. A non-navigating replayed click still takes about 1.2-1.4 s. Its remaining fixed costs are a 500 ms window in the content script and the after-act capture. Those need event sources I do not own, listed under Open questions.

Measured on local-classifieds dining tables, provider-free, headed, 4 attempts. Before is `run-mwaertjy-bd68e4d2` (instrumented, no behaviour change); after is `run-mwahann3-6e955275`. Each cell gives the mean ms per step before → after: step / overhead (step less the act's own page time) / decision-to-press (step start to the content script starting the act; for navigate, to the worker starting it).

| Node | Explore step | Explore overhead | Explore to-press | Replay step | Replay overhead | Replay to-press |
| --- | --- | --- | --- | --- | --- | --- |
| click | 1963 → 1596 | 1474 → 1017 | 472 → 379 | 2573 → 1327 | 1002 → 613 | 61 → 70 |
| type (submits) | 2159 → 2389 | 2010 → 2214 | 185 → 180 | 2046 → 1962 | 1892 → 1825 | 126 → 118 |
| select | 692 → 752 | 598 → 651 | 152 → 172 | 636 → 562 | 549 → 484 | 83 → 32 |
| navigate | 2473 → 1940 | 1206 → 589 | 318 → 308 | 2626 → 2199 | 1364 → 309 | 111 → 96 |
| extract_list | 2210 → 2139 | 406 → 355 | 118 → 86 | 1853 → 1733 | 384 → 283 | 62 → 48 |

n per kind: explore 9/1/2/6/3 → 8/1/2/6/3; replay (attempts 2-4) 21/3/6/21/6 → 27/3/6/21/6. Explore type and select are one or two steps each, so their deltas are noise.

The replay click mean mixes presses that differ in kind. A successful non-navigating click went from 1450-1627 ms to 1196-1364 ms: the gap between the page's answer and the reply fell from about 440 to 110-180 ms. The old mean included two `web.target.not_found` failures per replay of about 4.5 s each, on prompts that do not appear in a replay. The new exploration ran before one of those prompts appeared, so its Flow has one such step, not two (18 live steps, not 19).

Second site, everything-store batteries-and-descaler, after only (`run-mwahl78d-85363fb5`), against A1's after-run on the same task. Click step 1789 → 1058 ms (overhead 1438 → 816), extract_list 2822 → 2490 ms, browser overhead for the attempt 11.0 → 7.0 s. The verdict was the same as A1's: "answer wrong because records, final_state, repeated_act, not_shown", which this script is designed to produce. With a wrong first answer the Lab runs no replays, so this site has no replay row.

## What changed and why

- **Replay steps are timed** (Core `runtime/llm/step-log/flow-step.ts`, `span.ts` `active()`, `engine/automation/step-loop/step-timing.ts`, `graph-run.ts`). Each pass of the step loop over a node is now an `NNNN-flow-<definitionId>` step with spans: `arrival`, `execute`, `checkpoint`, `ask-or-park`, `state-route`, `failed-attempt`, `learn-interruption` and `before-next`. A step opens only when no tool step is already collecting, so exploration is unchanged. `node-execution/attempt.ts` adds `host.before`, `dispatch`, `host.after`, `expectation` and `recorded-effect`. Domain: `timing/timing.ts` `recordWebCommandSpans`, used by `adapter.ts` and by every dispatch in `host-runtime.ts`, so a replayed command is split as an explored one is. Flow steps cover 44.2 s of a 44.1 s replay, so a replay has no unexplained gaps. A1's "53 s of gaps" was these steps.
- **Readiness from a settled wait** (`runtime/automation-tab.ts`). A `waitForTabReady` that finds the tab settled now leaves the same proof a look does (`noteSnapshotReadiness`). Until a navigation event, the next action on that document starts at once. Before this change, a replay, which takes no look, paid the 1 s stable-address clock again: for example, the capture after every navigate (`host.after` about 1.1 s → 0.14-0.22 s). A wait that ends on its deadline proves nothing.
- **No start grace after a quiet press** (`content/action-runtime/navigation-watch/`, `content/actions/execute.ts`, `shared/protocol.ts`, `runtime/click-landing.ts`). The content script watches its own document from the start of each action to its reply: the Navigation API's `navigate` event (cross-document only), `beforeunload` and `pagehide`. It reports `navigation: { began }` to the worker. That field is worker-only: the domain's payload names its fields, so it never reaches Core. When the page saw no navigation begin and the browser reported none, the landing and opened-tab waits end at once. The reply already comes after the press's answer windows, so anything the press started by then has reached the worker. The grace (300 ms, ending early on the event as before) is kept when the page has no Navigation API, when the control opens elsewhere (`target`, `formtarget`, `<base target>`), and when the reply says nothing.
- Tests beside each change: `flow-step.test.ts` and `step-timing.test.ts` (Core); `timing.test.ts` and `host-runtime-timing.test.ts` (domain); in the extension, `automation-tab.test.ts` (a settled wait proves the next actions, and a navigation event ends it), `click-landing.test.ts` (a quiet reply returns in under 150 ms, a reported navigation is still judged, a browser start beats the page's word) and `navigation-watch/tests`.

## Commands run and observed results

- Core: `npx vitest run src/engine/automation/node-execution/ src/engine/automation/step-loop/ src/runtime/llm/step-log/` gave 1 failed and 174 passed of 175: my own new test expected only `send.click` in a tool step, which now also carries `dispatch`. After fixing it, `npx vitest run .../step-timing.test.ts` gave 2 passed. Earlier, the step-log and step-loop dirs gave 87 passed. `tsc -p tsconfig.json --noEmit` exited 0. `node scripts/structure-audit.mjs` exited 0 (warnings only). Libraries rebuilt with `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build sdk:build ui-components:build` before each Lab run. The Lab never ran with `FLUXIQ_LAB_ALLOW_STALE_CORE`.
- Domain: `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` both exited 0. `node scripts/test-domain.mjs runtime/llm-evidence/node-run/timing runtime/tests/host-runtime-timing.test.ts runtime/tests/host-runtime-groups.test.ts runtime/tests/adapter.test.ts` gave 38 passed and 0 failed.
- Extension: `node scripts/check-extension.mjs` exited 0. `node scripts/test-extension.mjs content/actions content/action-runtime runtime/tests` gave 989 passed and 0 failed. After the directory move, `... content/action-runtime/navigation-watch runtime/tests/click-landing.test.ts` gave 42 passed. `node scripts/structure-audit.mjs` exited 0. It had failed `directory-files` at 26 files until the watch moved into its own directory.
- Lab, all with `FLUXIQ_LAB_INSTANCE=t890 FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt <site> --task <id> --authoring-mode answer-first --scripted-model`, launched only at 3 GB or more free (a scratch launcher waits for it). One run, launched at 2.87 GB, was stopped and relaunched. Each Lab run exited 1 because of attempt 4's judge (local-classifieds) or the designed wrong verdict (everything-store).

## Not verified

- No live (paid) run. Firefox not run: it has no Navigation API in older versions, and there the grace stays.
- The other eight realistic scenarios were not run. Only local-classifieds has before-and-after replays.
- `actedAt` (the press itself) is not on the wire, so decision-to-press ends at the content script's start. The content script's own resolve and actionability time sits inside page time.

## Open questions or contradictions found

- **Rate-limit window (500 ms, `content/actions/click.ts` `RATE_LIMIT_WINDOW_MS`)**, paid by every non-link press answered in place. The sites' handlers are `async`, so the press-work tracker reports `unknown`. The event that ends the window is "every request the press began has answered, plus one frame". That needs `page-world/request-starts.ts` (not mine) to count requests ended as well as begun: fetch settled and XHR `loadend`, asked as "pending since mark". The same probe, plus a `window.open` wrapper, would let the grace end for the cases it still covers.
- **Absent prompt steps cost about 4.5 s each per replay** (the target recovery ladder in `content/action-runtime/recovery/budget.ts`, about 3.75 s, then state routing). A future absence cannot be proven by an event. The Flow should know the step is conditional: an arrival readiness condition, or an interruption handler instead of a main-line step. That is Core authoring and state routing (`engine/automation/state-routing/**` is forbidden to me).
- **Navigation keeps its 1 s stable-address clock** (`waitForTabReady`). Some realistic pages navigate from script just after load (everything-store's checkout page sends a finished order to the thank-you page), so ending at the load event would miss that redirect. Replay navigates are now bounded by the per-origin page pace (`background/page-pace/pace-settings.ts`, 2.5 s between loads): `page.navigate` rose from 1.26 to 1.89 s as the readiness wait went. That spacing is a policy, not a wait to remove.
- **Explore decision-to-press** (about 180 ms per click) is mostly `look.before` re-sending a kept look's whole snapshot (70-160 ms). The fix, a "kept look still current" answer without the snapshot, needs `domain/src/client/gateway-mapping.ts` and `node-run/run.ts` (t885).
- Proposed one-line changes in files I do not own:
  - `domain/src/client/gateway-mapping.ts` `webAutomationActionResultPayload`: carry `actedAt`, for an exact decision-to-press.
  - `packages/test-runner/src/attempt-lane/live/attempt/speed.ts`: treat `kind === "flow"` like `tool`/`test`. Today replay steps count as `otherMs`.
- Docs not updated (not my paths): `docs/architecture/extension-client.md` (readiness proof after a wait, the navigation watch, the grace) and the step-log contract in Core (`flow` folders, documented in `step-log/index.ts`).
- Core files changed outside the named dirs: `engine/automation/graph-run.ts` and `engine/automation/node-execution/attempt.ts`. None of the three reassigned files (`move-page.ts`, `replay.ts`, `shown-rows/account.ts`) was touched.
