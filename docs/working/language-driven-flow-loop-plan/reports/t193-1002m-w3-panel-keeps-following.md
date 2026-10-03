# t193-1002m-w3: the chat panel keeps following (R1-C4)

## Outcome

Done. Following now ends only when the view moved and is off the bottom. Content that grows while following, including a card that grows in place, keeps the view at the bottom.

## Cause, as confirmed

`apps/extension/src/panel/chat/view/scroll-follower.ts` set `following = isAtBottom(host)` on every `scroll` event. A scroll event also fires for the follower's own `scrollTop = scrollHeight` write. If a card lands between that write and the event's dispatch, the event sees the view off the bottom even though `scrollTop` has not changed. The follower then let go, and from that point `contentChanged()` no longer scrolled.

A card that grows in place (for example "Working on it" turning into "Done" or "Didn't work: ...") was never followed, because nothing called `contentChanged()` for it.

The screenshots agree. `06-mid-build-panel.png` and `12-failure-panel.png` (run `run-murwdp4f-35f976d2`) show the same scroll position one card short of the bottom, with the "Jump to latest" arrow showing. Between them the scrollbar thumb gets smaller and moves up, so content kept growing below a view that nobody moved. The new failing-first test reproduces the same sequence in a fake host.

## Rule chosen, and why

On a scroll event:
- at the bottom: follow;
- else, if `scrollTop` changed by at least 1px from the last value the follower wrote or saw: the person moved, so stop following;
- else, if following: content grew under a view nobody moved, so go back to the bottom.

I tried "moved up and left the bottom" first. It broke three existing tests in `panel/chat/tests/navigation-focus.test.ts`, which model a person scrolling to a mid position from above (a downward move that stops short of the bottom). Under that rule the view was pulled back down to the bottom, which is wrong. Comparing against the last position the follower set or saw is simpler, keeps that contract, and still tells the follower's own write apart from the person.

I did not add wheel, touch or key listeners: every way the person scrolls changes `scrollTop`, so they are not needed. In-place growth is handled by a `ResizeObserver` on the scrolled content (`column`), which calls `contentChanged()`. That call does nothing for someone who has scrolled away, apart from keeping the jump button correct, so a reader is never pulled down.

## What changed

- `apps/extension/src/panel/chat/view/scroll-follower.ts`
  - Tracks `lastTop` and applies the rule above.
  - New optional third parameter `content?: Element`, watched by a `ResizeObserver` when the browser has one.
  - `toBottom()` records the clamped `scrollTop` it produced; `recheck()` records the position too.
  - Header comment explains the rule.
- `apps/extension/src/panel/chat/chat-panel.ts`: one line, which passes `column` to `createScrollFollower`. This is wiring only.
- `apps/extension/src/panel/chat/view/tests/scroll-follow.test.ts`
  - The fake host now clamps `scrollTop` like a browser. Without clamping, two of the new tests passed before the fix for the wrong reason. Existing assertions now compare against `bottom()`.
  - Three new tests:
    1. A late scroll event after growth, with no move, keeps following, and the next change scrolls to the bottom.
    2. In-place growth seen through a fake `ResizeObserver` ends at the bottom.
    3. The person scrolling up stops following and shows the jump; growth while they read does not pull them down; `followNow` resumes.

`scroll-follow.ts` and `view/index.ts` did not change; the barrel already exports the follower.

## Commands run and observed results

The extension test runner has no scope option, so I ran a scratch copy of `scripts/test-extension.mjs` that only collects `src/panel/chat/**/tests/*.test.ts`. It writes to `.test-build-scratch/t193-1002m-w3`.

- **Failing first** (before the fix, with the clamping host): `node <scratch>/t193-w3-run-chat-tests.mjs`
  - `not ok 221 - content that grows after the follower scrolled does not let go...` with `expected: true actual: false`
  - `not ok 222 - a card growing in place while following ends at the bottom` with `expected: 720 actual: 600`
  - Totals: `# tests 228 # pass 226 # fail 2`
  - The scroll-up test passed both before and after, as it should: it covers behaviour that already existed and must stay.
- **First fix ("moved up" rule)**: navigation-focus tests 199, 200 and 201 failed (`900 !== 80`). This is what led to the rule above.
- **After the final fix**: `EXTENSION_TEST_BUILD_LABEL=t193-1002m-w3 node <scratch>/t193-w3-run-chat-tests.mjs` exited 0 with `# tests 228 # pass 228 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` in `apps/extension`: exit 0.
- `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (159 warning(s), 118 baselined).`, exit 0.

## Not verified

- Behaviour in a real browser (Chrome side panel, Firefox popup): the actual order of scroll events, whether the `ResizeObserver` fires, scroll anchoring, and fractional `scrollTop` on high-DPI screens. All checks so far use fake hosts and a fake DOM.
- A live Lab run to confirm the panel shows FluxIQ's ending at the failure moment.
- The panel scroller's own size changes (for example the composer growing) are not observed. The scroll event that follows one is handled by the same rule, but browsers do not always fire a scroll event when only the viewport height changes.

## Open questions or contradictions

- `apps/extension/scripts/test-extension.mjs` cannot scope tests to a directory, although the brief says to "see it for how to scope". Adding a path filter there would let workers run narrow checks without a scratch copy.
- The scroll-up case "stops following and shows the jump" already worked before this change, so its test could not fail first; it is kept as a guard.
