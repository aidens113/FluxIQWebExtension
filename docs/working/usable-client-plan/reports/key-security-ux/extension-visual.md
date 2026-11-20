# extension-visual (t925, key-security-ux): report

## Outcome
Done, with two items left as reports (the chat-list cause is in X/background; the "Extract Data From This Page" case is a Lab contract). X = apps/extension/src. Nothing committed.

## Per item
- #20 (projects): header label flipped to "Project" when a later status named the id but not the name. `X/panel/projects/project-selector.ts` now remembers names by id (from statuses and the list) and reuses them. Test: project-selector.test.ts "a later status that names only the id keeps the name". The "All projects" in the chat context bar is Core's ui-components, not changed.
- #21 (shell): Settings stays a header button (tab ids and the Lab's `#settingsButton` kept), but in use it now reads like a selected tab (`shell.css`: `.top-settings.active` plain text colour, weight 600, not amber) and carries `aria-current="page"` (`top-bar.ts`). Test: top-bar.test.ts "Settings in use is marked as the current page".
- #22 (automations): under the Tasks / Library switch the list heading is now "Saved automations" (plain "Your automations" without the switch) in `automations-tab.ts`; test in automations-tab-search.test.ts. NOT changed: button text "Extract Data From This Page": the Lab presses it by that exact name (packages/test-runner/src/ui-e2e/journeys/extraction.ts:148, and recording/extract-control.ts says so); sentence case needs a Lab change first.
- #23 (settings): `settings.css`: group titles are sentence case, 13px, text colour (no mono, no upper case); the slider's end labels are 11px sans, not 10px upper-case mono. CSS only: effect is Connection / AI key / Behaviour read like the rest of the panel; the slider ends read "Fastest" / "Most human-like" as written.
- #24 (getting-started): Change is now a `small-button` like the other steps' buttons (was an amber link-button); step 3's line always shows (done earlier by extension-flow). `start/view.ts`. Existing Change tests pass by name.
- #25 (revoked): words and the Settings Connect button were done by extension-flow; nothing more needed in X.

## Chat list said "No chats yet" (item 2)
Cause: the extension lists with `kind: "list-all"` (X/panel/chat/transport/ports/conversation.ts:26), which X/background/panel/conversation-relay.ts:74 relays only as Core `list-conversations` (project threads). The 17 chats were made in the panel's assistant, which are panel threads (projectId "panel") read by `list-panel-threads` (same cause as chats-list-live.md in the web panel). So it is not scoped by client or a silent failure; the extension never asks for panel threads. Fix belongs in X/background (relay `list-all` should also call `list-panel-threads`, merge, dedupe) and the extension's thread open for projectId "panel" needs the same relay routing; both outside my paths (X/background must not be touched), so reported, not fixed. Needs t928/t929-free owner.

## Stale words (item 3)
- `X/panel/copy/connection-copy.ts`: disconnected line "Connect to ask FluxIQ to approve this browser."; pairing sentence "Connect and approve in FluxIQ"; copy/tests/copy.test.ts updated to match.
- `e2e/content/tests/screens/tests/setup-company-website.spec.ts:72` now expects "Connect and approve". Not run (needs a browser).

## Commands
- `heavy-slot run t925-xvis-check2 -- pnpm --filter @fluxiq-web-extension/extension check`: first attempt (t925-xvis-check) refused, Core build stale (another worker was rebuilding it); rerun after it finished: "core-build: ... is current", extension:check stored, no errors. The top-bar test was fixed after this run (test-only change).
- `EXTENSION_TEST_BUILD_LABEL=t925-xvis heavy-slot run t925-xvistest2 -- node scripts/test-extension.mjs panel/projects panel/shell panel/automations panel/extraction panel/settings panel/getting-started panel/copy panel/chat`: `# tests 620 / # pass 620 / # fail 0` (first run 619/1: my new top-bar test used the fake DOM without its classList helper; fixed).
- `heavy-slot run t925-xvisaudit -- node scripts/structure-audit.mjs`: `structure-audit: passed (253 warning(s), 551 baselined).`

## Not verified
- No live browser or screenshots: all CSS changes (#21, #23, #24) unseen; a screenshot pass should check Settings highlight, the 360 px header, and the slider ends.
- Typecheck was not re-run after the last test-only edit to top-bar.test.ts.
- e2e spec edit not executed.
- Names remembered by id live per panel session only.

## Open questions
- Chat-list fix in X/background (above) needs an owner; a Core-side parse of panel records is also needed if the relay returns them (parseConversations drops `subjectKind:"panel"`, per chats-list-live.md).
- Whether to lower-case the extract button and update the Lab's exact-name press together.
