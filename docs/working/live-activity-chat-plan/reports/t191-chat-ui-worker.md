# Report: t191-chat-ui (worker), lane t191

## Outcome

Partial. I rebuilt `panel/chat/` as a ChatGPT-style chat that fills the panel. It has:

- a one-line header that updates in place;
- a full-height stream: the person's turns are right-hand bubbles, and FluxIQ's turns are full-width formatted text;
- the work behind each answer folded above it as "Worked for 2m 5s · 46 steps";
- a paced live line updated in place;
- "Jump to latest";
- a pinned composer that grows as you type.

Extension `check`, `test` (1278/1278) and `build` all pass.

Browser verification is incomplete. I got one real screenshot: the empty, disconnected state in the side-panel page on company-website. Free RAM then stayed under the 4 GB floor, so there are no screenshots of a populated stream, a connected composer or a collapsed tray. Details are under "Not verified".

## What changed and why

Layout (`panel/simple/simple-view.ts`, `simple.css`, new `simple/tray.ts`):

- The simple view is now a full-height flex column.
- The strip above the chat holds status, setup, Right now, and recording steps and review. It is capped at 42% of the height and scrolls on its own. The chat takes the rest.
  - Side panel: the shell becomes `100vh` via `:has(.simple-view:not([hidden]))`.
  - Popup: the view is 544 px tall.
- The start card and the automations card are folded into a `<details>` tray called "Record, extract, automations".
  - It starts open while the conversation has no turns, and folds once it has some.
  - The person's own toggle wins and is remembered in `localStorage` (try/catch, per viewer).
  - Because the tray is open by default with no turns, the e2e `install-and-content.spec.ts` expectations ("Describe an automation" and the automations offline line visible) still hold. That spec was not run.
- "Right now" hides while `nowCopy(...).kind === "idle"`, because the chat header already covers that.
- Removed:
  - the card chrome around the chat;
  - the footer "Open the full conversation in FluxIQ" link.

  Open FluxIQ remains only where it is needed: the fallback, attachments, and asks that can only be answered in FluxIQ.

Chat (`panel/chat/`):

- `chat-panel.ts` is rewritten.
  - It keeps the old behaviour: the 4 s poll, the 300 ms push-triggered refresh, reconciliation, and fallback.
  - Its new structure is: header, `chat-main` (a scroller with a centred column of at most 720 px, plus a jump button), `chat-dock` (the composer), and the fallback.
  - `createChatPanel` gained an optional third argument `onConversation(hasTurns)` for the tray, and a `focusComposer()` method.
- `header/header-model.ts` and `header-view.ts` are rewritten.
  - The model renders `state.display` only:
    - `status` is the display's `headline`;
    - `tone` is accent while working, then the outcome's colour (done: success, failed: danger, waiting: warning);
    - there is also a `working` flag;
    - the live dot and its reason, and the overlay options, are unchanged.
  - The view is one 36 px line: dot, "FluxIQ", an ellipsized status, and a small segmented control "Page | Full | Small | Off".
  - It writes only changed text and attributes to the same nodes. A missing `display` from an older background reads as empty.
- `stream/stream-items.ts`:
  - rows now carry `activityId` and `endAt`;
  - the unused `expandable` field is removed.
- New `stream/thread-entries.ts` (`buildChatThread(items, working)`) groups the rows:
  - A run of rows between turns splits by `activityId`.
  - A run followed by a FluxIQ turn folds under that turn.
  - A run followed by the person's turn stands alone.
  - The run after the last turn goes to the live line while `display.working`, and stands alone otherwise.
  - A group's key is its first row's, so an opened fold keeps its element and stays open when it moves from the live line to the answering turn.
- New `stream/work-summary.ts`:
  - `workSummary` gives "Worked for 2m 5s · 46 steps · 2 failed", or "N steps so far" while working;
  - `duration` computes the time from Core's event times.
- New `format/`:
  - `parseAssistantText` is a pure parser for paragraphs (single line breaks kept), bulleted and numbered lists (with a start number and continuation lines), headings, fenced code, `**bold**` and `` `code` ``. A link `[label](url)` becomes the text "label (url)".
  - `renderTextBlocks` builds the elements with `createElement` and text nodes only.
  - There is no `innerHTML` anywhere under `panel/chat` or `panel/simple/conversation`.
