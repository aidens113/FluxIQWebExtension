# t191-overlay-2 — worker report

## Outcome

Done. All six items are in, and each one is shown in a headed-Chromium screenshot of company-website:

1. **Placement (U3).** The pill avoids fixed parts of the page, and becomes a dot when every corner is busy.
2. **Legibility (#8).** Larger type and stronger contrast on light and dark pages.
3. **No echo (U2).** The headline is never repeated as the detail line.
4. **Navigation (U7).** The pill is redrawn at once on a new document, before that document's first paint.
5. **Repair and failure (U8).** Repair has its own headline, and a failure stays on screen.
6. **Waiting for the person (U9).** A robot check reads "Waiting for you: finish the check on the page".

The extension's `check`, `test` and `build` pass, and the structure audit passes.

**About U9.** Core sends no event of its own for a robot check. The only signal is the extension's result code `web.intervention.required` on a build's tool event. That signal is what is used.

## What changed and why

### Placement (item 1, U3): `content/activity-overlay/placement/`, new

**`choose-placement.ts` (`choosePlacement`)** is pure: the page is reached only through a `probe(x, y)` function.

- It samples the pill's box at each corner, one point about every 36 px.
- **Busy corner:** any sampled point lies on something fixed or sticky, or on a dialog.
- **Clear corners:** they differ only in how many ordinary controls they cover, and fewer wins. After that the order is bottom-left, top-left, bottom-right, top-right. The left side comes first because of the Lab side-panel finding from round 1.
- **Hysteresis:** a corner the pill already holds is kept while it stays clear, so scrolling past links never makes it hop.
- **All busy:** it becomes a 30 px dot at whichever corner or side midpoint covers least. Fixed points weigh 100 times more than controls.

**`page-probe.ts` (`pageProbe`)** says what is under each point.

- It hit-tests with `elementFromPoint`, stepping into open shadow roots, where company-website's banner and chat widget live.
- It walks ancestors across shadow boundaries, with a per-check cache.
- A fixed box that covers 60% or more of the viewport counts as a backdrop (for example a modal scrim), not an obstacle.
- The extension's own UI is skipped via `isExtensionUiNode`.

**`placement-keeper.ts` (`PlacementKeeper`)** re-checks as the page changes.

- Triggers: resize, scroll (capture) and page DOM mutations. Mutations inside the extension's UI, and the overlay host arriving or leaving, are ignored.
- Rate: at most one check per 800 ms, leading plus trailing.
- A check only reads the page. The host is written once, and only when the placement changes.
- In a DOM without layout (the Node fake DOM) it keeps bottom-left.

**`anchor-style.ts` (`anchorStyle`)** writes all four offsets on every move.

### The pill (item 2, #8): `status-pill.ts`

**Sizes and colours.**

| | Before | Now |
| --- | --- | --- |
| Headline | 13 px | 14 px, weight 600, `#fff` |
| Detail | 12 px, `#a3a9b6` | 13 px, `#d8dde6` |
| Step text | 11.5 px | 12.5 px |
| Expanded shape | 300×54 | 384×66, padding 11/16/11/14 |
| Collapsed shape | 196×32 | 300×36 |
| Dot | none | 30×30 |

- The card is `rgba(17,19,26,.96)`, with a light hairline inside (for dark pages) and a dark 1 px ring outside (for light pages).
- **Why 384 px:** at 340 px the screenshot cut "Waiting for you: finish the check on the pa…". At 384 px it fits.

**Behaviour.**

- The shape is `expanded`, `collapsed` or `dot`. It is redrawn in place: the dot hides the text lines but keeps them up to date, and no node is created.
- **Only "done" fades** (`view.fades`, after `ACTIVITY_DONE_VISIBLE_MS` = 6 s). A failure stays up until new work starts or the person hides the overlay. Waiting for the person never fades.
- **No entry animation.** The host is placed by the keeper in the same task, before the first paint.
- `pointer-events: none`, `inert`, `aria-hidden`, the host tag `fluxiq-activity-overlay` and `data-fluxiq-activity` are all unchanged, as is the text-node order (headline, step, detail) that the Lab sampler reads.

### Other content changes

- **`overlay-view.ts`:**
  - `settled` became `fades` (done only).
  - A detail that echoes the headline is drawn as `""`.
- **`overlay.ts`:** ignores a display older than the one drawn for the same unit of work. The at-once `contentReady` answer and a paced send can cross, and this stops the older one winning.

### Headlines (items 3, 5, 6): `background/activity/`

**`headline.ts` (`activityHeadline(kind, outcome, situation)`)** now returns:

- "Fixing your Flow" while repairing;
- "Couldn't fix your Flow" when a repair fails;
- "Waiting for you: finish the check on the page" for a robot check (`waitingOn: "check"`);
- "Waiting for you: answer in the FluxIQ panel" for Core's `waiting_permission`;
- otherwise the working, done and failed headlines as before.

**`unit-situation.ts` (`UnitSituation`), new.** Every event passes through it, including events the pacer holds back, so a repair or a check that starts inside a paced interval still changes the headline at once. It tracks two things per unit of work:

- **Repairing** starts on a `repairing` phase. For a run it ends at the run's next step event. For a build it lasts until the build settles, because Core sends no "repair finished" event.
- **Check** starts when a result code in `detail.text` or the label matches `web.intervention.*` or `user_intervention_required`. It ends at a later tool event with status `succeeded` and a `.succeeded`/`.ok`/`.done` code (or no code), or at a run step.

**`pacer.ts`:**

- **Display:** it computes the display at accept time from the unit situation. The outcome is `waiting` while a check stands.
- **What shows at once:** a new unit, or a change of headline or outcome. Detail changes on their own are still paced at 1,200 ms, and that includes the time spent waiting on a check.
- **Detail wording:**
  - The event that reports the check gets the detail "Only a person can get past this page", in place of the misleading "…— done".
  - A detail that echoes the headline becomes `null` (`isHeadlineEcho`).

### Navigation (item 4, U7): `activity-relay.ts`

- **`noteContentReady` answers the new document at once.** It is outside the page gate and outside the one-at-a-time queue: it resolves the target, and when it is this tab it sends the current display directly. Before, the answer went through the queue, where a send still in flight to the old document could hold it indefinitely.
- **A hung page send is given up** after `PAGE_SEND_TIMEOUT_MS` (3 s), on the injected clock, and the timer is always cleared.
- **"Done" is not redrawn once it has faded.** A done display older than 6 s is not redrawn on a new page. A failure is redrawn on every page.
- `deliver()` lost its now-unused `onlyTo` parameter.

### Shared (`shared/activity/`), new

- `headline-echo.ts` (`isHeadlineEcho`): two lines echo when they match, ignoring case, punctuation and your/the/a/an. A detail that is only a prefix of the headline also counts as an echo.
- `done-visible.ts` (`ACTIVITY_DONE_VISIBLE_MS`).
- The `ActivityDisplay` documentation is updated.
- `wording.ts` and its test were not touched.

### Tests

**New files:**

- `placement/tests/choose-placement.test.ts`, 11 tests, run against synthetic rectangles:
  - empty page;
  - chat widget bottom-right;
  - cookie banner across the bottom leads to top-left;
  - a small fixed button makes a corner busy;
  - the fewest-controls tie-break;
  - hysteresis;
  - a busy held corner is left;
  - all busy gives a dot at the left midpoint;
  - least-busy dot;
  - a dot returns to the pill;
  - anchor offsets.
- `content/activity-overlay/tests/overlay.test.ts`: an older display is ignored.

**Additions to existing tests:**

- `pacer.test.ts`:
  - no echo;
  - the repair headline is at once, holds through the repair, and a failed repair reads "Couldn't fix your Flow";
  - a run that recovers goes back to running;
  - the check headline: at once, paced while Core keeps deciding, cleared by a later success.
- `activity-relay.test.ts`:
  - `contentReady` is answered at 30 ms while a send to the old document hangs and the pacer holds a newer sentence;
  - a hung send is given up and the next display arrives;
  - done is redrawn before 6 s and not after;
  - a failure is redrawn after 60 s.
- `status-pill.test.ts`:
  - the dot on a fake laid-out page with the same nodes, and the pill again once a corner clears;
  - font sizes (14, 13, and nothing under 12.5);
  - a failure never schedules a fade.
- `overlay-view.test.ts`: only done fades, and echoes are removed.

**Updated tests:**

- `pacer.test.ts`: expectations updated for the echo rule and the new waiting headline.
- The relay's rate-bound test now alternates `verifying`/`exploring` instead of `repairing`, because repairing now changes the headline at once. The bound it asserts is unchanged.

### Other files

- **E2E spec** (`e2e/content/tests/activity-overlay/tests/activity-overlay.spec.ts`), edited but not run:
  - new sizes;
  - `clearConsent` before the geometry asserts;
  - the click-through button is now in normal page flow (absolute) and placed after the overlay is shown;
  - new tests for "a failure stays" and "a fixed bottom banner moves it, and with all corners busy it is a dot".
- **Docs:** `docs/architecture/extension-client.md`, "Live Activity":
  - the relay's `contentReady` and timeout;
  - the headline rules, including Core having no robot-check event;
  - echo;
  - the new "Where it sits" paragraph;
  - sizes and legibility;
  - done-only fade;
  - the measured navigation numbers.

## Commands run and observed results

**Unit tests (scratch runner).** A runner in the session scratchpad, `quick-test-overlay2.mjs`, uses the same esbuild config as `test-extension.mjs` and bundles only the activity directories. Final run: `# tests 99 # pass 99 # fail 0`.

**Typecheck:**

- `npx tsc --noEmit -p tsconfig.json` in `apps/extension`: no output.
- `npx tsc --noEmit -p tsconfig.test.json` (includes the e2e spec): `tsc-test=0`.

**Package check, test and build.** All run with `EXTENSION_TEST_BUILD_LABEL=t191-overlay2`, through `heavy.sh`:

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | `check=0` | |
| `pnpm --filter @fluxiq-web-extension/extension test` | `test=0` | `# tests 1306 # pass 1306 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension build` | `build=0` | `chrome: verified 22 files`, and the same for firefox and e2e-chromium |

The build ran twice; the second was after the width change. No source file changed after the second build.

**Structure audit.** `node scripts/structure-audit.mjs`: `structure-audit: passed (124 warning(s), 120 baselined)`. No findings in my files.

**Browser probe.** Setup:

- Wrapper: `bash C:/Users/osrs_/FluxStuff/build-slots/ui.sh "t191 overlay2 company-website probe" node probe-overlay2.mjs <ext copy> company-website`.
- Browser: headed Chromium, 1280×720 viewport, the Lab's tab topology with the side panel open.
- Gateway: a fake gateway sending `server.activity` and one `web.browser.navigate`. No Core, no model, no provider call.
- Build: a copy of `dist/chrome` taken right after my build.

Three runs:

- Run 1 stopped at the consent click, because the chat greeting covers the consent's buttons. It is now clicked programmatically.
- Run 2 completed.
- Run 3 completed, on the 384 px build.

Screenshots are in `C:/Users/osrs_/FluxStuff/evidence/t191-shots/`. Each scene has `overlay2-*-page.png` and `-window.png`; the window capture includes the side panel. I looked at each with Read.

| Scene | What it shows |
| --- | --- |
| `01-consent-banner` | Consent banner across the bottom, chat card bottom-right. The pill moved to the top-left (host `x16 y16`), over the consent's dim scrim, and nothing needed is covered. |
| `02-banner-answered` | After Accept, the pill is back at the bottom-left (`y638`), clear of the chat widget. |
| `03-repair` | "Fixing your Flow / Repairing the Flow: the result check refuted its …". |
| `04-after-navigation` | The pill is present on `/team`. |
| `05-check-waiting` | "Waiting for you: finish the check on the page / Only a person can get past this page", with the attention mark, fully legible. |
| `06-dark-page` | "Fixing your Flow / Thinking about the next step" on a darkened page. The hairline separates the card and the text is clear. |
| `07-failure-stays-8s` | "Couldn't fix your Flow / Build failed" still up after 8 s. |
| `08a-modal-answered` | The newsletter modal was answered; the pill is at the bottom-left. |
| `08b-every-corner-busy-dot` | A fixed bar was added across the bottom. With the sticky header at the top and the chat card bottom-right, every corner is busy. The dot sits at the left midpoint (`x16 y345 30×30`), clear of all three. |
| `run2-08-modal-scrim-is-backdrop` | From run 2. The newsletter modal's full-page scrim counted as a backdrop, so the pill sat top-left over the scrim and not over the dialog. That is correct, but it was not the dot scene, so the file was renamed. |

**Navigation measurement (U7).** An init script recorded the old page's `pagehide` time, when the host was inserted into the new document, and the new document's first paint. A 16-sample, 200 ms presence sampler ran across the navigation, as the Lab's UI review does.

| Run | Host back after old page hid | New page's first paint | Sampler |
| --- | --- | --- | --- |
| 3 | 65 ms (82 ms after navigation start) | 104 ms | 16/16 present, 0 presence toggles |
| 2 | 121 ms (149 ms after navigation start) | 145 ms | 1 of 16 absent, 2 toggles |

In both runs the host was back before the new page's first paint (`hostBeforeFirstPaint: true`). In run 2 the one absent sample fell inside the 121 ms gap: the new document existed but had not yet painted.

There is no before-measurement with the round-1 build. The round-1 queue delay only shows when a send to the old document hangs; the unit test covers that case.

## Not verified

- **The return from dot to pill after a mutation, live.** The scene 8c removal missed the bar because my selector was wrong, so I deleted that screenshot. The same mutation re-check was seen live moving the pill in scenes 2 and 8b. The return itself is covered by unit tests, in `choose-placement` and the status-pill dot test.
- **No re-run after scene 8c, because of RAM.** Free RAM was 1.97 GB at the start of run 3, and I did not launch another browser. `ui.sh` has no RAM gate.
- **The e2e spec was not run**, per the brief.
- **Real Core events** were not exercised: repairing, `web.intervention.required`, and a real Lab navigation. Everything came from the fake gateway. A real robot-check page was not visited.
- **Only company-website** was run. Not visited:
  - bigbox-retail's sticky header and fixed cart bars;
  - everything-store's consent bar and bubble;
  - the Firefox popup build.
- **Closed shadow roots, canvas bars and pointer-events-none banners** are invisible to the probe.
- **The panel's use of the new headlines and the null echo detail** was not checked; that is the panel worker's.

## Open questions or contradictions found

1. **U9 has no Core event.**
   - Core emits `waiting_permission` only for a run paused on an ask (`activity/run.ts`, `executor/graph-run.ts:517`). There is no activity event for `user_intervention_required`.
   - The check headline therefore relies on the build tool event's result code `web.intervention.required`, which the extension's action runtime reports (`content/action-runtime/results.ts`).
   - A run step that hits a robot check surfaces only as "Recovering from a failed step" or "Run failed". The overlay then says "Fixing your Flow", not "Waiting for you".
   - A Core change would be needed to say this for runs: an ask or waiting event when a step fails with `user_intervention_required`.
2. **The check headline claims "waiting" while Core may still be deciding.**
   - The outcome is `waiting` and the mark is still, while the build goes on deciding. The person is asked to act, which matches the brief, but Core does not actually pause.
   - It clears on the next succeeded page action. If Core never gets past the check, it stays until the build settles.
3. **A backdrop counts as clear.** A modal's scrim (60% or more of the viewport, fixed) is treated as covering nothing the person needs. On company-website with consent pending, the pill therefore sits top-left over the scrim-dimmed logo and nav (`01`). If the supervisor would rather see a dot while any modal is open, it is a one-line change to treat `backdrop` as `fixed`.
4. **Repair on builds lasts until the build settles.** Core sends no "repair finished" event, so a build that repairs and then continues normally keeps "Fixing your Flow".
5. **The detail "Build failed" under "Couldn't fix your Flow"** (`07`) is Core's label and not an exact echo, so it is kept. It reads as slightly redundant.
6. **The panel's chat banner reads "This chat isn't updating: finding this chat in FluxIQ failed (FluxIQ answered 200)."** It appears in every window capture. It comes from my fake gateway not serving conversations, so it is not a product signal, but the panel worker may want to know how it words a 200.
