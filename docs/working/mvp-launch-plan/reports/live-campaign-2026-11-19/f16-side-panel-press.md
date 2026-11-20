# F16: the Lab's Continue press in the side panel never reached the button

Worker report, lane A tree (`fxwork/t959`), 2026-11-19.

## Outcome

Done. The cause is found, shown in real Chrome and fixed in `extension-chat-check/view-target-press/`.
A unit test fails without the fix, using the live run's own words. Every acceptance check passes.
The live case itself has not been rerun: that needs a live run, which this brief did not allow.

## Cause

The press script scrolled the chat itself, and the chat undid the scroll before the mouse arrived.

1. `in-panel-target.ts` (`locate`) called `button.scrollIntoView({ block: "center" })`. It then read the
   button's box and ran `elementFromPoint`, all in the same script. So the hit test always ran on the
   button *after the script's own scroll*: centred, unobstructed, at (59, 369).
2. The extension's chat is Core's `@fluxiq/ui-components`. It follows its newest content
   (`packages/ui-components/src/chat/view/scroll-follower.ts`, shipped in
   `apps/extension/dist/e2e-chromium/sidepanel/index.js`). In its own words: "After a scroll that is not the
   person's, a follower goes back down." Only wheel, touch, scroll keys or dragging the scroll bar count as the
   person's. On the next `scroll` event it set `scrollTop = scrollHeight`.
3. The trusted `Input.dispatchMouseEvent` press came one CDP round trip later. By then the chat had scrolled
   back to the bottom. The mouse landed at (59, 369) on whatever now sat there, not on Continue. So the watch
   saw no click, and Core got no answer.
4. Each retry repeated the same thing: scroll by script, chat puts it back, press misses. So the full 30 s
   failed with the same message.

Why it was intermittent: the script only scrolls when the button can be centred. A button already in the
bottom part of a chat pinned to its bottom cannot move further down, so no scroll happens and the press
lands. That was the scripted run's case. The live Haiku run had more turns, and the Continue button stood
above the middle or out of view, so the script scrolled it and the chat put the scroll back.

### Evidence (real Chrome, provider-free)

The probe was `scratchpad/f16-probe/probe.mjs`. It ran through the heavy-slot gate as `campaign-a-f16-probe`.
It used the Lab's own `openSidePanel` and the e2e extension build, a local page, and no Core and no model.
The pre-fix press code was frozen into `oldpress/` and the new code was transpiled into `newpress/`.

- **The lead's hypothesis is refuted.** I pressed a fixed button injected into the real side panel's document
  with the pre-fix `pressInViewTarget` in each of these states, and it landed every time:
  - the scenario tab in front;
  - the control tab in front;
  - the scenario tab brought to the front again;
  - after a Playwright click and a reload on the scenario tab;
  - a newer tab on the scenario's origin in front;
  - another window in front.

  Each press took 14-26 ms, and the panel's window saw a trusted `pointerdown`, `mousedown`, `mouseup` and
  `click` at the button. There was only one side panel target the whole time, and the panel's size
  (360 x 655) did not change. Bringing a tab to the front does not stop the panel's target from taking input.
- **A minimized window does break input, but differently.** `Input.dispatchMouseEvent got no answer from the
  target within 5000 ms` throws. It is not F16's "did not reach" message.