- New `view/` (DOM parts, each reconciled rather than rebuilt):
  - `place-children.ts`: minimal-move child placement, taken from the old `renderStream`.
  - `message-view.ts`: a person bubble, or FluxIQ's work slot plus formatted words, the attachment note and ask controls. Content is rebuilt only when the turn's content signature changes, so a half-typed answer survives polls.
  - `work-disclosure.ts`: a `<details>` whose summary line opens to a list. Each step shows:
    - a mark: ✓ for done, ✕ for failed, a spinner for started, • for a step that never finished;
    - the title;
    - the ref in monospace;
    - Core's text beneath, clamped to 2 lines.

    Steps are keyed and rebuilt only when they change.
  - `live-line.ts` and `live-line-model.ts`: one persistent `li` with a breathing dot, the headline, "Step N of M" and the detail from `display`, plus the work folded under it. It shows "Sending your message" between a send and the first activity. It is hidden, not removed, between units of work.
  - `thread-view.ts`: reconciles turns, stand-alone folds and the live line, which is always the last child. A turn that arrives is inserted before the live line.
  - `scroll-follow.ts` and `scroll-follower.ts`:
    - `isAtBottom` uses a 32 px slack;
    - following is decided by the person's own scrolling, rechecked when a fold is toggled;
    - "Jump to latest" shows whenever they are away from the bottom;
    - sending or pressing Jump follows again.
- `stream/activity-row.ts` is deleted; `work-disclosure.ts` replaces it.
- `chat.css` is rewritten using tokens only.

Composer (`panel/simple/conversation/`):

- `composer.ts` is rewritten as one rounded field with a round send button (SVG arrow, `aria-label` "Send"/"Sending"). The ids `#conversationInput` and `#conversationSendButton` are kept.
  - The box autosizes up to 8 lines, then scrolls. It is guarded so it never measures 0 px while hidden.
  - Send is disabled when the box is empty, offline, or while sending.
  - The box stays enabled while sending, so focus and caret survive.
  - The draft is kept (`draftStorage`), and the box is refocused after a click on Send.
- New `composer-keys.ts` (`composerKeyAction`):
  - Enter sends; Shift+Enter does nothing, leaving the newline to the textarea.
  - An IME composition never sends. That covers `isComposing`, `keyCode` 229, and the composer's own compositionstart/compositionend flag.
- `turn.ts` is deleted (replaced by `message-view.ts`), and the barrel is updated.

Theme (`panel/theme/tokens.css`): new light and dark tokens:

- `--shadow-sm`, `--chat-font` (system stack), `--chat-mono`, `--chat-size` (14px), `--chat-column` (720px)
- `--bubble`, `--code-bg`, `--composer`, `--composer-focus`
- `--send`, `--send-text`, `--send-off`, `--send-off-text`

Tests (node, in `tests/` folders):

- `chat/tests/fake-dom.ts`: shared test support. `withFakeDocument` installs a minimal DOM and restores the previous `document`.
- `stream/tests/thread-entries.test.ts` (5): grouping under turns, the live line, splitting by `activityId`, and a key that stays the same across the move.
- `stream/tests/work-summary.test.ts` (3).
- `format/tests/assistant-text.test.ts` (5), including that `<img onerror>`, `<script>` and `<b>` render as text, with only P/STRONG/CODE elements built.
- `chat/tests/in-place-updates.test.ts` (4): the header and the live line keep the identical node tree after 50 display updates, and the header reads `display`, not the raw event.
- `view/tests/scroll-follow.test.ts` (4): at the bottom versus scrolled up, and Jump.
- `view/tests/thread-view.test.ts` (3): bubble versus formatted text, turn element reuse, and an opened fold moving intact from the live line to the answer.
- `simple/conversation/tests/composer-keys.test.ts` (3): Enter, Shift+Enter, and all three composition signals.
- `header/tests/header-model.test.ts`: updated for `display`.
- `stream/tests/stream-items.test.ts`: updated for `activityId` and `endAt`.

## Commands run and observed results

- Focused bundle of the `src/panel/**/tests` tests (scratch script, since removed): `# tests 243`, `# pass 243`, `# fail 0`. Every new test name listed above appeared as `ok`.
- `node scripts/structure-audit.mjs`: nothing under `panel/**`. One intermediate FAIL (`fake-dom.ts` exported 2 classes) is fixed.
  - The remaining FAIL is `[working-docs] docs/working/README.md is out of date`, which is not mine.
  - Mid-run, the parallel workers' prefix findings in `background/activity/` and `content/activity-overlay/` also showed up; these are not mine either.
