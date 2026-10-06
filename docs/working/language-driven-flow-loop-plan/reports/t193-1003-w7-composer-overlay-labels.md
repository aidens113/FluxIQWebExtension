# t193-1003-w7 — composer, overlay, labels (worker report)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQWebExtension`. X = `apps/extension/src`.

## Outcome

Partial. D1, D5 and D6 are fixed and tested. The overlay's share of D13 is fixed; the background pacer's share is outside my scope. D14's cause is not in the overlay, so the fix belongs to files I don't own. D7: I changed nothing, because target matching depends on the exact glued text.

## What changed and why

**D1, composer (X/panel/chat/conversation/composer.ts).** `submit()` now empties the box and the kept draft the moment a message is sent. If the send fails or rejects, the words come back only when the box is untouched since then: same owner, owner still current, no edit, box still empty. Newer words, an example filled in, or another chat's owner always win. The header comment is updated. chat-panel.ts is untouched.
- Tests: `composer-draft.test.ts` now asserts the box and the stored draft are empty right after the click, in all six scenarios. These were the failing tests first: 6/6 failed before the fix. "failed" still expects "submitted" restored.
- `composer-owner.test.ts`: the test "accepted old-owner send cannot clear adopted identical text…" relied on the box keeping its words while sending, and the box no longer does that. I replaced it with "send empties the box at once; a late old-owner failure never restores into another owner's box or releases its send".