- **The follower reproduces F16.** I built a scroller in the panel's document that applies the follower's
  rule (a scroll that is not the person's goes back to the bottom). Its button was in row 20 of 80, with the
  view following at the bottom.
  - Pre-fix press: three tries, each `the press at (60, 327) did not reach the "FollowContinue" button`. The
    scroller logged `put back,put back,put back` and recorded 0 clicks.
  - New press: first `the "FollowContinue" button is scrolled out of view`, which turns the wheel. The
    scroller counts that as the person's scroll and keeps it. Then `pressed`, with 1 trusted click.

## Change

Both changes are in owned paths.

- `packages/test-runner/src/extension-chat-check/view-target-press/in-panel-target.ts`: `locate` no longer
  scrolls anything. It works out what shows of the page: the view, cut down by every ancestor that clips its
  overflow, the chat's scroller among them.
  - A button whose centre shows is hit-tested and pressed where it stands, as before.
  - A button scrolled out of view answers `found: false` with the reason "scrolled out of view". It also
    returns the wheel turn a person would make: over the middle of what shows, by the distance along the
    axis it is out on.
  - `PanelTargetAnswer`'s not-found shape gains an optional `wheel` field. There are no new exports.
- `packages/test-runner/src/extension-chat-check/view-target-press/press-in-view-target.ts`: sends that wheel
  turn as real input (`Input.dispatchMouseEvent`, `type: "mouseWheel"`) and returns the reason. The driver's
  existing loop (every 300 ms until its deadline) then looks again and presses. This adds no new waits and
  no new retry counts.
- `packages/test-runner/src/extension-chat-check/tests/panel-driver-press.test.ts`: the fake panel now has a
  view size, `getComputedStyle`, a clipping scroller and a `follows` mode. `follows` plays the chat's
  follower: a script's scroll is put back before the target handles its next command, and a wheel turn stays.
  There are two new tests:
  - a button above the middle of a following chat is pressed where it stands, and the chat is never scrolled
    by script;
  - a button scrolled out of view gets one wheel turn of `deltaY: 546` at (200, 369) and is then pressed at
    (59, 369).

A side effect: after a wheel turn the chat stops following and shows "Jump to latest", as it would for a
person who scrolled up. This only happens when the button was out of view.

## Commands run and observed results

The edit and build protocol was followed both times: check `heavy-slot.mjs status` (no `campaign-a-run`
holder or queue entry), create `lane-a-edit.lock`, edit, build, delete the lock.

| Command | Observed |
| --- | --- |
| `node heavy-slot.mjs run campaign-a-f16-probe -- node scratchpad/f16-probe/probe.mjs <lane A> <copy of e2e-chromium>` | The results above. Exit 0. |
| `node heavy-slot.mjs run campaign-a-f16-build -- bash -c '... pnpm --filter "@fluxiq-web-extension/test-runner..." build'`, twice | `test-runner:build` built, `Done`. Lock deleted after each build. |
| `node --test dist/extension-chat-check/tests/panel-driver-press.test.js dist/extension-chat-check/tests/panel-driver.test.js` | `# tests 9`, `# pass 9`, `# fail 0` |
| The same test file, transpiled, against the pre-fix press code (scratch copy) | `# pass 3`, `# fail 2`. Tests 4 and 5 failed with `The side panel showed no enabled "Continue" button to press: the press at (59, 369) did not reach the "Continue" button`, the live run's own error. |
| `node --test dist/person-simulation/tests/*.test.js` | `# tests 33`, `# pass 33`, `# fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (254 warning(s), 551 baselined).` Exit 0. None of the changed files is named. |
| `FLUXIQ_LAB_INSTANCE=campaign-a-f16 node heavy-slot.mjs run campaign-a-f16 -- bash -c '... pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten --authoring-mode answer-first --scripted-model --attempts 1'` | `the Lab played the person at a check: traffic-screen, cleared, answered person_done in the chat`. Then `attempt 1: answer right. Ended achieved, 10 rows stored, 10 shown`, `NOT LIVE, stand-ins: model, spend`, status `diagnosis_only`. Evidence is in `test-runs/instances/campaign-a-f16/attempts/run-mwoo9ota-6cff4f80` (`person-hand-offs.json`: `cleared`, `person_done`, `via: chat`, 3.9 s). |

## Not verified

- **No live rerun** of `crossborder-marketplace-free-hubs-under-ten`. The brief forbade one. The scripted
  attempt passed both before and after the fix, so it shows there is no regression, not the live case. The
  live case is covered by the follower probe in real Chrome and by the unit tests.
- **The live run's chat state was not captured.** Nothing kept the panel's DOM or a screenshot, so I did not
  see where the live Continue button stood before the script's scroll. The exact match of the error, (59, 369)
  at the panel's middle, together with the probe, is the evidence for the cause.
- **The probe's follower was not Core's own module.** It was a copy of `scroll-follower.ts`'s scroll rule
  injected into the real side panel. The probe never rendered Core's chat with a real ask card.
- I did not run the Firefox popup path or other users of the press (`approval-flow`, the chat check).

## Open questions or contradictions found

- The lead's hypothesis (bringing the scenario tab to the front breaks the panel's target) does not hold.
  Every focus state tested pressed fine. Only a minimized window breaks input, and it fails with a different
  error.
- `attempt-lane/live/run-attempt-command.ts:115` (not mine to edit) scrolls the answer turn with
  `scrollIntoView({ block: "start" })` before taking `answer-turn.jpg`. The same follower probably puts that
  scroll back, so the picture may show the bottom of the chat rather than the turn. This is cosmetic and was
  not verified.
- `attempt-lane/live/press-run-again.ts` scrolls and then calls `button.click()` in the same task, so the
  follower cannot get in between. F16 does not affect it.
