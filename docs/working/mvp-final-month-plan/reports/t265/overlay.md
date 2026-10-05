# t265-overlay — worker report

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t265/!FluxIQWebExtension` (branch `task/t265-extension-ui-integration`). Nothing committed. There were no index or history writes: lane hunks were applied with `git apply` without `--index`.

## Outcome

Done.

- A9's dwell removal and F7's overlay work (model prose, placement over media and docked, status pill, content-message `kind`) are merged under `apps/extension/src/content/activity-overlay/`.
- `docs/architecture/extension-client.md` now describes what landed for t174, t193, t194 and t195, plus decision 1.
- All 62 tests in scope pass.
- `extension check` and the structure audit both exit 0.
- No `status-dwell` / `StatusDwell` / `STATUS_DWELL_MS` reference is left in `apps/extension/src`, `apps/extension/scripts` or the doc.

## What changed and why

Base check: `git diff --stat 45bd6232 HEAD` over the overlay directory printed nothing, so the overlay files equal the lanes' base. The doc had one dev change since that base: t262's two chat-scope paragraphs. They are kept.

### Applied from one lane's diff

- **A9 (t174), whole diff:**
  - `status-dwell.ts` and `tests/status-dwell.test.ts` are deleted.
  - Its export is dropped from `index.ts`.
  - `overlay.ts` calls `pill.update` directly.
  - The `overlay.test.ts` rewrite is applied.
- **F7 (t193), every file except the three shared ones:**
  - `content-message.ts`: the `KINDS` set accepts "action", "thought", "starting" or absent.
  - `status-pill.ts`.
  - `placement/{anchor-style,choose-placement,page-probe,placement-keeper}.ts`: placement over media and docked past a fixed band, via `placement.offset`.
  - `tests/content-message.test.ts` and `placement/tests/choose-placement.test.ts`.
  - New `model-prose.ts`, copied (LF).

### Merged by hand

- **`index.ts`:** A9's header without the dwell, plus F7's "never the model's prose (`model-prose.ts`)", and the `isModelProse` export. There is no dwell export.
- **`overlay.ts`:**
  - A9's header paragraph (draws as it arrives; the pacer is the one pace) and F7's two paragraphs (thought keeps the action line; starting is drawn like any display). F7's "What is left goes through the dwell" paragraph is dropped, and so is F7's clause "never counts as a change of words that would hold the next action back", which only made sense with the dwell.
  - `actionOnly` and the `action` memo are from F7. The draw is now `pill.update(activityOverlayView(shown, …))` instead of `dwell.show`.
- **`tests/overlay.test.ts`:** A9's version, with F7's three tests and the `thoughtEvent` helper appended. The header comment now also names the thought and starting coverage. In F7's first test, one assertion message, "the thought did not restart the dwell", now reads "the thought held nothing back"; the assertion itself is unchanged.
- **Dropped dwell tests:** the dropped ones are A9's choice, kept as A9 made it.
  - In `overlay.test.ts`: "rapid statuses are shown no faster than the dwell, the newest waiting one wins, and the last is never dropped", and "a settled status that arrives inside the dwell waits for it and is then shown, never dropped". A9 replaced these with "the overlay draws each display as it arrives…" and "the overlay stays on the page while the work goes on, and a settled status is drawn at once".
  - The whole of `status-dwell.test.ts` (5 tests).
  - No F7 test asserted the dwell. All three of them are kept.
- **The `kind` union matches** `shared/activity/activity-display.ts` as landed (`kind?: "action" | "thought" | "starting"`, line 53). `content-message.ts` accepts exactly those three or `undefined`.

### Doc (`docs/architecture/extension-client.md`)

- **Lane hunks applied:**
  - t195 (D2, "Build failed" for a build) and t174 (pacer at 1.6 s, step shown at once after a decision, replay numbers, no overlay dwell, scroll follower) applied cleanly.
  - t193 hunks 1–4 and 6 applied with offsets: starting status from send (F9), thoughts never the detail, display `kind`, overlay draws action only, docked placement, composer lease wording.
- **t193 hunk 5 (live line plus composer) was rejected** because the context had moved (A9's scroll-follower text and t262's scope paragraphs). I applied it by hand:
  - The live line is never the model's words, and reads "Starting…" / "Sending your message".
  - Decision 1 is written into the composer paragraph: the box and draft clear at once, and a local person turn shows at once. On a failure the turn stays in the thread with "Couldn't send that. Try again." under it, the composer shows no error, and the words return only to an untouched box, never merged. A fallback drops the turn. The local turn gives way to Core's at the first good read holding a new person turn, or in any case at the first good read started after Core accepted the send.
- **Written from the landed source, since no lane doc covered it:**
  - The headline bullet says retry versus repair (A9 `run-retry.ts`, D12). A run's recovery ladder keeps "Running your Flow" with "The page was busy, trying again". Only Core working out a fix reads "Fixing your Flow". A run that only retried and failed reads "Run failed".
  - The step bullet says the count is dropped during a repair of the Flow itself (t194 `unit-situation.ts`, U2).
  - The thought bullet says a recovery choice keeps the retry line. It also says a decision being made holds the meaningful line, and "Deciding the next step" shows only when nothing meaningful is up (t194 U9). This replaces F7's sentence "Core's own deciding row … is status and is shown", which is no longer true as landed.
- The deferred `activityActionFailureReason` wording is not described.

## Commands run and observed results

1. `node <scratchpad>/t262-gate/run-subset.mjs "$PWD/apps/extension" t265-ov` with these test files:
   - `src/content/activity-overlay/tests/{content-message,cover-detection,overlay-view,overlay,status-pill}.test.ts`
   - `src/content/activity-overlay/placement/tests/choose-placement.test.ts`
   - `src/content/tests/recorder.test.ts`: the only `content/tests` file that reaches the overlay, through `message-handler`/`picker-host`.
   - `src/background/activity/tests/activity-replay.test.ts`: it imports the overlay.

   It printed 8 bundles. `node --test <8 bundles>` printed `# tests 62 # pass 62 # fail 0`.