- `heavy.sh "t191 chat check" pnpm --filter @fluxiq-web-extension/extension check`:
  - The first two runs failed only on the parallel workers' files: `content/activity-overlay/*` and `background/activity/tests/activity-relay.test.ts`, which they were editing at the time. There were 0 errors under `src/panel`.
  - The final run: exit 0.
- `EXTENSION_TEST_BUILD_LABEL=t191-chat heavy.sh ... test`: `# tests 1278`, `# pass 1278`, `# fail 0`, exit 0. It passed twice, the second time after the final edits.
- `heavy.sh ... build`: exit 0. It printed "chrome: verified 22 files", "firefox: verified 22 files" and "e2e-chromium: verified 22 files", plus the existing gecko.id placeholder warning.
- Node smoke test: `createChatPanel` mounted under the fake DOM in 7 ms with 40 elements. `render({connectionState:"connected"})` made exactly one request, with no loop.
- Browser, in slot-2 (claimed with mkdir and an owner line, then released, with an EXIT trap on the second try); headed; company-website; provider-free; nothing was sent to FluxIQ:
  - Run 1 at 05:28Z (free RAM 4.35 GB): `pnpm lab:interactive ... --workspace t191-chat` built everything, then failed with `page.goto: Page crashed` on `sidepanel/index.html`.
    - Commit charge was fine: 15.17 GB free virtual memory.
    - Free physical RAM had dropped to 3.78 GB.
    - The node smoke test above rules out a loop in the chat.
  - Run 2 at 05:39Z (4.68 GB): `node packages/test-runner/dist/cli.js interactive company-website ...` reached ready with `livePanel: side-panel`.
    - Screenshot `s1` is `docs/working/live-activity-chat-plan/reports/t191-shots/chat-01-first-load.png`. I looked at it.
    - The fill failed (`action_failed`) because the extension was not connected, so the composer was correctly disabled.
    - Two later screenshots timed out (`code: timeout`).
  - After run 2, free RAM was 3.01 GB. A 20-minute wait for >4.5 GB timed out at 2.74 GB (06:05Z), so I stopped.
- What screenshot 01 shows (a 1280-wide tab of the side-panel page, not connected):
  - the capped strip (status card, "Get set up") scrolls on its own;
  - the one-line chat header: grey dot, FluxIQ, and the Page | Full | Small | Off control;
  - the empty state, centred: "What can FluxIQ do for you?" and "Connect to FluxIQ to start a conversation.";
  - the rounded composer pinned at the bottom, with a disabled round send button and the placeholder "Connect to FluxIQ first".

## Not verified

- **Nothing populated was seen in a browser**:
  - person bubbles, formatted FluxIQ text, folds and their lists, the live line and its breathing dot, Jump to latest, and ask buttons styled in context;
  - the look at real side-panel width (about 400 px);
  - dark mode;
  - composer autosize and focus with a connected box;
  - the tray collapsing.

  The Lab has no action that injects conversation data, sending would make Core call a model (forbidden), and RAM stayed under 4 GB for the rest of the session. These behaviours are covered only by the node tests above against a fake DOM, which cannot check layout or CSS.
- The live `display` from the real pacer: I coded against the `ActivityDisplay` type and fixtures. The parallel worker's pacer was not exercised end to end.
- Firefox popup layout (the 544 px view height).
- The e2e spec `install-and-content.spec.ts` was not run, because Playwright runs on demo pages are forbidden. I only reasoned that its visibility expectations still hold with the tray open by default.
- The cause of the run-1 "Page crashed" is not proven. The evidence points at physical memory pressure (3.78 GB free and falling), not at the chat, but I could not rerun it.

## Open questions or contradictions found

1. **Step counts undercount long builds.** `ACTIVITY_RECENT_LIMIT = 60` events (`shared/**`, not mine) and `CHAT_ACTIVITY_ROW_LIMIT = 40` rows mean a 46-tool build (roughly 160 events) shows only the last rows. So "Worked for ... · N steps" counts what the relay still holds, and the duration starts at the oldest held row. An accurate "46 steps" needs the relay (or `display`) to carry a per-activity step count and a start time.
2. **History placement depends on Core's `createdAt`.** Without it, turns from the first read are history (`-Infinity`), so a finished build's folds opened later sit after its answer as stand-alone folds.
3. **The header shows "FluxIQ" twice.** The brief asked for "FluxIQ" in the chat header, but the shell header above already carries the brand. The lead may want the chat header's name dropped.
4. **Docs not updated.** `docs/architecture/` (the extension-client or UI docs) may describe the old conversation card. Those docs are outside my owned paths, so I did not update them.
