# Shared chat UI fixes (Core ui-components)

Outcome: Partial. Items 2, 6 (placeholder), 7, 9, 11 and the message `<time>` item are fixed; item 8 (switcher not-paired copy) is not.

## What changed (CORE = fxwork/t915/!FluxIQ/packages/ui-components/src)
- Item 2, one New chat: `chat/view/thread-header.ts` hides the bar's "+ New chat" while the Chats list is open, because the list has its own. The chat bar contract is unchanged. Test added in `chat/threads/tests/chat-bar.test.ts`: exactly one control is visible when the list is closed, open and closed again.
- Item 6, blank Library pane: `screens/library/view/list-view.ts` now always says "Reading your subflows..." before the list loads (it was an empty string unless a load was in flight).
- Item 7, slider: `chat/controls/humanness/humanness.css` draws the track on `--edge` for webkit and moz.
- Item 9, disabled controls: `chat/chat.css` and `project-switcher/project-switcher.css` raised from .48 to .62 opacity. This is by inspection, not a measured contrast ratio.
- Item 11, page colour: `.chat-panel` background is now `var(--chat-background, var(--surface))`. A host sets `--chat-background: var(--canvas)` to match its shell; the default is unchanged. The extension or the panel must set it.
- Lead's `<time>` item: `chat/view/message.css` is new and imported by chat.css. `.chat-msg` is now positioned, and the clipped speaker and time boxes are capped at 1px. The `<time>` sits in the `chat-sr-only` header, and I suspect the unanchored absolute box widened narrow pages. This is a probable cause, not reproduced in a browser. The fake DOM cannot test layout, so there is no test for it.
- The rules went into a new sheet because adding them to chat.css took it to 802 lines, past the 800 limit.

## Commands run
- `pnpm exec vitest run src/chat src/project-switcher` -> 110 files, 745 tests passed (an earlier run that included screens/library also passed apart from my new test, fixed in my own test code).
- `pnpm check` -> tsc ran with no errors reported (the output showed only the build-cache line).
- `pnpm build` -> completed, exit 0.
- `node scripts/structure-audit.mjs` in CORE -> no FAIL or violation lines after the split (one FAIL before it: chat.css 802 lines). Remaining output is advisory warnings only.

## Not verified
- No browser or screenshot check of any item, including the `<time>` overflow and the slider track.
- Item 8 not done: the switcher's "Something went wrong." copy needs a not-paired flag on the port, which would change the switcher's API. The brief said to keep that API unchanged. Needs a lead decision.
- Items 10 (tab styling, shell-owned), 12 (scrollbars) and 13 are outside ui-components.
- I did not re-run the Library screen tests after the list-view text change (the earlier combined run passed).

```text
Outcome: Partial
Changed: packages/ui-components/src/{chat/view/thread-header.ts, chat/threads/tests/chat-bar.test.ts, chat/chat.css, chat/view/message.css, chat/controls/humanness/humanness.css, project-switcher/project-switcher.css, screens/library/view/list-view.ts}
Validation: `pnpm exec vitest run src/chat src/project-switcher` -> 745 passed; `pnpm check` and `pnpm build` -> completed without errors; `node scripts/structure-audit.mjs` -> no FAIL lines
Not verified: any visual or browser behaviour; item 8 switcher not-paired copy not done; Library test re-run after the text change
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/shared-chat-ui-fixes.md
Notes: The extension must set --chat-background to match its canvas for item 11.
Notes: Nothing committed.
```