2. `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0 ("core-build: … current"; `extension:check` built in 19.6 s).
3. `node scripts/structure-audit.mjs` printed `structure-audit: passed (168 warning(s), 118 baselined)`, exit 0. No warning names an overlay path or the doc.
4. `grep -rn "status-dwell\|StatusDwell\|STATUS_DWELL_MS" apps/extension/src apps/extension/scripts docs/architecture/extension-client.md` found nothing (exit 1). Stale compiled copies remain only in ignored build output (`apps/extension/.test-build-scratch/default/…`), which is not source.
5. Every changed or new owned file has zero CR bytes (`tr -cd '\r' | wc -c`).

## What a live run must look at, per defect

- **Overlay lag (A9, `overlay.ts` without `status-dwell.ts`; pace in `background/activity/pacer.ts`, 1.6 s):**
  - The overlay and the panel's live line change words at the same moment, with no sub-second lag.
  - Any 3 s of overlay shows at most two changes of words. This is the Lab UI review's flicker window, and now only the pacer enforces it.
  - "Waiting for you" appears and clears at once.
  - A settled "Flow ready" / "Build failed" reaches the page.
- **Overlay over media (F7, `placement/choose-placement.ts`, `page-probe.ts`, `anchor-style.ts`, `placement-keeper.ts`, `status-pill.ts`):**
  - On a product page with a sticky header and a fixed cart bar, the pill sits docked in the free band above the bar (or below the header), not over the product image or video.
  - It is never more than 40% of the viewport height from its edge.
  - It stays a readable pill with words, never a dot.
  - It does not jump between places while the page is unchanged.
- **Model prose in overlay (F7 `model-prose.ts` + `actionOnly` in `overlay.ts`, keyed on display `kind` from the background pacer):**
  - No refusal text and no model reason ("Store chooser is open; I'll press …") ever appears on the overlay. The previous action line stays up instead.
  - The action after a thought shows on time.
  - "Starting…" is on the page from the send until Core's first activity.

## Not verified

- No live browser, Lab or provider run, as the brief forbids. Placement over real media and docking were exercised only by the unit tests.
- I did not run the background, panel or shared suites. Only the background `activity-replay.test.ts` was run, because it imports the overlay. The other two workers report their own runs.
- The doc's new retry/repair and hold-line sentences are drawn from the comments and code in `pacer.ts`, `run-retry.ts`, `headline.ts` and `unit-situation.ts`, and from background.md. They are not checked against a live trace.

## Open questions or contradictions found

- F7's doc said Core's deciding row "is status and is shown". With t194's hold, as landed, that is true only when nothing meaningful is up, so the doc now says that.
- The doc keeps two historical mentions of the 1.2 s pace (the D13 note, and "A separate 1.6 s overlay dwell over a 1.2 s pace was removed in t174-w109"). Both are history, not current behaviour.
- The scratch bundles from this run are in `apps/extension/.test-build-scratch/t265-ov/` (ignored build output). The supervisor may delete them.