**D5, placement (X/content/activity-overlay/placement/*).** Cause: on bigbox-retail product pages there is a sticky header (0–93) and a fixed Add to cart bar (630–705). Both left corners are busy, so rule 3 picked the left midpoint, which is right on the product `<img>` (moments 4, 6, 11, 13, 16, 18: rect y 318.5/327).
- `page-probe.ts`: the probe now also returns `content`. That is media (img, picture, video, canvas, svg, iframe, object, embed) or an element with its own non-blank text node.
- `choose-placement.ts` rule 4:
  - Among clear corners, the one over the least content plus controls wins.
  - When every corner is busy, each corner is also tried docked: moved in by `offset` to one margin past the fixed band. The band's inner edge is found by stepping 2 px at a time from each fixed sample point. A docked place must stay within 40% of the viewport height from its edge, and steps past at most 3 bands.
  - The rule-3 rank is now [fixed, covers any content/control, shape, held, covered count]. Hold-stability is kept: a place that covers anything readable is still kept while held against other such places.
  - `OverlayPlacement` has an optional `offset`.
- `anchor-style.ts` takes `offset`. `placement-keeper.ts` compares `offset`. `status-pill.ts` passes `placement.offset`, and its header comment is updated.
- Tests: added the product-page geometry test (pill bottom-left, docked above the bar, below the image, gap ≤ 24 px). Added "docked place kept while held" and "clear corner over least content". Two existing tests used the shallow banner and header page, where a full pill now docks above the banner. That is the new, intended answer, so both tests now use deeper bands that cannot be docked past, which keeps their original intent. One of them also asserts that the shallow page now gets the docked full pill.

**D6 and D13, prose (new X/content/activity-overlay/model-prose.ts; overlay.ts; index.ts).**
- D6 cause: Core sends a refusal (`draft-edit.ts`, which calls `emitAutomationStudioActivityThought`) and the model's reason as `detail.kind: "thought"` rows with `text`. `shared/activity/wording.ts` `thoughtAction` makes that text the detail.
- `isModelProse(activity, display)` is true when the message's raw `activity` is the event the display was built from (same `sequence` and `activityId`) and that event is a thought with non-blank text. Core's own "Deciding the next step" row has no text and is still drawn.
- `overlay.ts` replaces a prose display's detail with the last action line it gave the dwell for the same unit of work, or none. So prose never reaches the page.
- D13 cause, from moment 3's samples: the thought "Store chooser is open; I'll press…" was on screen from t=0 to about 1.0 s, "Clicking “Set as my store”" only from 1.2 s, and the page had already changed at t=0. The thought counted as a change of words for the overlay's 1.6 s dwell, so the dwell held the action line back. Now the thought keeps the same words, the dwell does not restart, and the action draws as soon as it arrives. The test checks this: the action is drawn 100 ms after a thought.
- Tests: two tests added in `tests/overlay.test.ts`. The prose test failed before the fix.

**D14 (no change).** Moment 2's window opened at 18:03:46.114, and the first 7 samples (0–1206 ms) are absent with the same `documentOrigin` (no page load). The Lab's checkpoints: "instruction sent" at 46.285 and "instruction answered" at 46.989. The overlay was present from 47.515 with "Building your Flow". Core's `build-trace` "loop start" was at 48.054 and its first tool at 48.079. The panel screenshot 02 still shows "Sending your message". So the absent samples fall before the send (0–171 ms) and between send and the build's first activity event. The background had no display to send, and the overlay drew within about 0.5 s of Core answering. The fix is not the overlay's: have the background (or the panel's send path) put up a "Starting your build" display the moment the person sends a build message.

**D7 (no change, as the brief requires).**
- Where the words are joined: extension capture. `X/content/identity/accessible-name.ts` `nameFromContent` calls `X/content/sensitive-text.ts` `textOutsideSensitiveControls(element)`, which reads `element.textContent`. `X/content/identity/candidates.ts:210` sets `visibleText = normalizedText(element.textContent)`.
- In the fixture, `<button><span>Pickup or delivery?</span><span>Millbrook…</span></button>` (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts:29`) and the size buttons have block spans, which `textContent` glues together.
- Matching depends on that exact glued text:
  - `X/content/identity/stable-name.ts:93`: `if (accessibleNameFor(element) !== normalizedText(runs.join(""))) return undefined;`. The stable-name reading requires the name to equal the runs joined with no separator.
  - `X/content/identity/record.ts:345`: `accessibleNameFor(element) === name` (alike-control test).
  - `score.ts` hands `visibleText` and `accessibleName` to Core's fingerprint, which compares after whitespace normalisation only (`identity/normalized-text.ts`). Every saved Flow already records the glued names ("12 Double Rolls$16.47"), so joining with a space would stop recorded targets matching ("Rolls$16.47" vs "Rolls $16.47").
- Site: bigbox-retail size chips and store chip. Risk: the names read badly to the model and the person, and two runs can merge into one word.
- A safe fix is display-only: separate runs where the label is worded for a person (Core's tool-call title or the domain's `does`), leaving identity untouched. Or change name capture and fingerprint comparison together, with a migration rule that treats a glued recorded name as equal to its spaced form.

## Commands run and observed results

- Scoped tests ran with my own esbuild bundle into `apps/extension/.test-build-scratch/t193-w7-scoped`, removed afterwards. It uses the same esbuild options as `scripts/test-extension.mjs`, which has no file filter, and runs `node --test` over the bundles.
  - Before the fixes: composer-draft `# fail 6`; choose-placement `# fail 2` (the 2 new tests); overlay prose test `not ok 4`.
  - Final run, 15 files (composer-draft, composer-owner, controller, chat-panel, chat-owner-recovery, live-run-display, navigation-focus, mount-panel-navigation, choose-placement, overlay, overlay-view, content-message, status-dwell, status-pill, cover-detection): `# tests 124`, `# pass 124`, `# fail 0`.
- `apps/extension: tsc -p tsconfig.json --noEmit` gave exit 0. `tsc -p tsconfig.test.json --noEmit` gave exit 0.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (164 warning(s), 118 baselined).` None of the warnings name my files.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w7 build" pnpm --filter @fluxiq-web-extension/extension build` printed: `chrome: verified 22 files`, `firefox: verified 22 files` (with the existing gecko.id placeholder warning), `e2e-chromium: verified 22 files`. Build-cache said it was not stamped because Core inputs changed while it ran; that came from other workers.
- My Python edits first wrote CRLF into 4 files. I converted them back to LF, and every changed file has 0 CR bytes.

## Not verified

- No live or browser run (none allowed). The page probe's `content` classification and the docked placement have not been seen on a real page. They are checked only against synthetic rectangles. On a real page, whether a point counts as content depends on the hit-test element. For example, a `<p>`'s whole box counts as text, including blank space beside short text.
- The prose filter works only when the message's raw `activity` is the display's own event. The relay's 4/s gate can carry a newer raw event, and then a thought's prose can still show. The full fix needs a kind flag on `ActivityDisplay`, or the pacer marking it (`X/background/activity/pacer.ts`, `X/shared/activity/activity-display.ts`). Neither is mine.
- D13: the background pacer still counts a thought as a detail change (1.2 s interval), so the action line can still wait up to 1.2 s there. I did not change this.
- The full extension suite (`pnpm --filter … test`) was not run, per the narrow-checks rule.

## Open questions or contradictions found

- Cause 15 in the debug doc proposes "Join a control's text runs with a space" for D7. That conflicts with `stable-name.ts:93` and with every recorded fingerprint. The supervisor should choose between a display-only separator and a coordinated identity change with migration.
- D14 needs an owner for an immediate "starting" display on send: background activity or the panel send path.
- D6 is fully closed only with a display-level kind: the background or shared types, plus Core's cause 14.
